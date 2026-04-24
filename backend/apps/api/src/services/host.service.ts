import { OUTBOX_EVENT_TYPES, decodeCursor, encodeCursor } from '@big-break/database';
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
    const [host, statsEvents, pendingRequestsCount, eventsCursor, requestsCursor] = await Promise.all([
      this.prismaService.client.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      }),
      this.prismaService.client.event.findMany({
        where: { hostId: userId },
        select: {
          id: true,
          capacity: true,
          participants: {
            where: {
              userId: {
                notIn: [...blockedUserIds],
              },
            },
            select: { id: true },
          },
        },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      }),
      this.prismaService.client.eventJoinRequest.count({
        where: {
          event: {
            hostId: userId,
          },
          status: 'pending',
          reviewedById: null,
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
        include: {
          participants: {
            include: {
              user: {
                include: { profile: true },
              },
            },
          },
          joinRequests: {
            where: { status: 'pending', reviewedById: null },
            include: {
              user: {
                include: { profile: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
          liveState: true,
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
          ...this.buildRequestCursorWhere(requestsCursor),
        },
        include: {
          event: true,
          user: {
            include: { profile: true },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: requestsTake + 1,
      }),
    ]);

    const averageFillRate =
      statsEvents.length === 0
        ? 0
        : Math.round(
            (statsEvents.reduce(
              (acc, event) =>
                acc + event.participants.length / Math.max(event.capacity, 1),
              0,
            ) /
              statsEvents.length) *
              100,
          );

    const hasMoreRequests = requestsPage.length > requestsTake;
    const requestPage = hasMoreRequests ? requestsPage.slice(0, requestsTake) : requestsPage;
    const requestItems = requestPage
      .filter((request) => !blockedUserIds.has(request.user.id))
      .map((request) => this.mapRequest(request));
    const hasMoreEvents = eventsPage.length > eventsTake;
    const eventPage = hasMoreEvents ? eventsPage.slice(0, eventsTake) : eventsPage;
    const eventItems = eventPage.map((event) =>
      mapEventSummary({
        event,
        participants: event.participants.filter(
          (participant) => !blockedUserIds.has(participant.userId),
        ),
        currentUserId: userId,
        liveState: event.liveState,
      }),
    );

    return {
      stats: {
        meetupsCount: statsEvents.length,
        rating: host?.profile?.rating ?? 0,
        fillRate: averageFillRate,
      },
      pendingRequestsCount,
      requests: requestItems,
      nextRequestsCursor:
          hasMoreRequests && requestPage.length > 0
              ? encodeCursor({ value: requestPage[requestPage.length - 1]!.id })
              : null,
      events: eventItems,
      nextEventsCursor:
          hasMoreEvents && eventPage.length > 0
              ? encodeCursor({ value: eventPage[eventPage.length - 1]!.id })
              : null,
    };
  }

  async getHostedEvent(userId: string, eventId: string) {
    const blockedUserIds = await this.getBlockedUserIds(userId);
    const event = await this.prismaService.client.event.findFirst({
      where: { id: eventId, hostId: userId },
      include: {
        participants: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
        attendances: true,
        joinRequests: {
          where: {
            reviewedById: null,
          },
          include: {
            user: {
              include: { profile: true },
            },
          },
          orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        },
        liveState: true,
        chat: true,
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

  async approveRequest(userId: string, requestId: string) {
    const request = await this.prismaService.client.eventJoinRequest.findUnique({
      where: { id: requestId },
      include: {
        event: {
          include: { chat: true },
        },
        user: {
          include: { profile: true },
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
        include: {
          event: true,
          user: {
            include: { profile: true },
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
      include: {
        event: true,
        user: {
          include: { profile: true },
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
      const next = await tx.eventJoinRequest.update({
        where: { id: requestId },
        data: {
          status: 'rejected',
          reviewedById: userId,
          reviewedAt: new Date(),
        },
        include: {
          event: true,
          user: {
            include: { profile: true },
          },
        },
      });

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
    const blocks = await this.prismaService.client.userBlock.findMany({
      where: {
        OR: [
          { userId },
          { blockedUserId: userId },
        ],
      },
      select: {
        userId: true,
        blockedUserId: true,
      },
    });

    const blockedUserIds = new Set<string>();
    for (const block of blocks) {
      if (block.userId === userId) {
        blockedUserIds.add(block.blockedUserId);
      }
      if (block.blockedUserId === userId) {
        blockedUserIds.add(block.userId);
      }
    }

    return blockedUserIds;
  }

  private normalizeLimit(limit?: number) {
    if (limit == null || !Number.isFinite(limit)) {
      return 20;
    }

    return Math.max(1, Math.min(Math.trunc(limit), 50));
  }

  private buildEventCursorWhere(
    cursor:
      | {
          id: string;
          startsAt: Date;
        }
      | null,
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
    cursor:
      | {
          id: string;
          createdAt: Date;
        }
      | null,
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

  private decodeCursor(cursor?: string) {
    if (!cursor) {
      return null;
    }

    try {
      return decodeCursor(cursor)?.value ?? null;
    } catch {
      return cursor;
    }
  }

  private async resolveEventCursor(cursor?: string) {
    const eventId = this.decodeCursor(cursor);
    if (eventId == null) {
      return null;
    }

    return this.prismaService.client.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        startsAt: true,
      },
    });
  }

  private async resolveRequestCursor(cursor?: string) {
    const requestId = this.decodeCursor(cursor);
    if (requestId == null) {
      return null;
    }

    return this.prismaService.client.eventJoinRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        createdAt: true,
      },
    });
  }
}
