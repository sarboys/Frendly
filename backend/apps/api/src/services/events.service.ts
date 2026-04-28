import { Injectable } from '@nestjs/common';
import {
  EventAccessFilter,
  EventFilter,
  EventGenderFilter,
  EventLifestyleFilter,
  EventPriceFilter,
} from '@big-break/contracts';
import { Prisma } from '@prisma/client';
import { createHmac, randomUUID } from 'node:crypto';
import {
  OUTBOX_EVENT_TYPES,
  decodeCursor,
  encodeCursor,
  getBlockedUserIds as loadBlockedUserIds,
} from '@big-break/database';
import { ApiError } from '../common/api-error';
import {
  formatEventTime,
  mapAttendanceStatus,
  mapEventSummary,
  mapLiveStatus,
  mapMessage,
  mapUserPreview,
} from '../common/presenters';
import { normalizeSearchQuery } from '../common/search-query';
import { assertEventCapacityAvailable } from './event-capacity';
import { PrismaService } from './prisma.service';
import { SubscriptionService } from './subscription.service';

type EventGeoPoint = {
  latitude: number;
  longitude: number;
};

type EventGeoBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

type EventGeoQuery = {
  center?: EventGeoPoint;
  bounds?: EventGeoBounds;
};

type EventViewerState = {
  isParticipant?: boolean;
  hasAttendance?: boolean;
};

type PostgisEventCandidate = {
  eventId: string;
  distanceKm: number;
};

type EventListCursor = {
  id: string;
  distanceKm: number;
  startsAt: Date;
};

const EARTH_RADIUS_KM = 6371;
const EVENT_DETAIL_ATTENDEE_LIMIT = 24;

@Injectable()
export class EventsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async listEvents(
    userId: string,
    params: {
      filter?: string;
      q?: string;
      lifestyle?: string;
      price?: string;
      gender?: string;
      access?: string;
      cursor?: string;
      limit?: number;
      latitude?: number;
      longitude?: number;
      radiusKm?: number;
      southWestLatitude?: number;
      southWestLongitude?: number;
      northEastLatitude?: number;
      northEastLongitude?: number;
    },
  ) {
    const [blockedUserIds, userGender] = await Promise.all([
      this.getBlockedUserIds(userId),
      this.getUserGender(userId),
    ]);
    const take = this.normalizeListLimit(params.limit);
    const filter = params.filter as EventFilter | undefined;
    const geoQuery = this.normalizeEventGeoQuery(params);
    const where = this.buildListWhere(
      userId,
      blockedUserIds,
      userGender,
      filter,
      {
        q: params.q,
        lifestyle: params.lifestyle as EventLifestyleFilter | undefined,
        price: params.price as EventPriceFilter | undefined,
        gender: params.gender as EventGenderFilter | undefined,
        access: params.access as EventAccessFilter | undefined,
      },
      geoQuery?.bounds,
    );
    const cursorEvent = await this.resolveListCursor(params.cursor, filter);
    const cursorWhere = this.buildListCursorWhere(cursorEvent, filter);

    if (cursorWhere) {
      const conditions = (where.AND as Prisma.EventWhereInput[] | undefined) ?? [];
      where.AND = [...conditions, cursorWhere];
    }

    const postgisCandidates = await this.loadPostgisEventCandidates({
      geoQuery,
      cursor: params.cursor,
      take,
      radiusKm: params.radiusKm,
      blockedUserIds,
    });
    if (postgisCandidates != null && postgisCandidates.length === 0) {
      return {
        items: [],
        nextCursor: null,
      };
    }

    const postgisDistanceByEventId = new Map(
      (postgisCandidates ?? []).map((candidate) => [
        candidate.eventId,
        candidate.distanceKm,
      ]),
    );

    if (postgisCandidates != null) {
      const conditions = (where.AND as Prisma.EventWhereInput[] | undefined) ?? [];
      const candidateIds = postgisCandidates.map((candidate) => candidate.eventId);
      where.AND = [
        ...conditions,
        {
          id: {
            in: candidateIds,
          },
        },
      ];
    }

    const events = await this.prismaService.client.event.findMany({
      where,
      include: {
        participants: {
          where: {
            userId: {
              notIn: [...blockedUserIds],
            },
          },
          include: {
            user: {
              select: {
                displayName: true,
              },
            },
          },
          orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
          take: 6,
        },
        joinRequests: {
          where: { userId },
          take: 1,
          select: { status: true },
        },
        attendances: {
          where: { userId },
          take: 1,
          select: { status: true },
        },
        liveState: {
          select: { status: true },
        },
      },
      orderBy: this.listOrderBy(filter, postgisCandidates == null ? geoQuery : undefined),
      take: postgisCandidates == null
        ? this.listTake(take, geoQuery)
        : postgisCandidates.length,
    });

    const orderedEvents = postgisCandidates == null
      ? this.orderEventsByGeo(events, geoQuery)
      : this.orderEventsByPostgisCandidates(events, postgisCandidates);
    const hasMore = orderedEvents.length > take;
    const page = hasMore ? orderedEvents.slice(0, take) : orderedEvents;
    const pageEventIds = page.map((event) => event.id);
    const [participantCounts, currentParticipations] =
      pageEventIds.length === 0
        ? [[], []]
        : await Promise.all([
            this.prismaService.client.eventParticipant.groupBy({
              by: ['eventId'],
              where: {
                eventId: {
                  in: pageEventIds,
                },
                userId: {
                  notIn: [...blockedUserIds],
                },
              },
              _count: {
                _all: true,
              },
            }),
            this.prismaService.client.eventParticipant.findMany({
              where: {
                eventId: {
                  in: pageEventIds,
                },
                userId,
              },
              select: {
                eventId: true,
              },
            }),
          ]);
    const participantCountByEventId = new Map(
      participantCounts.map((item) => [item.eventId, item._count._all]),
    );
    const joinedEventIds = new Set(
      currentParticipations.map((item) => item.eventId),
    );

    const mapped = page.map((event) =>
      mapEventSummary({
        event: this.eventWithGeoDistance(
          event,
          geoQuery,
          postgisDistanceByEventId.get(event.id),
        ),
        participants: event.participants,
        currentUserId: userId,
        participantCount: participantCountByEventId.get(event.id),
        joined: joinedEventIds.has(event.id),
        joinRequest: event.joinRequests[0],
        attendance: event.attendances[0],
        liveState: event.liveState,
      }),
    );

    return {
      items: mapped,
      nextCursor:
        hasMore && page.length > 0
          ? this.encodeListCursor(page[page.length - 1]!)
          : null,
    };
  }

  async getEventDetail(userId: string, eventId: string) {
    const [blockedUserIds, userGender] = await Promise.all([
      this.getBlockedUserIds(userId),
      this.getUserGender(userId),
    ]);
    const visibleParticipantWhere = this.buildVisibleParticipantWhere(blockedUserIds);
    const [event, participantCount, viewerParticipant] = await Promise.all([
      this.prismaService.client.event.findUnique({
        where: { id: eventId },
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
            where: visibleParticipantWhere,
            select: {
              userId: true,
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
            orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
            take: EVENT_DETAIL_ATTENDEE_LIMIT + 1,
          },
          joinRequests: {
            where: { userId },
            take: 1,
            select: {
              userId: true,
              status: true,
              reviewedById: true,
            },
          },
          attendances: {
            where: { userId },
            take: 1,
            select: {
              userId: true,
              status: true,
            },
          },
          liveState: {
            select: { status: true },
          },
          chat: {
            select: { id: true },
          },
        },
      }),
      this.prismaService.client.eventParticipant.count({
        where: {
          eventId,
          ...visibleParticipantWhere,
        },
      }),
      this.prismaService.client.eventParticipant.findUnique({
        where: {
          eventId_userId: {
            eventId,
            userId,
          },
        },
        select: { id: true },
      }),
    ]);

    if (!event) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    if (blockedUserIds.has(event.hostId)) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    const viewerState = {
      isParticipant: viewerParticipant != null,
      hasAttendance: event.attendances.length > 0,
    };

    if (!this.canViewEvent(userId, userGender, event, viewerState)) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    const visibleParticipants = event.participants.filter(
      (participant) => !blockedUserIds.has(participant.userId),
    );
    const attendeePreview = visibleParticipants
      .filter((participant) => participant.userId !== userId)
      .slice(0, EVENT_DETAIL_ATTENDEE_LIMIT);
    const hasChatAccess =
      event.hostId === userId ||
      viewerState.isParticipant;

    return {
      ...mapEventSummary({
        event,
        participants: visibleParticipants,
        currentUserId: userId,
        participantCount,
        joined: viewerState.isParticipant,
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
      attendees: attendeePreview.map((participant) => ({
        id: participant.user.id,
        displayName: participant.user.displayName,
        avatarUrl: participant.user.profile?.avatarUrl ?? null,
      })),
    };
  }

  async joinEvent(userId: string, eventId: string) {
    const [blockedUserIds, userGender, event] = await Promise.all([
      this.getBlockedUserIds(userId),
      this.getUserGender(userId),
      this.prismaService.client.event.findUnique({
        where: { id: eventId },
        include: { chat: true },
      }),
    ]);

    if (!event?.chat) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    if (blockedUserIds.has(event.hostId)) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    if (!this.canAccessGenderRestrictedEvent(userId, userGender, event)) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    if (event.joinMode === 'request') {
      throw new ApiError(409, 'join_request_required', 'Join request is required for this event');
    }

    const chatId = event.chat.id;

    await this.prismaService.client.$transaction(async (tx) => {
      const existingParticipant = await tx.eventParticipant.findUnique({
        where: {
          eventId_userId: {
            eventId,
            userId,
          },
        },
        select: { id: true },
      });

      if (!existingParticipant) {
        await assertEventCapacityAvailable(tx, eventId);
      }

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

      await tx.chat.update({
        where: { id: chatId },
        data: { updatedAt: new Date() },
      });
    });

    return this.getEventDetail(userId, eventId);
  }

  async createJoinRequest(userId: string, eventId: string, body: Record<string, unknown>) {
    const [blockedUserIds, userGender, event] = await Promise.all([
      this.getBlockedUserIds(userId),
      this.getUserGender(userId),
      this.prismaService.client.event.findUnique({
        where: { id: eventId },
        include: {
          participants: {
            select: {
              userId: true,
            },
          },
        },
      }),
    ]);

    if (!event) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    if (blockedUserIds.has(event.hostId)) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    if (!this.canAccessGenderRestrictedEvent(userId, userGender, event)) {
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

    if (
      existingRequest != null &&
      existingRequest.status !== 'pending'
    ) {
      throw new ApiError(
        409,
        'join_request_already_reviewed',
        'Join request is already reviewed',
      );
    }

    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (note.length > 200) {
      throw new ApiError(
        400,
        'invalid_join_request_note',
        'Join request note is too long',
      );
    }
    const compatibilityScore = await this.calculateCompatibilityScore(userId, event);

    const request = await this.prismaService.client.$transaction(async (tx) => {
      const next = await tx.eventJoinRequest.upsert({
        where: {
          eventId_userId: {
            eventId,
            userId,
          },
        },
        update: {
          note,
          compatibilityScore,
        },
        create: {
          eventId,
          userId,
          note,
          status: 'pending',
          compatibilityScore,
        },
      });

      if (next.status !== 'pending') {
        throw new ApiError(
          409,
          'join_request_already_reviewed',
          'Join request is already reviewed',
        );
      }

      const notificationDedupeKey = `event_join_request:${eventId}:${userId}`;
      const existingNotification = await tx.notification.findUnique({
        where: { dedupeKey: notificationDedupeKey },
        select: { id: true },
      });

      if (existingNotification != null) {
        return next;
      }

      const notification = await tx.notification.create({
        data: {
          userId: event.hostId,
          actorUserId: userId,
          kind: 'event_joined',
          title: 'Новая заявка',
          body: `Новая заявка на встречу «${event.title}»`,
          eventId,
          requestId: next.id,
          dedupeKey: notificationDedupeKey,
          payload: {
            eventId,
            requestId: next.id,
            status: 'pending',
            userId,
          },
        },
      });

      await tx.outboxEvent.createMany({
        data: [
          {
            type: OUTBOX_EVENT_TYPES.pushDispatch,
            payload: {
              userId: event.hostId,
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

      await tx.eventAttendance.upsert({
        where: {
          eventId_userId: {
            eventId,
            userId,
          },
        },
        update: {
          status: 'left',
          leftAt: new Date(),
        },
        create: {
          eventId,
          userId,
          status: 'left',
          leftAt: new Date(),
        },
      });

      await tx.chatMember.deleteMany({
        where: { chatId, userId },
      });
    });

    return this.getEventDetail(userId, eventId);
  }

  async createEvent(
    userId: string,
    body: Record<string, unknown>,
    rawIdempotencyKey?: string,
  ) {
    const idempotencyKey = this.normalizeIdempotencyKey(rawIdempotencyKey);
    if (idempotencyKey != null) {
      const existing = await this.prismaService.client.event.findFirst({
        where: {
          hostId: userId,
          idempotencyKey,
        },
        select: { id: true },
      });

      if (existing) {
        return this.getEventDetail(userId, existing.id);
      }
    }

    const posterId =
      typeof body.posterId === 'string' && body.posterId.trim().length > 0
        ? body.posterId.trim()
        : undefined;
    const poster =
      posterId == null
        ? null
        : await this.prismaService.client.poster.findUnique({
            where: { id: posterId },
          });

    const mode =
      body.mode === 'dating' || body.mode === 'afterdark'
        ? body.mode
        : 'default';
    const isDatingMode = mode === 'dating';
    const isAfterDarkMode = mode === 'afterdark';

    if (isDatingMode) {
      await this.assertDatingUnlocked(userId);
    }

    if (isAfterDarkMode) {
      await this.assertAfterDarkUnlocked(userId);
    }

    if (posterId != null && !poster) {
      throw new ApiError(404, 'poster_not_found', 'Poster not found');
    }

    const title =
      typeof body.title === 'string' && body.title.trim().length > 0
        ? body.title.trim()
        : poster?.title ?? '';
    const description =
      typeof body.description === 'string' && body.description.trim().length > 0
        ? body.description.trim()
        : poster?.description ?? '';
    const emoji =
      typeof body.emoji === 'string' && body.emoji.trim().length > 0
        ? body.emoji
        : poster?.emoji ?? (isDatingMode ? '💘' : isAfterDarkMode ? '🖤' : '🍷');
    const requestedVibe = typeof body.vibe === 'string' ? body.vibe : 'Спокойно';
    const vibe = isDatingMode ? 'Свидание' : requestedVibe;
    const place =
      typeof body.place === 'string' && body.place.trim().length > 0
        ? body.place.trim()
        : poster == null
          ? ''
          : `${poster.venue}, ${poster.address}`;
    const distanceKm =
      typeof body.distanceKm === 'number'
        ? body.distanceKm
        : poster?.distanceKm ?? 1.0;
    const latitude =
      typeof body.latitude === 'number' ? body.latitude : null;
    const longitude =
      typeof body.longitude === 'number' ? body.longitude : null;
    const capacity =
      typeof body.capacity === 'number' ? Math.trunc(body.capacity) : 8;
    const startsAtRaw =
      typeof body.startsAt === 'string' ? body.startsAt : undefined;
    const startsAt =
      startsAtRaw != null ? new Date(startsAtRaw) : poster?.startsAt ?? new Date();
    const lifestyle =
      body.lifestyle === 'zozh' || body.lifestyle === 'anti' || body.lifestyle === 'neutral'
        ? body.lifestyle
        : 'neutral';
    const requestedPriceMode =
      body.priceMode === 'fixed' ||
      body.priceMode === 'from' ||
      body.priceMode === 'upto' ||
      body.priceMode === 'range' ||
      body.priceMode === 'split' ||
      body.priceMode === 'free' ||
      body.priceMode === 'host_pays' ||
      body.priceMode === 'fifty_fifty'
        ? body.priceMode
        : 'free';
    const priceMode =
      isDatingMode
        ? requestedPriceMode === 'fifty_fifty'
          ? 'fifty_fifty'
          : 'host_pays'
        : requestedPriceMode === 'host_pays' || requestedPriceMode === 'fifty_fifty'
          ? 'free'
          : requestedPriceMode;
    const priceAmountFrom =
      typeof body.priceAmountFrom === 'number'
        ? Math.max(0, Math.round(body.priceAmountFrom))
        : null;
    const priceAmountTo =
      typeof body.priceAmountTo === 'number'
        ? Math.max(0, Math.round(body.priceAmountTo))
        : null;
    const requestedAccessMode =
      body.accessMode === 'request' || body.accessMode === 'free' || body.accessMode === 'open'
        ? body.accessMode
        : 'open';
    const genderMode =
      body.genderMode === 'male' || body.genderMode === 'female' || body.genderMode === 'all'
        ? body.genderMode
        : 'all';
    const requestedVisibilityMode =
      body.visibilityMode === 'friends' || body.visibility === 'private'
        ? 'friends'
        : 'public';
    const visibilityMode =
      isDatingMode ? 'friends' : requestedVisibilityMode;
    const accessMode =
      isDatingMode || isAfterDarkMode
        ? 'request'
        : visibilityMode === 'friends'
          ? 'request'
          : requestedAccessMode;
    const joinMode =
      isDatingMode ||
      isAfterDarkMode ||
      visibilityMode === 'friends' ||
      accessMode === 'request' ||
      body.joinMode === 'request'
        ? 'request'
        : 'open';
    const inviteeUserId = typeof body.inviteeUserId === 'string' ? body.inviteeUserId : undefined;
    const communityId =
      typeof body.communityId === 'string' && body.communityId.trim().length > 0
        ? body.communityId.trim()
        : undefined;
    const normalizedCapacity = isDatingMode ? 2 : capacity;
    const afterDarkCategory =
      isAfterDarkMode &&
      (body.afterDarkCategory === 'kink' ||
        body.afterDarkCategory === 'dating' ||
        body.afterDarkCategory === 'wellness' ||
        body.afterDarkCategory === 'nightlife')
        ? body.afterDarkCategory
        : isAfterDarkMode
          ? 'nightlife'
          : null;
    const afterDarkGlow =
      isAfterDarkMode && typeof body.afterDarkGlow === 'string' && body.afterDarkGlow.trim().length > 0
        ? body.afterDarkGlow.trim()
        : isAfterDarkMode
          ? 'magenta'
          : null;
    const dressCode =
      typeof body.dressCode === 'string' && body.dressCode.trim().length > 0
        ? body.dressCode.trim()
        : null;
    const ageRange =
      typeof body.ageRange === 'string' && body.ageRange.trim().length > 0
        ? body.ageRange.trim()
        : null;
    const ratioLabel =
      typeof body.ratioLabel === 'string' && body.ratioLabel.trim().length > 0
        ? body.ratioLabel.trim()
        : null;
    const consentRequired = isAfterDarkMode ? body.consentRequired === true : false;
    const rules = this.parseEventRules(body.rules);

    if (title.length === 0 || description.length === 0 || place.length === 0) {
      throw new ApiError(
        400,
        'invalid_event_payload',
        'title, description and place are required',
      );
    }

    if (inviteeUserId === userId) {
      throw new ApiError(400, 'invalid_invitee', 'Invitee cannot be the host');
    }

    if (!Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm > 500) {
      throw new ApiError(400, 'invalid_event_payload', 'distanceKm is invalid');
    }

    if ((latitude == null) !== (longitude == null)) {
      throw new ApiError(
        400,
        'invalid_event_payload',
        'latitude and longitude must be provided together',
      );
    }

    if (
      latitude != null &&
      (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
    ) {
      throw new ApiError(400, 'invalid_event_payload', 'latitude is invalid');
    }

    if (
      longitude != null &&
      (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
    ) {
      throw new ApiError(400, 'invalid_event_payload', 'longitude is invalid');
    }

    if (!Number.isFinite(normalizedCapacity) || normalizedCapacity < 2 || normalizedCapacity > 100) {
      throw new ApiError(400, 'invalid_event_payload', 'capacity is invalid');
    }

    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now() - 60000) {
      throw new ApiError(400, 'invalid_event_payload', 'startsAt is invalid');
    }

    const blockedUserIds = await this.getBlockedUserIds(userId);
    if (inviteeUserId != null && blockedUserIds.has(inviteeUserId)) {
      throw new ApiError(404, 'user_not_found', 'Invitee user not found');
    }

    const [hostUser, inviteeUser] = await Promise.all([
      this.prismaService.client.user.findUnique({
        where: { id: userId },
        select: { displayName: true },
      }),
      inviteeUserId == null
        ? null
        : this.prismaService.client.user.findUnique({
            where: { id: inviteeUserId },
            select: { id: true, displayName: true },
          }),
    ]);

    if (!hostUser) {
      throw new ApiError(404, 'user_not_found', 'User not found');
    }

    if (inviteeUserId != null && !inviteeUser) {
      throw new ApiError(404, 'user_not_found', 'Invitee user not found');
    }

    const community =
      communityId == null
        ? null
        : await this.prismaService.client.community.findFirst({
            where: {
              id: communityId,
              OR: [
                { createdById: userId },
                { members: { some: { userId } } },
              ],
            },
            select: { id: true },
          });

    if (communityId != null && !community) {
      throw new ApiError(404, 'community_not_found', 'Community not found');
    }

    let created: { id: string };
    try {
      created = await this.prismaService.client.$transaction(async (tx) => {
        const event = await tx.event.create({
          data: {
            id: `ev-${randomUUID()}`,
            title,
            emoji,
            startsAt,
            place,
            distanceKm,
            latitude,
            longitude,
            vibe,
            tone:
              vibe === 'Активно'
                ? 'sage'
                : vibe === 'Свидание'
                  ? 'evening'
                  : 'warm',
            joinMode,
            lifestyle,
            priceMode,
            priceAmountFrom,
            priceAmountTo,
            accessMode,
            genderMode,
            visibilityMode,
            description,
            idempotencyKey,
            sourcePosterId: poster?.id,
            capacity: normalizedCapacity,
            hostId: userId,
            isCalm: vibe === 'Спокойно' || vibe === 'Уютно',
            isNewcomers: true,
            isDate: isDatingMode || vibe === 'Свидание',
            isAfterDark: isAfterDarkMode,
            afterDarkCategory,
            afterDarkGlow,
            dressCode: isAfterDarkMode ? dressCode : null,
            ageRange: isAfterDarkMode ? ageRange : null,
            ratioLabel: isAfterDarkMode ? ratioLabel : null,
            consentRequired,
            rules: isAfterDarkMode ? (rules ?? Prisma.JsonNull) : Prisma.JsonNull,
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

        if (community != null) {
          await tx.communityMeetupItem.create({
            data: {
              id: event.id,
              communityId: community.id,
              title,
              emoji,
              timeLabel: formatEventTime(startsAt),
              place,
              format: joinMode === 'request' ? 'По заявке' : 'Открытая встреча',
              going: 1,
              startsAt,
            },
          });
        }

        if (inviteeUser != null) {
          const inviteRequest = await tx.eventJoinRequest.create({
            data: {
              eventId: event.id,
              userId: inviteeUser.id,
              note: null,
              status: 'pending',
              compatibilityScore: 0,
              reviewedById: userId,
            },
          });

          const notification = await tx.notification.create({
            data: {
              userId: inviteeUser.id,
              actorUserId: userId,
              kind: 'event_invite',
              title: 'Вас пригласили на встречу',
              body: `приглашает тебя на встречу «${event.title}»`,
              eventId: event.id,
              requestId: inviteRequest.id,
              dedupeKey: `event_invite:${event.id}:${inviteeUser.id}`,
              payload: {
                eventId: event.id,
                requestId: inviteRequest.id,
                invite: true,
                userId,
                userName: hostUser.displayName,
                eventTitle: event.title,
              },
            },
          });

          await tx.outboxEvent.createMany({
            data: [
              {
                type: OUTBOX_EVENT_TYPES.pushDispatch,
                payload: {
                  userId: inviteeUser.id,
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
        }

        return event;
      });
    } catch (error) {
      if (
        idempotencyKey != null &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prismaService.client.event.findFirst({
          where: {
            hostId: userId,
            idempotencyKey,
          },
          select: { id: true },
        });

        if (existing) {
          return this.getEventDetail(userId, existing.id);
        }
      }

      throw error;
    }

    return this.getEventDetail(userId, created.id);
  }

  async acceptInvite(userId: string, eventId: string, requestId: string) {
    const invite = await this.prismaService.client.eventJoinRequest.findUnique({
      where: { id: requestId },
      include: {
        event: {
          include: { chat: true },
        },
      },
    });

    if (
      !invite ||
      invite.eventId !== eventId ||
      invite.userId !== userId ||
      invite.status !== 'pending' ||
      invite.reviewedById == null ||
      invite.reviewedById !== invite.event.hostId
    ) {
      throw new ApiError(404, 'invite_not_found', 'Invite not found');
    }

    const blockedUserIds = await this.getBlockedUserIds(userId);
    if (blockedUserIds.has(invite.event.hostId)) {
      throw new ApiError(404, 'invite_not_found', 'Invite not found');
    }

    await this.prismaService.client.$transaction(async (tx) => {
      await assertEventCapacityAvailable(tx, eventId);

      const reviewed = await tx.eventJoinRequest.updateMany({
        where: {
          id: invite.id,
          eventId,
          userId,
          status: 'pending',
          reviewedById: invite.event.hostId,
        },
        data: {
          status: 'approved',
          reviewedAt: new Date(),
        },
      });
      if (reviewed.count === 0) {
        throw new ApiError(
          409,
          'invite_already_reviewed',
          'Invite is already reviewed',
        );
      }

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

      if (invite.event.chat != null) {
        await tx.chatMember.upsert({
          where: {
            chatId_userId: {
              chatId: invite.event.chat.id,
              userId,
            },
          },
          update: {},
          create: {
            chatId: invite.event.chat.id,
            userId,
          },
        });
      }

      await this.markInviteNotificationsRead(tx, userId, eventId, requestId);
    });

    return this.getEventDetail(userId, eventId);
  }

  async declineInvite(userId: string, eventId: string, requestId: string) {
    const invite = await this.prismaService.client.eventJoinRequest.findUnique({
      where: { id: requestId },
      include: {
        event: {
          include: { chat: true },
        },
        user: {
          select: { displayName: true },
        },
      },
    });

    if (
      !invite ||
      invite.eventId !== eventId ||
      invite.userId !== userId ||
      invite.status !== 'pending' ||
      invite.reviewedById == null ||
      invite.reviewedById !== invite.event.hostId
    ) {
      throw new ApiError(404, 'invite_not_found', 'Invite not found');
    }

    const blockedUserIds = await this.getBlockedUserIds(userId);
    if (blockedUserIds.has(invite.event.hostId)) {
      throw new ApiError(404, 'invite_not_found', 'Invite not found');
    }

    await this.prismaService.client.$transaction(async (tx) => {
      const reviewed = await tx.eventJoinRequest.updateMany({
        where: {
          id: invite.id,
          eventId,
          userId,
          status: 'pending',
          reviewedById: invite.event.hostId,
        },
        data: {
          status: 'rejected',
          reviewedAt: new Date(),
        },
      });
      if (reviewed.count === 0) {
        throw new ApiError(
          409,
          'invite_already_reviewed',
          'Invite is already reviewed',
        );
      }

      await this.markInviteNotificationsRead(tx, userId, eventId, requestId);

      if (invite.event.chat != null) {
        const message = await tx.message.create({
          data: {
            chatId: invite.event.chat.id,
            senderId: invite.event.hostId,
            text: `${invite.user.displayName} не присоединится к встрече.`,
            clientMessageId: `invite-decline-${requestId}`,
          },
          include: {
            sender: {
              include: {
                profile: {
                  select: {
                    avatarUrl: true,
                  },
                },
              },
            },
            attachments: {
              include: {
                mediaAsset: true,
              },
            },
          },
        });

        await tx.chat.update({
          where: { id: invite.event.chat.id },
          data: { updatedAt: new Date() },
        });

        const realtimeEvent = await tx.realtimeEvent.create({
          data: {
            chatId: invite.event.chat.id,
            eventType: 'message.created',
            payload: mapMessage(message),
          },
        });

        await tx.outboxEvent.create({
          data: {
            type: OUTBOX_EVENT_TYPES.realtimePublish,
            payload: {
              type: 'message.created',
              payload: {
                ...mapMessage(message),
                eventId: realtimeEvent.id.toString(),
              },
            },
          },
        });
      }

      const notification = await tx.notification.create({
        data: {
          userId: invite.event.hostId,
          actorUserId: userId,
          kind: 'event_joined',
          title: 'Приглашение отклонено',
          body: `${invite.user.displayName} отклонил приглашение на встречу «${invite.event.title}»`,
          eventId,
          requestId,
          payload: {
            eventId,
            requestId,
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
              userId: invite.event.hostId,
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
    });

    return {
      ok: true,
      eventId,
      requestId,
      status: 'rejected',
    };
  }

  async getCheckIn(userId: string, eventId: string) {
    const { blockedUserIds } = await this.assertParticipant(userId, eventId);

    const event = await this.prismaService.client.event.findUnique({
      where: { id: eventId },
      include: {
        participants: {
          where: this.buildVisibleParticipantWhere(blockedUserIds),
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
          where: this.buildVisibleParticipantWhere(blockedUserIds),
          select: {
            userId: true,
            status: true,
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
    const eventCoordinates = event as typeof event & {
      latitude?: number | null;
      longitude?: number | null;
    };

    return {
      eventId: event.id,
      title: event.title,
      place: event.place,
      latitude: eventCoordinates.latitude ?? null,
      longitude: eventCoordinates.longitude ?? null,
      status: mapAttendanceStatus(attendanceByUserId.get(userId)),
      code: this.buildCheckInCode(eventId, userId),
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
    const expected = this.buildCheckInCode(eventId, userId);
    if (code == null || code !== expected) {
      throw new ApiError(400, 'invalid_check_in_code', 'Invalid check-in code');
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
    const { blockedUserIds } = await this.assertParticipant(userId, eventId);
    const visibleStoryWhere: Prisma.EventStoryWhereInput =
      blockedUserIds.size === 0
        ? { eventId }
        : {
            eventId,
            authorId: {
              notIn: [...blockedUserIds],
            },
          };

    const [event, storiesCount] = await Promise.all([
      this.prismaService.client.event.findUnique({
        where: { id: eventId },
        include: {
          participants: {
            where: this.buildVisibleParticipantWhere(blockedUserIds),
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
            where: this.buildVisibleParticipantWhere(blockedUserIds),
            select: {
              userId: true,
              status: true,
            },
          },
          liveState: {
            select: {
              status: true,
              startedAt: true,
            },
          },
          chat: {
            select: {
              id: true,
            },
          },
        },
      }),
      this.prismaService.client.eventStory.count({
        where: visibleStoryWhere,
      }),
    ]);

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
      storiesCount,
    };
  }

  async getAfterParty(userId: string, eventId: string) {
    const { blockedUserIds } = await this.assertParticipant(userId, eventId);

    const event = await this.prismaService.client.event.findUnique({
      where: { id: eventId },
      include: {
        participants: {
          where: this.buildVisibleParticipantWhere(blockedUserIds),
          select: {
            userId: true,
            user: {
              select: {
                displayName: true,
                profile: {
                  select: {
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        feedbacks: {
          where: { userId },
          take: 1,
          select: {
            vibe: true,
            hostRating: true,
            note: true,
          },
        },
        favorites: {
          where: {
            sourceUserId: userId,
            ...(blockedUserIds.size === 0
              ? {}
              : {
                  targetUserId: {
                    notIn: [...blockedUserIds],
                  },
                }),
          },
          select: {
            targetUserId: true,
          },
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
    const { blockedUserIds } = await this.assertParticipant(userId, eventId);
    const requestedFavoriteUserIds = Array.isArray(body.favoriteUserIds)
      ? body.favoriteUserIds
          .filter((item): item is string => typeof item === 'string')
          .filter((targetUserId) => targetUserId !== userId)
          .filter((targetUserId) => !blockedUserIds.has(targetUserId))
          .filter((targetUserId, index, values) =>
            values.indexOf(targetUserId) === index,
          )
      : [];
    const event = await this.prismaService.client.event.findUnique({
      where: { id: eventId },
      include: {
        liveState: {
          select: { status: true },
        },
      },
    });

    if (!event) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    const feedbackOpen =
      event.startsAt.getTime() <= Date.now() ||
      event.liveState?.status === 'finished';

    if (!feedbackOpen) {
      throw new ApiError(409, 'event_feedback_not_open', 'Feedback is not open yet');
    }

    const favoriteParticipants =
      requestedFavoriteUserIds.length === 0
        ? []
        : await this.prismaService.client.eventParticipant.findMany({
            where: {
              eventId,
              userId: {
                in: requestedFavoriteUserIds,
              },
            },
            select: { userId: true },
          });
    const participantUserIds = new Set(
      favoriteParticipants.map((participant) => participant.userId),
    );
    const vibe = typeof body.vibe === 'string' ? body.vibe : 'ok';
    const hostRating =
      typeof body.hostRating === 'number'
        ? Math.max(1, Math.min(5, Math.round(body.hostRating)))
        : 5;
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    const favoriteUserIds = requestedFavoriteUserIds.filter((targetUserId) =>
      participantUserIds.has(targetUserId),
    );

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

  private buildListWhere(
    userId: string,
    blockedUserIds: Set<string>,
    userGender: 'male' | 'female' | null,
    filter: EventFilter | undefined,
    params: {
      q?: string;
      lifestyle?: EventLifestyleFilter;
      price?: EventPriceFilter;
      gender?: EventGenderFilter;
      access?: EventAccessFilter;
    },
    geoBounds?: EventGeoBounds,
  ): Prisma.EventWhereInput {
    const conditions: Prisma.EventWhereInput[] = [
      {
        isAfterDark: false,
      },
      {
        OR: [
          { visibilityMode: 'public' },
          { hostId: userId },
          {
            participants: {
              some: {
                userId,
              },
            },
          },
          {
            attendances: {
              some: {
                userId,
              },
            },
          },
        ],
      },
    ];
    conditions.push({
      OR: [
        { genderMode: 'all' },
        ...(userGender == null ? [] : [{ genderMode: userGender }]),
        { hostId: userId },
        {
          participants: {
            some: {
              userId,
            },
          },
        },
        {
          attendances: {
            some: {
              userId,
            },
          },
        },
      ],
    });
    const where: Prisma.EventWhereInput = {
      hostId: {
        notIn: [...blockedUserIds],
      },
      AND: conditions,
    };
    const now = new Date();

    switch (filter) {
      case 'now':
        conditions.push({
          startsAt: {
            gte: new Date(now.getTime() - 3 * 60 * 60 * 1000),
            lte: new Date(now.getTime() + 3 * 60 * 60 * 1000),
          },
        });
        break;
      case 'calm':
        conditions.push({ startsAt: { gte: now } });
        conditions.push({ isCalm: true });
        break;
      case 'newcomers':
        conditions.push({ startsAt: { gte: now } });
        conditions.push({ isNewcomers: true });
        break;
      case 'date':
        conditions.push({ startsAt: { gte: now } });
        conditions.push({ isDate: true });
        break;
      case 'nearby':
      default:
        conditions.push({ startsAt: { gte: now } });
        break;
    }

    const query = normalizeSearchQuery(params.q);
    if (query) {
      conditions.push({
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { place: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { hostNote: { contains: query, mode: 'insensitive' } },
          { vibe: { contains: query, mode: 'insensitive' } },
        ],
      });
    }

    if (params.lifestyle && params.lifestyle !== 'any') {
      conditions.push({ lifestyle: params.lifestyle });
    }

    if (params.gender && params.gender !== 'any') {
      conditions.push({ genderMode: params.gender });
    }

    if (params.access && params.access !== 'any') {
      conditions.push({ accessMode: params.access });
    }

    const priceWhere = this.buildPriceWhere(params.price);
    if (priceWhere) {
      conditions.push(priceWhere);
    }

    if (geoBounds != null) {
      conditions.push({
        latitude: {
          gte: geoBounds.south,
          lte: geoBounds.north,
        },
        longitude: {
          gte: geoBounds.west,
          lte: geoBounds.east,
        },
      });
    }

    return where;
  }

  private buildPriceWhere(price?: EventPriceFilter): Prisma.EventWhereInput | null {
    if (!price || price === 'any') {
      return null;
    }

    if (price === 'free') {
      return {
        priceMode: 'free',
      };
    }

    const between = (min: number, max?: number): Prisma.EventWhereInput => ({
      OR: [
        {
          priceAmountTo: max == null ? { gt: min } : { gte: min, lte: max },
        },
        {
          priceAmountTo: null,
          priceAmountFrom: max == null ? { gt: min } : { gte: min, lte: max },
        },
      ],
    });

    switch (price) {
      case 'cheap':
        return between(0, 1000);
      case 'mid':
        return between(1001, 3000);
      case 'premium':
        return between(3000);
      default:
        return null;
    }
  }

  private listOrderBy(
    filter?: EventFilter,
    geoQuery?: EventGeoQuery,
  ): Prisma.EventOrderByWithRelationInput[] {
    if (geoQuery?.center != null) {
      return [{ startsAt: 'asc' }, { id: 'asc' }];
    }

    if (filter === 'nearby' || !filter) {
      return [{ distanceKm: 'asc' }, { id: 'asc' }];
    }

    return [{ startsAt: 'asc' }, { id: 'asc' }];
  }

  private listTake(take: number, geoQuery?: EventGeoQuery) {
    if (geoQuery?.center == null) {
      return take + 1;
    }

    return Math.max(take + 1, Math.min(take * 6, 300));
  }

  private async loadPostgisEventCandidates(params: {
    geoQuery?: EventGeoQuery;
    cursor?: string;
    take: number;
    radiusKm?: number;
    blockedUserIds: Set<string>;
  }): Promise<PostgisEventCandidate[] | null> {
    const center = params.geoQuery?.center;
    if (
      process.env.ENABLE_POSTGIS_EVENT_FEED !== 'true' ||
      center == null ||
      params.cursor != null
    ) {
      return null;
    }

    const radiusKm =
      params.radiusKm == null || !Number.isFinite(params.radiusKm)
        ? 20
        : Math.max(0.2, Math.min(params.radiusKm, 100));
    const radiusMeters = radiusKm * 1000;
    const candidateLimit = this.listTake(params.take, params.geoQuery);
    const now = new Date();
    const blockedHostFilter =
      params.blockedUserIds.size === 0
        ? Prisma.empty
        : Prisma.sql`AND e."hostId" NOT IN (${Prisma.join([...params.blockedUserIds])})`;
    const rows = await this.prismaService.client.$queryRaw<Array<{
      event_id: string;
      distance_km: bigint | number | string;
    }>>(Prisma.sql`
      SELECT
        e."id" AS event_id,
        ST_Distance(
          e."geo",
          ST_SetSRID(ST_MakePoint(${center.longitude}, ${center.latitude}), 4326)::geography
        ) / 1000 AS distance_km
      FROM "Event" e
      WHERE e."geo" IS NOT NULL
        AND e."isAfterDark" = false
        AND e."startsAt" >= ${now}
        ${blockedHostFilter}
        AND ST_DWithin(
          e."geo",
          ST_SetSRID(ST_MakePoint(${center.longitude}, ${center.latitude}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY distance_km ASC, e."id" ASC
      LIMIT ${candidateLimit}
    `);

    return rows.map((row) => ({
      eventId: row.event_id,
      distanceKm: Number(row.distance_km),
    }));
  }

  private normalizeEventGeoQuery(params: {
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    southWestLatitude?: number;
    southWestLongitude?: number;
    northEastLatitude?: number;
    northEastLongitude?: number;
  }): EventGeoQuery | undefined {
    const center = this.normalizeGeoPoint(params.latitude, params.longitude);
    const explicitBounds = this.normalizeGeoBounds(
      params.southWestLatitude,
      params.southWestLongitude,
      params.northEastLatitude,
      params.northEastLongitude,
    );

    if (explicitBounds != null) {
      return {
        center: center ?? undefined,
        bounds: explicitBounds,
      };
    }

    if (center == null) {
      return undefined;
    }

    const radiusKm =
      params.radiusKm == null || !Number.isFinite(params.radiusKm)
        ? 20
        : Math.max(0.2, Math.min(params.radiusKm, 100));

    return {
      center,
      bounds: this.boundsFromCenter(center, radiusKm),
    };
  }

  private normalizeGeoPoint(
    latitude?: number,
    longitude?: number,
  ): EventGeoPoint | null {
    if (latitude == null && longitude == null) {
      return null;
    }

    if (
      latitude == null ||
      longitude == null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new ApiError(400, 'invalid_geo_query', 'Geo point is invalid');
    }

    return { latitude, longitude };
  }

  private normalizeGeoBounds(
    south?: number,
    west?: number,
    north?: number,
    east?: number,
  ): EventGeoBounds | null {
    if (south == null && west == null && north == null && east == null) {
      return null;
    }

    if (
      south == null ||
      west == null ||
      north == null ||
      east == null ||
      !Number.isFinite(south) ||
      !Number.isFinite(west) ||
      !Number.isFinite(north) ||
      !Number.isFinite(east) ||
      south < -90 ||
      north > 90 ||
      west < -180 ||
      east > 180 ||
      south > north ||
      west > east
    ) {
      throw new ApiError(400, 'invalid_geo_query', 'Geo bounds are invalid');
    }

    return { south, west, north, east };
  }

  private boundsFromCenter(
    center: EventGeoPoint,
    radiusKm: number,
  ): EventGeoBounds {
    const latitudeDelta = radiusKm / 111.32;
    const longitudeScale = Math.max(
      Math.cos((center.latitude * Math.PI) / 180),
      0.2,
    );
    const longitudeDelta = radiusKm / (111.32 * longitudeScale);

    return {
      south: Math.max(-90, center.latitude - latitudeDelta),
      west: Math.max(-180, center.longitude - longitudeDelta),
      north: Math.min(90, center.latitude + latitudeDelta),
      east: Math.min(180, center.longitude + longitudeDelta),
    };
  }

  private orderEventsByGeo<
    T extends { latitude?: number | null; longitude?: number | null },
  >(events: T[], geoQuery?: EventGeoQuery) {
    const center = geoQuery?.center;
    if (center == null) {
      return events;
    }

    return [...events].sort((left, right) => {
      const leftDistance = this.eventDistanceKm(left, center);
      const rightDistance = this.eventDistanceKm(right, center);
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }
      return 0;
    });
  }

  private orderEventsByPostgisCandidates<T extends { id: string }>(
    events: T[],
    candidates: PostgisEventCandidate[],
  ) {
    const eventById = new Map(events.map((event) => [event.id, event]));

    return candidates
      .map((candidate) => eventById.get(candidate.eventId))
      .filter((event): event is T => event != null);
  }

  private eventWithGeoDistance<
    T extends {
      distanceKm: number;
      latitude?: number | null;
      longitude?: number | null;
    },
  >(event: T, geoQuery?: EventGeoQuery, distanceKm?: number): T {
    if (distanceKm != null && Number.isFinite(distanceKm)) {
      return {
        ...event,
        distanceKm,
      };
    }

    const center = geoQuery?.center;
    if (center == null || event.latitude == null || event.longitude == null) {
      return event;
    }

    return {
      ...event,
      distanceKm: this.geoDistanceKm(
        center.latitude,
        center.longitude,
        event.latitude,
        event.longitude,
      ),
    };
  }

  private eventDistanceKm(
    event: { latitude?: number | null; longitude?: number | null },
    center: EventGeoPoint,
  ) {
    if (event.latitude == null || event.longitude == null) {
      return Number.POSITIVE_INFINITY;
    }

    return this.geoDistanceKm(
      center.latitude,
      center.longitude,
      event.latitude,
      event.longitude,
    );
  }

  private geoDistanceKm(
    fromLatitude: number,
    fromLongitude: number,
    toLatitude: number,
    toLongitude: number,
  ) {
    const latitudeDelta = ((toLatitude - fromLatitude) * Math.PI) / 180;
    const longitudeDelta = ((toLongitude - fromLongitude) * Math.PI) / 180;
    const fromRad = (fromLatitude * Math.PI) / 180;
    const toRad = (toLatitude * Math.PI) / 180;
    const a =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(fromRad) *
        Math.cos(toRad) *
        Math.sin(longitudeDelta / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private normalizeListLimit(limit?: number) {
    if (limit == null || !Number.isFinite(limit)) {
      return 20;
    }

    return Math.max(1, Math.min(Math.trunc(limit), 50));
  }

  private async resolveListCursor(cursor?: string, filter?: EventFilter): Promise<EventListCursor | null> {
    if (!cursor) {
      return null;
    }

    let cursorId: string | null = null;
    let decoded: ReturnType<typeof decodeCursor> = null;
    try {
      decoded = decodeCursor(cursor);
      cursorId = decoded?.value ?? null;
    } catch {
      cursorId = cursor;
    }

    if (!cursorId) {
      return null;
    }

    const distanceKm = this.parseCursorNumber(decoded?.distanceKm);
    const startsAt = this.parseCursorDate(decoded?.startsAt);
    if (distanceKm != null && startsAt) {
      return {
        id: cursorId,
        distanceKm,
        startsAt,
      };
    }

    return this.prismaService.client.event.findUnique({
      where: { id: cursorId },
      select: {
        id: true,
        distanceKm: true,
        startsAt: true,
      },
    });
  }

  private encodeListCursor(event: EventListCursor) {
    return encodeCursor({
      value: event.id,
      distanceKm: event.distanceKm,
      startsAt: event.startsAt.toISOString(),
    });
  }

  private parseCursorNumber(value: unknown) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    return value;
  }

  private parseCursorDate(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }

    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  private buildListCursorWhere(
    cursorEvent: EventListCursor | null,
    filter?: EventFilter,
  ): Prisma.EventWhereInput | null {
    if (!cursorEvent) {
      return null;
    }

    if (filter === 'nearby' || !filter) {
      return {
        OR: [
          {
            distanceKm: {
              gt: cursorEvent.distanceKm,
            },
          },
          {
            distanceKm: cursorEvent.distanceKm,
            id: {
              gt: cursorEvent.id,
            },
          },
        ],
      };
    }

    return {
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
    };
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

    return {
      participant,
      blockedUserIds,
    };
  }

  private async calculateCompatibilityScore(
    userId: string,
    event: {
      hostId: string;
      participants: Array<{
        userId: string;
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

  private async markInviteNotificationsRead(
    tx: any,
    userId: string,
    eventId: string,
    requestId: string,
  ) {
    await tx.notification.updateMany({
      where: {
        userId,
        readAt: null,
        eventId,
        requestId,
      },
      data: {
        readAt: new Date(),
      },
    });
  }

  private async assertDatingUnlocked(userId: string) {
    const allowed = await this.subscriptionService.hasPremiumAccess(userId);
    if (!allowed) {
      throw new ApiError(403, 'dating_locked', 'Dating is available only for Frendly+');
    }
  }

  private async assertAfterDarkUnlocked(userId: string) {
    const [current, settings] = await Promise.all([
      this.subscriptionService.getCurrent(userId),
      this.prismaService.client.userSettings.findUnique({
        where: { userId },
        select: {
          afterDarkAgeConfirmedAt: true,
          afterDarkCodeAcceptedAt: true,
        },
      }),
    ]);

    const unlocked =
      this.subscriptionService.isPremiumStatus(current.status) &&
      settings?.afterDarkAgeConfirmedAt != null &&
      settings.afterDarkCodeAcceptedAt != null;

    if (!unlocked) {
      throw new ApiError(403, 'after_dark_locked', 'After Dark is locked');
    }
  }

  private parseEventRules(raw: unknown) {
    if (!Array.isArray(raw)) {
      return null;
    }

    const rules = raw
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    return rules.length > 0 ? rules : null;
  }

  private async getBlockedUserIds(userId: string) {
    return loadBlockedUserIds(this.prismaService.client, userId);
  }

  private async getUserGender(userId: string) {
    const profile = await this.prismaService.client.profile.findUnique({
      where: { userId },
      select: { gender: true },
    });

    return profile?.gender ?? null;
  }

  private buildVisibleParticipantWhere(blockedUserIds: Set<string>) {
    return blockedUserIds.size === 0
      ? {}
      : {
          userId: {
            notIn: [...blockedUserIds],
          },
        };
  }

  private canViewEvent(
    userId: string,
    userGender: 'male' | 'female' | null,
    event: {
      hostId: string;
      genderMode: string;
      visibilityMode: string;
      participants: Array<{ userId: string }>;
      attendances: Array<{
        userId: string;
        status: string;
      }>;
      joinRequests: Array<{
        userId: string;
        status: string;
        reviewedById: string | null;
      }>;
    },
    viewerState?: EventViewerState,
  ) {
    if (!this.canAccessGenderRestrictedEvent(userId, userGender, event, viewerState)) {
      return false;
    }

    if (event.visibilityMode !== 'friends') {
      return true;
    }

    if (event.hostId === userId) {
      return true;
    }

    const isParticipant =
      viewerState?.isParticipant ??
      event.participants.some((participant) => participant.userId === userId);
    if (isParticipant) {
      return true;
    }

    const hasAttendance =
      viewerState?.hasAttendance ??
      event.attendances.some((attendance) => attendance.userId === userId);
    if (hasAttendance) {
      return true;
    }

    return event.joinRequests.some(
      (request) =>
        request.userId === userId &&
        request.reviewedById === event.hostId &&
        (request.status === 'pending' || request.status === 'approved'),
    );
  }

  private canAccessGenderRestrictedEvent(
    userId: string,
    userGender: 'male' | 'female' | null,
    event: {
      hostId: string;
      genderMode: string;
      participants?: Array<{ userId: string }>;
      attendances?: Array<{ userId: string }>;
    },
    viewerState?: EventViewerState,
  ) {
    if (event.genderMode === 'all') {
      return true;
    }

    if (event.hostId === userId) {
      return true;
    }

    const isParticipant =
      viewerState?.isParticipant ??
      event.participants?.some((participant) => participant.userId === userId) ??
      false;
    if (isParticipant) {
      return true;
    }

    const hasAttendance =
      viewerState?.hasAttendance ??
      event.attendances?.some((attendance) => attendance.userId === userId) ??
      false;
    if (hasAttendance) {
      return true;
    }

    return event.genderMode === userGender;
  }

  private buildCheckInCode(eventId: string, userId: string) {
    return createHmac(
      'sha256',
      process.env.CHECK_IN_SECRET ?? process.env.JWT_ACCESS_SECRET ?? 'dev-check-in-secret',
    )
      .update(`${eventId}:${userId}`)
      .digest('hex')
      .slice(0, 24);
  }

  private normalizeIdempotencyKey(raw: string | undefined) {
    if (raw == null) {
      return null;
    }

    const value = raw.trim();
    if (value.length === 0) {
      return null;
    }

    if (value.length > 128) {
      throw new ApiError(400, 'invalid_idempotency_key', 'Idempotency key is invalid');
    }

    return value;
  }

}
