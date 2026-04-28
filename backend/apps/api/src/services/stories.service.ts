import { Injectable } from '@nestjs/common';
import {
  createPresignedDownload,
  decodeCursor,
  encodeCursor,
  getBlockedUserIds as loadBlockedUserIds,
} from '@big-break/database';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { mapMediaResource } from '../common/media-presenters';
import { PrismaService } from './prisma.service';

type StoryCursor = {
  id: string;
  createdAt: Date;
};

const STORY_MEDIA_ASSET_SELECT = {
  id: true,
  kind: true,
  objectKey: true,
  mimeType: true,
  byteSize: true,
  durationMs: true,
  publicUrl: true,
} satisfies Prisma.MediaAssetSelect;
const STORY_AUTHOR_SELECT = {
  displayName: true,
  profile: {
    select: {
      avatarUrl: true,
    },
  },
} satisfies Prisma.UserSelect;
const STORY_SELECT = {
  id: true,
  eventId: true,
  authorId: true,
  caption: true,
  emoji: true,
  createdAt: true,
  author: {
    select: STORY_AUTHOR_SELECT,
  },
  mediaAsset: {
    select: STORY_MEDIA_ASSET_SELECT,
  },
} satisfies Prisma.EventStorySelect;

@Injectable()
export class StoriesService {
  constructor(private readonly prismaService: PrismaService) {}

  async listStories(
    userId: string,
    eventId: string,
    params: { cursor?: string; limit?: number },
  ) {
    const blockedUserIds = await this.getBlockedUserIds(userId);
    await this.assertParticipant(userId, eventId, blockedUserIds);
    const take = this.normalizeLimit(params.limit);
    const cursorStory = await this.resolveStoryCursor(eventId, params.cursor);

    const stories = await this.prismaService.client.eventStory.findMany({
      where: {
        eventId,
        ...(blockedUserIds.size > 0
          ? {
              authorId: {
                notIn: [...blockedUserIds],
              },
            }
          : {}),
        ...(cursorStory
          ? {
              OR: [
                {
                  createdAt: {
                    lt: cursorStory.createdAt,
                  },
                },
                {
                  createdAt: cursorStory.createdAt,
                  id: {
                    lt: cursorStory.id,
                  },
                },
              ],
            }
          : {}),
      },
      select: STORY_SELECT,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: take + 1,
    });

    const hasMore = stories.length > take;
    const rawPage = hasMore ? stories.slice(0, take) : stories;
    const page = await Promise.all(
      rawPage.map((story) => this.mapStory(story)),
    );

    return {
      items: [...page].reverse(),
      nextCursor:
        hasMore && rawPage.length > 0
          ? this.encodeStoryCursor(rawPage[rawPage.length - 1]!)
          : null,
    };
  }

  async createStory(userId: string, eventId: string, body: Record<string, unknown>) {
    await this.assertParticipant(userId, eventId);

    const caption = typeof body.caption === 'string' ? body.caption.trim() : '';
    const emoji = typeof body.emoji === 'string' ? body.emoji : '✨';
    const mediaAssetId =
      typeof body.mediaAssetId === 'string' ? body.mediaAssetId.trim() : null;

    if (caption.length === 0 && mediaAssetId == null) {
      throw new ApiError(
        400,
        'invalid_story_payload',
        'caption or mediaAssetId is required',
      );
    }

    if (caption.length > 240) {
      throw new ApiError(400, 'invalid_story_caption', 'caption is too long');
    }

    if (mediaAssetId != null) {
      const existing = await this.findExistingStoryMediaRetry(
        eventId,
        userId,
        mediaAssetId,
      );
      if (existing != null) {
        return this.mapStory(existing);
      }
    }

    const [recentCount, asset] = await Promise.all([
      this.prismaService.client.eventStory.count({
        where: {
          eventId,
          authorId: userId,
          createdAt: {
            gte: new Date(Date.now() - 15 * 60 * 1000),
          },
        },
      }),
      mediaAssetId
        ? this.prismaService.client.mediaAsset.findFirst({
            where: {
              id: mediaAssetId,
              ownerId: userId,
              kind: 'story_media',
              status: 'ready',
            },
            select: {
              id: true,
            },
          })
        : Promise.resolve(null),
    ]);

    if (recentCount >= 10) {
      throw new ApiError(429, 'story_rate_limited', 'Story rate limit exceeded');
    }

    if (mediaAssetId != null && !asset) {
      throw new ApiError(
        400,
        'invalid_story_media_asset',
        'Story media asset is invalid',
      );
    }

    const story = await this.createStoryRecordSafely({
      eventId,
      userId,
      caption,
      emoji,
      mediaAssetId,
    });

    return this.mapStory(story);
  }

  async assertStoryParticipant(userId: string, eventId: string) {
    await this.assertParticipant(userId, eventId);
  }

  private normalizeLimit(limit?: number) {
    if (limit == null || !Number.isFinite(limit)) {
      return 20;
    }

    return Math.max(1, Math.min(Math.trunc(limit), 50));
  }

  private async resolveStoryCursor(
    eventId: string,
    cursor?: string,
  ): Promise<StoryCursor | null> {
    if (!cursor) {
      return null;
    }

    let decoded: ReturnType<typeof decodeCursor> = null;
    let cursorId: string | null = null;
    try {
      decoded = decodeCursor(cursor);
      cursorId = decoded?.value ?? null;
    } catch {
      cursorId = cursor;
    }

    if (!cursorId) {
      return null;
    }

    const createdAt = this.parseCursorDate(decoded?.createdAt);
    if (createdAt) {
      return {
        id: cursorId,
        createdAt,
      };
    }

    return this.prismaService.client.eventStory.findFirst({
      where: {
        id: cursorId,
        eventId,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });
  }

  private encodeStoryCursor(story: StoryCursor) {
    return encodeCursor({
      value: story.id,
      createdAt: story.createdAt.toISOString(),
    });
  }

  private parseCursorDate(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }

    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  private async assertParticipant(
    userId: string,
    eventId: string,
    blockedUserIds?: Set<string>,
  ) {
    const [participant, event, resolvedBlockedUserIds] = await Promise.all([
      this.prismaService.client.eventParticipant.findUnique({
        where: {
          eventId_userId: {
            eventId,
            userId,
          },
        },
        select: {
          id: true,
        },
      }),
      this.prismaService.client.event.findUnique({
        where: { id: eventId },
        select: { hostId: true },
      }),
      blockedUserIds
        ? Promise.resolve(blockedUserIds)
        : this.getBlockedUserIds(userId),
    ]);

    if (!event || resolvedBlockedUserIds.has(event.hostId)) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    if (!participant) {
      throw new ApiError(403, 'event_forbidden', 'You are not a participant of this event');
    }
  }

  private async getBlockedUserIds(userId: string) {
    return loadBlockedUserIds(this.prismaService.client, userId);
  }

  private async createStoryRecordSafely(input: {
    eventId: string;
    userId: string;
    caption: string;
    emoji: string;
    mediaAssetId: string | null;
  }) {
    try {
      return await this.prismaService.client.eventStory.create({
        data: {
          eventId: input.eventId,
          authorId: input.userId,
          caption: input.caption,
          emoji: input.emoji,
          mediaAssetId: input.mediaAssetId,
        },
        select: STORY_SELECT,
      });
    } catch (error) {
      if (
        input.mediaAssetId == null ||
        !this.isMediaAssetUniqueConflict(error)
      ) {
        throw error;
      }

      const existing = await this.prismaService.client.eventStory.findFirst({
        where: {
          mediaAssetId: input.mediaAssetId,
        },
        select: STORY_SELECT,
      });

      if (
        existing != null &&
        existing.eventId === input.eventId &&
        existing.authorId === input.userId
      ) {
        return existing;
      }

      throw new ApiError(
        409,
        'story_media_already_used',
        'Story media asset is already used',
      );
    }
  }

  private async findExistingStoryMediaRetry(
    eventId: string,
    userId: string,
    mediaAssetId: string,
  ) {
    return this.prismaService.client.eventStory.findFirst({
      where: {
        mediaAssetId,
        eventId,
        authorId: userId,
      },
      select: STORY_SELECT,
    });
  }

  private isMediaAssetUniqueConflict(error: unknown) {
    const isPrismaUnique =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002';
    const maybeError = error as {
      code?: unknown;
      meta?: { target?: unknown };
    };

    if (!isPrismaUnique && maybeError?.code !== 'P2002') {
      return false;
    }

    const target = maybeError.meta?.target;
    if (target == null) {
      return true;
    }
    if (Array.isArray(target)) {
      return target.includes('mediaAssetId');
    }
    return typeof target === 'string' && target.includes('mediaAssetId');
  }

  private async mapStory(
    story: {
      id: string;
      eventId: string;
      authorId: string;
      caption: string;
      emoji: string;
      createdAt: Date;
      author: {
        displayName: string;
        profile: {
          avatarUrl: string | null;
        } | null;
      };
      mediaAsset: {
        id: string;
        kind: string;
        objectKey: string;
        mimeType: string;
        byteSize: number;
        durationMs: number | null;
        publicUrl: string | null;
      } | null;
    },
  ) {
    const mediaAsset = story.mediaAsset;
    const signed = mediaAsset
      ? await createPresignedDownload(mediaAsset.objectKey ?? '')
      : null;

    const media = mediaAsset
      ? mapMediaResource(
          mediaAsset as Parameters<typeof mapMediaResource>[0],
          {
          visibility: 'private',
          url: signed?.url ?? null,
          downloadUrl: signed?.url ?? null,
          expiresAt: signed?.expiresAt ?? null,
        },
        )
      : null;
    const mediaKind = mediaAsset == null
      ? null
      : mediaAsset.mimeType.startsWith('video/')
        ? 'video'
        : 'image';

    return {
      id: story.id,
      eventId: story.eventId,
      authorId: story.authorId,
      authorName: story.author.displayName,
      avatarUrl: story.author.profile?.avatarUrl ?? null,
      caption: story.caption,
      emoji: story.emoji,
      createdAt: story.createdAt.toISOString(),
      media,
      mediaKind,
      previewHash: null,
      durationMs: mediaAsset?.durationMs ?? null,
    };
  }
}
