import { Injectable } from '@nestjs/common';
import {
  buildDirectChatKey,
  decodeCursor,
  encodeCursor,
  getBlockedUserIds as loadBlockedUserIds,
} from '@big-break/database';
import { ProfileReactionKind } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { mapBasicProfile, mapProfilePhoto } from '../common/presenters';
import {
  emptyProfileSocialPreview,
  loadProfileSocialPreviews,
} from '../common/profile-social-preview';
import { normalizeSearchQuery } from '../common/search-query';
import { PrismaService } from './prisma.service';

type PeopleCursor = {
  id: string;
  displayName: string;
};

type ProfileSocialSnapshot = {
  followers: number;
  likes: number;
  superLikes: number;
  iFollow: boolean;
  iLike: boolean;
  iSuper: boolean;
};

@Injectable()
export class PeopleService {
  constructor(private readonly prismaService: PrismaService) {}

  async listPeople(
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
        .filter((photo) => photo.mediaAsset.publicUrl != null)
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
    if (currentUserId !== userId) {
      const blockedUserIds = await this.getBlockedUserIds(currentUserId);
      if (blockedUserIds.has(userId)) {
        throw new ApiError(404, 'user_not_found', 'User not found');
      }
    }

    const user = await this.prismaService.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        verified: true,
        online: true,
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
          },
        },
        settings: {
          select: {
            discoverable: true,
            showAge: true,
          },
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
    };
  }

  async getProfileSocial(
    currentUserId: string,
    targetUserId: string,
  ): Promise<ProfileSocialSnapshot> {
    await this.assertSocialTargetVisible(currentUserId, targetUserId, {
      allowSelf: true,
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
    } else {
      await this.prismaService.client.profileReaction.deleteMany({
        where: {
          actorUserId: currentUserId,
          targetUserId,
          kind,
        },
      });
    }

    return this.getProfileSocialSnapshot(currentUserId, targetUserId);
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

  private async getBlockedUserIds(userId: string) {
    return loadBlockedUserIds(this.prismaService.client, userId);
  }

  private async assertSocialTargetVisible(
    currentUserId: string,
    targetUserId: string,
    options: { allowSelf?: boolean } = {},
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
      if (blockedUserIds.has(targetUserId)) {
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
    const previews = await loadProfileSocialPreviews(
      this.prismaService.client,
      currentUserId,
      [targetUserId],
    );

    return previews.get(targetUserId) ?? emptyProfileSocialPreview();
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
