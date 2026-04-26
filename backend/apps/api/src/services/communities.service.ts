import { decodeCursor, encodeCursor } from '@big-break/database';
import { ChatKind, ChatOrigin, CommunityPrivacy, Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { formatRelativeTime } from '../common/presenters';
import { PrismaService } from './prisma.service';
import { SubscriptionService } from './subscription.service';

const DEFAULT_COMMUNITY_LIMIT = 20;
const MAX_COMMUNITY_LIMIT = 50;
const LIST_NEWS_LIMIT = 2;
const LIST_MEETUP_LIMIT = 2;
const LIST_MEDIA_LIMIT = 4;
const DETAIL_NEWS_LIMIT = 3;
const DETAIL_MEETUP_LIMIT = 10;
const DETAIL_MEDIA_LIMIT = 12;
const DEFAULT_COMMUNITY_MEDIA_LIMIT = 30;
const MAX_COMMUNITY_MEDIA_LIMIT = 60;
const MEMBER_NAME_LIMIT = 5;
const CHAT_PREVIEW_LIMIT = 2;

@Injectable()
export class CommunitiesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async listCommunities(
    userId: string,
    params: { cursor?: string; limit?: number },
  ) {
    const take = this.normalizeLimit(params.limit);
    const cursorCommunity = await this.resolveCursor(params.cursor);

    const communities = await this.prismaService.client.community.findMany({
      where:
        cursorCommunity == null
          ? {}
          : {
              OR: [
                {
                  createdAt: {
                    gt: cursorCommunity.createdAt,
                  },
                },
                {
                  createdAt: cursorCommunity.createdAt,
                  id: {
                    gt: cursorCommunity.id,
                  },
                },
              ],
            },
      include: this.communityInclude({
        news: LIST_NEWS_LIMIT,
        meetups: LIST_MEETUP_LIMIT,
        media: LIST_MEDIA_LIMIT,
      }),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: take + 1,
    });

    const hasMore = communities.length > take;
    const page = hasMore ? communities.slice(0, take) : communities;
    const counters = await this.loadCounters(
      userId,
      page.map((community) => ({
        communityId: community.id,
        chatId: community.chatId,
      })),
    );

    return {
      items: page.map((community) =>
        this.mapCommunity(community, counters, userId),
      ),
      nextCursor:
        hasMore && page.length > 0
          ? encodeCursor({ value: page[page.length - 1]!.id })
          : null,
    };
  }

  async getCommunity(userId: string, communityId: string) {
    const community = await this.prismaService.client.community.findFirst({
      where: this.visibleCommunityWhere(userId, communityId),
      include: this.communityInclude({
        news: DETAIL_NEWS_LIMIT,
        meetups: DETAIL_MEETUP_LIMIT,
        media: DETAIL_MEDIA_LIMIT,
      }),
    });

    if (!community) {
      throw new ApiError(404, 'community_not_found', 'Community not found');
    }

    const counters = await this.loadCounters(userId, [
      { communityId: community.id, chatId: community.chatId },
    ]);
    return this.mapCommunity(community, counters, userId);
  }

  async listCommunityMedia(
    userId: string,
    communityId: string,
    params: { cursor?: string; limit?: number },
  ) {
    const community = await this.prismaService.client.community.findFirst({
      where: this.visibleCommunityWhere(userId, communityId),
      select: { id: true },
    });

    if (!community) {
      throw new ApiError(404, 'community_not_found', 'Community not found');
    }

    const take = this.normalizeMediaLimit(params.limit);
    const cursorMedia = await this.resolveMediaCursor(
      communityId,
      params.cursor,
    );
    const where: Prisma.CommunityMediaItemWhereInput =
      cursorMedia == null
        ? { communityId }
        : {
            AND: [
              { communityId },
              {
                OR: [
                  { sortOrder: { gt: cursorMedia.sortOrder } },
                  {
                    sortOrder: cursorMedia.sortOrder,
                    id: { gt: cursorMedia.id },
                  },
                ],
              },
            ],
          };

    const media = await this.prismaService.client.communityMediaItem.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      take: take + 1,
    });
    const hasMore = media.length > take;
    const page = hasMore ? media.slice(0, take) : media;

    return {
      items: page.map((item) => this.mapMediaItem(item)),
      nextCursor:
        hasMore && page.length > 0
          ? encodeCursor({ value: page[page.length - 1]!.id })
          : null,
    };
  }

  async createCommunityNews(
    userId: string,
    communityId: string,
    body: Record<string, unknown>,
  ) {
    const community = await this.prismaService.client.community.findFirst({
      where: {
        id: communityId,
        OR: [
          { createdById: userId },
          { privacy: CommunityPrivacy.public },
          { members: { some: { userId } } },
        ],
      },
      select: {
        id: true,
        createdById: true,
        members: {
          where: { userId },
          select: { role: true },
          take: 1,
        },
      },
    });

    if (!community) {
      throw new ApiError(404, 'community_not_found', 'Community not found');
    }

    const isOwner =
      community.createdById === userId ||
      community.members.some((member) => member.role === 'owner');
    if (!isOwner) {
      throw new ApiError(
        403,
        'community_owner_required',
        'Only community owner can publish news',
      );
    }

    const input = this.parseCreateNewsInput(body);

    await this.prismaService.client.$transaction(async (tx) => {
      const sortOrder = input.pin
        ? 0
        : await this.nextCommunityNewsSortOrder(tx, communityId);

      if (input.pin) {
        await tx.communityNewsItem.updateMany({
          where: { communityId },
          data: { sortOrder: { increment: 1 } },
        });
      }

      await tx.communityNewsItem.create({
        data: {
          communityId,
          title: input.title,
          blurb: input.body,
          timeLabel: 'сейчас',
          sortOrder,
        },
        select: { id: true },
      });
    });

    return this.getCommunity(userId, communityId);
  }

  async createCommunity(
    userId: string,
    body: Record<string, unknown>,
    rawIdempotencyKey?: string,
  ) {
    const hasPremium = await this.subscriptionService.hasPremiumAccess(userId);
    if (!hasPremium) {
      throw new ApiError(
        403,
        'community_plus_required',
        'Frendly Plus is required to create a community',
      );
    }

    const idempotencyKey = this.normalizeIdempotencyKey(rawIdempotencyKey);
    if (idempotencyKey != null) {
      const existing = await this.findCommunityByIdempotencyKey(
        userId,
        idempotencyKey,
      );
      if (existing) {
        return this.getCommunity(userId, existing.id);
      }
    }

    const input = this.parseCreateInput(body);

    let created: { id: string };
    try {
      created = await this.prismaService.client.$transaction(async (tx) => {
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
            joinRule:
              input.privacy === CommunityPrivacy.private
                ? 'Ручное одобрение'
                : 'Открытое вступление',
            premiumOnly: true,
            mood: input.purpose,
            sharedMediaLabel: '0 медиа',
            createdById: userId,
            chatId: chat.id,
            idempotencyKey,
            members: {
              create: {
                userId,
                role: 'owner',
              },
            },
            socialLinks: {
              createMany: {
                data: input.socialLinks.map((link, index) => ({
                  label: link.label,
                  handle: link.handle,
                  sortOrder: index,
                })),
              },
            },
          },
          select: { id: true },
        });

        await tx.chatMember.create({
          data: {
            chatId: chat.id,
            userId,
          },
        });

        return community;
      });
    } catch (error) {
      if (idempotencyKey != null && this.isUniqueConstraintError(error)) {
        const existing = await this.findCommunityByIdempotencyKey(
          userId,
          idempotencyKey,
        );
        if (existing) {
          return this.getCommunity(userId, existing.id);
        }
      }
      throw error;
    }

    return this.getCommunity(userId, created.id);
  }

  private communityInclude(limits?: {
    news?: number;
    meetups?: number;
    media?: number;
  }) {
    return {
      _count: {
        select: {
          members: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              displayName: true,
              online: true,
            },
          },
        },
        orderBy: { joinedAt: 'asc' as const },
        take: MEMBER_NAME_LIMIT,
      },
      news: {
        orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
        ...(limits?.news == null ? {} : { take: limits.news }),
      },
      meetups: {
        where: this.upcomingCommunityMeetupWhere(),
        orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
        ...(limits?.meetups == null ? {} : { take: limits.meetups }),
      },
      media: {
        orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
        ...(limits?.media == null ? {} : { take: limits.media }),
      },
      socialLinks: {
        orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
      },
      chat: {
        include: {
          messages: {
            include: {
              sender: {
                select: {
                  displayName: true,
                },
              },
            },
            orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
            take: CHAT_PREVIEW_LIMIT,
          },
        },
      },
    };
  }

  private upcomingCommunityMeetupWhere(): Prisma.CommunityMeetupItemWhereInput {
    return {
      OR: [
        { startsAt: null },
        {
          startsAt: {
            gte: new Date(),
          },
        },
      ],
    };
  }

  private async loadCounters(
    userId: string,
    communities: Array<{ communityId: string; chatId: string }>,
  ) {
    if (communities.length === 0) {
      return {
        onlineByCommunityId: new Map<string, number>(),
        unreadByChatId: new Map<string, number>(),
        membershipByCommunityId: new Map<string, { role: string }>(),
      };
    }

    const communityIds = communities.map((item) => item.communityId);
    const chatIds = communities.map((item) => item.chatId);

    const unreadCountsPromise =
      process.env.CHAT_UNREAD_COUNTER_READS === 'true'
        ? this.loadUnreadCounters(userId, chatIds)
        : this.countUnreadMessages(userId, chatIds);

    const [onlineGroups, unreadByChatId, memberships] = await Promise.all([
      this.prismaService.client.communityMember.groupBy({
        by: ['communityId'],
        where: {
          communityId: { in: communityIds },
          user: { online: true },
        },
        _count: {
          _all: true,
        },
      }),
      unreadCountsPromise,
      this.prismaService.client.communityMember.findMany({
        where: {
          communityId: { in: communityIds },
          userId,
        },
        select: {
          communityId: true,
          role: true,
        },
      }),
    ]);

    const onlineByCommunityId = new Map(
      onlineGroups.map((item) => [item.communityId, item._count._all]),
    );

    const membershipByCommunityId = new Map(
      memberships.map((membership) => [
        membership.communityId,
        { role: membership.role },
      ]),
    );

    return {
      onlineByCommunityId,
      unreadByChatId,
      membershipByCommunityId,
    };
  }

  private async loadUnreadCounters(userId: string, chatIds: string[]) {
    const rows = await this.prismaService.client.chatMember.findMany({
      where: {
        userId,
        chatId: {
          in: chatIds,
        },
      },
      select: {
        chatId: true,
        unreadCount: true,
      },
    });

    return new Map(
      rows.map((item) => [item.chatId, item.unreadCount]),
    );
  }

  private async countUnreadMessages(userId: string, chatIds: string[]) {
    const rows = await this.prismaService.client.$queryRaw<Array<{
      chat_id: string;
      unread_count: bigint | number;
    }>>`
      SELECT cm."chatId" AS chat_id, COUNT(m."id") AS unread_count
      FROM "ChatMember" cm
      LEFT JOIN "Message" last_read
        ON last_read."chatId" = cm."chatId"
        AND last_read."id" = cm."lastReadMessageId"
      LEFT JOIN "Message" m
        ON m."chatId" = cm."chatId"
        AND m."senderId" <> cm."userId"
        AND (
          COALESCE(cm."lastReadAt", last_read."createdAt") IS NULL
          OR m."createdAt" > COALESCE(cm."lastReadAt", last_read."createdAt")
        )
      WHERE cm."userId" = ${userId}
        AND cm."chatId" IN (${Prisma.join(chatIds)})
      GROUP BY cm."chatId"
    `;

    return new Map(
      rows.map((item) => [item.chat_id, Number(item.unread_count)]),
    );
  }

  private mapCommunity(
    community: any,
    counters: {
      onlineByCommunityId: Map<string, number>;
      unreadByChatId: Map<string, number>;
      membershipByCommunityId: Map<string, { role: string }>;
    },
    currentUserId: string,
  ) {
    const meetups = community.meetups.map((meetup: any) => ({
      id: meetup.id,
      title: meetup.title,
      emoji: meetup.emoji,
      time: meetup.timeLabel,
      place: meetup.place,
      format: meetup.format,
      going: meetup.going,
    }));
    const membership = counters.membershipByCommunityId.get(community.id);
    const isOwner =
      community.createdById === currentUserId || membership?.role === 'owner';

    return {
      id: community.id,
      chatId: community.chatId,
      name: community.name,
      avatar: community.avatar,
      description: community.description,
      privacy: community.privacy,
      members: community._count.members,
      online: counters.onlineByCommunityId.get(community.id) ?? 0,
      tags: this.stringArrayFromJson(community.tags),
      joinRule: community.joinRule,
      joined: membership != null || community.createdById === currentUserId,
      isOwner,
      premiumOnly: community.premiumOnly,
      unread: counters.unreadByChatId.get(community.chatId) ?? 0,
      mood: community.mood,
      sharedMediaLabel: community.sharedMediaLabel,
      nextMeetup: meetups[0] ?? null,
      news: community.news.map((item: any) => ({
        id: item.id,
        title: item.title,
        blurb: item.blurb,
        time: item.timeLabel,
      })),
      meetups,
      media: community.media.map((item: any) => this.mapMediaItem(item)),
      chatPreview: [...community.chat.messages]
        .reverse()
        .map((message: any) => ({
          author: message.sender.displayName,
          text: message.text,
          time: formatRelativeTime(message.createdAt),
        })),
      chatMessages: [],
      socialLinks: this.withDefaultSocialLinks(
        community.socialLinks.map((link: any) => ({
          id: link.id,
          label: link.label,
          handle: link.handle,
        })),
      ),
      memberNames: community.members.map(
        (member: any) => member.user.displayName,
      ),
    };
  }

  private parseCreateInput(body: Record<string, unknown>) {
    const name = this.requiredTrimmedString(body.name, 'name', 80);
    const avatar = this.requiredTrimmedString(body.avatar, 'avatar', 8);
    const description = this.requiredTrimmedString(
      body.description,
      'description',
      600,
    );
    const purpose =
      this.optionalTrimmedString(body.purpose, 80) ?? 'Городской клуб';
    const privacy =
      body.privacy === CommunityPrivacy.private
        ? CommunityPrivacy.private
        : CommunityPrivacy.public;
    const tags = this.normalizeTags(body.tags, purpose);
    const socialLinks = this.withDefaultSocialLinks(
      Array.isArray(body.socialLinks)
        ? body.socialLinks
            .filter((item): item is Record<string, unknown> => {
              return item != null && typeof item === 'object';
            })
            .map((item) => ({
              id: '',
              label: this.optionalTrimmedString(item.label, 40) ?? '',
              handle: this.optionalTrimmedString(item.handle, 80) ?? '',
            }))
        : [],
    );

    return {
      name,
      avatar,
      description,
      privacy,
      purpose,
      tags,
      socialLinks,
    };
  }

  private parseCreateNewsInput(body: Record<string, unknown>) {
    return {
      title: this.trimString(body.title),
      body: this.trimString(body.body ?? body.blurb),
      pin: body.pin !== false,
    };
  }

  private withDefaultSocialLinks(
    links: Array<{ id: string; label: string; handle: string }>,
  ) {
    const defaults = [
      { id: '', label: 'Telegram', handle: '' },
      { id: '', label: 'Instagram', handle: '' },
      { id: '', label: 'TikTok', handle: '' },
    ];

    return defaults.map((fallback, index) => {
      const link = links[index];
      if (!link) {
        return fallback;
      }

      return {
        id: link.id,
        label: link.label || fallback.label,
        handle: link.handle,
      };
    });
  }

  private normalizeTags(raw: unknown, purpose: string): Prisma.InputJsonValue {
    if (!Array.isArray(raw)) {
      return [purpose];
    }

    const tags = raw
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 8);

    return tags.length === 0 ? [purpose] : tags;
  }

  private requiredTrimmedString(
    raw: unknown,
    field: string,
    maxLength: number,
  ) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (value.length === 0 || value.length > maxLength) {
      throw new ApiError(
        400,
        'invalid_community_payload',
        `${field} is invalid`,
      );
    }

    return value;
  }

  private optionalTrimmedString(raw: unknown, maxLength: number) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (value.length === 0) {
      return null;
    }

    return value.slice(0, maxLength);
  }

  private trimString(raw: unknown) {
    return typeof raw === 'string' ? raw.trim() : '';
  }

  private stringArrayFromJson(raw: unknown) {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw.filter((item): item is string => typeof item === 'string');
  }

  private normalizeLimit(limit?: number) {
    if (limit == null || !Number.isFinite(limit)) {
      return DEFAULT_COMMUNITY_LIMIT;
    }

    return Math.max(1, Math.min(Math.trunc(limit), MAX_COMMUNITY_LIMIT));
  }

  private normalizeMediaLimit(limit?: number) {
    if (limit == null || !Number.isFinite(limit)) {
      return DEFAULT_COMMUNITY_MEDIA_LIMIT;
    }

    return Math.max(1, Math.min(Math.trunc(limit), MAX_COMMUNITY_MEDIA_LIMIT));
  }

  private visibleCommunityWhere(_userId: string, communityId: string) {
    return {
      id: communityId,
    };
  }

  private mapMediaItem(item: any) {
    return {
      id: item.id,
      emoji: item.emoji,
      label: item.label,
      kind: item.kind,
    };
  }

  private async resolveCursor(cursor?: string) {
    const cursorId = this.decodeCursor(cursor);
    if (cursorId == null) {
      return null;
    }

    return this.prismaService.client.community.findUnique({
      where: { id: cursorId },
      select: {
        id: true,
        createdAt: true,
      },
    });
  }

  private async resolveMediaCursor(communityId: string, cursor?: string) {
    const cursorId = this.decodeCursor(cursor);
    if (cursorId == null) {
      return null;
    }

    const media = await this.prismaService.client.communityMediaItem.findUnique(
      {
        where: { id: cursorId },
        select: {
          id: true,
          communityId: true,
          sortOrder: true,
        },
      },
    );

    if (media?.communityId !== communityId) {
      return null;
    }

    return media;
  }

  private async nextCommunityNewsSortOrder(
    tx: Prisma.TransactionClient,
    communityId: string,
  ) {
    const lastNews = await tx.communityNewsItem.findFirst({
      where: { communityId },
      orderBy: [{ sortOrder: 'desc' }, { id: 'desc' }],
      select: { sortOrder: true },
    });

    return (lastNews?.sortOrder ?? -1) + 1;
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

  private normalizeIdempotencyKey(raw: string | undefined) {
    if (raw == null) {
      return null;
    }

    const value = raw.trim();
    if (value.length === 0) {
      return null;
    }

    if (value.length > 128) {
      throw new ApiError(
        400,
        'invalid_idempotency_key',
        'Idempotency key is invalid',
      );
    }

    return value;
  }

  private findCommunityByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ) {
    return this.prismaService.client.community.findFirst({
      where: {
        createdById: userId,
        idempotencyKey,
      },
      select: { id: true },
    });
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
