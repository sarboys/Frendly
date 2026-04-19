import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import {
  mapAttendanceStatus,
  mapEventSummary,
  mapLiveStatus,
  mapUserPreview,
} from '../common/presenters';
import { PrismaService } from './prisma.service';

@Injectable()
export class HostService {
  constructor(private readonly prismaService: PrismaService) {}

  async getDashboard(userId: string) {
    const [host, events, pendingRequests] = await Promise.all([
      this.prismaService.client.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      }),
      this.prismaService.client.event.findMany({
        where: { hostId: userId },
        include: {
          participants: {
            include: {
              user: {
                include: { profile: true },
              },
            },
          },
          joinRequests: {
            where: { status: 'pending' },
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
      }),
      this.prismaService.client.eventJoinRequest.findMany({
        where: {
          event: {
            hostId: userId,
          },
          status: 'pending',
        },
        include: {
          event: true,
          user: {
            include: { profile: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const averageFillRate =
      events.length === 0
        ? 0
        : Math.round(
            (events.reduce((acc, event) => acc + event.participants.length / Math.max(event.capacity, 1), 0) /
              events.length) *
              100,
          );

    return {
      stats: {
        meetupsCount: events.length,
        rating: host?.profile?.rating ?? 0,
        fillRate: averageFillRate,
      },
      pendingRequestsCount: pendingRequests.length,
      requests: pendingRequests.map((request) => this.mapRequest(request)),
      events: events.map((event) =>
        mapEventSummary({
          event,
          participants: event.participants,
          currentUserId: userId,
          liveState: event.liveState,
        }),
      ),
    };
  }

  async getHostedEvent(userId: string, eventId: string) {
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
        participants: event.participants,
        currentUserId: userId,
        liveState: event.liveState,
      }),
      chatId: event.chat?.id ?? null,
      liveStatus: mapLiveStatus(event.liveState),
      requests: event.joinRequests.map((request) =>
        this.mapRequest({
          ...request,
          event: {
            id: event.id,
            title: event.title,
          },
        }),
      ),
      attendees: event.participants.map((participant) => ({
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

    const approved = await this.prismaService.client.$transaction(async (tx) => {
      const next = await tx.eventJoinRequest.update({
        where: { id: request.id },
        data: {
          status: 'approved',
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

    const rejected = await this.prismaService.client.eventJoinRequest.update({
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

    return this.mapRequest(rejected);
  }

  async manualCheckIn(userId: string, eventId: string, targetUserId: string) {
    await this.assertHost(userId, eventId);

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
}
