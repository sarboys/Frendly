import { Injectable } from '@nestjs/common';
import {
  createPresignedDownload,
  decodeCursor,
  encodeCursor,
} from '@big-break/database';
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
    await this.assertParticipant(userId, eventId);
    const blockedUserIds = await this.getBlockedUserIds(userId);
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
      stories
        .filter((story) => !blockedUserIds.has(story.authorId))
        .map((story) => this.mapStory(story)),
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

    const story = await this.prismaService.client.eventStory.create({
      data: {
        eventId,
        authorId: userId,
        caption,
        emoji,
        mediaAssetId,
      },
      include: {
        author: {
          include: { profile: true },
        },
        mediaAsset: true,
      },
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

  private async assertParticipant(userId: string, eventId: string) {
    const [participant, event, blockedUserIds] = await Promise.all([
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
      this.getBlockedUserIds(userId),
    ]);

    if (!event || blockedUserIds.has(event.hostId)) {
      throw new ApiError(404, 'event_not_found', 'Event not found');
    }

    if (!participant) {
      throw new ApiError(403, 'event_forbidden', 'You are not a participant of this event');
    }
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
