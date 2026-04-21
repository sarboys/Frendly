import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { createS3Client } from '@big-break/database';
import { Readable } from 'node:stream';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

@Injectable()
export class MediaService {
  constructor(private readonly prismaService: PrismaService) {}

  private readonly s3 = createS3Client();

  async getAsset(assetId: string, rangeHeader?: string) {
    const asset = await this.prismaService.client.mediaAsset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        status: true,
        bucket: true,
        objectKey: true,
        mimeType: true,
        byteSize: true,
      },
    });

    if (!asset || asset.status !== 'ready') {
      throw new ApiError(404, 'media_not_found', 'Media asset not found');
    }

    const requestedRange = this.parseRange(rangeHeader, asset.byteSize);
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
      contentLength: end - start + 1,
      contentRange:
          requestedRange == null
              ? null
              : `bytes ${start}-${end}/${asset.byteSize}`,
    };
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
}
