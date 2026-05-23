import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

const SNAPSHOT_ID = 'main';
const SNAPSHOT_TTL_MS = 5 * 60 * 1000;
const ACTIVITY_LIMIT = 10;
const CARD_LIMIT = 5;

type Clock = () => Date;

type DashboardMetric = {
  value: number;
  delta: number;
  series: number[];
};

type DashboardStats = {
  users: DashboardMetric;
  active7d: DashboardMetric;
  meetups7d: DashboardMetric;
  revenue30d: DashboardMetric;
  openReports: DashboardMetric;
  plusConversion: DashboardMetric;
};

type DashboardSnapshotPayload = {
  stats: DashboardStats;
  computedAt: string;
  expiresAt: string;
};

type DashboardActivity = {
  id: string;
  type: string;
  title: string;
  description: string;
  createdAt: string;
  href: string | null;
};

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async getDashboard() {
    const [snapshot, upcomingMeetups, newUsers, recentActivity] = await Promise.all([
      this.getSnapshot(),
      this.listUpcomingMeetups(),
      this.listNewUsers(),
      this.listRecentActivity(),
    ]);

    return {
      stats: snapshot.stats,
      computedAt: snapshot.computedAt,
      expiresAt: snapshot.expiresAt,
      recentActivity,
      upcomingMeetups,
      newUsers,
    };
  }

  private async getSnapshot(): Promise<DashboardSnapshotPayload> {
    const now = this.clock();
    const snapshot = await this.prismaService.client.adminDashboardSnapshot.findUnique({
      where: { id: SNAPSHOT_ID },
      select: {
        payload: true,
        expiresAt: true,
      },
    });

    if (snapshot && snapshot.expiresAt.getTime() > now.getTime()) {
      return snapshot.payload as DashboardSnapshotPayload;
    }

    const payload = await this.buildSnapshotPayload(now);
    await this.prismaService.client.adminDashboardSnapshot.upsert({
      where: { id: SNAPSHOT_ID },
      update: {
        payload: payload as unknown as Prisma.InputJsonValue,
        computedAt: new Date(payload.computedAt),
        expiresAt: new Date(payload.expiresAt),
      },
      create: {
        id: SNAPSHOT_ID,
        payload: payload as unknown as Prisma.InputJsonValue,
        computedAt: new Date(payload.computedAt),
        expiresAt: new Date(payload.expiresAt),
      },
    });

    return payload;
  }

  private async buildSnapshotPayload(now: Date): Promise<DashboardSnapshotPayload> {
    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const activeSubscriptionWhere = this.activeSubscriptionWhere(now);

    const [
      totalUsers,
      activeSessions,
      meetups7d,
      revenue30d,
      openReports,
      plusUsers,
    ] = await Promise.all([
      this.prismaService.client.user.count(),
      this.prismaService.client.session.findMany({
        where: {
          OR: [
            { lastUsedAt: { gte: since7d } },
            { createdAt: { gte: since7d } },
          ],
          user: { status: 'active' },
        },
        select: { userId: true },
      }),
      this.prismaService.client.event.count({
        where: { createdAt: { gte: since7d } },
      }),
      this.prismaService.client.paymentOrder.aggregate({
        where: {
          status: 'confirmed',
          confirmedAt: { gte: since30d },
        },
        _sum: { amountKopecks: true },
      }),
      this.prismaService.client.userReport.count({
        where: { status: 'open' },
      }),
      this.prismaService.client.user.count({
        where: activeSubscriptionWhere,
      }),
    ]);

    const activeUserCount = new Set(activeSessions.map((session) => session.userId)).size;
    const revenueRub = Math.round((revenue30d._sum.amountKopecks ?? 0) / 100);
    const conversion = totalUsers > 0 ? Math.round((plusUsers / totalUsers) * 1000) / 10 : 0;

    const stats = {
      users: this.metric(totalUsers),
      active7d: this.metric(activeUserCount),
      meetups7d: this.metric(meetups7d),
      revenue30d: this.metric(revenueRub),
      openReports: this.metric(openReports),
      plusConversion: this.metric(conversion),
    };

    return {
      stats,
      computedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SNAPSHOT_TTL_MS).toISOString(),
    };
  }

  private async listUpcomingMeetups() {
    const rows = await this.prismaService.client.event.findMany({
      where: {
        startsAt: { gte: this.clock() },
        canceledAt: null,
      },
      select: {
        id: true,
        title: true,
        place: true,
        startsAt: true,
        capacity: true,
        canceledAt: true,
        host: {
          select: { displayName: true },
        },
        liveState: {
          select: { status: true },
        },
        _count: {
          select: { participants: true },
        },
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: CARD_LIMIT,
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      hostName: row.host.displayName,
      place: row.place,
      startsAt: row.startsAt.toISOString(),
      participantsCount: row._count.participants,
      capacity: row.capacity,
      status: this.mapMeetupStatus(row),
      href: `/meetups/${row.id}`,
    }));
  }

  private async listNewUsers() {
    const rows = await this.prismaService.client.user.findMany({
      select: {
        id: true,
        displayName: true,
        email: true,
        phoneNumber: true,
        status: true,
        verified: true,
        createdAt: true,
        updatedAt: true,
        profile: { select: { city: true } },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            status: true,
            renewsAt: true,
            trialEndsAt: true,
          },
        },
        _count: {
          select: {
            hostedEvents: true,
            eventParticipants: true,
            reportsReceived: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: CARD_LIMIT,
    });

    return rows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      email: row.email,
      phoneNumber: row.phoneNumber,
      city: row.profile?.city ?? null,
      status: row.status,
      verified: row.verified,
      plan: this.hasActiveSubscription(row.subscriptions[0] ?? null) ? 'plus' : 'free',
      hostedMeetupsCount: row._count.hostedEvents,
      joinedMeetupsCount: row._count.eventParticipants,
      reportsCount: row._count.reportsReceived,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      href: `/users/${row.id}`,
    }));
  }

  private async listRecentActivity() {
    const [
      users,
      suspendedUsers,
      events,
      reports,
      payments,
      verifications,
    ] = await Promise.all([
      this.prismaService.client.user.findMany({
        select: { id: true, displayName: true, createdAt: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: ACTIVITY_LIMIT,
      }),
      this.prismaService.client.user.findMany({
        where: { suspendedAt: { not: null } },
        select: { id: true, displayName: true, suspendedAt: true },
        orderBy: [{ suspendedAt: 'desc' }, { id: 'desc' }],
        take: ACTIVITY_LIMIT,
      }),
      this.prismaService.client.event.findMany({
        select: { id: true, title: true, createdAt: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: ACTIVITY_LIMIT,
      }),
      this.prismaService.client.userReport.findMany({
        select: {
          id: true,
          reason: true,
          createdAt: true,
          targetUser: { select: { id: true, displayName: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: ACTIVITY_LIMIT,
      }),
      this.prismaService.client.paymentOrder.findMany({
        where: { status: 'confirmed', confirmedAt: { not: null } },
        select: {
          id: true,
          amountKopecks: true,
          confirmedAt: true,
          user: { select: { id: true, displayName: true } },
        },
        orderBy: [{ confirmedAt: 'desc' }, { id: 'desc' }],
        take: ACTIVITY_LIMIT,
      }),
      this.prismaService.client.userVerification.findMany({
        where: { status: 'verified', reviewedAt: { not: null } },
        select: {
          userId: true,
          reviewedAt: true,
          user: { select: { displayName: true } },
        },
        orderBy: [{ reviewedAt: 'desc' }, { userId: 'desc' }],
        take: ACTIVITY_LIMIT,
      }),
    ]);

    const activity: DashboardActivity[] = [
      ...users.map((user) => this.activity(
        `user_registered:${user.id}`,
        'user_registered',
        `Регистрация: ${user.displayName}`,
        'Новый пользователь',
        user.createdAt,
        `/users/${user.id}`,
      )),
      ...suspendedUsers.flatMap((user) => user.suspendedAt
        ? [this.activity(
            `user_suspended:${user.id}`,
            'user_suspended',
            `Пользователь заблокирован: ${user.displayName}`,
            'Доступ в приложение закрыт',
            user.suspendedAt,
            `/users/${user.id}`,
          )]
        : []),
      ...events.map((event) => this.activity(
        `meetup_created:${event.id}`,
        'meetup_created',
        `Создана встреча: ${event.title}`,
        'Новая встреча в приложении',
        event.createdAt,
        `/meetups/${event.id}`,
      )),
      ...reports.map((report) => this.activity(
        `report_created:${report.id}`,
        'report_created',
        `Новая жалоба на ${report.targetUser.displayName}`,
        report.reason,
        report.createdAt,
        `/reports/${report.id}`,
      )),
      ...payments.flatMap((payment) => payment.confirmedAt
        ? [this.activity(
            `payment_confirmed:${payment.id}`,
            'payment_confirmed',
            `Оплата от ${payment.user.displayName}`,
            `${Math.round(payment.amountKopecks / 100).toLocaleString('ru-RU')} ₽`,
            payment.confirmedAt,
            '/payments',
          )]
        : []),
      ...verifications.flatMap((verification) => verification.reviewedAt
        ? [this.activity(
            `verification_approved:${verification.userId}`,
            'verification_approved',
            `Верифицирован: ${verification.user.displayName}`,
            'Пользователь получил галочку',
            verification.reviewedAt,
            `/users/${verification.userId}`,
          )]
        : []),
    ];

    return activity
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, ACTIVITY_LIMIT);
  }

  private activeSubscriptionWhere(now: Date): Prisma.UserWhereInput {
    return {
      subscriptions: {
        some: {
          status: { in: ['active', 'trial', 'canceled'] },
          OR: [
            { renewsAt: { gt: now } },
            { trialEndsAt: { gt: now } },
          ],
        },
      },
    };
  }

  private hasActiveSubscription(subscription: {
    status: string;
    renewsAt: Date | null;
    trialEndsAt: Date | null;
  } | null) {
    if (!subscription) {
      return false;
    }
    const now = this.clock().getTime();
    if (subscription.trialEndsAt && subscription.trialEndsAt.getTime() > now) {
      return true;
    }
    return Boolean(
      subscription.renewsAt &&
      subscription.renewsAt.getTime() > now &&
      subscription.status !== 'inactive',
    );
  }

  private metric(value: number): DashboardMetric {
    return { value, delta: 0, series: [value] };
  }

  private activity(
    id: string,
    type: string,
    title: string,
    description: string,
    createdAt: Date,
    href: string | null,
  ): DashboardActivity {
    return {
      id,
      type,
      title,
      description,
      createdAt: createdAt.toISOString(),
      href,
    };
  }

  private mapMeetupStatus(row: {
    startsAt: Date;
    canceledAt: Date | null;
    liveState: { status: string } | null;
  }) {
    if (row.canceledAt) {
      return 'cancelled';
    }
    if (row.liveState?.status === 'live') {
      return 'live';
    }
    return row.startsAt.getTime() < this.clock().getTime() ? 'past' : 'upcoming';
  }
}
