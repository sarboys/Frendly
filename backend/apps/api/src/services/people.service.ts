import { Injectable, Optional } from '@nestjs/common';
import {
  OUTBOX_EVENT_TYPES,
  buildDirectChatKey,
  decodeCursor,
  encodeCursor,
  getBlockedUserIds as loadBlockedUserIds,
} from '@big-break/database';
import { Prisma, ProfileReactionKind } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { mapBasicProfile, mapEventSummary, mapProfilePhoto } from '../common/presenters';
import {
  emptyProfileSocialPreview,
  loadProfileSocialPreviews,
} from '../common/profile-social-preview';
import { normalizeSearchQuery } from '../common/search-query';
import { PrismaService } from './prisma.service';
import { RedisCacheService } from './redis-cache.service';

type PeopleCursor = {
  id: string;
  displayName: string;
};

type FollowingCursor = {
  id: string;
  createdAt: Date;
};

type ProfileSocialSnapshot = {
  followers: number;
  likes: number;
  superLikes: number;
  iFollow: boolean;
  iLike: boolean;
  iSuper: boolean;
  followNotifications: boolean;
  blockedByMe: boolean;
};

const PUBLIC_PROFILE_EVENT_LIMIT = 3;
const PUBLIC_PROFILE_EVENT_PARTICIPANT_PREVIEW_LIMIT = 6;
const publicProfileEventSelect = {
  id: true,
  title: true,
  description: true,
  emoji: true,
  startsAt: true,
  place: true,
  city: true,
  distanceKm: true,
  latitude: true,
  longitude: true,
  capacity: true,
  vibe: true,
  tone: true,
  hostNote: true,
  lifestyle: true,
  priceMode: true,
  priceAmountFrom: true,
  priceAmountTo: true,
  accessMode: true,
  genderMode: true,
  visibilityMode: true,
  requiresVerification: true,
  requiresFrendlyPlus: true,
  joinMode: true,
  isDate: true,
  eveningRouteId: true,
  hostId: true,
  coverAsset: {
    select: {
      id: true,
      publicUrl: true,
      variants: true,
    },
  },
  participants: {
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
    orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
    take: PUBLIC_PROFILE_EVENT_PARTICIPANT_PREVIEW_LIMIT,
  },
  _count: {
    select: {
      participants: true,
    },
  },
  liveState: {
    select: {
      status: true,
    },
  },
} satisfies Prisma.EventSelect;

type InviteState =
  | 'available'
  | 'already_joined'
  | 'pending_invite'
  | 'pending_request';

const FOLLOWING_CACHE_SECONDS = 10;

@Injectable()
export class PeopleService {
  private readonly pendingPeopleLoads = new Map<string, Promise<any>>();
  private readonly pendingFollowingLoads = new Map<string, Promise<any>>();
  private readonly pendingPersonProfileLoads = new Map<string, Promise<any>>();
  private readonly pendingProfileSocialLoads = new Map<string, Promise<ProfileSocialSnapshot>>();
  private readonly followingMemoryCache = new Map<
    string,
    { expiresAt: number; value: unknown }
  >();

  constructor(
    private readonly prismaService: PrismaService,
    @Optional() private readonly redisCache?: RedisCacheService,
  ) {}

  async listPeople(
    userId: string,
    params: { cursor?: string; limit?: number; q?: string },
  ) {
    const cacheKey = this.peopleListCacheKey(userId, params);
    const cached = await this.redisCache?.getJson(cacheKey);
    if (cached != null) {
      return cached;
    }

    const pending = this.pendingPeopleLoads.get(cacheKey);
    if (pending != null) {
      return pending;
    }

    const loading = this.loadFreshPeople(userId, params)
      .then(async (response) => {
        await this.redisCache?.setJson(cacheKey, response, 30);
        return response;
      })
      .finally(() => {
        this.pendingPeopleLoads.delete(cacheKey);
      });
    this.pendingPeopleLoads.set(cacheKey, loading);

    return loading;
  }

  private async loadFreshPeople(
    userId: string,
    params: { cursor?: string; limit?: number; q?: string },
  ) {
    const [self, blockedUserIds] = await Promise.all([
      this.prismaService.client.onboardingPreferences.findUnique({
        where: { userId },
        select: {
          interests: true,
        },
      }),
      this.getBlockedUserIds(userId),
    ]);

    const take = this.normalizeListLimit(params.limit);
    const query = normalizeSearchQuery(params.q);
    const cursorUser = await this.resolveCursorUser(params.cursor);

    const people = await this.prismaService.client.user.findMany({
      where: {
        id: {
          notIn: [userId, ...blockedUserIds],
        },
        settings: {
          is: {
            discoverable: true,
          },
        },
        ...(query == null || query.length === 0
            ? {}
            : {
                OR: [
                  {
                    displayName: {
                      contains: query,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    profile: {
                      is: {
                        area: {
                          contains: query,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                  },
                  {
                    profile: {
                      is: {
                        vibe: {
                          contains: query,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                  },
                ],
              }),
        ...(cursorUser == null
            ? {}
            : {
                OR: [
                  {
                    displayName: {
                      gt: cursorUser.displayName,
                    },
                  },
                  {
                    displayName: cursorUser.displayName,
                    id: {
                      gt: cursorUser.id,
                    },
                  },
                ],
              }),
      },
      select: {
        id: true,
        displayName: true,
        online: true,
        verified: true,
        profile: {
          select: {
            age: true,
            area: true,
            vibe: true,
            avatarUrl: true,
            photos: {
              select: {
                id: true,
                sortOrder: true,
                mediaAsset: {
                  select: {
                    id: true,
                    kind: true,
                    mimeType: true,
                    byteSize: true,
                    durationMs: true,
                    publicUrl: true,
                    variants: true,
                  },
                },
              },
              orderBy: { sortOrder: 'asc' },
              take: 1,
            },
          },
        },
        onboarding: {
          select: {
            interests: true,
          },
        },
        settings: {
          select: {
            showAge: true,
          },
        },
      },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      take: take + 1,
    });

    const selfInterests = new Set(Array.isArray(self?.interests) ? (self?.interests as string[]) : []);
    const hasMore = people.length > take;
    const page = hasMore ? people.slice(0, take) : people;
    const socialByUserId = await loadProfileSocialPreviews(
      this.prismaService.client,
      userId,
      page.map((person) => person.id),
    );
    const mapped = page.map((person) => {
      const interests = Array.isArray(person.onboarding?.interests) ? (person.onboarding?.interests as string[]) : [];
      const common = interests.filter((interest) => selfInterests.has(interest));
      const photos = (person.profile?.photos ?? [])
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((photo) =>
          mapProfilePhoto(photo as Parameters<typeof mapProfilePhoto>[0]),
        );
      const primaryPhoto = photos.length === 0 ? null : photos[0]!;

      return {
        id: person.id,
        name: person.displayName,
        age:
            person.settings?.showAge === true
                ? person.profile?.age ?? null
                : null,
        area: person.profile?.area ?? null,
        common,
        online: person.online,
        verified: person.verified,
        vibe: person.profile?.vibe ?? null,
        avatarUrl: primaryPhoto?.url ?? person.profile?.avatarUrl ?? null,
        primaryPhoto,
        photos,
        social: socialByUserId.get(person.id) ?? emptyProfileSocialPreview(),
      };
    });

    return {
      items: mapped,
      nextCursor:
          hasMore && page.length > 0
              ? this.encodePeopleCursor(page[page.length - 1]!)
              : null,
    };
  }

  private peopleListCacheKey(
    userId: string,
    params: { cursor?: string; limit?: number; q?: string },
  ) {
    const limit = params.limit == null ? 'default' : String(params.limit);
    const cursor = params.cursor ?? '';
    const q = normalizeSearchQuery(params.q) ?? '';
    return `people:list:v1:${userId}:${limit}:${cursor}:${q}`;
  }

  private personProfileCacheKey(currentUserId: string, targetUserId: string) {
    return `people:profile:v1:${currentUserId}:${targetUserId}`;
  }

  private profileSocialCacheKey(currentUserId: string, targetUserId: string) {
    return `people:social:v1:${currentUserId}:${targetUserId}`;
  }

  private async clearPersonProfileCache(currentUserId: string, targetUserId: string) {
    await Promise.all([
      this.redisCache?.delete(this.personProfileCacheKey(currentUserId, targetUserId)),
      this.redisCache?.delete(this.profileSocialCacheKey(currentUserId, targetUserId)),
    ]);
  }

  async listFollowing(
    userId: string,
    params: { eventId?: string; cursor?: string; limit?: number; q?: string },
  ) {
    const cacheKey = this.followingCacheKey(userId, params);
    const memoryCached = this.getMemoryCachedFollowing(cacheKey);
    if (memoryCached != null) {
      return memoryCached;
    }

    const cached = await this.redisCache?.getJson(cacheKey);
    if (cached != null) {
      this.setMemoryCachedFollowing(cacheKey, cached);
      return cached;
    }

    const pending = this.pendingFollowingLoads.get(cacheKey);
    if (pending != null) {
      return pending;
    }

    const loading = this.loadFreshFollowing(userId, params)
      .then(async (response) => {
        this.setMemoryCachedFollowing(cacheKey, response);
        await this.redisCache?.setJson(cacheKey, response, FOLLOWING_CACHE_SECONDS);
        return response;
      })
      .finally(() => {
        this.pendingFollowingLoads.delete(cacheKey);
      });
    this.pendingFollowingLoads.set(cacheKey, loading);

    return loading;
  }

  private async loadFreshFollowing(
    userId: string,
    params: { eventId?: string; cursor?: string; limit?: number; q?: string },
  ) {
    const [self, blockedUserIds] = await Promise.all([
      this.prismaService.client.onboardingPreferences.findUnique({
        where: { userId },
        select: {
          interests: true,
        },
      }),
      this.getBlockedUserIds(userId),
    ]);

    const take = this.normalizeListLimit(params.limit);
    const query = normalizeSearchQuery(params.q);
    const cursorFollow = this.resolveFollowingCursor(params.cursor);

    const follows = await this.prismaService.client.userFollow.findMany({
      where: {
        followerUserId: userId,
        targetUserId: {
          notIn: [userId, ...blockedUserIds],
        },
        targetUser: {
          settings: {
            is: {
              discoverable: true,
            },
          },
          ...(query == null || query.length === 0
            ? {}
            : {
                OR: [
                  {
                    displayName: {
                      contains: query,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    profile: {
                      is: {
                        area: {
                          contains: query,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                  },
                  {
                    profile: {
                      is: {
                        vibe: {
                          contains: query,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                  },
                ],
              }),
        },
        ...(cursorFollow == null
          ? {}
          : {
              OR: [
                {
                  createdAt: {
                    lt: cursorFollow.createdAt,
                  },
                },
                {
                  createdAt: cursorFollow.createdAt,
                  id: {
                    lt: cursorFollow.id,
                  },
                },
              ],
            }),
      },
      select: {
        id: true,
        createdAt: true,
        targetUser: {
          select: {
            id: true,
            displayName: true,
            online: true,
            verified: true,
            profile: {
              select: {
                age: true,
                area: true,
                vibe: true,
                avatarUrl: true,
                photos: {
                  select: {
                    id: true,
                    sortOrder: true,
                    mediaAsset: {
                      select: {
                        id: true,
                        kind: true,
                        mimeType: true,
                        byteSize: true,
                        durationMs: true,
                        publicUrl: true,
                        variants: true,
                      },
                    },
                  },
                  orderBy: { sortOrder: 'asc' },
                  take: 1,
                },
              },
            },
            onboarding: {
              select: {
                interests: true,
              },
            },
            settings: {
              select: {
                showAge: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });

    const hasMore = follows.length > take;
    const page = hasMore ? follows.slice(0, take) : follows;
    const targetUserIds = page.map((follow) => follow.targetUser.id);
    const [socialByUserId, inviteStateByUserId] = await Promise.all([
      loadProfileSocialPreviews(
        this.prismaService.client,
        userId,
        targetUserIds,
      ),
      this.loadInviteStates(userId, params.eventId, targetUserIds),
    ]);
    const selfInterests = new Set(
      Array.isArray(self?.interests) ? (self?.interests as string[]) : [],
    );

    return {
      items: page.map((follow) => {
        const person = follow.targetUser;
        const interests = Array.isArray(person.onboarding?.interests)
          ? (person.onboarding?.interests as string[])
          : [];
        const common = interests.filter((interest) =>
          selfInterests.has(interest),
        );
        const photos = (person.profile?.photos ?? [])
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((photo) =>
            mapProfilePhoto(photo as Parameters<typeof mapProfilePhoto>[0]),
          );
        const primaryPhoto = photos.length === 0 ? null : photos[0]!;

        return {
          id: person.id,
          name: person.displayName,
          age:
            person.settings?.showAge === true
              ? person.profile?.age ?? null
              : null,
          area: person.profile?.area ?? null,
          common,
          online: person.online,
          verified: person.verified,
          vibe: person.profile?.vibe ?? null,
          avatarUrl: primaryPhoto?.url ?? person.profile?.avatarUrl ?? null,
          primaryPhoto,
          photos,
          social:
            socialByUserId.get(person.id) ?? emptyProfileSocialPreview(),
          inviteState: inviteStateByUserId.get(person.id) ?? 'available',
        };
      }),
      nextCursor:
        hasMore && page.length > 0
          ? this.encodeFollowingCursor(page[page.length - 1]!)
          : null,
    };
  }

  private followingCacheKey(
    userId: string,
    params: { eventId?: string; cursor?: string; limit?: number; q?: string },
  ) {
    const eventId = params.eventId ?? '';
    const limit = params.limit == null ? 'default' : String(params.limit);
    const cursor = params.cursor ?? '';
    const q = normalizeSearchQuery(params.q) ?? '';
    return `people:following:v1:${userId}:${eventId}:${limit}:${cursor}:${q}`;
  }

  private getMemoryCachedFollowing(cacheKey: string) {
    const entry = this.followingMemoryCache.get(cacheKey);
    if (entry == null) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.followingMemoryCache.delete(cacheKey);
      return null;
    }
    return entry.value;
  }

  private setMemoryCachedFollowing(cacheKey: string, value: unknown) {
    this.followingMemoryCache.set(cacheKey, {
      expiresAt: Date.now() + FOLLOWING_CACHE_SECONDS * 1000,
      value,
    });
  }

  async createOrGetDirectChat(currentUserId: string, peerUserId: string) {
    if (currentUserId === peerUserId) {
      throw new ApiError(400, 'self_chat_not_allowed', 'Cannot create chat with yourself');
    }

    const blockedUserIds = await this.getBlockedUserIds(currentUserId);
    if (blockedUserIds.has(peerUserId)) {
      throw new ApiError(404, 'user_not_found', 'Peer user not found');
    }

    const directKey = buildDirectChatKey(currentUserId, peerUserId);
    const [peer, existing] = await Promise.all([
      this.prismaService.client.user.findUnique({
        where: { id: peerUserId },
        select: {
          id: true,
          settings: {
            select: {
              discoverable: true,
            },
          },
        },
      }),
      this.prismaService.client.chat.findUnique({
        where: { directKey },
      }),
    ]);

    if (!peer || peer.settings?.discoverable === false) {
      throw new ApiError(404, 'user_not_found', 'Peer user not found');
    }

    if (existing) {
      await Promise.all(
        [currentUserId, peerUserId].map((memberUserId) =>
          this.prismaService.client.chatMember.upsert({
            where: {
              chatId_userId: {
                chatId: existing.id,
                userId: memberUserId,
              },
            },
            update: {},
            create: {
              chatId: existing.id,
              userId: memberUserId,
            },
          }),
        ),
      );
      return existing;
    }

    try {
      return await this.prismaService.client.chat.create({
        data: {
          kind: 'direct',
          origin: 'people',
          directKey,
          members: {
            createMany: {
              data: [{ userId: currentUserId }, { userId: peerUserId }],
            },
          },
        },
      });
    } catch (error) {
      if (!this.isDirectChatDuplicateError(error)) {
        throw error;
      }

      const duplicate = await this.prismaService.client.chat.findUnique({
        where: { directKey },
      });
      if (duplicate) {
        return duplicate;
      }
      throw new ApiError(409, 'direct_chat_create_failed', 'Could not create direct chat');
    }
  }

  async getPersonProfile(currentUserId: string, userId: string) {
    const cacheKey = this.personProfileCacheKey(currentUserId, userId);
    const cached = await this.redisCache?.getJson(cacheKey);
    if (cached != null) {
      return cached;
    }

    const pending = this.pendingPersonProfileLoads.get(cacheKey);
    if (pending != null) {
      return pending;
    }

    const loading = this.loadFreshPersonProfile(currentUserId, userId)
      .then(async (response) => {
        await this.redisCache?.setJson(cacheKey, response, 15);
        return response;
      })
      .finally(() => {
        this.pendingPersonProfileLoads.delete(cacheKey);
      });
    this.pendingPersonProfileLoads.set(cacheKey, loading);

    return loading;
  }

  private async loadFreshPersonProfile(currentUserId: string, userId: string) {
    const blockedUserIds =
      currentUserId === userId
        ? new Set<string>()
        : await this.getBlockedUserIds(currentUserId);
    const blockedByMe = blockedUserIds.has(userId);
    const now = new Date();

    const user = await this.prismaService.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        verified: true,
        online: true,
        subscriptions: {
          select: {
            status: true,
            renewsAt: true,
            trialEndsAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        profile: {
          select: {
            age: true,
            birthDate: true,
            gender: true,
            city: true,
            area: true,
            bio: true,
            vibe: true,
            rating: true,
            meetupCount: true,
            avatarAssetId: true,
            avatarUrl: true,
            photos: {
              select: {
                id: true,
                sortOrder: true,
                mediaAsset: {
                  select: {
                    id: true,
                    kind: true,
                    mimeType: true,
                    byteSize: true,
                    durationMs: true,
                    publicUrl: true,
                    variants: true,
                  },
                },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        onboarding: {
          select: {
            interests: true,
            intent: true,
            completedAt: true,
          },
        },
        settings: {
          select: {
            discoverable: true,
            showAge: true,
          },
        },
        hostedEvents: {
          where: {
            canceledAt: null,
            visibilityMode: 'public',
            startsAt: { gte: now },
          },
          select: publicProfileEventSelect,
          orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
          take: PUBLIC_PROFILE_EVENT_LIMIT,
        },
        eventParticipants: {
          where: {
            event: {
              canceledAt: null,
              visibilityMode: 'public',
              startsAt: { gte: now },
              hostId: { notIn: [...blockedUserIds] },
            },
          },
          select: {
            event: {
              select: publicProfileEventSelect,
            },
          },
          orderBy: [{ event: { startsAt: 'asc' } }, { eventId: 'asc' }],
          take: PUBLIC_PROFILE_EVENT_LIMIT,
        },
      },
    });

    if (!user) {
      throw new ApiError(404, 'user_not_found', 'User not found');
    }

    if (currentUserId !== userId && user.settings?.discoverable === false) {
      throw new ApiError(404, 'user_not_found', 'User not found');
    }

    const profile = mapBasicProfile(user);

    const social = await this.getProfileSocialSnapshot(currentUserId, userId);

    return {
      ...profile,
      age:
          currentUserId === userId || user.settings?.showAge === true
              ? profile.age
              : null,
      interests: Array.isArray(user.onboarding?.interests)
          ? (user.onboarding!.interests as unknown[]).filter(
              (item): item is string => typeof item === 'string',
            )
          : [],
      intent: user.onboarding?.intent,
      social,
      blockedByMe,
      upcomingEvents: this.mapProfileUpcomingEvents(
        user,
        currentUserId,
        blockedByMe
          ? new Set<string>([...blockedUserIds, userId])
          : blockedUserIds,
      ),
    };
  }

  private mapProfileUpcomingEvents(
    user: any,
    currentUserId: string,
    blockedUserIds: Set<string>,
  ) {
    const events = [
      ...(user.hostedEvents ?? []),
      ...(user.eventParticipants ?? []).map((row: any) => row.event),
    ];
    const seen = new Set<string>();
    return events
      .filter((event) => {
        if (!event?.id || seen.has(event.id)) {
          return false;
        }
        seen.add(event.id);
        return true;
      })
      .sort((left, right) => {
        const byDate = left.startsAt.getTime() - right.startsAt.getTime();
        return byDate === 0 ? left.id.localeCompare(right.id) : byDate;
      })
      .slice(0, PUBLIC_PROFILE_EVENT_LIMIT)
      .map((event) =>
        mapEventSummary({
          event,
          participants: (event.participants ?? []).filter(
            (participant: any) => !blockedUserIds.has(participant.userId),
          ),
          currentUserId,
          participantCount: event._count?.participants,
          liveState: event.liveState,
        }),
      );
  }

  async getProfileSocial(
    currentUserId: string,
    targetUserId: string,
  ): Promise<ProfileSocialSnapshot> {
    const cacheKey = this.profileSocialCacheKey(currentUserId, targetUserId);
    const cached = await this.redisCache?.getJson<ProfileSocialSnapshot>(cacheKey);
    if (cached != null) {
      return cached;
    }

    const pending = this.pendingProfileSocialLoads.get(cacheKey);
    if (pending != null) {
      return pending;
    }

    const loading = this.loadFreshProfileSocial(currentUserId, targetUserId)
      .then(async (response) => {
        await this.redisCache?.setJson(cacheKey, response, 15);
        return response;
      })
      .finally(() => {
        this.pendingProfileSocialLoads.delete(cacheKey);
      });
    this.pendingProfileSocialLoads.set(cacheKey, loading);

    return loading;
  }

  private async loadFreshProfileSocial(
    currentUserId: string,
    targetUserId: string,
  ): Promise<ProfileSocialSnapshot> {
    await this.assertSocialTargetVisible(currentUserId, targetUserId, {
      allowSelf: true,
      allowBlocked: true,
    });
    return this.getProfileSocialSnapshot(currentUserId, targetUserId);
  }

  async setFollow(
    currentUserId: string,
    targetUserId: string,
    follow: boolean,
  ): Promise<ProfileSocialSnapshot> {
    await this.assertSocialTargetVisible(currentUserId, targetUserId);

    if (follow) {
      await this.prismaService.client.userFollow.upsert({
        where: {
          followerUserId_targetUserId: {
            followerUserId: currentUserId,
            targetUserId,
          },
        },
        update: {},
        create: {
          followerUserId: currentUserId,
          targetUserId,
          notifyEnabled: true,
        },
      });
    } else {
      await this.prismaService.client.userFollow.deleteMany({
        where: {
          followerUserId: currentUserId,
          targetUserId,
        },
      });
    }

    this.pendingFollowingLoads.clear();
    this.followingMemoryCache.clear();
    await this.clearPersonProfileCache(currentUserId, targetUserId);
    return this.getProfileSocialSnapshot(currentUserId, targetUserId);
  }

  async setFollowNotifications(
    currentUserId: string,
    targetUserId: string,
    enabled: boolean,
  ): Promise<ProfileSocialSnapshot> {
    await this.assertSocialTargetVisible(currentUserId, targetUserId);

    const updated = await this.prismaService.client.userFollow.updateMany({
      where: {
        followerUserId: currentUserId,
        targetUserId,
      },
      data: {
        notifyEnabled: enabled,
      },
    });

    if (updated.count === 0) {
      throw new ApiError(404, 'follow_not_found', 'Follow not found');
    }

    await this.clearPersonProfileCache(currentUserId, targetUserId);
    return this.getProfileSocialSnapshot(currentUserId, targetUserId);
  }

  async setProfileReaction(
    currentUserId: string,
    targetUserId: string,
    kind: ProfileReactionKind,
    active = true,
  ): Promise<ProfileSocialSnapshot> {
    await this.assertSocialTargetVisible(currentUserId, targetUserId);

    if (active) {
      await this.prismaService.client.profileReaction.upsert({
        where: {
          actorUserId_targetUserId_kind: {
            actorUserId: currentUserId,
            targetUserId,
            kind,
          },
        },
        update: {},
        create: {
          actorUserId: currentUserId,
          targetUserId,
          kind,
        },
      });
      await this.createProfileReactionNotification({
        userId: currentUserId,
        targetUserId,
        kind,
      });
    } else {
      await this.prismaService.client.profileReaction.deleteMany({
        where: {
          actorUserId: currentUserId,
          targetUserId,
          kind,
        },
      });
    }

    await this.clearPersonProfileCache(currentUserId, targetUserId);
    return this.getProfileSocialSnapshot(currentUserId, targetUserId);
  }

  private async createProfileReactionNotification(params: {
    userId: string;
    targetUserId: string;
    kind: ProfileReactionKind;
  }) {
    const actor = await this.prismaService.client.user.findUnique({
      where: { id: params.userId },
      select: {
        displayName: true,
      },
    });
    const userName = actor?.displayName?.trim() || 'Пользователь';
    const isSuperLike = params.kind === ProfileReactionKind.super_like;
    const action = isSuperLike ? 'super_like' : 'like';
    const dedupeKey = `profile_${action}:${params.targetUserId}:${params.userId}`;

    try {
      await this.prismaService.client.$transaction(async (tx) => {
        const notification = await tx.notification.create({
          data: {
            userId: params.targetUserId,
            actorUserId: params.userId,
            kind: 'like',
            title: isSuperLike ? 'Суперлайк профиля' : 'Новый лайк',
            body: isSuperLike
              ? `${userName} поставил(а) суперлайк профилю`
              : `${userName} лайкнул(а) профиль`,
            dedupeKey,
            payload: {
              userId: params.userId,
              userName,
              source: 'profile',
              action,
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

  normalizeProfileReactionKind(raw: string): ProfileReactionKind {
    if (raw === 'like') {
      return ProfileReactionKind.like;
    }
    if (raw === 'super_like' || raw === 'super-like' || raw === 'super') {
      return ProfileReactionKind.super_like;
    }
    throw new ApiError(
      400,
      'invalid_profile_reaction_kind',
      'Invalid profile reaction kind',
    );
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

  private async getBlockedUserIds(userId: string) {
    return loadBlockedUserIds(this.prismaService.client, userId);
  }

  private async assertSocialTargetVisible(
    currentUserId: string,
    targetUserId: string,
    options: { allowSelf?: boolean; allowBlocked?: boolean } = {},
  ) {
    if (currentUserId === targetUserId && options.allowSelf !== true) {
      throw new ApiError(
        400,
        'self_social_action_not_allowed',
        'Cannot apply social action to yourself',
      );
    }

    if (currentUserId !== targetUserId) {
      const blockedUserIds = await this.getBlockedUserIds(currentUserId);
      if (blockedUserIds.has(targetUserId) && options.allowBlocked !== true) {
        throw new ApiError(404, 'user_not_found', 'User not found');
      }
    }

    const target = await this.prismaService.client.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        settings: {
          select: {
            discoverable: true,
          },
        },
      },
    });

    if (!target) {
      throw new ApiError(404, 'user_not_found', 'User not found');
    }
    if (
      currentUserId !== targetUserId &&
      target.settings?.discoverable === false
    ) {
      throw new ApiError(404, 'user_not_found', 'User not found');
    }
  }

  private async getProfileSocialSnapshot(
    currentUserId: string,
    targetUserId: string,
  ): Promise<ProfileSocialSnapshot> {
    const [previews, block] = await Promise.all([
      loadProfileSocialPreviews(
        this.prismaService.client,
        currentUserId,
        [targetUserId],
      ),
      currentUserId === targetUserId
        ? Promise.resolve(null)
        : this.prismaService.client.userBlock.findUnique({
            where: {
              userId_blockedUserId: {
                userId: currentUserId,
                blockedUserId: targetUserId,
              },
            },
            select: { id: true },
          }),
    ]);

    return {
      ...(previews.get(targetUserId) ?? emptyProfileSocialPreview()),
      blockedByMe: block != null,
    };
  }

  private async loadInviteStates(
    currentUserId: string,
    eventId: string | undefined,
    targetUserIds: string[],
  ): Promise<Map<string, InviteState>> {
    const states = new Map<string, InviteState>();
    for (const targetUserId of targetUserIds) {
      states.set(targetUserId, 'available');
    }

    if (!eventId || targetUserIds.length === 0) {
      return states;
    }

    const event = await this.prismaService.client.event.findUnique({
      where: { id: eventId },
      select: {
        hostId: true,
        participants: {
          where: {
            userId: {
              in: targetUserIds,
            },
          },
          select: {
            userId: true,
          },
        },
        joinRequests: {
          where: {
            userId: {
              in: targetUserIds,
            },
            status: {
              in: ['pending', 'approved'],
            },
          },
          select: {
            userId: true,
            status: true,
            reviewedById: true,
          },
        },
      },
    });

    if (!event) {
      return states;
    }

    if (targetUserIds.includes(event.hostId)) {
      states.set(event.hostId, 'already_joined');
    }
    for (const participant of event.participants) {
      states.set(participant.userId, 'already_joined');
    }
    for (const request of event.joinRequests) {
      if (states.get(request.userId) === 'already_joined') {
        continue;
      }
      if (request.status === 'approved') {
        states.set(request.userId, 'already_joined');
      } else if (request.reviewedById != null) {
        states.set(request.userId, 'pending_invite');
      } else {
        states.set(request.userId, 'pending_request');
      }
    }

    states.delete(currentUserId);
    return states;
  }

  private isDirectChatDuplicateError(error: unknown) {
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
      return target.includes('directKey');
    }
    return typeof target === 'string' && target.includes('directKey');
  }

  private normalizeListLimit(limit?: number) {
    if (limit == null || !Number.isFinite(limit)) {
      return 20;
    }

    return Math.max(1, Math.min(Math.trunc(limit), 50));
  }

  private async resolveCursorUser(cursor?: string): Promise<PeopleCursor | null> {
    if (!cursor) {
      return null;
    }

    const decoded = this.decodeCursorPayload(cursor);
    if (decoded == null) {
      return null;
    }

    const displayName =
      typeof decoded.displayName === 'string' ? decoded.displayName : null;
    if (displayName != null) {
      return {
        id: decoded.value,
        displayName,
      };
    }

    return this.prismaService.client.user.findUnique({
      where: { id: decoded.value },
      select: {
        id: true,
        displayName: true,
      },
    });
  }

  private encodePeopleCursor(person: PeopleCursor) {
    return encodeCursor({
      value: person.id,
      displayName: person.displayName,
    });
  }

  private encodeFollowingCursor(follow: FollowingCursor) {
    return encodeCursor({
      value: follow.id,
      createdAt: follow.createdAt.toISOString(),
    });
  }

  private resolveFollowingCursor(cursor?: string): FollowingCursor | null {
    const decoded = this.decodeCursorPayload(cursor);
    if (decoded == null) {
      return null;
    }
    const createdAt =
      typeof decoded.createdAt === 'string'
        ? new Date(decoded.createdAt)
        : null;
    if (createdAt == null || Number.isNaN(createdAt.getTime())) {
      return null;
    }
    return {
      id: decoded.value,
      createdAt,
    };
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
}
