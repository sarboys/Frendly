import { Injectable } from '@nestjs/common';
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

    return {
      plan: subscription?.plan ?? null,
      status: subscription?.status ?? 'inactive',
      startedAt: subscription?.startedAt?.toISOString() ?? null,
      renewsAt: subscription?.renewsAt?.toISOString() ?? null,
      trialEndsAt: subscription?.trialEndsAt?.toISOString() ?? null,
    };
  }

  async subscribe(userId: string, body: Record<string, unknown>) {
    const plan = body.plan === 'month' ? 'month' : 'year';
    const now = new Date();
    const renewsAt = new Date(now);
    renewsAt.setMonth(renewsAt.getMonth() + (plan == 'month' ? 1 : 12));
    const trialEndsAt = plan == 'year' ? new Date(now.getTime() + 7 * 86400000) : null;

    const subscription = await this.prismaService.client.userSubscription.create({
      data: {
        userId,
        plan,
        status: plan == 'year' ? 'trial' : 'active',
        startedAt: now,
        renewsAt,
        trialEndsAt,
      },
    });

    return {
      plan: subscription.plan,
      status: subscription.status,
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

    return {
      restored: true,
      plan: subscription.plan,
      status: subscription.status,
    };
  }
}
