import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  buildPublicAssetUrl,
  createPresignedUpload,
  createS3Client,
  getS3Config,
} from '@big-break/database';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { mapBasicProfile, mapProfilePhoto } from '../common/presenters';
import { mapMediaResource } from '../common/media-presenters';
import { PrismaService } from './prisma.service';

const ALLOWED_AVATAR_MIME_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const BYPASS_S3_UPLOAD = process.env.NODE_ENV !== 'production';
export const MAX_PROFILE_ASSET_UPLOAD_BYTES = 10 * 1024 * 1024;
const INLINE_MEDIA_BUCKET = '__inline__';
const PROFILE_PHOTO_MEDIA_SELECT = {
  id: true,
  kind: true,
  mimeType: true,
  byteSize: true,
  durationMs: true,
  publicUrl: true,
} satisfies Prisma.MediaAssetSelect;
const EXISTING_AVATAR_ASSET_SELECT = {
  id: true,
  ownerId: true,
  kind: true,
  status: true,
  publicUrl: true,
} satisfies Prisma.MediaAssetSelect;

@Injectable()
export class ProfileService {
  constructor(private readonly prismaService: PrismaService) {}

  private readonly s3 = createS3Client();
  private readonly s3Bucket = getS3Config().bucket;

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
    const profileUpdate = this.buildProfileUpdate(body);

    await this.prismaService.client.$transaction(async (tx) => {
      if (displayName) {
        await tx.user.update({
          where: { id: userId },
          data: { displayName },
        });
      }

      if (Object.keys(profileUpdate).length > 0) {
        await tx.profile.update({
          where: { userId },
          data: profileUpdate,
        });
      }
    });

    return this.getProfile(userId);
  }

  async getAvatarUploadUrl(userId: string, body: Record<string, unknown>) {
    const fileName = typeof body.fileName === 'string' ? body.fileName : 'avatar.jpg';
    const contentType = typeof body.contentType === 'string' ? body.contentType : 'image/jpeg';
    this.assertAvatarMime(contentType);
    const objectKey = `avatars/${userId}/${randomUUID()}-${fileName}`;
    return createPresignedUpload({ objectKey, contentType });
  }

  async createProfilePhotoUpload(userId: string, body: Record<string, unknown>) {
    const fileName = typeof body.fileName === 'string' ? body.fileName : 'photo.jpg';
    const contentType =
      typeof body.contentType === 'string' ? body.contentType : 'image/jpeg';
    this.assertAvatarMime(contentType);
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

    this.assertAvatarObjectKey(userId, objectKey);
    const existing = await this.prismaService.client.mediaAsset.findUnique({
      where: { objectKey },
      select: EXISTING_AVATAR_ASSET_SELECT,
    });
    if (existing) {
      this.assertExistingAvatarAsset(existing, userId);
      await this.setProfileAvatar(userId, existing);
      return {
        assetId: existing.id,
        status: existing.status,
      };
    }

    const verified = await this.resolveVerifiedAvatarMetadata(
      objectKey,
      mimeType,
      byteSize,
    );
    this.assertAvatarMime(verified.mimeType);
    this.assertAvatarSize(verified.byteSize);

    const asset = await this.createAvatarUploadAsset(userId, {
      bucket: this.s3Bucket,
      objectKey,
      mimeType: verified.mimeType,
      byteSize: verified.byteSize,
      originalFileName: fileName,
      publicUrl: buildPublicAssetUrl(objectKey),
    });

    await this.setProfileAvatar(userId, asset);

    return {
      assetId: asset.id,
      status: asset.status,
    };
  }

  async uploadAvatarFile(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new ApiError(400, 'avatar_file_required', 'Avatar file is required');
    }

    this.assertAvatarMime(file.mimetype);
    this.assertAvatarSize(file.size);

    const objectKey = `avatars/${userId}/${randomUUID()}-${file.originalname}`;
    if (!BYPASS_S3_UPLOAD) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: objectKey,
          ContentType: file.mimetype,
          Body: file.buffer,
        }),
      );
    }
    const inlinePublicUrl = BYPASS_S3_UPLOAD
      ? this.buildInlineMediaDataUrl(file)
      : buildPublicAssetUrl(objectKey);

    const result = await this.prismaService.client.$transaction(async (tx) => {
      await this.lockProfilePhotoOrder(tx, userId);

      await tx.profilePhoto.updateMany({
        where: { profileUserId: userId },
        data: {
          sortOrder: {
            increment: 1,
          },
        },
      });

      const asset = await tx.mediaAsset.create({
        data: {
          ownerId: userId,
          kind: 'avatar',
          status: 'ready',
          bucket: BYPASS_S3_UPLOAD
            ? INLINE_MEDIA_BUCKET
            : this.s3Bucket,
          objectKey: BYPASS_S3_UPLOAD
            ? `inline-avatar/${userId}/${randomUUID()}-${file.originalname}`
            : objectKey,
          mimeType: file.mimetype,
          byteSize: file.size,
          originalFileName: file.originalname,
          publicUrl: inlinePublicUrl,
        },
        select: {
          id: true,
          kind: true,
          status: true,
          mimeType: true,
          byteSize: true,
          durationMs: true,
          publicUrl: true,
        },
      });

      const photo = await tx.profilePhoto.create({
        data: {
          profileUserId: userId,
          mediaAssetId: asset.id,
          sortOrder: 0,
        },
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
      });

      await tx.profile.update({
        where: { userId },
        data: {
          avatarAssetId: asset.id,
          avatarUrl: asset.publicUrl,
        },
      });

      return { asset, photo };
    });

    return {
      assetId: result.asset.id,
      status: result.asset.status,
      url: result.asset.publicUrl,
      media: mapMediaResource(result.asset, {
        visibility: 'public',
        url: result.asset.publicUrl,
        downloadUrl: result.asset.publicUrl,
      }),
      photo: mapProfilePhoto(result.photo),
    };
  }

  async uploadProfilePhotoFile(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new ApiError(400, 'avatar_file_required', 'Avatar file is required');
    }

    this.assertAvatarMime(file.mimetype);
    this.assertAvatarSize(file.size);

    const objectKey = `avatars/${userId}/${randomUUID()}-${file.originalname}`;
    if (!BYPASS_S3_UPLOAD) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: objectKey,
          ContentType: file.mimetype,
          Body: file.buffer,
        }),
      );
    }
    const inlinePublicUrl = BYPASS_S3_UPLOAD
      ? this.buildInlineMediaDataUrl(file)
      : buildPublicAssetUrl(objectKey);

    const next = await this._storeProfilePhotoAsset(userId, {
      bucket: BYPASS_S3_UPLOAD
          ? INLINE_MEDIA_BUCKET
          : this.s3Bucket,
      objectKey: BYPASS_S3_UPLOAD
          ? `inline-avatar/${userId}/${randomUUID()}-${file.originalname}`
          : objectKey,
      mimeType: file.mimetype,
      byteSize: file.size,
      originalFileName: file.originalname,
      publicUrl: inlinePublicUrl,
    });

    return {
      assetId: next.asset.id,
      status: next.asset.status,
      url: next.asset.publicUrl,
      photo: mapProfilePhoto(next.photo),
    };
  }

  async completeProfilePhotoUpload(userId: string, body: Record<string, unknown>) {
    const objectKey = typeof body.objectKey === 'string' ? body.objectKey : undefined;
    const mimeType =
      typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg';
    const byteSize = typeof body.byteSize === 'number' ? body.byteSize : 0;
    const fileName =
      typeof body.fileName === 'string' ? body.fileName : 'photo.jpg';

    if (!objectKey) {
      throw new ApiError(400, 'invalid_upload_payload', 'objectKey is required');
    }

    this.assertAvatarObjectKey(userId, objectKey);
    const existing = await this.prismaService.client.mediaAsset.findUnique({
      where: { objectKey },
      select: EXISTING_AVATAR_ASSET_SELECT,
    });
    if (existing) {
      return this.returnExistingProfilePhoto(userId, existing);
    }

    const verified = await this.resolveVerifiedAvatarMetadata(
      objectKey,
      mimeType,
      byteSize,
    );
    this.assertAvatarMime(verified.mimeType);
    this.assertAvatarSize(verified.byteSize);

    const next = await this.storeProfilePhotoAssetSafely(userId, {
      bucket: this.s3Bucket,
      objectKey,
      mimeType: verified.mimeType,
      byteSize: verified.byteSize,
      originalFileName: fileName,
      publicUrl: buildPublicAssetUrl(objectKey),
    });

    return {
      assetId: next.asset.id,
      status: next.asset.status,
      url: next.asset.publicUrl,
      photo: mapProfilePhoto(next.photo),
    };
  }

  private buildInlineMediaDataUrl(file: Express.Multer.File) {
    return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
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

      const profile = await tx.profile.findUnique({
        where: { userId },
        select: { avatarAssetId: true },
      });

      await tx.profilePhoto.delete({
        where: { id: photoId },
      });

      if (profile?.avatarAssetId === photo.mediaAssetId) {
        await tx.profile.update({
          where: { userId },
          data: {
            avatarAssetId: null,
            avatarUrl: null,
          },
        });
      }

      await this._normalizePhotoOrder(tx, userId);
      await this._syncPrimaryPhoto(tx, userId);
      await tx.mediaAsset.delete({
        where: { id: photo.mediaAssetId },
      });
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
    if (new Set(photoIds).size !== photoIds.length) {
      throw new ApiError(400, 'invalid_profile_photo_order', 'photoIds must be unique');
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

  private assertAvatarObjectKey(userId: string, objectKey: string) {
    if (!objectKey.startsWith(`avatars/${userId}/`)) {
      throw new ApiError(400, 'invalid_upload_payload', 'objectKey is invalid');
    }
  }

  private async resolveVerifiedAvatarMetadata(
    objectKey: string,
    mimeType: string,
    byteSize: number,
  ) {
    if (BYPASS_S3_UPLOAD) {
      return { mimeType, byteSize };
    }

    const object = await this.s3.send(
      new HeadObjectCommand({
        Bucket: this.s3Bucket,
        Key: objectKey,
      }),
    );

    return {
      mimeType: object.ContentType ?? mimeType,
      byteSize: object.ContentLength ?? byteSize,
    };
  }

  private assertAvatarMime(mimeType: string) {
    if (!ALLOWED_AVATAR_MIME_TYPES.has(mimeType)) {
      throw new ApiError(400, 'invalid_avatar_mime_type', 'Avatar MIME type is invalid');
    }
  }

  private assertAvatarSize(byteSize: number) {
    if (!Number.isSafeInteger(byteSize) || byteSize <= 0) {
      throw new ApiError(400, 'invalid_avatar_size', 'Avatar file size is invalid');
    }

    if (byteSize > MAX_PROFILE_ASSET_UPLOAD_BYTES) {
      throw new ApiError(400, 'avatar_too_large', 'Avatar file is too large');
    }
  }

  private validateProfilePayload(body: Record<string, unknown>) {
    if (body.displayName !== undefined) {
      if (typeof body.displayName !== 'string' || body.displayName.trim().length === 0) {
        throw new ApiError(400, 'invalid_profile_payload', 'displayName must be a non-empty string');
      }
    }

    if (body.age !== undefined && body.age !== null) {
      if (!Number.isInteger(body.age) || (body.age as number) < 18 || (body.age as number) > 100) {
        throw new ApiError(400, 'invalid_profile_payload', 'age must be an integer from 18 to 100');
      }
    }

    if (
      body.gender !== undefined &&
      body.gender !== null &&
      body.gender !== 'male' &&
      body.gender !== 'female'
    ) {
      throw new ApiError(400, 'invalid_profile_payload', 'gender must be male or female');
    }

    for (const field of ['bio', 'city', 'area', 'vibe'] as const) {
      const value = body[field];
      if (value !== undefined && value !== null && typeof value !== 'string') {
        throw new ApiError(400, 'invalid_profile_payload', `${field} must be a string`);
      }
    }
  }

  private buildProfileUpdate(body: Record<string, unknown>): Prisma.ProfileUpdateInput {
    const data: Prisma.ProfileUpdateInput = {};

    if (Object.prototype.hasOwnProperty.call(body, 'age')) {
      data.age = body.age == null ? null : (body.age as number);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'gender')) {
      data.gender =
        body.gender === 'male' || body.gender === 'female'
          ? body.gender
          : null;
    }
    for (const field of ['city', 'area', 'bio', 'vibe'] as const) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        data[field] = body[field] == null ? null : (body[field] as string);
      }
    }

    return data;
  }

  private async _loadProfileUser(
    client: Prisma.TransactionClient | PrismaService['client'],
    userId: string,
  ) {
    return client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        verified: true,
        online: true,
        profile: {
          select: {
            age: true,
            birthDate: true,
            gender: true,
            city: true,
            area: true,
            bio: true,
            vibe: true,
            rating: true,
            meetupCount: true,
            avatarUrl: true,
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
      select: {
        mediaAssetId: true,
        mediaAsset: {
          select: {
            publicUrl: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    await tx.profile.update({
      where: { userId },
      data: {
        avatarAssetId: firstPhoto?.mediaAssetId ?? null,
        avatarUrl: firstPhoto != null
            ? firstPhoto.mediaAsset.publicUrl ?? null
            : null,
      },
    });
  }

  private async setProfileAvatar(
    userId: string,
    asset: { id: string; publicUrl: string | null },
  ) {
    await this.prismaService.client.profile.update({
      where: { userId },
      data: {
        avatarAssetId: asset.id,
        avatarUrl: asset.publicUrl,
      },
    });
  }

  private async createAvatarUploadAsset(
    userId: string,
    input: {
      bucket: string;
      objectKey: string;
      mimeType: string;
      byteSize: number;
      originalFileName: string;
      publicUrl: string;
    },
  ) {
    try {
      return await this.prismaService.client.mediaAsset.create({
        data: {
          ownerId: userId,
          kind: 'avatar',
          status: 'ready',
          bucket: input.bucket,
          objectKey: input.objectKey,
          mimeType: input.mimeType,
          byteSize: input.byteSize,
          originalFileName: input.originalFileName,
          publicUrl: input.publicUrl,
        },
      });
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await this.prismaService.client.mediaAsset.findUnique({
        where: { objectKey: input.objectKey },
        select: EXISTING_AVATAR_ASSET_SELECT,
      });
      if (!existing) {
        throw error;
      }
      this.assertExistingAvatarAsset(existing, userId);
      return existing;
    }
  }

  private async storeProfilePhotoAssetSafely(
    userId: string,
    input: {
      bucket: string;
      objectKey: string;
      mimeType: string;
      byteSize: number;
      originalFileName: string;
      publicUrl: string;
    },
  ) {
    try {
      return await this._storeProfilePhotoAsset(userId, input);
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await this.prismaService.client.mediaAsset.findUnique({
        where: { objectKey: input.objectKey },
        select: EXISTING_AVATAR_ASSET_SELECT,
      });
      if (!existing) {
        throw error;
      }
      return this.loadExistingProfilePhoto(userId, existing);
    }
  }

  private async returnExistingProfilePhoto(
    userId: string,
    asset: {
      id: string;
      ownerId: string;
      kind: string;
      status: string;
      publicUrl: string | null;
    },
  ) {
    const next = await this.loadExistingProfilePhoto(userId, asset);
    return {
      assetId: next.asset.id,
      status: next.asset.status,
      url: next.asset.publicUrl,
      photo: mapProfilePhoto(next.photo),
    };
  }

  private async loadExistingProfilePhoto(
    userId: string,
    asset: {
      id: string;
      ownerId: string;
      kind: string;
      status: string;
      publicUrl: string | null;
    },
  ) {
    this.assertExistingAvatarAsset(asset, userId);
    const photo = await this.prismaService.client.profilePhoto.findUnique({
      where: { mediaAssetId: asset.id },
      select: {
        profileUserId: true,
        id: true,
        sortOrder: true,
        mediaAsset: {
          select: PROFILE_PHOTO_MEDIA_SELECT,
        },
      },
    });

    if (!photo || photo.profileUserId !== userId) {
      throw new ApiError(
        409,
        'upload_object_conflict',
        'Upload object was completed for another target',
      );
    }

    return { asset, photo };
  }

  private assertExistingAvatarAsset(
    asset: {
      ownerId: string;
      kind: string;
      status: string;
    },
    userId: string,
  ) {
    if (
      asset.ownerId !== userId ||
      asset.kind !== 'avatar' ||
      asset.status !== 'ready'
    ) {
      throw new ApiError(
        409,
        'upload_object_conflict',
        'Upload object was completed for another target',
      );
    }
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private async _storeProfilePhotoAsset(
    userId: string,
    input: {
      bucket: string;
      objectKey: string;
      mimeType: string;
      byteSize: number;
      originalFileName: string;
      publicUrl: string;
    },
  ) {
    return this.prismaService.client.$transaction(async (tx) => {
      const asset = await tx.mediaAsset.create({
        data: {
          ownerId: userId,
          kind: 'avatar',
          status: 'ready',
          bucket: input.bucket,
          objectKey: input.objectKey,
          mimeType: input.mimeType,
          byteSize: input.byteSize,
          originalFileName: input.originalFileName,
          publicUrl: input.publicUrl,
        },
        select: {
          id: true,
          status: true,
          publicUrl: true,
        },
      });

      await this.lockProfilePhotoOrder(tx, userId);

      const lastPhoto = await tx.profilePhoto.findFirst({
        where: { profileUserId: userId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });

      const photo = await tx.profilePhoto.create({
        data: {
          profileUserId: userId,
          mediaAssetId: asset.id,
          sortOrder: (lastPhoto?.sortOrder ?? -1) + 1,
        },
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
      });

      await this._syncPrimaryPhoto(tx, userId);
      return { asset, photo };
    });
  }

  private async lockProfilePhotoOrder(tx: Prisma.TransactionClient, userId: string) {
    await tx.$executeRaw`
      SELECT 1
      FROM "Profile"
      WHERE "userId" = ${userId}
      FOR UPDATE
    `;
  }
}
