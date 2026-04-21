import { PutObjectCommand } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  buildMediaProxyPath,
  buildPublicAssetUrl,
  createPresignedUpload,
  createS3Client,
} from '@big-break/database';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { mapBasicProfile, mapProfilePhoto } from '../common/presenters';
import { PrismaService } from './prisma.service';

const ALLOWED_AVATAR_MIME_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const BYPASS_S3_UPLOAD = process.env.NODE_ENV === 'test';

@Injectable()
export class ProfileService {
  constructor(private readonly prismaService: PrismaService) {}

  private readonly s3 = createS3Client();

  async getBasicUser(userId: string) {
    const user = await this._loadProfileUser(this.prismaService.client, userId);

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
        avatarUrl: buildMediaProxyPath(asset.id),
      },
    });

    return {
      assetId: asset.id,
      status: asset.status,
    };
  }

  async uploadAvatarFile(userId: string, file: Express.Multer.File) {
    const result = await this.uploadProfilePhotoFile(userId, file);
    await this.makePrimaryPhoto(userId, result.photo.id);
    return {
      assetId: result.assetId,
      status: result.status,
      url: buildMediaProxyPath(result.assetId),
      photo: result.photo,
    };
  }

  async uploadProfilePhotoFile(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new ApiError(400, 'avatar_file_required', 'Avatar file is required');
    }

    if (!ALLOWED_AVATAR_MIME_TYPES.has(file.mimetype)) {
      throw new ApiError(400, 'invalid_avatar_mime_type', 'Avatar MIME type is invalid');
    }

    const objectKey = `avatars/${userId}/${randomUUID()}-${file.originalname}`;
    if (!BYPASS_S3_UPLOAD) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET ?? 'big-break',
          Key: objectKey,
          ContentType: file.mimetype,
          Body: file.buffer,
        }),
      );
    }

    const next = await this.prismaService.client.$transaction(async (tx) => {
      const asset = await tx.mediaAsset.create({
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

      const currentCount = await tx.profilePhoto.count({
        where: { profileUserId: userId },
      });

      const photo = await tx.profilePhoto.create({
        data: {
          profileUserId: userId,
          mediaAssetId: asset.id,
          sortOrder: currentCount,
        },
        include: {
          mediaAsset: true,
        },
      });

      await this._syncPrimaryPhoto(tx, userId);
      return { asset, photo };
    });

    return {
      assetId: next.asset.id,
      status: next.asset.status,
      url: next.asset.publicUrl,
      photo: mapProfilePhoto(next.photo),
    };
  }

  async deleteProfilePhoto(userId: string, photoId: string) {
    await this.prismaService.client.$transaction(async (tx) => {
      const photo = await tx.profilePhoto.findFirst({
        where: {
          id: photoId,
          profileUserId: userId,
        },
      });
      if (!photo) {
        throw new ApiError(404, 'profile_photo_not_found', 'Profile photo not found');
      }

      await tx.profilePhoto.delete({
        where: { id: photoId },
      });
      await tx.mediaAsset.delete({
        where: { id: photo.mediaAssetId },
      });

      await this._normalizePhotoOrder(tx, userId);
      await this._syncPrimaryPhoto(tx, userId);
    });

    return this.getProfile(userId);
  }

  async makePrimaryPhoto(userId: string, photoId: string) {
    await this.prismaService.client.$transaction(async (tx) => {
      const photos = await tx.profilePhoto.findMany({
        where: { profileUserId: userId },
        orderBy: { sortOrder: 'asc' },
      });

      const target = photos.find((photo) => photo.id === photoId);
      if (!target) {
        throw new ApiError(404, 'profile_photo_not_found', 'Profile photo not found');
      }

      const ordered = [target, ...photos.filter((photo) => photo.id !== photoId)];
      for (const [index, photo] of ordered.entries()) {
        await tx.profilePhoto.update({
          where: { id: photo.id },
          data: { sortOrder: index },
        });
      }

      await this._syncPrimaryPhoto(tx, userId);
    });

    return this.getProfile(userId);
  }

  async reorderProfilePhotos(userId: string, body: Record<string, unknown>) {
    const photoIds = Array.isArray(body.photoIds)
      ? body.photoIds.filter((item): item is string => typeof item === 'string')
      : null;
    if (photoIds == null || photoIds.length === 0) {
      throw new ApiError(400, 'invalid_profile_photo_order', 'photoIds must be a non-empty string array');
    }

    await this.prismaService.client.$transaction(async (tx) => {
      const photos = await tx.profilePhoto.findMany({
        where: { profileUserId: userId },
        orderBy: { sortOrder: 'asc' },
      });

      if (photos.length !== photoIds.length) {
        throw new ApiError(400, 'invalid_profile_photo_order', 'photoIds length mismatch');
      }

      const currentIds = new Set(photos.map((photo) => photo.id));
      for (const photoId of photoIds) {
        if (!currentIds.has(photoId)) {
          throw new ApiError(400, 'invalid_profile_photo_order', 'photoIds must belong to the user');
        }
      }

      for (const [index, photoId] of photoIds.entries()) {
        await tx.profilePhoto.update({
          where: { id: photoId },
          data: { sortOrder: index },
        });
      }

      await this._syncPrimaryPhoto(tx, userId);
    });

    return this.getProfile(userId);
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

  private async _loadProfileUser(
    client: Prisma.TransactionClient | PrismaService['client'],
    userId: string,
  ) {
    return client.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            photos: {
              include: { mediaAsset: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });
  }

  private async _normalizePhotoOrder(tx: Prisma.TransactionClient, userId: string) {
    const photos = await tx.profilePhoto.findMany({
      where: { profileUserId: userId },
      orderBy: { sortOrder: 'asc' },
    });

    for (const [index, photo] of photos.entries()) {
      if (photo.sortOrder === index) {
        continue;
      }
      await tx.profilePhoto.update({
        where: { id: photo.id },
        data: { sortOrder: index },
      });
    }
  }

  private async _syncPrimaryPhoto(tx: Prisma.TransactionClient, userId: string) {
    const firstPhoto = await tx.profilePhoto.findFirst({
      where: { profileUserId: userId },
      include: { mediaAsset: true },
      orderBy: { sortOrder: 'asc' },
    });

    await tx.profile.update({
      where: { userId },
      data: {
        avatarAssetId: firstPhoto?.mediaAssetId ?? null,
        avatarUrl: firstPhoto != null
            ? buildMediaProxyPath(firstPhoto.mediaAssetId)
            : null,
      },
    });
  }
}
