import {
  decodeCursor,
  encodeCursor,
  getBlockedUserIds,
} from '@big-break/database';
import { Injectable } from '@nestjs/common';
import { mapProfilePhoto } from '../common/presenters';
import { PrismaService } from './prisma.service';

const MATCH_PHOTO_PREVIEW_LIMIT = 1;
const POSITIVE_DATING_ACTIONS = ['like', 'super_like'] as const;

type MatchCursor = {
  targetUserId: string;
  updatedAt: Date;
};

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
      eventId: string | null;
      eventTitle: string;
    }> = [];
    const cursor = this.decodeCursor(params.cursor);
    const cursorWhere = cursor == null
      ? {}
      : {
          OR: [
            {
              updatedAt: {
                lt: cursor.updatedAt,
              },
            },
            {
              updatedAt: cursor.updatedAt,
              targetUserId: {
                gt: cursor.targetUserId,
              },
            },
          ],
        };
    const actions = await this.prismaService.client.datingAction.findMany({
      where: {
        actorUserId: userId,
        action: {
          in: [...POSITIVE_DATING_ACTIONS],
        },
        targetUserId: {
          notIn: [...blockedUserIds],
        },
        ...cursorWhere,
        targetUser: {
          settings: {
            is: {
              discoverable: true,
            },
          },
          datingActionsSent: {
            some: {
              targetUserId: userId,
              action: {
                in: [...POSITIVE_DATING_ACTIONS],
              },
            },
          },
        },
      },
      select: {
        targetUserId: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { targetUserId: 'asc' }],
      take: take + 1,
    });
    const hasMore = actions.length > take;
    const actionPage = hasMore ? actions.slice(0, take) : actions;
    const targetUserIds = actionPage.map((action) => action.targetUserId);
    const [users, currentUser] = targetUserIds.length === 0
      ? [[], null]
      : await Promise.all([
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
          this.prismaService.client.user.findUnique({
            where: { id: userId },
            select: {
              onboarding: {
                select: {
                  interests: true,
                },
              },
            },
          }),
        ]);
    const ownInterests = Array.isArray(currentUser?.onboarding?.interests)
      ? (currentUser!.onboarding!.interests as string[])
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    for (const action of actionPage) {
      const user = usersById.get(action.targetUserId);
      if (user == null) {
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
        eventId: null,
        eventTitle: 'Взаимная симпатия',
      });
    }

    return {
      items,
      nextCursor:
        hasMore && actionPage.length > 0
          ? this.encodeCursor(actionPage[actionPage.length - 1]!)
          : null,
    };
  }

  private normalizeLimit(limit?: number) {
    if (limit == null || !Number.isFinite(limit)) {
      return 20;
    }

    return Math.max(1, Math.min(Math.trunc(limit), 50));
  }

  private decodeCursor(cursor?: string): MatchCursor | null {
    if (!cursor) {
      return null;
    }

    try {
      const decoded = decodeCursor(cursor);
      const updatedAt = this.parseCursorDate(decoded?.updatedAt);
      if (decoded?.value && updatedAt) {
        return {
          targetUserId: decoded.value,
          updatedAt,
        };
      }
    } catch {
      return null;
    }

    return null;
  }

  private encodeCursor(action: { targetUserId: string; updatedAt: Date }) {
    return encodeCursor({
      value: action.targetUserId,
      updatedAt: action.updatedAt.toISOString(),
    });
  }

  private parseCursorDate(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }

    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
}
