import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { findSubscriptionProduct, subscriptionProducts } from './payment-catalog';
import { PrismaService } from './prisma.service';

type CurrentSubscription = {
  id?: string;
  plan: string;
  status: 'inactive' | 'trial' | 'active' | 'canceled';
  startedAt: Date | null;
  renewsAt: Date | null;
  trialEndsAt: Date | null;
} | null;

@Injectable()
export class SubscriptionService {
  constructor(private readonly prismaService: PrismaService) {}

  getPlans() {
    return {
      plans: subscriptionProducts.map((product) => ({
        id: product.id,
        label: product.label,
        priceRub: product.priceRub,
        priceMonthlyRub: product.priceMonthlyRub,
        trialDays: product.trialDays,
        badge: product.badge,
      })),
    };
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

    if (plan !== 'month' && plan !== 'year') {
      throw new ApiError(400, 'invalid_subscription_plan', 'Subscription plan is invalid');
    }

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

    const product = findSubscriptionProduct(plan);
    const now = new Date();
    const isTrial = product.id === 'year';
    const subscription = await this.prismaService.client.userSubscription.create({
      data: {
        userId,
        plan: product.id,
        status: isTrial ? 'trial' : 'active',
        startedAt: now,
        renewsAt: new Date(now.getTime() + product.durationDays * 24 * 60 * 60 * 1000),
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

  async activatePaidSubscription(
    userId: string,
    plan: string,
    _paymentOrderId: string,
    client: Prisma.TransactionClient = this.prismaService.client,
  ) {
    const product = findSubscriptionProduct(plan);
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
    const renewsAt = new Date(baseTime + product.durationDays * 24 * 60 * 60 * 1000);

    if (current && (currentStatus === 'trial' || currentStatus === 'active')) {
      return client.userSubscription.update({
        where: { id: current.id },
        data: {
          plan: product.id,
          status: 'active',
          renewsAt,
          trialEndsAt: null,
        },
      });
    }

    return client.userSubscription.create({
      data: {
        userId,
        plan: product.id,
        status: 'active',
        startedAt: now,
        renewsAt,
        trialEndsAt: null,
      },
    });
  }

  async restore(userId: string) {
    return this.getCurrent(userId);
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
