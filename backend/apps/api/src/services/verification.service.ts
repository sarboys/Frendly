import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Injectable, Optional } from '@nestjs/common';
import {
  OUTBOX_EVENT_TYPES,
  createPresignedDownload,
  createS3Client,
  createS3RequestOptions,
} from '@big-break/database';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { DropsRewardService } from './drops-reward.service';
import { PrismaService } from './prisma.service';
import { RedisCacheService } from './redis-cache.service';

const VERIFICATION_TRIAL_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const BYPASS_S3_DELETE = process.env.NODE_ENV === 'test';

const verificationResponseSelect = {
  status: true,
  selfieDone: true,
  documentDone: true,
  submittedAt: true,
  reviewedAt: true,
  reviewNote: true,
};

const verificationSubmitSelect = {
  ...verificationResponseSelect,
  selfieAssetId: true,
  documentAssetId: true,
};

const verificationAssetSelect = {
  id: true,
  kind: true,
  bucket: true,
  objectKey: true,
  mimeType: true,
  byteSize: true,
  originalFileName: true,
};

type VerificationStep = 'selfie' | 'document';
type VerificationAssetKind = 'verification_selfie' | 'verification_document';

type VerificationAssetForCleanup = {
  id: string;
  kind: string;
  bucket: string;
  objectKey: string;
} | null;

type CurrentSubscription = {
  id: string;
  plan: 'month' | 'year';
  status: 'inactive' | 'trial' | 'active' | 'canceled';
  renewsAt: Date | null;
  trialEndsAt: Date | null;
} | null;

@Injectable()
export class VerificationService {
  private readonly pendingVerificationLoads = new Map<string, Promise<any>>();

  constructor(
    private readonly prismaService: PrismaService,
    @Optional()
    private readonly dropsRewardService?: DropsRewardService,
    @Optional() private readonly redisCache?: RedisCacheService,
  ) {}

  private readonly s3 = createS3Client();

  async getVerification(userId: string) {
    const cacheKey = this.verificationCacheKey(userId);
    const cached = await this.redisCache?.getJson(cacheKey);
    if (cached != null) {
      return cached;
    }

    const pending = this.pendingVerificationLoads.get(cacheKey);
    if (pending != null) {
      return pending;
    }

    const loading = this.loadFreshVerification(userId)
      .then(async (response) => {
        await this.redisCache?.setJson(cacheKey, response, 30);
        return response;
      })
      .finally(() => {
        this.pendingVerificationLoads.delete(cacheKey);
      });
    this.pendingVerificationLoads.set(cacheKey, loading);

    return loading;
  }

  private async loadFreshVerification(userId: string) {
    const verification = await this.prismaService.client.userVerification.findUnique({
      where: { userId },
      select: verificationResponseSelect,
    });

    return this.mapVerificationResponse(verification);
  }

  async listAdminVerifications(query: Record<string, unknown> = {}) {
    const limit = this.parseLimit(query.limit);
    const status = this.optionalText(query.status) ?? 'queue';
    const search = this.optionalText(query.q);
    const where: Prisma.UserVerificationWhereInput = {
      AND: [
        this.adminStatusWhere(status),
        search
          ? {
              user: {
                OR: [
                  { displayName: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                  { phoneNumber: { contains: search, mode: 'insensitive' } },
                ],
              },
            }
          : {},
      ],
    };
    const rows = await this.prismaService.client.userVerification.findMany({
      where,
      select: {
        userId: true,
        status: true,
        selfieDone: true,
        documentDone: true,
        submittedAt: true,
        reviewedAt: true,
        reviewNote: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            phoneNumber: true,
            verified: true,
            profile: {
              select: {
                city: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: [
        { submittedAt: 'desc' },
        { updatedAt: 'desc' },
        { userId: 'desc' },
      ],
      take: limit,
    });

    return {
      items: rows.map((row) => this.mapAdminVerificationListItem(row)),
      nextCursor: null,
    };
  }

  async submitVerification(userId: string, body: Record<string, unknown>) {
    const step = typeof body.step === 'string' ? body.step : 'document';

    if (step !== 'selfie' && step !== 'document') {
      throw new ApiError(400, 'invalid_verification_step', 'Verification step is invalid');
    }

    const current = await this.prismaService.client.userVerification.findUnique({
      where: { userId },
      select: verificationSubmitSelect,
    });

    if (current?.status === 'verified') {
      return this.mapVerificationResponse(current);
    }

    if (current?.status === 'under_review') {
      throw new ApiError(
        409,
        'verification_under_review',
        'Verification is already under review',
      );
    }

    const assetId = this.requiredText(
      body.assetId,
      'invalid_verification_asset',
      'Verification asset is required',
    );
    await this.assertVerificationAsset(userId, assetId, step);

    if (step === 'document' && (current?.selfieDone !== true || !current.selfieAssetId)) {
      throw new ApiError(
        409,
        'verification_selfie_required',
        'Selfie is required before document',
      );
    }

    const now = new Date(Date.now());
    const update =
      step === 'selfie'
        ? {
            selfieDone: true,
            documentDone: false,
            selfieAssetId: assetId,
            documentAssetId: null,
            status: 'selfie_submitted' as const,
            submittedAt: null,
            reviewedAt: null,
            reviewNote: null,
          }
        : {
            selfieDone: true,
            documentDone: true,
            documentAssetId: assetId,
            status: 'under_review' as const,
            submittedAt: now,
            reviewedAt: null,
            reviewNote: null,
          };
    const create =
      step === 'selfie'
        ? {
            userId,
            selfieDone: true,
            documentDone: false,
            selfieAssetId: assetId,
            status: 'selfie_submitted' as const,
          }
        : {
            userId,
            selfieDone: true,
            documentDone: true,
            selfieAssetId: current?.selfieAssetId ?? undefined,
            documentAssetId: assetId,
            status: 'under_review' as const,
            submittedAt: now,
          };

    const verification = await this.prismaService.client.userVerification.upsert({
      where: { userId },
      update,
      create,
      select: verificationResponseSelect,
    });

    await this.clearVerificationCache(userId);
    return this.mapVerificationResponse(verification);
  }

  private verificationCacheKey(userId: string) {
    return `verification:me:v1:${userId}`;
  }

  private async clearVerificationCache(userId: string) {
    await this.redisCache?.delete(this.verificationCacheKey(userId));
  }

  async getAdminVerification(userId: string) {
    const verification = await this.prismaService.client.userVerification.findUnique({
      where: { userId },
      select: {
        userId: true,
        status: true,
        selfieDone: true,
        documentDone: true,
        submittedAt: true,
        reviewedAt: true,
        reviewNote: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            phoneNumber: true,
            verified: true,
            profile: {
              select: {
                city: true,
                avatarUrl: true,
              },
            },
          },
        },
        selfieAsset: {
          select: verificationAssetSelect,
        },
        documentAsset: {
          select: verificationAssetSelect,
        },
      },
    });

    if (!verification) {
      throw new ApiError(404, 'verification_not_found', 'Verification not found');
    }

    return {
      ...this.mapAdminVerificationListItem(verification),
      selfieAsset: await this.mapAdminAsset(verification.selfieAsset),
      documentAsset: await this.mapAdminAsset(verification.documentAsset),
    };
  }

  async approveVerification(userId: string) {
    const cleanupAssets = await this.prismaService.client.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, verified: true },
      });
      if (!user) {
        throw new ApiError(404, 'admin_user_not_found', 'User not found');
      }

      const current = await tx.userVerification.findUnique({
        where: { userId },
        select: {
          ...verificationSubmitSelect,
          selfieAsset: { select: verificationAssetSelect },
          documentAsset: { select: verificationAssetSelect },
        },
      });
      const alreadyVerified = user.verified === true && current?.status === 'verified';
      const assets = [current?.selfieAsset ?? null, current?.documentAsset ?? null];

      if (alreadyVerified) {
        return assets;
      }

      const now = new Date(Date.now());
      await tx.user.update({
        where: { id: userId },
        data: { verified: true },
      });
      await tx.userVerification.upsert({
        where: { userId },
        update: {
          status: 'verified',
          selfieDone: true,
          documentDone: true,
          selfieAssetId: null,
          documentAssetId: null,
          reviewedAt: now,
          reviewNote: null,
        },
        create: {
          userId,
          status: 'verified',
          selfieDone: true,
          documentDone: true,
          reviewedAt: now,
        },
      });
      await this.grantVerificationTrial(tx, userId, now);
      await this.createVerificationNotification(tx, {
        userId,
        title: 'Верификация пройдена',
        body: 'Мы дали тебе 3 дня Frendly+.',
        dedupeKey: `verification:approved:${userId}`,
        payload: {
          source: 'verification',
          status: 'verified',
          trialDays: VERIFICATION_TRIAL_DAYS,
        },
      });

      return assets;
    });

    await this.deleteVerificationAssets(userId, cleanupAssets);
    await this.handleDropsVerifiedUser(userId);
    return this.getVerification(userId);
  }

  async returnVerification(userId: string, body: Record<string, unknown>) {
    const reason = this.requiredText(
      body.reason,
      'verification_return_reason_required',
      'Return reason is required',
    );
    const cleanupAssets = await this.prismaService.client.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!user) {
        throw new ApiError(404, 'admin_user_not_found', 'User not found');
      }

      const current = await tx.userVerification.findUnique({
        where: { userId },
        select: {
          ...verificationSubmitSelect,
          selfieAsset: { select: verificationAssetSelect },
          documentAsset: { select: verificationAssetSelect },
        },
      });
      if (!current) {
        throw new ApiError(404, 'verification_not_found', 'Verification not found');
      }
      const now = new Date(Date.now());
      const assets = [current.selfieAsset, current.documentAsset];

      await tx.user.update({
        where: { id: userId },
        data: { verified: false },
      });
      await tx.userVerification.update({
        where: { userId },
        data: {
          status: 'not_started',
          selfieDone: false,
          documentDone: false,
          selfieAssetId: null,
          documentAssetId: null,
          submittedAt: null,
          reviewedAt: now,
          reviewNote: reason,
        },
      });
      await this.createVerificationNotification(tx, {
        userId,
        title: 'Верификацию нужно пройти заново',
        body: reason,
        dedupeKey: `verification:returned:${userId}:${now.getTime()}`,
        payload: {
          source: 'verification',
          status: 'not_started',
          reason,
        },
      });

      return assets;
    });

    await this.deleteVerificationAssets(userId, cleanupAssets);
    return this.getVerification(userId);
  }

  private mapVerificationResponse(
    verification: {
      status: string;
      selfieDone: boolean;
      documentDone: boolean;
      submittedAt: Date | null;
      reviewedAt: Date | null;
      reviewNote: string | null;
    } | null,
  ) {
    return {
      status: verification?.status ?? 'not_started',
      selfieDone: verification?.selfieDone ?? false,
      documentDone: verification?.documentDone ?? false,
      submittedAt: verification?.submittedAt?.toISOString() ?? null,
      reviewedAt: verification?.reviewedAt?.toISOString() ?? null,
      reviewNote: verification?.reviewNote ?? null,
    };
  }

  private mapAdminVerificationListItem(row: {
    userId: string;
    status: string;
    selfieDone: boolean;
    documentDone: boolean;
    submittedAt: Date | null;
    reviewedAt: Date | null;
    reviewNote: string | null;
    user: {
      id: string;
      displayName: string;
      email: string | null;
      phoneNumber: string | null;
      verified: boolean;
      profile: {
        city: string | null;
        avatarUrl?: string | null;
      } | null;
    };
  }) {
    return {
      userId: row.userId,
      status: row.status,
      selfieDone: row.selfieDone,
      documentDone: row.documentDone,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      reviewNote: row.reviewNote,
      user: {
        id: row.user.id,
        displayName: row.user.displayName,
        email: row.user.email,
        phoneNumber: row.user.phoneNumber,
        city: row.user.profile?.city ?? null,
        avatarUrl: row.user.profile?.avatarUrl ?? null,
        verified: row.user.verified,
      },
    };
  }

  private async mapAdminAsset(
    asset: {
      id: string;
      kind: string;
      objectKey: string;
      mimeType: string;
      byteSize: number;
      originalFileName: string;
    } | null,
  ) {
    if (!asset) {
      return null;
    }

    const signed = await createPresignedDownload(asset.objectKey);
    return {
      assetId: asset.id,
      kind: asset.kind,
      mimeType: asset.mimeType,
      byteSize: asset.byteSize,
      fileName: asset.originalFileName,
      url: signed.url,
      expiresAt: signed.expiresAt.toISOString(),
    };
  }

  private adminStatusWhere(status: string): Prisma.UserVerificationWhereInput {
    if (status === 'queue') {
      return { status: 'under_review' };
    }
    if (status === 'history') {
      return {
        OR: [
          { status: 'verified' },
          {
            status: 'not_started',
            reviewNote: { not: null },
          },
        ],
      };
    }
    if (
      status === 'not_started' ||
      status === 'selfie_submitted' ||
      status === 'document_submitted' ||
      status === 'under_review' ||
      status === 'verified' ||
      status === 'rejected'
    ) {
      return { status };
    }
    if (status === 'all') {
      return {};
    }

    throw new ApiError(
      400,
      'admin_verification_status_invalid',
      'Verification status filter is invalid',
    );
  }

  private async assertVerificationAsset(
    userId: string,
    assetId: string,
    step: VerificationStep,
  ) {
    const expectedKind = this.expectedAssetKind(step);
    const asset = await this.prismaService.client.mediaAsset.findFirst({
      where: {
        id: assetId,
        ownerId: userId,
        status: 'ready',
        kind: expectedKind,
      },
      select: {
        id: true,
      },
    });

    if (!asset) {
      throw new ApiError(
        404,
        'verification_asset_not_found',
        'Verification asset not found',
      );
    }
  }

  private expectedAssetKind(step: VerificationStep): VerificationAssetKind {
    return step === 'selfie' ? 'verification_selfie' : 'verification_document';
  }

  private async grantVerificationTrial(
    tx: Prisma.TransactionClient,
    userId: string,
    now: Date,
  ) {
    const current = await tx.userSubscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        plan: true,
        status: true,
        renewsAt: true,
        trialEndsAt: true,
      },
    }) as CurrentSubscription;
    const endsAt = new Date(this.subscriptionBaseTime(current, now) + VERIFICATION_TRIAL_DAYS * DAY_MS);

    if (current && this.resolveSubscriptionStatus(current, now) === 'trial') {
      await tx.userSubscription.update({
        where: { id: current.id },
        data: {
          plan: current.plan,
          status: 'trial',
          renewsAt: endsAt,
          trialEndsAt: endsAt,
        },
      });
      return;
    }

    if (current && this.resolveSubscriptionStatus(current, now) === 'active') {
      await tx.userSubscription.update({
        where: { id: current.id },
        data: {
          plan: current.plan,
          status: 'active',
          renewsAt: endsAt,
          trialEndsAt: null,
        },
      });
      return;
    }

    await tx.userSubscription.create({
      data: {
        userId,
        plan: 'month',
        status: 'trial',
        startedAt: now,
        renewsAt: endsAt,
        trialEndsAt: endsAt,
      },
    });
  }

  private subscriptionBaseTime(subscription: CurrentSubscription, now: Date) {
    const currentStatus = this.resolveSubscriptionStatus(subscription, now);
    if (currentStatus === 'trial') {
      return Math.max(now.getTime(), subscription?.trialEndsAt?.getTime() ?? 0);
    }
    if (currentStatus === 'active') {
      return Math.max(now.getTime(), subscription?.renewsAt?.getTime() ?? 0);
    }
    return now.getTime();
  }

  private resolveSubscriptionStatus(
    subscription: CurrentSubscription,
    now: Date,
  ): 'inactive' | 'trial' | 'active' {
    if (!subscription) {
      return 'inactive';
    }
    if (subscription.trialEndsAt && subscription.trialEndsAt.getTime() > now.getTime()) {
      return 'trial';
    }
    if (
      subscription.renewsAt &&
      subscription.renewsAt.getTime() > now.getTime() &&
      subscription.status !== 'inactive'
    ) {
      return 'active';
    }
    return 'inactive';
  }

  private async createVerificationNotification(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      title: string;
      body: string;
      dedupeKey: string;
      payload: Record<string, unknown>;
    },
  ) {
    const notification = await tx.notification.create({
      data: {
        userId: params.userId,
        kind: 'verification',
        title: params.title,
        body: params.body,
        dedupeKey: params.dedupeKey,
        payload: params.payload as Prisma.InputJsonValue,
      },
      select: {
        id: true,
      },
    });

    await tx.outboxEvent.createMany({
      data: [
        {
          type: OUTBOX_EVENT_TYPES.pushDispatch,
          payload: {
            userId: params.userId,
            notificationId: notification.id,
          },
        },
        {
          type: OUTBOX_EVENT_TYPES.notificationCreate,
          payload: {
            notificationId: notification.id,
          },
        },
      ],
    });
  }

  private async deleteVerificationAssets(
    userId: string,
    assets: VerificationAssetForCleanup[],
  ) {
    const targets = assets
      .filter((asset): asset is NonNullable<VerificationAssetForCleanup> => asset != null)
      .filter(
        (asset) =>
          asset.kind === 'verification_selfie' ||
          asset.kind === 'verification_document',
      );
    if (targets.length === 0) {
      return;
    }

    if (!BYPASS_S3_DELETE) {
      await Promise.allSettled(
        targets.map((asset) =>
          this.s3.send(
            new DeleteObjectCommand({
              Bucket: asset.bucket,
              Key: asset.objectKey,
            }),
            createS3RequestOptions(),
          ),
        ),
      );
    }

    await this.prismaService.client.mediaAsset.deleteMany({
      where: {
        id: { in: targets.map((asset) => asset.id) },
        ownerId: userId,
        kind: { in: ['verification_selfie', 'verification_document'] },
      },
    });
  }

  private async handleDropsVerifiedUser(userId: string) {
    if (!this.dropsRewardService) {
      return;
    }

    try {
      await this.dropsRewardService.handleUserVerified(userId);
    } catch {
      // Drops rewards must not block admin verification.
    }
  }

  private parseLimit(value: unknown) {
    const text = this.optionalText(value);
    if (!text) {
      return 50;
    }
    const limit = Number(text);
    if (!Number.isInteger(limit) || limit < 1) {
      throw new ApiError(400, 'admin_invalid_limit', 'Limit is invalid');
    }
    return Math.min(limit, 100);
  }

  private optionalText(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }
    const text = value.trim();
    return text.length === 0 ? null : text;
  }

  private requiredText(value: unknown, code: string, message: string) {
    const text = this.optionalText(value);
    if (!text) {
      throw new ApiError(400, code, message);
    }
    return text;
  }
}
