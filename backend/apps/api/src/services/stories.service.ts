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
    const cursorId = this.decodeStoryCursor(params.cursor);
    const cursorStory = cursorId
      ? await this.prismaService.client.eventStory.findFirst({
          where: {
            id: cursorId,
            eventId,
          },
          select: {
            id: true,
            createdAt: true,
          },
        })
      : null;

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
      include: {
        author: {
          include: { profile: true },
        },
        mediaAsset: true,
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: take + 1,
    });

    const visibleStories = await Promise.all(
      stories.map((story) => this.mapStory(story)),
    );
    const hasMore = visibleStories.length > take;
    const page = hasMore
      ? visibleStories.slice(0, take)
      : visibleStories;

    return {
      items: [...page].reverse(),
      nextCursor:
        hasMore && page.length > 0
          ? encodeCursor({ value: page[page.length - 1]!.id })
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

    const recentCount = await this.prismaService.client.eventStory.count({
      where: {
        eventId,
        authorId: userId,
        createdAt: {
          gte: new Date(Date.now() - 15 * 60 * 1000),
        },
      },
    });

    if (recentCount >= 10) {
      throw new ApiError(429, 'story_rate_limited', 'Story rate limit exceeded');
    }

    const asset = mediaAssetId
      ? await this.prismaService.client.mediaAsset.findFirst({
          where: {
            id: mediaAssetId,
            ownerId: userId,
            kind: 'story_media',
            status: 'ready',
          },
        })
      : null;

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

  private decodeStoryCursor(cursor?: string) {
    if (!cursor) {
      return null;
    }

    try {
      return decodeCursor(cursor)?.value ?? null;
    } catch {
      return cursor;
    }
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
        include: {
          author: {
            include: { profile: true },
          },
          mediaAsset: true,
        },
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
        include: {
          author: {
            include: { profile: true },
          },
          mediaAsset: true,
        },
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
      include: {
        author: {
          include: { profile: true },
        },
        mediaAsset: true,
      },
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
