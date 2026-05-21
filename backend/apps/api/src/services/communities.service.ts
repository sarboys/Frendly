import {
  buildMediaProxyPath,
  decodeCursor,
  encodeCursor,
  getBlockedUserIds as loadBlockedUserIds,
} from '@big-break/database';
import { ChatKind, ChatOrigin, CommunityMemberRole, CommunityPrivacy, Prisma } from '@prisma/client';
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

type CommunityCursor = {
  id: string;
  createdAt: Date;
};

type CommunityMediaCursor = {
  id: string;
  communityId: string;
  sortOrder: number;
};

@Injectable()
export class CommunitiesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async listCommunities(
    userId: string,
    params: {
      cursor?: string;
      limit?: number;
      q?: string;
      topics?: string | string[];
      privacy?: string;
      sort?: string;
    },
  ) {
    const take = this.normalizeLimit(params.limit);
    const cursorCommunity = await this.resolveCursor(params.cursor);
    const where = this.buildCommunityListWhere(params, cursorCommunity);

    const communities = await this.prismaService.client.community.findMany({
      where,
      select: this.communitySelect({
        news: LIST_NEWS_LIMIT,
        meetups: LIST_MEETUP_LIMIT,
        media: LIST_MEDIA_LIMIT,
      }),
      orderBy: this.communityListOrderBy(params.sort),
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
          ? this.encodeCommunityCursor(page[page.length - 1]!)
          : null,
    };
  }

  async getCommunity(userId: string, communityId: string) {
    const community = await this.prismaService.client.community.findFirst({
      where: this.visibleCommunityWhere(userId, communityId),
      select: this.communitySelect({
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
      where: this.communityContentWhere(userId, communityId),
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
      select: {
        id: true,
        communityId: true,
        emoji: true,
        label: true,
        kind: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      take: take + 1,
    });
    const hasMore = media.length > take;
    const page = hasMore ? media.slice(0, take) : media;

    return {
      items: page.map((item) => this.mapMediaItem(item)),
      nextCursor:
        hasMore && page.length > 0
          ? this.encodeMediaCursor(page[page.length - 1]!)
          : null,
    };
  }

  async joinCommunity(userId: string, communityId: string) {
    const community = await this.prismaService.client.community.findFirst({
      where: {
        id: communityId,
      },
      select: {
        id: true,
        chatId: true,
        privacy: true,
        createdById: true,
      },
    });

    if (!community) {
      throw new ApiError(404, 'community_not_found', 'Community not found');
    }

    if (community.privacy === CommunityPrivacy.private) {
      throw new ApiError(
        409,
        'community_join_request_required',
        'Community join request is required',
      );
    }

    await this.prismaService.client.$transaction(async (tx) => {
      await tx.communityMember.upsert({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId,
          },
        },
        create: {
          communityId: community.id,
          userId,
          role: 'member',
        },
        update: {},
      });
      await tx.chatMember.upsert({
        where: {
          chatId_userId: {
            chatId: community.chatId,
            userId,
          },
        },
        create: {
          chatId: community.chatId,
          userId,
        },
        update: {},
      });
    });

    return this.getCommunity(userId, community.id);
  }

  async createJoinRequest(
    userId: string,
    communityId: string,
    body: Record<string, unknown> = {},
  ) {
    const community = await this.prismaService.client.community.findFirst({
      where: { id: communityId },
      select: {
        id: true,
        privacy: true,
        createdById: true,
        members: {
          where: { userId },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!community) {
      throw new ApiError(404, 'community_not_found', 'Community not found');
    }
    if (community.createdById === userId || (community.members ?? []).length > 0) {
      throw new ApiError(409, 'community_already_joined', 'Community already joined');
    }
    if (community.privacy !== CommunityPrivacy.private) {
      return this.joinCommunity(userId, communityId);
    }

    const note = this.optionalTrimmedString(body.note, 240);
    const request = await this.prismaService.client.communityJoinRequest.upsert({
      where: {
        communityId_userId: {
          communityId: community.id,
          userId,
        },
      },
      create: {
        communityId: community.id,
        userId,
        status: 'pending',
        ...(note ? { note } : {}),
      },
      update: {
        status: 'pending',
        reviewedAt: null,
        reviewedById: null,
        ...(note ? { note } : {}),
      },
      select: this.communityJoinRequestSelect(),
    });

    return this.mapJoinRequest(request);
  }

  async cancelJoinRequest(userId: string, communityId: string) {
    await this.prismaService.client.communityJoinRequest.deleteMany({
      where: {
        communityId,
        userId,
        status: 'pending',
      },
    });

    return this.getCommunity(userId, communityId);
  }

  async listAdminOverview(userId: string, communityId: string) {
    const community = await this.getAdminCommunity(userId, communityId);
    const [pendingRequests, meetups, posts] = await Promise.all([
      this.prismaService.client.communityJoinRequest.count({
        where: { communityId, status: 'pending' },
      }),
      this.prismaService.client.communityMeetupItem.count({
        where: { communityId },
      }),
      this.prismaService.client.communityNewsItem.count({
        where: { communityId },
      }),
    ]);

    return {
      id: community.id,
      name: community.name,
      role: community.members[0]?.role ?? CommunityMemberRole.owner,
      stats: {
        members: community._count.members,
        requests: pendingRequests,
        meetups,
        posts,
      },
    };
  }

  async listAdminMembers(userId: string, communityId: string) {
    await this.getAdminCommunity(userId, communityId);
    const rows = await this.prismaService.client.communityMember.findMany({
      where: { communityId },
      select: {
        id: true,
        userId: true,
        role: true,
        joinedAt: true,
        user: {
          select: {
            displayName: true,
            profile: { select: { avatarUrl: true } },
          },
        },
      },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        name: row.user.displayName,
        avatarUrl: row.user.profile?.avatarUrl ?? null,
        role: row.role,
        joinedAt: row.joinedAt.toISOString(),
      })),
    };
  }

  async updateAdminMemberRole(
    userId: string,
    communityId: string,
    memberId: string,
    body: Record<string, unknown>,
  ) {
    await this.getAdminCommunity(userId, communityId);
    const role =
      body.role === CommunityMemberRole.moderator
        ? CommunityMemberRole.moderator
        : CommunityMemberRole.member;
    const member = await this.prismaService.client.communityMember.findFirst({
      where: { id: memberId, communityId },
      select: { id: true, role: true },
    });
    if (!member) {
      throw new ApiError(404, 'community_member_not_found', 'Community member not found');
    }
    if (member.role === CommunityMemberRole.owner) {
      throw new ApiError(409, 'community_owner_protected', 'Community owner is protected');
    }
    const updated = await this.prismaService.client.communityMember.update({
      where: { id: member.id },
      data: { role },
      select: { id: true, userId: true, role: true, joinedAt: true },
    });
    return {
      ...updated,
      joinedAt: updated.joinedAt.toISOString(),
    };
  }

  async removeAdminMember(userId: string, communityId: string, memberId: string) {
    const community = await this.getAdminCommunity(userId, communityId);
    const member = await this.prismaService.client.communityMember.findFirst({
      where: { id: memberId, communityId },
      select: { id: true, userId: true, role: true },
    });
    if (!member) {
      throw new ApiError(404, 'community_member_not_found', 'Community member not found');
    }
    if (member.role === CommunityMemberRole.owner) {
      throw new ApiError(409, 'community_owner_protected', 'Community owner is protected');
    }
    await this.prismaService.client.$transaction(async (tx) => {
      await tx.communityMember.delete({ where: { id: member.id } });
      await tx.chatMember.deleteMany({
        where: { chatId: community.chatId, userId: member.userId },
      });
    });
    return { ok: true };
  }

  async listJoinRequests(userId: string, communityId: string) {
    await this.getAdminCommunity(userId, communityId);
    const rows = await this.prismaService.client.communityJoinRequest.findMany({
      where: { communityId, status: 'pending' },
      select: this.communityJoinRequestSelect(),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    return { items: rows.map((row) => this.mapJoinRequest(row)) };
  }

  async reviewJoinRequest(
    userId: string,
    communityId: string,
    requestId: string,
    status: 'approved' | 'rejected',
  ) {
    const community = await this.getAdminCommunity(userId, communityId);
    const request = await this.prismaService.client.communityJoinRequest.findFirst({
      where: { id: requestId, communityId, status: 'pending' },
      select: {
        id: true,
        communityId: true,
        userId: true,
        status: true,
      },
    });
    if (!request) {
      throw new ApiError(404, 'community_join_request_not_found', 'Community join request not found');
    }

    await this.prismaService.client.$transaction(async (tx) => {
      await tx.communityJoinRequest.update({
        where: { id: request.id },
        data: {
          status,
          reviewedAt: new Date(),
          reviewedById: userId,
        },
      });
      if (status === 'approved') {
        await tx.communityMember.upsert({
          where: {
            communityId_userId: {
              communityId,
              userId: request.userId,
            },
          },
          create: {
            communityId,
            userId: request.userId,
            role: 'member',
          },
          update: {},
        });
        await tx.chatMember.upsert({
          where: {
            chatId_userId: {
              chatId: community.chatId,
              userId: request.userId,
            },
          },
          create: {
            chatId: community.chatId,
            userId: request.userId,
          },
          update: {},
        });
      }
    });

    return this.getCommunity(userId, communityId);
  }

  async listAdminNews(userId: string, communityId: string) {
    await this.getAdminCommunity(userId, communityId);
    const rows = await this.prismaService.client.communityNewsItem.findMany({
      where: { communityId },
      select: {
        id: true,
        title: true,
        blurb: true,
        timeLabel: true,
        pinned: true,
        sortOrder: true,
        createdAt: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    return { items: rows.map((row) => this.mapNews(row)) };
  }

  async createAdminNews(
    userId: string,
    communityId: string,
    body: Record<string, unknown>,
  ) {
    await this.getAdminCommunity(userId, communityId);
    return this.createCommunityNews(userId, communityId, body);
  }

  async updateAdminNews(
    userId: string,
    communityId: string,
    newsId: string,
    body: Record<string, unknown>,
  ) {
    await this.getAdminCommunity(userId, communityId);
    const data: Prisma.CommunityNewsItemUpdateManyMutationInput = {};
    const title = this.optionalTrimmedString(body.title, 120);
    const blurb = this.optionalTrimmedString(body.body ?? body.blurb, 600);
    if (title != null) {
      data.title = title;
    }
    if (blurb != null) {
      data.blurb = blurb;
    }
    if (typeof body.pinned === 'boolean') {
      data.pinned = body.pinned;
      data.sortOrder = body.pinned ? 0 : await this.nextCommunityNewsSortOrder(
        this.prismaService.client,
        communityId,
      );
    }
    const result = await this.prismaService.client.communityNewsItem.updateMany({
      where: { id: newsId, communityId },
      data,
    });
    if (result.count === 0) {
      throw new ApiError(404, 'community_news_not_found', 'Community news not found');
    }
    return { ok: true };
  }

  async deleteAdminNews(userId: string, communityId: string, newsId: string) {
    await this.getAdminCommunity(userId, communityId);
    await this.prismaService.client.communityNewsItem.deleteMany({
      where: { id: newsId, communityId },
    });
    return { ok: true };
  }

  async listAdminMeetups(userId: string, communityId: string) {
    await this.getAdminCommunity(userId, communityId);
    const rows = await this.prismaService.client.communityMeetupItem.findMany({
      where: { communityId },
      select: {
        id: true,
        title: true,
        emoji: true,
        timeLabel: true,
        place: true,
        format: true,
        going: true,
        startsAt: true,
      },
      orderBy: [{ startsAt: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        emoji: row.emoji,
        time: row.timeLabel,
        place: row.place,
        format: row.format,
        going: row.going,
        startsAt: row.startsAt?.toISOString() ?? null,
      })),
    };
  }

  async cancelAdminMeetup(userId: string, communityId: string, eventId: string) {
    await this.getAdminCommunity(userId, communityId);
    await this.prismaService.client.$transaction(async (tx) => {
      await tx.event.updateMany({
        where: { id: eventId },
        data: { canceledAt: new Date(), cancelReason: 'community_admin' },
      });
      await tx.communityMeetupItem.deleteMany({
        where: { id: eventId, communityId },
      });
    });
    return { ok: true };
  }

  async updateAdminSettings(
    userId: string,
    communityId: string,
    body: Record<string, unknown>,
  ) {
    await this.getAdminCommunity(userId, communityId);
    const data: Prisma.CommunityUpdateInput = {};
    const name = this.optionalTrimmedString(body.name, 80);
    const description = this.optionalTrimmedString(body.description, 600);
    const rules = this.optionalTrimmedString(body.rules, 1000);
    if (name != null) {
      data.name = name;
    }
    if (description != null) {
      data.description = description;
    }
    if (rules != null || Object.prototype.hasOwnProperty.call(body, 'rules')) {
      data.rules = rules;
    }
    if (body.privacy === CommunityPrivacy.private || body.privacy === CommunityPrivacy.public) {
      data.privacy = body.privacy;
      data.joinRule =
        body.privacy === CommunityPrivacy.private
          ? 'Ручное одобрение'
          : 'Открытое вступление';
    }
    if (Object.keys(data).length > 0) {
      await this.prismaService.client.community.update({
        where: { id: communityId },
        data,
      });
    }
    return this.getCommunity(userId, communityId);
  }

  async archiveAdminCommunity(userId: string, communityId: string) {
    await this.getAdminCommunity(userId, communityId);
    await this.prismaService.client.community.update({
      where: { id: communityId },
      data: { archivedAt: new Date() },
    });
    return { ok: true };
  }

  async transferAdminOwnership(
    userId: string,
    communityId: string,
    body: Record<string, unknown>,
  ) {
    const community = await this.getAdminCommunity(userId, communityId);
    const nextOwnerId = this.requiredTrimmedString(body.userId, 'userId', 80);
    const member = await this.prismaService.client.communityMember.findFirst({
      where: { communityId, userId: nextOwnerId },
      select: { id: true },
    });
    if (!member) {
      throw new ApiError(404, 'community_member_not_found', 'Community member not found');
    }
    await this.prismaService.client.$transaction(async (tx) => {
      await tx.community.update({
        where: { id: community.id },
        data: { createdById: nextOwnerId },
      });
      await tx.communityMember.updateMany({
        where: { communityId, role: CommunityMemberRole.owner },
        data: { role: CommunityMemberRole.moderator },
      });
      await tx.communityMember.update({
        where: { id: member.id },
        data: { role: CommunityMemberRole.owner },
      });
    });
    return this.getCommunity(userId, communityId);
  }

  async leaveCommunity(userId: string, communityId: string) {
    const community = await this.prismaService.client.community.findFirst({
      where: {
        id: communityId,
      },
      select: {
        id: true,
        chatId: true,
        createdById: true,
      },
    });

    if (!community) {
      throw new ApiError(404, 'community_not_found', 'Community not found');
    }

    if (community.createdById === userId) {
      throw new ApiError(
        400,
        'community_owner_cannot_leave',
        'Community owner cannot leave the community',
      );
    }

    await this.prismaService.client.$transaction(async (tx) => {
      await tx.communityMember.deleteMany({
        where: {
          communityId: community.id,
          userId,
        },
      });
      await tx.chatMember.deleteMany({
        where: {
          chatId: community.chatId,
          userId,
        },
      });
    });

    return this.getCommunity(userId, community.id);
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
          pinned: input.pin,
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
    await this.assertCommunityImageAsset(userId, input.imageAssetId);

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
            imageAssetId: input.imageAssetId,
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

  private communitySelect(limits?: {
    news?: number;
    meetups?: number;
    media?: number;
  }) {
    return {
      id: true,
      chatId: true,
      name: true,
      avatar: true,
      imageAsset: {
        select: {
          id: true,
          publicUrl: true,
        },
      },
      description: true,
      privacy: true,
      tags: true,
      joinRule: true,
      rules: true,
      premiumOnly: true,
      mood: true,
      sharedMediaLabel: true,
      createdById: true,
      createdAt: true,
      _count: {
        select: {
          members: true,
        },
      },
      members: {
        select: {
          user: {
            select: {
              displayName: true,
            },
          },
        },
        orderBy: { joinedAt: 'asc' as const },
        take: MEMBER_NAME_LIMIT,
      },
      news: {
        select: {
          id: true,
          title: true,
          blurb: true,
          timeLabel: true,
          pinned: true,
          sortOrder: true,
          createdAt: true,
        },
        orderBy: [{ pinned: 'desc' as const }, { sortOrder: 'asc' as const }, { id: 'asc' as const }],
        ...(limits?.news == null ? {} : { take: limits.news }),
      },
      meetups: {
        where: this.upcomingCommunityMeetupWhere(),
        select: {
          id: true,
          title: true,
          emoji: true,
          timeLabel: true,
          place: true,
          format: true,
          going: true,
        },
        orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
        ...(limits?.meetups == null ? {} : { take: limits.meetups }),
      },
      media: {
        select: {
          id: true,
          emoji: true,
          label: true,
          kind: true,
        },
        orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
        ...(limits?.media == null ? {} : { take: limits.media }),
      },
      socialLinks: {
        select: {
          id: true,
          label: true,
          handle: true,
        },
        orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
      },
      chat: {
        select: {
          messages: {
            select: {
              text: true,
              createdAt: true,
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

  private buildCommunityListWhere(
    params: {
      q?: string;
      topics?: string | string[];
      privacy?: string;
    },
    cursorCommunity: CommunityCursor | null,
  ): Prisma.CommunityWhereInput {
    const and: Prisma.CommunityWhereInput[] = [{ archivedAt: null }];
    const q = this.optionalTrimmedString(params.q, 80);
    if (q != null) {
      and.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { mood: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    const topics = this.normalizeTopicFilters(params.topics);
    if (topics.length > 0) {
      and.push({
        OR: topics.map((topic) => ({
          tags: {
            array_contains: topic,
          },
        })),
      });
    }

    if (params.privacy === CommunityPrivacy.public || params.privacy === 'open') {
      and.push({ privacy: CommunityPrivacy.public });
    }
    if (params.privacy === CommunityPrivacy.private || params.privacy === 'closed') {
      and.push({ privacy: CommunityPrivacy.private });
    }

    if (cursorCommunity != null) {
      and.push({
        OR: [
          { createdAt: { gt: cursorCommunity.createdAt } },
          {
            createdAt: cursorCommunity.createdAt,
            id: { gt: cursorCommunity.id },
          },
        ],
      });
    }

    return and.length === 1 ? and[0] ?? {} : { AND: and };
  }

  private communityListOrderBy(sort?: string): Prisma.CommunityOrderByWithRelationInput[] {
    if (sort === 'popular') {
      return [{ members: { _count: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }];
    }
    if (sort === 'new') {
      return [{ createdAt: 'desc' }, { id: 'desc' }];
    }
    return [{ createdAt: 'asc' }, { id: 'asc' }];
  }

  private normalizeTopicFilters(raw: unknown) {
    const values = Array.isArray(raw)
      ? raw
      : typeof raw === 'string'
        ? raw.split(',')
        : [];
    return values
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 12);
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
        joinRequestByCommunityId: new Map<string, { status: string }>(),
      };
    }

    const communityIds = communities.map((item) => item.communityId);
    const chatIds = communities.map((item) => item.chatId);

    const useUnreadCounters =
      process.env.CHAT_UNREAD_COUNTER_READS !== 'false' &&
      typeof this.prismaService.client.chatMember?.findMany === 'function';
    const unreadCountsPromise =
      useUnreadCounters
        ? this.loadUnreadCounters(userId, chatIds)
        : this.countUnreadMessages(userId, chatIds);

    const [onlineGroups, unreadByChatId, memberships, joinRequests] = await Promise.all([
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
      typeof this.prismaService.client.communityJoinRequest?.findMany === 'function'
        ? this.prismaService.client.communityJoinRequest.findMany({
            where: {
              communityId: { in: communityIds },
              userId,
              status: 'pending',
            },
            select: {
              communityId: true,
              status: true,
            },
          })
        : Promise.resolve([]),
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
      joinRequestByCommunityId: new Map(
        joinRequests.map((request) => [
          request.communityId,
          { status: request.status },
        ]),
      ),
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

  private async countUnreadMessages(
    userId: string,
    chatIds: string[],
    blockedUserIds?: Set<string>,
  ) {
    const blockedSenderFilter =
      blockedUserIds == null
        ? Prisma.sql`
            AND NOT EXISTS (
              SELECT 1
              FROM "UserBlock" ub
              WHERE (
                ub."userId" = cm."userId"
                AND ub."blockedUserId" = m."senderId"
              )
              OR (
                ub."userId" = m."senderId"
                AND ub."blockedUserId" = cm."userId"
              )
            )
          `
        : blockedUserIds.size === 0
          ? Prisma.empty
          : Prisma.sql`AND m."senderId" NOT IN (${Prisma.join([...blockedUserIds])})`;
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
        ${blockedSenderFilter}
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

  private async getBlockedUserIds(userId: string) {
    return loadBlockedUserIds(this.prismaService.client, userId);
  }

  private mapCommunity(
    community: any,
    counters: {
      onlineByCommunityId: Map<string, number>;
      unreadByChatId: Map<string, number>;
      membershipByCommunityId: Map<string, { role: string }>;
      joinRequestByCommunityId: Map<string, { status: string }>;
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
    const joinRequest = counters.joinRequestByCommunityId.get(community.id);
    const isOwner =
      community.createdById === currentUserId || membership?.role === 'owner';
    const role =
      isOwner ? 'owner' : membership?.role ?? null;
    const joined = membership != null || community.createdById === currentUserId;
    const canViewPrivateContent =
      community.privacy !== CommunityPrivacy.private || joined;

    return {
      id: community.id,
      chatId: community.chatId,
      name: community.name,
      avatar: community.avatar,
      imageUrl: this.communityImageUrl(community.imageAsset),
      description: community.description,
      privacy: community.privacy,
      members: community._count.members,
      online: counters.onlineByCommunityId.get(community.id) ?? 0,
      tags: this.stringArrayFromJson(community.tags),
      joinRule: community.joinRule,
      rules: community.rules ?? null,
      joined,
      isOwner,
      role,
      joinRequestStatus: joinRequest?.status ?? null,
      premiumOnly: community.premiumOnly,
      unread: counters.unreadByChatId.get(community.chatId) ?? 0,
      mood: community.mood,
      sharedMediaLabel: community.sharedMediaLabel,
      nextMeetup: meetups[0] ?? null,
      news: community.news.map((item: any) => ({
        ...this.mapNews(item),
      })),
      meetups,
      media: canViewPrivateContent
        ? community.media.map((item: any) => this.mapMediaItem(item))
        : [],
      chatPreview: canViewPrivateContent
        ? [...community.chat.messages]
            .reverse()
            .map((message: any) => ({
              author: message.sender.displayName,
              text: message.text,
              time: formatRelativeTime(message.createdAt),
            }))
        : [],
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
    const imageAssetId = this.requiredCommunityImageAssetId(body.imageAssetId);
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
      imageAssetId,
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

  private communityContentWhere(userId: string, communityId: string) {
    return {
      id: communityId,
      OR: [
        { privacy: CommunityPrivacy.public },
        { createdById: userId },
        { members: { some: { userId } } },
      ],
    };
  }

  private async assertCommunityImageAsset(userId: string, imageAssetId: string) {
    const asset = await this.prismaService.client.mediaAsset.findFirst({
      where: {
        id: imageAssetId,
        ownerId: userId,
        status: 'ready',
        kind: 'avatar',
      },
      select: { id: true },
    });
    if (!asset) {
      throw new ApiError(
        400,
        'community_image_required',
        'Community image is required',
      );
    }
  }

  private requiredCommunityImageAssetId(raw: unknown) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (value.length === 0 || value.length > 80) {
      throw new ApiError(
        400,
        'community_image_required',
        'Community image is required',
      );
    }
    return value;
  }

  private communityImageUrl(
    imageAsset?: { id: string; publicUrl: string | null } | null,
  ) {
    if (!imageAsset) {
      return null;
    }
    return imageAsset.publicUrl ?? buildMediaProxyPath(imageAsset.id);
  }

  private async getAdminCommunity(userId: string, communityId: string) {
    const community = await this.prismaService.client.community.findFirst({
      where: {
        id: communityId,
        OR: [
          { createdById: userId },
          {
            members: {
              some: {
                userId,
                role: { in: [CommunityMemberRole.owner, CommunityMemberRole.moderator] },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        chatId: true,
        createdById: true,
        members: {
          where: { userId },
          select: { role: true },
          take: 1,
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
    });
    if (!community) {
      throw new ApiError(403, 'community_admin_required', 'Community admin access is required');
    }
    return community;
  }

  private communityJoinRequestSelect() {
    return {
      id: true,
      communityId: true,
      userId: true,
      status: true,
      note: true,
      createdAt: true,
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
    };
  }

  private mapJoinRequest(request: any) {
    return {
      id: request.id,
      communityId: request.communityId,
      userId: request.userId,
      status: request.status,
      note: request.note ?? null,
      createdAt: request.createdAt?.toISOString?.() ?? null,
      user: request.user
        ? {
            name: request.user.displayName,
            avatarUrl: request.user.profile?.avatarUrl ?? null,
          }
        : null,
    };
  }

  private mapNews(item: any) {
    return {
      id: item.id,
      title: item.title,
      blurb: item.blurb,
      body: item.blurb,
      time: item.timeLabel,
      pinned: item.pinned ?? item.sortOrder === 0,
      sortOrder: item.sortOrder ?? 0,
      createdAt: item.createdAt?.toISOString?.() ?? null,
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

  private async resolveCursor(cursor?: string): Promise<CommunityCursor | null> {
    const decoded = this.decodeCursorPayload(cursor);
    const cursorId = decoded?.value ?? null;
    if (cursorId == null) {
      return null;
    }

    const createdAt = this.parseCursorDate(decoded?.createdAt);
    if (createdAt) {
      return {
        id: cursorId,
        createdAt,
      };
    }

    return this.prismaService.client.community.findUnique({
      where: { id: cursorId },
      select: {
        id: true,
        createdAt: true,
      },
    });
  }

  private encodeCommunityCursor(community: CommunityCursor) {
    return encodeCursor({
      value: community.id,
      createdAt: community.createdAt.toISOString(),
    });
  }

  private async resolveMediaCursor(
    communityId: string,
    cursor?: string,
  ): Promise<CommunityMediaCursor | null> {
    const decoded = this.decodeCursorPayload(cursor);
    const cursorId = decoded?.value ?? null;
    if (cursorId == null) {
      return null;
    }

    const cursorCommunityId =
      typeof decoded?.communityId === 'string' ? decoded.communityId : null;
    const sortOrder = this.parseCursorNumber(decoded?.sortOrder);
    if (cursorCommunityId != null && sortOrder != null) {
      return cursorCommunityId === communityId
        ? {
            id: cursorId,
            communityId: cursorCommunityId,
            sortOrder,
          }
        : null;
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

  private encodeMediaCursor(media: CommunityMediaCursor) {
    return encodeCursor({
      value: media.id,
      communityId: media.communityId,
      sortOrder: media.sortOrder,
    });
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

  private parseCursorDate(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }

    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  private parseCursorNumber(value: unknown) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    return value;
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
