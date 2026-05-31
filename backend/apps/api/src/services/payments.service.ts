import { Injectable, Optional } from '@nestjs/common';
import {
  PaymentOrderStatus,
  PaymentProductKind,
  PaymentProvider,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';
import { SubscriptionService } from './subscription.service';
import { TbankAcquiringService } from './tbank-acquiring.service';
import { TokensService } from './tokens.service';
import { RedisCacheService } from './redis-cache.service';
import {
  type PaymentProduct,
  type PaymentProductKindValue,
  findPaymentProduct,
  tokenPackProducts,
  type TokenPackProduct,
  tokenPromotionOptions,
} from './payment-catalog';

type ConfirmPaymentInput = {
  orderId: string;
  paymentId?: string | null;
  amountKopecks: number;
  rawStatus: string;
  rawNotification?: Record<string, unknown>;
};

@Injectable()
export class PaymentsService {
  private readonly pendingCatalogLoads = new Map<string, Promise<any>>();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly tbank: TbankAcquiringService,
    private readonly subscriptionService: SubscriptionService,
    private readonly tokensService: TokensService,
    @Optional() private readonly redisCache?: RedisCacheService,
  ) {}

  async getCatalog(userId?: string) {
    const cacheKey = this.catalogCacheKey(userId);
    const cached = await this.redisCache?.getJson(cacheKey);
    if (cached != null) {
      return cached;
    }

    const pending = this.pendingCatalogLoads.get(cacheKey);
    if (pending != null) {
      return pending;
    }

    const loading = this.loadFreshCatalog(userId)
      .then(async (response) => {
        await this.redisCache?.setJson(cacheKey, response, 60);
        return response;
      })
      .finally(() => {
        this.pendingCatalogLoads.delete(cacheKey);
      });
    this.pendingCatalogLoads.set(cacheKey, loading);

    return loading;
  }

  private async loadFreshCatalog(userId?: string) {
    const tbankEnabled = this.tbank.isEnabled();
    const [subscriptionCatalog, tokenDiscountPercent] = await Promise.all([
      this.subscriptionService.getCatalog(),
      this.resolveTokenDiscountPercent(userId),
    ]);
    return {
      tbankEnabled,
      provider: tbankEnabled ? 'tbank' : null,
      subscriptions: subscriptionCatalog.plans.map((product) => ({
        id: product.id,
        productKind: 'subscription',
        label: product.label,
        description: product.description,
        priceRub: product.priceRub,
        priceMonthlyRub: product.priceMonthlyRub,
        tokenCost: product.tokenCost,
        tokenMonthlyCost: product.tokenMonthlyCost,
        trialDays: product.trialDays,
        durationDays: product.durationDays,
        badge: product.badge,
        benefits: product.benefits,
      })),
      plusBenefits: subscriptionCatalog.plusBenefits,
      tokenPacks: this.catalogTokenPacks(subscriptionCatalog).map((product) =>
        this.mapTokenPack(product, tokenDiscountPercent),
      ),
      promoOptions: tokenPromotionOptions,
    };
  }

  private catalogCacheKey(userId?: string) {
    return `payments:catalog:v1:${userId ?? 'anonymous'}`;
  }

  isEnabled() {
    return this.tbank.isEnabled();
  }

  async initPayment(userId: string, body: Record<string, unknown>) {
    if (!this.tbank.isEnabled()) {
      throw new ApiError(503, 'tbank_disabled', 'T-Bank payments are disabled');
    }

    const productKind = typeof body.productKind === 'string' ? body.productKind : '';
    const productId = typeof body.productId === 'string' ? body.productId : '';
    if (productKind === 'subscription') {
      throw new ApiError(
        400,
        'subscription_paid_with_tokens',
        'Frendly+ is paid with tokens',
      );
    }
    const product =
      productKind === 'tokens'
        ? await this.resolveTokenPaymentProductForUser(userId, productId)
        : await this.resolvePaymentProductForUser(
            userId,
            findPaymentProduct(productKind, productId),
          );
    const buyer = await this.prismaService.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
      },
    });

    if (!buyer) {
      throw new ApiError(404, 'user_not_found', 'User not found');
    }

    const order = await this.prismaService.client.paymentOrder.create({
      data: {
        userId,
        provider: PaymentProvider.tbank,
        productKind: product.kind as PaymentProductKind,
        productId: product.id,
        amountKopecks: product.amountKopecks,
        currency: 'RUB',
        orderId: this.createOrderId(),
        status: PaymentOrderStatus.pending,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        ...(product.kind === 'tokens'
          ? { productSnapshot: this.tokenPackSnapshot(product) }
          : {}),
      },
    });

    try {
      const response = await this.tbank.initPayment({
        Amount: product.amountKopecks,
        OrderId: order.orderId,
        Description: product.description,
        NotificationURL: this.notificationUrl(),
        SuccessURL: this.returnUrl('success', order.orderId, product.kind),
        FailURL: this.returnUrl('fail', order.orderId, product.kind),
        PayType: 'O',
        ...this.receiptPayload(product, buyer),
      });

      const updated = await this.prismaService.client.paymentOrder.update({
        where: { id: order.id },
        data: {
          providerPaymentId: response.PaymentId ?? null,
          paymentUrl: response.PaymentURL ?? null,
          rawStatus: response.Status ?? null,
        },
      });

      return this.mapOrder(updated);
    } catch (error) {
      await this.prismaService.client.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: PaymentOrderStatus.failed,
          failedAt: new Date(),
        },
      });
      throw error;
    }
  }

  async checkPayment(userId: string, orderId: string) {
    const order = await this.prismaService.client.paymentOrder.findUnique({
      where: { orderId },
    });
    if (!order || order.userId !== userId) {
      throw new ApiError(404, 'payment_order_not_found', 'Payment order not found');
    }
    if (order.status === PaymentOrderStatus.confirmed) {
      return this.mapOrder(order);
    }
    if (!order.providerPaymentId) {
      throw new ApiError(409, 'payment_not_initialized', 'Payment is not initialized');
    }

    const state = await this.tbank.getState(order.providerPaymentId);
    const amount = Number(state.Amount ?? order.amountKopecks);
    if (amount !== order.amountKopecks) {
      await this.markPaymentStatus(order.orderId, PaymentOrderStatus.failed, state.Status);
      throw new ApiError(409, 'payment_amount_mismatch', 'Payment amount mismatch');
    }

    if (state.Status === 'CONFIRMED') {
      return this.confirmPaymentOrder({
        orderId: order.orderId,
        paymentId: state.PaymentId ?? order.providerPaymentId,
        amountKopecks: amount,
        rawStatus: state.Status,
        rawNotification: state as Record<string, unknown>,
      });
    }

    const mappedStatus = this.mapTbankStatus(state.Status);
    if (mappedStatus !== PaymentOrderStatus.pending) {
      await this.markPaymentStatus(order.orderId, mappedStatus, state.Status);
    }

    const fresh = await this.prismaService.client.paymentOrder.findUnique({
      where: { orderId: order.orderId },
    });
    return this.mapOrder(fresh ?? order);
  }

  async handleTbankWebhook(body: Record<string, unknown>) {
    const terminalKey = typeof body.TerminalKey === 'string' ? body.TerminalKey : '';
    const token = typeof body.Token === 'string' ? body.Token : '';
    if (terminalKey !== this.tbank.getTerminalKey()) {
      throw new ApiError(400, 'tbank_terminal_mismatch', 'T-Bank terminal mismatch');
    }
    if (!token || token !== this.tbank.buildToken(body)) {
      throw new ApiError(400, 'tbank_invalid_token', 'T-Bank token is invalid');
    }

    const orderId = typeof body.OrderId === 'string' ? body.OrderId : '';
    const status = typeof body.Status === 'string' ? body.Status : '';
    const paymentId = typeof body.PaymentId === 'string' ? body.PaymentId : null;
    const amountKopecks = Number(body.Amount);

    if (!orderId || !Number.isFinite(amountKopecks)) {
      throw new ApiError(400, 'tbank_invalid_payload', 'T-Bank payload is invalid');
    }

    if (status === 'CONFIRMED') {
      await this.confirmPaymentOrder({
        orderId,
        paymentId,
        amountKopecks,
        rawStatus: status,
        rawNotification: body,
      });
      return 'OK';
    }

    await this.markPaymentStatus(orderId, this.mapTbankStatus(status), status, body);
    return 'OK';
  }

  async confirmPaymentOrder(input: ConfirmPaymentInput) {
    return this.prismaService.client.$transaction(async (client) => {
      const order = await client.paymentOrder.findUnique({
        where: { orderId: input.orderId },
      });
      if (!order) {
        throw new ApiError(404, 'payment_order_not_found', 'Payment order not found');
      }
      if (order.amountKopecks !== input.amountKopecks) {
        await client.paymentOrder.update({
          where: { id: order.id },
          data: {
            status: PaymentOrderStatus.failed,
            failedAt: new Date(),
            rawStatus: input.rawStatus,
            rawNotification: this.jsonValue(input.rawNotification),
          },
        });
        throw new ApiError(409, 'payment_amount_mismatch', 'Payment amount mismatch');
      }
      if (order.status === PaymentOrderStatus.confirmed) {
        return this.mapOrder(order);
      }

      const confirmed = await client.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: PaymentOrderStatus.confirmed,
          confirmedAt: new Date(),
          providerPaymentId: input.paymentId ?? order.providerPaymentId,
          rawStatus: input.rawStatus,
          rawNotification: this.jsonValue(input.rawNotification),
        },
      });

      if (order.productKind === PaymentProductKind.subscription) {
        await this.subscriptionService.activatePaidSubscription(
          order.userId,
          order.productId,
          order.id,
          client,
        );
      } else if (order.productKind === PaymentProductKind.tokens) {
        const snapshot = this.parseTokenPackSnapshot(order.productSnapshot);
        await this.tokensService.creditPurchasedTokens(
          order.userId,
          snapshot ?? order.productId,
          order.id,
          client,
        );
      }

      return this.mapOrder(confirmed);
    });
  }

  private async markPaymentStatus(
    orderId: string,
    status: PaymentOrderStatus,
    rawStatus?: string,
    rawNotification?: Record<string, unknown>,
  ) {
    const failedAt =
      status === PaymentOrderStatus.failed ||
      status === PaymentOrderStatus.expired ||
      status === PaymentOrderStatus.canceled
        ? new Date()
        : undefined;
    await this.prismaService.client.paymentOrder.update({
      where: { orderId },
      data: {
        status,
        failedAt,
        rawStatus,
        ...(rawNotification == null
          ? {}
          : { rawNotification: this.jsonValue(rawNotification) }),
      },
    });
  }

  private mapTbankStatus(status: string | undefined): PaymentOrderStatus {
    if (status === 'CONFIRMED') {
      return PaymentOrderStatus.confirmed;
    }
    if (status === 'DEADLINE_EXPIRED') {
      return PaymentOrderStatus.expired;
    }
    if (status === 'CANCELED') {
      return PaymentOrderStatus.canceled;
    }
    if (status === 'REJECTED' || status === 'REFUNDED' || status === 'PARTIAL_REFUNDED') {
      return PaymentOrderStatus.failed;
    }
    return PaymentOrderStatus.pending;
  }

  private jsonValue(value: Record<string, unknown> | undefined) {
    return value == null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
  }

  private mapOrder(order: {
    orderId: string;
    providerPaymentId: string | null;
    paymentUrl: string | null;
    status: PaymentOrderStatus;
    productKind: PaymentProductKind;
    productId: string;
  }) {
    return {
      orderId: order.orderId,
      paymentId: order.providerPaymentId,
      paymentUrl: order.paymentUrl,
      status: order.status,
      productKind: order.productKind,
      productId: order.productId,
    };
  }

  private async resolvePaymentProductForUser(
    userId: string,
    product: PaymentProduct,
  ): Promise<PaymentProduct> {
    if (product.kind !== 'tokens') {
      return product;
    }
    const discountPercent = await this.resolveTokenDiscountPercent(userId);
    if (discountPercent <= 0) {
      return product;
    }
    const amountKopecks = this.discountAmountToWholeRubles(
      product.amountKopecks,
      discountPercent,
    );
    return {
      ...product,
      amountKopecks,
      priceRub: Math.floor(amountKopecks / 100),
    };
  }

  private async resolveTokenPaymentProductForUser(
    userId: string,
    productId: string,
  ): Promise<TokenPackProduct & {
    originalPriceRub?: number | null;
    discountPercent?: number;
  }> {
    const product = await this.findCatalogTokenPack(productId);
    const discountPercent = await this.resolveTokenDiscountPercent(userId);
    if (discountPercent <= 0) {
      return {
        ...product,
        originalPriceRub: null,
        discountPercent: 0,
      };
    }
    const amountKopecks = this.discountAmountToWholeRubles(
      product.amountKopecks,
      discountPercent,
    );
    return {
      ...product,
      amountKopecks,
      priceRub: Math.floor(amountKopecks / 100),
      originalPriceRub: product.priceRub,
      discountPercent,
    };
  }

  private async findCatalogTokenPack(productId: string): Promise<TokenPackProduct> {
    const catalog = await this.subscriptionService.getCatalog();
    const product = this.catalogTokenPacks(catalog).find((item) => item.id === productId);
    if (!product) {
      throw new ApiError(400, 'invalid_token_pack', 'Token pack is invalid');
    }
    return product;
  }

  private async resolveTokenDiscountPercent(userId?: string) {
    if (!userId) {
      return 0;
    }
    const [premium, rules] = await Promise.all([
      this.subscriptionService.hasPremiumAccess(userId),
      this.subscriptionService.getPlusBenefitRules(),
    ]);
    return premium ? rules.tokenPurchaseDiscountPercent : 0;
  }

  private catalogTokenPacks(catalog: { tokenPacks?: unknown }): TokenPackProduct[] {
    const packs = Array.isArray(catalog.tokenPacks) ? catalog.tokenPacks : null;
    if (!packs) {
      return [...tokenPackProducts];
    }
    return packs.map((item) => {
      const raw = item as Record<string, unknown>;
      const priceRub = Number(raw.priceRub ?? 0);
      return {
        kind: 'tokens' as const,
        id: String(raw.id ?? ''),
        label: String(raw.label ?? ''),
        description: String(raw.description ?? ''),
        priceRub,
        amountKopecks: priceRub * 100,
        tokens: Number(raw.tokens ?? 0),
        bonus: Number(raw.bonus ?? 0),
        best: raw.best === true,
      };
    }).filter((item) => item.id && item.priceRub > 0 && item.tokens > 0);
  }

  private mapTokenPack(
    product: TokenPackProduct,
    discountPercent: number,
  ) {
    const discountedAmount =
      discountPercent > 0
        ? this.discountAmountToWholeRubles(product.amountKopecks, discountPercent)
        : product.amountKopecks;
    const priceRub = Math.floor(discountedAmount / 100);
    return {
      id: product.id,
      productKind: product.kind,
      label: product.label,
      tokens: product.tokens,
      bonus: product.bonus,
      priceRub,
      originalPriceRub: discountPercent > 0 ? product.priceRub : null,
      discountPercent,
      best: product.best,
    };
  }

  private tokenPackSnapshot(
    product: TokenPackProduct & {
      originalPriceRub?: number | null;
      discountPercent?: number;
    },
  ) {
    return {
      id: product.id,
      label: product.label,
      description: product.description,
      priceRub: product.priceRub,
      originalPriceRub: product.originalPriceRub ?? null,
      discountPercent: product.discountPercent ?? 0,
      amountKopecks: product.amountKopecks,
      tokens: product.tokens,
      bonus: product.bonus,
    };
  }

  private parseTokenPackSnapshot(value: unknown) {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const raw = value as Record<string, unknown>;
    const packId = typeof raw.id === 'string' ? raw.id : '';
    const tokens = Number(raw.tokens);
    const bonus = Number(raw.bonus ?? 0);
    if (!packId || !Number.isInteger(tokens) || tokens <= 0 || !Number.isInteger(bonus) || bonus < 0) {
      return null;
    }
    return { packId, tokens, bonus };
  }

  private discountAmountToWholeRubles(amountKopecks: number, discountPercent: number) {
    const amountRub = amountKopecks / 100;
    const discountedRub = Math.round(
      amountRub * ((100 - discountPercent) / 100),
    );
    return Math.max(
      100,
      discountedRub * 100,
    );
  }

  private createOrderId() {
    return `fr_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
  }

  private notificationUrl() {
    const configured = process.env.TBANK_NOTIFICATION_URL?.trim();
    if (configured) {
      return configured;
    }
    const publicApiUrl = process.env.PUBLIC_API_URL?.trim()?.replace(/\/+$/, '');
    if (!publicApiUrl) {
      throw new ApiError(503, 'payment_notification_url_missing', 'Payment callback URL is missing');
    }
    return `${publicApiUrl}/payments/tbank/webhook`;
  }

  private returnUrl(
    result: 'success' | 'fail',
    orderId: string,
    productKind: PaymentProductKindValue,
  ) {
    const scheme = process.env.APP_DEEP_LINK_SCHEME?.trim() || 'frendly';
    const params = new URLSearchParams({
      orderId,
      productKind,
    });
    return `${scheme}://payment/${result}?${params.toString()}`;
  }

  private receiptPayload(
    product: PaymentProduct,
    buyer: { email: string | null; phoneNumber: string | null },
  ) {
    if (process.env.TBANK_RECEIPT_ENABLED !== 'true') {
      return {};
    }
    const contact = buyer.email
      ? { Email: buyer.email }
      : buyer.phoneNumber
        ? { Phone: buyer.phoneNumber }
        : null;
    if (!contact) {
      return {};
    }
    const itemName = product.kind === 'subscription' ? 'Frendly+' : 'Frendly Tokens';
    return {
      Receipt: {
        ...contact,
        Taxation: process.env.TBANK_RECEIPT_TAXATION ?? 'usn_income',
        Items: [
          {
            Name: itemName,
            Price: product.amountKopecks,
            Quantity: 1,
            Amount: product.amountKopecks,
            Tax: process.env.TBANK_RECEIPT_TAX ?? 'none',
            PaymentObject: 'service',
            PaymentMethod: 'full_payment',
          },
        ],
      },
    };
  }
}
