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

const _positiveDatingActions = new Set<DatingActionKind>([
  'like',
  'super_like',
]);
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
      city: true,
      area: true,
    },
  },
  onboarding: {
    select: {
      gender: true,
      city: true,
      area: true,
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

type DatingSelfUser = {
  displayName?: string | null;
  profile?: {
    gender: DatingGender | null;
    city?: string | null;
    area?: string | null;
  } | null;
  onboarding?: {
    gender: DatingGender | null;
    city?: string | null;
    area?: string | null;
    interests?: unknown;
  } | null;
} | null;

type DatingDiscoverParams = {
  cursor?: string;
  limit?: number;
  ageMin?: number;
  ageMax?: number;
  radiusKm?: number;
  interests?: string[];
};

type NormalizedDatingDiscoverFilters = {
  ageMin?: number;
  ageMax?: number;
  radiusKm?: number;
  interests: string[];
};
type DatingLocation = { latitude: number; longitude: number };

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

const _datingLocationByCity: Record<
  string,
  { latitude: number; longitude: number }
> = {
  москва: { latitude: 55.7558, longitude: 37.6173 },
  'санкт-петербург': { latitude: 59.9386, longitude: 30.3141 },
  'nha trang': { latitude: 12.2388, longitude: 109.1967 },
  нячанг: { latitude: 12.2388, longitude: 109.1967 },
};

const _datingPromptByUserId: Record<string, string> = {
  'user-anya': 'Идеальный первый date, выставка плюс долгий ужин без спешки.',
  'user-sonya': 'Выбираю тихие места, где можно правда поговорить.',
  'user-liza':
    'Если звать на свидание, то лучше сразу вживую, без долгих прелюдий.',
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

  async listDiscover(userId: string, params: DatingDiscoverParams = {}) {
    const [self, blockedUserIds] = await Promise.all([
      this.prismaService.client.user.findUnique({
        where: { id: userId },
        select: DATING_SELF_SELECT,
      }),
      this.getBlockedUserIds(userId),
    ]);

    const take = this.normalizeListLimit(params.limit);
    const cursorId = this.decodeCursor(params.cursor);
    const filters = this.normalizeDiscoverFilters(params);
    const candidateTake = this.discoverCandidateTake(take, filters);
    const excludedUserIds = new Set<string>([userId, ...blockedUserIds]);
    const selfInterests = this.extractInterests(self?.onboarding?.interests);
    const targetGender = this.oppositeGenderForSelf(self);
    const selfLocation = this.resolveUserDatingLocation(self);
    const discoverWhere = this.buildDiscoverWhere({
      userId,
      targetGender,
      excludedUserIds,
      cursorId,
      filters,
    });

    const users = await this.prismaService.client.user.findMany({
      where: discoverWhere,
      select: DATING_USER_CARD_SELECT,
      orderBy: [{ id: 'asc' }],
      take: candidateTake,
    });

    const filteredUsers = this.applyDiscoverPostFilters(
      users,
      selfLocation,
      filters,
    );
    const hasMore = users.length >= candidateTake;
    const page = filteredUsers.slice(0, take);

    const userIds = page.map((item) => item.id);
    const incomingLikes =
      userIds.length === 0
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
    const nextCursorId = this.discoverNextCursorId({
      users,
      filteredUsers,
      page,
      hasMore,
      take,
    });

    return {
      items: page.map((user) =>
        this.mapDatingProfile(user, selfInterests, {
          likedYou: likedYou.has(user.id),
          viewerLocation: selfLocation,
        }),
      ),
      nextCursor:
        nextCursorId == null ? null : encodeCursor({ value: nextCursorId }),
    };
  }

  private buildDiscoverWhere(params: {
    userId: string;
    targetGender: DatingGender | null;
    excludedUserIds: Set<string>;
    cursorId: string | null;
    filters: NormalizedDatingDiscoverFilters;
  }): Prisma.UserWhereInput {
    const andFilters = this.discoverAndFilters(params.filters);
    const genderWhere = this.oppositeGenderWhere(params.targetGender);
    const genderAnd = this.toAndArray(genderWhere.AND);
    const and = [...genderAnd, ...andFilters];
    const where: Prisma.UserWhereInput = {
      ...genderWhere,
      id: {
        notIn: [...params.excludedUserIds],
        ...(params.cursorId == null ? {} : { gt: params.cursorId }),
      },
      settings: {
        is: {
          discoverable: true,
        },
      },
      datingActionsReceived: {
        none: {
          actorUserId: params.userId,
        },
      },
    };
    if (and.length > 0) {
      where.AND = and;
    } else {
      delete where.AND;
    }
    return where;
  }

  private discoverAndFilters(
    filters: NormalizedDatingDiscoverFilters,
  ): Prisma.UserWhereInput[] {
    const age: Prisma.IntNullableFilter = {};
    if (filters.ageMin != null) {
      age.gte = filters.ageMin;
    }
    if (filters.ageMax != null) {
      age.lte = filters.ageMax;
    }
    if (Object.keys(age).length === 0) {
      return [];
    }
    return [{ profile: { is: { age } } }];
  }

  private discoverCandidateTake(
    take: number,
    filters: NormalizedDatingDiscoverFilters,
  ) {
    const needsPostFiltering =
      filters.interests.length > 0 || filters.radiusKm != null;
    return needsPostFiltering ? Math.min(take * 5, 100) + 1 : take + 1;
  }

  private applyDiscoverPostFilters(
    users: DatingProfileUser[],
    selfLocation: DatingLocation | null,
    filters: NormalizedDatingDiscoverFilters,
  ) {
    if (filters.interests.length === 0 && filters.radiusKm == null) {
      return users;
    }
    return users.filter((user) => {
      if (!this.matchesInterestFilter(user, filters.interests)) {
        return false;
      }
      if (
        filters.radiusKm != null &&
        !this.matchesRadiusFilter(user, selfLocation, filters.radiusKm)
      ) {
        return false;
      }
      return true;
    });
  }

  private discoverNextCursorId(params: {
    users: DatingProfileUser[];
    filteredUsers: DatingProfileUser[];
    page: DatingProfileUser[];
    hasMore: boolean;
    take: number;
  }) {
    if (params.filteredUsers.length > params.take && params.page.length > 0) {
      return params.page[params.page.length - 1]!.id;
    }
    if (params.hasMore && params.users.length > 0) {
      return params.users[params.users.length - 1]!.id;
    }
    return null;
  }

  private toAndArray(
    value: Prisma.UserWhereInput['AND'],
  ): Prisma.UserWhereInput[] {
    if (value == null) {
      return [];
    }
    return Array.isArray(value) ? value : [value];
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
    const selfLocation = this.resolveUserDatingLocation(self);

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
          viewerLocation: selfLocation,
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
      throw new ApiError(
        400,
        'invalid_dating_target',
        'Target user is invalid',
      );
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

    const chat = matched
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
          viewerLocation: this.resolveUserDatingLocation(self),
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
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  private mapDatingProfile(
    user: DatingProfileUser,
    selfInterests: string[],
    options: { likedYou: boolean; viewerLocation?: DatingLocation | null },
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
    const distanceKm =
      options.viewerLocation == null || location == null
        ? null
        : this.calculateDistanceKm(options.viewerLocation, location);

    return {
      userId: user.id,
      name: user.displayName,
      age: user.profile?.age ?? null,
      city,
      distance:
        distanceKm == null
          ? this.deriveDistanceLabel(user.id)
          : this.formatDistanceLabel(distanceKm),
      about:
        user.profile?.bio ?? 'Лучше знакомиться вживую, чем тянуть переписку.',
      tags,
      prompt:
        _datingPromptByUserId[user.id] ??
        'Позови на свидание, если хочешь увидеться без долгих свайпов.',
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

  private resolveDatingProfileLocation(
    city: string | null,
    area: string | null,
  ) {
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

  private formatDistanceLabel(distanceKm: number) {
    if (distanceKm < 1) {
      return `${Math.max(1, Math.round(distanceKm * 1000))} м`;
    }
    const rounded = Math.round(distanceKm * 10) / 10;
    return Number.isInteger(rounded)
      ? `${rounded} км`
      : `${rounded.toFixed(1)} км`;
  }

  private normalizeDiscoverFilters(
    params: DatingDiscoverParams,
  ): NormalizedDatingDiscoverFilters {
    const ageMin = this.normalizeAgeFilter(params.ageMin);
    const ageMax = this.normalizeAgeFilter(params.ageMax);
    const normalizedAgeMin =
      ageMin != null && ageMax != null ? Math.min(ageMin, ageMax) : ageMin;
    const normalizedAgeMax =
      ageMin != null && ageMax != null ? Math.max(ageMin, ageMax) : ageMax;
    const radiusKm =
      params.radiusKm == null || !Number.isFinite(params.radiusKm)
        ? undefined
        : Math.max(1, Math.min(Math.round(params.radiusKm), 150));
    const interests = (params.interests ?? [])
      .map((item) => this.normalizeFilterText(item))
      .filter(
        (item, index, values) =>
          item.length > 0 && values.indexOf(item) === index,
      );

    return {
      ageMin: normalizedAgeMin,
      ageMax: normalizedAgeMax,
      radiusKm,
      interests,
    };
  }

  private normalizeAgeFilter(value?: number) {
    if (value == null || !Number.isFinite(value)) {
      return undefined;
    }
    return Math.max(18, Math.min(Math.trunc(value), 80));
  }

  private extractInterests(raw: unknown) {
    return Array.isArray(raw)
      ? raw.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private matchesInterestFilter(user: DatingProfileUser, interests: string[]) {
    if (interests.length === 0) {
      return true;
    }
    const profileInterests = this.extractInterests(user.onboarding?.interests)
      .map((item) => this.normalizeFilterText(item))
      .filter((item) => item.length > 0);
    return interests.some((interest) => profileInterests.includes(interest));
  }

  private matchesRadiusFilter(
    user: DatingProfileUser,
    selfLocation: DatingLocation | null,
    radiusKm: number,
  ) {
    if (selfLocation == null) {
      return true;
    }
    const city = user.profile?.city ?? user.onboarding?.city ?? null;
    const area = user.profile?.area ?? user.onboarding?.area ?? null;
    const userLocation = this.resolveDatingProfileLocation(city, area);
    if (userLocation == null) {
      return false;
    }
    return this.calculateDistanceKm(selfLocation, userLocation) <= radiusKm;
  }

  private resolveUserDatingLocation(user: DatingSelfUser) {
    return this.resolveDatingProfileLocation(
      user?.profile?.city ?? user?.onboarding?.city ?? null,
      user?.profile?.area ?? user?.onboarding?.area ?? null,
    );
  }

  private calculateDistanceKm(from: DatingLocation, to: DatingLocation) {
    const earthRadiusKm = 6371;
    const latitudeDelta = this.toRadians(to.latitude - from.latitude);
    const longitudeDelta = this.toRadians(to.longitude - from.longitude);
    const fromLatitude = this.toRadians(from.latitude);
    const toLatitude = this.toRadians(to.latitude);
    const a =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(fromLatitude) *
        Math.cos(toLatitude) *
        Math.sin(longitudeDelta / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRadians(value: number) {
    return (value * Math.PI) / 180;
  }

  private normalizeFilterText(value: string) {
    return value.trim().toLowerCase().replaceAll('ё', 'е');
  }

  private async createDatingLikeNotification(params: {
    userId: string;
    userName: string;
    targetUserId: string;
    action: DatingActionKind;
  }) {
    const isSuperLike = params.action === 'super_like';
    const notificationAction = isSuperLike ? 'super_like' : 'like';
    const dedupeKey = `dating_${notificationAction}:${params.targetUserId}:${params.userId}`;

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

    throw new ApiError(
      400,
      'invalid_dating_action',
      'Dating action is invalid',
    );
  }

  private async getBlockedUserIds(userId: string) {
    return loadBlockedUserIds(this.prismaService.client, userId);
  }
}
