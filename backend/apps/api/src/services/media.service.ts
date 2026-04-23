import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import {
  createPresignedDownload,
  createS3Client,
  verifyAccessToken,
} from '@big-break/database';
import { Readable } from 'node:stream';
import { ApiError } from '../common/api-error';
import { mapMediaResource } from '../common/media-presenters';
import { PrismaService } from './prisma.service';

@Injectable()
export class MediaService {
  constructor(private readonly prismaService: PrismaService) {}

  private readonly s3 = createS3Client();

  async getAsset(
    assetId: string,
    rangeHeader?: string,
    authorizationHeader?: string,
  ) {
    const asset = await this.prismaService.client.mediaAsset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        status: true,
        ownerId: true,
        kind: true,
        chatId: true,
        bucket: true,
        objectKey: true,
        mimeType: true,
        byteSize: true,
        publicUrl: true,
      },
    });

    if (!asset || asset.status !== 'ready') {
      throw new ApiError(404, 'media_not_found', 'Media asset not found');
    }

    const cacheControl = await this.resolveCachePolicy(asset, authorizationHeader);

    const requestedRange = this.parseRange(rangeHeader, asset.byteSize);
    const inlineAsset = this.tryReadInlineAsset(asset.publicUrl, requestedRange);
    if (inlineAsset != null) {
      return {
        stream: inlineAsset.stream,
        mimeType: inlineAsset.mimeType,
        cacheControl,
        contentLength: inlineAsset.contentLength,
        contentRange: inlineAsset.contentRange,
      };
    }

    const object = await this.s3.send(
      new GetObjectCommand({
        Bucket: asset.bucket,
        Key: asset.objectKey,
        Range:
            requestedRange == null
                ? undefined
                : `bytes=${requestedRange.start}-${requestedRange.end}`,
      }),
    );

    if (!object.Body) {
      throw new ApiError(404, 'media_not_found', 'Media asset not found');
    }

    const start = requestedRange?.start ?? 0;
    const end = requestedRange?.end ?? (asset.byteSize - 1);

    return {
      stream: object.Body as unknown as Readable,
      mimeType: asset.mimeType,
      cacheControl,
      contentLength: end - start + 1,
      contentRange:
          requestedRange == null
              ? null
              : `bytes ${start}-${end}/${asset.byteSize}`,
    };
  }

  async getDownloadUrl(userId: string, assetId: string) {
    const asset = await this.prismaService.client.mediaAsset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        status: true,
        ownerId: true,
        kind: true,
        chatId: true,
        objectKey: true,
        publicUrl: true,
        mimeType: true,
        byteSize: true,
        durationMs: true,
      },
    });

    if (!asset || asset.status !== 'ready') {
      throw new ApiError(404, 'media_not_found', 'Media asset not found');
    }

    const access = await this.resolveAssetAccess(asset, userId);

    if (access.visibility === 'public' && asset.publicUrl != null) {
      return mapMediaResource(asset, {
        visibility: 'public',
        url: asset.publicUrl,
        downloadUrl: asset.publicUrl,
      });
    }

    const signed = await createPresignedDownload(asset.objectKey);

    return mapMediaResource(asset, {
      visibility: 'private',
      url: signed.url,
      downloadUrl: signed.url,
      expiresAt: signed.expiresAt,
    });
  }

  private async resolveCachePolicy(
    asset: {
      id: string;
      ownerId: string;
      kind: string;
      chatId: string | null;
    },
    authorizationHeader?: string,
  ) {
    if (this.isPublicKind(asset.kind)) {
      return 'public, max-age=31536000, immutable';
    }

    const userId = await this.requireAuthenticatedUserId(authorizationHeader);
    const access = await this.resolveAssetAccess(asset, userId);
    if (access.visibility === 'private') {
      return 'private, max-age=300';
    }

    throw new ApiError(403, 'media_forbidden', 'Media asset is forbidden');
  }

  private isPublicKind(kind: string) {
    return kind === 'avatar' || kind === 'poster_cover';
  }

  private async resolveAssetAccess(
    asset: {
      id: string;
      ownerId: string;
      kind: string;
      chatId: string | null;
    },
    userId: string,
  ): Promise<{ visibility: 'public' | 'private' }> {
    if (this.isPublicKind(asset.kind)) {
      return { visibility: 'public' };
    }

    if (asset.ownerId === userId) {
      return { visibility: 'private' };
    }

    if (asset.chatId != null) {
      const membership = await this.prismaService.client.chatMember.findUnique({
        where: {
          chatId_userId: {
            chatId: asset.chatId,
            userId,
          },
        },
        select: { id: true },
      });

      if (membership) {
        return { visibility: 'private' };
      }
    }

    if (asset.kind === 'story_media') {
      const story = await this.prismaService.client.eventStory.findFirst({
        where: { mediaAssetId: asset.id },
        select: { eventId: true },
      });

      if (story) {
        const participant =
          await this.prismaService.client.eventParticipant.findUnique({
            where: {
              eventId_userId: {
                eventId: story.eventId,
                userId,
              },
            },
            select: { id: true },
          });

        if (participant) {
          return { visibility: 'private' };
        }
      }
    }

    throw new ApiError(403, 'media_forbidden', 'Media asset is forbidden');
  }

  private async requireAuthenticatedUserId(authorizationHeader?: string) {
    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw new ApiError(401, 'auth_required', 'Missing bearer token');
    }

    const token = authorizationHeader.slice('Bearer '.length);
    let payload;

    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new ApiError(401, 'invalid_access_token', 'Access token is invalid');
    }

    const session = await this.prismaService.client.session.findUnique({
      where: { id: payload.sessionId },
      select: {
        userId: true,
        revokedAt: true,
      },
    });

    if (!session || session.userId !== payload.userId || session.revokedAt != null) {
      throw new ApiError(401, 'stale_access_token', 'Access token is stale');
    }

    return payload.userId;
  }

  private parseRange(
    rangeHeader: string | undefined,
    byteSize: number,
  ): { start: number; end: number } | null {
    if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
      return null;
    }

    const [startRaw, endRaw] = rangeHeader.replace('bytes=', '').split('-', 2);
    const start = Number(startRaw);
    const end = endRaw ? Number(endRaw) : byteSize - 1;

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end < start ||
      end >= byteSize
    ) {
      throw new ApiError(416, 'invalid_media_range', 'Media range is invalid');
    }

    return { start, end };
  }

  private tryReadInlineAsset(
    publicUrl: string | null,
    requestedRange: { start: number; end: number } | null,
  ) {
    if (publicUrl == null || !publicUrl.startsWith('data:')) {
      return null;
    }

    const match = /^data:([^;]+);base64,(.+)$/.exec(publicUrl);
    if (match == null) {
      throw new ApiError(500, 'invalid_inline_media', 'Inline media is invalid');
    }

    const mimeType = match[1]!;
    const payload = Buffer.from(match[2]!, 'base64');
    const start = requestedRange?.start ?? 0;
    const end = requestedRange?.end ?? (payload.length - 1);
    const sliced = payload.subarray(start, end + 1);

    return {
      stream: Readable.from(sliced),
      mimeType,
      contentLength: sliced.length,
      contentRange:
          requestedRange == null
              ? null
              : 'bytes $start-$end/${payload.length}',
    };
  }
}
