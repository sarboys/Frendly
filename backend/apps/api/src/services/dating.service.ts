import { Injectable } from '@nestjs/common';
import { DatingActionKind, Prisma } from '@prisma/client';
import {
  OUTBOX_EVENT_TYPES,
  decodeCursor,
  encodeCursor,
  getBlockedUserIds as loadBlockedUserIds,
} from '@big-break/database';
import { ApiError } from '../common/api-error';
import { mapProfilePhoto } from '../common/presenters';
import { PrismaService } from './prisma.service';
import { PeopleService } from './people.service';
import { SubscriptionService } from './subscription.service';

const _positiveDatingActions = new Set<DatingActionKind>(['like', 'super_like']);
type DatingGender = 'male' | 'female';
const FREE_SUPER_LIKE_DAILY_LIMIT = 1;
const PLUS_SUPER_LIKE_DAILY_LIMIT = 15;
const DATING_PROFILE_PHOTO_LIMIT = 6;
const DATING_PROFILE_PHOTO_MEDIA_SELECT = {
  id: true,
  kind: true,
  mimeType: true,
  byteSize: true,
  durationMs: true,
  publicUrl: true,
  variants: true,
} satisfies Prisma.MediaAssetSelect;
const DATING_PROFILE_PHOTO_SELECT = {
  id: true,
  sortOrder: true,
  mediaAsset: {
    select: DATING_PROFILE_PHOTO_MEDIA_SELECT,
  },
} satisfies Prisma.ProfilePhotoSelect;
const DATING_PROFILE_SELECT = {
  age: true,
  city: true,
  area: true,
  bio: true,
  vibe: true,
  avatarUrl: true,
  photos: {
    select: DATING_PROFILE_PHOTO_SELECT,
    orderBy: { sortOrder: 'asc' },
    take: DATING_PROFILE_PHOTO_LIMIT,
  },
} satisfies Prisma.ProfileSelect;
const DATING_ONBOARDING_INTERESTS_SELECT = {
  city: true,
  area: true,
  interests: true,
} satisfies Prisma.OnboardingPreferencesSelect;
const DATING_SELF_SELECT = {
  displayName: true,
  profile: {
    select: {
      gender: true,
    },
  },
  onboarding: {
    select: {
      gender: true,
      interests: true,
    },
  },
} satisfies Prisma.UserSelect;
const DATING_USER_CARD_SELECT = {
  id: true,
  displayName: true,
  verified: true,
  online: true,
  profile: {
    select: DATING_PROFILE_SELECT,
  },
  onboarding: {
    select: DATING_ONBOARDING_INTERESTS_SELECT,
  },
} satisfies Prisma.UserSelect;

type DatingProfileUser = {
  id: string;
  displayName: string;
  verified: boolean;
  online: boolean;
  profile: {
    age: number | null;
    city: string | null;
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
        variants?: unknown;
      };
    }>;
  } | null;
  onboarding: {
    city: string | null;
    area: string | null;
    interests: unknown;
  } | null;
};

const _datingLocationByCityArea: Record<
  string,
  { latitude: number; longitude: number }
> = {
  'москва|патрики': { latitude: 55.764, longitude: 37.592 },
  'москва|патриаршие пруды': { latitude: 55.7638, longitude: 37.5926 },
  'москва|чистые пруды': { latitude: 55.7647, longitude: 37.6387 },
  'москва|покровка': { latitude: 55.7594, longitude: 37.6461 },
  'москва|китай-город': { latitude: 55.7536, longitude: 37.6368 },
  'москва|замоскворечье': { latitude: 55.7378, longitude: 37.6331 },
  'москва|центр': { latitude: 55.7558, longitude: 37.6173 },
  'санкт-петербург|невский проспект': { latitude: 59.9343, longitude: 30.3351 },
  'санкт-петербург|петроградка': { latitude: 59.9642, longitude: 30.3119 },
  'санкт-петербург|центр': { latitude: 59.9386, longitude: 30.3141 },
};

const _datingLocationByCity: Record<string, { latitude: number; longitude: number }> = {
  'москва': { latitude: 55.7558, longitude: 37.6173 },
  'санкт-петербург': { latitude: 59.9386, longitude: 30.3141 },
  'nha trang': { latitude: 12.2388, longitude: 109.1967 },
  'нячанг': { latitude: 12.2388, longitude: 109.1967 },
};

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
    const [self, blockedUserIds] = await Promise.all([
      this.prismaService.client.user.findUnique({
        where: { id: userId },
        select: DATING_SELF_SELECT,
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
        datingActionsReceived: {
          none: {
            actorUserId: userId,
          },
        },
      },
      select: DATING_USER_CARD_SELECT,
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
    await this.requireFrendlyPlus(userId);

    const [self, blockedUserIds] = await Promise.all([
      this.prismaService.client.user.findUnique({
        where: { id: userId },
        select: DATING_SELF_SELECT,
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
        },
      },
      select: {
        actorUserId: true,
        actorUser: {
          select: DATING_USER_CARD_SELECT,
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
      select: DATING_SELF_SELECT,
    });
    const targetGender = this.oppositeGenderForSelf(self);
    const [targetUser, previousAction] = await Promise.all([
      this.prismaService.client.user.findFirst({
        where: {
          id: targetUserId,
          ...this.oppositeGenderWhere(targetGender),
          settings: {
            is: {
              discoverable: true,
            },
          },
        },
        select: DATING_USER_CARD_SELECT,
      }),
      this.prismaService.client.datingAction.findUnique({
        where: {
          actorUserId_targetUserId: {
            actorUserId: userId,
            targetUserId,
          },
        },
        select: { action: true },
      }),
    ]);

    if (!targetUser) {
      throw new ApiError(404, 'dating_user_not_found', 'Dating user not found');
    }

    const superLikeQuota =
      action === 'super_like'
        ? await this.ensureSuperLikeQuota(userId, previousAction?.action)
        : null;

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

    if (
      _positiveDatingActions.has(action) &&
      (action === 'super_like'
        ? previousAction?.action !== 'super_like'
        : previousAction == null ||
          !_positiveDatingActions.has(previousAction.action))
    ) {
      await this.createDatingLikeNotification({
        userId,
        userName: self?.displayName ?? '',
        targetUserId,
        action,
      });
    }

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
      superLikeQuota,
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

  private async requireFrendlyPlus(userId: string) {
    const hasPremium = await this.subscriptionService.hasPremiumAccess(userId);
    if (!hasPremium) {
      throw new ApiError(
        403,
        'frendly_plus_required',
        'Frendly Plus is required',
      );
    }
  }

  private async ensureSuperLikeQuota(
    userId: string,
    previousAction?: DatingActionKind,
  ) {
    const window = this.currentUtcDayWindow();
    const premium = await this.subscriptionService.hasPremiumAccess(userId);
    const limit = premium
      ? PLUS_SUPER_LIKE_DAILY_LIMIT
      : FREE_SUPER_LIKE_DAILY_LIMIT;
    const used = await this.prismaService.client.datingAction.count({
      where: {
        actorUserId: userId,
        action: 'super_like',
        updatedAt: {
          gte: window.start,
          lt: window.end,
        },
      },
    });
    const alreadySuperLiked = previousAction === 'super_like';

    if (!alreadySuperLiked && used >= limit) {
      throw new ApiError(
        402,
        'super_like_limit_reached',
        'Daily super like limit reached',
      );
    }

    const usedAfterAction = alreadySuperLiked ? used : used + 1;
    return {
      limit,
      remaining: Math.max(0, limit - usedAfterAction),
      premium,
      resetAt: window.end.toISOString(),
    };
  }

  private currentUtcDayWindow() {
    const now = new Date();
    const start = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      ),
    );
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  private mapDatingProfile(
    user: DatingProfileUser,
    selfInterests: string[],
    options: { likedYou: boolean },
  ) {
    const interests = this.extractInterests(user.onboarding?.interests);
    const common = interests.filter((item) => selfInterests.includes(item));
    const tags = (common.length > 0 ? common : interests).slice(0, 3);
    const photos = (user.profile?.photos ?? [])
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((photo) =>
        mapProfilePhoto(photo as Parameters<typeof mapProfilePhoto>[0]),
      );
    const primaryPhoto = photos.length == 0 ? null : photos[0]!;

    const city = user.profile?.city ?? user.onboarding?.city ?? null;
    const area = user.profile?.area ?? user.onboarding?.area ?? null;
    const location = this.resolveDatingProfileLocation(city, area);

    return {
      userId: user.id,
      name: user.displayName,
      age: user.profile?.age ?? null,
      city,
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
      area,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      verified: user.verified,
      online: user.online,
    };
  }

  private resolveDatingProfileLocation(city: string | null, area: string | null) {
    const normalizedCity = this.normalizeLocationText(city);
    const normalizedArea = this.normalizeLocationText(area);
    if (normalizedCity.length === 0) {
      return null;
    }

    if (normalizedArea.length > 0) {
      const areaLocation =
        _datingLocationByCityArea[`${normalizedCity}|${normalizedArea}`];
      if (areaLocation != null) {
        return areaLocation;
      }
    }

    return _datingLocationByCity[normalizedCity] ?? null;
  }

  private normalizeLocationText(value: string | null) {
    return (value ?? '')
      .trim()
      .toLowerCase()
      .replaceAll('ё', 'е')
      .replace(/^г\.\s*/, '');
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

  private async createDatingLikeNotification(params: {
    userId: string;
    userName: string;
    targetUserId: string;
    action: DatingActionKind;
  }) {
    const isSuperLike = params.action === 'super_like';
    const notificationAction = isSuperLike ? 'super_like' : 'like';
    const dedupeKey =
      `dating_${notificationAction}:${params.targetUserId}:${params.userId}`;

    try {
      await this.prismaService.client.$transaction(async (tx) => {
        const notification = await tx.notification.create({
          data: {
            userId: params.targetUserId,
            actorUserId: params.userId,
            kind: 'like',
            title: isSuperLike ? 'Суперлайк' : 'Новый лайк',
            body: isSuperLike
              ? 'поставил(а) тебе суперлайк в дейтинге'
              : 'Тебя лайкнули в дейтинге',
            dedupeKey,
            payload: isSuperLike
              ? {
                  userId: params.userId,
                  userName: params.userName,
                  source: 'dating',
                  action: 'super_like',
                }
              : {
                  source: 'dating',
                  action: 'like',
                },
          },
          select: {
            id: true,
          },
        });

        await tx.outboxEvent.createMany({
          data: [
            {
              type: OUTBOX_EVENT_TYPES.pushDispatch,
              payload: {
                userId: params.targetUserId,
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
    } catch (error) {
      if (this.isDedupeKeyUniqueError(error)) {
        return;
      }
      throw error;
    }
  }

  private isDedupeKeyUniqueError(error: unknown) {
    if (error == null || typeof error !== 'object') {
      return false;
    }

    const maybeError = error as {
      code?: unknown;
      meta?: { target?: unknown };
    };

    if (maybeError.code !== 'P2002') {
      return false;
    }

    const target = maybeError.meta?.target;
    if (target == null) {
      return true;
    }
    if (Array.isArray(target)) {
      return target.includes('dedupeKey');
    }
    return typeof target === 'string' && target.includes('dedupeKey');
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
    return loadBlockedUserIds(this.prismaService.client, userId);
  }
}
