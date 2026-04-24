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
import { randomUUID } from 'node:crypto';
import { ApnsPushProvider, FakePushProvider, FcmPushProvider, PushProvider } from './push.providers';
import { PrismaService } from './prisma.service';

const PROCESSING_STALE_AFTER_MS = 60_000;
const DEFAULT_MAX_EVENTS_PER_RUN = 25;
const DEFAULT_PUSH_CONCURRENCY = 5;
const DEFAULT_BUS_PUBLISH_CONCURRENCY = 25;
const DEFAULT_MESSAGE_NOTIFICATION_BATCH_SIZE = 500;

@Injectable()
export class WorkerService implements OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly maxEventsPerRun = this.resolvePositiveInteger(
    process.env.WORKER_MAX_EVENTS_PER_RUN,
    DEFAULT_MAX_EVENTS_PER_RUN,
  );
  private readonly pushConcurrency = this.resolvePositiveInteger(
    process.env.WORKER_PUSH_CONCURRENCY,
    DEFAULT_PUSH_CONCURRENCY,
  );
  private readonly busPublishConcurrency = this.resolvePositiveInteger(
    process.env.WORKER_BUS_PUBLISH_CONCURRENCY,
    DEFAULT_BUS_PUBLISH_CONCURRENCY,
  );
  private readonly messageNotificationBatchSize = this.resolvePositiveInteger(
    process.env.WORKER_MESSAGE_NOTIFICATION_BATCH_SIZE,
    DEFAULT_MESSAGE_NOTIFICATION_BATCH_SIZE,
  );
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

    try {
      for (let index = 0; index < this.maxEventsPerRun; index += 1) {
        const event = await this.claimNextEvent();
        if (!event) {
          return;
        }

        await this.processEvent(event);
      }
    } finally {
      this.running = false;
    }
  }

  private async processEvent(event: {
    id: string;
    type: string;
    payload: unknown;
    attempts: number;
  }) {
    try {
      switch (event.type) {
        case OUTBOX_EVENT_TYPES.mediaFinalize:
          await this.handleMediaFinalize(event.payload as { assetId: string; chatId?: string });
          break;
        case OUTBOX_EVENT_TYPES.pushDispatch:
          await this.handlePushDispatch(event.payload as { userId: string; notificationId: string });
          break;
        case OUTBOX_EVENT_TYPES.unreadFanout:
          await this.handleUnreadFanout(event.payload as { chatId: string; userIds: string[] });
          break;
        case OUTBOX_EVENT_TYPES.messageNotificationFanout:
          await this.handleMessageNotificationFanout(event.payload as {
            chatId?: string;
            actorUserId?: string;
            messageId?: string;
            body?: string;
            cursor?: string;
          });
          break;
        case OUTBOX_EVENT_TYPES.notificationCreate:
          await this.handleNotificationCreate(event.payload as { notificationId?: string });
          break;
        case OUTBOX_EVENT_TYPES.realtimePublish:
          await this.handleRealtimePublish(event.payload as {
            type?: string;
            payload?: unknown;
          });
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
      await this.handleFailure(event.id, event.attempts, error);
    }
  }

  private async claimNextEvent() {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - PROCESSING_STALE_AFTER_MS);
    const event = await this.prismaService.client.outboxEvent.findFirst({
      where: {
        OR: [
          {
            status: 'pending',
            availableAt: {
              lte: now,
            },
          },
          {
            status: 'processing',
            lockedAt: {
              lte: staleBefore,
            },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!event) {
      return null;
    }

    const claimed = await this.prismaService.client.outboxEvent.updateMany({
      where: {
        id: event.id,
        OR: [
          {
            status: 'pending',
            availableAt: {
              lte: now,
            },
          },
          {
            status: 'processing',
            lockedAt: {
              lte: staleBefore,
            },
          },
        ],
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

    const settings = await this.prismaService.client.userSettings.findUnique({
      where: { userId: payload.userId },
      select: {
        allowPush: true,
        quietHours: true,
      },
    });

    if (settings?.allowPush === false || settings?.quietHours === true) {
      return;
    }

    const tokens = await this.prismaService.client.pushToken.findMany({
      where: {
        userId: payload.userId,
        disabledAt: null,
      },
    });

    await this.runWithConcurrency(tokens, this.pushConcurrency, async (token) => {
      const provider = this.resolveProvider(token.provider);
      await provider.send({
        token: token.token,
        title: notification.title,
        body: notification.body,
        data: {
          notificationId: notification.id,
        },
      });
    });
  }

  private async handleNotificationCreate(payload: { notificationId?: string }) {
    if (typeof payload.notificationId !== 'string') {
      return;
    }

    const notification = await this.prismaService.client.notification.findUnique({
      where: { id: payload.notificationId },
    });

    if (!notification) {
      return;
    }

    await publishBusEvent(this.redis, {
      type: 'notification.created',
      payload: {
        userId: notification.userId,
        notificationId: notification.id,
        kind: notification.kind,
        title: notification.title,
        body: notification.body,
        payload: notification.payload,
        createdAt: notification.createdAt.toISOString(),
        readAt: notification.readAt?.toISOString() ?? null,
      },
    });
  }

  private async handleRealtimePublish(payload: { type?: string; payload?: unknown }) {
    if (typeof payload.type !== 'string') {
      return;
    }

    await publishBusEvent(this.redis, {
      type: payload.type,
      payload: payload.payload,
    });
  }

  private async handleUnreadFanout(payload: { chatId: string; userIds: string[] }) {
    if (!payload.chatId || !Array.isArray(payload.userIds) || payload.userIds.length === 0) {
      return;
    }

    const userIds = [...new Set(
      payload.userIds.filter((userId): userId is string => typeof userId === 'string'),
    )];

    if (userIds.length === 0) {
      return;
    }

    await this.publishUnreadCounts(payload.chatId, userIds);
  }

  private async handleMessageNotificationFanout(payload: {
    chatId?: string;
    actorUserId?: string;
    messageId?: string;
    body?: string;
    cursor?: string;
  }) {
    if (
      typeof payload.chatId !== 'string' ||
      typeof payload.actorUserId !== 'string' ||
      typeof payload.messageId !== 'string' ||
      typeof payload.body !== 'string'
    ) {
      return;
    }

    const members = await this.prismaService.client.chatMember.findMany({
      where: {
        chatId: payload.chatId,
        userId: {
          not: payload.actorUserId,
        },
        ...(typeof payload.cursor === 'string'
          ? {
              id: {
                gt: payload.cursor,
              },
            }
          : {}),
      },
      select: {
        id: true,
        userId: true,
      },
      orderBy: { id: 'asc' },
      take: this.messageNotificationBatchSize + 1,
    });
    const hasMore = members.length > this.messageNotificationBatchSize;
    const page = hasMore
      ? members.slice(0, this.messageNotificationBatchSize)
      : members;

    if (page.length === 0) {
      return;
    }

    const now = new Date();
    const createdAt = now.toISOString();
    const notifications = page.map((member) => {
      const id = randomUUID();

      return {
        id,
        userId: member.userId,
        actorUserId: payload.actorUserId!,
        kind: 'message' as const,
        title: 'Новое сообщение',
        body: payload.body!,
        chatId: payload.chatId!,
        messageId: payload.messageId!,
        payload: {
          chatId: payload.chatId!,
          messageId: payload.messageId!,
        },
        readAt: null,
        createdAt: now,
      };
    });

    await this.prismaService.client.notification.createMany({
      data: notifications,
    });

    await this.prismaService.client.outboxEvent.createMany({
      data: notifications.map((notification) => ({
        type: OUTBOX_EVENT_TYPES.pushDispatch,
        payload: {
          userId: notification.userId,
          notificationId: notification.id,
        },
      })),
    });

    if (hasMore) {
      await this.prismaService.client.outboxEvent.create({
        data: {
          type: OUTBOX_EVENT_TYPES.messageNotificationFanout,
          payload: {
            chatId: payload.chatId,
            actorUserId: payload.actorUserId,
            messageId: payload.messageId,
            body: payload.body,
            cursor: page[page.length - 1]!.id,
          },
        },
      });
    }

    await this.runWithConcurrency(
      notifications,
      this.busPublishConcurrency,
      async (notification) => {
        await publishBusEvent(this.redis, {
          type: 'notification.created',
          payload: {
            userId: notification.userId,
            notificationId: notification.id,
            kind: notification.kind,
            title: notification.title,
            body: notification.body,
            payload: notification.payload,
            createdAt,
            readAt: null,
          },
        });
      },
    );

    await this.publishUnreadCounts(
      payload.chatId,
      notifications.map((notification) => notification.userId),
    );
  }

  private async publishUnreadCounts(chatId: string, userIds: string[]) {
    const grouped = await this.prismaService.client.notification.groupBy({
      by: ['userId'],
      where: {
        chatId,
        kind: 'message',
        readAt: null,
        userId: {
          in: userIds,
        },
      },
      _count: {
        _all: true,
      },
    });
    const unreadByUserId = new Map(
      grouped.map((item) => [item.userId, item._count._all]),
    );

    await this.runWithConcurrency(
      userIds,
      this.busPublishConcurrency,
      async (userId) => {
        await publishBusEvent(this.redis, {
          type: 'unread.updated',
          payload: {
            userId,
            chatId,
            unreadCount: unreadByUserId.get(userId) ?? 0,
          },
        });
      },
    );
  }

  private resolveProvider(providerName: 'fcm' | 'apns'): PushProvider {
    if ((process.env.PUSH_PROVIDER ?? 'fake') === 'fake') {
      return this.fakePushProvider;
    }

    return providerName === 'apns' ? this.apnsPushProvider : this.fcmPushProvider;
  }

  private resolvePositiveInteger(raw: string | undefined, fallback: number) {
    const parsed = raw == null ? fallback : Number(raw);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.max(1, Math.trunc(parsed));
  }

  private async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    task: (item: T) => Promise<void>,
  ) {
    let nextIndex = 0;
    const workerCount = Math.min(concurrency, items.length);

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
          const currentIndex = nextIndex;
          nextIndex += 1;
          await task(items[currentIndex]!);
        }
      }),
    );
  }
}
