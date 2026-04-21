import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { createS3Client } from '@big-break/database';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

@Injectable()
export class MediaService {
  constructor(private readonly prismaService: PrismaService) {}

  private readonly s3 = createS3Client();

  async getAsset(assetId: string) {
    const asset = await this.prismaService.client.mediaAsset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        status: true,
        bucket: true,
        objectKey: true,
        mimeType: true,
      },
    });

    if (!asset || asset.status !== 'ready') {
      throw new ApiError(404, 'media_not_found', 'Media asset not found');
    }

    const object = await this.s3.send(
      new GetObjectCommand({
        Bucket: asset.bucket,
        Key: asset.objectKey,
      }),
    );

    if (!object.Body) {
      throw new ApiError(404, 'media_not_found', 'Media asset not found');
    }

    const bytes = await object.Body.transformToByteArray();

    return {
      bytes: Buffer.from(bytes),
      mimeType: asset.mimeType,
    };
  }
}
