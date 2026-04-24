import { Injectable } from '@nestjs/common';
import { DatingActionKind, Prisma, User } from '@prisma/client';
import { decodeCursor, encodeCursor } from '@big-break/database';
import { ApiError } from '../common/api-error';
import { mapProfilePhoto } from '../common/presenters';
import { PrismaService } from './prisma.service';
import { PeopleService } from './people.service';
import { SubscriptionService } from './subscription.service';

const _positiveDatingActions = new Set<DatingActionKind>(['like', 'super_like']);
type DatingGender = 'male' | 'female';

const _datingPromptByUserId: Record<string, string> = {
  'user-anya': 'Идеальный первый date, выставка плюс долгий ужин без спешки.',
  'user-sonya': 'Выбираю тихие места, где можно правда поговорить.',
  'user-liza': 'Если звать на свидание, то лучше сразу вживую, без долгих прелюдий.',
  'user-mark': 'Люблю быстрые планы, легкие маршруты, хороший бар без пафоса.',
  'user-dima': 'Лучший date, когда можно гулять, смеяться, не сидеть на месте.',
  'user-oleg': 'Умею находить музыку, места, поздние разговоры после работы.',
};

const _datingEmojiByUserId: Record<string, string> = {
  'user-anya': '🍷',
  'user-sonya': '🕯️',
  'user-liza': '🌆',
  'user-mark': '🎬',
  'user-dima': '🏃',
  'user-oleg': '🎵',
};

@Injectable()
export class DatingService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly peopleService: PeopleService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async listDiscover(
    userId: string,
    params: { cursor?: string; limit?: number } = {},
  ) {
    await this.assertDatingUnlocked(userId);

    const [self, blockedUserIds] = await Promise.all([
      this.prismaService.client.user.findUnique({
        where: { id: userId },
        include: { onboarding: true, profile: { select: { gender: true } } },
      }),
      this.getBlockedUserIds(userId),
    ]);

    const take = this.normalizeListLimit(params.limit);
    const cursorId = this.decodeCursor(params.cursor);
    const excludedUserIds = new Set<string>([
      userId,
      ...blockedUserIds,
    ]);
    const selfInterests = this.extractInterests(self?.onboarding?.interests);
    const targetGender = this.oppositeGenderForSelf(self);

    const users = await this.prismaService.client.user.findMany({
      where: {
        ...this.oppositeGenderWhere(targetGender),
        id: {
          notIn: [...excludedUserIds],
          ...(cursorId == null ? {} : { gt: cursorId }),
        },
        settings: {
          is: {
            discoverable: true,
          },
        },
        subscriptions: {
          some: this.premiumSubscriptionWhere(),
        },
        datingActionsReceived: {
          none: {
            actorUserId: userId,
          },
        },
      },
      include: {
        profile: {
          include: {
            photos: {
              include: { mediaAsset: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        onboarding: true,
        settings: true,
      },
      orderBy: [{ id: 'asc' }],
      take: take + 1,
    });

    const userIds = users.map((item) => item.id);
    const incomingLikes = userIds.length === 0
      ? []
      : await this.prismaService.client.datingAction.findMany({
          where: {
            actorUserId: {
              in: userIds,
            },
            targetUserId: userId,
            action: {
              in: ['like', 'super_like'],
            },
          },
          select: { actorUserId: true },
        });

    const likedYou = new Set(incomingLikes.map((item) => item.actorUserId));
    const hasMore = users.length > take;
    const page = hasMore ? users.slice(0, take) : users;

    return {
      items: page.map((user) =>
        this.mapDatingProfile(user, selfInterests, {
          likedYou: likedYou.has(user.id),
        }),
      ),
      nextCursor:
        hasMore && page.length > 0
          ? encodeCursor({ value: page[page.length - 1]!.id })
          : null,
    };
  }

  async listLikes(
    userId: string,
    params: { cursor?: string; limit?: number } = {},
  ) {
    await this.assertDatingUnlocked(userId);

    const [self, blockedUserIds] = await Promise.all([
      this.prismaService.client.user.findUnique({
        where: { id: userId },
        include: { onboarding: true, profile: { select: { gender: true } } },
      }),
      this.getBlockedUserIds(userId),
    ]);

    const take = this.normalizeListLimit(params.limit);
    const cursorId = this.decodeCursor(params.cursor);
    const selfInterests = this.extractInterests(self?.onboarding?.interests);
    const targetGender = this.oppositeGenderForSelf(self);

    const likes = await this.prismaService.client.datingAction.findMany({
      where: {
        targetUserId: userId,
        action: {
          in: ['like', 'super_like'],
        },
        actorUserId: {
          notIn: [...blockedUserIds],
          ...(cursorId == null ? {} : { gt: cursorId }),
        },
        actorUser: {
          ...this.oppositeGenderWhere(targetGender),
          settings: {
            is: {
              discoverable: true,
            },
          },
          subscriptions: {
            some: this.premiumSubscriptionWhere(),
          },
        },
      },
      include: {
        actorUser: {
          include: {
            profile: {
              include: {
                photos: {
                  include: { mediaAsset: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
            onboarding: true,
            settings: true,
          },
        },
      },
      orderBy: [{ actorUserId: 'asc' }],
      take: take + 1,
    });

    const hasMore = likes.length > take;
    const page = hasMore ? likes.slice(0, take) : likes;

    return {
      items: page.map((item) =>
        this.mapDatingProfile(item.actorUser, selfInterests, {
          likedYou: true,
        }),
      ),
      nextCursor:
        hasMore && page.length > 0
          ? encodeCursor({ value: page[page.length - 1]!.actorUserId })
          : null,
    };
  }

  async recordAction(userId: string, body: Record<string, unknown>) {
    await this.assertDatingUnlocked(userId);

    const targetUserId =
      typeof body.targetUserId === 'string' ? body.targetUserId.trim() : '';
    const action = this.parseAction(body.action);

    if (targetUserId.length === 0 || targetUserId === userId) {
      throw new ApiError(400, 'invalid_dating_target', 'Target user is invalid');
    }

    const blockedUserIds = await this.getBlockedUserIds(userId);
    if (blockedUserIds.has(targetUserId)) {
      throw new ApiError(404, 'dating_user_not_found', 'Dating user not found');
    }

    const self = await this.prismaService.client.user.findUnique({
      where: { id: userId },
      include: { onboarding: true, profile: { select: { gender: true } } },
    });
    const targetGender = this.oppositeGenderForSelf(self);
    const targetUser = await this.prismaService.client.user.findFirst({
      where: {
        id: targetUserId,
        ...this.oppositeGenderWhere(targetGender),
        settings: {
          is: {
            discoverable: true,
          },
        },
        subscriptions: {
          some: this.premiumSubscriptionWhere(),
        },
      },
      include: {
        profile: {
          include: {
            photos: {
              include: { mediaAsset: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        onboarding: true,
        settings: true,
      },
    });

    if (!targetUser) {
      throw new ApiError(404, 'dating_user_not_found', 'Dating user not found');
    }

    await this.prismaService.client.datingAction.upsert({
      where: {
        actorUserId_targetUserId: {
          actorUserId: userId,
          targetUserId,
        },
      },
      update: {
        action,
      },
      create: {
        actorUserId: userId,
        targetUserId,
        action,
      },
    });

    const reciprocal = await this.prismaService.client.datingAction.findUnique({
      where: {
        actorUserId_targetUserId: {
          actorUserId: targetUserId,
          targetUserId: userId,
        },
      },
      select: { action: true },
    });

    const matched =
      _positiveDatingActions.has(action) &&
      reciprocal != null &&
      _positiveDatingActions.has(reciprocal.action);

    const chat =
      matched
        ? await this.peopleService.createOrGetDirectChat(userId, targetUserId)
        : null;

    return {
      ok: true,
      action,
      matched,
      chatId: chat?.id ?? null,
      peer: this.mapDatingProfile(
        targetUser,
        this.extractInterests(self?.onboarding?.interests),
        {
          likedYou:
            reciprocal != null && _positiveDatingActions.has(reciprocal.action),
        },
      ),
    };
  }

  private async assertDatingUnlocked(userId: string) {
    const allowed = await this.subscriptionService.hasPremiumAccess(userId);
    if (!allowed) {
      throw new ApiError(403, 'dating_locked', 'Dating is available only for Frendly+');
    }
  }

  private premiumSubscriptionWhere(): Prisma.UserSubscriptionWhereInput {
    const now = new Date();

    return {
      OR: [
        {
          status: 'trial',
          trialEndsAt: {
            gt: now,
          },
        },
        {
          status: 'active',
          renewsAt: {
            gt: now,
          },
        },
        {
          status: 'canceled',
          renewsAt: {
            gt: now,
          },
        },
      ],
    };
  }

  private mapDatingProfile(
    user: User & {
      profile: {
        age: number | null;
        area: string | null;
        bio: string | null;
        vibe: string | null;
        avatarUrl: string | null;
        photos: Array<{
          id: string;
          sortOrder: number;
          mediaAsset: {
            id: string;
            kind: string;
            mimeType: string;
            byteSize: number;
            durationMs: number | null;
            publicUrl: string | null;
          };
        }>;
      } | null;
      onboarding: {
        interests: unknown;
      } | null;
    },
    selfInterests: string[],
    options: { likedYou: boolean },
  ) {
    const interests = this.extractInterests(user.onboarding?.interests);
    const common = interests.filter((item) => selfInterests.includes(item));
    const tags = (common.length > 0 ? common : interests).slice(0, 3);
    const photos = (user.profile?.photos ?? [])
      .filter((photo) => photo.mediaAsset.publicUrl != null)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((photo) =>
        mapProfilePhoto(photo as Parameters<typeof mapProfilePhoto>[0]),
      );
    const primaryPhoto = photos.length == 0 ? null : photos[0]!;

    return {
      userId: user.id,
      name: user.displayName,
      age: user.profile?.age ?? null,
      distance: this.deriveDistanceLabel(user.id),
      about: user.profile?.bio ?? 'Лучше знакомиться вживую, чем тянуть переписку.',
      tags,
      prompt: _datingPromptByUserId[user.id] ?? 'Позови на свидание, если хочешь увидеться без долгих свайпов.',
      photoEmoji: _datingEmojiByUserId[user.id] ?? '💘',
      avatarUrl: primaryPhoto?.url ?? user.profile?.avatarUrl ?? null,
      primaryPhoto,
      photos,
      likedYou: options.likedYou,
      premium: true,
      vibe: user.profile?.vibe ?? null,
      area: user.profile?.area ?? null,
      verified: user.verified,
      online: user.online,
    };
  }

  private deriveDistanceLabel(userId: string) {
    const hash = [...userId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const whole = 1 + (hash % 5);
    const decimal = hash % 10;
    return decimal === 0 ? `${whole} км` : `${whole}.${decimal} км`;
  }

  private extractInterests(raw: unknown) {
    return Array.isArray(raw)
      ? raw.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private oppositeGenderForSelf(
    user: {
      profile?: { gender: DatingGender | null } | null;
      onboarding?: { gender: DatingGender | null; interests?: unknown } | null;
    } | null,
  ): DatingGender | null {
    const gender = user?.profile?.gender ?? user?.onboarding?.gender ?? null;
    switch (gender) {
      case 'male':
        return 'female';
      case 'female':
        return 'male';
      default:
        return null;
    }
  }

  private oppositeGenderWhere(
    gender: DatingGender | null,
  ): Prisma.UserWhereInput {
    if (gender == null) {
      return {
        AND: [{ id: '__dating_gender_missing__' }],
      };
    }

    return {
      OR: [
        { profile: { is: { gender } } },
        {
          profile: { is: { gender: null } },
          onboarding: { is: { gender } },
        },
        {
          profile: { is: null },
          onboarding: { is: { gender } },
        },
      ],
    };
  }

  private normalizeListLimit(limit?: number) {
    if (limit == null || !Number.isFinite(limit)) {
      return 20;
    }

    return Math.max(1, Math.min(Math.trunc(limit), 50));
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

  private parseAction(raw: unknown): DatingActionKind {
    if (raw === 'pass' || raw === 'like' || raw === 'super_like') {
      return raw;
    }

    throw new ApiError(400, 'invalid_dating_action', 'Dating action is invalid');
  }

  private async getBlockedUserIds(userId: string) {
    const blocks = await this.prismaService.client.userBlock.findMany({
      where: {
        OR: [{ userId }, { blockedUserId: userId }],
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
