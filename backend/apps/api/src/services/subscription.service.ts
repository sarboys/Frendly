import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { DropsRewardService } from './drops-reward.service';
import {
  defaultPlusBenefits,
  subscriptionProducts,
  type SubscriptionProduct,
} from './payment-catalog';
import { PrismaService } from './prisma.service';
import { TokensService } from './tokens.service';

type CurrentSubscription = {
  id?: string;
  plan: string;
  status: 'inactive' | 'trial' | 'active' | 'canceled';
  startedAt: Date | null;
  renewsAt: Date | null;
  trialEndsAt: Date | null;
} | null;

const SETTINGS_ID = 'frendly_plus';
const DAY_MS = 24 * 60 * 60 * 1000;

type SubscriptionCatalogPlanInput = {
  id: string;
  label: string;
  description: string;
  priceRub: number;
  priceMonthlyRub: number;
  tokenCost: number;
  tokenMonthlyCost: number;
  trialDays: number;
  durationDays: number;
  badge?: string | null;
  benefits: string[];
  active: boolean;
  sortOrder: number;
};

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly tokensService: TokensService,
    private readonly dropsRewardService?: DropsRewardService,
  ) {}

  async getPlans() {
    return this.getCatalog();
  }

  async getCatalog(client: Prisma.TransactionClient = this.prismaService.client) {
    const [plans, settings] = await Promise.all([
      this.loadCatalogProducts(client, false),
      this.loadCatalogSettings(client),
    ]);

    return {
      plans: plans.map((product) => ({
        id: product.id,
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
      plusBenefits: settings.benefits,
    };
  }

  async getAdminCatalog(client: Prisma.TransactionClient = this.prismaService.client) {
    const [plans, settings] = await Promise.all([
      this.loadCatalogProducts(client, true),
      this.loadCatalogSettings(client),
    ]);

    return {
      plans: plans.map((product, index) => ({
        id: product.id,
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
        active: product.active ?? true,
        sortOrder: product.sortOrder ?? (index + 1) * 10,
      })),
      plusBenefits: settings.benefits,
    };
  }

  async updateAdminCatalog(body: Record<string, unknown>) {
    const plans = this.parseCatalogPlans(body.plans);
    const plusBenefits = this.parseTextList(body.plusBenefits);

    return this.prismaService.client.$transaction(async (client) => {
      const existing = await client.subscriptionCatalogPlan.findMany({
        select: { id: true },
      });
      const nextIds = new Set(plans.map((plan) => plan.id));

      for (const plan of plans) {
        await client.subscriptionCatalogPlan.upsert({
          where: { id: plan.id },
          update: plan,
          create: plan,
        });
      }

      const removedIds = existing
        .map((plan) => plan.id)
        .filter((id) => !nextIds.has(id));
      if (removedIds.length > 0) {
        await client.subscriptionCatalogPlan.updateMany({
          where: { id: { in: removedIds } },
          data: { active: false },
        });
      }

      await client.subscriptionCatalogSettings.upsert({
        where: { id: SETTINGS_ID },
        update: { benefits: plusBenefits },
        create: { id: SETTINGS_ID, benefits: plusBenefits },
      });

      return this.getAdminCatalog(client);
    });
  }

  async getCurrent(userId: string) {
    const subscription = await this.prismaService.client.userSubscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        plan: true,
        status: true,
        startedAt: true,
        renewsAt: true,
        trialEndsAt: true,
      },
    });
    return this.mapCurrent(subscription);
  }

  private mapCurrent(subscription: CurrentSubscription) {
    const status = this.resolveStatus(subscription);

    return {
      plan: subscription?.plan ?? null,
      status,
      startedAt: subscription?.startedAt?.toISOString() ?? null,
      renewsAt: subscription?.renewsAt?.toISOString() ?? null,
      trialEndsAt: subscription?.trialEndsAt?.toISOString() ?? null,
    };
  }

  async subscribe(userId: string, body: Record<string, unknown>) {
    const plan = typeof body.plan === 'string' ? body.plan : '';
    const product = await this.findCatalogProduct(plan);

    const current = await this.prismaService.client.userSubscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const currentStatus = this.resolveStatus(current);

    if (
      current &&
      current.plan === plan &&
      (currentStatus === 'trial' || currentStatus === 'active')
    ) {
      return this.mapCurrent(current);
    }

    const now = new Date();
    const isTrial = product.id === 'year';
    const subscription = await this.prismaService.client.userSubscription.create({
      data: {
        userId,
        plan: product.id,
        status: isTrial ? 'trial' : 'active',
        startedAt: now,
        renewsAt: new Date(now.getTime() + product.durationDays * DAY_MS),
        trialEndsAt: isTrial
          ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          : null,
      },
      select: {
        plan: true,
        status: true,
        startedAt: true,
        renewsAt: true,
        trialEndsAt: true,
      },
    });

    return this.mapCurrent(subscription);
  }

  async subscribeWithTokens(userId: string, body: Record<string, unknown>) {
    const plan = typeof body.plan === 'string' ? body.plan : '';
    const product = await this.findCatalogProduct(plan);

    return this.prismaService.client.$transaction(async (client) => {
      const ledgerEntry = await this.tokensService.spendTokens(
        userId,
        {
          amount: product.tokenCost,
          reason: 'subscription_spend',
        },
        client,
      );

      const subscription = await this.activatePaidSubscription(
        userId,
        product.id,
        null,
        client,
      );
      await this.grantDropsSubscriptionReward(userId, ledgerEntry.id, client);

      return this.mapCurrent(subscription);
    });
  }

  async activatePaidSubscription(
    userId: string,
    plan: string,
    paymentOrderId: string | null,
    client: Prisma.TransactionClient = this.prismaService.client,
  ) {
    const product = await this.findCatalogProduct(plan, client);
    const now = new Date(Date.now());
    const current = await client.userSubscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const currentStatus = this.resolveStatus(current);
    const baseTime =
      current?.renewsAt != null && current.renewsAt.getTime() > now.getTime()
        ? current.renewsAt.getTime()
        : now.getTime();
    const renewsAt = new Date(baseTime + product.durationDays * DAY_MS);

    const subscription = current && (currentStatus === 'trial' || currentStatus === 'active')
      ? await client.userSubscription.update({
        where: { id: current.id },
        data: {
          plan: product.id,
          status: 'active',
          renewsAt,
          trialEndsAt: null,
        },
      })
      : await client.userSubscription.create({
        data: {
          userId,
          plan: product.id,
          status: 'active',
          startedAt: now,
          renewsAt,
          trialEndsAt: null,
        },
      });

    if (paymentOrderId != null) {
      await this.grantDropsSubscriptionReward(userId, paymentOrderId, client);
    }

    return subscription;
  }

  private async grantDropsSubscriptionReward(
    userId: string,
    sourceId: string,
    client: Prisma.TransactionClient,
  ) {
    if (!this.dropsRewardService) {
      return;
    }

    try {
      await this.dropsRewardService.grantSubscriptionReward(
        userId,
        sourceId,
        new Date(Date.now()),
        client,
      );
    } catch {
      // Drops rewards must not block subscription activation.
    }
  }

  async restore(userId: string) {
    return this.getCurrent(userId);
  }

  private async findCatalogProduct(
    plan: string,
    client: Prisma.TransactionClient = this.prismaService.client,
  ) {
    const products = await this.loadCatalogProducts(client, false);
    const product = products.find((item) => item.id === plan);
    if (!product) {
      throw new ApiError(400, 'invalid_subscription_plan', 'Subscription plan is invalid');
    }
    return product;
  }

  private async loadCatalogProducts(
    client: Prisma.TransactionClient,
    includeInactive: boolean,
  ): Promise<Array<SubscriptionProduct & { active?: boolean; sortOrder?: number }>> {
    const delegate = (client as any).subscriptionCatalogPlan;
    if (!delegate?.findMany) {
      return this.defaultCatalogProducts();
    }

    const rows = await delegate.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    if (rows.length === 0) {
      return this.defaultCatalogProducts();
    }

    return rows.map((row: any) => ({
      kind: 'subscription' as const,
      id: row.id,
      label: row.label,
      description: row.description ?? '',
      amountKopecks: Number(row.priceRub ?? 0) * 100,
      priceRub: Number(row.priceRub ?? 0),
      priceMonthlyRub: Number(row.priceMonthlyRub ?? 0),
      tokenCost: Number(row.tokenCost ?? 0),
      tokenMonthlyCost: Number(row.tokenMonthlyCost ?? 0),
      trialDays: Number(row.trialDays ?? 0),
      durationDays: Number(row.durationDays ?? 0),
      badge: row.badge ?? null,
      benefits: Array.isArray(row.benefits) ? row.benefits : [],
      active: row.active !== false,
      sortOrder: Number(row.sortOrder ?? 0),
    }));
  }

  private async loadCatalogSettings(client: Prisma.TransactionClient) {
    const delegate = (client as any).subscriptionCatalogSettings;
    if (!delegate?.findUnique) {
      return { benefits: defaultPlusBenefits };
    }

    const settings = await delegate.findUnique({
      where: { id: SETTINGS_ID },
    });
    return {
      benefits: this.cleanTextList(settings?.benefits ?? defaultPlusBenefits),
    };
  }

  private defaultCatalogProducts() {
    return subscriptionProducts.map((product, index) => ({
      ...product,
      active: true,
      sortOrder: (index + 1) * 10,
    }));
  }

  private parseCatalogPlans(value: unknown): SubscriptionCatalogPlanInput[] {
    if (!Array.isArray(value)) {
      throw new ApiError(400, 'invalid_subscription_catalog', 'Subscription plans are invalid');
    }

    const ids = new Set<string>();
    const plans = value.map((item, index) => {
      const raw = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      const id = this.requiredText(raw.id, 'invalid_subscription_plan_id');
      if (!/^[a-z0-9][a-z0-9_-]{1,40}$/.test(id)) {
        throw new ApiError(400, 'invalid_subscription_plan_id', 'Subscription plan id is invalid');
      }
      if (ids.has(id)) {
        throw new ApiError(400, 'duplicate_subscription_plan_id', 'Subscription plan id is duplicated');
      }
      ids.add(id);

      return {
        id,
        label: this.requiredText(raw.label, 'invalid_subscription_plan_label'),
        description: this.optionalText(raw.description),
        priceRub: this.positiveInt(raw.priceRub, 'invalid_subscription_plan_price'),
        priceMonthlyRub: this.positiveInt(raw.priceMonthlyRub, 'invalid_subscription_plan_monthly_price'),
        tokenCost: this.positiveInt(raw.tokenCost, 'invalid_subscription_plan_token_cost'),
        tokenMonthlyCost: this.positiveInt(raw.tokenMonthlyCost, 'invalid_subscription_plan_monthly_token_cost'),
        trialDays: this.nonNegativeInt(raw.trialDays, 'invalid_subscription_plan_trial_days'),
        durationDays: this.positiveInt(raw.durationDays, 'invalid_subscription_plan_duration'),
        badge: this.optionalText(raw.badge) || null,
        benefits: this.parseTextList(raw.benefits),
        active: raw.active !== false,
        sortOrder: this.nonNegativeInt(raw.sortOrder ?? index * 10, 'invalid_subscription_plan_sort_order'),
      };
    });

    if (!plans.some((plan) => plan.active)) {
      throw new ApiError(400, 'subscription_catalog_empty', 'At least one subscription plan must be active');
    }

    return plans;
  }

  private parseTextList(value: unknown) {
    if (Array.isArray(value)) {
      return this.cleanTextList(value);
    }
    if (typeof value === 'string') {
      return this.cleanTextList(value.split('\n'));
    }
    return [];
  }

  private cleanTextList(value: unknown[]) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item, index, items) => item.length > 0 && items.indexOf(item) === index)
      .slice(0, 12);
  }

  private requiredText(value: unknown, code: string) {
    const text = this.optionalText(value);
    if (!text) {
      throw new ApiError(400, code, 'Subscription catalog field is invalid');
    }
    return text;
  }

  private optionalText(value: unknown) {
    return typeof value === 'string' ? value.trim().slice(0, 160) : '';
  }

  private positiveInt(value: unknown, code: string) {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0 || number > 10_000_000) {
      throw new ApiError(400, code, 'Subscription catalog number is invalid');
    }
    return number;
  }

  private nonNegativeInt(value: unknown, code: string) {
    const number = Number(value ?? 0);
    if (!Number.isInteger(number) || number < 0 || number > 10_000_000) {
      throw new ApiError(400, code, 'Subscription catalog number is invalid');
    }
    return number;
  }

  async hasPremiumAccess(userId: string) {
    const current = await this.getCurrent(userId);
    return this.isPremiumStatus(current.status);
  }

  isPremiumStatus(status: string | null | undefined) {
    return status === 'trial' || status === 'active';
  }

  private resolveStatus(
    subscription:
      | {
          status: 'inactive' | 'trial' | 'active' | 'canceled';
          renewsAt: Date | null;
          trialEndsAt: Date | null;
        }
      | null,
  ): 'inactive' | 'trial' | 'active' | 'canceled' {
    if (!subscription) {
      return 'inactive';
    }

    const now = Date.now();
    const renewsAt = subscription.renewsAt?.getTime() ?? null;
    const trialEndsAt = subscription.trialEndsAt?.getTime() ?? null;

    if (trialEndsAt != null && trialEndsAt > now) {
      return 'trial';
    }

    if (renewsAt != null && renewsAt > now) {
      return subscription.status === 'canceled' ? 'active' : subscription.status;
    }

    if (subscription.status === 'inactive') {
      return 'inactive';
    }

    return 'inactive';
  }
}
