import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  OUTBOX_EVENT_TYPES,
  buildPublicAssetUrl,
  createRedisPublisher,
  createS3Client,
  publishBusEvent,
} from '@big-break/database';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { ApnsPushProvider, FakePushProvider, FcmPushProvider, PushProvider } from './push.providers';
import { PrismaService } from './prisma.service';

const PROCESSING_STALE_AFTER_MS = 60_000;
const DEFAULT_MAX_EVENTS_PER_RUN = 25;
const DEFAULT_PUSH_CONCURRENCY = 5;
const DEFAULT_BUS_PUBLISH_CONCURRENCY = 25;
const DEFAULT_MESSAGE_NOTIFICATION_BATCH_SIZE = 500;
const DEFAULT_SYSTEM_NOTIFICATION_INTERVAL_MS = 60_000;
const DEFAULT_SYSTEM_NOTIFICATION_BATCH_SIZE = 500;
const EVENT_STARTING_WINDOW_MS = 30 * 60 * 1000;
const SUBSCRIPTION_EXPIRING_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

@Injectable()
export class WorkerService implements OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private systemNotificationTimer?: NodeJS.Timeout;
  private running = false;
  private systemNotificationRunning = false;
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
  private readonly systemNotificationIntervalMs = this.resolvePositiveInteger(
    process.env.WORKER_SYSTEM_NOTIFICATION_INTERVAL_MS,
    DEFAULT_SYSTEM_NOTIFICATION_INTERVAL_MS,
  );
  private readonly systemNotificationBatchSize = this.resolvePositiveInteger(
    process.env.WORKER_SYSTEM_NOTIFICATION_BATCH_SIZE,
    DEFAULT_SYSTEM_NOTIFICATION_BATCH_SIZE,
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
    this.systemNotificationTimer = setInterval(() => {
      void this.runSystemNotificationScan();
    }, this.systemNotificationIntervalMs);

    void this.runOnce();
    void this.runSystemNotificationScan();
  }

  async onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    if (this.systemNotificationTimer) {
      clearInterval(this.systemNotificationTimer);
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
        case OUTBOX_EVENT_TYPES.chatUnreadFanout:
          await this.handleChatUnreadFanout(event.payload as {
            chatId?: string;
            actorUserId?: string;
            cursor?: string;
          });
          break;
        case OUTBOX_EVENT_TYPES.messageNotificationFanout:
          await this.handleChatUnreadFanout(event.payload as {
            chatId?: string;
            actorUserId?: string;
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

    const userId = notification.userId;
    const settings = await this.prismaService.client.userSettings.findUnique({
      where: { userId },
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
        userId,
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

  private async handleChatUnreadFanout(payload: {
    chatId?: string;
    actorUserId?: string;
    cursor?: string;
  }) {
    if (
      typeof payload.chatId !== 'string' ||
      typeof payload.actorUserId !== 'string'
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

    if (hasMore) {
      await this.prismaService.client.outboxEvent.create({
        data: {
          type: OUTBOX_EVENT_TYPES.chatUnreadFanout,
          payload: {
            chatId: payload.chatId,
            actorUserId: payload.actorUserId,
            cursor: page[page.length - 1]!.id,
          },
        },
      });
    }

    await this.publishUnreadCounts(
      payload.chatId,
      page.map((member) => member.userId),
    );
  }

  private async publishUnreadCounts(chatId: string, userIds: string[]) {
    if (userIds.length === 0) {
      return;
    }

    const uniqueUserIds = [...new Set(userIds)];
    const rows = await this.prismaService.client.$queryRaw<Array<{
      user_id: string;
      unread_count: bigint | number;
    }>>`
      SELECT cm."userId" AS user_id, COUNT(m."id") AS unread_count
      FROM "ChatMember" cm
      LEFT JOIN "Message" last_read
        ON last_read."chatId" = cm."chatId"
        AND last_read."id" = cm."lastReadMessageId"
      LEFT JOIN "Message" m
        ON m."chatId" = cm."chatId"
        AND m."senderId" <> cm."userId"
        AND (
          COALESCE(cm."lastReadAt", last_read."createdAt") IS NULL
          OR m."createdAt" > COALESCE(cm."lastReadAt", last_read."createdAt")
        )
      WHERE cm."chatId" = ${chatId}
        AND cm."userId" IN (${Prisma.join(uniqueUserIds)})
      GROUP BY cm."userId"
    `;
    const unreadByUserId = new Map(
      rows.map((item) => [item.user_id, Number(item.unread_count)]),
    );

    await this.runWithConcurrency(
      uniqueUserIds,
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

  private async runSystemNotificationScan() {
    if (this.systemNotificationRunning) {
      return;
    }

    this.systemNotificationRunning = true;

    try {
      await this.enqueueEventStartingNotifications();
      await this.enqueueSubscriptionExpiringNotifications();
    } finally {
      this.systemNotificationRunning = false;
    }
  }

  private async enqueueEventStartingNotifications() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + EVENT_STARTING_WINDOW_MS);
    const rows = await this.prismaService.client.$queryRaw<Array<{
      user_id: string;
      event_id: string;
      event_title: string;
      starts_at: Date;
      dedupe_key: string;
    }>>`
      SELECT
        ep."userId" AS user_id,
        e."id" AS event_id,
        e."title" AS event_title,
        e."startsAt" AS starts_at,
        CONCAT('event_starting:', e."id", ':', ep."userId", ':30m') AS dedupe_key
      FROM "EventParticipant" ep
      JOIN "Event" e ON e."id" = ep."eventId"
      WHERE e."startsAt" > ${now}
        AND e."startsAt" <= ${windowEnd}
        AND NOT EXISTS (
          SELECT 1
          FROM "Notification" n
          WHERE n."dedupeKey" = CONCAT('event_starting:', e."id", ':', ep."userId", ':30m')
        )
      ORDER BY e."startsAt" ASC, e."id" ASC, ep."userId" ASC
      LIMIT ${this.systemNotificationBatchSize}
    `;

    for (const row of rows) {
      await this.createSystemNotification({
        userId: row.user_id,
        kind: 'event_starting',
        title: 'Встреча скоро начнется',
        body: `«${row.event_title}» скоро начнется`,
        eventId: row.event_id,
        dedupeKey: row.dedupe_key,
        payload: {
          eventId: row.event_id,
          eventTitle: row.event_title,
          startsAt: row.starts_at.toISOString(),
          reminder: '30m',
        },
      });
    }
  }

  private async enqueueSubscriptionExpiringNotifications() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + SUBSCRIPTION_EXPIRING_WINDOW_MS);
    const rows = await this.prismaService.client.$queryRaw<Array<{
      user_id: string;
      subscription_id: string;
      plan: string;
      status: string;
      ends_at: Date;
      dedupe_key: string;
    }>>`
      SELECT
        us."userId" AS user_id,
        us."id" AS subscription_id,
        us."plan"::text AS plan,
        us."status"::text AS status,
        COALESCE(us."trialEndsAt", us."renewsAt") AS ends_at,
        CONCAT('subscription_expiring:', us."id", ':3d') AS dedupe_key
      FROM "UserSubscription" us
      WHERE (
        (
          us."status" = 'trial'::"SubscriptionStatus"
          AND us."trialEndsAt" > ${now}
          AND us."trialEndsAt" <= ${windowEnd}
        )
        OR (
          us."status" IN ('active'::"SubscriptionStatus", 'canceled'::"SubscriptionStatus")
          AND us."renewsAt" > ${now}
          AND us."renewsAt" <= ${windowEnd}
        )
      )
        AND NOT EXISTS (
          SELECT 1
          FROM "Notification" n
          WHERE n."dedupeKey" = CONCAT('subscription_expiring:', us."id", ':3d')
        )
      ORDER BY ends_at ASC, us."id" ASC
      LIMIT ${this.systemNotificationBatchSize}
    `;

    for (const row of rows) {
      await this.createSystemNotification({
        userId: row.user_id,
        kind: 'subscription_expiring',
        title: 'Подписка скоро закончится',
        body: row.status === 'trial'
          ? 'Пробный период скоро закончится'
          : 'У вас скоро заканчивается подписка',
        dedupeKey: row.dedupe_key,
        payload: {
          subscriptionId: row.subscription_id,
          plan: row.plan,
          status: row.status,
          endsAt: row.ends_at.toISOString(),
        },
      });
    }
  }

  private async createSystemNotification(params: {
    userId: string;
    kind: 'event_starting' | 'subscription_expiring';
    title: string;
    body: string;
    dedupeKey: string;
    payload: Record<string, unknown>;
    eventId?: string;
  }) {
    try {
      const notification = await this.prismaService.client.notification.create({
        data: {
          userId: params.userId,
          kind: params.kind,
          title: params.title,
          body: params.body,
          eventId: params.eventId,
          dedupeKey: params.dedupeKey,
          payload: params.payload as Prisma.InputJsonValue,
        },
      });

      await this.prismaService.client.outboxEvent.createMany({
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return;
      }

      throw error;
    }
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
