import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import {
  buildPublicAssetUrl,
  createPresignedUpload,
  createS3Client,
  getS3Config,
} from '@big-break/database';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { ProfileService } from './profile.service';
import { PrismaService } from './prisma.service';
import { StoriesService } from './stories.service';

const BYPASS_S3_UPLOAD = process.env.NODE_ENV === 'test';
const MAX_CHAT_VOICE_DURATION_MS = 180000;
const MAX_CHAT_VOICE_BYTES = 8 * 1024 * 1024;
export const MAX_CHAT_ATTACHMENT_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_GENERIC_MEDIA_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_STORY_MEDIA_UPLOAD_BYTES = 12 * 1024 * 1024;
const ENABLE_MEDIA_VIDEO_UPLOAD = process.env.ENABLE_MEDIA_VIDEO_UPLOAD === 'true';
const ALLOWED_CHAT_ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/zip',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
]);

type ChatUploadKind = 'chat_attachment' | 'chat_voice';
type MediaUploadScope = 'chat' | 'profile_photo' | 'story_media';

interface ChatUploadMeta {
  chatId: string;
  kind: ChatUploadKind;
  durationMs: number | null;
  waveform: number[];
}

@Injectable()
export class UploadsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly profileService: ProfileService,
    private readonly storiesService: StoriesService,
  ) {}

  private readonly s3 = createS3Client();
  private readonly s3Bucket = getS3Config().bucket;

  async createMediaUpload(userId: string, body: Record<string, unknown>) {
    const scope = this.resolveScope(body);
    if (scope === 'profile_photo') {
      const upload = await this.profileService.createProfilePhotoUpload(
        userId,
        body,
      );
      return {
        ...upload,
        scope,
        uploadStrategy: 'direct',
        completeUrl: '/uploads/media/complete',
      };
    }

    if (scope === 'story_media') {
      const upload = await this.createStoryMediaUpload(userId, body);
      return {
        ...upload,
        scope,
        uploadStrategy: 'direct',
        completeUrl: '/uploads/media/complete',
      };
    }

    const upload = await this.createChatAttachmentUpload(userId, body);
    return {
      ...upload,
      scope,
      uploadStrategy: 'direct',
      completeUrl: '/uploads/media/complete',
    };
  }

  async completeMediaUpload(userId: string, body: Record<string, unknown>) {
    const scope = this.resolveScope(body);
    if (scope === 'profile_photo') {
      return this.profileService.completeProfilePhotoUpload(userId, body);
    }
    if (scope === 'story_media') {
      return this.completeStoryMediaUpload(userId, body);
    }
    return this.completeChatAttachmentUpload(userId, body);
  }

  async uploadMediaFile(
    userId: string,
    body: Record<string, unknown>,
    file: Express.Multer.File,
  ) {
    const scope = this.resolveScope(body);
    if (scope === 'profile_photo') {
      return this.profileService.uploadProfilePhotoFile(userId, file);
    }
    if (scope === 'story_media') {
      return this.uploadStoryMediaFile(userId, body, file);
    }
    return this.uploadChatAttachmentFile(userId, body, file);
  }

  async createChatAttachmentUpload(userId: string, body: Record<string, unknown>) {
    const uploadMeta = await this.resolveChatUploadMeta(userId, body);
    const fileName = typeof body.fileName === 'string' ? body.fileName : 'attachment.bin';
    const contentType = typeof body.contentType === 'string' ? body.contentType : 'application/octet-stream';
    this.assertChatUploadMime(uploadMeta.kind, contentType);
    const objectKey = `chat-attachments/${userId}/${randomUUID()}-${fileName}`;
    return {
      ...(await createPresignedUpload({ objectKey, contentType })),
      chatId: uploadMeta.chatId,
    };
  }

  async completeChatAttachmentUpload(userId: string, body: Record<string, unknown>) {
    const chatId = this.parseChatIdForAttachment(body);
    const membershipPromise = this.assertChatAttachmentMember(userId, chatId);
    let uploadMeta: ChatUploadMeta;
    try {
      uploadMeta = this.parseChatUploadMeta(chatId, body);
    } catch (error) {
      await membershipPromise;
      throw error;
    }
    const objectKey = typeof body.objectKey === 'string' ? body.objectKey : undefined;
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'application/octet-stream';
    const byteSize = typeof body.byteSize === 'number' ? body.byteSize : 0;
    const fileName = typeof body.fileName === 'string' ? body.fileName : 'attachment.bin';

    if (!objectKey) {
      await membershipPromise;
      throw new ApiError(400, 'invalid_upload_payload', 'objectKey is required');
    }

    try {
      this.assertChatUploadObjectKey(userId, objectKey);
    } catch (error) {
      await membershipPromise;
      throw error;
    }
    let existingLookupError: unknown;
    const existingPromise = this.prismaService.client.mediaAsset.findUnique({
      where: { objectKey },
    }).catch((error) => {
      existingLookupError = error;
      return null;
    });
    await membershipPromise;
    const existing = await existingPromise;
    if (existingLookupError) {
      throw existingLookupError;
    }
    if (existing) {
      this.assertExistingChatUploadAsset(existing, userId, uploadMeta);
      return {
        assetId: existing.id,
        status: existing.status,
      };
    }

    const verified = await this.resolveVerifiedChatUploadMetadata(
      objectKey,
      mimeType,
      byteSize,
    );

    this.assertChatUploadMime(uploadMeta.kind, verified.mimeType);
    this.assertChatUploadSize(uploadMeta.kind, verified.byteSize);

    const asset = await this.createChatUploadAsset({
      userId,
      uploadMeta,
      objectKey,
      mimeType: verified.mimeType,
      byteSize: verified.byteSize,
      fileName,
    });

    return {
      assetId: asset.id,
      status: asset.status,
    };
  }

  async uploadChatAttachmentFile(
    userId: string,
    body: Record<string, unknown>,
    file?: Express.Multer.File,
  ) {
    const uploadFile = this.requireMediaFile(file);
    const uploadMeta = await this.resolveChatUploadMeta(userId, body);
    const objectKey =
      `chat-attachments/${userId}/${randomUUID()}-${uploadFile.originalname}`;

    this.assertChatUploadMime(uploadMeta.kind, uploadFile.mimetype);
    this.assertChatUploadSize(uploadMeta.kind, uploadFile.size);

    if (!BYPASS_S3_UPLOAD) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: objectKey,
          ContentType: uploadFile.mimetype,
          Body: uploadFile.buffer,
        }),
      );
    }

    const asset = await this.prismaService.client.mediaAsset.create({
      data: {
        ownerId: userId,
        kind: uploadMeta.kind,
        status: 'ready',
        bucket: this.s3Bucket,
        objectKey,
        mimeType: uploadFile.mimetype,
        byteSize: uploadFile.size,
        durationMs: uploadMeta.durationMs,
        waveform: uploadMeta.waveform,
        originalFileName: uploadFile.originalname,
        chatId: uploadMeta.chatId,
        publicUrl: buildPublicAssetUrl(objectKey),
      },
      select: {
        id: true,
        status: true,
        publicUrl: true,
      },
    });

    return {
      assetId: asset.id,
      status: asset.status,
      url: asset.publicUrl,
    };
  }

  async createStoryMediaUpload(userId: string, body: Record<string, unknown>) {
    const eventId = await this.requireStoryEventId(userId, body);
    const fileName =
      typeof body.fileName === 'string' ? body.fileName : 'story-media.bin';
    const contentType =
      typeof body.contentType === 'string'
        ? body.contentType
        : 'application/octet-stream';
    this.assertStoryMediaMime(contentType);

    const objectKey = `stories/${userId}/${randomUUID()}-${fileName}`;
    return {
      ...(await createPresignedUpload({ objectKey, contentType })),
      eventId,
    };
  }

  async completeStoryMediaUpload(userId: string, body: Record<string, unknown>) {
    const eventId = this.parseStoryEventId(body);
    const objectKey = typeof body.objectKey === 'string' ? body.objectKey : undefined;
    const mimeType =
      typeof body.mimeType === 'string' ? body.mimeType : 'application/octet-stream';
    const byteSize = typeof body.byteSize === 'number' ? body.byteSize : 0;
    const fileName =
      typeof body.fileName === 'string' ? body.fileName : 'story-media.bin';
    const durationMs =
      typeof body.durationMs === 'number'
        ? body.durationMs
        : typeof body.durationMs === 'string'
            ? Number(body.durationMs)
            : null;

    if (!objectKey) {
      throw new ApiError(400, 'invalid_upload_payload', 'objectKey is required');
    }

    this.assertStoryMediaObjectKey(userId, objectKey);
    const [existing] = await Promise.all([
      this.prismaService.client.mediaAsset.findUnique({
        where: { objectKey },
      }),
      this.storiesService.assertStoryParticipant(userId, eventId),
    ]);
    if (existing) {
      await this.assertExistingStoryUploadAsset(existing, userId, eventId);
      return {
        assetId: existing.id,
        status: existing.status,
        eventId,
      };
    }

    const verified = await this.resolveVerifiedStoryUploadMetadata(
      objectKey,
      mimeType,
      byteSize,
    );
    this.assertStoryMediaMime(verified.mimeType);
    this.assertStoryMediaSize(verified.byteSize);

    const asset = await this.createStoryUploadAsset({
      userId,
      objectKey,
      mimeType: verified.mimeType,
      byteSize: verified.byteSize,
      durationMs,
      fileName,
      eventId,
    });

    return {
      assetId: asset.id,
      status: asset.status,
      eventId,
    };
  }

  async uploadStoryMediaFile(
    userId: string,
    body: Record<string, unknown>,
    file?: Express.Multer.File,
  ) {
    const uploadFile = this.requireMediaFile(file);
    const eventId = await this.requireStoryEventId(userId, body);
    this.assertStoryMediaMime(uploadFile.mimetype);
    this.assertStoryMediaSize(uploadFile.size);

    const objectKey = `stories/${userId}/${randomUUID()}-${uploadFile.originalname}`;
    if (!BYPASS_S3_UPLOAD) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: objectKey,
          ContentType: uploadFile.mimetype,
          Body: uploadFile.buffer,
        }),
      );
    }

    const asset = await this.prismaService.client.mediaAsset.create({
      data: {
        ownerId: userId,
        kind: 'story_media',
        status: 'ready',
        bucket: this.s3Bucket,
        objectKey,
        mimeType: uploadFile.mimetype,
        byteSize: uploadFile.size,
        originalFileName: uploadFile.originalname,
        publicUrl: buildPublicAssetUrl(objectKey),
      },
      select: {
        id: true,
        status: true,
      },
    });

    return {
      assetId: asset.id,
      status: asset.status,
      eventId,
    };
  }

  private resolveScope(body: Record<string, unknown>): MediaUploadScope {
    const scope =
      typeof body.scope === 'string' ? body.scope : 'chat';

    if (
      scope !== 'chat' &&
      scope !== 'profile_photo' &&
      scope !== 'story_media'
    ) {
      throw new ApiError(400, 'invalid_upload_scope', 'Upload scope is invalid');
    }

    return scope;
  }

  private requireMediaFile(file?: Express.Multer.File) {
    if (!file) {
      throw new ApiError(400, 'media_file_required', 'Media file is required');
    }

    return file;
  }

  private async resolveChatUploadMeta(
    userId: string,
    body: Record<string, unknown>,
  ): Promise<ChatUploadMeta> {
    const chatId = this.parseChatIdForAttachment(body);
    await this.assertChatAttachmentMember(userId, chatId);
    return this.parseChatUploadMeta(chatId, body);
  }

  private parseChatUploadMeta(
    chatId: string,
    body: Record<string, unknown>,
  ): ChatUploadMeta {
    const rawKind =
      typeof body.kind === 'string' ? body.kind : 'chat_attachment';

    if (rawKind !== 'chat_attachment' && rawKind !== 'chat_voice') {
      throw new ApiError(
        400,
        'invalid_chat_attachment_kind',
        'Attachment kind is invalid',
      );
    }

    const rawDuration =
      typeof body.durationMs === 'number'
        ? body.durationMs
        : typeof body.durationMs === 'string'
          ? Number(body.durationMs)
          : null;
    const waveform = this.resolveChatWaveform(body.waveform);

    if (rawKind === 'chat_voice') {
      if (
        rawDuration == null ||
        !Number.isFinite(rawDuration) ||
        rawDuration <= 0 ||
        rawDuration > MAX_CHAT_VOICE_DURATION_MS
      ) {
        throw new ApiError(
          400,
          'invalid_chat_voice_duration',
          'Voice duration is invalid',
        );
      }
    }

    return {
      chatId,
      kind: rawKind,
      durationMs: rawKind === 'chat_voice' ? rawDuration : null,
      waveform: rawKind === 'chat_voice' ? waveform : [],
    };
  }

  private assertChatUploadMime(kind: ChatUploadKind, mimeType: string) {
    if (kind === 'chat_voice' && !mimeType.startsWith('audio/')) {
      throw new ApiError(
        400,
        'invalid_chat_voice_mime_type',
        'Voice MIME type is invalid',
      );
    }

    if (
      kind === 'chat_attachment' &&
      !ALLOWED_CHAT_ATTACHMENT_MIME_TYPES.has(mimeType)
    ) {
      throw new ApiError(
        400,
        'invalid_chat_attachment_mime_type',
        'Attachment MIME type is invalid',
      );
    }
  }

  private assertChatUploadSize(kind: ChatUploadKind, byteSize: number) {
    if (!Number.isSafeInteger(byteSize) || byteSize <= 0) {
      throw new ApiError(
        400,
        kind === 'chat_voice'
          ? 'invalid_chat_voice_size'
          : 'invalid_chat_attachment_size',
        kind === 'chat_voice'
          ? 'Voice attachment size is invalid'
          : 'Attachment size is invalid',
      );
    }

    if (kind === 'chat_attachment' && byteSize > MAX_CHAT_ATTACHMENT_UPLOAD_BYTES) {
      throw new ApiError(
        400,
        'chat_attachment_too_large',
        'Attachment is too large',
      );
    }

    if (kind === 'chat_voice' && byteSize > MAX_CHAT_VOICE_BYTES) {
      throw new ApiError(
        400,
        'chat_voice_too_large',
        'Voice attachment is too large',
      );
    }
  }

  private resolveChatWaveform(input: unknown): number[] {
    if (input == null) {
      return [];
    }

    let parsed = input;
    if (typeof input === 'string') {
      try {
        parsed = JSON.parse(input);
      } catch {
        throw new ApiError(
          400,
          'invalid_chat_voice_waveform',
          'Voice waveform is invalid',
        );
      }
    }

    if (!Array.isArray(parsed)) {
      throw new ApiError(
        400,
        'invalid_chat_voice_waveform',
        'Voice waveform is invalid',
      );
    }

    const waveform = parsed.map((item) => {
      if (typeof item !== 'number' || !Number.isFinite(item)) {
        throw new ApiError(
          400,
          'invalid_chat_voice_waveform',
          'Voice waveform is invalid',
        );
      }
      if (item < 0 || item > 1) {
        throw new ApiError(
          400,
          'invalid_chat_voice_waveform',
          'Voice waveform is invalid',
        );
      }
      return item;
    });

    if (waveform.length > 96) {
      throw new ApiError(
        400,
        'invalid_chat_voice_waveform',
        'Voice waveform is invalid',
      );
    }

    return waveform;
  }

  private assertChatUploadObjectKey(userId: string, objectKey: string) {
    if (!objectKey.startsWith(`chat-attachments/${userId}/`)) {
      throw new ApiError(400, 'invalid_upload_payload', 'objectKey is invalid');
    }
  }

  private async createChatUploadAsset(input: {
    userId: string;
    uploadMeta: ChatUploadMeta;
    objectKey: string;
    mimeType: string;
    byteSize: number;
    fileName: string;
  }) {
    try {
      return await this.prismaService.client.mediaAsset.create({
        data: {
          ownerId: input.userId,
          kind: input.uploadMeta.kind,
          status: 'ready',
          bucket: this.s3Bucket,
          objectKey: input.objectKey,
          mimeType: input.mimeType,
          byteSize: input.byteSize,
          durationMs: input.uploadMeta.durationMs,
          waveform: input.uploadMeta.waveform,
          originalFileName: input.fileName,
          chatId: input.uploadMeta.chatId,
          publicUrl: buildPublicAssetUrl(input.objectKey),
        },
        select: {
          id: true,
          status: true,
        },
      });
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await this.prismaService.client.mediaAsset.findUnique({
        where: { objectKey: input.objectKey },
      });
      if (!existing) {
        throw error;
      }
      this.assertExistingChatUploadAsset(existing, input.userId, input.uploadMeta);
      return existing;
    }
  }

  private assertExistingChatUploadAsset(
    asset: {
      ownerId: string;
      kind: string;
      status: string;
      chatId: string | null;
    },
    userId: string,
    uploadMeta: ChatUploadMeta,
  ) {
    if (
      asset.ownerId !== userId ||
      asset.kind !== uploadMeta.kind ||
      asset.status !== 'ready' ||
      asset.chatId !== uploadMeta.chatId
    ) {
      throw new ApiError(
        409,
        'upload_object_conflict',
        'Upload object was completed for another target',
      );
    }
  }

  private async resolveVerifiedChatUploadMetadata(
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

  private parseChatIdForAttachment(body: Record<string, unknown>) {
    const chatId = typeof body.chatId === 'string' ? body.chatId : undefined;

    if (!chatId) {
      throw new ApiError(400, 'chat_id_required', 'chatId is required');
    }

    return chatId;
  }

  private async assertChatAttachmentMember(userId: string, chatId: string) {
    const membership = await this.prismaService.client.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
      select: {
        chatId: true,
        userId: true,
      },
    });

    if (!membership) {
      throw new ApiError(403, 'chat_attachment_forbidden', 'You are not a member of this chat');
    }
  }

  private async requireStoryEventId(userId: string, body: Record<string, unknown>) {
    const eventId = typeof body.eventId === 'string' ? body.eventId : '';

    if (eventId.length === 0) {
      throw new ApiError(400, 'event_id_required', 'eventId is required');
    }

    await this.storiesService.assertStoryParticipant(userId, eventId);
    return eventId;
  }

  private parseStoryEventId(body: Record<string, unknown>) {
    const eventId = typeof body.eventId === 'string' ? body.eventId : '';

    if (eventId.length === 0) {
      throw new ApiError(400, 'event_id_required', 'eventId is required');
    }

    return eventId;
  }

  private assertStoryMediaMime(mimeType: string) {
    if (mimeType.startsWith('video/') && !ENABLE_MEDIA_VIDEO_UPLOAD) {
      throw new ApiError(
        400,
        'video_upload_disabled',
        'Video upload is disabled',
      );
    }

    if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
      throw new ApiError(
        400,
        'invalid_story_media_mime_type',
        'Story media MIME type is invalid',
      );
    }
  }

  private assertStoryMediaSize(byteSize: number) {
    if (!Number.isSafeInteger(byteSize) || byteSize <= 0) {
      throw new ApiError(
        400,
        'invalid_story_media_size',
        'Story media size is invalid',
      );
    }

    if (byteSize > MAX_STORY_MEDIA_UPLOAD_BYTES) {
      throw new ApiError(
        400,
        'story_media_too_large',
        'Story media is too large',
      );
    }
  }

  private assertStoryMediaObjectKey(userId: string, objectKey: string) {
    if (!objectKey.startsWith(`stories/${userId}/`)) {
      throw new ApiError(400, 'invalid_upload_payload', 'objectKey is invalid');
    }
  }

  private async createStoryUploadAsset(input: {
    userId: string;
    objectKey: string;
    mimeType: string;
    byteSize: number;
    durationMs: number | null;
    fileName: string;
    eventId: string;
  }) {
    try {
      return await this.prismaService.client.mediaAsset.create({
        data: {
          ownerId: input.userId,
          kind: 'story_media',
          status: 'ready',
          bucket: this.s3Bucket,
          objectKey: input.objectKey,
          mimeType: input.mimeType,
          byteSize: input.byteSize,
          durationMs:
            input.durationMs == null || !Number.isFinite(input.durationMs)
              ? null
              : Math.max(0, Math.trunc(input.durationMs)),
          originalFileName: input.fileName,
          publicUrl: buildPublicAssetUrl(input.objectKey),
        },
        select: {
          id: true,
          status: true,
        },
      });
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await this.prismaService.client.mediaAsset.findUnique({
        where: { objectKey: input.objectKey },
      });
      if (!existing) {
        throw error;
      }
      await this.assertExistingStoryUploadAsset(
        existing,
        input.userId,
        input.eventId,
      );
      return existing;
    }
  }

  private async assertExistingStoryUploadAsset(
    asset: {
      id: string;
      ownerId: string;
      kind: string;
      status: string;
    },
    userId: string,
    eventId: string,
  ) {
    if (
      asset.ownerId !== userId ||
      asset.kind !== 'story_media' ||
      asset.status !== 'ready'
    ) {
      throw new ApiError(
        409,
        'upload_object_conflict',
        'Upload object was completed for another target',
      );
    }

    const story = await this.prismaService.client.eventStory.findUnique({
      where: { mediaAssetId: asset.id },
      select: { eventId: true },
    });
    if (story != null && story.eventId !== eventId) {
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

  private async resolveVerifiedStoryUploadMetadata(
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
}
