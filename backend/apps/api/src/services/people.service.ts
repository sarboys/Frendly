import { Injectable } from '@nestjs/common';
import { buildDirectChatKey, decodeCursor, encodeCursor } from '@big-break/database';
import { ApiError } from '../common/api-error';
import { mapBasicProfile } from '../common/presenters';
import { PrismaService } from './prisma.service';

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
      }),
      this.getBlockedUserIds(userId),
    ]);

    const take = this.normalizeListLimit(params.limit);
    const query = params.q?.trim();
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
      include: {
        profile: true,
        onboarding: true,
        settings: true,
      },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      take: take + 1,
    });

    const selfInterests = new Set(Array.isArray(self?.interests) ? (self?.interests as string[]) : []);
    const hasMore = people.length > take;
    const page = hasMore ? people.slice(0, take) : people;
    const mapped = page.map((person) => {
      const interests = Array.isArray(person.onboarding?.interests) ? (person.onboarding?.interests as string[]) : [];
      const common = interests.filter((interest) => selfInterests.has(interest));

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
        avatarUrl: person.profile?.avatarUrl ?? null,
      };
    });

    return {
      items: mapped,
      nextCursor:
          hasMore && mapped.length > 0
              ? encodeCursor({ value: mapped[mapped.length - 1]!.id })
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

    const peer = await this.prismaService.client.user.findUnique({
      where: { id: peerUserId },
    });

    if (!peer) {
      throw new ApiError(404, 'user_not_found', 'Peer user not found');
    }

    const directKey = buildDirectChatKey(currentUserId, peerUserId);
    const existing = await this.prismaService.client.chat.findUnique({
      where: { directKey },
    });

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
    } catch {
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

    if (!user) {
      throw new ApiError(404, 'user_not_found', 'User not found');
    }

    if (currentUserId !== userId && user.settings?.discoverable === false) {
      throw new ApiError(404, 'user_not_found', 'User not found');
    }

    const profile = mapBasicProfile(user);

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
    };
  }

  private async getBlockedUserIds(userId: string) {
    const blocks = await this.prismaService.client.userBlock.findMany({
      where: {
        OR: [
          { userId },
          { blockedUserId: userId },
        ],
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

  private normalizeListLimit(limit?: number) {
    if (limit == null || !Number.isFinite(limit)) {
      return 20;
    }

    return Math.max(1, Math.min(Math.trunc(limit), 50));
  }

  private async resolveCursorUser(cursor?: string) {
    if (!cursor) {
      return null;
    }

    const cursorId = this.decodeCursor(cursor);
    if (cursorId == null) {
      return null;
    }

    return this.prismaService.client.user.findUnique({
      where: { id: cursorId },
      select: {
        id: true,
        displayName: true,
      },
    });
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
}
