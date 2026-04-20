import { PutObjectCommand } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { buildPublicAssetUrl, createPresignedUpload, createS3Client } from '@big-break/database';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { mapBasicProfile } from '../common/presenters';
import { PrismaService } from './prisma.service';

const ALLOWED_AVATAR_MIME_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

@Injectable()
export class ProfileService {
  constructor(private readonly prismaService: PrismaService) {}

  private readonly s3 = createS3Client();

  async getBasicUser(userId: string) {
    const user = await this.prismaService.client.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new ApiError(404, 'user_not_found', 'User not found');
    }

    return mapBasicProfile(user);
  }

  async getProfile(userId: string) {
    return this.getBasicUser(userId);
  }

  async updateProfile(userId: string, body: Record<string, unknown>) {
    this.validateProfilePayload(body);

    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : undefined;

    await this.prismaService.client.$transaction(async (tx) => {
      if (displayName) {
        await tx.user.update({
          where: { id: userId },
          data: { displayName },
        });
      }

      await tx.profile.update({
        where: { userId },
        data: {
          age: typeof body.age === 'number' ? body.age : undefined,
          city: typeof body.city === 'string' ? body.city : undefined,
          area: typeof body.area === 'string' ? body.area : undefined,
          bio: typeof body.bio === 'string' ? body.bio : undefined,
          vibe: typeof body.vibe === 'string' ? body.vibe : undefined,
        },
      });
    });

    return this.getProfile(userId);
  }

  async getAvatarUploadUrl(userId: string, body: Record<string, unknown>) {
    const fileName = typeof body.fileName === 'string' ? body.fileName : 'avatar.jpg';
    const contentType = typeof body.contentType === 'string' ? body.contentType : 'image/jpeg';
    const objectKey = `avatars/${userId}/${randomUUID()}-${fileName}`;
    return createPresignedUpload({ objectKey, contentType });
  }

  async completeAvatarUpload(userId: string, body: Record<string, unknown>) {
    const objectKey = typeof body.objectKey === 'string' ? body.objectKey : undefined;
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg';
    const byteSize = typeof body.byteSize === 'number' ? body.byteSize : 0;
    const fileName = typeof body.fileName === 'string' ? body.fileName : 'avatar.jpg';

    if (!objectKey) {
      throw new ApiError(400, 'invalid_upload_payload', 'objectKey is required');
    }

    const asset = await this.prismaService.client.mediaAsset.create({
      data: {
        ownerId: userId,
        kind: 'avatar',
        status: 'ready',
        bucket: process.env.S3_BUCKET ?? 'big-break',
        objectKey,
        mimeType,
        byteSize,
        originalFileName: fileName,
        publicUrl: buildPublicAssetUrl(objectKey),
      },
    });

    await this.prismaService.client.profile.update({
      where: { userId },
      data: {
        avatarAssetId: asset.id,
        avatarUrl: buildPublicAssetUrl(objectKey),
      },
    });

    return {
      assetId: asset.id,
      status: asset.status,
    };
  }

  async uploadAvatarFile(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new ApiError(400, 'avatar_file_required', 'Avatar file is required');
    }

    if (!ALLOWED_AVATAR_MIME_TYPES.has(file.mimetype)) {
      throw new ApiError(400, 'invalid_avatar_mime_type', 'Avatar MIME type is invalid');
    }

    const objectKey = `avatars/${userId}/${randomUUID()}-${file.originalname}`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET ?? 'big-break',
        Key: objectKey,
        ContentType: file.mimetype,
        Body: file.buffer,
      }),
    );

    const asset = await this.prismaService.client.mediaAsset.create({
      data: {
        ownerId: userId,
        kind: 'avatar',
        status: 'ready',
        bucket: process.env.S3_BUCKET ?? 'big-break',
        objectKey,
        mimeType: file.mimetype,
        byteSize: file.size,
        originalFileName: file.originalname,
        publicUrl: buildPublicAssetUrl(objectKey),
      },
    });

    await this.prismaService.client.profile.update({
      where: { userId },
      data: {
        avatarAssetId: asset.id,
        avatarUrl: asset.publicUrl,
      },
    });

    return {
      assetId: asset.id,
      status: asset.status,
      url: asset.publicUrl,
    };
  }

  private validateProfilePayload(body: Record<string, unknown>) {
    if (body.displayName !== undefined) {
      if (typeof body.displayName !== 'string' || body.displayName.trim().length === 0) {
        throw new ApiError(400, 'invalid_profile_payload', 'displayName must be a non-empty string');
      }
    }

    if (body.age !== undefined) {
      if (!Number.isInteger(body.age) || (body.age as number) < 18 || (body.age as number) > 100) {
        throw new ApiError(400, 'invalid_profile_payload', 'age must be an integer from 18 to 100');
      }
    }

    for (const field of ['bio', 'city', 'area', 'vibe'] as const) {
      const value = body[field];
      if (value !== undefined && typeof value !== 'string') {
        throw new ApiError(400, 'invalid_profile_payload', `${field} must be a string`);
      }
    }
  }
}
