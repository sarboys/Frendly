import { randomBytes, randomUUID } from 'node:crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  buildPublicAssetUrl,
  createS3Client,
  createS3RequestOptions,
  getS3Config,
} from '@big-break/database';
import { ApiError } from '../common/api-error';
import { mapMediaVariants } from '../common/media-presenters';
import { PrismaService } from './prisma.service';
import {
  DROPS_MAX_TICKETS_PER_MONTH,
  DROPS_TASK_MONTHLY_LIMITS,
  DROPS_TASK_SOURCES,
  DROPS_TASK_TICKET_COUNTS,
  DropsRewardService,
} from './drops-reward.service';
import { DropsDrawService } from './drops-draw.service';

type DropRow = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  imageVariants?: unknown;
  type: string;
  status: string;
  prizes: unknown;
  startsAt: Date;
  endsAt: Date;
  drawAt: Date;
  conditions: unknown;
  maxTicketsPerUser: number | null;
  requiresVerified: boolean;
  requiresFrendlyPlus: boolean;
  minAge: number | null;
  region: string | null;
  seedHash: string | null;
  secretSeed?: string | null;
  seedRevealedAt?: Date | null;
  cancelReason?: string | null;
};

type AdminDropStats = {
  ticketCount: number;
  participantCount: number;
  winnerCount: number;
};

const ADMIN_TICKET_STATUSES = ['active', 'used_in_draw', 'winner'] as const;
export const MAX_DROP_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
const DROP_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMMUTABLE_MEDIA_CACHE_CONTROL = 'public, max-age=31536000, immutable';

const TASK_META = {
  verification: {
    id: 'verify',
    title: 'Пройти верификацию',
    description: 'Разово после подтверждения профиля',
    cta: 'Верификация',
    route: '/verify',
    action: 'claim_verification',
  },
  daily_login: {
    id: 'daily',
    title: 'Ежедневный вход',
    description: 'Один раз в день',
    cta: '+1 сегодня',
    action: 'claim_daily_login',
  },
  host_meeting: {
    id: 'host',
    title: 'Провести встречу',
    description: 'После подтверждения участников',
    cta: 'Создать',
    route: '/meetings/new',
  },
  visit_meeting: {
    id: 'attend',
    title: 'Посетить встречу',
    description: 'После подтверждения присутствия',
    cta: 'К встречам',
    route: '/meetings',
  },
  referral: {
    id: 'invite',
    title: 'Пригласить друга',
    description: 'После верификации друга',
    cta: 'Позвать',
    route: '/share',
    action: 'create_referral_link',
  },
  subscription: {
    id: 'plus',
    title: 'Оформить Frendly+',
    description: 'После подтверждения оплаты',
    cta: 'Подписка',
    route: '/paywall',
  },
  boost: {
    id: 'boost',
    title: 'Продвинуть встречу',
    description: 'После активации продвижения',
    cta: 'Услуга',
    route: '/meetings',
  },
} as const;

@Injectable()
export class DropsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly rewardService?: DropsRewardService,
    private readonly drawService?: DropsDrawService,
  ) {}

  async getHome(userId: string) {
    const [drops, progress, tasks, history, pastWinners, eligibility] =
      await Promise.all([
        this.listVisibleDrops(userId),
        this.getRewardService().getProgress(userId),
        this.getTasks(userId),
        this.listHistory(userId, {}),
        this.listPastWinners(),
        this.getUserEligibility(userId),
      ]);
    const mainDrop =
      drops.find((drop) => drop.type === 'main_monthly' && drop.status === 'active') ??
      drops[0] ??
      null;

    return {
      mainDrop,
      drops,
      ticketProgress: progress,
      tasks: tasks.tasks,
      history: history.items,
      pastWinners,
      eligibility,
      pendingRewards: history.items.filter((item) => item.status === 'pending'),
      updatedAt: new Date().toISOString(),
    };
  }

  async listVisibleDrops(userId: string) {
    const drops = await this.prismaService.client.drop.findMany({
      where: {
        status: { in: ['scheduled', 'active', 'drawing_pending', 'finished'] },
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      select: this.dropSelect(),
    });

    return Promise.all(drops.map((drop) => this.mapDropForUser(drop, userId)));
  }

  async getDrop(userId: string, dropId: string) {
    const drop = await this.prismaService.client.drop.findUnique({
      where: { id: dropId },
      select: this.dropSelect(true),
    });
    if (!drop || drop.status === 'draft') {
      throw new ApiError(404, 'drop_not_found', 'Drop not found');
    }

    return this.mapDropForUser(drop, userId, true);
  }

  async getTasks(userId: string) {
    const rewardService = this.getRewardService();
    const month = rewardService.monthBounds();
    const todayKey = rewardService.localDateKey();
    const [user, progress, rewards] = await Promise.all([
      this.prismaService.client.user.findUnique({
        where: { id: userId },
        select: {
          verified: true,
          status: true,
        },
      }),
      rewardService.getProgress(userId),
      this.prismaService.client.dropRewardEvent.findMany({
        where: {
          userId,
          monthKey: month.monthKey,
          source: { in: [...DROPS_TASK_SOURCES] },
          status: { in: ['pending', 'active'] },
        },
        select: {
          source: true,
          status: true,
          ticketCount: true,
          idempotencyKey: true,
        },
      }),
    ]);
    const ticketsBySource = new Map<string, number>();
    const pendingBySource = new Set<string>();
    for (const reward of rewards) {
      ticketsBySource.set(
        reward.source,
        (ticketsBySource.get(reward.source) ?? 0) + reward.ticketCount,
      );
      if (reward.status === 'pending') {
        pendingBySource.add(reward.source);
      }
    }
    const hasVerificationReward = rewards.some(
      (reward) => reward.source === 'verification',
    );
    const hasDailyReward = rewards.some(
      (reward) => reward.idempotencyKey === `daily_login:${userId}:${todayKey}`,
    );

      return {
        monthKey: month.monthKey,
        tasks: DROPS_TASK_SOURCES.map((source) => {
          const meta = TASK_META[source];
        const monthlyLimit = DROPS_TASK_MONTHLY_LIMITS[source] ?? null;
        const current = ticketsBySource.get(source) ?? 0;
        const limited =
          monthlyLimit != null && current >= monthlyLimit ||
          progress.reserved >= DROPS_MAX_TICKETS_PER_MONTH;
        let status:
          | 'available'
          | 'completed'
          | 'limited'
          | 'pending'
          | 'locked'
          | 'not_eligible' = 'available';
        let lockReason: string | null = null;

        if (pendingBySource.has(source)) {
          status = 'pending';
        } else if (source === 'verification' && hasVerificationReward) {
          status = 'completed';
        } else if (source === 'daily_login' && hasDailyReward) {
          status = 'completed';
        } else if (limited) {
          status = 'limited';
          lockReason = 'Достигнут лимит билетов';
        } else if (source === 'verification' && !user?.verified) {
          status = 'available';
        }
        const cta = this.taskCta(source, meta, user?.verified === true);

        return {
          id: meta.id,
          source,
          title: meta.title,
          description: meta.description,
          rewardTickets: DROPS_TASK_TICKET_COUNTS[source],
          monthlyLimit,
          progress: current,
          status,
          cta,
          lockReason,
        };
      }),
      ticketProgress: progress,
    };
  }

  async listHistory(
    userId: string,
    params: { month?: string; limit?: number } = {},
  ) {
    const limit = this.normalizeLimit(params.limit);
    const where: Prisma.DropRewardEventWhereInput = {
      userId,
      ...(params.month ? { monthKey: params.month } : {}),
    };
    const rows = await this.prismaService.client.dropRewardEvent.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: {
        id: true,
        source: true,
        status: true,
        title: true,
        ticketCount: true,
        cancellationReason: true,
        createdAt: true,
        relatedType: true,
        relatedId: true,
      },
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        source: row.source,
        status: row.status,
        title: row.title,
        ticketCount: row.status === 'cancelled' || row.status === 'rejected'
          ? 0
          : row.ticketCount,
        cancellationReason: row.cancellationReason,
        relatedType: row.relatedType,
        relatedId: row.relatedId,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async claimVerification(userId: string) {
    return this.getRewardService().claimVerification(userId);
  }

  async claimDailyLogin(userId: string) {
    return this.getRewardService().claimDailyLogin(userId);
  }

  async applyTickets(userId: string, dropId: string, ticketCountRaw: number) {
    const ticketCount = this.normalizeTicketCount(ticketCountRaw);
    return this.prismaService.client.$transaction(async (tx) => {
      const drop = await tx.drop.findUnique({
        where: { id: dropId },
        select: {
          id: true,
          type: true,
          status: true,
          startsAt: true,
          endsAt: true,
          maxTicketsPerUser: true,
          requiresVerified: true,
          requiresFrendlyPlus: true,
          minAge: true,
          region: true,
        },
      });
      if (!drop) {
        throw new ApiError(404, 'drop_not_found', 'Drop not found');
      }
      if (drop.status !== 'active') {
        throw new ApiError(409, 'drop_not_active', 'Drop is not active');
      }

      await this.assertUserEligibleForDrop(tx, userId, drop);

      const assignedCount = await tx.dropTicket.count({
        where: {
          userId,
          dropId,
          status: { in: ['active', 'used_in_draw', 'winner'] },
        },
      });
      if (
        drop.maxTicketsPerUser != null &&
        assignedCount + ticketCount > drop.maxTicketsPerUser
      ) {
        throw new ApiError(409, 'drop_ticket_limit_reached', 'Drop ticket limit reached');
      }

      const availableCount = await tx.dropTicket.count({
        where: {
          userId,
          status: 'active',
          dropId: null,
        },
      });
      if (availableCount < ticketCount) {
        throw new ApiError(409, 'drop_not_enough_tickets', 'Not enough free tickets');
      }

      const tickets = await tx.dropTicket.findMany({
        where: {
          userId,
          status: 'active',
          dropId: null,
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: ticketCount,
        select: { id: true },
      });
      if (tickets.length !== ticketCount) {
        throw new ApiError(409, 'drop_not_enough_tickets', 'Not enough free tickets');
      }

      await tx.dropTicket.updateMany({
        where: {
          id: { in: tickets.map((ticket) => ticket.id) },
          userId,
          status: 'active',
          dropId: null,
        },
        data: {
          dropId,
          assignedAt: new Date(),
        },
      });

      return {
        dropId,
        appliedCount: tickets.length,
        userTicketsInDrop: assignedCount + tickets.length,
        availableTickets: availableCount - tickets.length,
      };
    });
  }

  async createReferralLink(userId: string) {
    const existing = await this.prismaService.client.dropReferral.findFirst({
      where: {
        inviterUserId: userId,
        invitedUserId: null,
      },
      select: {
        code: true,
      },
    });
    const code = existing?.code ?? randomBytes(5).toString('hex');
    if (!existing) {
      await this.prismaService.client.dropReferral.create({
        data: {
          inviterUserId: userId,
          code,
        },
      });
    }

    const publicSite = process.env.PUBLIC_SITE_URL ?? 'https://frendly.tech';
    return {
      code,
      url: `${publicSite.replace(/\/$/, '')}/r/${code}`,
    };
  }

  async bindReferralCode(userId: string, rawCode: string) {
    const code = rawCode.trim();
    if (!code) {
      throw new ApiError(400, 'invalid_referral_code', 'Referral code is invalid');
    }

    const referral = await this.prismaService.client.dropReferral.findUnique({
      where: { code },
      select: this.referralSelect(),
    });
    if (!referral) {
      throw new ApiError(404, 'referral_not_found', 'Referral not found');
    }
    if (referral.inviterUserId === userId) {
      throw new ApiError(409, 'referral_self_invite', 'Self referral is not allowed');
    }
    if (referral.invitedUserId === userId) {
      return this.mapReferral(referral);
    }
    if (referral.invitedUserId != null) {
      throw new ApiError(409, 'referral_already_used', 'Referral is already used');
    }

    const existingForUser = await this.prismaService.client.dropReferral.findUnique({
      where: { invitedUserId: userId },
      select: this.referralSelect(),
    });
    if (existingForUser) {
      throw new ApiError(409, 'referral_user_already_invited', 'User already has a referral');
    }

    const claimed = await this.prismaService.client.dropReferral.updateMany({
      where: {
        id: referral.id,
        invitedUserId: null,
      },
      data: {
        invitedUserId: userId,
        status: 'registered',
      },
    });
    if (claimed.count !== 1) {
      throw new ApiError(409, 'referral_already_used', 'Referral is already used');
    }

    const updated = await this.prismaService.client.dropReferral.findUnique({
      where: { id: referral.id },
      select: this.referralSelect(),
    });
    if (!updated) {
      throw new ApiError(404, 'referral_not_found', 'Referral not found');
    }
    return this.mapReferral(updated);
  }

  async listAdminDrops(query: Record<string, unknown> = {}) {
    const limit = this.parseAdminLimit(query.limit);
    const drops = await this.prismaService.client.drop.findMany({
      where: this.buildAdminDropWhere(query),
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: this.dropSelect(true),
    });
    const pageDrops = drops.slice(0, limit);
    const stats = await this.getAdminDropStats(pageDrops.map((drop) => drop.id));
    const lastDrop = pageDrops[pageDrops.length - 1];

    return {
      items: pageDrops.map((drop) => this.mapAdminDrop(drop, stats.get(drop.id))),
      nextCursor: drops.length > limit && lastDrop
        ? this.encodeAdminCursor({
            startsAt: lastDrop.startsAt.toISOString(),
            id: lastDrop.id,
          })
        : null,
    };
  }

  async getAdminDrop(dropId: string) {
    const drop = await this.prismaService.client.drop.findUnique({
      where: { id: dropId },
      select: this.dropSelect(true),
    });
    if (!drop) {
      throw new ApiError(404, 'drop_not_found', 'Drop not found');
    }

    const [stats, winners] = await Promise.all([
      this.getAdminDropStats([drop.id]),
      this.listAdminDropWinners(drop.id),
    ]);

    return {
      ...this.mapAdminDrop(drop, stats.get(drop.id)),
      winners,
    };
  }

  async createDrop(body: Record<string, unknown>) {
    const data = this.parseDropInput(body, true);
    return this.prismaService.client.drop.create({
      data,
      select: this.dropSelect(true),
    });
  }

  async updateDrop(dropId: string, body: Record<string, unknown>) {
    const drop = await this.prismaService.client.drop.findUnique({
      where: { id: dropId },
      select: { id: true, status: true },
    });
    if (!drop) {
      throw new ApiError(404, 'drop_not_found', 'Drop not found');
    }
    if (drop.status !== 'draft' && drop.status !== 'scheduled') {
      throw new ApiError(409, 'drop_edit_locked', 'Drop cannot be edited');
    }
    return this.prismaService.client.drop.update({
      where: { id: dropId },
      data: this.parseDropInput(body, false),
      select: this.dropSelect(true),
    });
  }

  async uploadDropImageFile(file?: Express.Multer.File) {
    if (!file) {
      throw new ApiError(400, 'drop_image_file_required', 'Drop image file is required');
    }
    if (!DROP_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new ApiError(400, 'invalid_drop_image_mime_type', 'Drop image must be JPEG, PNG or WebP');
    }
    if (file.size <= 0 || file.size > MAX_DROP_IMAGE_UPLOAD_BYTES) {
      throw new ApiError(400, 'invalid_drop_image_size', 'Drop image size is invalid');
    }

    const objectKey = `drop-images/${randomUUID()}-${this.safeFileName(file.originalname)}`;
    const client = createS3Client();
    const config = getS3Config();
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        ContentType: file.mimetype,
        CacheControl: IMMUTABLE_MEDIA_CACHE_CONTROL,
        Body: file.buffer,
      }),
      createS3RequestOptions(),
    );

    return {
      imageUrl: buildPublicAssetUrl(objectKey),
      imageVariants: {},
      objectKey,
    };
  }

  async activateDrop(dropId: string) {
    return this.getDrawService().activateDrop(dropId);
  }

  async cancelDrop(dropId: string, reason?: string | null) {
    return this.prismaService.client.$transaction(async (tx) => {
      const drop = await tx.drop.findUnique({
        where: { id: dropId },
        select: { id: true, status: true },
      });
      if (!drop) {
        throw new ApiError(404, 'drop_not_found', 'Drop not found');
      }
      await tx.dropTicket.updateMany({
        where: {
          dropId,
          status: 'active',
        },
        data: {
          dropId: null,
          assignedAt: null,
        },
      });
      return tx.drop.update({
        where: { id: dropId },
        data: {
          status: 'cancelled',
          cancelReason: reason ?? null,
        },
        select: this.dropSelect(true),
      });
    });
  }

  async runDraw(dropId: string, body: Record<string, unknown>) {
    return this.getDrawService().runDraw(dropId, {
      winnerCount: this.optionalInt(body.winnerCount) ?? undefined,
      reserveCount: this.optionalInt(body.reserveCount) ?? undefined,
    });
  }

  async listDropTickets(dropId: string, query: Record<string, unknown> = {}) {
    const limit = this.parseAdminLimit(query.limit, 200);
    const where = this.buildDropTicketWhere(dropId, query);
    const tickets = await this.prismaService.client.dropTicket.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        code: true,
        userId: true,
        status: true,
        source: true,
        monthKey: true,
        assignedAt: true,
        createdAt: true,
        cancelReason: true,
        user: {
          select: {
            displayName: true,
          },
        },
        rewardEvent: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });
    const pageTickets = tickets.slice(0, limit);
    const lastTicket = pageTickets[pageTickets.length - 1];
    return {
      items: pageTickets.map((ticket) => ({
        ...ticket,
        userName: ticket.user.displayName,
        assignedAt: ticket.assignedAt?.toISOString() ?? null,
        createdAt: ticket.createdAt.toISOString(),
      })),
      nextCursor: tickets.length > limit && lastTicket
        ? this.encodeAdminCursor({
            createdAt: lastTicket.createdAt.toISOString(),
            id: lastTicket.id,
          })
        : null,
    };
  }

  async listDropParticipants(dropId: string, query: Record<string, unknown> = {}) {
    const limit = this.parseAdminLimit(query.limit, 100);
    const cursor = this.parseAdminCursor(query.cursor);
    const tickets = await this.prismaService.client.dropTicket.findMany({
      where: {
        dropId,
        status: { in: ['active', 'used_in_draw', 'winner'] },
        ...this.participantSearchWhere(query.q),
      },
      orderBy: [{ assignedAt: 'asc' }, { id: 'asc' }],
      take: 10000,
      select: {
        userId: true,
        status: true,
        user: {
          select: {
            displayName: true,
            verified: true,
            status: true,
            profile: {
              select: { city: true },
            },
            dropRestriction: {
              select: {
                reason: true,
                expiresAt: true,
              },
            },
          },
        },
      },
    });
    const byUser = new Map<
      string,
      {
        userId: string;
        name: string;
        city: string | null;
        verified: boolean;
        userStatus: string;
        frozen: boolean;
        freezeReason: string | null;
        ticketCount: number;
        winnerTicketCount: number;
      }
    >();

    for (const ticket of tickets) {
      const current = byUser.get(ticket.userId);
      if (current) {
        current.ticketCount += 1;
        if (ticket.status === 'winner') {
          current.winnerTicketCount += 1;
        }
        continue;
      }

      byUser.set(ticket.userId, {
        userId: ticket.userId,
        name: ticket.user.displayName,
        city: ticket.user.profile?.city ?? null,
        verified: ticket.user.verified,
        userStatus: ticket.user.status,
        frozen: ticket.user.dropRestriction != null,
        freezeReason: ticket.user.dropRestriction?.reason ?? null,
        ticketCount: 1,
        winnerTicketCount: ticket.status === 'winner' ? 1 : 0,
      });
    }

    let items = [...byUser.values()].sort((left, right) =>
      left.userId.localeCompare(right.userId),
    );
    const cursorUserId = typeof cursor?.userId === 'string' ? cursor.userId : null;
    if (cursorUserId) {
      items = items.filter((item) => item.userId > cursorUserId);
    }
    const pageItems = items.slice(0, limit);
    const lastItem = pageItems[pageItems.length - 1];

    return {
      items: pageItems,
      nextCursor: items.length > limit && lastItem
        ? this.encodeAdminCursor({ userId: lastItem.userId })
        : null,
    };
  }

  async listUserTickets(userId: string) {
    const tickets = await this.prismaService.client.dropTicket.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
      select: {
        id: true,
        code: true,
        status: true,
        source: true,
        monthKey: true,
        dropId: true,
        assignedAt: true,
        cancelledAt: true,
        cancelReason: true,
        createdAt: true,
        rewardEvent: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        drop: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
          },
        },
      },
    });

    return {
      items: tickets.map((ticket) => ({
        ...ticket,
        assignedAt: ticket.assignedAt?.toISOString() ?? null,
        cancelledAt: ticket.cancelledAt?.toISOString() ?? null,
        createdAt: ticket.createdAt.toISOString(),
      })),
    };
  }

  async listRewardEvents(query: Record<string, unknown> = {}) {
    const limit = this.parseAdminLimit(query.limit, 200);
    const where = this.buildRewardEventWhere(query);
    const rows = await this.prismaService.client.dropRewardEvent.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        userId: true,
        source: true,
        status: true,
        monthKey: true,
        idempotencyKey: true,
        ticketCount: true,
        title: true,
        cancellationReason: true,
        relatedType: true,
        relatedId: true,
        createdAt: true,
        user: {
          select: {
            displayName: true,
          },
        },
      },
    });
    const pageRows = rows.slice(0, limit);
    const lastRow = pageRows[pageRows.length - 1];

    return {
      items: pageRows.map((row) => ({
        ...row,
        userName: row.user.displayName,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: rows.length > limit && lastRow
        ? this.encodeAdminCursor({
            createdAt: lastRow.createdAt.toISOString(),
            id: lastRow.id,
          })
        : null,
    };
  }

  async manualGrant(userId: string, body: Record<string, unknown>) {
    return this.getRewardService().grantManualTickets(
      userId,
      this.normalizeTicketCount(body.ticketCount),
      typeof body.title === 'string' ? body.title : 'Ручное начисление',
      typeof body.idempotencyKey === 'string'
        ? body.idempotencyKey
        : randomBytes(8).toString('hex'),
    );
  }

  async cancelTicket(ticketId: string, body: Record<string, unknown>) {
    const reason = typeof body.reason === 'string' && body.reason.trim()
      ? body.reason.trim()
      : 'manual_admin_action';
    return this.prismaService.client.dropTicket.update({
      where: { id: ticketId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: reason,
        dropId: null,
        assignedAt: null,
      },
      select: {
        id: true,
        status: true,
        cancelReason: true,
      },
    });
  }

  async freezeUser(userId: string, body: Record<string, unknown>) {
    const reason = typeof body.reason === 'string' && body.reason.trim()
      ? body.reason.trim()
      : 'manual_admin_action';
    return this.prismaService.client.dropUserRestriction.upsert({
      where: { userId },
      update: { reason, expiresAt: null },
      create: { userId, reason },
    });
  }

  async unfreezeUser(userId: string) {
    await this.prismaService.client.dropUserRestriction.deleteMany({
      where: { userId },
    });
    return { ok: true, userId };
  }

  async updateWinner(winnerId: string, action: string, body: Record<string, unknown>) {
    const status = this.winnerStatusForAction(action);
    return this.prismaService.client.dropWinner.update({
      where: { id: winnerId },
      data: {
        status,
        rejectedReason:
          status === 'rejected' && typeof body.reason === 'string'
            ? body.reason
            : undefined,
      },
    });
  }

  async chooseReserveWinner(winnerId: string, body: Record<string, unknown>) {
    return this.prismaService.client.$transaction(async (tx) => {
      const reserveWinner = await tx.dropWinner.findUnique({
        where: { id: winnerId },
        select: {
          id: true,
          dropId: true,
          ticketId: true,
          reserve: true,
          position: true,
          status: true,
        },
      });
      if (!reserveWinner) {
        throw new ApiError(404, 'winner_not_found', 'Winner not found');
      }
      if (!reserveWinner.reserve) {
        throw new ApiError(409, 'winner_not_reserve', 'Winner is not reserve');
      }

      const replacedWinnerId =
        typeof body.replacedWinnerId === 'string' && body.replacedWinnerId.trim()
          ? body.replacedWinnerId.trim()
          : null;
      const replacedWinner = replacedWinnerId
        ? await tx.dropWinner.findUnique({
            where: { id: replacedWinnerId },
            select: {
              id: true,
              dropId: true,
              ticketId: true,
              reserve: true,
              position: true,
              status: true,
            },
          })
        : await tx.dropWinner.findFirst({
            where: {
              dropId: reserveWinner.dropId,
              reserve: false,
              status: { in: ['rejected', 'expired'] },
            },
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              dropId: true,
              ticketId: true,
              reserve: true,
              position: true,
              status: true,
            },
          });

      if (!replacedWinner || replacedWinner.dropId !== reserveWinner.dropId) {
        throw new ApiError(404, 'winner_replacement_not_found', 'Replacement winner not found');
      }
      if (replacedWinner.reserve) {
        throw new ApiError(409, 'winner_replacement_invalid', 'Replacement winner is invalid');
      }

      const maxReservePosition = await tx.dropWinner.aggregate({
        where: { dropId: reserveWinner.dropId, reserve: true },
        _max: { position: true },
      });
      const movedReservePosition =
        Math.max(maxReservePosition._max.position ?? 0, reserveWinner.position) + 1;
      const reason = typeof body.reason === 'string' && body.reason.trim()
        ? body.reason.trim()
        : 'reserve_selected';

      await tx.dropWinner.update({
        where: { id: replacedWinner.id },
        data: {
          status: 'rejected',
          rejectedReason: reason,
          reserve: true,
          position: movedReservePosition,
        },
      });
      await tx.dropTicket.update({
        where: { id: replacedWinner.ticketId },
        data: { status: 'used_in_draw' },
      });
      await tx.dropTicket.update({
        where: { id: reserveWinner.ticketId },
        data: { status: 'winner' },
      });
      return tx.dropWinner.update({
        where: { id: reserveWinner.id },
        data: {
          reserve: false,
          position: replacedWinner.position,
          status: 'pending_verification',
        },
      });
    });
  }

  private async getAdminDropStats(dropIds: string[]) {
    const stats = new Map<string, AdminDropStats>();
    for (const dropId of dropIds) {
      stats.set(dropId, {
        ticketCount: 0,
        participantCount: 0,
        winnerCount: 0,
      });
    }
    if (dropIds.length === 0) {
      return stats;
    }

    const [ticketCounts, participants, winnerCounts] = await Promise.all([
      this.prismaService.client.dropTicket.groupBy({
        by: ['dropId'],
        where: {
          dropId: { in: dropIds },
          status: { in: [...ADMIN_TICKET_STATUSES] },
        },
        _count: { _all: true },
      }),
      this.prismaService.client.dropTicket.findMany({
        where: {
          dropId: { in: dropIds },
          status: { in: [...ADMIN_TICKET_STATUSES] },
        },
        distinct: ['dropId', 'userId'],
        select: {
          dropId: true,
          userId: true,
        },
      }),
      this.prismaService.client.dropWinner.groupBy({
        by: ['dropId'],
        where: { dropId: { in: dropIds } },
        _count: { _all: true },
      }),
    ]);

    for (const row of ticketCounts) {
      if (!row.dropId) continue;
      stats.set(row.dropId, {
        ...(stats.get(row.dropId) ?? {
          ticketCount: 0,
          participantCount: 0,
          winnerCount: 0,
        }),
        ticketCount: row._count._all,
      });
    }

    const participantsByDrop = new Map<string, number>();
    for (const participant of participants) {
      if (!participant.dropId) continue;
      participantsByDrop.set(
        participant.dropId,
        (participantsByDrop.get(participant.dropId) ?? 0) + 1,
      );
    }
    for (const [dropId, count] of participantsByDrop.entries()) {
      stats.set(dropId, {
        ...(stats.get(dropId) ?? {
          ticketCount: 0,
          participantCount: 0,
          winnerCount: 0,
        }),
        participantCount: count,
      });
    }

    for (const row of winnerCounts) {
      stats.set(row.dropId, {
        ...(stats.get(row.dropId) ?? {
          ticketCount: 0,
          participantCount: 0,
          winnerCount: 0,
        }),
        winnerCount: row._count._all,
      });
    }

    return stats;
  }

  private async listAdminDropWinners(dropId: string) {
    const winners = await this.prismaService.client.dropWinner.findMany({
      where: { dropId },
      orderBy: [{ reserve: 'asc' }, { position: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        status: true,
        position: true,
        reserve: true,
        prize: true,
        rejectedReason: true,
        createdAt: true,
        updatedAt: true,
        ticket: {
          select: {
            id: true,
            code: true,
            source: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            displayName: true,
            profile: {
              select: { city: true },
            },
          },
        },
      },
    });

    return winners.map((winner) => ({
      id: winner.id,
      status: winner.status,
      position: winner.position,
      reserve: winner.reserve,
      userId: winner.user.id,
      userName: winner.user.displayName,
      city: winner.user.profile?.city ?? null,
      prize: winner.prize,
      prizeSummary: this.prizeSummary(winner.prize),
      ticketId: winner.ticket.id,
      ticket: winner.ticket.code,
      ticketSource: winner.ticket.source,
      ticketStatus: winner.ticket.status,
      rejectedReason: winner.rejectedReason,
      createdAt: winner.createdAt.toISOString(),
      updatedAt: winner.updatedAt.toISOString(),
    }));
  }

  private buildAdminDropWhere(query: Record<string, unknown>): Prisma.DropWhereInput {
    const and: Prisma.DropWhereInput[] = [];
    const status = this.optionalText(query.status);
    const type = this.optionalText(query.type);
    const search = this.optionalText(query.q);
    const cursor = this.parseAdminCursor(query.cursor);

    if (status) {
      if (!this.isDropStatus(status)) {
        throw new ApiError(400, 'invalid_drop_status', 'Drop status is invalid');
      }
      and.push({ status });
    }
    if (type) {
      if (!this.isDropType(type)) {
        throw new ApiError(400, 'invalid_drop_type', 'Drop type is invalid');
      }
      and.push({ type });
    }
    if (search) {
      and.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (cursor) {
      const startsAt = this.requiredCursorDate(cursor, 'startsAt');
      const id = this.requiredCursorText(cursor, 'id');
      and.push({
        OR: [
          { startsAt: { lt: startsAt } },
          { startsAt, id: { lt: id } },
        ],
      });
    }

    return and.length > 0 ? { AND: and } : {};
  }

  private buildDropTicketWhere(
    dropId: string,
    query: Record<string, unknown>,
  ): Prisma.DropTicketWhereInput {
    const and: Prisma.DropTicketWhereInput[] = [{ dropId }];
    const status = this.optionalText(query.status);
    const source = this.optionalText(query.source);
    const userId = this.optionalText(query.userId);
    const cursor = this.parseAdminCursor(query.cursor);

    if (status) {
      if (!this.isTicketStatus(status)) {
        throw new ApiError(400, 'invalid_ticket_status', 'Ticket status is invalid');
      }
      and.push({ status });
    }
    if (source) {
      if (!this.isRewardSource(source)) {
        throw new ApiError(400, 'invalid_reward_source', 'Reward source is invalid');
      }
      and.push({ source });
    }
    if (userId) {
      and.push({ userId });
    }
    if (cursor) {
      const createdAt = this.requiredCursorDate(cursor, 'createdAt');
      const id = this.requiredCursorText(cursor, 'id');
      and.push({
        OR: [
          { createdAt: { lt: createdAt } },
          { createdAt, id: { lt: id } },
        ],
      });
    }

    return { AND: and };
  }

  private buildRewardEventWhere(query: Record<string, unknown>): Prisma.DropRewardEventWhereInput {
    const and: Prisma.DropRewardEventWhereInput[] = [];
    const userId = this.optionalText(query.userId);
    const dropId = this.optionalText(query.dropId);
    const source = this.optionalText(query.source);
    const status = this.optionalText(query.status);
    const cursor = this.parseAdminCursor(query.cursor);

    if (userId) {
      and.push({ userId });
    }
    if (dropId) {
      and.push({ tickets: { some: { dropId } } });
    }
    if (source) {
      if (!this.isRewardSource(source)) {
        throw new ApiError(400, 'invalid_reward_source', 'Reward source is invalid');
      }
      and.push({ source });
    }
    if (status) {
      if (!this.isRewardStatus(status)) {
        throw new ApiError(400, 'invalid_reward_status', 'Reward status is invalid');
      }
      and.push({ status });
    }
    if (cursor) {
      const createdAt = this.requiredCursorDate(cursor, 'createdAt');
      const id = this.requiredCursorText(cursor, 'id');
      and.push({
        OR: [
          { createdAt: { lt: createdAt } },
          { createdAt, id: { lt: id } },
        ],
      });
    }

    return and.length > 0 ? { AND: and } : {};
  }

  private participantSearchWhere(searchValue: unknown): Prisma.DropTicketWhereInput {
    const search = this.optionalText(searchValue);
    if (!search) {
      return {};
    }

    return {
      user: {
        OR: [
          { id: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search, mode: 'insensitive' } },
        ],
      },
    };
  }

  private async mapDropForUser(drop: DropRow, userId: string, detailed = false) {
    const [myTickets, tickets] = await Promise.all([
      this.prismaService.client.dropTicket.count({
        where: {
          dropId: drop.id,
          userId,
          status: { in: ['active', 'used_in_draw', 'winner'] },
        },
      }),
      this.prismaService.client.dropTicket.findMany({
        where: {
          dropId: drop.id,
          status: { in: ['active', 'used_in_draw', 'winner'] },
        },
        select: { userId: true },
        take: 5000,
      }),
    ]);
    const eligibility = await this.resolveDropEligibility(userId, drop);
    const participantCount = new Set(tickets.map((ticket) => ticket.userId)).size;
    const winners = detailed && drop.status === 'finished'
      ? await this.listDropWinners(drop.id)
      : [];
    const now = Date.now();
    const daysLeft = Math.max(
      0,
      Math.ceil((drop.drawAt.getTime() - now) / (24 * 60 * 60 * 1000)),
    );

    return {
      id: drop.id,
      type: drop.type,
      status: drop.status,
      title: drop.title,
      description: drop.description,
      imageUrl: drop.imageUrl,
      imageVariants: mapMediaVariants(drop.imageVariants),
      prizes: drop.prizes,
      prizeSummary: this.prizeSummary(drop.prizes),
      startsAt: drop.startsAt.toISOString(),
      endsAt: drop.endsAt.toISOString(),
      drawAt: drop.drawAt.toISOString(),
      drawDate: this.formatShortDate(drop.drawAt),
      daysLeft,
      participantCount,
      myTickets,
      maxTicketsPerUser: drop.maxTicketsPerUser,
      requiresVerified: drop.requiresVerified,
      requiresFrendlyPlus: drop.requiresFrendlyPlus,
      eligibility,
      seedHash: drop.seedHash,
      secretSeed: detailed && drop.status === 'finished' ? drop.secretSeed ?? null : null,
      seedRevealedAt: drop.seedRevealedAt?.toISOString() ?? null,
      cancelReason: drop.cancelReason ?? null,
      winners,
    };
  }

  private async listDropWinners(dropId: string) {
    const winners = await this.prismaService.client.dropWinner.findMany({
      where: { dropId },
      orderBy: [{ reserve: 'asc' }, { position: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        status: true,
        position: true,
        reserve: true,
        prize: true,
        ticket: {
          select: { code: true },
        },
        user: {
          select: {
            id: true,
            displayName: true,
            profile: {
              select: { city: true },
            },
          },
        },
      },
    });

    return winners.map((winner) => ({
      id: winner.id,
      status: winner.status,
      position: winner.position,
      reserve: winner.reserve,
      userId: winner.user.id,
      name: winner.user.displayName,
      city: winner.user.profile?.city ?? '',
      prize: this.prizeSummary(winner.prize),
      ticket: winner.ticket.code,
    }));
  }

  private async listPastWinners() {
    const winners = await this.prismaService.client.dropWinner.findMany({
      where: {
        status: { in: ['approved', 'prize_delivered', 'prize_replaced'] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 5,
      select: {
        id: true,
        prize: true,
        position: true,
        ticket: {
          select: {
            code: true,
          },
        },
        user: {
          select: {
            displayName: true,
            profile: {
              select: { city: true },
            },
          },
        },
        drop: {
          select: { title: true },
        },
      },
    });
    return winners.map((winner) => ({
      id: winner.id,
      name: winner.user.displayName,
      city: winner.user.profile?.city ?? '',
      prize: this.prizeSummary(winner.prize) || winner.drop.title,
      ticket: winner.ticket.code,
      position: winner.position,
    }));
  }

  private async getUserEligibility(userId: string) {
    const user = await this.prismaService.client.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        verified: true,
      },
    });
    const restriction = await this.prismaService.client.dropUserRestriction.findUnique({
      where: { userId },
      select: { reason: true, expiresAt: true },
    });
    return {
      canParticipate:
        user?.status === 'active' &&
        restriction == null,
      verified: user?.verified === true,
      blockedReason: restriction?.reason ?? null,
    };
  }

  private async resolveDropEligibility(userId: string, drop: DropRow) {
    try {
      await this.assertUserEligibleForDrop(this.prismaService.client, userId, drop);
      return { canParticipate: true, missing: [] as string[] };
    } catch (error) {
      if (error instanceof ApiError) {
        const details = error.details as { missing?: unknown } | undefined;
        return {
          canParticipate: false,
          missing: Array.isArray(details?.missing)
            ? details.missing
            : [error.code],
        };
      }
      throw error;
    }
  }

  private async assertUserEligibleForDrop(
    tx: Prisma.TransactionClient,
    userId: string,
    drop: {
      requiresVerified: boolean;
      requiresFrendlyPlus: boolean;
      minAge: number | null;
      region: string | null;
    },
  ) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        verified: true,
        profile: {
          select: {
            birthDate: true,
            city: true,
          },
        },
      },
    });
    const missing: string[] = [];
    if (!user || user.status !== 'active') {
      missing.push('user_active');
    }
    const restriction = await tx.dropUserRestriction.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (restriction) {
      missing.push('drops_allowed');
    }
    if (drop.requiresVerified && user?.verified !== true) {
      missing.push('verification');
    }
    if (drop.requiresFrendlyPlus) {
      const subscription = await tx.userSubscription.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          status: true,
          renewsAt: true,
          trialEndsAt: true,
        },
      });
      if (!this.hasPremiumAccess(subscription)) {
        missing.push('frendly_plus');
      }
    }
    if (drop.minAge != null && !this.isOldEnough(user?.profile?.birthDate ?? null, drop.minAge)) {
      missing.push('age');
    }
    if (drop.region != null && user?.profile?.city !== drop.region) {
      missing.push('region');
    }
    if (missing.length > 0) {
      throw new ApiError(403, 'drop_eligibility_failed', 'Drop eligibility failed', {
        missing,
      });
    }
  }

  private hasPremiumAccess(subscription: {
    status: string;
    renewsAt: Date | null;
    trialEndsAt: Date | null;
  } | null) {
    if (!subscription) {
      return false;
    }
    const now = Date.now();
    return (
      (subscription.status === 'trial' &&
        (subscription.trialEndsAt?.getTime() ?? 0) > now) ||
      ((subscription.status === 'active' || subscription.status === 'canceled') &&
        (subscription.renewsAt?.getTime() ?? 0) > now)
    );
  }

  private isOldEnough(birthDate: Date | null, minAge: number) {
    if (!birthDate) {
      return false;
    }
    const now = new Date();
    const age = now.getUTCFullYear() - birthDate.getUTCFullYear();
    const birthdayPassed =
      now.getUTCMonth() > birthDate.getUTCMonth() ||
      (now.getUTCMonth() === birthDate.getUTCMonth() &&
        now.getUTCDate() >= birthDate.getUTCDate());
    return (birthdayPassed ? age : age - 1) >= minAge;
  }

  private parseDropInput(body: Record<string, unknown>, requireAll: boolean) {
    const data: Partial<Prisma.DropUncheckedCreateInput & Prisma.DropUncheckedUpdateInput> = {};
    const requiredText = (key: string) => {
      const value = body[key];
      if (typeof value !== 'string' || value.trim().length === 0) {
        if (requireAll) {
          throw new ApiError(400, 'invalid_drop_payload', `${key} is required`);
        }
        return undefined;
      }
      return value.trim();
    };
    const requiredDate = (key: string) => {
      const value = body[key];
      if (typeof value !== 'string') {
        if (requireAll) {
          throw new ApiError(400, 'invalid_drop_payload', `${key} is required`);
        }
        return undefined;
      }
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) {
        throw new ApiError(400, 'invalid_drop_payload', `${key} is invalid`);
      }
      return date;
    };

    const title = requiredText('title');
    const description = requiredText('description');
    const startsAt = requiredDate('startsAt');
    const endsAt = requiredDate('endsAt');
    const drawAt = requiredDate('drawAt');
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (Object.prototype.hasOwnProperty.call(body, 'imageUrl')) {
      data.imageUrl = this.optionalText(body.imageUrl);
    }
    if (body.imageVariants && typeof body.imageVariants === 'object') {
      data.imageVariants = body.imageVariants as Prisma.InputJsonValue;
    }
    if (startsAt !== undefined) data.startsAt = startsAt;
    if (endsAt !== undefined) data.endsAt = endsAt;
    if (drawAt !== undefined) data.drawAt = drawAt;
    if (this.isDropType(body.type)) data.type = body.type;
    else if (requireAll) data.type = 'main_monthly';
    if (this.isDropStatus(body.status)) data.status = body.status;
    if (Array.isArray(body.prizes)) data.prizes = body.prizes as Prisma.InputJsonValue;
    if (body.conditions && typeof body.conditions === 'object') {
      data.conditions = body.conditions as Prisma.InputJsonValue;
    }
    data.maxTicketsPerUser = this.optionalInt(body.maxTicketsPerUser);
    data.userLimit = this.optionalInt(body.userLimit);
    data.requiresVerified = body.requiresVerified !== false;
    data.requiresFrendlyPlus = body.requiresFrendlyPlus === true;
    data.minAge = this.optionalInt(body.minAge);
    data.region = typeof body.region === 'string' && body.region.trim()
      ? body.region.trim()
      : null;

    return data as Prisma.DropUncheckedCreateInput & Prisma.DropUncheckedUpdateInput;
  }

  private mapAdminDrop(drop: DropRow, stats?: AdminDropStats) {
    return {
      ...drop,
      imageVariants: mapMediaVariants(drop.imageVariants),
      startsAt: drop.startsAt.toISOString(),
      endsAt: drop.endsAt.toISOString(),
      drawAt: drop.drawAt.toISOString(),
      secretSeed: drop.status === 'finished' ? drop.secretSeed ?? null : null,
      seedRevealedAt: drop.seedRevealedAt?.toISOString() ?? null,
      ticketCount: stats?.ticketCount ?? 0,
      participantCount: stats?.participantCount ?? 0,
      winnerCount: stats?.winnerCount ?? 0,
    };
  }

  private dropSelect(includeSecret = false) {
    return {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      imageVariants: true,
      type: true,
      status: true,
      prizes: true,
      startsAt: true,
      endsAt: true,
      drawAt: true,
      conditions: true,
      maxTicketsPerUser: true,
      requiresVerified: true,
      requiresFrendlyPlus: true,
      minAge: true,
      region: true,
      seedHash: true,
      secretSeed: includeSecret,
      seedRevealedAt: true,
      cancelReason: true,
    } satisfies Prisma.DropSelect;
  }

  private prizeSummary(prizes: unknown) {
    if (Array.isArray(prizes) && prizes.length > 0) {
      const first = prizes[0] as Record<string, unknown>;
      return typeof first.title === 'string' ? first.title : `${prizes.length} призов`;
    }
    if (prizes && typeof prizes === 'object') {
      const prize = prizes as Record<string, unknown>;
      return typeof prize.title === 'string' ? prize.title : '';
    }
    return '';
  }

  private formatShortDate(date: Date) {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      timeZone: 'Europe/Moscow',
    }).format(date);
  }

  private taskCta(
    source: (typeof DROPS_TASK_SOURCES)[number],
    meta: (typeof TASK_META)[(typeof DROPS_TASK_SOURCES)[number]],
    userVerified: boolean,
  ) {
    if (source === 'verification' && !userVerified) {
      return {
        label: 'Верификация',
        route: '/verify',
        action: null,
      };
    }

    return {
      label: meta.cta,
      route: 'route' in meta ? meta.route ?? null : null,
      action: 'action' in meta ? meta.action ?? null : null,
    };
  }

  private isDropType(value: unknown): value is Prisma.DropCreateInput['type'] {
    return (
      value === 'main_monthly' ||
      value === 'free' ||
      value === 'frendly_plus' ||
      value === 'partner' ||
      value === 'special'
    );
  }

  private isDropStatus(value: unknown): value is Prisma.DropCreateInput['status'] {
    return (
      value === 'draft' ||
      value === 'scheduled' ||
      value === 'active' ||
      value === 'drawing_pending' ||
      value === 'finished' ||
      value === 'cancelled'
    );
  }

  private isTicketStatus(value: unknown): value is Prisma.DropTicketCreateInput['status'] {
    return (
      value === 'pending' ||
      value === 'active' ||
      value === 'cancelled' ||
      value === 'used_in_draw' ||
      value === 'winner' ||
      value === 'expired'
    );
  }

  private isRewardStatus(value: unknown): value is Prisma.DropRewardEventCreateInput['status'] {
    return (
      value === 'pending' ||
      value === 'active' ||
      value === 'cancelled' ||
      value === 'rejected'
    );
  }

  private isRewardSource(value: unknown): value is Prisma.DropRewardEventCreateInput['source'] {
    return (
      value === 'verification' ||
      value === 'daily_login' ||
      value === 'host_meeting' ||
      value === 'visit_meeting' ||
      value === 'referral' ||
      value === 'subscription' ||
      value === 'boost' ||
      value === 'manual_admin'
    );
  }

  private winnerStatusForAction(action: string) {
    if (action === 'approve') return 'approved';
    if (action === 'reject') return 'rejected';
    if (action === 'deliver') return 'prize_delivered';
    if (action === 'replace') return 'prize_replaced';
    if (action === 'expire') return 'expired';
    throw new ApiError(400, 'invalid_winner_action', 'Winner action is invalid');
  }

  private normalizeTicketCount(value: unknown) {
    const parsed = typeof value === 'number' ? value : Number(value);
    const intValue = Math.trunc(parsed);
    if (!Number.isFinite(intValue) || intValue < 1 || intValue > DROPS_MAX_TICKETS_PER_MONTH) {
      throw new ApiError(400, 'invalid_drops_ticket_count', 'Ticket count is invalid');
    }
    return intValue;
  }

  private normalizeLimit(value?: number) {
    if (!Number.isFinite(value)) {
      return 50;
    }
    return Math.max(1, Math.min(Math.trunc(value!), 100));
  }

  private parseAdminLimit(value: unknown, fallback = 50) {
    const text = this.optionalText(value);
    if (!text) {
      return fallback;
    }

    const limit = Number(text);
    if (!Number.isInteger(limit) || limit < 1) {
      throw new ApiError(400, 'admin_invalid_limit', 'Limit is invalid');
    }
    return Math.min(limit, 200);
  }

  private parseAdminCursor(value: unknown) {
    const text = this.optionalText(value);
    if (!text) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(Buffer.from(text, 'base64url').toString('utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Keep every bad cursor error identical for callers.
    }

    throw new ApiError(400, 'admin_invalid_cursor', 'Cursor is invalid');
  }

  private encodeAdminCursor(cursor: Record<string, unknown>) {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  private requiredCursorDate(cursor: Record<string, unknown>, key: string) {
    const text = this.optionalText(cursor[key]);
    if (!text) {
      throw new ApiError(400, 'admin_invalid_cursor', 'Cursor is invalid');
    }

    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
      throw new ApiError(400, 'admin_invalid_cursor', 'Cursor is invalid');
    }
    return date;
  }

  private requiredCursorText(cursor: Record<string, unknown>, key: string) {
    const text = this.optionalText(cursor[key]);
    if (!text) {
      throw new ApiError(400, 'admin_invalid_cursor', 'Cursor is invalid');
    }
    return text;
  }

  private optionalText(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }

    const text = value.trim();
    return text === '' ? null : text;
  }

  private safeFileName(fileName: string) {
    const safe = fileName
      .trim()
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
    return safe || 'drop-image';
  }

  private optionalInt(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      throw new ApiError(400, 'invalid_drop_payload', 'Number is invalid');
    }
    return Math.trunc(parsed);
  }

  private getRewardService() {
    if (!this.rewardService) {
      return new DropsRewardService(this.prismaService);
    }
    return this.rewardService;
  }

  private getDrawService() {
    if (!this.drawService) {
      return new DropsDrawService(this.prismaService);
    }
    return this.drawService;
  }

  private referralSelect() {
    return {
      id: true,
      code: true,
      inviterUserId: true,
      invitedUserId: true,
      status: true,
    } satisfies Prisma.DropReferralSelect;
  }

  private mapReferral(referral: {
    code: string;
    inviterUserId: string;
    invitedUserId: string | null;
    status: string;
  }) {
    return {
      code: referral.code,
      inviterUserId: referral.inviterUserId,
      invitedUserId: referral.invitedUserId,
      status: referral.status,
    };
  }
}
