import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class MatchesService {
  constructor(private readonly prismaService: PrismaService) {}

  async listMatches(userId: string) {
    const [favorites, blockedPairs] = await Promise.all([
      this.prismaService.client.eventFavorite.findMany({
        where: { sourceUserId: userId },
        include: {
          event: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaService.client.userBlock.findMany({
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
      }),
    ]);

    const blockedUserIds = new Set<string>();
    for (const block of blockedPairs) {
      if (block.userId === userId) {
        blockedUserIds.add(block.blockedUserId);
      }
      if (block.blockedUserId === userId) {
        blockedUserIds.add(block.userId);
      }
    }

    const visibleFavorites = favorites.filter(
      (favorite) => !blockedUserIds.has(favorite.targetUserId),
    );

    const targetUserIds = [...new Set(visibleFavorites.map((favorite) => favorite.targetUserId))];
    const reverseFavorites = await this.prismaService.client.eventFavorite.findMany({
      where: {
        sourceUserId: { in: targetUserIds },
        targetUserId: userId,
      },
    });
    const reverseKeys = new Set(
      reverseFavorites.map((favorite) => `${favorite.sourceUserId}:${favorite.eventId}`),
    );

    const matches = visibleFavorites.filter((favorite) =>
      reverseKeys.has(`${favorite.targetUserId}:${favorite.eventId}`),
    );
    const uniqueMatches = new Map<string, (typeof matches)[number]>();

    for (const match of matches) {
      if (!uniqueMatches.has(match.targetUserId)) {
        uniqueMatches.set(match.targetUserId, match);
      }
    }

    const users = await this.prismaService.client.user.findMany({
      where: {
        id: { in: [...uniqueMatches.keys()] },
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

    return [...uniqueMatches.values()].map((match) => {
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
