import { Injectable } from '@nestjs/common';
import {
  ChatKind,
  ChatOrigin,
  CommunityMediaKind,
  CommunityMemberRole,
  CommunityPrivacy,
  Prisma,
} from '@prisma/client';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

@Injectable()
export class AdminCommunitiesService {
  constructor(private readonly prismaService: PrismaService) {}

  async listCommunities(query: Record<string, unknown> = {}) {
    const limit = this.parseLimit(query.limit);
    const rows = await this.prismaService.client.community.findMany({
      where: this.buildCommunityWhere(query),
      select: this.communityListSelect(),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    return this.page(
      rows,
      limit,
      (row) => this.mapListCommunity(row as any),
      (row) => ({ createdAt: row.createdAt.toISOString(), id: row.id }),
    );
  }

  async createCommunity(body: Record<string, unknown>) {
    const input = await this.parseCreateInput(body);
    const created = await this.prismaService.client.$transaction(async (tx) => {
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
          joinRule: input.joinRule,
          premiumOnly: input.premiumOnly,
          mood: input.mood,
          sharedMediaLabel: input.sharedMediaLabel,
          createdById: input.ownerId,
          partnerId: input.partnerId,
          chatId: chat.id,
          members: {
            create: { userId: input.ownerId, role: CommunityMemberRole.owner },
          },
        },
        select: { id: true },
      });
      await tx.chatMember.create({
        data: { chatId: chat.id, userId: input.ownerId },
      });
      return community;
    });

    return this.getCommunity(created.id);
  }

  async getCommunity(communityId: string) {
    const community = await this.prismaService.client.community.findUnique({
      where: { id: communityId },
      select: this.communityDetailSelect(),
    });
    if (!community) {
      throw new ApiError(404, 'admin_community_not_found', 'Community not found');
    }

    return this.mapDetailCommunity(community as any);
  }

  async updateCommunity(communityId: string, body: Record<string, unknown>) {
    await this.ensureCommunityExists(communityId);
    const data = this.parseUpdateInput(body);
    if (Object.keys(data).length > 0) {
      await this.prismaService.client.community.update({
        where: { id: communityId },
        data,
      });
    }

    return this.getCommunity(communityId);
  }

  async archiveCommunity(communityId: string) {
    await this.ensureCommunityExists(communityId);
    await this.prismaService.client.community.update({
      where: { id: communityId },
      data: { archivedAt: new Date() },
    });

    return this.getCommunity(communityId);
  }

  async restoreCommunity(communityId: string) {
    await this.ensureCommunityExists(communityId);
    await this.prismaService.client.community.update({
      where: { id: communityId },
      data: { archivedAt: null },
    });

    return this.getCommunity(communityId);
  }

  async listMembers(communityId: string, query: Record<string, unknown> = {}) {
    await this.ensureCommunityExists(communityId);
    const limit = this.parseLimit(query.limit);
    const rows = await this.prismaService.client.communityMember.findMany({
      where: {
        AND: [
          { communityId },
          this.joinedAtCursorWhere(query.cursor),
        ],
      },
      select: {
        id: true,
        userId: true,
        role: true,
        joinedAt: true,
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
      orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    return this.page(
      rows,
      limit,
      (row) => ({
        id: row.id,
        userId: row.userId,
        role: row.role,
        joinedAt: row.joinedAt.toISOString(),
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
      (row) => ({ joinedAt: row.joinedAt.toISOString(), id: row.id }),
    );
  }

  async removeMember(communityId: string, memberId: string) {
    const community = await this.getCommunityAccess(communityId);
    const member = await this.getMember(communityId, memberId);
    if (member.role === CommunityMemberRole.owner) {
      await this.assertNotLastOwner(communityId);
    }

    await this.prismaService.client.$transaction(async (tx) => {
      await tx.communityMember.delete({ where: { id: member.id } });
      await tx.chatMember.deleteMany({
        where: {
          chatId: community.chatId,
          userId: member.userId,
        },
      });
    });

    return { ok: true };
  }

  async updateMemberRole(
    communityId: string,
    memberId: string,
    body: Record<string, unknown>,
  ) {
    const role = this.parseMemberRole(body.role);
    const member = await this.getMember(communityId, memberId);
    if (member.role === CommunityMemberRole.owner && role !== CommunityMemberRole.owner) {
      await this.assertNotLastOwner(communityId);
    }

    const updated = await this.prismaService.client.communityMember.update({
      where: { id: member.id },
      data: { role },
      select: {
        id: true,
        userId: true,
        role: true,
        joinedAt: true,
      },
    });

    return {
      ...updated,
      joinedAt: updated.joinedAt.toISOString(),
    };
  }

  async listNews(communityId: string, query: Record<string, unknown> = {}) {
    await this.ensureCommunityExists(communityId);
    const limit = this.parseLimit(query.limit);
    const rows = await this.prismaService.client.communityNewsItem.findMany({
      where: { communityId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      take: limit,
    });

    return { items: rows.map((row) => this.mapNews(row)) };
  }

  async createNews(communityId: string, body: Record<string, unknown>) {
    await this.ensureCommunityExists(communityId);
    const news = await this.prismaService.client.communityNewsItem.create({
      data: {
        communityId,
        title: this.requiredText(body.title, 'admin_community_news_title_required'),
        blurb: this.requiredText(body.blurb ?? body.body, 'admin_community_news_blurb_required'),
        timeLabel: this.optionalText(body.timeLabel) ?? 'сейчас',
        sortOrder: await this.nextNewsSortOrder(communityId),
      },
    });

    return this.mapNews(news);
  }

  async updateNews(communityId: string, newsId: string, body: Record<string, unknown>) {
    await this.ensureCommunityExists(communityId);
    const data: Record<string, unknown> = {};
    this.setRequiredText(data, body, 'title', 'admin_community_news_title_required');
    if (this.hasOwn(body, 'blurb') || this.hasOwn(body, 'body')) {
      data.blurb = this.requiredText(
        body.blurb ?? body.body,
        'admin_community_news_blurb_required',
      );
    }
    this.setRequiredText(data, body, 'timeLabel', 'admin_community_news_time_label_required');
    this.setInt(data, body, 'sortOrder', 0, 1_000_000, 'admin_community_sort_order_invalid');

    const result = await this.prismaService.client.communityNewsItem.updateMany({
      where: { id: newsId, communityId },
      data,
    });
    if (result.count === 0) {
      throw new ApiError(404, 'admin_community_news_not_found', 'Community news not found');
    }

    return { ok: true };
  }

  async deleteNews(communityId: string, newsId: string) {
    await this.ensureCommunityExists(communityId);
    await this.prismaService.client.communityNewsItem.deleteMany({
      where: { id: newsId, communityId },
    });

    return { ok: true };
  }

  async listMedia(communityId: string, query: Record<string, unknown> = {}) {
    await this.ensureCommunityExists(communityId);
    const limit = this.parseLimit(query.limit);
    const rows = await this.prismaService.client.communityMediaItem.findMany({
      where: { communityId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      take: limit,
    });

    return { items: rows.map((row) => this.mapMedia(row)) };
  }

  async createMedia(communityId: string, body: Record<string, unknown>) {
    await this.ensureCommunityExists(communityId);
    const media = await this.prismaService.client.communityMediaItem.create({
      data: {
        communityId,
        emoji: this.optionalText(body.emoji) ?? '📷',
        label: this.requiredText(body.label, 'admin_community_media_label_required'),
        kind: this.parseMediaKind(body.kind),
        sortOrder: await this.nextMediaSortOrder(communityId),
      },
    });

    return this.mapMedia(media);
  }

  async updateMedia(communityId: string, mediaId: string, body: Record<string, unknown>) {
    await this.ensureCommunityExists(communityId);
    const data: Record<string, unknown> = {};
    this.setRequiredText(data, body, 'emoji', 'admin_community_media_emoji_required');
    this.setRequiredText(data, body, 'label', 'admin_community_media_label_required');
    if (this.hasOwn(body, 'kind')) {
      data.kind = this.parseMediaKind(body.kind);
    }
    this.setInt(data, body, 'sortOrder', 0, 1_000_000, 'admin_community_sort_order_invalid');

    const result = await this.prismaService.client.communityMediaItem.updateMany({
      where: { id: mediaId, communityId },
      data,
    });
    if (result.count === 0) {
      throw new ApiError(404, 'admin_community_media_not_found', 'Community media not found');
    }

    return { ok: true };
  }

  async deleteMedia(communityId: string, mediaId: string) {
    await this.ensureCommunityExists(communityId);
    await this.prismaService.client.communityMediaItem.deleteMany({
      where: { id: mediaId, communityId },
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

  private buildCommunityWhere(query: Record<string, unknown>): Prisma.CommunityWhereInput {
    const and: Prisma.CommunityWhereInput[] = [];
    const search = this.optionalText(query.q);
    const city = this.optionalText(query.city);
    const privacy = this.optionalText(query.privacy);
    const archived = this.parseBoolean(query.archived);
    const partnerId = this.optionalText(query.partnerId);
    const createdFrom = this.parseDate(query.createdFrom, 'admin_community_created_from_invalid');
    const createdTo = this.parseDate(query.createdTo, 'admin_community_created_to_invalid');

    if (search) {
      and.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { mood: { contains: search, mode: 'insensitive' } },
          { createdBy: { is: { displayName: { contains: search, mode: 'insensitive' } } } },
          { partner: { is: { name: { contains: search, mode: 'insensitive' } } } },
        ],
      });
    }
    if (city) {
      and.push({
        OR: [
          { createdBy: { is: { profile: { is: { city } } } } },
          { partner: { is: { city } } },
        ],
      });
    }
    if (privacy) {
      and.push({ privacy: this.parsePrivacy(privacy) });
    }
    if (archived != null) {
      and.push(archived ? { archivedAt: { not: null } } : { archivedAt: null });
    }
    if (partnerId) {
      and.push({ partnerId });
    }
    if (createdFrom || createdTo) {
      and.push({
        createdAt: {
          ...(createdFrom ? { gte: createdFrom } : {}),
          ...(createdTo ? { lte: createdTo } : {}),
        },
      });
    }

    and.push(this.createdAtCursorWhere(query.cursor));
    return and.length === 1 ? and[0] ?? {} : { AND: and };
  }

  private communityListSelect() {
    return {
      id: true,
      name: true,
      avatar: true,
      privacy: true,
      partnerId: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      createdById: true,
      createdBy: {
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
      _count: {
        select: {
          members: true,
          news: true,
          media: true,
        },
      },
    };
  }

  private communityDetailSelect() {
    return {
      ...this.communityListSelect(),
      description: true,
      tags: true,
      joinRule: true,
      premiumOnly: true,
      mood: true,
      sharedMediaLabel: true,
      chatId: true,
      socialLinks: {
        orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
        select: {
          id: true,
          label: true,
          handle: true,
          sortOrder: true,
        },
      },
    };
  }

  private mapListCommunity(community: any) {
    return {
      id: community.id,
      name: community.name,
      avatar: community.avatar,
      city: community.partner?.city ?? community.createdBy?.profile?.city ?? null,
      privacy: community.privacy,
      ownerId: community.createdById,
      ownerName: community.createdBy?.displayName ?? '',
      partnerId: community.partnerId,
      partnerName: community.partner?.name ?? null,
      membersCount: community._count?.members ?? 0,
      newsCount: community._count?.news ?? 0,
      mediaCount: community._count?.media ?? 0,
      archivedAt: community.archivedAt?.toISOString() ?? null,
      createdAt: community.createdAt.toISOString(),
      updatedAt: community.updatedAt.toISOString(),
    };
  }

  private mapDetailCommunity(community: any) {
    return {
      ...this.mapListCommunity(community),
      description: community.description,
      tags: community.tags,
      joinRule: community.joinRule,
      premiumOnly: community.premiumOnly,
      mood: community.mood,
      sharedMediaLabel: community.sharedMediaLabel,
      chatId: community.chatId,
      owner: community.createdBy
        ? {
            id: community.createdBy.id,
            displayName: community.createdBy.displayName,
            city: community.createdBy.profile?.city ?? null,
          }
        : null,
      partner: community.partner,
      socialLinks: community.socialLinks,
    };
  }

  private async parseCreateInput(body: Record<string, unknown>) {
    const ownerId = this.requiredText(body.ownerId, 'admin_community_owner_required');
    await this.ensureOwnerExists(ownerId);
    const partnerId = this.optionalText(body.partnerId);
    if (partnerId) {
      await this.ensurePartnerExists(partnerId);
    }
    const privacy = this.parsePrivacy(body.privacy);

    return {
      ownerId,
      partnerId,
      name: this.requiredText(body.name, 'admin_community_name_required'),
      avatar: this.optionalText(body.avatar) ?? '🤝',
      description: this.requiredText(body.description, 'admin_community_description_required'),
      privacy,
      tags: this.parseStringArray(body.tags),
      joinRule:
        this.optionalText(body.joinRule) ??
        (privacy === CommunityPrivacy.private ? 'Ручное одобрение' : 'Открытое вступление'),
      premiumOnly: this.parseBoolean(body.premiumOnly) ?? false,
      mood: this.optionalText(body.mood) ?? 'Сообщество',
      sharedMediaLabel: this.optionalText(body.sharedMediaLabel) ?? '0 медиа',
    };
  }

  private parseUpdateInput(body: Record<string, unknown>) {
    const data: Record<string, unknown> = {};
    this.setRequiredText(data, body, 'name', 'admin_community_name_required');
    this.setRequiredText(data, body, 'avatar', 'admin_community_avatar_required');
    this.setRequiredText(data, body, 'description', 'admin_community_description_required');
    if (this.hasOwn(body, 'privacy')) {
      data.privacy = this.parsePrivacy(body.privacy);
    }
    if (this.hasOwn(body, 'tags')) {
      data.tags = this.parseStringArray(body.tags);
    }
    this.setRequiredText(data, body, 'joinRule', 'admin_community_join_rule_required');
    if (this.hasOwn(body, 'premiumOnly')) {
      data.premiumOnly = this.parseBoolean(body.premiumOnly) ?? false;
    }
    this.setRequiredText(data, body, 'mood', 'admin_community_mood_required');
    this.setRequiredText(
      data,
      body,
      'sharedMediaLabel',
      'admin_community_shared_media_label_required',
    );

    return data as Prisma.CommunityUpdateInput;
  }

  private async ensureOwnerExists(ownerId: string) {
    const user = await this.prismaService.client.user.findUnique({
      where: { id: ownerId },
      select: { id: true },
    });
    if (!user) {
      throw new ApiError(404, 'admin_community_owner_not_found', 'Owner user not found');
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

  private async ensureCommunityExists(communityId: string) {
    const community = await this.prismaService.client.community.findUnique({
      where: { id: communityId },
      select: { id: true },
    });
    if (!community) {
      throw new ApiError(404, 'admin_community_not_found', 'Community not found');
    }
  }

  private async getCommunityAccess(communityId: string) {
    const community = await this.prismaService.client.community.findUnique({
      where: { id: communityId },
      select: { id: true, chatId: true },
    });
    if (!community) {
      throw new ApiError(404, 'admin_community_not_found', 'Community not found');
    }

    return community;
  }

  private async getMember(communityId: string, memberId: string) {
    const member = await this.prismaService.client.communityMember.findFirst({
      where: { id: memberId, communityId },
      select: { id: true, userId: true, role: true },
    });
    if (!member) {
      throw new ApiError(404, 'admin_community_member_not_found', 'Community member not found');
    }

    return member;
  }

  private async assertNotLastOwner(communityId: string) {
    const ownersCount = await this.prismaService.client.communityMember.count({
      where: { communityId, role: CommunityMemberRole.owner },
    });
    if (ownersCount <= 1) {
      throw new ApiError(409, 'admin_community_last_owner_forbidden', 'Last owner cannot be removed');
    }
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

  private mapNews(news: { id: string; title: string; blurb: string; timeLabel: string; sortOrder: number; createdAt: Date }) {
    return {
      id: news.id,
      title: news.title,
      blurb: news.blurb,
      timeLabel: news.timeLabel,
      sortOrder: news.sortOrder,
      createdAt: news.createdAt.toISOString(),
    };
  }

  private mapMedia(media: {
    id: string;
    emoji: string;
    label: string;
    kind: CommunityMediaKind;
    sortOrder: number;
    createdAt: Date;
  }) {
    return {
      id: media.id,
      emoji: media.emoji,
      label: media.label,
      kind: media.kind,
      sortOrder: media.sortOrder,
      createdAt: media.createdAt.toISOString(),
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

  private parsePrivacy(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return CommunityPrivacy.public;
    }
    if (value === CommunityPrivacy.public || value === CommunityPrivacy.private) {
      return value;
    }

    throw new ApiError(400, 'admin_community_privacy_invalid', 'Community privacy is invalid');
  }

  private parseMemberRole(value: unknown) {
    if (
      value === CommunityMemberRole.owner ||
      value === CommunityMemberRole.moderator ||
      value === CommunityMemberRole.member
    ) {
      return value;
    }

    throw new ApiError(400, 'admin_community_member_role_invalid', 'Community member role is invalid');
  }

  private parseMediaKind(value: unknown) {
    if (value === CommunityMediaKind.video || value === CommunityMediaKind.doc) {
      return value;
    }
    return CommunityMediaKind.photo;
  }

  private parseStringArray(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim());
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

  private setInt(
    data: Record<string, unknown>,
    body: Record<string, unknown>,
    key: string,
    min: number,
    max: number,
    code: string,
  ) {
    if (!this.hasOwn(body, key)) {
      return;
    }

    const parsed = typeof body[key] === 'number' ? body[key] : Number(body[key]);
    const intValue = Math.trunc(parsed);
    if (!Number.isFinite(intValue) || intValue < min || intValue > max) {
      throw new ApiError(400, code, 'Number is invalid');
    }
    data[key] = intValue;
  }

  private hasOwn(source: Record<string, unknown>, key: string) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }
}
