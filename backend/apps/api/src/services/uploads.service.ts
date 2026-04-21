import { PutObjectCommand } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { buildPublicAssetUrl, createPresignedUpload, createS3Client } from '@big-break/database';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

const BYPASS_S3_UPLOAD = process.env.NODE_ENV === 'test';
const MAX_CHAT_VOICE_DURATION_MS = 180000;
const MAX_CHAT_VOICE_BYTES = 8 * 1024 * 1024;

type ChatUploadKind = 'chat_attachment' | 'chat_voice';

interface ChatUploadMeta {
  chatId: string;
  kind: ChatUploadKind;
  durationMs: number | null;
  waveform: number[];
}

@Injectable()
export class UploadsService {
  constructor(private readonly prismaService: PrismaService) {}

  private readonly s3 = createS3Client();

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
    const uploadMeta = await this.resolveChatUploadMeta(userId, body);
    const objectKey = typeof body.objectKey === 'string' ? body.objectKey : undefined;
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'application/octet-stream';
    const byteSize = typeof body.byteSize === 'number' ? body.byteSize : 0;
    const fileName = typeof body.fileName === 'string' ? body.fileName : 'attachment.bin';

    if (!objectKey) {
      throw new ApiError(400, 'invalid_upload_payload', 'objectKey is required');
    }

    this.assertChatUploadMime(uploadMeta.kind, mimeType);
    this.assertChatUploadSize(uploadMeta.kind, byteSize);

    const asset = await this.prismaService.client.mediaAsset.create({
      data: {
        ownerId: userId,
        kind: uploadMeta.kind,
        status: 'ready',
        bucket: process.env.S3_BUCKET ?? 'big-break',
        objectKey,
        mimeType,
        byteSize,
        durationMs: uploadMeta.durationMs,
        waveform: uploadMeta.waveform,
        originalFileName: fileName,
        chatId: uploadMeta.chatId,
        publicUrl: buildPublicAssetUrl(objectKey),
      },
    });

    return {
      assetId: asset.id,
      status: asset.status,
    };
  }

  async uploadChatAttachmentFile(
    userId: string,
    body: Record<string, unknown>,
    file: Express.Multer.File,
  ) {
    const uploadMeta = await this.resolveChatUploadMeta(userId, body);
    const objectKey =
      `chat-attachments/${userId}/${randomUUID()}-${file.originalname}`;

    this.assertChatUploadMime(uploadMeta.kind, file.mimetype);
    this.assertChatUploadSize(uploadMeta.kind, file.size);

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

    const asset = await this.prismaService.client.mediaAsset.create({
      data: {
        ownerId: userId,
        kind: uploadMeta.kind,
        status: 'ready',
        bucket: process.env.S3_BUCKET ?? 'big-break',
        objectKey,
        mimeType: file.mimetype,
        byteSize: file.size,
        durationMs: uploadMeta.durationMs,
        waveform: uploadMeta.waveform,
        originalFileName: file.originalname,
        chatId: uploadMeta.chatId,
        publicUrl: buildPublicAssetUrl(objectKey),
      },
    });

    return {
      assetId: asset.id,
      status: asset.status,
      url: asset.publicUrl,
    };
  }

  private async resolveChatUploadMeta(
    userId: string,
    body: Record<string, unknown>,
  ): Promise<ChatUploadMeta> {
    const chatId = await this.requireChatIdForAttachment(userId, body);
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
  }

  private assertChatUploadSize(kind: ChatUploadKind, byteSize: number) {
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

  private async requireChatIdForAttachment(userId: string, body: Record<string, unknown>) {
    const chatId = typeof body.chatId === 'string' ? body.chatId : undefined;

    if (!chatId) {
      throw new ApiError(400, 'chat_id_required', 'chatId is required');
    }

    const membership = await this.prismaService.client.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ApiError(403, 'chat_attachment_forbidden', 'You are not a member of this chat');
    }

    return chatId;
  }
}
