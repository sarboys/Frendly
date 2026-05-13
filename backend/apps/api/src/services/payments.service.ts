import { Injectable } from '@nestjs/common';
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
import {
  type PaymentProduct,
  type PaymentProductKindValue,
  findPaymentProduct,
  subscriptionProducts,
  tokenPackProducts,
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
  constructor(
    private readonly prismaService: PrismaService,
    private readonly tbank: TbankAcquiringService,
    private readonly subscriptionService: SubscriptionService,
    private readonly tokensService: TokensService,
  ) {}

  getCatalog() {
    const tbankEnabled = this.tbank.isEnabled();
    return {
      tbankEnabled,
      provider: tbankEnabled ? 'tbank' : null,
      subscriptions: subscriptionProducts.map((product) => ({
        id: product.id,
        productKind: product.kind,
        label: product.label,
        priceRub: product.priceRub,
        priceMonthlyRub: product.priceMonthlyRub,
        trialDays: product.trialDays,
        badge: product.badge,
      })),
      tokenPacks: tokenPackProducts.map((product) => ({
        id: product.id,
        productKind: product.kind,
        label: product.label,
        tokens: product.tokens,
        bonus: product.bonus,
        priceRub: product.priceRub,
        best: product.best,
      })),
      promoOptions: tokenPromotionOptions,
    };
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
    const product = findPaymentProduct(productKind, productId);
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
        await this.tokensService.creditPurchasedTokens(
          order.userId,
          order.productId,
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
