import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

type PrismaLike = Prisma.TransactionClient & {
  $transaction?: <T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ) => Promise<T>;
};

type RewardSource =
  | 'verification'
  | 'daily_login'
  | 'host_meeting'
  | 'visit_meeting'
  | 'referral'
  | 'subscription'
  | 'boost'
  | 'manual_admin';

type RewardStatus = 'pending' | 'active' | 'cancelled' | 'rejected';

const DROPS_TIME_ZONE = 'Europe/Moscow';
const MOSCOW_UTC_OFFSET_HOURS = 3;
const MAX_TICKETS_PER_MONTH = 30;
const TASK_LIMITS: Partial<Record<RewardSource, number>> = {
  daily_login: 7,
  host_meeting: 5,
  visit_meeting: 10,
  boost: 5,
};

const TICKET_COUNT_BY_SOURCE: Record<RewardSource, number> = {
  verification: 3,
  daily_login: 1,
  host_meeting: 1,
  visit_meeting: 2,
  referral: 3,
  subscription: 5,
  boost: 1,
  manual_admin: 1,
};

const TITLE_BY_SOURCE: Record<RewardSource, string> = {
  verification: 'Верификация профиля',
  daily_login: 'Ежедневный вход',
  host_meeting: 'Проведена встреча',
  visit_meeting: 'Посещение встречи',
  referral: 'Приглашенный друг',
  subscription: 'Frendly+',
  boost: 'Продвижение встречи',
  manual_admin: 'Ручное начисление',
};

@Injectable()
export class DropsRewardService {
  constructor(private readonly prismaService: PrismaService) {}

  async claimDailyLogin(userId: string, now = new Date(Date.now())) {
    const localDate = this.localDateKey(now);
    return this.grantReward({
      userId,
      source: 'daily_login',
      idempotencyKey: `daily_login:${userId}:${localDate}`,
      ticketCount: TICKET_COUNT_BY_SOURCE.daily_login,
      title: TITLE_BY_SOURCE.daily_login,
      status: 'active',
      taskMonthlyLimit: TASK_LIMITS.daily_login,
      now,
    });
  }

  async claimVerification(userId: string, now = new Date(Date.now())) {
    const user = await this.prismaService.client.user.findUnique({
      where: { id: userId },
      select: { verified: true },
    });
    if (!user?.verified) {
      throw new ApiError(409, 'drops_verification_required', 'Verification is required');
    }

    return this.grantReward({
      userId,
      source: 'verification',
      idempotencyKey: `verification:${userId}`,
      ticketCount: TICKET_COUNT_BY_SOURCE.verification,
      title: TITLE_BY_SOURCE.verification,
      status: 'active',
      now,
    });
  }

  async handleUserVerified(userId: string, now = new Date(Date.now())) {
    const client = this.prismaService.client;
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { verified: true },
    });
    if (!user?.verified) {
      return { verification: null, referralCount: 0 };
    }

    let verification: Awaited<ReturnType<DropsRewardService['grantReward']>> | null = null;
    try {
      verification = await this.grantReward({
        userId,
        source: 'verification',
        idempotencyKey: `verification:${userId}`,
        ticketCount: TICKET_COUNT_BY_SOURCE.verification,
        title: TITLE_BY_SOURCE.verification,
        status: 'active',
        now,
        client,
      });
    } catch {
      verification = null;
    }

    const referrals = await client.dropReferral.findMany({
      where: {
        invitedUserId: userId,
        status: {
          not: 'rewarded',
        },
      },
      select: {
        inviterUserId: true,
        invitedUserId: true,
      },
    });

    let referralCount = 0;
    for (const referral of referrals) {
      if (!referral.invitedUserId) {
        continue;
      }
      try {
        await this.grantReferralReward(
          referral.inviterUserId,
          referral.invitedUserId,
          now,
          client,
        );
        referralCount += 1;
      } catch {
        // One blocked referral must not prevent other verified-user rewards.
      }
    }

    return { verification, referralCount };
  }

  async grantSubscriptionReward(
    userId: string,
    sourceId: string,
    now = new Date(Date.now()),
    client: PrismaLike = this.prismaService.client,
  ) {
    return this.grantReward({
      userId,
      source: 'subscription',
      idempotencyKey: `subscription:${userId}:${sourceId}`,
      ticketCount: TICKET_COUNT_BY_SOURCE.subscription,
      title: TITLE_BY_SOURCE.subscription,
      status: 'active',
      relatedType: 'subscription',
      relatedId: sourceId,
      now,
      client,
    });
  }

  async grantBoostReward(
    userId: string,
    sourceId: string,
    eventId: string | null,
    now = new Date(Date.now()),
    client: PrismaLike = this.prismaService.client,
  ) {
    return this.grantReward({
      userId,
      source: 'boost',
      idempotencyKey: `boost:${userId}:${sourceId}`,
      ticketCount: TICKET_COUNT_BY_SOURCE.boost,
      title: TITLE_BY_SOURCE.boost,
      status: 'active',
      taskMonthlyLimit: TASK_LIMITS.boost,
      relatedType: 'token_promotion',
      relatedId: sourceId,
      eventId,
      now,
      client,
    });
  }

  async grantReferralReward(
    inviterUserId: string,
    invitedUserId: string,
    now = new Date(Date.now()),
    client: PrismaLike = this.prismaService.client,
  ) {
    const result = await this.grantReward({
      userId: inviterUserId,
      source: 'referral',
      idempotencyKey: `referral:${inviterUserId}:${invitedUserId}`,
      ticketCount: TICKET_COUNT_BY_SOURCE.referral,
      title: TITLE_BY_SOURCE.referral,
      status: 'active',
      relatedType: 'user',
      relatedId: invitedUserId,
      now,
      client,
    });
    await client.dropReferral.updateMany({
      where: {
        inviterUserId,
        invitedUserId,
      },
      data: {
        status: 'rewarded',
        rewardEventId: result.id,
        verifiedAt: now,
      },
    });
    return result;
  }

  async evaluateMeetingRewards(
    eventId: string,
    now = new Date(Date.now()),
    client: PrismaLike = this.prismaService.client,
  ) {
    const event = await client.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        hostId: true,
        startsAt: true,
        createdAt: true,
        canceledAt: true,
        participants: {
          select: {
            userId: true,
            joinedAt: true,
          },
        },
        attendances: {
          where: { status: 'checked_in' },
          select: {
            userId: true,
          },
        },
      },
    });

    if (!event || event.canceledAt != null || event.startsAt.getTime() > now.getTime()) {
      return { granted: 0 };
    }

    const guestParticipants = event.participants.filter(
      (participant) => participant.userId !== event.hostId,
    );
    const checkedInGuestIds = new Set(
      event.attendances
        .filter((attendance) => attendance.userId !== event.hostId)
        .map((attendance) => attendance.userId),
    );

    let granted = 0;
    const createdAheadMs = event.startsAt.getTime() - event.createdAt.getTime();
    if (
      createdAheadMs >= 6 * 60 * 60 * 1000 &&
      guestParticipants.length >= 3 &&
      checkedInGuestIds.size >= 2
    ) {
      try {
        await this.grantReward({
          userId: event.hostId,
          source: 'host_meeting',
          idempotencyKey: `host_meeting:${event.hostId}:${event.id}`,
          ticketCount: TICKET_COUNT_BY_SOURCE.host_meeting,
          title: `Проведена встреча «${event.title}»`,
          status: 'active',
          taskMonthlyLimit: TASK_LIMITS.host_meeting,
          relatedType: 'event',
          relatedId: event.id,
          eventId: event.id,
          now,
          client,
        });
        granted += 1;
      } catch {
        // One blocked meeting reward must not stop rewards for other users.
      }
    }

    for (const participant of guestParticipants) {
      if (
        participant.joinedAt.getTime() >= event.startsAt.getTime() ||
        !checkedInGuestIds.has(participant.userId)
      ) {
        continue;
      }

      try {
        await this.grantReward({
          userId: participant.userId,
          source: 'visit_meeting',
          idempotencyKey: `visit_meeting:${participant.userId}:${event.id}`,
          ticketCount: TICKET_COUNT_BY_SOURCE.visit_meeting,
          title: `Посещение встречи «${event.title}»`,
          status: 'active',
          taskMonthlyLimit: TASK_LIMITS.visit_meeting,
          relatedType: 'event',
          relatedId: event.id,
          eventId: event.id,
          now,
          client,
        });
        granted += 1;
      } catch {
        // One blocked meeting reward must not stop rewards for other users.
      }
    }

    return { granted };
  }

  async grantManualTickets(
    userId: string,
    ticketCount: number,
    title: string,
    adminKey: string,
    now = new Date(Date.now()),
  ) {
    return this.grantReward({
      userId,
      source: 'manual_admin',
      idempotencyKey: `manual_admin:${userId}:${adminKey}`,
      ticketCount,
      title: title.trim() || TITLE_BY_SOURCE.manual_admin,
      status: 'active',
      now,
    });
  }

  async cancelTicketsForReward(
    rewardEventId: string,
    reason: string,
    client: PrismaLike = this.prismaService.client,
  ) {
    const now = new Date(Date.now());
    await client.dropRewardEvent.update({
      where: { id: rewardEventId },
      data: {
        status: 'cancelled',
        cancellationReason: reason,
      },
    });
    await client.dropTicket.updateMany({
      where: {
        rewardEventId,
        status: {
          in: ['pending', 'active'],
        },
      },
      data: {
        status: 'cancelled',
        cancelledAt: now,
        cancelReason: reason,
        dropId: null,
        assignedAt: null,
      },
    });
  }

  async getProgress(userId: string, now = new Date(Date.now())) {
    const month = this.monthBounds(now);
    const [confirmed, reserved, available] = await Promise.all([
      this.prismaService.client.dropTicket.count({
        where: {
          userId,
          monthKey: month.monthKey,
          status: { in: ['active', 'used_in_draw', 'winner'] },
        },
      }),
      this.prismaService.client.dropTicket.count({
        where: {
          userId,
          monthKey: month.monthKey,
          status: { in: ['pending', 'active', 'used_in_draw', 'winner'] },
        },
      }),
      this.prismaService.client.dropTicket.count({
        where: {
          userId,
          monthKey: month.monthKey,
          status: 'active',
          dropId: null,
        },
      }),
    ]);

    return {
      monthKey: month.monthKey,
      earned: confirmed,
      reserved,
      availableTickets: available,
      max: MAX_TICKETS_PER_MONTH,
      nextResetAt: month.nextResetAt.toISOString(),
    };
  }

  async grantReward(input: {
    userId: string;
    source: RewardSource;
    idempotencyKey: string;
    ticketCount: number;
    title: string;
    description?: string | null;
    status?: RewardStatus;
    taskMonthlyLimit?: number;
    relatedType?: string | null;
    relatedId?: string | null;
    eventId?: string | null;
    now?: Date;
    client?: PrismaLike;
  }) {
    const now = input.now ?? new Date(Date.now());
    const client = input.client ?? this.prismaService.client;
    const month = this.monthBounds(now);

    if (typeof client.$transaction === 'function') {
      const runTransaction = client.$transaction as <T>(
        callback: (tx: Prisma.TransactionClient) => Promise<T>,
      ) => Promise<T>;
      return runTransaction((tx) =>
        this.grantRewardInTransaction(tx as PrismaLike, input, month, now),
      );
    }

    return this.grantRewardInTransaction(client, input, month, now);
  }

  private async grantRewardInTransaction(
    tx: PrismaLike,
    input: {
      userId: string;
      source: RewardSource;
      idempotencyKey: string;
      ticketCount: number;
      title: string;
      description?: string | null;
      status?: RewardStatus;
      taskMonthlyLimit?: number;
      relatedType?: string | null;
      relatedId?: string | null;
      eventId?: string | null;
    },
    month: { monthKey: string },
    now: Date,
  ) {
    const existing = await tx.dropRewardEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: this.rewardSelect(),
    });
    if (existing) {
      return {
        ...this.mapReward(existing),
        alreadyClaimed: true,
      };
    }

    const status = input.status ?? 'active';
    const ticketCount = this.normalizeTicketCount(input.ticketCount);
    await this.assertMonthlyLimit(tx, {
      userId: input.userId,
      source: input.source,
      monthKey: month.monthKey,
      requested: ticketCount,
      taskMonthlyLimit: input.taskMonthlyLimit,
    });

    const reward = await tx.dropRewardEvent.create({
      data: {
        userId: input.userId,
        source: input.source,
        status,
        idempotencyKey: input.idempotencyKey,
        monthKey: month.monthKey,
        ticketCount,
        title: input.title,
        description: input.description ?? null,
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId ?? null,
        eventId: input.eventId ?? null,
        confirmedAt: status === 'active' ? now : null,
      },
      select: this.rewardSelect(),
    });

    await tx.dropTicket.createMany({
      data: Array.from({ length: ticketCount }, () => ({
        userId: input.userId,
        rewardEventId: reward.id,
        source: input.source,
        status: status === 'pending' ? 'pending' : 'active',
        monthKey: month.monthKey,
        code: this.createTicketCode(),
      })),
    });

    return {
      ...this.mapReward(reward),
      alreadyClaimed: false,
    };
  }

  private async assertMonthlyLimit(
    tx: PrismaLike,
    input: {
      userId: string;
      source: RewardSource;
      monthKey: string;
      requested: number;
      taskMonthlyLimit?: number;
    },
  ) {
    const monthlyCount = await tx.dropTicket.count({
      where: {
        userId: input.userId,
        monthKey: input.monthKey,
        status: { in: ['pending', 'active', 'used_in_draw', 'winner'] },
      },
    });
    if (monthlyCount + input.requested > MAX_TICKETS_PER_MONTH) {
      throw new ApiError(409, 'drops_monthly_limit_reached', 'Monthly Drops ticket limit reached');
    }

    if (input.taskMonthlyLimit == null) {
      return;
    }

    const sourceCount = await tx.dropRewardEvent.aggregate({
      where: {
        userId: input.userId,
        source: input.source,
        monthKey: input.monthKey,
        status: { in: ['pending', 'active'] },
      },
      _sum: { ticketCount: true },
    });
    const current = sourceCount._sum.ticketCount ?? 0;
    if (current + input.requested > input.taskMonthlyLimit) {
      throw new ApiError(409, 'drops_task_limit_reached', 'Drops task limit reached');
    }
  }

  monthBounds(now = new Date(Date.now())) {
    const shifted = new Date(now.getTime() + MOSCOW_UTC_OFFSET_HOURS * 60 * 60 * 1000);
    const year = shifted.getUTCFullYear();
    const monthIndex = shifted.getUTCMonth();
    const startAt = new Date(Date.UTC(year, monthIndex, 1, -MOSCOW_UTC_OFFSET_HOURS));
    const nextResetAt = new Date(Date.UTC(year, monthIndex + 1, 1, -MOSCOW_UTC_OFFSET_HOURS));
    return {
      monthKey: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
      startAt,
      nextResetAt,
      timeZone: DROPS_TIME_ZONE,
    };
  }

  localDateKey(now = new Date(Date.now())) {
    const shifted = new Date(now.getTime() + MOSCOW_UTC_OFFSET_HOURS * 60 * 60 * 1000);
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(
      shifted.getUTCDate(),
    ).padStart(2, '0')}`;
  }

  private normalizeTicketCount(value: number) {
    const parsed = Math.trunc(value);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_TICKETS_PER_MONTH) {
      throw new ApiError(400, 'invalid_drops_ticket_count', 'Ticket count is invalid');
    }
    return parsed;
  }

  private createTicketCode() {
    return randomBytes(5).toString('hex').toUpperCase();
  }

  private rewardSelect() {
    return {
      id: true,
      userId: true,
      source: true,
      status: true,
      ticketCount: true,
      title: true,
      description: true,
      relatedType: true,
      relatedId: true,
      cancellationReason: true,
      createdAt: true,
    } satisfies Prisma.DropRewardEventSelect;
  }

  private mapReward(reward: {
    id: string;
    source: string;
    status: string;
    ticketCount: number;
    title: string;
    description: string | null;
    relatedType?: string | null;
    relatedId?: string | null;
    cancellationReason?: string | null;
    createdAt: Date;
  }) {
    return {
      id: reward.id,
      source: reward.source,
      status: reward.status,
      ticketCount: reward.ticketCount,
      title: reward.title,
      description: reward.description,
      relatedType: reward.relatedType ?? null,
      relatedId: reward.relatedId ?? null,
      cancellationReason: reward.cancellationReason ?? null,
      createdAt: reward.createdAt.toISOString(),
    };
  }
}

export const DROPS_TASK_SOURCES = [
  'verification',
  'daily_login',
  'host_meeting',
  'visit_meeting',
  'referral',
  'subscription',
  'boost',
] as const;

export const DROPS_MAX_TICKETS_PER_MONTH = MAX_TICKETS_PER_MONTH;
export const DROPS_TASK_TICKET_COUNTS = TICKET_COUNT_BY_SOURCE;
export const DROPS_TASK_MONTHLY_LIMITS = TASK_LIMITS;
