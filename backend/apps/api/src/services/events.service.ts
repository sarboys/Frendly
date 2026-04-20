import { Injectable } from '@nestjs/common';
import { EventFilter } from '@big-break/contracts';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { paginateArray } from '../common/pagination';
import {
  formatEventTime,
  mapAttendanceStatus,
  mapEventSummary,
  mapJoinRequestStatus,
  mapLiveStatus,
  mapUserPreview,
} from '../common/presenters';
import { PrismaService } from './prisma.service';

type EventListRecord = Awaited<ReturnType<EventsService['loadEvents']>>[number];

@Injectable()
export class EventsService {
  constructor(private readonly prismaService: PrismaService) {}

  async listEvents(userId: string, params: { filter?: string; cursor?: string; limit?: number }) {
    const blockedUserIds = await this.getBlockedUserIds(userId);
    const events = await this.loadEvents(userId);
    const filtered = this.applyFilter(
      events.filter((event) => !blockedUserIds.has(event.hostId)),
      params.filter as EventFilter | undefined,
    );

    const mapped = filtered.map((event) =>
      mapEventSummary({
        event,
        participants: event.participants.filter(
          (participant) => !blockedUserIds.has(participant.userId),
        ),
        currentUserId: userId,
        joinRequest: event.joinRequests[0],
        attendance: event.attendances[0],
        liveState: event.liveState,
      }),
    );

    return paginateArray(mapped, params.limit ?? 20, (item) => item.id, params.cursor);
  }

  async getEventDetail(userId: string, eventId: string) {
    const blockedUserIds = await this.getBlockedUserIds(userId);
    const event = await this.prismaService.client.event.findUnique({
      where: { id: eventId },
      include: {
        host: {
          include: {
            profile: true,
          },
        },
        participants: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
        joinRequests: {
          where: { userId },
          take: 1,
        },
        attendances: {
          where: { userId },
          take: 1,
        },
        liveState: true,
        chat: true,
      },
    });

    if (!event) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    if (blockedUserIds.has(event.hostId)) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    const visibleParticipants = event.participants.filter(
      (participant) => !blockedUserIds.has(participant.userId),
    );
    const hasChatAccess =
      event.hostId === userId ||
      event.participants.some((participant) => participant.userId === userId);

    return {
      ...mapEventSummary({
        event,
        participants: visibleParticipants,
        currentUserId: userId,
        joinRequest: event.joinRequests[0],
        attendance: event.attendances[0],
        liveState: event.liveState,
      }),
      description: event.description,
      partnerName: event.partnerName,
      partnerOffer: event.partnerOffer,
      chatId: hasChatAccess ? event.chat?.id ?? null : null,
      host: {
        id: event.host.id,
        displayName: event.host.displayName,
        verified: event.host.verified,
        rating: event.host.profile?.rating ?? 0,
        meetupCount: event.host.profile?.meetupCount ?? 0,
        avatarUrl: event.host.profile?.avatarUrl ?? null,
      },
      attendees: visibleParticipants.map((participant) => ({
        id: participant.user.id,
        displayName: participant.user.displayName,
        avatarUrl: participant.user.profile?.avatarUrl ?? null,
      })),
    };
  }

  async joinEvent(userId: string, eventId: string) {
    const blockedUserIds = await this.getBlockedUserIds(userId);
    const event = await this.prismaService.client.event.findUnique({
      where: { id: eventId },
      include: { chat: true },
    });

    if (!event?.chat) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    if (blockedUserIds.has(event.hostId)) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    if (event.joinMode === 'request') {
      throw new ApiError(409, 'join_request_required', 'Join request is required for this event');
    }

    const chatId = event.chat.id;

    await this.prismaService.client.$transaction(async (tx) => {
      await tx.eventParticipant.upsert({
        where: {
          eventId_userId: {
            eventId,
            userId,
          },
        },
        update: {},
        create: {
          eventId,
          userId,
        },
      });

      await tx.eventAttendance.upsert({
        where: {
          eventId_userId: {
            eventId,
            userId,
          },
        },
        update: {
          status: 'not_checked_in',
        },
        create: {
          eventId,
          userId,
          status: 'not_checked_in',
        },
      });

      await tx.chatMember.upsert({
        where: {
          chatId_userId: {
            chatId,
            userId,
          },
        },
        update: {},
        create: {
          chatId,
          userId,
        },
      });
    });

    return this.getEventDetail(userId, eventId);
  }

  async createJoinRequest(userId: string, eventId: string, body: Record<string, unknown>) {
    const blockedUserIds = await this.getBlockedUserIds(userId);
    const event = await this.prismaService.client.event.findUnique({
      where: { id: eventId },
      include: {
        participants: {
          include: {
            user: {
              include: {
                onboarding: true,
              },
            },
          },
        },
      },
    });

    if (!event) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    if (blockedUserIds.has(event.hostId)) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    if (event.joinMode !== 'request') {
      throw new ApiError(409, 'join_request_disabled', 'Join request is not enabled for this event');
    }

    if (event.hostId === userId) {
      throw new ApiError(400, 'host_cannot_request', 'Host cannot create join request');
    }

    const existingRequest = await this.prismaService.client.eventJoinRequest.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (existingRequest?.status === 'approved') {
      throw new ApiError(
        409,
        'join_request_already_reviewed',
        'Join request is already reviewed',
      );
    }

    const note = typeof body.note === 'string' ? body.note.trim() : '';
    const compatibilityScore = await this.calculateCompatibilityScore(userId, event);

    const request = await this.prismaService.client.eventJoinRequest.upsert({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
      update: {
        note,
        status: 'pending',
        compatibilityScore,
        reviewedAt: null,
        reviewedById: null,
      },
      create: {
        eventId,
        userId,
        note,
        status: 'pending',
        compatibilityScore,
      },
    });

    return {
      id: request.id,
      eventId: request.eventId,
      status: request.status,
      note: request.note,
      compatibilityScore: request.compatibilityScore,
      createdAt: request.createdAt.toISOString(),
    };
  }

  async cancelJoinRequest(userId: string, eventId: string) {
    const request = await this.prismaService.client.eventJoinRequest.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (!request) {
      throw new ApiError(404, 'join_request_not_found', 'Join request not found');
    }

    if (request.status !== 'pending') {
      throw new ApiError(
        409,
        'join_request_already_reviewed',
        'Join request is already reviewed',
      );
    }

    const canceled = await this.prismaService.client.eventJoinRequest.update({
      where: { id: request.id },
      data: { status: 'canceled' },
    });

    return {
      id: canceled.id,
      eventId: canceled.eventId,
      status: canceled.status,
    };
  }

  async leaveEvent(userId: string, eventId: string) {
    const event = await this.prismaService.client.event.findUnique({
      where: { id: eventId },
      include: { chat: true },
    });

    if (!event?.chat) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    const chatId = event.chat.id;

    await this.prismaService.client.$transaction(async (tx) => {
      await tx.eventParticipant.deleteMany({
        where: { eventId, userId },
      });

      await tx.eventAttendance.deleteMany({
        where: { eventId, userId },
      });

      await tx.chatMember.deleteMany({
        where: { chatId, userId },
      });
    });

    return this.getEventDetail(userId, eventId);
  }

  async createEvent(userId: string, body: Record<string, unknown>) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description =
      typeof body.description === 'string' ? body.description.trim() : '';
    const emoji = typeof body.emoji === 'string' ? body.emoji : '🍷';
    const vibe = typeof body.vibe === 'string' ? body.vibe : 'Спокойно';
    const place = typeof body.place === 'string' ? body.place.trim() : '';
    const distanceKm =
      typeof body.distanceKm === 'number' ? body.distanceKm : 1.0;
    const capacity = typeof body.capacity === 'number' ? body.capacity : 8;
    const startsAtRaw =
      typeof body.startsAt === 'string' ? body.startsAt : undefined;
    const startsAt = startsAtRaw != null ? new Date(startsAtRaw) : new Date();
    const joinMode =
      body.joinMode === 'request' || body.visibility === 'private'
        ? 'request'
        : 'open';

    if (title.length === 0 || description.length === 0 || place.length === 0) {
      throw new ApiError(
        400,
        'invalid_event_payload',
        'title, description and place are required',
      );
    }

    const created = await this.prismaService.client.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          id: `ev-${randomUUID()}`,
          title,
          emoji,
          startsAt,
          place,
          distanceKm,
          vibe,
          tone:
            vibe === 'Активно'
              ? 'sage'
              : vibe === 'Свидание'
                ? 'evening'
                : 'warm',
          joinMode,
          description,
          capacity,
          hostId: userId,
          isCalm: vibe === 'Спокойно' || vibe === 'Уютно',
          isNewcomers: true,
          isDate: vibe === 'Свидание',
        },
      });

      const chat = await tx.chat.create({
        data: {
          kind: 'meetup',
          origin: 'meetup',
          title,
          emoji,
          eventId: event.id,
        },
      });

      await tx.eventParticipant.create({
        data: {
          eventId: event.id,
          userId,
        },
      });

      await tx.eventAttendance.create({
        data: {
          eventId: event.id,
          userId,
          status: 'not_checked_in',
        },
      });

      await tx.eventLiveState.create({
        data: {
          eventId: event.id,
          status: 'idle',
        },
      });

      await tx.chatMember.create({
        data: {
          chatId: chat.id,
          userId,
        },
      });

      return event;
    });

    return this.getEventDetail(userId, created.id);
  }

  async getCheckIn(userId: string, eventId: string) {
    await this.assertParticipant(userId, eventId);
    const blockedUserIds = await this.getBlockedUserIds(userId);

    const event = await this.prismaService.client.event.findUnique({
      where: { id: eventId },
      include: {
        participants: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
        attendances: true,
      },
    });

    if (!event) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    const attendanceByUserId = new Map(
      event.attendances.map((attendance) => [attendance.userId, attendance]),
    );

    return {
      eventId: event.id,
      title: event.title,
      place: event.place,
      status: mapAttendanceStatus(attendanceByUserId.get(userId)),
      code: Buffer.from(`${eventId}:${userId}`).toString('base64'),
      attendees: event.participants
        .filter((participant) => !blockedUserIds.has(participant.userId))
        .map((participant) => ({
        ...mapUserPreview(participant.user),
        attendanceStatus: mapAttendanceStatus(attendanceByUserId.get(participant.userId)),
      })),
    };
  }

  async confirmCheckIn(userId: string, eventId: string, body: Record<string, unknown>) {
    await this.assertParticipant(userId, eventId);

    const code = typeof body.code === 'string' ? body.code : undefined;
    if (code != null) {
      const expected = Buffer.from(`${eventId}:${userId}`).toString('base64');
      if (code !== expected) {
        throw new ApiError(400, 'invalid_check_in_code', 'Invalid check-in code');
      }
    }

    const attendance = await this.prismaService.client.eventAttendance.upsert({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
      update: {
        status: 'checked_in',
        checkedInAt: new Date(),
        checkedInById: userId,
        checkInMethod: 'qr',
      },
      create: {
        eventId,
        userId,
        status: 'checked_in',
        checkedInAt: new Date(),
        checkedInById: userId,
        checkInMethod: 'qr',
      },
    });

    return {
      eventId,
      userId,
      status: attendance.status,
      method: attendance.checkInMethod,
      checkedInAt: attendance.checkedInAt?.toISOString() ?? null,
    };
  }

  async getLiveMeetup(userId: string, eventId: string) {
    await this.assertParticipant(userId, eventId);
    const blockedUserIds = await this.getBlockedUserIds(userId);

    const event = await this.prismaService.client.event.findUnique({
      where: { id: eventId },
      include: {
        participants: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
        attendances: true,
        liveState: true,
        chat: true,
        stories: {
          select: {
            authorId: true,
          },
        },
      },
    });

    if (!event) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    const attendanceByUserId = new Map(
      event.attendances.map((attendance) => [attendance.userId, attendance]),
    );
    const startedAt = event.liveState?.startedAt ?? null;
    const elapsedMinutes =
      startedAt == null ? 0 : Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 60000));

    return {
      eventId: event.id,
      title: event.title,
      place: event.place,
      chatId: event.chat?.id ?? null,
      status: mapLiveStatus(event.liveState),
      startedAt: startedAt?.toISOString() ?? null,
      elapsedMinutes,
      attendees: event.participants
        .filter((participant) => !blockedUserIds.has(participant.userId))
        .map((participant) => ({
        ...mapUserPreview(participant.user),
        attendanceStatus: mapAttendanceStatus(attendanceByUserId.get(participant.userId)),
      })),
      storiesCount: event.stories.filter((story) => !blockedUserIds.has(story.authorId)).length,
    };
  }

  async getAfterParty(userId: string, eventId: string) {
    await this.assertParticipant(userId, eventId);
    const blockedUserIds = await this.getBlockedUserIds(userId);

    const event = await this.prismaService.client.event.findUnique({
      where: { id: eventId },
      include: {
        participants: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
        feedbacks: {
          where: { userId },
          take: 1,
        },
        favorites: {
          where: { sourceUserId: userId },
        },
      },
    });

    if (!event) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    const feedback = event.feedbacks[0] ?? null;

    return {
      eventId: event.id,
      title: event.title,
      emoji: event.emoji,
      saved: feedback != null,
      vibe: feedback?.vibe ?? null,
      hostRating: feedback?.hostRating ?? null,
      note: feedback?.note ?? null,
      favoriteUserIds: event.favorites
        .map((favorite) => favorite.targetUserId)
        .filter((targetUserId) => !blockedUserIds.has(targetUserId)),
      attendees: event.participants
        .filter((participant) => participant.userId !== userId)
        .filter((participant) => !blockedUserIds.has(participant.userId))
        .map((participant) => ({
          userId: participant.userId,
          displayName: participant.user.displayName,
          avatarUrl: participant.user.profile?.avatarUrl ?? null,
        })),
    };
  }

  async saveFeedback(userId: string, eventId: string, body: Record<string, unknown>) {
    await this.assertParticipant(userId, eventId);
    const blockedUserIds = await this.getBlockedUserIds(userId);

    const vibe = typeof body.vibe === 'string' ? body.vibe : 'ok';
    const hostRating =
      typeof body.hostRating === 'number'
        ? Math.max(1, Math.min(5, Math.round(body.hostRating)))
        : 5;
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    const favoriteUserIds = Array.isArray(body.favoriteUserIds)
      ? body.favoriteUserIds
          .filter((item): item is string => typeof item === 'string')
          .filter((targetUserId) => !blockedUserIds.has(targetUserId))
      : [];

    await this.prismaService.client.$transaction(async (tx) => {
      await tx.eventFeedback.upsert({
        where: {
          eventId_userId: {
            eventId,
            userId,
          },
        },
        update: {
          vibe,
          hostRating,
          note,
        },
        create: {
          eventId,
          userId,
          vibe,
          hostRating,
          note,
        },
      });

      await tx.eventFavorite.deleteMany({
        where: {
          eventId,
          sourceUserId: userId,
        },
      });

      if (favoriteUserIds.length > 0) {
        await tx.eventFavorite.createMany({
          data: favoriteUserIds.map((targetUserId) => ({
            eventId,
            sourceUserId: userId,
            targetUserId,
          })),
          skipDuplicates: true,
        });
      }
    });

    return {
      saved: true,
      favoritesCount: favoriteUserIds.length,
    };
  }

  private async loadEvents(userId: string) {
    return this.prismaService.client.event.findMany({
      include: {
        participants: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
        joinRequests: {
          where: { userId },
          take: 1,
        },
        attendances: {
          where: { userId },
          take: 1,
        },
        liveState: true,
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    });
  }

  private applyFilter(events: EventListRecord[], filter?: EventFilter) {
    switch (filter) {
      case 'now':
        return events.filter((event) => {
          const delta = Math.abs(event.startsAt.getTime() - Date.now());
          return delta <= 3 * 60 * 60 * 1000;
        });
      case 'calm':
        return events.filter((event) => event.isCalm);
      case 'newcomers':
        return events.filter((event) => event.isNewcomers);
      case 'date':
        return events.filter((event) => event.isDate);
      case 'nearby':
      default:
        return [...events].sort((left, right) => left.distanceKm - right.distanceKm);
    }
  }

  private async assertParticipant(userId: string, eventId: string) {
    const [participant, event, blockedUserIds] = await Promise.all([
      this.prismaService.client.eventParticipant.findUnique({
        where: {
          eventId_userId: {
            eventId,
            userId,
          },
        },
      }),
      this.prismaService.client.event.findUnique({
        where: { id: eventId },
        select: { hostId: true },
      }),
      this.getBlockedUserIds(userId),
    ]);

    if (!event || blockedUserIds.has(event.hostId)) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    if (!participant) {
      throw new ApiError(403, 'event_forbidden', 'You are not a participant of this event');
    }

    return participant;
  }

  private async calculateCompatibilityScore(
    userId: string,
    event: {
      hostId: string;
      participants: Array<{
        userId: string;
        user: {
          onboarding: {
            interests: unknown;
          } | null;
        };
      }>;
    },
  ) {
    const user = await this.prismaService.client.user.findUnique({
      where: { id: userId },
      include: { onboarding: true },
    });

    const ownInterests = new Set(
      Array.isArray(user?.onboarding?.interests)
        ? (user?.onboarding?.interests as string[])
        : [],
    );

    if (ownInterests.size === 0) {
      return 52;
    }

    const compareUserIds = new Set<string>([event.hostId]);
    for (const participant of event.participants) {
      compareUserIds.add(participant.userId);
    }
    compareUserIds.delete(userId);

    const compareUsers = await this.prismaService.client.user.findMany({
      where: { id: { in: [...compareUserIds] } },
      include: { onboarding: true },
    });

    const commonInterests = new Set<string>();
    for (const compareUser of compareUsers) {
      const interests = Array.isArray(compareUser.onboarding?.interests)
        ? (compareUser.onboarding!.interests as string[])
        : [];
      for (const interest of interests) {
        if (ownInterests.has(interest)) {
          commonInterests.add(interest);
        }
      }
    }

    return Math.min(95, Math.max(52, 52 + commonInterests.size * 9));
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
}
