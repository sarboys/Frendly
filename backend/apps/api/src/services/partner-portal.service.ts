import { Injectable } from '@nestjs/common';
import {
  ChatKind,
  ChatOrigin,
  CommunityMediaKind,
  CommunityPrivacy,
  EventAccessMode,
  EventJoinRequestStatus,
  EventJoinMode,
  EventPriceMode,
  PosterCategory,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { formatEventTime } from '../common/presenters';
import { PrismaService } from './prisma.service';

type CurrentPartner = {
  partnerAccountId: string;
  partnerId: string | null;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const FEATURE_TARGET_TYPES = new Set(['event', 'community', 'poster']);
const FEATURE_STATUSES = new Set(['draft', 'submitted', 'approved', 'rejected', 'archived']);
const POSTER_STATUSES = new Set(['draft', 'submitted', 'published', 'rejected', 'archived']);

@Injectable()
export class PartnerPortalService {
  constructor(private readonly prismaService: PrismaService) {}

  async listMeetups(current: CurrentPartner, query: Record<string, unknown> = {}) {
    const partnerId = this.requireApprovedPartner(current);
    const take = this.parseLimit(query.limit);
    const rows = await this.prismaService.client.event.findMany({
      where: {
        partnerId,
        canceledAt: null,
      },
      include: {
        _count: {
          select: {
            participants: true,
            joinRequests: true,
          },
        },
      },
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });

    return this.page(rows, take, (event) => this.mapMeetup(event));
  }

  async getMeetup(current: CurrentPartner, meetupId: string) {
    const partnerId = this.requireApprovedPartner(current);
    const event = await this.prismaService.client.event.findFirst({
      where: {
        id: meetupId,
        partnerId,
      },
      include: {
        _count: {
          select: {
            participants: true,
            joinRequests: true,
          },
        },
      },
    });

    if (!event) {
      throw new ApiError(404, 'partner_target_not_found', 'Partner meetup not found');
    }

    return this.mapMeetup(event);
  }

  async createMeetup(current: CurrentPartner, body: Record<string, unknown>) {
    const partnerId = this.requireApprovedPartner(current);
    const input = this.parseMeetupInput(body);
    const created = await this.prismaService.client.$transaction(async (tx) => {
      const hostUserId = await this.ensurePartnerHostUser(tx, partnerId);
      const event = await tx.event.create({
        data: {
          id: `ev-${randomUUID()}`,
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
          accessMode: input.joinMode === EventJoinMode.request ? EventAccessMode.request : EventAccessMode.open,
          genderMode: 'all',
          visibilityMode: 'public',
          description: input.description,
          partnerId,
          partnerName: input.partnerName,
          partnerOffer: input.partnerOffer,
          capacity: input.capacity,
          hostId: hostUserId,
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
          userId: hostUserId,
        },
      });
      await tx.eventAttendance.create({
        data: {
          eventId: event.id,
          userId: hostUserId,
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
          userId: hostUserId,
        },
      });

      return event;
    });

    return this.getMeetup(current, created.id);
  }

  async updateMeetup(current: CurrentPartner, meetupId: string, body: Record<string, unknown>) {
    const partnerId = this.requireApprovedPartner(current);
    const event = await this.prismaService.client.event.findFirst({
      where: { id: meetupId, partnerId },
      select: { id: true, startsAt: true },
    });
    if (!event) {
      throw new ApiError(404, 'partner_target_not_found', 'Partner meetup not found');
    }

    const data: Prisma.EventUpdateInput = {};
    this.setText(data, body, 'title');
    this.setText(data, body, 'emoji');
    this.setText(data, body, 'place');
    this.setText(data, body, 'description');
    this.setNullableText(data, body, 'partnerName');
    this.setNullableText(data, body, 'partnerOffer');
    if (body.latitude !== undefined) {
      data.latitude = this.optionalCoordinate(body.latitude, -90, 90, 'partner_lat_invalid');
    }
    if (body.longitude !== undefined) {
      data.longitude = this.optionalCoordinate(body.longitude, -180, 180, 'partner_lng_invalid');
    }

    if (event.startsAt.getTime() > Date.now()) {
      if (body.startsAt !== undefined) {
        data.startsAt = this.parseFutureDate(body.startsAt, 'partner_meetup_starts_at_invalid');
      }
      if (body.capacity !== undefined) {
        data.capacity = this.parseIntRange(body.capacity, 2, 100, 'partner_capacity_invalid');
      }
      if (body.joinMode !== undefined) {
        const joinMode = this.parseJoinMode(body.joinMode);
        data.joinMode = joinMode;
        data.accessMode = joinMode === 'request' ? 'request' : 'open';
      }
    }

    await this.prismaService.client.event.update({
      where: { id: meetupId },
      data,
    });

    return this.getMeetup(current, meetupId);
  }

  async cancelMeetup(current: CurrentPartner, meetupId: string, body: Record<string, unknown> = {}) {
    const partnerId = this.requireApprovedPartner(current);
    const result = await this.prismaService.client.event.updateMany({
      where: {
        id: meetupId,
        partnerId,
        canceledAt: null,
      },
      data: {
        canceledAt: new Date(),
        cancelReason: this.optionalText(body.reason),
      },
    });

    if (result.count === 0) {
      throw new ApiError(404, 'partner_target_not_found', 'Partner meetup not found');
    }

    return { ok: true };
  }

  async listMeetupParticipants(current: CurrentPartner, meetupId: string, query: Record<string, unknown> = {}) {
    const partnerId = this.requireApprovedPartner(current);
    const take = this.parseLimit(query.limit);
    await this.assertOwnEvent(partnerId, meetupId);
    const rows = await this.prismaService.client.eventParticipant.findMany({
      where: { eventId: meetupId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            verified: true,
            online: true,
            profile: { select: { avatarUrl: true } },
          },
        },
      },
      orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });

    return this.page(rows, take, (participant) => ({
      id: participant.id,
      userId: participant.userId,
      displayName: participant.user.displayName,
      avatarUrl: participant.user.profile?.avatarUrl ?? null,
      verified: participant.user.verified,
      online: participant.user.online,
      joinedAt: participant.joinedAt.toISOString(),
    }));
  }

  async listMeetupJoinRequests(current: CurrentPartner, meetupId: string, query: Record<string, unknown> = {}) {
    const partnerId = this.requireApprovedPartner(current);
    const take = this.parseLimit(query.limit);
    await this.assertOwnEvent(partnerId, meetupId);
    const rows = await this.prismaService.client.eventJoinRequest.findMany({
      where: {
        eventId: meetupId,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            verified: true,
            online: true,
            profile: { select: { avatarUrl: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });

    return this.page(rows, take, (request) => ({
      id: request.id,
      userId: request.userId,
      note: request.note,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      displayName: request.user.displayName,
      avatarUrl: request.user.profile?.avatarUrl ?? null,
      verified: request.user.verified,
      online: request.user.online,
    }));
  }

  async reviewMeetupJoinRequest(
    current: CurrentPartner,
    meetupId: string,
    requestId: string,
    status: 'approved' | 'rejected',
  ) {
    const partnerId = this.requireApprovedPartner(current);
    const event = await this.prismaService.client.event.findFirst({
      where: { id: meetupId, partnerId },
      select: { id: true, hostId: true, chat: { select: { id: true } } },
    });
    if (!event) {
      throw new ApiError(404, 'partner_target_not_found', 'Partner meetup not found');
    }

    const request = await this.prismaService.client.eventJoinRequest.findFirst({
      where: {
        id: requestId,
        eventId: meetupId,
        status: EventJoinRequestStatus.pending,
      },
      select: { id: true, userId: true },
    });
    if (!request) {
      throw new ApiError(404, 'partner_target_not_found', 'Partner join request not found');
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
      if (status === 'approved' && event.chat) {
        await tx.eventParticipant.upsert({
          where: { eventId_userId: { eventId: meetupId, userId: request.userId } },
          update: {},
          create: { eventId: meetupId, userId: request.userId },
        });
        await tx.chatMember.upsert({
          where: { chatId_userId: { chatId: event.chat.id, userId: request.userId } },
          update: {},
          create: { chatId: event.chat.id, userId: request.userId },
        });
      }
    });

    return { ok: true };
  }

  async listCommunities(current: CurrentPartner, query: Record<string, unknown> = {}) {
    const partnerId = this.requireApprovedPartner(current);
    const take = this.parseLimit(query.limit);
    const rows = await this.prismaService.client.community.findMany({
      where: { partnerId, archivedAt: null },
      include: {
        _count: { select: { members: true, news: true, media: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });

    return this.page(rows, take, (community) => this.mapCommunity(community));
  }

  async getCommunity(current: CurrentPartner, communityId: string) {
    const partnerId = this.requireApprovedPartner(current);
    const community = await this.prismaService.client.community.findFirst({
      where: { id: communityId, partnerId },
      include: {
        news: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        media: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        socialLinks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        _count: { select: { members: true, news: true, media: true } },
      },
    });
    if (!community) {
      throw new ApiError(404, 'partner_target_not_found', 'Partner community not found');
    }
    return this.mapCommunity(community);
  }

  async createCommunity(current: CurrentPartner, body: Record<string, unknown>) {
    const partnerId = this.requireApprovedPartner(current);
    const input = this.parseCommunityInput(body);
    const created = await this.prismaService.client.$transaction(async (tx) => {
      const hostUserId = await this.ensurePartnerHostUser(tx, partnerId);
      const chat = await tx.chat.create({
        data: {
          kind: ChatKind.community,
          origin: ChatOrigin.community,
          title: input.name,
          emoji: input.avatar,
        },
        select: { id: true },
      });
      const community = await tx.community.create({
        data: {
          name: input.name,
          avatar: input.avatar,
          description: input.description,
          privacy: input.privacy,
          tags: input.tags,
          joinRule: input.privacy === CommunityPrivacy.private ? 'Ручное одобрение' : 'Открытое вступление',
          premiumOnly: false,
          mood: input.mood,
          sharedMediaLabel: '0 медиа',
          createdById: hostUserId,
          partnerId,
          chatId: chat.id,
          members: {
            create: { userId: hostUserId, role: 'owner' },
          },
        },
        select: { id: true },
      });
      await tx.chatMember.create({ data: { chatId: chat.id, userId: hostUserId } });
      return community;
    });

    return this.getCommunity(current, created.id);
  }

  async updateCommunity(current: CurrentPartner, communityId: string, body: Record<string, unknown>) {
    const partnerId = this.requireApprovedPartner(current);
    const data: Prisma.CommunityUpdateInput = {};
    this.setText(data, body, 'name');
    this.setText(data, body, 'avatar');
    this.setText(data, body, 'description');
    this.setText(data, body, 'mood');
    if (body.privacy !== undefined) {
      data.privacy = this.parseCommunityPrivacy(body.privacy);
    }
    if (body.tags !== undefined) {
      data.tags = this.parseStringArray(body.tags);
    }

    const result = await this.prismaService.client.community.updateMany({
      where: { id: communityId, partnerId },
      data,
    });
    if (result.count === 0) {
      throw new ApiError(404, 'partner_target_not_found', 'Partner community not found');
    }
    return this.getCommunity(current, communityId);
  }

  async archiveCommunity(current: CurrentPartner, communityId: string) {
    const partnerId = this.requireApprovedPartner(current);
    const result = await this.prismaService.client.community.updateMany({
      where: { id: communityId, partnerId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    if (result.count === 0) {
      throw new ApiError(404, 'partner_target_not_found', 'Partner community not found');
    }
    return { ok: true };
  }

  async createCommunityNews(current: CurrentPartner, communityId: string, body: Record<string, unknown>) {
    const partnerId = this.requireApprovedPartner(current);
    await this.assertOwnCommunity(partnerId, communityId);
    const news = await this.prismaService.client.communityNewsItem.create({
      data: {
        communityId,
        title: this.requiredText(body.title, 'partner_news_title_required'),
        blurb: this.requiredText(body.blurb ?? body.body, 'partner_news_body_required'),
        timeLabel: 'сейчас',
        sortOrder: await this.nextNewsSortOrder(communityId),
      },
    });
    return news;
  }

  async updateCommunityNews(current: CurrentPartner, communityId: string, newsId: string, body: Record<string, unknown>) {
    const partnerId = this.requireApprovedPartner(current);
    await this.assertOwnCommunity(partnerId, communityId);
    const result = await this.prismaService.client.communityNewsItem.updateMany({
      where: { id: newsId, communityId },
      data: {
        ...(body.title !== undefined ? { title: this.requiredText(body.title, 'partner_news_title_required') } : {}),
        ...(body.blurb !== undefined || body.body !== undefined
          ? { blurb: this.requiredText(body.blurb ?? body.body, 'partner_news_body_required') }
          : {}),
      },
    });
    if (result.count === 0) {
      throw new ApiError(404, 'partner_target_not_found', 'Partner news not found');
    }
    return { ok: true };
  }

  async deleteCommunityNews(current: CurrentPartner, communityId: string, newsId: string) {
    const partnerId = this.requireApprovedPartner(current);
    await this.assertOwnCommunity(partnerId, communityId);
    await this.prismaService.client.communityNewsItem.deleteMany({ where: { id: newsId, communityId } });
    return { ok: true };
  }

  async createCommunityMedia(current: CurrentPartner, communityId: string, body: Record<string, unknown>) {
    const partnerId = this.requireApprovedPartner(current);
    await this.assertOwnCommunity(partnerId, communityId);
    return this.prismaService.client.communityMediaItem.create({
      data: {
        communityId,
        emoji: this.optionalText(body.emoji) ?? '📷',
        label: this.requiredText(body.label, 'partner_media_label_required'),
        kind: this.parseCommunityMediaKind(body.kind),
        sortOrder: await this.nextMediaSortOrder(communityId),
      },
    });
  }

  async updateCommunityMedia(current: CurrentPartner, communityId: string, mediaId: string, body: Record<string, unknown>) {
    const partnerId = this.requireApprovedPartner(current);
    await this.assertOwnCommunity(partnerId, communityId);
    const result = await this.prismaService.client.communityMediaItem.updateMany({
      where: { id: mediaId, communityId },
      data: {
        ...(body.emoji !== undefined ? { emoji: this.requiredText(body.emoji, 'partner_media_emoji_required') } : {}),
        ...(body.label !== undefined ? { label: this.requiredText(body.label, 'partner_media_label_required') } : {}),
        ...(body.kind !== undefined ? { kind: this.parseCommunityMediaKind(body.kind) } : {}),
      },
    });
    if (result.count === 0) {
      throw new ApiError(404, 'partner_target_not_found', 'Partner media not found');
    }
    return { ok: true };
  }

  async deleteCommunityMedia(current: CurrentPartner, communityId: string, mediaId: string) {
    const partnerId = this.requireApprovedPartner(current);
    await this.assertOwnCommunity(partnerId, communityId);
    await this.prismaService.client.communityMediaItem.deleteMany({ where: { id: mediaId, communityId } });
    return { ok: true };
  }

  async listPosters(current: CurrentPartner, query: Record<string, unknown> = {}) {
    const partnerId = this.requireApprovedPartner(current);
    const take = this.parseLimit(query.limit);
    const rows = await this.prismaService.client.poster.findMany({
      where: { partnerId },
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    return this.page(rows, take, (poster) => this.mapPoster(poster));
  }

  async getPoster(current: CurrentPartner, posterId: string) {
    const partnerId = this.requireApprovedPartner(current);
    const poster = await this.prismaService.client.poster.findFirst({ where: { id: posterId, partnerId } });
    if (!poster) {
      throw new ApiError(404, 'partner_target_not_found', 'Partner poster not found');
    }
    return this.mapPoster(poster);
  }

  async createPoster(current: CurrentPartner, body: Record<string, unknown>) {
    const partnerId = this.requireApprovedPartner(current);
    const input = this.parsePosterInput(body);
    const poster = await this.prismaService.client.poster.create({
      data: {
        id: `poster-${randomUUID()}`,
        ...input,
        partnerId,
        status: 'draft',
        provider: 'partner',
        tone: 'warm',
        distanceKm: 0,
        isFeatured: false,
      },
    });
    return this.mapPoster(poster);
  }

  async updatePoster(current: CurrentPartner, posterId: string, body: Record<string, unknown>) {
    const partnerId = this.requireApprovedPartner(current);
    const data: Prisma.PosterUpdateInput = {};
    this.setText(data, body, 'title');
    this.setText(data, body, 'emoji');
    this.setText(data, body, 'venue');
    this.setText(data, body, 'address');
    this.setText(data, body, 'description');
    this.setText(data, body, 'ticketUrl');
    if (body.category !== undefined) {
      data.category = this.parsePosterCategory(body.category);
    }
    if (body.startsAt !== undefined) {
      const startsAt = this.parseFutureDate(body.startsAt, 'partner_poster_starts_at_invalid');
      data.startsAt = startsAt;
      data.dateLabel = this.dateLabel(startsAt);
      data.timeLabel = this.timeLabel(startsAt);
    }
    if (body.priceFrom !== undefined) {
      data.priceFrom = this.parseIntRange(body.priceFrom, 0, 1_000_000, 'partner_price_invalid');
    }
    if (body.tags !== undefined) {
      data.tags = this.parseStringArray(body.tags);
    }
    if (body.status !== undefined) {
      data.status = this.parsePosterStatus(body.status);
    }

    const result = await this.prismaService.client.poster.updateMany({
      where: { id: posterId, partnerId },
      data,
    });
    if (result.count === 0) {
      throw new ApiError(404, 'partner_target_not_found', 'Partner poster not found');
    }
    return this.getPoster(current, posterId);
  }

  async submitPoster(current: CurrentPartner, posterId: string) {
    return this.updatePoster(current, posterId, { status: 'submitted' });
  }

  async archivePoster(current: CurrentPartner, posterId: string) {
    return this.updatePoster(current, posterId, { status: 'archived' });
  }

  async listFeaturedRequests(current: CurrentPartner, query: Record<string, unknown> = {}) {
    const partnerId = this.requireApprovedPartner(current);
    const take = this.parseLimit(query.limit);
    const rows = await this.prismaService.client.partnerFeaturedRequest.findMany({
      where: { partnerId },
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    return this.page(rows, take, (request) => this.mapFeaturedRequest(request));
  }

  async getFeaturedRequest(current: CurrentPartner, requestId: string) {
    const partnerId = this.requireApprovedPartner(current);
    const request = await this.prismaService.client.partnerFeaturedRequest.findFirst({
      where: { id: requestId, partnerId },
    });
    if (!request) {
      throw new ApiError(404, 'partner_target_not_found', 'Partner featured request not found');
    }
    return this.mapFeaturedRequest(request);
  }

  async createFeaturedRequest(current: CurrentPartner, body: Record<string, unknown>) {
    const partnerId = this.requireApprovedPartner(current);
    const input = this.parseFeaturedRequestInput(body);
    await this.assertOwnFeaturedTarget(partnerId, input.targetType, input.targetId);
    const request = await this.prismaService.client.partnerFeaturedRequest.create({
      data: {
        ...input,
        partnerId,
        status: 'draft',
      },
    });
    return this.mapFeaturedRequest(request);
  }

  async updateFeaturedRequest(current: CurrentPartner, requestId: string, body: Record<string, unknown>) {
    const partnerId = this.requireApprovedPartner(current);
    const data: Prisma.PartnerFeaturedRequestUpdateInput = {};
    this.setText(data, body, 'city');
    this.setText(data, body, 'placement');
    this.setText(data, body, 'title');
    this.setText(data, body, 'description');
    if (body.startsAt !== undefined) {
      data.startsAt = this.parseDate(body.startsAt, 'partner_feature_starts_at_invalid');
    }
    if (body.endsAt !== undefined) {
      data.endsAt = this.parseDate(body.endsAt, 'partner_feature_ends_at_invalid');
    }
    if (body.status !== undefined) {
      data.status = this.parseFeaturedStatus(body.status);
    }

    const result = await this.prismaService.client.partnerFeaturedRequest.updateMany({
      where: { id: requestId, partnerId },
      data,
    });
    if (result.count === 0) {
      throw new ApiError(404, 'partner_target_not_found', 'Partner featured request not found');
    }
    return this.getFeaturedRequest(current, requestId);
  }

  async submitFeaturedRequest(current: CurrentPartner, requestId: string) {
    return this.updateFeaturedRequest(current, requestId, { status: 'submitted' });
  }

  async archiveFeaturedRequest(current: CurrentPartner, requestId: string) {
    return this.updateFeaturedRequest(current, requestId, { status: 'archived' });
  }

  private requireApprovedPartner(current: CurrentPartner) {
    if (!current.partnerId) {
      throw new ApiError(403, 'partner_account_pending', 'Partner account is not approved');
    }
    return current.partnerId;
  }

  private async ensurePartnerHostUser(tx: Prisma.TransactionClient, partnerId: string) {
    const partner = await tx.partner.findUnique({
      where: { id: partnerId },
      select: { id: true, name: true, city: true, status: true, hostUserId: true },
    });
    if (!partner || partner.status !== 'active') {
      throw new ApiError(403, 'partner_inactive', 'Partner is inactive');
    }
    if (partner.hostUserId) {
      return partner.hostUserId;
    }

    const user = await tx.user.create({
      data: {
        id: `partner-user-${partner.id}`,
        displayName: partner.name,
        verified: true,
        profile: {
          create: {
            city: partner.city,
          },
        },
      },
      select: { id: true },
    });
    await tx.partner.update({
      where: { id: partner.id },
      data: { hostUserId: user.id },
    });
    return user.id;
  }

  private async assertOwnEvent(partnerId: string, eventId: string) {
    const event = await this.prismaService.client.event.findFirst({
      where: { id: eventId, partnerId },
      select: { id: true },
    });
    if (!event) {
      throw new ApiError(404, 'partner_target_not_found', 'Partner meetup not found');
    }
  }

  private async assertOwnCommunity(partnerId: string, communityId: string) {
    const community = await this.prismaService.client.community.findFirst({
      where: { id: communityId, partnerId },
      select: { id: true },
    });
    if (!community) {
      throw new ApiError(404, 'partner_target_not_found', 'Partner community not found');
    }
  }

  private async assertOwnFeaturedTarget(partnerId: string, targetType: string, targetId: string) {
    if (targetType === 'event') {
      const event = await this.prismaService.client.event.findFirst({
        where: { id: targetId, partnerId },
        select: { id: true },
      });
      if (event) return;
    }
    if (targetType === 'community') {
      const community = await this.prismaService.client.community.findFirst({
        where: { id: targetId, partnerId },
        select: { id: true },
      });
      if (community) return;
    }
    if (targetType === 'poster') {
      const poster = await this.prismaService.client.poster.findFirst({
        where: { id: targetId, partnerId },
        select: { id: true },
      });
      if (poster) return;
    }
    throw new ApiError(404, 'partner_target_not_found', 'Partner target not found');
  }

  private async nextNewsSortOrder(communityId: string) {
    const last = await this.prismaService.client.communityNewsItem.findFirst({
      where: { communityId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  private async nextMediaSortOrder(communityId: string) {
    const last = await this.prismaService.client.communityMediaItem.findFirst({
      where: { communityId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  private parseMeetupInput(body: Record<string, unknown>) {
    const startsAt = this.parseFutureDate(body.startsAt, 'partner_meetup_starts_at_invalid');
    const joinMode = this.parseJoinMode(body.joinMode);
    return {
      title: this.requiredText(body.title, 'partner_meetup_title_required'),
      emoji: this.optionalText(body.emoji) ?? '🤝',
      startsAt,
      durationMinutes: this.parseIntRange(body.durationMinutes ?? 120, 30, 1440, 'partner_duration_invalid'),
      place: this.requiredText(body.place, 'partner_meetup_place_required'),
      latitude: this.optionalCoordinate(body.latitude, -90, 90, 'partner_lat_invalid'),
      longitude: this.optionalCoordinate(body.longitude, -180, 180, 'partner_lng_invalid'),
      vibe: this.optionalText(body.vibe) ?? 'Партнерская встреча',
      joinMode,
      priceMode: this.parsePriceMode(body.priceMode),
      priceAmountFrom: this.optionalInt(body.priceAmountFrom),
      priceAmountTo: this.optionalInt(body.priceAmountTo),
      description: this.requiredText(body.description, 'partner_meetup_description_required'),
      partnerName: this.optionalText(body.partnerName),
      partnerOffer: this.optionalText(body.partnerOffer),
      capacity: this.parseIntRange(body.capacity ?? 20, 2, 100, 'partner_capacity_invalid'),
    };
  }

  private parseCommunityInput(body: Record<string, unknown>) {
    return {
      name: this.requiredText(body.name, 'partner_community_name_required'),
      avatar: this.optionalText(body.avatar) ?? '🤝',
      description: this.requiredText(body.description, 'partner_community_description_required'),
      privacy: this.parseCommunityPrivacy(body.privacy),
      tags: this.parseStringArray(body.tags),
      mood: this.optionalText(body.mood) ?? 'Партнерское сообщество',
    };
  }

  private parsePosterInput(body: Record<string, unknown>) {
    const startsAt = this.parseFutureDate(body.startsAt, 'partner_poster_starts_at_invalid');
    return {
      category: this.parsePosterCategory(body.category),
      city: this.optionalText(body.city) ?? 'Москва',
      title: this.requiredText(body.title, 'partner_poster_title_required'),
      emoji: this.optionalText(body.emoji) ?? '🎟️',
      startsAt,
      dateLabel: this.dateLabel(startsAt),
      timeLabel: this.timeLabel(startsAt),
      venue: this.requiredText(body.venue, 'partner_poster_venue_required'),
      address: this.requiredText(body.address, 'partner_poster_address_required'),
      priceFrom: this.parseIntRange(body.priceFrom ?? 0, 0, 1_000_000, 'partner_price_invalid'),
      ticketUrl: this.requiredText(body.ticketUrl, 'partner_ticket_url_required'),
      tags: this.parseStringArray(body.tags),
      description: this.requiredText(body.description, 'partner_poster_description_required'),
    };
  }

  private parseFeaturedRequestInput(body: Record<string, unknown>) {
    const targetType = this.requiredText(body.targetType, 'partner_feature_target_type_required');
    if (!FEATURE_TARGET_TYPES.has(targetType)) {
      throw new ApiError(400, 'partner_feature_target_type_invalid', 'Featured target type is invalid');
    }
    const startsAt = this.parseDate(body.startsAt, 'partner_feature_starts_at_invalid');
    const endsAt = this.parseDate(body.endsAt, 'partner_feature_ends_at_invalid');
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new ApiError(400, 'partner_feature_period_invalid', 'Featured request period is invalid');
    }
    return {
      targetType,
      targetId: this.requiredText(body.targetId, 'partner_feature_target_id_required'),
      city: this.requiredText(body.city, 'partner_feature_city_required'),
      placement: this.requiredText(body.placement, 'partner_feature_placement_required'),
      title: this.requiredText(body.title, 'partner_feature_title_required'),
      description: this.requiredText(body.description, 'partner_feature_description_required'),
      startsAt,
      endsAt,
    };
  }

  private parseLimit(raw: unknown) {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      return DEFAULT_LIMIT;
    }
    return Math.max(1, Math.min(Math.trunc(raw), MAX_LIMIT));
  }

  private page<T, R>(rows: T[], take: number, map: (row: T) => R) {
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    return {
      items: page.map(map),
      nextCursor: hasMore && page.length > 0 ? this.rowId(page[page.length - 1]!) : null,
    };
  }

  private rowId(row: unknown) {
    return typeof row === 'object' && row != null && 'id' in row && typeof row.id === 'string'
      ? row.id
      : null;
  }

  private requiredText(value: unknown, code: string) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new ApiError(400, code, 'Required partner field is missing');
    }
    return value.trim();
  }

  private optionalText(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  private setText(data: Record<string, unknown>, body: Record<string, unknown>, key: string) {
    if (body[key] !== undefined) {
      data[key] = this.requiredText(body[key], `partner_${key}_required`);
    }
  }

  private setNullableText(data: Record<string, unknown>, body: Record<string, unknown>, key: string) {
    if (body[key] !== undefined) {
      data[key] = this.optionalText(body[key]);
    }
  }

  private parseDate(value: unknown, code: string) {
    if (typeof value !== 'string') {
      throw new ApiError(400, code, 'Date is invalid');
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new ApiError(400, code, 'Date is invalid');
    }
    return date;
  }

  private parseFutureDate(value: unknown, code: string) {
    const date = this.parseDate(value, code);
    if (date.getTime() < Date.now() - 60_000) {
      throw new ApiError(400, code, 'Date must be in the future');
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
    return this.parseIntRange(value, 0, 1_000_000, 'partner_number_invalid');
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

  private parseStringArray(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim());
  }

  private parseJoinMode(value: unknown) {
    return value === EventJoinMode.request ? EventJoinMode.request : EventJoinMode.open;
  }

  private parsePriceMode(value: unknown) {
    return value === EventPriceMode.fixed ||
      value === EventPriceMode.from ||
      value === EventPriceMode.upto ||
      value === EventPriceMode.range ||
      value === EventPriceMode.split
      ? value
      : EventPriceMode.free;
  }

  private parseCommunityPrivacy(value: unknown) {
    return value === CommunityPrivacy.private ? CommunityPrivacy.private : CommunityPrivacy.public;
  }

  private parseCommunityMediaKind(value: unknown) {
    if (value === CommunityMediaKind.video || value === CommunityMediaKind.doc) {
      return value;
    }
    return CommunityMediaKind.photo;
  }

  private parsePosterCategory(value: unknown) {
    if (
      value === PosterCategory.concert ||
      value === PosterCategory.sport ||
      value === PosterCategory.exhibition ||
      value === PosterCategory.theatre ||
      value === PosterCategory.standup ||
      value === PosterCategory.festival ||
      value === PosterCategory.cinema
    ) {
      return value;
    }
    return PosterCategory.concert;
  }

  private parsePosterStatus(value: unknown) {
    const status = this.requiredText(value, 'partner_poster_status_required');
    if (!POSTER_STATUSES.has(status)) {
      throw new ApiError(400, 'partner_poster_status_invalid', 'Poster status is invalid');
    }
    return status;
  }

  private parseFeaturedStatus(value: unknown) {
    const status = this.requiredText(value, 'partner_feature_status_required');
    if (!FEATURE_STATUSES.has(status)) {
      throw new ApiError(400, 'partner_feature_status_invalid', 'Featured request status is invalid');
    }
    return status;
  }

  private dateLabel(date: Date) {
    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private timeLabel(date: Date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  private mapMeetup(event: any) {
    return {
      id: event.id,
      partnerId: event.partnerId,
      title: event.title,
      emoji: event.emoji,
      startsAt: event.startsAt.toISOString(),
      time: formatEventTime(event.startsAt),
      place: event.place,
      description: event.description,
      capacity: event.capacity,
      joinMode: event.joinMode,
      priceMode: event.priceMode,
      priceAmountFrom: event.priceAmountFrom,
      priceAmountTo: event.priceAmountTo,
      participantsCount: event._count?.participants ?? 0,
      joinRequestsCount: event._count?.joinRequests ?? 0,
      canceledAt: event.canceledAt?.toISOString() ?? null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }

  private mapCommunity(community: any) {
    return {
      id: community.id,
      partnerId: community.partnerId,
      name: community.name,
      avatar: community.avatar,
      description: community.description,
      privacy: community.privacy,
      tags: Array.isArray(community.tags) ? community.tags : [],
      mood: community.mood,
      membersCount: community._count?.members ?? 0,
      newsCount: community._count?.news ?? 0,
      mediaCount: community._count?.media ?? 0,
      news: community.news ?? [],
      media: community.media ?? [],
      socialLinks: community.socialLinks ?? [],
      archivedAt: community.archivedAt?.toISOString() ?? null,
      createdAt: community.createdAt.toISOString(),
      updatedAt: community.updatedAt.toISOString(),
    };
  }

  private mapPoster(poster: any) {
    return {
      id: poster.id,
      partnerId: poster.partnerId,
      category: poster.category,
      title: poster.title,
      emoji: poster.emoji,
      startsAt: poster.startsAt.toISOString(),
      date: poster.dateLabel,
      time: poster.timeLabel,
      venue: poster.venue,
      address: poster.address,
      priceFrom: poster.priceFrom,
      ticketUrl: poster.ticketUrl,
      provider: poster.provider,
      tags: Array.isArray(poster.tags) ? poster.tags : [],
      description: poster.description,
      status: poster.status,
      isFeatured: poster.isFeatured,
      createdAt: poster.createdAt.toISOString(),
      updatedAt: poster.updatedAt.toISOString(),
    };
  }

  private mapFeaturedRequest(request: any) {
    return {
      id: request.id,
      partnerId: request.partnerId,
      targetType: request.targetType,
      targetId: request.targetId,
      city: request.city,
      placement: request.placement,
      title: request.title,
      description: request.description,
      startsAt: request.startsAt.toISOString(),
      endsAt: request.endsAt.toISOString(),
      status: request.status,
      reviewNote: request.reviewNote,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }
}
