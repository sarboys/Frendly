import { Injectable } from '@nestjs/common';
import { buildDirectChatKey } from '@big-break/database';
import { ApiError } from '../common/api-error';
import { paginateArray } from '../common/pagination';
import { mapBasicProfile } from '../common/presenters';
import { PrismaService } from './prisma.service';

@Injectable()
export class PeopleService {
  constructor(private readonly prismaService: PrismaService) {}

  async listPeople(userId: string, params: { cursor?: string; limit?: number }) {
    const [self, blockedUserIds] = await Promise.all([
      this.prismaService.client.onboardingPreferences.findUnique({
        where: { userId },
      }),
      this.getBlockedUserIds(userId),
    ]);

    const people = await this.prismaService.client.user.findMany({
      where: {
        id: {
          notIn: [userId, ...blockedUserIds],
        },
      },
      include: {
        profile: true,
        onboarding: true,
      },
      orderBy: { displayName: 'asc' },
    });

    const selfInterests = new Set(Array.isArray(self?.interests) ? (self?.interests as string[]) : []);
    const mapped = people.map((person) => {
      const interests = Array.isArray(person.onboarding?.interests) ? (person.onboarding?.interests as string[]) : [];
      const common = interests.filter((interest) => selfInterests.has(interest));

      return {
        id: person.id,
        name: person.displayName,
        age: person.profile?.age ?? null,
        area: person.profile?.area ?? null,
        common,
        online: person.online,
        verified: person.verified,
        vibe: person.profile?.vibe ?? null,
        avatarUrl: person.profile?.avatarUrl ?? null,
      };
    });

    return paginateArray(mapped, params.limit ?? 20, (item) => item.id, params.cursor);
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

    return this.prismaService.client.chat.create({
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
      },
    });

    if (!user) {
      throw new ApiError(404, 'user_not_found', 'User not found');
    }

    return {
      ...mapBasicProfile(user),
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
}
