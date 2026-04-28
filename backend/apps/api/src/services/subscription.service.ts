import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

type CurrentSubscription = {
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
      plans: [
        {
          id: 'year',
          label: 'Годовой',
          priceRub: 4788,
          priceMonthlyRub: 399,
          trialDays: 7,
          badge: '-50%',
        },
        {
          id: 'month',
          label: 'Месячный',
          priceRub: 799,
          priceMonthlyRub: 799,
          trialDays: 0,
          badge: null,
        },
      ],
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

    const now = new Date();
    const isYear = plan === 'year';
    const subscription = await this.prismaService.client.userSubscription.create({
      data: {
        userId,
        plan,
        status: isYear ? 'trial' : 'active',
        startedAt: now,
        renewsAt: new Date(
          now.getTime() + (isYear ? 365 : 30) * 24 * 60 * 60 * 1000,
        ),
        trialEndsAt: isYear
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
