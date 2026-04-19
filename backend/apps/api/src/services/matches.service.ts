import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class MatchesService {
  constructor(private readonly prismaService: PrismaService) {}

  async listMatches(userId: string) {
    const favorites = await this.prismaService.client.eventFavorite.findMany({
      where: { sourceUserId: userId },
      include: {
        event: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const targetUserIds = [...new Set(favorites.map((favorite) => favorite.targetUserId))];
    const reverseFavorites = await this.prismaService.client.eventFavorite.findMany({
      where: {
        sourceUserId: { in: targetUserIds },
        targetUserId: userId,
      },
    });
    const reverseKeys = new Set(
      reverseFavorites.map((favorite) => `${favorite.sourceUserId}:${favorite.eventId}`),
    );

    const matches = favorites.filter((favorite) =>
      reverseKeys.has(`${favorite.targetUserId}:${favorite.eventId}`),
    );

    const users = await this.prismaService.client.user.findMany({
      where: {
        id: { in: matches.map((match) => match.targetUserId) },
      },
      include: {
        profile: true,
        onboarding: true,
      },
    });
    const currentUser = await this.prismaService.client.user.findUnique({
      where: { id: userId },
      include: { onboarding: true },
    });
    const ownInterests = Array.isArray(currentUser?.onboarding?.interests)
      ? (currentUser!.onboarding!.interests as string[])
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    return matches.map((match) => {
      const user = usersById.get(match.targetUserId)!;
      const interests = Array.isArray(user.onboarding?.interests)
        ? (user.onboarding!.interests as string[])
        : [];
      const common = interests.filter((item) => ownInterests.includes(item));
      return {
        userId: user.id,
        displayName: user.displayName,
        avatarUrl: user.profile?.avatarUrl ?? null,
        area: user.profile?.area ?? null,
        vibe: user.profile?.vibe ?? null,
        score: Math.max(63, Math.min(95, 63 + common.length * 6)),
        commonInterests: common,
        eventId: match.eventId,
        eventTitle: match.event.title,
      };
    });
  }
}
