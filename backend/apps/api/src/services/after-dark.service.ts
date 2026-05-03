import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { normalizeSearchQuery } from '../common/search-query';
import {
  decodeCursor,
  encodeCursor,
  getBlockedUserIds as loadBlockedUserIds,
} from '@big-break/database';
import { formatEventTime } from '../common/presenters';
import { EventsService } from './events.service';
import { PrismaService } from './prisma.service';
import { SubscriptionService } from './subscription.service';

interface AfterDarkEventCursor {
  id: string;
  startsAt: Date;
}

@Injectable()
export class AfterDarkService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly subscriptionService: SubscriptionService,
    private readonly eventsService: EventsService,
  ) {}

  async getAccess(userId: string) {
    return this.buildAccess(userId);
  }

  async unlock(userId: string, body: Record<string, unknown>) {
    const plan = typeof body.plan === 'string' ? body.plan : '';
    if (plan !== 'month' && plan !== 'year') {
      throw new ApiError(400, 'invalid_subscription_plan', 'Subscription plan is invalid');
    }

    if (body.ageConfirmed !== true || body.codeAccepted !== true) {
      throw new ApiError(
        400,
        'after_dark_consent_required',
        'Age confirmation and code acceptance are required',
      );
    }

    const current = await this.subscriptionService.getCurrent(userId);
    if (current.status !== 'trial' && current.status !== 'active') {
      await this.subscriptionService.subscribe(userId, { plan });
    }

    const now = new Date();
    await this.prismaService.client.userSettings.upsert({
      where: { userId },
      update: {
        afterDarkAgeConfirmedAt: now,
        afterDarkCodeAcceptedAt: now,
      },
      create: {
        userId,
        afterDarkAgeConfirmedAt: now,
        afterDarkCodeAcceptedAt: now,
      },
    });

    return this.buildAccess(userId);
  }

  async listEvents(
    userId: string,
    params: { q?: string; date?: string; cursor?: string; limit?: number } = {},
  ) {
    await this.assertUnlocked(userId);
    const blockedUserIds = await this.getBlockedUserIds(userId);
    const query = normalizeSearchQuery(params.q);
    const dateRange = this.parseIsoDateRange(params.date);
    const take = this.normalizeLimit(params.limit);
    const cursorEvent = await this.resolveEventCursor(params.cursor);
    const andFilters: Prisma.EventWhereInput[] = [];

    if (query) {
      andFilters.push({
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { place: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { vibe: { contains: query, mode: 'insensitive' } },
        ],
      });
    }

    if (cursorEvent) {
      andFilters.push({
        OR: [
          {
            startsAt: {
              gt: cursorEvent.startsAt,
            },
          },
          {
            startsAt: cursorEvent.startsAt,
            id: {
              gt: cursorEvent.id,
            },
          },
        ],
      });
    }

    const events = await this.prismaService.client.event.findMany({
      where: {
        isAfterDark: true,
        hostId: {
          notIn: [...blockedUserIds],
        },
        ...(dateRange
          ? {
              startsAt: {
                gte: dateRange.start,
                lt: dateRange.end,
              },
            }
          : {}),
        ...(andFilters.length > 0 ? { AND: andFilters } : {}),
      },
      include: {
        host: {
          select: {
            verified: true,
          },
        },
        participants: {
          where: {
            userId,
          },
          select: {
            userId: true,
          },
          take: 1,
        },
        _count: {
          select: {
            participants: {
              where: {
                userId: {
                  notIn: [...blockedUserIds],
                },
              },
            },
          },
        },
        joinRequests: {
          where: { userId },
          take: 1,
          select: { status: true },
        },
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: take + 1,
    });

    const hasMore = events.length > take;
    const page = hasMore ? events.slice(0, take) : events;

    return {
      items: page.map((event) => this.mapSummary(event, userId)),
      nextCursor:
        hasMore && page.length > 0
          ? this.encodeEventCursor(page[page.length - 1]!)
          : null,
    };
  }

  async getEventDetail(userId: string, eventId: string) {
    await this.assertUnlocked(userId);
    const event = await this.loadEvent(userId, eventId);
    return this.mapDetail(event, userId);
  }

  async joinEvent(userId: string, eventId: string, body: Record<string, unknown>) {
    const access = await this.assertUnlocked(userId);
    const event = await this.loadEvent(userId, eventId);

    if (event.afterDarkCategory === 'kink' && !access.kinkVerified) {
      throw new ApiError(
        409,
        'after_dark_verification_required',
        'Verification is required for kink events',
      );
    }

    if (event.consentRequired && body.acceptedRules !== true) {
      throw new ApiError(
        400,
        'after_dark_rules_required',
        'Rules consent is required for this event',
      );
    }

    if (event.joinMode === 'request') {
      return this.eventsService.createJoinRequest(userId, eventId, {
        note: typeof body.note === 'string' ? body.note : '',
      });
    }

    return this.eventsService.joinEvent(userId, eventId);
  }

  private async buildAccess(userId: string) {
    const [settings, verification, subscription, previewCount] = await Promise.all([
      this.prismaService.client.userSettings.findUnique({
        where: { userId },
        select: {
          afterDarkAgeConfirmedAt: true,
          afterDarkCodeAcceptedAt: true,
        },
      }),
      this.prismaService.client.userVerification.findUnique({
        where: { userId },
        select: { status: true },
      }),
      this.subscriptionService.getCurrent(userId),
      this.prismaService.client.event.count({
        where: {
          isAfterDark: true,
        },
      }),
    ]);

    const ageConfirmed = settings?.afterDarkAgeConfirmedAt != null;
    const codeAccepted = settings?.afterDarkCodeAcceptedAt != null;
    const kinkVerified = verification?.status === 'verified';
    const unlocked =
      (subscription.status === 'trial' || subscription.status === 'active') &&
      ageConfirmed &&
      codeAccepted;

    return {
      unlocked,
      subscriptionStatus: subscription.status,
      plan: subscription.plan,
      ageConfirmed,
      codeAccepted,
      kinkVerified,
      previewCount,
    };
  }

  private async assertUnlocked(userId: string) {
    const access = await this.buildAccess(userId);
    if (!access.unlocked) {
      throw new ApiError(403, 'after_dark_locked', 'After Dark is locked');
    }
    return access;
  }

  private async loadEvent(userId: string, eventId: string) {
    const blockedUserIds = await this.getBlockedUserIds(userId);
    const event = await this.prismaService.client.event.findFirst({
      where: {
        id: eventId,
        isAfterDark: true,
      },
      include: {
        host: {
          select: {
            id: true,
            displayName: true,
            verified: true,
            profile: {
              select: {
                rating: true,
                meetupCount: true,
                avatarUrl: true,
              },
            },
          },
        },
        participants: {
          where: {
            userId,
          },
          select: {
            userId: true,
          },
          take: 1,
        },
        _count: {
          select: {
            participants: {
              where: {
                userId: {
                  notIn: [...blockedUserIds],
                },
              },
            },
          },
        },
        joinRequests: {
          where: { userId },
          take: 1,
          select: { status: true },
        },
        chat: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!event || blockedUserIds.has(event.hostId)) {
      throw new ApiError(404, 'after_dark_event_not_found', 'After Dark event not found');
    }

    return event;
  }

  private mapSummary(
    event: {
      id: string;
      title: string;
      emoji: string;
      startsAt: Date;
      place: string;
      distanceKm: number;
      capacity: number;
      vibe: string;
      afterDarkCategory: string | null;
      afterDarkGlow: string | null;
      dressCode: string | null;
      ageRange: string | null;
      ratioLabel: string | null;
      consentRequired: boolean;
      priceMode: string;
      priceAmountFrom: number | null;
      priceAmountTo: number | null;
      participants: Array<{ userId: string }>;
      _count?: {
        participants: number;
      };
      joinRequests: Array<{ status: string }>;
      host: { verified: boolean };
    },
    userId: string,
  ) {
    return {
      id: event.id,
      title: event.title,
      emoji: event.emoji,
      category: event.afterDarkCategory ?? 'nightlife',
      time: formatEventTime(event.startsAt),
      district: event.place,
      distanceKm: event.distanceKm,
      going: event._count?.participants ?? event.participants.length,
      capacity: event.capacity,
      ratio: event.ratioLabel ?? 'Mixed',
      ageRange: event.ageRange ?? '18+',
      dressCode: event.dressCode ?? '',
      vibe: event.vibe,
      hostVerified: event.host.verified,
      consentRequired: event.consentRequired,
      glow: event.afterDarkGlow ?? 'magenta',
      priceFrom: this.resolvePriceFrom(event.priceMode, event.priceAmountFrom, event.priceAmountTo),
      joined:
        event.participants.some((participant) => participant.userId === userId),
      joinRequestStatus: event.joinRequests[0]?.status ?? null,
    };
  }

  private mapDetail(
    event: {
      id: string;
      title: string;
      emoji: string;
      startsAt: Date;
      place: string;
      distanceKm: number;
      capacity: number;
      vibe: string;
      description: string;
      hostNote: string | null;
      afterDarkCategory: string | null;
      afterDarkGlow: string | null;
      dressCode: string | null;
      ageRange: string | null;
      ratioLabel: string | null;
      consentRequired: boolean;
      priceMode: string;
      priceAmountFrom: number | null;
      priceAmountTo: number | null;
      rules: unknown;
      hostId: string;
      participants: Array<{ userId: string }>;
      _count?: {
        participants: number;
      };
      joinRequests: Array<{ status: string }>;
      chat: { id: string } | null;
      host: {
        id: string;
        displayName: string;
        verified: boolean;
        profile: {
          rating: number;
          meetupCount: number;
          avatarUrl: string | null;
        } | null;
      };
    },
    userId: string,
  ) {
    const joined =
      event.hostId === userId ||
      event.participants.some((participant) => participant.userId === userId);

    return {
      ...this.mapSummary(event, userId),
      description: event.description,
      hostNote: event.hostNote,
      rules: this.parseRules(event.rules),
      chatId: joined ? event.chat?.id ?? null : null,
      host: {
        id: event.host.id,
        displayName: event.host.displayName,
        verified: event.host.verified,
        rating: event.host.profile?.rating ?? 0,
        meetupCount: event.host.profile?.meetupCount ?? 0,
        avatarUrl: event.host.profile?.avatarUrl ?? null,
      },
    };
  }

  private resolvePriceFrom(
    priceMode: string,
    priceAmountFrom: number | null,
    priceAmountTo: number | null,
  ) {
    if (priceMode === 'free') {
      return 0;
    }

    return priceAmountFrom ?? priceAmountTo;
  }

  private parseRules(rules: unknown) {
    if (!Array.isArray(rules)) {
      return [];
    }

    return rules.filter((item): item is string => typeof item === 'string');
  }

  private async getBlockedUserIds(userId: string) {
    return loadBlockedUserIds(this.prismaService.client, userId);
  }

  private normalizeLimit(limit?: number) {
    if (limit == null || !Number.isFinite(limit)) {
      return 20;
    }

    return Math.max(1, Math.min(Math.trunc(limit), 50));
  }

  private parseIsoDateRange(raw?: string) {
    if (!raw || raw === 'any') {
      return null;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return null;
    }

    const start = new Date(`${raw}T00:00:00.000Z`);
    if (!Number.isFinite(start.getTime())) {
      return null;
    }

    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  private async resolveEventCursor(cursor?: string): Promise<AfterDarkEventCursor | null> {
    if (!cursor) {
      return null;
    }

    let decoded: ReturnType<typeof decodeCursor> = null;
    let cursorId: string | null = null;
    try {
      decoded = decodeCursor(cursor);
      cursorId = decoded?.value ?? null;
    } catch {
      cursorId = cursor;
    }

    if (!cursorId) {
      return null;
    }

    const startsAt = this.parseCursorDate(decoded?.startsAt);
    if (startsAt) {
      return {
        id: cursorId,
        startsAt,
      };
    }

    return this.prismaService.client.event.findFirst({
      where: {
        id: cursorId,
        isAfterDark: true,
      },
      select: {
        id: true,
        startsAt: true,
      },
    });
  }

  private encodeEventCursor(event: AfterDarkEventCursor) {
    return encodeCursor({
      value: event.id,
      startsAt: event.startsAt.toISOString(),
    });
  }

  private parseCursorDate(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }

    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
}
