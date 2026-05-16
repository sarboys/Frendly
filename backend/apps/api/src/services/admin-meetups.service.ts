import { Injectable } from '@nestjs/common';
import {
  ChatKind,
  ChatOrigin,
  EventAccessMode,
  EventJoinMode,
  EventPriceMode,
  EventVisibilityMode,
  Prisma,
} from '@prisma/client';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

@Injectable()
export class AdminMeetupsService {
  constructor(private readonly prismaService: PrismaService) {}

  async listMeetups(query: Record<string, unknown> = {}) {
    const limit = this.parseLimit(query.limit);
    const rows = await this.prismaService.client.event.findMany({
      where: this.buildMeetupWhere(query),
      select: this.meetupListSelect(),
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    return this.page(
      rows,
      limit,
      (row) => this.mapListMeetup(row as any),
      (row) => ({ startsAt: row.startsAt.toISOString(), id: row.id }),
    );
  }

  async createMeetup(body: Record<string, unknown>) {
    const input = await this.parseCreateInput(body);
    const created = await this.prismaService.client.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          title: input.title,
          emoji: input.emoji,
          startsAt: input.startsAt,
          durationMinutes: input.durationMinutes,
          place: input.place,
          distanceKm: 0,
          latitude: input.latitude,
          longitude: input.longitude,
          vibe: input.vibe,
          tone: 'warm',
          joinMode: input.joinMode,
          lifestyle: 'neutral',
          priceMode: input.priceMode,
          priceAmountFrom: input.priceAmountFrom,
          priceAmountTo: input.priceAmountTo,
          accessMode: input.accessMode,
          genderMode: 'all',
          visibilityMode: input.visibilityMode,
          description: input.description,
          partnerId: input.partnerId,
          partnerName: input.partnerName,
          capacity: input.capacity,
          hostId: input.hostId,
          isCalm: true,
          isNewcomers: true,
          isDate: false,
          rules: Prisma.JsonNull,
        },
        select: { id: true },
      });

      const chat = await tx.chat.create({
        data: {
          kind: ChatKind.meetup,
          origin: ChatOrigin.meetup,
          title: input.title,
          emoji: input.emoji,
          eventId: event.id,
        },
        select: { id: true },
      });

      await tx.eventParticipant.create({
        data: {
          eventId: event.id,
          userId: input.hostId,
        },
      });
      await tx.eventAttendance.create({
        data: {
          eventId: event.id,
          userId: input.hostId,
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
          userId: input.hostId,
        },
      });

      return event;
    });

    return this.getMeetup(created.id);
  }

  async getMeetup(meetupId: string) {
    const event = await this.prismaService.client.event.findUnique({
      where: { id: meetupId },
      select: this.meetupDetailSelect(),
    });
    if (!event) {
      throw new ApiError(404, 'admin_meetup_not_found', 'Meetup not found');
    }

    return this.mapDetailMeetup(event as any);
  }

  async updateMeetup(meetupId: string, body: Record<string, unknown>) {
    await this.ensureMeetupExists(meetupId);
    const data = this.parseUpdateInput(body);

    if (Object.keys(data).length > 0) {
      await this.prismaService.client.event.update({
        where: { id: meetupId },
        data,
      });
    }

    return this.getMeetup(meetupId);
  }

  async cancelMeetup(meetupId: string, body: Record<string, unknown> = {}) {
    await this.ensureMeetupExists(meetupId);
    await this.prismaService.client.event.update({
      where: { id: meetupId },
      data: {
        canceledAt: new Date(),
        cancelReason: this.optionalText(body.reason),
      },
    });

    return this.getMeetup(meetupId);
  }

  async restoreMeetup(meetupId: string) {
    await this.ensureMeetupExists(meetupId);
    await this.prismaService.client.event.update({
      where: { id: meetupId },
      data: {
        canceledAt: null,
        cancelReason: null,
      },
    });

    return this.getMeetup(meetupId);
  }

  async listParticipants(meetupId: string, query: Record<string, unknown> = {}) {
    await this.ensureMeetupExists(meetupId);
    const limit = this.parseLimit(query.limit);
    const rows = await this.prismaService.client.eventParticipant.findMany({
      where: {
        AND: [
          { eventId: meetupId },
          this.joinedAtCursorWhere(query.cursor),
        ],
      },
      select: {
        id: true,
        userId: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            phoneNumber: true,
            verified: true,
            online: true,
            profile: {
              select: {
                avatarUrl: true,
                city: true,
              },
            },
          },
        },
      },
      orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    return this.page(
      rows,
      limit,
      (row) => ({
        id: row.id,
        userId: row.userId,
        displayName: row.user.displayName,
        email: row.user.email,
        phoneNumber: row.user.phoneNumber,
        verified: row.user.verified,
        online: row.user.online,
        avatarUrl: row.user.profile?.avatarUrl ?? null,
        city: row.user.profile?.city ?? null,
        joinedAt: row.joinedAt.toISOString(),
      }),
      (row) => ({ joinedAt: row.joinedAt.toISOString(), id: row.id }),
    );
  }

  async removeParticipant(meetupId: string, participantId: string) {
    const event = await this.prismaService.client.event.findUnique({
      where: { id: meetupId },
      select: {
        id: true,
        hostId: true,
        chat: { select: { id: true } },
      },
    });
    if (!event) {
      throw new ApiError(404, 'admin_meetup_not_found', 'Meetup not found');
    }

    const participant = await this.prismaService.client.eventParticipant.findFirst({
      where: { id: participantId, eventId: meetupId },
      select: { id: true, userId: true },
    });
    if (!participant) {
      throw new ApiError(404, 'admin_participant_not_found', 'Participant not found');
    }
    if (participant.userId === event.hostId) {
      throw new ApiError(409, 'admin_meetup_host_remove_forbidden', 'Host participant cannot be removed');
    }

    await this.prismaService.client.$transaction(async (tx) => {
      await tx.eventParticipant.delete({
        where: { id: participant.id },
      });
      if (event.chat) {
        await tx.chatMember.deleteMany({
          where: {
            chatId: event.chat.id,
            userId: participant.userId,
          },
        });
      }
    });

    return { ok: true };
  }

  async listJoinRequests(meetupId: string, query: Record<string, unknown> = {}) {
    await this.ensureMeetupExists(meetupId);
    const limit = this.parseLimit(query.limit);
    const rows = await this.prismaService.client.eventJoinRequest.findMany({
      where: {
        AND: [
          { eventId: meetupId },
          this.createdAtCursorWhere(query.cursor),
        ],
      },
      select: {
        id: true,
        userId: true,
        note: true,
        status: true,
        compatibilityScore: true,
        reviewedById: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            verified: true,
            online: true,
            profile: { select: { avatarUrl: true, city: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    return this.page(
      rows,
      limit,
      (row) => ({
        id: row.id,
        userId: row.userId,
        note: row.note,
        status: row.status,
        compatibilityScore: row.compatibilityScore,
        reviewedById: row.reviewedById,
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        user: {
          id: row.user.id,
          displayName: row.user.displayName,
          email: row.user.email,
          verified: row.user.verified,
          online: row.user.online,
          avatarUrl: row.user.profile?.avatarUrl ?? null,
          city: row.user.profile?.city ?? null,
        },
      }),
      (row) => ({ createdAt: row.createdAt.toISOString(), id: row.id }),
    );
  }

  async reviewJoinRequest(
    meetupId: string,
    requestId: string,
    status: 'approved' | 'rejected',
  ) {
    const event = await this.prismaService.client.event.findUnique({
      where: { id: meetupId },
      select: { id: true, hostId: true, chat: { select: { id: true } } },
    });
    if (!event) {
      throw new ApiError(404, 'admin_meetup_not_found', 'Meetup not found');
    }

    const request = await this.prismaService.client.eventJoinRequest.findFirst({
      where: { id: requestId, eventId: meetupId },
      select: { id: true, userId: true },
    });
    if (!request) {
      throw new ApiError(404, 'admin_join_request_not_found', 'Join request not found');
    }

    await this.prismaService.client.$transaction(async (tx) => {
      await tx.eventJoinRequest.update({
        where: { id: request.id },
        data: {
          status,
          reviewedAt: new Date(),
          reviewedById: event.hostId,
        },
      });

      if (status === 'approved') {
        await tx.eventParticipant.upsert({
          where: {
            eventId_userId: {
              eventId: meetupId,
              userId: request.userId,
            },
          },
          update: {},
          create: {
            eventId: meetupId,
            userId: request.userId,
          },
        });

        if (event.chat) {
          await tx.chatMember.upsert({
            where: {
              chatId_userId: {
                chatId: event.chat.id,
                userId: request.userId,
              },
            },
            update: {},
            create: {
              chatId: event.chat.id,
              userId: request.userId,
            },
          });
        }
      }
    });

    return { ok: true };
  }

  private parseLimit(value: unknown) {
    const text = this.optionalText(value);
    if (!text) {
      return DEFAULT_LIMIT;
    }

    const limit = Number(text);
    if (!Number.isInteger(limit) || limit < 1) {
      throw new ApiError(400, 'admin_invalid_limit', 'Limit is invalid');
    }

    return Math.min(limit, MAX_LIMIT);
  }

  private parseCursor(value: unknown) {
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
      // Normalize every cursor parse failure into the same API error.
    }

    throw new ApiError(400, 'admin_invalid_cursor', 'Cursor is invalid');
  }

  private optionalText(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }

    const text = value.trim();
    return text === '' ? null : text;
  }

  private requiredText(value: unknown, code: string) {
    const text = this.optionalText(value);
    if (!text) {
      throw new ApiError(400, code, 'Required text is missing');
    }

    return text;
  }

  private parseDate(value: unknown, code = 'admin_invalid_date') {
    const text = this.optionalText(value);
    if (!text) {
      return null;
    }

    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
      throw new ApiError(400, code, 'Date is invalid');
    }

    return date;
  }

  private parseBoolean(value: unknown, code = 'admin_invalid_boolean') {
    if (typeof value === 'boolean') {
      return value;
    }

    const text = this.optionalText(value)?.toLowerCase();
    if (!text) {
      return null;
    }
    if (text === 'true' || text === '1') {
      return true;
    }
    if (text === 'false' || text === '0') {
      return false;
    }

    throw new ApiError(400, code, 'Boolean is invalid');
  }

  private page<T, R>(
    rows: T[],
    limit: number,
    map: (row: T) => R,
    cursorFor: (row: T) => Record<string, unknown>,
  ) {
    const pageRows = rows.slice(0, limit);
    const hasNext = rows.length > limit;
    const lastRow = pageRows[pageRows.length - 1];

    return {
      items: pageRows.map(map),
      nextCursor: hasNext && lastRow ? this.encodeCursor(cursorFor(lastRow)) : null,
    };
  }

  private encodeCursor(cursor: Record<string, unknown>) {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  private buildMeetupWhere(query: Record<string, unknown>): Prisma.EventWhereInput {
    const and: Prisma.EventWhereInput[] = [];
    const search = this.optionalText(query.q);
    const city = this.optionalText(query.city);
    const status = this.optionalText(query.status);
    const joinMode = this.optionalText(query.joinMode);
    const priceMode = this.optionalText(query.priceMode);
    const hostId = this.optionalText(query.hostId);
    const partnerId = this.optionalText(query.partnerId);
    const startsFrom = this.parseDate(query.startsFrom, 'admin_meetup_starts_from_invalid');
    const startsTo = this.parseDate(query.startsTo, 'admin_meetup_starts_to_invalid');

    if (search) {
      and.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { place: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { host: { is: { displayName: { contains: search, mode: 'insensitive' } } } },
          { partner: { is: { name: { contains: search, mode: 'insensitive' } } } },
        ],
      });
    }
    if (city) {
      and.push({
        OR: [
          { host: { is: { profile: { is: { city } } } } },
          { partner: { is: { city } } },
        ],
      });
    }
    if (status) {
      and.push(this.statusWhere(status));
    }
    if (joinMode) {
      and.push({ joinMode: this.parseJoinMode(joinMode) });
    }
    if (priceMode) {
      and.push({ priceMode: this.parsePriceMode(priceMode) });
    }
    if (hostId) {
      and.push({ hostId });
    }
    if (partnerId) {
      and.push({ partnerId });
    }
    if (startsFrom || startsTo) {
      and.push({
        startsAt: {
          ...(startsFrom ? { gte: startsFrom } : {}),
          ...(startsTo ? { lte: startsTo } : {}),
        },
      });
    }

    and.push(this.startsAtCursorWhere(query.cursor));
    return and.length === 1 ? and[0] ?? {} : { AND: and };
  }

  private statusWhere(status: string): Prisma.EventWhereInput {
    const now = new Date();
    if (status === 'cancelled') {
      return { canceledAt: { not: null } };
    }
    if (status === 'live') {
      return {
        canceledAt: null,
        liveState: { is: { status: 'live' } },
      };
    }
    if (status === 'past') {
      return {
        canceledAt: null,
        startsAt: { lt: now },
        OR: [
          { liveState: { is: null } },
          { liveState: { is: { status: { not: 'live' } } } },
        ],
      };
    }
    if (status === 'upcoming') {
      return {
        canceledAt: null,
        startsAt: { gte: now },
        OR: [
          { liveState: { is: null } },
          { liveState: { is: { status: { not: 'live' } } } },
        ],
      };
    }

    throw new ApiError(400, 'admin_meetup_status_invalid', 'Meetup status is invalid');
  }

  private meetupListSelect() {
    return {
      id: true,
      title: true,
      emoji: true,
      place: true,
      startsAt: true,
      hostId: true,
      partnerId: true,
      partnerName: true,
      joinMode: true,
      priceMode: true,
      capacity: true,
      canceledAt: true,
      host: {
        select: {
          id: true,
          displayName: true,
          profile: { select: { city: true } },
        },
      },
      partner: {
        select: {
          id: true,
          name: true,
          city: true,
        },
      },
      liveState: {
        select: {
          status: true,
        },
      },
      _count: {
        select: {
          participants: true,
          joinRequests: true,
        },
      },
    };
  }

  private meetupDetailSelect() {
    return {
      ...this.meetupListSelect(),
      durationMinutes: true,
      distanceKm: true,
      latitude: true,
      longitude: true,
      vibe: true,
      tone: true,
      lifestyle: true,
      priceAmountFrom: true,
      priceAmountTo: true,
      accessMode: true,
      genderMode: true,
      visibilityMode: true,
      hostNote: true,
      description: true,
      partnerOffer: true,
      isAfterDark: true,
      afterDarkCategory: true,
      afterDarkGlow: true,
      dressCode: true,
      ageRange: true,
      ratioLabel: true,
      consentRequired: true,
      rules: true,
      canceledAt: true,
      cancelReason: true,
      sourceExternalContentItem: {
        select: {
          id: true,
          title: true,
          sourceProvider: true,
          sourceUrl: true,
          venueName: true,
          startsAt: true,
          publicStatus: true,
          moderationStatus: true,
        },
      },
      chat: {
        select: {
          id: true,
        },
      },
      createdAt: true,
      updatedAt: true,
    };
  }

  private mapListMeetup(event: any) {
    return {
      id: event.id,
      title: event.title,
      emoji: event.emoji,
      city: event.partner?.city ?? event.host?.profile?.city ?? null,
      place: event.place,
      startsAt: event.startsAt.toISOString(),
      hostId: event.hostId,
      hostName: event.host?.displayName ?? '',
      partnerId: event.partnerId,
      partnerName: event.partner?.name ?? event.partnerName ?? null,
      joinMode: event.joinMode,
      priceMode: event.priceMode,
      participantsCount: event._count?.participants ?? 0,
      joinRequestsCount: event._count?.joinRequests ?? 0,
      capacity: event.capacity,
      status: this.mapMeetupStatus(event),
    };
  }

  private mapDetailMeetup(event: any) {
    return {
      ...this.mapListMeetup(event),
      durationMinutes: event.durationMinutes,
      distanceKm: event.distanceKm,
      latitude: event.latitude,
      longitude: event.longitude,
      vibe: event.vibe,
      tone: event.tone,
      lifestyle: event.lifestyle,
      priceAmountFrom: event.priceAmountFrom,
      priceAmountTo: event.priceAmountTo,
      accessMode: event.accessMode,
      genderMode: event.genderMode,
      visibilityMode: event.visibilityMode,
      hostNote: event.hostNote,
      description: event.description,
      partnerOffer: event.partnerOffer,
      isAfterDark: event.isAfterDark,
      afterDarkCategory: event.afterDarkCategory,
      afterDarkGlow: event.afterDarkGlow,
      dressCode: event.dressCode,
      ageRange: event.ageRange,
      ratioLabel: event.ratioLabel,
      consentRequired: event.consentRequired,
      rules: event.rules,
      canceledAt: event.canceledAt?.toISOString() ?? null,
      cancelReason: event.cancelReason,
      chatId: event.chat?.id ?? null,
      sourceExternalContentItem: event.sourceExternalContentItem
        ? {
            ...event.sourceExternalContentItem,
            startsAt: event.sourceExternalContentItem.startsAt?.toISOString() ?? null,
          }
        : null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }

  private async parseCreateInput(body: Record<string, unknown>) {
    const hostId = this.requiredText(body.hostId, 'admin_meetup_host_required');
    await this.ensureHostExists(hostId);
    const partnerId = this.optionalText(body.partnerId);
    if (partnerId) {
      await this.ensurePartnerExists(partnerId);
    }
    const joinMode = this.parseJoinMode(body.joinMode);

    return {
      hostId,
      partnerId,
      title: this.requiredText(body.title, 'admin_meetup_title_required'),
      emoji: this.optionalText(body.emoji) ?? '🤝',
      startsAt: this.requiredDate(body.startsAt, 'admin_meetup_starts_at_invalid'),
      durationMinutes: this.parseIntRange(
        body.durationMinutes ?? 120,
        30,
        1440,
        'admin_meetup_duration_invalid',
      ),
      place: this.requiredText(body.place, 'admin_meetup_place_required'),
      latitude: this.optionalCoordinate(body.latitude, -90, 90, 'admin_meetup_lat_invalid'),
      longitude: this.optionalCoordinate(body.longitude, -180, 180, 'admin_meetup_lng_invalid'),
      vibe: this.optionalText(body.vibe) ?? 'Встреча',
      joinMode,
      priceMode: this.parsePriceMode(body.priceMode),
      priceAmountFrom: this.optionalInt(body.priceAmountFrom),
      priceAmountTo: this.optionalInt(body.priceAmountTo),
      accessMode: this.parseAccessMode(body.accessMode, joinMode),
      visibilityMode: this.parseVisibilityMode(body.visibilityMode),
      description: this.requiredText(body.description, 'admin_meetup_description_required'),
      partnerName: this.optionalText(body.partnerName),
      capacity: this.parseIntRange(body.capacity ?? 20, 2, 1000, 'admin_meetup_capacity_invalid'),
    };
  }

  private parseUpdateInput(body: Record<string, unknown>) {
    const data: Record<string, unknown> = {};

    this.setRequiredText(data, body, 'title', 'admin_meetup_title_required');
    this.setRequiredText(data, body, 'emoji', 'admin_meetup_emoji_required');
    this.setDate(data, body, 'startsAt', 'admin_meetup_starts_at_invalid');
    this.setIntRange(data, body, 'durationMinutes', 30, 1440, 'admin_meetup_duration_invalid');
    this.setRequiredText(data, body, 'place', 'admin_meetup_place_required');
    this.setCoordinate(data, body, 'latitude', -90, 90, 'admin_meetup_lat_invalid');
    this.setCoordinate(data, body, 'longitude', -180, 180, 'admin_meetup_lng_invalid');
    this.setRequiredText(data, body, 'vibe', 'admin_meetup_vibe_required');
    if (this.hasOwn(body, 'joinMode')) {
      data.joinMode = this.parseJoinMode(body.joinMode);
    }
    if (this.hasOwn(body, 'priceMode')) {
      data.priceMode = this.parsePriceMode(body.priceMode);
    }
    this.setOptionalInt(data, body, 'priceAmountFrom');
    this.setOptionalInt(data, body, 'priceAmountTo');
    if (this.hasOwn(body, 'accessMode')) {
      data.accessMode = this.parseAccessMode(body.accessMode, null);
    }
    if (this.hasOwn(body, 'visibilityMode')) {
      data.visibilityMode = this.parseVisibilityMode(body.visibilityMode);
    }
    this.setRequiredText(data, body, 'description', 'admin_meetup_description_required');
    this.setIntRange(data, body, 'capacity', 2, 1000, 'admin_meetup_capacity_invalid');

    return data as Prisma.EventUpdateInput;
  }

  private async ensureHostExists(hostId: string) {
    const user = await this.prismaService.client.user.findUnique({
      where: { id: hostId },
      select: { id: true },
    });
    if (!user) {
      throw new ApiError(404, 'admin_meetup_host_not_found', 'Host user not found');
    }
  }

  private async ensurePartnerExists(partnerId: string) {
    const partner = await this.prismaService.client.partner.findUnique({
      where: { id: partnerId },
      select: { id: true },
    });
    if (!partner) {
      throw new ApiError(404, 'admin_partner_not_found', 'Partner not found');
    }
  }

  private async ensureMeetupExists(meetupId: string) {
    const event = await this.prismaService.client.event.findUnique({
      where: { id: meetupId },
      select: { id: true },
    });
    if (!event) {
      throw new ApiError(404, 'admin_meetup_not_found', 'Meetup not found');
    }
  }

  private startsAtCursorWhere(cursorValue: unknown) {
    const cursor = this.parseCursor(cursorValue);
    if (!cursor) {
      return {};
    }

    const startsAt = this.requiredCursorDate(cursor, 'startsAt');
    const id = this.requiredCursorText(cursor, 'id');
    return {
      OR: [
        { startsAt: { lt: startsAt } },
        { startsAt, id: { lt: id } },
      ],
    };
  }

  private createdAtCursorWhere(cursorValue: unknown) {
    const cursor = this.parseCursor(cursorValue);
    if (!cursor) {
      return {};
    }

    const createdAt = this.requiredCursorDate(cursor, 'createdAt');
    const id = this.requiredCursorText(cursor, 'id');
    return {
      OR: [
        { createdAt: { lt: createdAt } },
        { createdAt, id: { lt: id } },
      ],
    };
  }

  private joinedAtCursorWhere(cursorValue: unknown) {
    const cursor = this.parseCursor(cursorValue);
    if (!cursor) {
      return {};
    }

    const joinedAt = this.requiredCursorDate(cursor, 'joinedAt');
    const id = this.requiredCursorText(cursor, 'id');
    return {
      OR: [
        { joinedAt: { lt: joinedAt } },
        { joinedAt, id: { lt: id } },
      ],
    };
  }

  private requiredCursorDate(cursor: Record<string, unknown>, key: string) {
    const date = this.parseDate(cursor[key], 'admin_invalid_cursor');
    if (!date) {
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

  private mapMeetupStatus(event: {
    startsAt: Date;
    canceledAt: Date | null;
    liveState: { status: string } | null;
  }) {
    if (event.canceledAt) {
      return 'cancelled';
    }
    if (event.liveState?.status === 'live') {
      return 'live';
    }
    return event.startsAt.getTime() < Date.now() ? 'past' : 'upcoming';
  }

  private requiredDate(value: unknown, code: string) {
    const date = this.parseDate(value, code);
    if (!date) {
      throw new ApiError(400, code, 'Date is invalid');
    }

    return date;
  }

  private parseIntRange(value: unknown, min: number, max: number, code: string) {
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

    return this.parseIntRange(value, 0, 1_000_000, 'admin_meetup_number_invalid');
  }

  private optionalCoordinate(value: unknown, min: number, max: number, code: string) {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new ApiError(400, code, 'Coordinate is invalid');
    }

    return parsed;
  }

  private parseJoinMode(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return EventJoinMode.open;
    }
    if (value === EventJoinMode.open || value === EventJoinMode.request) {
      return value;
    }

    throw new ApiError(400, 'admin_meetup_join_mode_invalid', 'Join mode is invalid');
  }

  private parsePriceMode(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return EventPriceMode.free;
    }
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

    throw new ApiError(400, 'admin_meetup_price_mode_invalid', 'Price mode is invalid');
  }

  private parseAccessMode(value: unknown, joinMode: EventJoinMode | null) {
    if (value === undefined || value === null || value === '') {
      return joinMode === EventJoinMode.request ? EventAccessMode.request : EventAccessMode.open;
    }
    if (
      value === EventAccessMode.open ||
      value === EventAccessMode.request ||
      value === EventAccessMode.free
    ) {
      return value;
    }

    throw new ApiError(400, 'admin_meetup_access_mode_invalid', 'Access mode is invalid');
  }

  private parseVisibilityMode(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return EventVisibilityMode.public;
    }
    if (
      value === EventVisibilityMode.public ||
      value === EventVisibilityMode.friends
    ) {
      return value;
    }

    throw new ApiError(400, 'admin_meetup_visibility_mode_invalid', 'Visibility mode is invalid');
  }

  private setRequiredText(
    data: Record<string, unknown>,
    body: Record<string, unknown>,
    key: string,
    code: string,
  ) {
    if (this.hasOwn(body, key)) {
      data[key] = this.requiredText(body[key], code);
    }
  }

  private setDate(
    data: Record<string, unknown>,
    body: Record<string, unknown>,
    key: string,
    code: string,
  ) {
    if (this.hasOwn(body, key)) {
      data[key] = this.requiredDate(body[key], code);
    }
  }

  private setIntRange(
    data: Record<string, unknown>,
    body: Record<string, unknown>,
    key: string,
    min: number,
    max: number,
    code: string,
  ) {
    if (this.hasOwn(body, key)) {
      data[key] = this.parseIntRange(body[key], min, max, code);
    }
  }

  private setOptionalInt(
    data: Record<string, unknown>,
    body: Record<string, unknown>,
    key: string,
  ) {
    if (this.hasOwn(body, key)) {
      data[key] = this.optionalInt(body[key]);
    }
  }

  private setCoordinate(
    data: Record<string, unknown>,
    body: Record<string, unknown>,
    key: string,
    min: number,
    max: number,
    code: string,
  ) {
    if (this.hasOwn(body, key)) {
      data[key] = this.optionalCoordinate(body[key], min, max, code);
    }
  }

  private hasOwn(source: Record<string, unknown>, key: string) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }
}
