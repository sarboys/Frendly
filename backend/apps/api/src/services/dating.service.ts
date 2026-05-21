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
import { TokensService } from './tokens.service';

const _positiveDatingActions = new Set<DatingActionKind>([
  'like',
  'super_like',
]);
type DatingGender = 'male' | 'female';
const FREE_SUPER_LIKE_DAILY_LIMIT = 1;
const PLUS_SUPER_LIKE_DAILY_LIMIT = 10;
const FREE_REWIND_DAILY_LIMIT = 0;
const PLUS_REWIND_DAILY_LIMIT = 5;
const PAID_SUPER_LIKE_COST = 50;
const PAID_REWIND_COST = 25;
const FREE_SWIPE_HOURLY_LIMIT = 50;
const MOSCOW_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;
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
  createdAt: true,
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
  createdAt?: Date;
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
  gender?: DatingGender;
  ageMin?: number;
  ageMax?: number;
  radiusKm?: number;
  interests?: string[];
  verifiedOnly?: boolean;
  onlineOnly?: boolean;
  newThisWeekOnly?: boolean;
};

type NormalizedDatingDiscoverFilters = {
  gender?: DatingGender;
  ageMin?: number;
  ageMax?: number;
  radiusKm?: number;
  interests: string[];
  verifiedOnly: boolean;
  onlineOnly: boolean;
  newThisWeekOnly: boolean;
};
type DatingLocation = { latitude: number; longitude: number };
type DatingUsageClient = Pick<
  Prisma.TransactionClient,
  'datingUsageEvent' | 'tokenWallet' | 'tokenLedgerEntry' | 'datingAction'
>;

type RankedDatingCandidate = {
  user: DatingProfileUser;
  score: number;
  commonInterestCount: number;
  likedYou: boolean;
  cycle: 'fresh' | 'pass';
};
type DatingDiscoverCursor = {
  id: string | null;
  createdAt: Date | null;
  cycle: 'fresh' | 'pass';
  bufferIds: string[];
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
    private readonly tokensService?: TokensService,
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
    const cursor = this.decodeDiscoverCursor(params.cursor);
    const filters = this.normalizeDiscoverFilters(params);
    const candidateTake = this.discoverCandidateTake(take, filters);
    const excludedUserIds = new Set<string>([userId, ...blockedUserIds]);
    const selfInterests = this.extractInterests(self?.onboarding?.interests);
    const targetGender = filters.gender ?? this.oppositeGenderForSelf(self);
    const selfLocation = this.resolveUserDatingLocation(self);
    const bufferedRanked = await this.loadDiscoverBufferCandidates({
      userId,
      targetGender,
      excludedUserIds,
      cursor,
      filters,
      selfInterests,
      selfLocation,
    });
    const freshUsers =
      bufferedRanked.length >= take || cursor?.cycle === 'pass'
        ? []
        : await this.prismaService.client.user.findMany({
            where: this.buildDiscoverWhere({
              userId,
              targetGender,
              excludedUserIds,
              cursor,
              filters,
              cycle: 'fresh',
            }),
            select: DATING_USER_CARD_SELECT,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            take: candidateTake,
          });

    const rankedFresh = await this.rankDiscoverCandidates({
      userId,
      users: this.applyDiscoverPostFilters(
        freshUsers,
        selfLocation,
        filters,
      ),
      selfInterests,
      selfLocation,
      cycle: 'fresh',
    });

    let rankedPass: RankedDatingCandidate[] = [];
    let passUsers: DatingProfileUser[] = [];
    if (bufferedRanked.length < take && freshUsers.length === 0) {
      const passWhere = this.buildDiscoverWhere({
        userId,
        targetGender,
        excludedUserIds,
        cursor: cursor?.cycle === 'pass' ? cursor : null,
        filters,
        cycle: 'pass',
      });
      passUsers = await this.prismaService.client.user.findMany({
        where: passWhere,
        select: DATING_USER_CARD_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: candidateTake,
      });
      rankedPass = await this.rankDiscoverCandidates({
        userId,
        users: this.applyDiscoverPostFilters(
          passUsers,
          selfLocation,
          filters,
        ),
        selfInterests,
        selfLocation,
        cycle: 'pass',
      });
    }

    const combined = [...bufferedRanked, ...rankedFresh, ...rankedPass];
    const page = combined.slice(0, take);
    const rawCursorUsers = freshUsers.length > 0 ? freshUsers : passUsers;
    const nextCycle =
      freshUsers.length > 0 ||
      (cursor?.cycle !== 'pass' && passUsers.length === 0)
        ? 'fresh'
        : 'pass';
    const nextCursor = this.discoverNextCursor({
      users: rawCursorUsers,
      previousCursor: cursor,
      bufferedUserIds: combined.slice(take).map((item) => item.user.id),
      take,
      cycle: nextCycle,
    });

    return {
      items: page.map((candidate) =>
        this.mapDatingProfile(candidate.user, selfInterests, {
          likedYou: candidate.likedYou,
          viewerLocation: selfLocation,
        }),
      ),
      nextCursor,
    };
  }

  private buildDiscoverWhere(params: {
    userId: string;
    targetGender: DatingGender | null;
    excludedUserIds: Set<string>;
    cursor: DatingDiscoverCursor | null;
    filters: NormalizedDatingDiscoverFilters;
    cycle: 'fresh' | 'pass';
  }): Prisma.UserWhereInput {
    const andFilters = this.discoverAndFilters(params.filters);
    const genderWhere = this.oppositeGenderWhere(params.targetGender);
    const genderAnd = this.toAndArray(genderWhere.AND);
    const and = [...genderAnd, ...andFilters];
    const where: Prisma.UserWhereInput = {
      ...genderWhere,
      id: {
        notIn: [...params.excludedUserIds],
      },
      settings: {
        is: {
          discoverable: true,
        },
      },
      datingActionsReceived:
        params.cycle === 'fresh'
          ? {
              none: {
                actorUserId: params.userId,
              },
            }
          : {
              some: {
                actorUserId: params.userId,
                action: 'pass',
              },
              none: {
                actorUserId: params.userId,
                action: {
                  in: ['like', 'super_like'],
                },
              },
            },
    };
    const cursorFilter = this.discoverCursorFilter(params.cursor);
    if (cursorFilter != null) {
      and.push(cursorFilter);
    }
    if (and.length > 0) {
      where.AND = and;
    } else {
      delete where.AND;
    }
    return where;
  }

  private async loadDiscoverBufferCandidates(params: {
    userId: string;
    targetGender: DatingGender | null;
    excludedUserIds: Set<string>;
    cursor: DatingDiscoverCursor | null;
    filters: NormalizedDatingDiscoverFilters;
    selfInterests: string[];
    selfLocation: DatingLocation | null;
  }) {
    const bufferIds = params.cursor?.bufferIds ?? [];
    if (bufferIds.length === 0) {
      return [];
    }

    const where = this.buildDiscoverWhere({
      userId: params.userId,
      targetGender: params.targetGender,
      excludedUserIds: params.excludedUserIds,
      cursor: null,
      filters: params.filters,
      cycle: params.cursor?.cycle ?? 'fresh',
    });
    const users = await this.prismaService.client.user.findMany({
      where: {
        ...where,
        AND: [...this.toAndArray(where.AND), { id: { in: bufferIds } }],
      },
      select: DATING_USER_CARD_SELECT,
      take: bufferIds.length,
    });
    const ranked = await this.rankDiscoverCandidates({
      userId: params.userId,
      users: this.applyDiscoverPostFilters(
        users,
        params.selfLocation,
        params.filters,
      ),
      selfInterests: params.selfInterests,
      selfLocation: params.selfLocation,
      cycle: params.cursor?.cycle ?? 'fresh',
    });
    const rankedById = new Map(ranked.map((item) => [item.user.id, item]));
    return bufferIds
      .map((id) => rankedById.get(id))
      .filter((item): item is RankedDatingCandidate => item != null);
  }

  private discoverAndFilters(
    filters: NormalizedDatingDiscoverFilters,
  ): Prisma.UserWhereInput[] {
    const and: Prisma.UserWhereInput[] = [];
    const age: Prisma.IntNullableFilter = {};
    if (filters.ageMin != null) {
      age.gte = filters.ageMin;
    }
    if (filters.ageMax != null) {
      age.lte = filters.ageMax;
    }
    if (Object.keys(age).length > 0) {
      and.push({ profile: { is: { age } } });
    }
    if (filters.verifiedOnly) {
      and.push({ verified: true });
    }
    if (filters.onlineOnly) {
      and.push({ online: true });
    }
    if (filters.newThisWeekOnly) {
      and.push({
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      });
    }
    return and;
  }

  private discoverCandidateTake(
    take: number,
    filters: NormalizedDatingDiscoverFilters,
  ) {
    const needsPostFiltering =
      filters.interests.length > 0 || filters.radiusKm != null;
    return needsPostFiltering ? Math.min(take * 5, 100) + 1 : take + 1;
  }

  private discoverCursorFilter(
    cursor: DatingDiscoverCursor | null,
  ): Prisma.UserWhereInput | null {
    if (cursor == null || cursor.id == null) {
      return null;
    }
    if (cursor.createdAt == null) {
      return { id: { gt: cursor.id } };
    }
    return {
      OR: [
        {
          createdAt: {
            lt: cursor.createdAt,
          },
        },
        {
          createdAt: cursor.createdAt,
          id: {
            gt: cursor.id,
          },
        },
      ],
    };
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

  private async rankDiscoverCandidates(params: {
    userId: string;
    users: DatingProfileUser[];
    selfInterests: string[];
    selfLocation: DatingLocation | null;
    cycle: 'fresh' | 'pass';
  }): Promise<RankedDatingCandidate[]> {
    if (params.users.length === 0) {
      return [];
    }

    const userIds = params.users.map((item) => item.id);
    const incomingLikes =
      userIds.length === 0
        ? []
        : await this.prismaService.client.datingAction.findMany({
            where: {
              actorUserId: {
                in: userIds,
              },
              targetUserId: params.userId,
              action: {
                in: ['like', 'super_like'],
              },
            },
            select: { actorUserId: true },
          });
    const likedYou = new Set(incomingLikes.map((item) => item.actorUserId));

    return params.users
      .map((user) => {
        const commonInterests = this.commonInterestsForUser(
          user,
          params.selfInterests,
        );
        return {
          user,
          commonInterestCount: commonInterests.length,
          likedYou: likedYou.has(user.id),
          cycle: params.cycle,
          score: this.calculateDiscoverScore({
            user,
            selfInterests: params.selfInterests,
            selfLocation: params.selfLocation,
            likedYou: likedYou.has(user.id),
          }),
        };
      })
      .sort((left, right) => {
        if (right.commonInterestCount !== left.commonInterestCount) {
          return right.commonInterestCount - left.commonInterestCount;
        }
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        const rightCreatedAt = right.user.createdAt?.getTime() ?? 0;
        const leftCreatedAt = left.user.createdAt?.getTime() ?? 0;
        if (rightCreatedAt !== leftCreatedAt) {
          return rightCreatedAt - leftCreatedAt;
        }
        return left.user.id.localeCompare(right.user.id);
      });
  }

  private calculateDiscoverScore(params: {
    user: DatingProfileUser;
    selfInterests: string[];
    selfLocation: DatingLocation | null;
    likedYou: boolean;
  }) {
    const interests = this.extractInterests(params.user.onboarding?.interests);
    const selfInterests = new Set(
      params.selfInterests.map((item) => this.normalizeFilterText(item)),
    );
    const commonCount = interests
      .map((item) => this.normalizeFilterText(item))
      .filter((item) => selfInterests.has(item)).length;
    const city =
      params.user.profile?.city ?? params.user.onboarding?.city ?? null;
    const area =
      params.user.profile?.area ?? params.user.onboarding?.area ?? null;
    const userLocation = this.resolveDatingProfileLocation(city, area);
    const distanceKm =
      params.selfLocation == null || userLocation == null
        ? null
        : this.calculateDistanceKm(params.selfLocation, userLocation);
    const createdAt = params.user.createdAt?.getTime() ?? 0;
    const ageHours =
      createdAt === 0
        ? 9999
        : Math.max(0, (Date.now() - createdAt) / (60 * 60 * 1000));
    const recencyScore = Math.max(0, 30 - Math.floor(ageHours / 24) * 3);
    const distanceScore =
      distanceKm == null
        ? 0
        : Math.max(0, 40 - Math.min(40, Math.round(distanceKm * 3)));

    return (
      commonCount * 60 +
      (params.likedYou ? 220 : 0) +
      distanceScore +
      recencyScore +
      (params.user.verified ? 12 : 0) +
      (params.user.online ? 10 : 0)
    );
  }

  private discoverNextCursor(params: {
    users: DatingProfileUser[];
    previousCursor: DatingDiscoverCursor | null;
    bufferedUserIds: string[];
    take: number;
    cycle: 'fresh' | 'pass';
  }) {
    if (
      params.bufferedUserIds.length === 0 &&
      params.users.length < params.take
    ) {
      return null;
    }
    const last = params.users[params.users.length - 1];
    const cursorId = last?.id ?? params.previousCursor?.id;
    if (cursorId == null) {
      return null;
    }
    const createdAt =
      last?.createdAt ?? params.previousCursor?.createdAt ?? new Date(0);
    return encodeCursor({
      value: cursorId,
      createdAt: createdAt.toISOString(),
      cycle: params.cycle,
      buffer: params.bufferedUserIds,
    });
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

    const premium = await this.subscriptionService.hasPremiumAccess(userId);
    const actionChanged = previousAction?.action !== action;
    const writeResult = await this.withDatingTransaction(async (client) => {
      if (actionChanged) {
        await this.ensureSwipeAllowed(userId, premium, client);
      }
      const superLikeQuota =
        action === 'super_like'
          ? await this.consumeSuperLikeQuota({
              userId,
              targetUserId,
              premium,
              previousAction: previousAction?.action,
              client,
            })
          : null;

      await client.datingAction.upsert({
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
      if (actionChanged) {
        await this.createUsageEvent(client, {
          userId,
          targetUserId,
          kind: 'swipe',
        });
      }

      return {
        superLikeQuota,
        chargedTokens: superLikeQuota?.chargedTokens ?? 0,
      };
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
      chargedTokens: writeResult.chargedTokens,
      superLikeQuota: writeResult.superLikeQuota,
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

  async rewindLastPass(userId: string) {
    const latestAction =
      await this.prismaService.client.datingAction.findFirst({
        where: { actorUserId: userId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          targetUserId: true,
          action: true,
        },
      });

    if (latestAction == null || latestAction.action !== 'pass') {
      throw new ApiError(
        409,
        'dating_rewind_unavailable',
        'No dating pass can be rewound',
      );
    }

    const [self, blockedUserIds] = await Promise.all([
      this.prismaService.client.user.findUnique({
        where: { id: userId },
        select: DATING_SELF_SELECT,
      }),
      this.getBlockedUserIds(userId),
    ]);
    if (blockedUserIds.has(latestAction.targetUserId)) {
      throw new ApiError(
        409,
        'dating_rewind_unavailable',
        'No dating pass can be rewound',
      );
    }
    const targetGender = this.oppositeGenderForSelf(self);
    const targetUser = await this.prismaService.client.user.findFirst({
      where: {
        id: latestAction.targetUserId,
        ...this.oppositeGenderWhere(targetGender),
        settings: {
          is: {
            discoverable: true,
          },
        },
      },
      select: DATING_USER_CARD_SELECT,
    });
    if (!targetUser) {
      throw new ApiError(
        409,
        'dating_rewind_unavailable',
        'No dating pass can be rewound',
      );
    }

    const premium = await this.subscriptionService.hasPremiumAccess(userId);
    const rewindQuota = await this.withDatingTransaction(async (client) => {
      const quota = await this.consumeRewindQuota({
        userId,
        targetUserId: latestAction.targetUserId,
        premium,
        client,
      });
      await client.datingAction.delete({
        where: { id: latestAction.id },
      });
      return quota;
    });

    return {
      ok: true,
      action: 'rewind',
      chargedTokens: rewindQuota.chargedTokens,
      rewindQuota,
      peer: this.mapDatingProfile(
        targetUser,
        this.extractInterests(self?.onboarding?.interests),
        {
          likedYou: false,
          viewerLocation: this.resolveUserDatingLocation(self),
        },
      ),
    };
  }

  async getLimits(userId: string) {
    const premium = await this.subscriptionService.hasPremiumAccess(userId);
    const hourWindow = this.currentRollingHourWindow();
    const dayWindow = this.currentMoscowDayWindow();
    const [hourlySwipesUsed, freeSuperLikesUsed, freeRewindsUsed] =
      await Promise.all([
        premium
          ? Promise.resolve(0)
          : this.countUsage(userId, 'swipe', hourWindow),
        this.countUsage(userId, 'super_like_free', dayWindow),
        this.countUsage(userId, 'rewind_free', dayWindow),
      ]);
    const superLikeLimit = premium
      ? PLUS_SUPER_LIKE_DAILY_LIMIT
      : FREE_SUPER_LIKE_DAILY_LIMIT;
    const rewindLimit = premium
      ? PLUS_REWIND_DAILY_LIMIT
      : FREE_REWIND_DAILY_LIMIT;

    return {
      premium,
      hourlySwipes: {
        unlimited: premium,
        limit: premium ? null : FREE_SWIPE_HOURLY_LIMIT,
        remaining: premium
          ? null
          : Math.max(0, FREE_SWIPE_HOURLY_LIMIT - hourlySwipesUsed),
        resetAt: premium ? null : hourWindow.end.toISOString(),
      },
      superLikes: {
        freeLimit: superLikeLimit,
        freeRemaining: Math.max(0, superLikeLimit - freeSuperLikesUsed),
        paidCost: PAID_SUPER_LIKE_COST,
        resetAt: dayWindow.end.toISOString(),
      },
      rewinds: {
        freeLimit: rewindLimit,
        freeRemaining: Math.max(0, rewindLimit - freeRewindsUsed),
        paidCost: PAID_REWIND_COST,
        resetAt: dayWindow.end.toISOString(),
      },
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

  private async ensureSwipeAllowed(
    userId: string,
    premium: boolean,
    client: DatingUsageClient,
  ) {
    if (premium) {
      return;
    }
    const window = this.currentRollingHourWindow();
    const used = await this.countUsage(userId, 'swipe', window, client);
    if (used >= FREE_SWIPE_HOURLY_LIMIT) {
      throw new ApiError(
        429,
        'dating_swipe_rate_limited',
        'Dating swipe limit reached',
        {
          limit: FREE_SWIPE_HOURLY_LIMIT,
          remaining: 0,
          resetAt: window.end.toISOString(),
        },
      );
    }
  }

  private async consumeSuperLikeQuota(params: {
    userId: string;
    targetUserId: string;
    premium: boolean;
    previousAction?: DatingActionKind;
    client: DatingUsageClient;
  }) {
    const window = this.currentMoscowDayWindow();
    const limit = params.premium
      ? PLUS_SUPER_LIKE_DAILY_LIMIT
      : FREE_SUPER_LIKE_DAILY_LIMIT;
    const used = await this.countUsage(
      params.userId,
      'super_like_free',
      window,
      params.client,
    );
    const alreadySuperLiked = params.previousAction === 'super_like';
    let chargedTokens = 0;
    let usedAfterAction = used;

    if (!alreadySuperLiked) {
      if (used < limit) {
        await this.createUsageEvent(params.client, {
          userId: params.userId,
          targetUserId: params.targetUserId,
          kind: 'super_like_free',
        });
        usedAfterAction = used + 1;
      } else {
        await this.spendDatingTokens(
          params.userId,
          PAID_SUPER_LIKE_COST,
          params.client,
        );
        await this.createUsageEvent(params.client, {
          userId: params.userId,
          targetUserId: params.targetUserId,
          kind: 'super_like_paid',
          chargedTokens: PAID_SUPER_LIKE_COST,
        });
        chargedTokens = PAID_SUPER_LIKE_COST;
      }
    }

    const freeRemaining = Math.max(0, limit - usedAfterAction);
    return {
      limit,
      remaining: freeRemaining,
      freeLimit: limit,
      freeRemaining,
      paidCost: PAID_SUPER_LIKE_COST,
      chargedTokens,
      premium: params.premium,
      resetAt: window.end.toISOString(),
    };
  }

  private async consumeRewindQuota(params: {
    userId: string;
    targetUserId: string;
    premium: boolean;
    client: DatingUsageClient;
  }) {
    const window = this.currentMoscowDayWindow();
    const limit = params.premium
      ? PLUS_REWIND_DAILY_LIMIT
      : FREE_REWIND_DAILY_LIMIT;
    const used = await this.countUsage(
      params.userId,
      'rewind_free',
      window,
      params.client,
    );
    let chargedTokens = 0;
    let usedAfterAction = used;

    if (used < limit) {
      await this.createUsageEvent(params.client, {
        userId: params.userId,
        targetUserId: params.targetUserId,
        kind: 'rewind_free',
      });
      usedAfterAction = used + 1;
    } else {
      await this.spendDatingTokens(
        params.userId,
        PAID_REWIND_COST,
        params.client,
      );
      await this.createUsageEvent(params.client, {
        userId: params.userId,
        targetUserId: params.targetUserId,
        kind: 'rewind_paid',
        chargedTokens: PAID_REWIND_COST,
      });
      chargedTokens = PAID_REWIND_COST;
    }

    const freeRemaining = Math.max(0, limit - usedAfterAction);
    return {
      freeLimit: limit,
      freeRemaining,
      paidCost: PAID_REWIND_COST,
      chargedTokens,
      premium: params.premium,
      resetAt: window.end.toISOString(),
    };
  }

  private async spendDatingTokens(
    userId: string,
    amount: number,
    client: DatingUsageClient,
  ) {
    if (!this.tokensService) {
      throw new ApiError(500, 'tokens_service_missing', 'Token service missing');
    }
    return this.tokensService.spendTokens(
      userId,
      { amount, reason: 'dating_spend' },
      client as Prisma.TransactionClient,
    );
  }

  private async countUsage(
    userId: string,
    kind: Prisma.DatingUsageEventWhereInput['kind'],
    window: { start: Date; end: Date },
    client: Partial<DatingUsageClient> = this.prismaService.client,
  ) {
    if (!client.datingUsageEvent) {
      return 0;
    }
    return client.datingUsageEvent.count({
      where: {
        userId,
        kind,
        createdAt: {
          gte: window.start,
          lt: window.end,
        },
      },
    });
  }

  private async createUsageEvent(
    client: Partial<DatingUsageClient>,
    input: {
      userId: string;
      targetUserId?: string;
      kind: Prisma.DatingUsageEventCreateInput['kind'];
      chargedTokens?: number;
    },
  ) {
    if (!client.datingUsageEvent) {
      return null;
    }
    return client.datingUsageEvent.create({
      data: {
        user: {
          connect: { id: input.userId },
        },
        targetUserId: input.targetUserId,
        kind: input.kind,
        chargedTokens: input.chargedTokens ?? 0,
      },
    });
  }

  private async withDatingTransaction<T>(
    callback: (client: DatingUsageClient) => Promise<T>,
  ) {
    const client = this.prismaService.client as unknown as DatingUsageClient & {
      $transaction?: <TResult>(
        callback: (tx: DatingUsageClient) => Promise<TResult>,
      ) => Promise<TResult>;
    };
    if (typeof client.$transaction === 'function') {
      return client.$transaction(callback);
    }
    return callback(client);
  }

  private currentRollingHourWindow() {
    const now = new Date();
    return {
      start: new Date(now.getTime() - 60 * 60 * 1000),
      end: new Date(now.getTime() + 60 * 60 * 1000),
    };
  }

  private currentMoscowDayWindow() {
    const now = new Date();
    const shifted = new Date(now.getTime() + MOSCOW_UTC_OFFSET_MS);
    const start = new Date(
      Date.UTC(
        shifted.getUTCFullYear(),
        shifted.getUTCMonth(),
        shifted.getUTCDate(),
      ) - MOSCOW_UTC_OFFSET_MS,
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
    const common = this.commonInterestsForUser(user, selfInterests);
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
      commonInterests: common,
      matchPercent: this.calculateDatingMatchPercent({
        commonInterestCount: common.length,
        likedYou: options.likedYou,
        verified: user.verified,
        online: user.online,
        distanceKm,
      }),
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
      createdAt: (user.createdAt ?? new Date(0)).toISOString(),
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
        : Math.max(1, Math.min(Math.round(params.radiusKm), 500));
    const interests = (params.interests ?? [])
      .map((item) => this.normalizeFilterText(item))
      .filter(
        (item, index, values) =>
          item.length > 0 && values.indexOf(item) === index,
      );

    return {
      gender: params.gender,
      ageMin: normalizedAgeMin,
      ageMax: normalizedAgeMax,
      radiusKm,
      interests,
      verifiedOnly: params.verifiedOnly === true,
      onlineOnly: params.onlineOnly === true,
      newThisWeekOnly: params.newThisWeekOnly === true,
    };
  }

  private normalizeAgeFilter(value?: number) {
    if (value == null || !Number.isFinite(value)) {
      return undefined;
    }
    return Math.max(18, Math.min(Math.trunc(value), 99));
  }

  private extractInterests(raw: unknown) {
    return Array.isArray(raw)
      ? raw.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private commonInterestsForUser(
    user: DatingProfileUser,
    selfInterests: string[],
  ) {
    const selfInterestSet = new Set(
      selfInterests
        .map((item) => this.normalizeFilterText(item))
        .filter((item) => item.length > 0),
    );
    if (selfInterestSet.size === 0) {
      return [];
    }

    const seen = new Set<string>();
    return this.extractInterests(user.onboarding?.interests).filter((item) => {
      const normalized = this.normalizeFilterText(item);
      if (
        normalized.length === 0 ||
        !selfInterestSet.has(normalized) ||
        seen.has(normalized)
      ) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
  }

  private calculateDatingMatchPercent(params: {
    commonInterestCount: number;
    likedYou: boolean;
    verified: boolean;
    online: boolean;
    distanceKm: number | null;
  }) {
    const hasCommonInterest = params.commonInterestCount > 0;
    let percent = hasCommonInterest
      ? 84 + Math.min(12, params.commonInterestCount * 4)
      : 56;
    if (params.likedYou) {
      percent += 5;
    }
    if (params.verified) {
      percent += 2;
    }
    if (params.online) {
      percent += 2;
    }
    if (params.distanceKm != null) {
      percent += Math.max(0, Math.min(5, 5 - Math.floor(params.distanceKm / 2)));
    }

    const max = hasCommonInterest ? 98 : 72;
    return Math.max(50, Math.min(max, percent));
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
                  userId: params.userId,
                  userName: params.userName,
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

  private decodeDiscoverCursor(cursor?: string): DatingDiscoverCursor | null {
    if (!cursor) {
      return null;
    }

    try {
      const decoded = decodeCursor(cursor) as
        | (Record<string, unknown> & { value?: unknown })
        | null;
      const value = typeof decoded?.value === 'string' ? decoded.value : null;
      const cycle =
        decoded?.cycle === 'pass' || decoded?.cycle === 'fresh'
          ? decoded.cycle
          : 'fresh';
      const bufferIds = Array.isArray(decoded?.buffer)
        ? decoded.buffer.filter(
            (item): item is string => typeof item === 'string',
          )
        : [];
      const createdAt =
        typeof decoded?.createdAt === 'string'
          ? new Date(decoded.createdAt)
          : null;
      return {
        id: value,
        createdAt:
          createdAt != null && Number.isFinite(createdAt.getTime())
            ? createdAt
            : null,
        cycle,
        bufferIds,
      };
    } catch {
      return {
        id: cursor,
        createdAt: null,
        cycle: 'fresh',
        bufferIds: [],
      };
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
