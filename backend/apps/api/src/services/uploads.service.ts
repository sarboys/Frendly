import { PutObjectCommand } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { buildPublicAssetUrl, createPresignedUpload, createS3Client } from '@big-break/database';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

@Injectable()
export class UploadsService {
  constructor(private readonly prismaService: PrismaService) {}

  private readonly s3 = createS3Client();

  async createChatAttachmentUpload(userId: string, body: Record<string, unknown>) {
    const fileName = typeof body.fileName === 'string' ? body.fileName : 'attachment.bin';
    const contentType = typeof body.contentType === 'string' ? body.contentType : 'application/octet-stream';
    const objectKey = `chat-attachments/${userId}/${randomUUID()}-${fileName}`;
    return createPresignedUpload({ objectKey, contentType });
  }

  async completeChatAttachmentUpload(userId: string, body: Record<string, unknown>) {
    const objectKey = typeof body.objectKey === 'string' ? body.objectKey : undefined;
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'application/octet-stream';
    const byteSize = typeof body.byteSize === 'number' ? body.byteSize : 0;
    const fileName = typeof body.fileName === 'string' ? body.fileName : 'attachment.bin';
    const chatId = typeof body.chatId === 'string' ? body.chatId : undefined;

    if (!objectKey) {
      throw new ApiError(400, 'invalid_upload_payload', 'objectKey is required');
    }

    const asset = await this.prismaService.client.mediaAsset.create({
      data: {
        ownerId: userId,
        kind: 'chat_attachment',
        status: 'ready',
        bucket: process.env.S3_BUCKET ?? 'big-break',
        objectKey,
        mimeType,
        byteSize,
        originalFileName: fileName,
        chatId,
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
    const chatId = typeof body.chatId === 'string' ? body.chatId : undefined;
    const objectKey =
      `chat-attachments/${userId}/${randomUUID()}-${file.originalname}`;

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
        kind: 'chat_attachment',
        status: 'ready',
        bucket: process.env.S3_BUCKET ?? 'big-break',
        objectKey,
        mimeType: file.mimetype,
        byteSize: file.size,
        originalFileName: file.originalname,
        chatId,
        publicUrl: buildPublicAssetUrl(objectKey),
      },
    });

    return {
      assetId: asset.id,
      status: asset.status,
      url: asset.publicUrl,
    };
  }
}
