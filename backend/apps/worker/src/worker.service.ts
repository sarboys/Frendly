import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  OUTBOX_EVENT_TYPES,
  buildPublicAssetUrl,
  createRedisPublisher,
  createS3Client,
  publishBusEvent,
} from '@big-break/database';
import Redis from 'ioredis';
import { ApnsPushProvider, FakePushProvider, FcmPushProvider, PushProvider } from './push.providers';
import { PrismaService } from './prisma.service';

@Injectable()
export class WorkerService implements OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly redis: Redis = createRedisPublisher(process.env.REDIS_URL ?? 'redis://localhost:6379');
  private readonly s3 = createS3Client();
  private readonly fakePushProvider = new FakePushProvider();
  private readonly fcmPushProvider = new FcmPushProvider();
  private readonly apnsPushProvider = new ApnsPushProvider();

  constructor(private readonly prismaService: PrismaService) {}

  start() {
    this.timer = setInterval(() => {
      void this.runOnce();
    }, 1500);

    void this.runOnce();
  }

  async onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    await this.redis.quit();
  }

  async runOnce() {
    if (this.running) {
      return;
    }

    this.running = true;
    let event:
      | {
          id: string;
          type: string;
          payload: unknown;
          attempts: number;
        }
      | null = null;

    try {
      event = await this.claimNextEvent();
      if (!event) {
        return;
      }

      switch (event.type) {
        case OUTBOX_EVENT_TYPES.mediaFinalize:
          await this.handleMediaFinalize(event.payload as { assetId: string; chatId?: string });
          break;
        case OUTBOX_EVENT_TYPES.pushDispatch:
          await this.handlePushDispatch(event.payload as { userId: string; notificationId: string });
          break;
        default:
          console.log('[worker-skip-event]', event.type);
      }

      await this.prismaService.client.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'done',
          processedAt: new Date(),
          lockedAt: null,
        },
      });
    } catch (error) {
      if (event) {
        await this.handleFailure(event.id, event.attempts, error);
      }
    } finally {
      this.running = false;
    }
  }

  private async claimNextEvent() {
    const now = new Date();
    const event = await this.prismaService.client.outboxEvent.findFirst({
      where: {
        status: 'pending',
        availableAt: {
          lte: now,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!event) {
      return null;
    }

    const claimed = await this.prismaService.client.outboxEvent.updateMany({
      where: {
        id: event.id,
        status: 'pending',
        availableAt: {
          lte: now,
        },
      },
      data: {
        status: 'processing',
        lockedAt: now,
        attempts: {
          increment: 1,
        },
      },
    });

    if (claimed.count === 0) {
      return null;
    }

    return {
      ...event,
      attempts: event.attempts + 1,
    };
  }

  private async handleFailure(eventId: string, attempts: number, error: unknown) {
    const shouldFailPermanently = attempts >= 5;
    const retryDelaySeconds = Math.min(300, attempts * 15);

    await this.prismaService.client.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: shouldFailPermanently ? 'failed' : 'pending',
        lastError: error instanceof Error ? error.message : 'Unknown worker error',
        lockedAt: null,
        availableAt: shouldFailPermanently
          ? undefined
          : new Date(Date.now() + retryDelaySeconds * 1000),
      },
    });
  }

  private async handleMediaFinalize(payload: { assetId: string; chatId?: string }) {
    const asset = await this.prismaService.client.mediaAsset.findUnique({
      where: { id: payload.assetId },
    });

    if (!asset) {
      return;
    }

    await this.s3.send(
      new HeadObjectCommand({
        Bucket: asset.bucket,
        Key: asset.objectKey,
      }),
    );

    await this.prismaService.client.mediaAsset.update({
      where: { id: asset.id },
      data: {
        status: 'ready',
        publicUrl: buildPublicAssetUrl(asset.objectKey),
      },
    });

    if (asset.chatId ?? payload.chatId) {
      const chatId = asset.chatId ?? payload.chatId!;
      await this.prismaService.client.realtimeEvent.create({
        data: {
          chatId,
          eventType: 'message.attachment_ready',
          payload: {
            chatId,
            assetId: asset.id,
          },
        },
      });

      await publishBusEvent(this.redis, {
        type: 'message.attachment_ready',
        payload: {
          chatId,
          assetId: asset.id,
        },
      });
    }
  }

  private async handlePushDispatch(payload: { userId: string; notificationId: string }) {
    const notification = await this.prismaService.client.notification.findUnique({
      where: { id: payload.notificationId },
    });

    if (!notification) {
      return;
    }

    const tokens = await this.prismaService.client.pushToken.findMany({
      where: {
        userId: payload.userId,
        disabledAt: null,
      },
    });

    for (const token of tokens) {
      const provider = this.resolveProvider(token.provider);
      await provider.send({
        token: token.token,
        title: notification.title,
        body: notification.body,
        data: {
          notificationId: notification.id,
        },
      });
    }
  }

  private resolveProvider(providerName: 'fcm' | 'apns'): PushProvider {
    if ((process.env.PUSH_PROVIDER ?? 'fake') === 'fake') {
      return this.fakePushProvider;
    }

    return providerName === 'apns' ? this.apnsPushProvider : this.fcmPushProvider;
  }
}
