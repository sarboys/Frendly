import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

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
    });
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

    const now = new Date();
    const renewsAt = new Date(now);
    renewsAt.setMonth(renewsAt.getMonth() + (plan == 'month' ? 1 : 12));
    const trialEndsAt = plan == 'year' ? new Date(now.getTime() + 7 * 86400000) : null;

    const subscription = await this.prismaService.client.$transaction(async (tx) => {
      await tx.userSubscription.updateMany({
        where: {
          userId,
          status: {
            in: ['trial', 'active'],
          },
        },
        data: {
          status: 'canceled',
        },
      });

      return tx.userSubscription.create({
        data: {
          userId,
          plan,
          status: plan == 'year' ? 'trial' : 'active',
          startedAt: now,
          renewsAt,
          trialEndsAt,
        },
      });
    });

    return {
      plan: subscription.plan,
      status: this.resolveStatus(subscription),
      renewsAt: subscription.renewsAt?.toISOString() ?? null,
      trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
    };
  }

  async restore(userId: string) {
    const subscription = await this.prismaService.client.userSubscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return {
        restored: false,
      };
    }

    const nextStatus = this.resolveStatus(subscription);

    if (nextStatus === 'inactive') {
      return {
        restored: false,
      };
    }

    const restored = await this.prismaService.client.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: nextStatus,
      },
    });

    return {
      restored: true,
      plan: restored.plan,
      status: restored.status,
    };
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
