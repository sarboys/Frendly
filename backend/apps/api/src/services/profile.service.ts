import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  buildMediaProxyPath,
  buildPublicAssetUrl,
  createPresignedUpload,
  createS3Client,
  createS3RequestOptions,
  decodeCursor,
  encodeCursor,
  getBlockedUserIds as loadBlockedUserIds,
  getS3Config,
  OUTBOX_EVENT_TYPES,
} from '@big-break/database';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { mapBasicProfile, mapProfilePhoto, mapUserPreview } from '../common/presenters';
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
const IMMUTABLE_MEDIA_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const FR_PERIOD_DAY_MS = 24 * 60 * 60 * 1000;
const FR_SEASON_HISTORY_LIMIT = 20;
const FR_SEASON_REWARDS = [
  {
    key: 'checkin-1',
    threshold: 1,
    statusTitle: 'Искра',
    title: 'Первая искра',
    description: '50 токенов за первый вечер сезона',
    rewardKind: 'tokens',
    rewardAmount: 50,
  },
  {
    key: 'checkin-5',
    threshold: 5,
    statusTitle: 'Свой круг',
    title: 'Свой круг',
    description: '150 токенов за 5 вечеров',
    rewardKind: 'tokens',
    rewardAmount: 150,
  },
  {
    key: 'checkin-10',
    threshold: 10,
    statusTitle: 'Человек вечера',
    title: 'Человек вечера',
    description: 'Frendly+ на 1 месяц',
    rewardKind: 'subscription',
    rewardAmount: 30,
  },
  {
    key: 'checkin-15',
    threshold: 15,
    statusTitle: 'Городской ритм',
    title: 'Городской ритм',
    description: '500 токенов за 15 вечеров',
    rewardKind: 'tokens',
    rewardAmount: 500,
  },
  {
    key: 'checkin-25',
    threshold: 25,
    statusTitle: 'Легенда месяца',
    title: 'Легенда месяца',
    description: 'Frendly+ на 6 месяцев',
    rewardKind: 'subscription',
    rewardAmount: 180,
  },
] as const;
const PROFILE_PHOTO_MEDIA_SELECT = {
  id: true,
  kind: true,
  mimeType: true,
  byteSize: true,
  durationMs: true,
  publicUrl: true,
  variants: true,
} satisfies Prisma.MediaAssetSelect;

type PrismaLike = Prisma.TransactionClient | PrismaService['client'];
type FrendlySeasonReward = (typeof FR_SEASON_REWARDS)[number];
type FrendlySeasonBounds = {
  seasonKey: string;
  label: string;
  start: Date;
  end: Date;
};
const EXISTING_AVATAR_ASSET_SELECT = {
  id: true,
  ownerId: true,
  kind: true,
  status: true,
  publicUrl: true,
  variants: true,
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

  async getFrendlySeason(userId: string) {
    const now = new Date(Date.now());
    const season = this.currentSeason(now);
    const [attendances, claims] = await Promise.all([
      this.prismaService.client.eventAttendance.findMany({
        where: this.buildSeasonAttendanceWhere(userId, season),
        select: {
          eventId: true,
          event: {
            select: {
              id: true,
              startsAt: true,
              place: true,
              latitude: true,
              longitude: true,
            },
          },
        },
        orderBy: [{ event: { startsAt: 'asc' } }, { eventId: 'asc' }],
      }),
      this.prismaService.client.userSeasonRewardClaim.findMany({
        where: {
          userId,
          seasonKey: season.seasonKey,
        },
        select: {
          rewardKey: true,
          claimedAt: true,
        },
      }),
    ]);
    const eventIds = attendances.map((attendance) => attendance.eventId);
    const peopleRows =
      eventIds.length === 0
        ? []
        : await this.prismaService.client.eventParticipant.findMany({
            where: {
              eventId: {
                in: eventIds,
              },
              userId: {
                notIn: [userId],
              },
            },
            select: {
              userId: true,
            },
            distinct: ['userId'],
          });
    const checkedInCount = attendances.length;
    const claimedByKey = new Map(
      claims.map((claim) => [claim.rewardKey, claim.claimedAt]),
    );
    const peopleIds = new Set(peopleRows.map((person) => person.userId));
    const places = new Set(
      attendances
        .map((attendance) => attendance.event.place.trim())
        .filter(Boolean),
    );
    const calendarDays = [
      ...new Set(
        attendances.map((attendance) => attendance.event.startsAt.getUTCDate()),
      ),
    ];
    const currentStatus =
      [...FR_SEASON_REWARDS]
        .reverse()
        .find((reward) => reward.threshold <= checkedInCount) ??
      FR_SEASON_REWARDS[0];
    const nextReward =
      FR_SEASON_REWARDS.find((reward) => reward.threshold > checkedInCount) ??
      null;

    return {
      seasonKey: season.seasonKey,
      seasonLabel: season.label,
      checkedInCount,
      calendarDays,
      currentStatus: {
        key: currentStatus.key,
        title: currentStatus.statusTitle,
        threshold: currentStatus.threshold,
      },
      nextReward:
        nextReward == null
          ? null
          : this.mapSeasonReward(nextReward, checkedInCount, claimedByKey),
      stats: {
        checkIns: checkedInCount,
        places: places.size,
        people: peopleIds.size,
      },
      rewards: FR_SEASON_REWARDS.map((reward) =>
        this.mapSeasonReward(reward, checkedInCount, claimedByKey),
      ),
    };
  }

  async claimFrendlySeasonReward(userId: string, rewardKey: string) {
    const now = new Date(Date.now());
    const season = this.currentSeason(now);
    const reward = this.findSeasonReward(rewardKey);
    if (!reward) {
      throw new ApiError(400, 'frendly_reward_invalid', 'Reward is invalid');
    }

    return this.prismaService.client.$transaction(async (tx) => {
      const existing = await tx.userSeasonRewardClaim.findUnique({
        where: {
          userId_seasonKey_rewardKey: {
            userId,
            seasonKey: season.seasonKey,
            rewardKey: reward.key,
          },
        },
        select: {
          rewardKey: true,
          claimedAt: true,
        },
      });
      if (existing) {
        return {
          claimed: true,
          alreadyClaimed: true,
          claimedAt: existing.claimedAt.toISOString(),
          reward: this.mapSeasonReward(
            reward,
            reward.threshold,
            new Map([[reward.key, existing.claimedAt]]),
          ),
        };
      }

      const checkedInCount = await tx.eventAttendance.count({
        where: this.buildSeasonAttendanceWhere(userId, season),
      });
      if (checkedInCount < reward.threshold) {
        throw new ApiError(409, 'frendly_reward_locked', 'Reward is locked');
      }

      if (reward.rewardKind === 'tokens') {
        await this.grantSeasonTokens(tx, userId, reward.rewardAmount);
      } else {
        await this.grantSeasonSubscription(tx, userId, reward.rewardAmount);
      }

      const claim = await tx.userSeasonRewardClaim.create({
        data: {
          userId,
          seasonKey: season.seasonKey,
          rewardKey: reward.key,
          rewardKind: reward.rewardKind,
          rewardAmount: reward.rewardAmount,
        },
      });

      return {
        claimed: true,
        alreadyClaimed: false,
        claimedAt: claim.claimedAt.toISOString(),
        reward: this.mapSeasonReward(
          reward,
          checkedInCount,
          new Map([[reward.key, claim.claimedAt]]),
        ),
      };
    });
  }

  async listFrendlyHistory(
    userId: string,
    params: { cursor?: string; limit?: number } = {},
  ) {
    const now = new Date(Date.now());
    const limit = this.normalizeFrendlyListLimit(params.limit);
    const cursor = this.decodeFrendlyCursor(params.cursor);
    const blockedUserIds = await this.getBlockedUserIds(userId);
    const hiddenUserIds = [userId, ...blockedUserIds];
    const page = await this.prismaService.client.eventAttendance.findMany({
      where: {
        userId,
        status: 'checked_in',
        ...(cursor == null
          ? {}
          : {
              OR: [
                {
                  event: {
                    startsAt: {
                      lt: cursor.startsAt,
                    },
                  },
                },
                {
                  eventId: {
                    lt: cursor.id,
                  },
                  event: {
                    startsAt: cursor.startsAt,
                  },
                },
              ],
            }),
        event: {
          canceledAt: null,
          startsAt: {
            lte: now,
          },
        },
      },
      select: {
        eventId: true,
        event: {
          select: {
            id: true,
            title: true,
            emoji: true,
            startsAt: true,
            place: true,
            latitude: true,
            longitude: true,
            chat: {
              select: {
                id: true,
              },
            },
            participants: {
              where: {
                userId: {
                  notIn: hiddenUserIds,
                },
              },
              select: {
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    verified: true,
                    online: true,
                    profile: {
                      select: {
                        avatarUrl: true,
                      },
                    },
                  },
                },
              },
              orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
              take: 6,
            },
          },
        },
      },
      orderBy: [{ event: { startsAt: 'desc' } }, { eventId: 'desc' }],
      take: limit + 1,
    });
    const hasMore = page.length > limit;
    const items = (hasMore ? page.slice(0, limit) : page).map((attendance) => ({
      eventId: attendance.event.id,
      title: attendance.event.title,
      emoji: attendance.event.emoji,
      startsAt: attendance.event.startsAt.toISOString(),
      place: attendance.event.place,
      latitude: attendance.event.latitude,
      longitude: attendance.event.longitude,
      chatId: attendance.event.chat?.id ?? null,
      people: attendance.event.participants.map((participant) =>
        mapUserPreview(participant.user),
      ),
    }));

    return {
      items,
      nextCursor:
        hasMore && items.length > 0
          ? this.encodeFrendlyCursor(
              items[items.length - 1]!.eventId,
              items[items.length - 1]!.startsAt,
            )
          : null,
    };
  }

  async listFrendlyPeople(
    userId: string,
    params: { cursor?: string; limit?: number } = {},
  ) {
    const now = new Date(Date.now());
    const limit = this.normalizeFrendlyListLimit(params.limit);
    const cursor = this.decodeFrendlyCursor(params.cursor);
    const blockedUserIds = await this.getBlockedUserIds(userId);
    const attended = await this.prismaService.client.eventAttendance.findMany({
      where: {
        userId,
        status: 'checked_in',
        event: {
          canceledAt: null,
          startsAt: {
            lte: now,
          },
        },
      },
      select: {
        eventId: true,
      },
      orderBy: [{ event: { startsAt: 'desc' } }, { eventId: 'desc' }],
      take: 100,
    });
    const eventIds = attended.map((attendance) => attendance.eventId);
    if (eventIds.length === 0) {
      return { items: [], nextCursor: null };
    }

    const rows = await this.prismaService.client.eventParticipant.findMany({
      where: {
        eventId: {
          in: eventIds,
        },
        userId: {
          notIn: [userId, ...blockedUserIds],
        },
      },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            displayName: true,
            verified: true,
            online: true,
            profile: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
        event: {
          select: {
            title: true,
            place: true,
            startsAt: true,
          },
        },
      },
    });
    const byUserId = new Map<
      string,
      {
        user: (typeof rows)[number]['user'];
        meetupsCount: number;
        lastMetAt: Date;
        lastEventTitle: string;
        lastEventPlace: string;
      }
    >();
    for (const row of rows) {
      const current = byUserId.get(row.userId);
      if (!current) {
        byUserId.set(row.userId, {
          user: row.user,
          meetupsCount: 1,
          lastMetAt: row.event.startsAt,
          lastEventTitle: row.event.title,
          lastEventPlace: row.event.place,
        });
        continue;
      }
      current.meetupsCount += 1;
      if (row.event.startsAt.getTime() > current.lastMetAt.getTime()) {
        current.lastMetAt = row.event.startsAt;
        current.lastEventTitle = row.event.title;
        current.lastEventPlace = row.event.place;
      }
    }

    const allItems = [...byUserId.entries()]
      .map(([personUserId, item]) => ({
        ...mapUserPreview(item.user),
        userId: personUserId,
        meetupsCount: item.meetupsCount,
        lastMetAt: item.lastMetAt.toISOString(),
        lastEventTitle: item.lastEventTitle,
        lastEventPlace: item.lastEventPlace,
      }))
      .sort((left, right) => {
        const timeDiff =
          Date.parse(right.lastMetAt) - Date.parse(left.lastMetAt);
        return timeDiff !== 0
          ? timeDiff
          : left.userId.localeCompare(right.userId);
      });
    const cursorIndex =
      cursor == null
        ? -1
        : allItems.findIndex(
            (item) =>
              item.userId === cursor.id &&
              item.lastMetAt === cursor.startsAt.toISOString(),
          );
    const visible = allItems.slice(cursorIndex + 1, cursorIndex + 1 + limit);
    const hasMore = cursorIndex + 1 + limit < allItems.length;

    return {
      items: visible,
      nextCursor:
        hasMore && visible.length > 0
          ? this.encodeFrendlyCursor(
              visible[visible.length - 1]!.userId,
              visible[visible.length - 1]!.lastMetAt,
            )
          : null,
    };
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
          CacheControl: IMMUTABLE_MEDIA_CACHE_CONTROL,
          Body: file.buffer,
        }),
        createS3RequestOptions(),
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
          variants: true,
        },
      });

      if (!BYPASS_S3_UPLOAD) {
        await tx.outboxEvent.create({
          data: {
            type: OUTBOX_EVENT_TYPES.mediaFinalize,
            payload: {
              assetId: asset.id,
            },
          },
        });
      }

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
              variants: true,
            },
          },
        },
      });

      await tx.profile.update({
        where: { userId },
        data: {
          avatarAssetId: asset.id,
          avatarUrl: buildMediaProxyPath(asset.id),
        },
      });

      return { asset, photo };
    });

    return {
      assetId: result.asset.id,
      status: result.asset.status,
      url: buildMediaProxyPath(result.asset.id),
      media: mapMediaResource(result.asset, {
        visibility: 'public',
        url: buildMediaProxyPath(result.asset.id),
        downloadUrl: buildMediaProxyPath(result.asset.id),
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
          CacheControl: IMMUTABLE_MEDIA_CACHE_CONTROL,
          Body: file.buffer,
        }),
        createS3RequestOptions(),
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
      url: buildMediaProxyPath(next.asset.id),
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
      url: buildMediaProxyPath(next.asset.id),
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
        select: {
          id: true,
          mediaAssetId: true,
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
        select: {
          id: true,
        },
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
        select: {
          id: true,
        },
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

  private currentSeason(now: Date): FrendlySeasonBounds {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const monthLabel = new Intl.DateTimeFormat('ru-RU', {
      month: 'long',
      timeZone: 'UTC',
    }).format(start);
    const capitalized =
      monthLabel.length === 0
        ? monthLabel
        : `${monthLabel[0]!.toUpperCase()}${monthLabel.slice(1)}`;
    return {
      seasonKey: `${start.getUTCFullYear()}-${String(
        start.getUTCMonth() + 1,
      ).padStart(2, '0')}`,
      label: `${capitalized} · сезон`,
      start,
      end,
    };
  }

  private buildSeasonAttendanceWhere(
    userId: string,
    season: FrendlySeasonBounds,
  ): Prisma.EventAttendanceWhereInput {
    return {
      userId,
      status: 'checked_in',
      event: {
        canceledAt: null,
        startsAt: {
          gte: season.start,
          lt: season.end,
        },
      },
    };
  }

  private mapSeasonReward(
    reward: FrendlySeasonReward,
    checkedInCount: number,
    claimedByKey: Map<string, Date>,
  ) {
    const claimedAt = claimedByKey.get(reward.key) ?? null;
    return {
      key: reward.key,
      threshold: reward.threshold,
      statusTitle: reward.statusTitle,
      title: reward.title,
      description: reward.description,
      rewardKind: reward.rewardKind,
      rewardAmount: reward.rewardAmount,
      unlocked: checkedInCount >= reward.threshold,
      claimed: claimedAt != null,
      claimedAt: claimedAt?.toISOString() ?? null,
    };
  }

  private findSeasonReward(rewardKey: string): FrendlySeasonReward | null {
    return (
      FR_SEASON_REWARDS.find((reward) => reward.key === rewardKey) ?? null
    );
  }

  private async grantSeasonTokens(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
  ) {
    const wallet = await tx.tokenWallet.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        balance: 0,
      },
      select: {
        id: true,
      },
    });
    await tx.tokenLedgerEntry.create({
      data: {
        walletId: wallet.id,
        amount,
        reason: 'reward_grant',
      },
    });
    await tx.tokenWallet.update({
      where: { id: wallet.id },
      data: {
        balance: {
          increment: amount,
        },
      },
    });
  }

  private async grantSeasonSubscription(
    tx: Prisma.TransactionClient,
    userId: string,
    days: number,
  ) {
    const now = new Date(Date.now());
    const current = await tx.userSubscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const baseTime =
      current?.renewsAt != null && current.renewsAt.getTime() > now.getTime()
        ? current.renewsAt.getTime()
        : now.getTime();
    const renewsAt = new Date(baseTime + days * FR_PERIOD_DAY_MS);
    const activeCurrent =
      current != null &&
      (current.status === 'active' ||
        current.status === 'trial' ||
        (current.renewsAt != null && current.renewsAt.getTime() > now.getTime()));

    if (activeCurrent) {
      await tx.userSubscription.update({
        where: { id: current.id },
        data: {
          plan: 'month',
          status: 'active',
          renewsAt,
          trialEndsAt: null,
        },
      });
      return;
    }

    await tx.userSubscription.create({
      data: {
        userId,
        plan: 'month',
        status: 'active',
        startedAt: now,
        renewsAt,
        trialEndsAt: null,
      },
    });
  }

  private normalizeFrendlyListLimit(limit?: number) {
    if (!Number.isFinite(limit)) {
      return FR_SEASON_HISTORY_LIMIT;
    }
    return Math.max(1, Math.min(Math.trunc(limit!), 50));
  }

  private decodeFrendlyCursor(cursor?: string) {
    if (!cursor) {
      return null;
    }
    try {
      const decoded = decodeCursor(cursor);
      const startsAt =
        typeof decoded?.startsAt === 'string'
          ? new Date(decoded.startsAt)
          : null;
      if (
        !decoded?.value ||
        typeof decoded.value !== 'string' ||
        startsAt == null ||
        !Number.isFinite(startsAt.getTime())
      ) {
        return null;
      }
      return {
        id: decoded.value,
        startsAt,
      };
    } catch {
      return null;
    }
  }

  private encodeFrendlyCursor(id: string, startsAt: string | Date) {
    const date = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
    return encodeCursor({
      value: id,
      startsAt: date.toISOString(),
    });
  }

  private getBlockedUserIds(userId: string) {
    return loadBlockedUserIds(this.prismaService.client, userId);
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
      createS3RequestOptions(),
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
        subscriptions: {
          select: {
            status: true,
            renewsAt: true,
            trialEndsAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
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
            avatarAssetId: true,
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
                    variants: true,
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
      select: {
        id: true,
        sortOrder: true,
      },
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
            ? buildMediaProxyPath(firstPhoto.mediaAssetId)
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
        avatarUrl: buildMediaProxyPath(asset.id),
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
      const asset = await this.prismaService.client.mediaAsset.create({
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
      if (!BYPASS_S3_UPLOAD) {
        await this.prismaService.client.outboxEvent.create({
          data: {
            type: OUTBOX_EVENT_TYPES.mediaFinalize,
            payload: {
              assetId: asset.id,
            },
          },
        });
      }
      return asset;
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
    const photo = mapProfilePhoto(next.photo);
    return {
      assetId: next.asset.id,
      status: next.asset.status,
      url: photo.url,
      photo,
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
          variants: true,
        },
      });

      if (!BYPASS_S3_UPLOAD) {
        await tx.outboxEvent.create({
          data: {
            type: OUTBOX_EVENT_TYPES.mediaFinalize,
            payload: {
              assetId: asset.id,
            },
          },
        });
      }

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
              variants: true,
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
