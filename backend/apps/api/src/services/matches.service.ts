import {
  decodeCursor,
  encodeCursor,
  getBlockedUserIds,
} from '@big-break/database';
import { Injectable } from '@nestjs/common';
import { mapProfilePhoto } from '../common/presenters';
import { PrismaService } from './prisma.service';

const MATCH_PHOTO_PREVIEW_LIMIT = 1;

@Injectable()
export class MatchesService {
  constructor(private readonly prismaService: PrismaService) {}

  async listMatches(
    userId: string,
    params: { cursor?: string; limit?: number } = {},
  ) {
    const take = this.normalizeLimit(params.limit);
    const blockedUserIds = await getBlockedUserIds(
      this.prismaService.client,
      userId,
    );

    const items: Array<{
      userId: string;
      displayName: string;
      avatarUrl: string | null;
      primaryPhoto: ReturnType<typeof mapProfilePhoto> | null;
      photos: Array<ReturnType<typeof mapProfilePhoto>>;
      area: string | null;
      vibe: string | null;
      score: number;
      commonInterests: string[];
      eventId: string;
      eventTitle: string;
    }> = [];
    let cursorTargetUserId = this.decodeCursor(params.cursor);
    const batchSize = Math.max(take + 1, 20);
    let currentUserPromise: Promise<{
      onboarding: { interests: unknown } | null;
    } | null> | null = null;

    while (items.length < take + 1) {
      const targetPage = await this.prismaService.client.eventFavorite.findMany({
        where: {
          sourceUserId: userId,
          targetUserId: {
            notIn: [...blockedUserIds],
            ...(cursorTargetUserId == null
                ? {}
                : {
                    gt: cursorTargetUserId,
                  }),
          },
          targetUser: {
            settings: {
              is: {
                discoverable: true,
              },
            },
          },
        },
        select: {
          targetUserId: true,
        },
        distinct: ['targetUserId'],
        orderBy: [{ targetUserId: 'asc' }],
        take: batchSize,
      });

      if (targetPage.length == 0) {
        break;
      }

      cursorTargetUserId = targetPage[targetPage.length - 1]!.targetUserId;
      const targetUserIds = targetPage.map((item) => item.targetUserId);
      currentUserPromise ??= this.prismaService.client.user.findUnique({
        where: { id: userId },
        select: {
          onboarding: {
            select: {
              interests: true,
            },
          },
        },
      });

      const [sourceFavorites, reverseFavorites, users, currentUser] = await Promise.all([
        this.prismaService.client.eventFavorite.findMany({
          where: {
            sourceUserId: userId,
            targetUserId: {
              in: targetUserIds,
            },
          },
          select: {
            targetUserId: true,
            eventId: true,
            event: {
              select: {
                title: true,
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
        this.prismaService.client.eventFavorite.findMany({
          where: {
            sourceUserId: { in: targetUserIds },
            targetUserId: userId,
          },
          select: {
            sourceUserId: true,
            eventId: true,
          },
        }),
        this.prismaService.client.user.findMany({
          where: {
            id: { in: targetUserIds },
            settings: {
              is: {
                discoverable: true,
              },
            },
          },
          select: {
            id: true,
            displayName: true,
            profile: {
              select: {
                avatarUrl: true,
                area: true,
                vibe: true,
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
                      },
                    },
                  },
                  orderBy: { sortOrder: 'asc' },
                  take: MATCH_PHOTO_PREVIEW_LIMIT,
                },
              },
            },
            onboarding: {
              select: {
                interests: true,
              },
            },
          },
        }),
        currentUserPromise,
      ]);

      const reverseKeys = new Set(
        reverseFavorites.map((favorite) => `${favorite.sourceUserId}:${favorite.eventId}`),
      );
      const ownInterests = Array.isArray(currentUser?.onboarding?.interests)
          ? (currentUser!.onboarding!.interests as string[])
          : [];
      const usersById = new Map(users.map((user) => [user.id, user]));
      const firstMatchByTarget = new Map<string, (typeof sourceFavorites)[number]>();

      for (const favorite of sourceFavorites) {
        if (!reverseKeys.has(`${favorite.targetUserId}:${favorite.eventId}`)) {
          continue;
        }
        if (!firstMatchByTarget.has(favorite.targetUserId)) {
          firstMatchByTarget.set(favorite.targetUserId, favorite);
        }
      }

      for (const targetUserId of targetUserIds) {
        const match = firstMatchByTarget.get(targetUserId);
        const user = usersById.get(targetUserId);
        if (match == null || user == null) {
          continue;
        }
        const interests = Array.isArray(user.onboarding?.interests)
          ? (user.onboarding!.interests as string[])
          : [];
        const common = interests.filter((item) => ownInterests.includes(item));
        const photos = (user.profile?.photos ?? [])
          .filter((photo) => photo.mediaAsset.publicUrl != null)
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .slice(0, MATCH_PHOTO_PREVIEW_LIMIT)
          .map((photo) =>
            mapProfilePhoto(photo as Parameters<typeof mapProfilePhoto>[0]),
          );
        const primaryPhoto = photos.length === 0 ? null : photos[0]!;
        items.push({
          userId: user.id,
          displayName: user.displayName,
          avatarUrl: primaryPhoto?.url ?? user.profile?.avatarUrl ?? null,
          primaryPhoto,
          photos,
          area: user.profile?.area ?? null,
          vibe: user.profile?.vibe ?? null,
          score: Math.max(63, Math.min(95, 63 + common.length * 6)),
          commonInterests: common,
          eventId: match.eventId,
          eventTitle: match.event.title,
        });
      }

      if (targetPage.length < batchSize) {
        break;
      }
    }

    const hasMore = items.length > take;
    const page = hasMore ? items.slice(0, take) : items;

    return {
      items: page,
      nextCursor:
          hasMore && page.length > 0
              ? encodeCursor({ value: page[page.length - 1]!.userId })
              : null,
    };
  }

  private normalizeLimit(limit?: number) {
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
}
