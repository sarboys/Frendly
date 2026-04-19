import { Injectable } from '@nestjs/common';
import { buildDirectChatKey } from '@big-break/database';
import { ApiError } from '../common/api-error';
import { paginateArray } from '../common/pagination';
import { PrismaService } from './prisma.service';

@Injectable()
export class PeopleService {
  constructor(private readonly prismaService: PrismaService) {}

  async listPeople(userId: string, params: { cursor?: string; limit?: number }) {
    const self = await this.prismaService.client.onboardingPreferences.findUnique({
      where: { userId },
    });

    const people = await this.prismaService.client.user.findMany({
      where: {
        id: {
          not: userId,
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

  async getPersonProfile(userId: string) {
    const user = await this.prismaService.client.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        onboarding: true,
      },
    });

    if (!user) {
      throw new ApiError(404, 'user_not_found', 'User not found');
    }

    return {
      id: user.id,
      displayName: user.displayName,
      verified: user.verified,
      online: user.online,
      age: user.profile?.age ?? null,
      city: user.profile?.city ?? null,
      area: user.profile?.area ?? null,
      bio: user.profile?.bio ?? null,
      vibe: user.profile?.vibe ?? null,
      rating: user.profile?.rating ?? 0,
      meetupCount: user.profile?.meetupCount ?? 0,
      avatarUrl: user.profile?.avatarUrl ?? null,
      interests: Array.isArray(user.onboarding?.interests)
          ? (user.onboarding!.interests as unknown[]).filter(
              (item): item is string => typeof item === 'string',
            )
          : [],
      intent: user.onboarding?.intent,
    };
  }
}
