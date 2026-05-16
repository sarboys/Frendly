import {
  OUTBOX_EVENT_TYPES,
  decodeCursor,
  encodeCursor,
  getBlockedUserIds as loadBlockedUserIds,
} from '@big-break/database';
import {
  EventAccessMode,
  EventGenderMode,
  EventJoinMode,
  EventLifestyle,
  EventPriceMode,
  EventVisibilityMode,
  Prisma,
} from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import {
  mapAttendanceStatus,
  mapEventSummary,
  mapLiveStatus,
  mapUserPreview,
} from '../common/presenters';
import { assertEventCapacityAvailable } from './event-capacity';
import { PrismaService } from './prisma.service';

const HOST_EVENT_PARTICIPANT_PREVIEW_LIMIT = 6;
const hostEventSummarySelect = {
  id: true,
  title: true,
  emoji: true,
  startsAt: true,
  place: true,
  distanceKm: true,
  latitude: true,
  longitude: true,
  capacity: true,
  vibe: true,
  tone: true,
  hostNote: true,
  lifestyle: true,
  priceMode: true,
  priceAmountFrom: true,
  priceAmountTo: true,
  accessMode: true,
  genderMode: true,
  visibilityMode: true,
  requiresVerification: true,
  requiresFrendlyPlus: true,
  joinMode: true,
  isDate: true,
  eveningRouteId: true,
  hostId: true,
} satisfies Prisma.EventSelect;

interface HostEventCursor {
  id: string;
  startsAt: Date;
}

interface HostRequestCursor {
  id: string;
  createdAt: Date;
}

type EventEntryRequirement = 'verification' | 'frendly_plus';

type EventEntryRequirementsInput = {
  requiresVerification?: boolean | null;
  requiresFrendlyPlus?: boolean | null;
};

@Injectable()
export class HostService {
  constructor(private readonly prismaService: PrismaService) {}

  async getDashboard(
    userId: string,
    params: {
      eventsCursor?: string;
      eventsLimit?: number;
      requestsCursor?: string;
      requestsLimit?: number;
    } = {},
  ) {
    const blockedUserIds = await this.getBlockedUserIds(userId);
    const eventsTake = this.normalizeLimit(params.eventsLimit);
    const requestsTake = this.normalizeLimit(params.requestsLimit);
    const [host, dashboardStats, pendingRequestsCount, eventsCursor, requestsCursor] = await Promise.all([
      this.prismaService.client.user.findUnique({
        where: { id: userId },
        select: {
          profile: {
            select: {
              rating: true,
            },
          },
        },
      }),
      this.loadDashboardStats(userId, blockedUserIds),
      this.prismaService.client.eventJoinRequest.count({
        where: {
          event: {
            hostId: userId,
          },
          status: 'pending',
          reviewedById: null,
          userId: {
            notIn: [...blockedUserIds],
          },
        },
      }),
      this.resolveEventCursor(params.eventsCursor),
      this.resolveRequestCursor(params.requestsCursor),
    ]);
    const [eventsPage, requestsPage] = await Promise.all([
      this.prismaService.client.event.findMany({
        where: {
          hostId: userId,
          ...this.buildEventCursorWhere(eventsCursor),
        },
        select: {
          ...hostEventSummarySelect,
          participants: {
            where: {
              userId: {
                notIn: [...blockedUserIds],
              },
            },
            select: {
              userId: true,
              user: {
                select: {
                  displayName: true,
                },
              },
            },
            take: HOST_EVENT_PARTICIPANT_PREVIEW_LIMIT,
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
          liveState: {
            select: {
              status: true,
            },
          },
        },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        take: eventsTake + 1,
      }),
      this.prismaService.client.eventJoinRequest.findMany({
        where: {
          event: {
            hostId: userId,
          },
          status: 'pending',
          reviewedById: null,
          userId: {
            notIn: [...blockedUserIds],
          },
          ...this.buildRequestCursorWhere(requestsCursor),
        },
        select: {
          id: true,
          eventId: true,
          note: true,
          status: true,
          compatibilityScore: true,
          createdAt: true,
          reviewedAt: true,
          event: {
            select: {
              id: true,
              title: true,
            },
          },
          user: {
            select: {
              id: true,
              displayName: true,
              profile: {
                select: {
                  avatarUrl: true,
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: requestsTake + 1,
      }),
    ]);

    const hasMoreRequests = requestsPage.length > requestsTake;
    const requestPage = hasMoreRequests ? requestsPage.slice(0, requestsTake) : requestsPage;
    const requestItems = requestPage.map((request) => this.mapRequest(request));
    const hasMoreEvents = eventsPage.length > eventsTake;
    const eventPage = hasMoreEvents ? eventsPage.slice(0, eventsTake) : eventsPage;
    const eventItems = eventPage.map((event) =>
      mapEventSummary({
        event,
        participants: event.participants.filter(
          (participant) => !blockedUserIds.has(participant.userId),
        ),
        currentUserId: userId,
        participantCount: event._count.participants,
        liveState: event.liveState,
      }),
    );

    return {
      stats: {
        meetupsCount: dashboardStats.meetupsCount,
        rating: host?.profile?.rating ?? 0,
        fillRate: dashboardStats.fillRate,
      },
      pendingRequestsCount,
      requests: requestItems,
      nextRequestsCursor:
          hasMoreRequests && requestPage.length > 0
              ? this.encodeRequestCursor(requestPage[requestPage.length - 1]!)
              : null,
      events: eventItems,
      nextEventsCursor:
          hasMoreEvents && eventPage.length > 0
              ? this.encodeEventCursor(eventPage[eventPage.length - 1]!)
              : null,
    };
  }

  private async loadDashboardStats(userId: string, blockedUserIds: Set<string>) {
    const blockedParticipantFilter = blockedUserIds.size === 0
      ? Prisma.empty
      : Prisma.sql`AND ep."userId" NOT IN (${Prisma.join([...blockedUserIds])})`;

    const rows = await this.prismaService.client.$queryRaw<Array<{
      meetups_count: bigint | number;
      fill_rate: bigint | number | string | null;
    }>>`
      SELECT
        COUNT(e."id") AS meetups_count,
        COALESCE(
          ROUND(
            AVG(
              COALESCE(participants."participantCount", 0)::numeric
              / GREATEST(e."capacity", 1)
            ) * 100
          ),
          0
        ) AS fill_rate
      FROM "Event" e
      LEFT JOIN LATERAL (
        SELECT COUNT(ep."id") AS "participantCount"
        FROM "EventParticipant" ep
        WHERE ep."eventId" = e."id"
          ${blockedParticipantFilter}
      ) participants ON true
      WHERE e."hostId" = ${userId}
    `;

    const row = rows[0];

    return {
      meetupsCount: Number(row?.meetups_count ?? 0),
      fillRate: Number(row?.fill_rate ?? 0),
    };
  }

  async getHostedEvent(userId: string, eventId: string) {
    const blockedUserIds = await this.getBlockedUserIds(userId);
    const event = await this.prismaService.client.event.findFirst({
      where: { id: eventId, hostId: userId },
      select: {
        ...hostEventSummarySelect,
        participants: {
          where: {
            userId: {
              notIn: [...blockedUserIds],
            },
          },
          select: {
            userId: true,
            user: {
              select: {
                id: true,
                displayName: true,
                verified: true,
                online: true,
                profile: {
                  select: {
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        attendances: {
          where: {
            userId: {
              notIn: [...blockedUserIds],
            },
          },
          select: {
            userId: true,
            status: true,
            checkedInAt: true,
          },
        },
        joinRequests: {
          where: {
            status: 'pending',
            reviewedById: null,
            userId: {
              notIn: [...blockedUserIds],
            },
          },
          select: {
            id: true,
            eventId: true,
            userId: true,
            note: true,
            status: true,
            compatibilityScore: true,
            createdAt: true,
            reviewedAt: true,
            user: {
              select: {
                id: true,
                displayName: true,
                profile: {
                  select: {
                    avatarUrl: true,
                  },
                },
              },
            },
          },
          orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
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
        liveState: {
          select: {
            status: true,
          },
        },
        chat: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!event) {
      throw new ApiError(404, 'host_event_not_found', 'Hosted event not found');
    }

    const attendanceByUserId = new Map(
      event.attendances.map((attendance) => [attendance.userId, attendance]),
    );

    return {
      event: mapEventSummary({
        event,
        participants: event.participants.filter(
          (participant) => !blockedUserIds.has(participant.userId),
        ),
        currentUserId: userId,
        participantCount: event._count.participants,
        liveState: event.liveState,
      }),
      chatId: event.chat?.id ?? null,
      liveStatus: mapLiveStatus(event.liveState),
      requests: event.joinRequests
        .filter((request) => !blockedUserIds.has(request.userId))
        .map((request) =>
          this.mapRequest({
            ...request,
            event: {
              id: event.id,
              title: event.title,
            },
          }),
        ),
      attendees: event.participants
        .filter((participant) => !blockedUserIds.has(participant.userId))
        .map((participant) => ({
        ...mapUserPreview(participant.user),
        attendanceStatus: mapAttendanceStatus(attendanceByUserId.get(participant.userId)),
        checkedInAt:
          attendanceByUserId.get(participant.userId)?.checkedInAt?.toISOString() ?? null,
      })),
    };
  }

  async updateHostedEvent(
    userId: string,
    eventId: string,
    body: Record<string, unknown>,
  ) {
    const event = await this.prismaService.client.event.findFirst({
      where: { id: eventId, hostId: userId },
      select: {
        id: true,
        _count: {
          select: {
            participants: true,
          },
        },
      },
    });

    if (!event) {
      throw new ApiError(404, 'host_event_not_found', 'Hosted event not found');
    }

    const data = this.parseHostedEventUpdate(body);
    await this.assertHostCanUseEntryRequirements(userId, data);
    if (
      data.capacity != null &&
      typeof data.capacity === 'number' &&
      data.capacity < event._count.participants
    ) {
      throw new ApiError(409, 'event_capacity_below_participants', 'Capacity is below participant count');
    }

    await this.prismaService.client.event.update({
      where: { id: event.id },
      data,
    });

    return this.getHostedEvent(userId, event.id);
  }

  async approveRequest(userId: string, requestId: string) {
    const request = await this.prismaService.client.eventJoinRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        eventId: true,
        userId: true,
        status: true,
        event: {
          select: {
            hostId: true,
            title: true,
            requiresVerification: true,
            requiresFrendlyPlus: true,
            chat: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!request || request.event.hostId !== userId) {
      throw new ApiError(404, 'join_request_not_found', 'Join request not found');
    }

    const blockedUserIds = await this.getBlockedUserIds(userId);
    if (blockedUserIds.has(request.userId)) {
      throw new ApiError(404, 'join_request_not_found', 'Join request not found');
    }

    if (request.status !== 'pending') {
      throw new ApiError(
        409,
        'join_request_already_reviewed',
        'Join request is already reviewed',
      );
    }
    await this.assertUserMeetsEntryRequirements(request.userId, request.event);

    const approved = await this.prismaService.client.$transaction(async (tx) => {
      const reviewed = await tx.eventJoinRequest.updateMany({
        where: {
          id: request.id,
          status: 'pending',
        },
        data: {
          status: 'approved',
          reviewedById: userId,
          reviewedAt: new Date(),
        },
      });

      if (reviewed.count === 0) {
        throw new ApiError(
          409,
          'join_request_already_reviewed',
          'Join request is already reviewed',
        );
      }

      await assertEventCapacityAvailable(tx, request.eventId);

      const next = await tx.eventJoinRequest.findUnique({
        where: { id: request.id },
        select: {
          id: true,
          eventId: true,
          note: true,
          status: true,
          compatibilityScore: true,
          createdAt: true,
          reviewedAt: true,
          event: {
            select: {
              id: true,
              title: true,
            },
          },
          user: {
            select: {
              id: true,
              displayName: true,
              profile: {
                select: {
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      if (next == null) {
        throw new ApiError(404, 'join_request_not_found', 'Join request not found');
      }

      await tx.eventParticipant.upsert({
        where: {
          eventId_userId: {
            eventId: request.eventId,
            userId: request.userId,
          },
        },
        update: {},
        create: {
          eventId: request.eventId,
          userId: request.userId,
        },
      });

      await tx.eventAttendance.upsert({
        where: {
          eventId_userId: {
            eventId: request.eventId,
            userId: request.userId,
          },
        },
        update: {
          status: 'not_checked_in',
        },
        create: {
          eventId: request.eventId,
          userId: request.userId,
          status: 'not_checked_in',
        },
      });

      if (request.event.chat != null) {
        await tx.chatMember.upsert({
          where: {
            chatId_userId: {
              chatId: request.event.chat.id,
              userId: request.userId,
            },
          },
          update: {},
          create: {
            chatId: request.event.chat.id,
            userId: request.userId,
          },
        });
      }

      const notification = await tx.notification.create({
        data: {
          userId: request.userId,
          actorUserId: userId,
          kind: 'event_joined',
          title: 'Заявка одобрена',
          body: `Тебя приняли на встречу «${request.event.title}»`,
          eventId: request.eventId,
          requestId: request.id,
          payload: {
            eventId: request.eventId,
            requestId: request.id,
            status: 'approved',
            userId,
          },
        },
        select: {
          id: true,
        },
      });

      await tx.outboxEvent.createMany({
        data: [
          {
            type: OUTBOX_EVENT_TYPES.pushDispatch,
            payload: {
              userId: request.userId,
              notificationId: notification.id,
            },
          },
          {
            type: OUTBOX_EVENT_TYPES.notificationCreate,
            payload: {
              notificationId: notification.id,
            },
          },
        ],
      });

      return next;
    });

    return this.mapRequest(approved);
  }

  async rejectRequest(userId: string, requestId: string) {
    const request = await this.prismaService.client.eventJoinRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        eventId: true,
        userId: true,
        status: true,
        event: {
          select: {
            hostId: true,
            title: true,
          },
        },
      },
    });

    if (!request || request.event.hostId !== userId) {
      throw new ApiError(404, 'join_request_not_found', 'Join request not found');
    }

    const blockedUserIds = await this.getBlockedUserIds(userId);
    if (blockedUserIds.has(request.userId)) {
      throw new ApiError(404, 'join_request_not_found', 'Join request not found');
    }

    if (request.status !== 'pending') {
      throw new ApiError(
        409,
        'join_request_already_reviewed',
        'Join request is already reviewed',
      );
    }

    const rejected = await this.prismaService.client.$transaction(async (tx) => {
      const reviewed = await tx.eventJoinRequest.updateMany({
        where: {
          id: requestId,
          status: 'pending',
        },
        data: {
          status: 'rejected',
          reviewedById: userId,
          reviewedAt: new Date(),
        },
      });
      if (reviewed.count === 0) {
        throw new ApiError(
          409,
          'join_request_already_reviewed',
          'Join request is already reviewed',
        );
      }

      const next = await tx.eventJoinRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          eventId: true,
          note: true,
          status: true,
          compatibilityScore: true,
          createdAt: true,
          reviewedAt: true,
          event: {
            select: {
              id: true,
              title: true,
            },
          },
          user: {
            select: {
              id: true,
              displayName: true,
              profile: {
                select: {
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });
      if (!next) {
        throw new ApiError(404, 'join_request_not_found', 'Join request not found');
      }

      const notification = await tx.notification.create({
        data: {
          userId: request.userId,
          actorUserId: userId,
          kind: 'event_joined',
          title: 'Заявка отклонена',
          body: `Заявку на встречу «${request.event.title}» отклонили`,
          eventId: request.eventId,
          requestId: request.id,
          payload: {
            eventId: request.eventId,
            requestId: request.id,
            status: 'rejected',
            userId,
          },
        },
        select: {
          id: true,
        },
      });

      await tx.outboxEvent.createMany({
        data: [
          {
            type: OUTBOX_EVENT_TYPES.pushDispatch,
            payload: {
              userId: request.userId,
              notificationId: notification.id,
            },
          },
          {
            type: OUTBOX_EVENT_TYPES.notificationCreate,
            payload: {
              notificationId: notification.id,
            },
          },
        ],
      });

      return next;
    });

    return this.mapRequest(rejected);
  }

  async manualCheckIn(userId: string, eventId: string, targetUserId: string) {
    await this.assertHost(userId, eventId);

    const blockedUserIds = await this.getBlockedUserIds(userId);
    if (blockedUserIds.has(targetUserId)) {
      throw new ApiError(404, 'event_participant_not_found', 'Participant not found');
    }

    const participant = await this.prismaService.client.eventParticipant.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId: targetUserId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!participant) {
      throw new ApiError(404, 'event_participant_not_found', 'Participant not found');
    }

    const attendance = await this.prismaService.client.eventAttendance.upsert({
      where: {
        eventId_userId: {
          eventId,
          userId: targetUserId,
        },
      },
      update: {
        status: 'checked_in',
        checkedInAt: new Date(),
        checkedInById: userId,
        checkInMethod: 'host_manual',
      },
      create: {
        eventId,
        userId: targetUserId,
        status: 'checked_in',
        checkedInAt: new Date(),
        checkedInById: userId,
        checkInMethod: 'host_manual',
      },
      select: {
        status: true,
        checkInMethod: true,
        checkedInAt: true,
      },
    });

    return {
      eventId,
      userId: targetUserId,
      status: attendance.status,
      method: attendance.checkInMethod,
      checkedInAt: attendance.checkedInAt?.toISOString() ?? null,
    };
  }

  async startLive(userId: string, eventId: string) {
    await this.assertHost(userId, eventId);

    const liveState = await this.prismaService.client.eventLiveState.upsert({
      where: { eventId },
      update: {
        status: 'live',
        startedAt: new Date(),
        finishedAt: null,
      },
      create: {
        eventId,
        status: 'live',
        startedAt: new Date(),
      },
    });

    return {
      eventId,
      status: liveState.status,
      startedAt: liveState.startedAt?.toISOString() ?? null,
      finishedAt: liveState.finishedAt?.toISOString() ?? null,
    };
  }

  async finishLive(userId: string, eventId: string) {
    await this.assertHost(userId, eventId);

    const liveState = await this.prismaService.client.eventLiveState.upsert({
      where: { eventId },
      update: {
        status: 'finished',
        finishedAt: new Date(),
      },
      create: {
        eventId,
        status: 'finished',
        finishedAt: new Date(),
      },
    });

    return {
      eventId,
      status: liveState.status,
      startedAt: liveState.startedAt?.toISOString() ?? null,
      finishedAt: liveState.finishedAt?.toISOString() ?? null,
    };
  }

  private async assertHost(userId: string, eventId: string) {
    const event = await this.prismaService.client.event.findFirst({
      where: { id: eventId, hostId: userId },
    });

    if (!event) {
      throw new ApiError(404, 'host_event_not_found', 'Hosted event not found');
    }

    return event;
  }

  private async resolveEventEntryRequirements(
    userId: string,
    requirements: EventEntryRequirementsInput,
  ) {
    const requiresVerification = requirements.requiresVerification === true;
    const requiresFrendlyPlus = requirements.requiresFrendlyPlus === true;

    const [user, hasPlus] = await Promise.all([
      requiresVerification
        ? this.prismaService.client.user.findUnique({
            where: { id: userId },
            select: {
              verified: true,
              verification: {
                select: {
                  status: true,
                },
              },
            },
          })
        : Promise.resolve(null),
      requiresFrendlyPlus
        ? this.hasFrendlyPlus(userId)
        : Promise.resolve(null),
    ]);

    const verified = user?.verified === true || user?.verification?.status === 'verified';
    const missing: EventEntryRequirement[] = [];
    if (requiresVerification && !verified) {
      missing.push('verification');
    }
    if (requiresFrendlyPlus && hasPlus !== true) {
      missing.push('frendly_plus');
    }

    return {
      canJoin: missing.length === 0,
      missing,
    };
  }

  private async assertHostCanUseEntryRequirements(
    userId: string,
    requirements: EventEntryRequirementsInput,
  ) {
    const state = await this.resolveEventEntryRequirements(userId, requirements);
    if (state.missing.includes('verification')) {
      throw new ApiError(
        403,
        'event_host_verification_required',
        'Host must be verified to require verification',
      );
    }
    if (state.missing.includes('frendly_plus')) {
      throw new ApiError(
        403,
        'event_host_plus_required',
        'Host must have Frendly Plus to require Frendly Plus',
      );
    }
  }

  private async assertUserMeetsEntryRequirements(
    userId: string,
    requirements: EventEntryRequirementsInput,
  ) {
    const state = await this.resolveEventEntryRequirements(userId, requirements);
    if (!state.canJoin) {
      throw new ApiError(
        403,
        'event_entry_requirements_not_met',
        'Event entry requirements are not met',
        { missing: state.missing },
      );
    }
  }

  private async hasFrendlyPlus(userId: string) {
    const subscription = await this.prismaService.client.userSubscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        status: true,
        renewsAt: true,
        trialEndsAt: true,
      },
    });
    const status = this.resolveSubscriptionStatus(subscription);
    return status === 'trial' || status === 'active';
  }

  private resolveSubscriptionStatus(
    subscription: {
      status: 'inactive' | 'trial' | 'active' | 'canceled';
      renewsAt: Date | null;
      trialEndsAt: Date | null;
    } | null,
  ) {
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
    return 'inactive';
  }

  private mapRequest(
    request: {
      id: string;
      eventId: string;
      note: string | null;
      status: 'pending' | 'approved' | 'rejected' | 'canceled';
      compatibilityScore: number;
      createdAt: Date;
      reviewedAt: Date | null;
      event: { id: string; title: string };
      user: { id: string; displayName: string; profile: { avatarUrl: string | null } | null };
    },
  ) {
    return {
      id: request.id,
      eventId: request.eventId,
      eventTitle: request.event.title,
      note: request.note,
      status: request.status,
      compatibilityScore: request.compatibilityScore,
      createdAt: request.createdAt.toISOString(),
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
      userId: request.user.id,
      userName: request.user.displayName,
      avatarUrl: request.user.profile?.avatarUrl ?? null,
    };
  }

  private async getBlockedUserIds(userId: string) {
    return loadBlockedUserIds(this.prismaService.client, userId);
  }

  private parseHostedEventUpdate(body: Record<string, unknown>) {
    const title = this.requiredText(body.title, 'host_event_title_required');
    const description = this.requiredText(body.description, 'host_event_description_required');
    const emoji = this.requiredText(body.emoji, 'host_event_emoji_required');
    const vibe = this.requiredText(body.vibe, 'host_event_vibe_required');
    const place = this.requiredText(body.place, 'host_event_place_required');
    const startsAt = this.requiredDate(body.startsAt, 'host_event_starts_at_invalid');
    const capacity = this.intRange(body.capacity, 1, 1000, 'host_event_capacity_invalid');
    const visibilityMode = this.parseVisibilityMode(body.visibilityMode);
    const accessMode = this.parseAccessMode(body.accessMode, visibilityMode);
    const joinMode = this.parseJoinMode(body.joinMode, visibilityMode, accessMode);

    return {
      title,
      description,
      emoji,
      vibe,
      place,
      startsAt,
      capacity,
      lifestyle: this.parseLifestyle(body.lifestyle),
      priceMode: this.parsePriceMode(body.priceMode),
      priceAmountFrom: this.optionalInt(body.priceAmountFrom),
      priceAmountTo: this.optionalInt(body.priceAmountTo),
      accessMode,
      genderMode: this.parseGenderMode(body.genderMode),
      visibilityMode,
      requiresVerification: body.requiresVerification === true,
      requiresFrendlyPlus: body.requiresFrendlyPlus === true,
      joinMode,
      distanceKm: this.optionalNumber(body.distanceKm) ?? 1,
      latitude: this.optionalCoordinate(body.latitude, -90, 90, 'host_event_latitude_invalid'),
      longitude: this.optionalCoordinate(body.longitude, -180, 180, 'host_event_longitude_invalid'),
      tone:
        vibe === 'Активно'
          ? 'sage'
          : vibe === 'Свидание'
            ? 'evening'
            : 'warm',
      isCalm: vibe === 'Спокойно' || vibe === 'Уютно',
      isDate: vibe === 'Свидание',
    } satisfies Prisma.EventUpdateInput;
  }

  private requiredText(value: unknown, code: string) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new ApiError(400, code, 'Text is required');
    }
    return value.trim();
  }

  private requiredDate(value: unknown, code: string) {
    if (typeof value !== 'string') {
      throw new ApiError(400, code, 'Date is invalid');
    }
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) {
      throw new ApiError(400, code, 'Date is invalid');
    }
    return date;
  }

  private intRange(value: unknown, min: number, max: number, code: string) {
    const parsed = typeof value === 'number' ? value : Number(value);
    const intValue = Math.trunc(parsed);
    if (!Number.isFinite(intValue) || intValue < min || intValue > max) {
      throw new ApiError(400, code, 'Number is invalid');
    }
    return intValue;
  }

  private optionalInt(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    return this.intRange(value, 0, 1_000_000, 'host_event_number_invalid');
  }

  private optionalNumber(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      throw new ApiError(400, 'host_event_number_invalid', 'Number is invalid');
    }
    return parsed;
  }

  private optionalCoordinate(value: unknown, min: number, max: number, code: string) {
    const parsed = this.optionalNumber(value);
    if (parsed == null) {
      return null;
    }
    if (parsed < min || parsed > max) {
      throw new ApiError(400, code, 'Coordinate is invalid');
    }
    return parsed;
  }

  private parseLifestyle(value: unknown) {
    if (
      value === EventLifestyle.zozh ||
      value === EventLifestyle.neutral ||
      value === EventLifestyle.anti
    ) {
      return value;
    }
    return EventLifestyle.neutral;
  }

  private parsePriceMode(value: unknown) {
    if (
      value === EventPriceMode.free ||
      value === EventPriceMode.fixed ||
      value === EventPriceMode.from ||
      value === EventPriceMode.upto ||
      value === EventPriceMode.range ||
      value === EventPriceMode.split ||
      value === EventPriceMode.host_pays ||
      value === EventPriceMode.fifty_fifty
    ) {
      return value;
    }
    return EventPriceMode.free;
  }

  private parseAccessMode(value: unknown, visibilityMode: EventVisibilityMode) {
    if (
      value === EventAccessMode.open ||
      value === EventAccessMode.request ||
      value === EventAccessMode.free
    ) {
      return visibilityMode === EventVisibilityMode.friends
        ? EventAccessMode.request
        : value;
    }
    return visibilityMode === EventVisibilityMode.friends
      ? EventAccessMode.request
      : EventAccessMode.open;
  }

  private parseGenderMode(value: unknown) {
    if (
      value === EventGenderMode.all ||
      value === EventGenderMode.male ||
      value === EventGenderMode.female
    ) {
      return value;
    }
    return EventGenderMode.all;
  }

  private parseVisibilityMode(value: unknown) {
    if (value === EventVisibilityMode.friends) {
      return EventVisibilityMode.friends;
    }
    return EventVisibilityMode.public;
  }

  private parseJoinMode(
    value: unknown,
    visibilityMode: EventVisibilityMode,
    accessMode: EventAccessMode,
  ) {
    if (
      value === EventJoinMode.request ||
      visibilityMode === EventVisibilityMode.friends ||
      accessMode === EventAccessMode.request
    ) {
      return EventJoinMode.request;
    }
    return EventJoinMode.open;
  }

  private normalizeLimit(limit?: number) {
    if (limit == null || !Number.isFinite(limit)) {
      return 20;
    }

    return Math.max(1, Math.min(Math.trunc(limit), 50));
  }

  private buildEventCursorWhere(
    cursor: HostEventCursor | null,
  ) {
    if (cursor == null) {
      return {};
    }

    return {
      OR: [
        {
          startsAt: {
            gt: cursor.startsAt,
          },
        },
        {
          startsAt: cursor.startsAt,
          id: {
            gt: cursor.id,
          },
        },
      ],
    };
  }

  private buildRequestCursorWhere(
    cursor: HostRequestCursor | null,
  ) {
    if (cursor == null) {
      return {};
    }

    return {
      OR: [
        {
          createdAt: {
            gt: cursor.createdAt,
          },
        },
        {
          createdAt: cursor.createdAt,
          id: {
            gt: cursor.id,
          },
        },
      ],
    };
  }

  private decodeCursorPayload(cursor?: string) {
    if (!cursor) {
      return null;
    }

    try {
      const decoded = decodeCursor(cursor);
      if (decoded?.value) {
        return decoded;
      }
    } catch {
      return { value: cursor };
    }

    return null;
  }

  private async resolveEventCursor(cursor?: string): Promise<HostEventCursor | null> {
    const decoded = this.decodeCursorPayload(cursor);
    if (decoded == null) {
      return null;
    }

    const startsAt = this.parseCursorDate(decoded.startsAt);
    if (startsAt) {
      return {
        id: decoded.value,
        startsAt,
      };
    }

    return this.prismaService.client.event.findUnique({
      where: { id: decoded.value },
      select: {
        id: true,
        startsAt: true,
      },
    });
  }

  private async resolveRequestCursor(cursor?: string): Promise<HostRequestCursor | null> {
    const decoded = this.decodeCursorPayload(cursor);
    if (decoded == null) {
      return null;
    }

    const createdAt = this.parseCursorDate(decoded.createdAt);
    if (createdAt) {
      return {
        id: decoded.value,
        createdAt,
      };
    }

    return this.prismaService.client.eventJoinRequest.findUnique({
      where: { id: decoded.value },
      select: {
        id: true,
        createdAt: true,
      },
    });
  }

  private encodeEventCursor(event: HostEventCursor) {
    return encodeCursor({
      value: event.id,
      startsAt: event.startsAt.toISOString(),
    });
  }

  private encodeRequestCursor(request: HostRequestCursor) {
    return encodeCursor({
      value: request.id,
      createdAt: request.createdAt.toISOString(),
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
