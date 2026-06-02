import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  OUTBOX_EVENT_TYPES,
  CONTENT_IMPORT_CITY_NAMES,
  appMetrics,
  buildMediaProxyPath,
  buildPublicAssetUrl,
  createRedisPublisher,
  createS3Client,
  createS3RequestOptions,
  getS3Config,
  objectKeyFromPublicAssetUrl,
  publishBusEvent,
  runRetentionCleanup,
} from '@big-break/database';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import type { ExternalSourceCode } from './content/content-source.types';
import { ContentImportService } from './content/content-import.service';
import { RouteDraftGenerationService } from './content/route-draft-generation.service';
import {
  PROFILE_IMAGE_VARIANT_SPECS,
  createImageVariants,
} from './media/image-variants';
import { ApnsPushProvider, FakePushProvider, FcmPushProvider, PushProvider } from './push.providers';
import { PrismaService } from './prisma.service';
import { Readable } from 'node:stream';

const PROCESSING_STALE_AFTER_MS = 60_000;
const DEFAULT_MAX_EVENTS_PER_RUN = 25;
const DEFAULT_PUSH_CONCURRENCY = 5;
const DEFAULT_BUS_PUBLISH_CONCURRENCY = 25;
const DEFAULT_MESSAGE_NOTIFICATION_BATCH_SIZE = 500;
const DEFAULT_SYSTEM_NOTIFICATION_INTERVAL_MS = 60_000;
const DEFAULT_SYSTEM_NOTIFICATION_BATCH_SIZE = 500;
const DEFAULT_OUTBOX_BACKLOG_WARN_AGE_MS = 5 * 60 * 1000;
const DEFAULT_RETENTION_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_RETENTION_BATCH_SIZE = 500;
const DEFAULT_EVENING_AUTO_ADVANCE_INTERVAL_MS = 30_000;
const DEFAULT_EVENING_AUTO_ADVANCE_BATCH_SIZE = 25;
const DEFAULT_PUSH_TOKEN_BATCH_SIZE = 20;
const DEFAULT_CONTENT_IMPORT_INTERVAL_MS = 4 * 60 * 60 * 1000;
const DEFAULT_CONTENT_IMPORT_TIME_ZONE = 'Europe/Moscow';
const DEFAULT_CONTENT_GEOCODER_DAILY_LIMIT = 1000;
const DEFAULT_CONTENT_MANUAL_IMPORT_INTERVAL_MS = 30_000;
const DEFAULT_CONTENT_MANUAL_GENERATION_INTERVAL_MS = 30_000;
const DEFAULT_CONTENT_ROUTE_GENERATION_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_CONTENT_IMAGE_BACKFILL_BATCH_SIZE = 50;
const DEFAULT_MEDIA_VARIANT_BACKFILL_INTERVAL_MS = 10 * 60 * 1000;
const DEFAULT_MEDIA_VARIANT_BACKFILL_BATCH_SIZE = 50;
const EVENT_STARTING_WINDOW_MS = 30 * 60 * 1000;
const SUBSCRIPTION_EXPIRING_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const METRICS_SERVICE = 'worker';

type ClaimedOutboxEvent = {
  id: string;
  type: string;
  payload: unknown;
  attempts: number;
  createdAt?: Date | null;
};

type BatchableChatUnreadFanoutEvent = {
  id: string;
  attempts: number;
  chatId: string;
  actorUserId: string;
  messageCreatedAt: Date;
};

type ChatUnreadFanoutBatch = {
  chatId: string;
  actorUserId: string;
  events: BatchableChatUnreadFanoutEvent[];
};

type DailyImportTime = {
  hour: number;
  minute: number;
};

@Injectable()
export class WorkerService implements OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private systemNotificationTimer?: NodeJS.Timeout;
  private retentionCleanupTimer?: NodeJS.Timeout;
  private eveningAutoAdvanceTimer?: NodeJS.Timeout;
  private contentImportTimer?: NodeJS.Timeout;
  private contentManualImportTimer?: NodeJS.Timeout;
  private contentManualGenerationTimer?: NodeJS.Timeout;
  private contentRouteGenerationTimer?: NodeJS.Timeout;
  private ticketlandGeocoderBackfillTimer?: NodeJS.Timeout;
  private mediaVariantBackfillTimer?: NodeJS.Timeout;
  private running = false;
  private systemNotificationRunning = false;
  private retentionCleanupRunning = false;
  private eveningAutoAdvanceRunning = false;
  private contentImportRunning = false;
  private contentManualImportRunning = false;
  private contentManualGenerationRunning = false;
  private contentRouteGenerationRunning = false;
  private ticketlandGeocoderBackfillRunning = false;
  private mediaVariantBackfillRunning = false;
  private shuttingDown = false;
  private readonly maxEventsPerRun = this.resolvePositiveInteger(
    process.env.WORKER_MAX_EVENTS_PER_RUN,
    DEFAULT_MAX_EVENTS_PER_RUN,
  );
  private readonly outboxProcessingConcurrency = this.resolvePositiveInteger(
    process.env.WORKER_OUTBOX_PROCESSING_CONCURRENCY,
    1,
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
  private readonly outboxBacklogWarnAgeMs = this.resolvePositiveInteger(
    process.env.WORKER_OUTBOX_BACKLOG_WARN_AGE_MS,
    DEFAULT_OUTBOX_BACKLOG_WARN_AGE_MS,
  );
  private readonly outboxEnabled = process.env.WORKER_OUTBOX_ENABLED !== 'false';
  private readonly contentRoleEnabled = process.env.WORKER_CONTENT_ENABLED !== 'false';
  private readonly schedulesRoleEnabled = process.env.WORKER_SCHEDULES_ENABLED !== 'false';
  private readonly pushTokenBatchSize = this.resolvePositiveInteger(
    process.env.WORKER_PUSH_TOKEN_BATCH_SIZE,
    DEFAULT_PUSH_TOKEN_BATCH_SIZE,
  );
  private readonly retentionCleanupEnabled =
    process.env.WORKER_RETENTION_CLEANUP_ENABLED === 'true';
  private readonly retentionCleanupIntervalMs = this.resolvePositiveInteger(
    process.env.WORKER_RETENTION_CLEANUP_INTERVAL_MS,
    DEFAULT_RETENTION_CLEANUP_INTERVAL_MS,
  );
  private readonly retentionBatchSize = this.resolvePositiveInteger(
    process.env.RETENTION_BATCH_SIZE,
    DEFAULT_RETENTION_BATCH_SIZE,
  );
  private readonly eveningAutoAdvanceIntervalMs = this.resolvePositiveInteger(
    process.env.WORKER_EVENING_AUTO_ADVANCE_INTERVAL_MS,
    DEFAULT_EVENING_AUTO_ADVANCE_INTERVAL_MS,
  );
  private readonly eveningAutoAdvanceBatchSize = this.resolvePositiveInteger(
    process.env.WORKER_EVENING_AUTO_ADVANCE_BATCH_SIZE,
    DEFAULT_EVENING_AUTO_ADVANCE_BATCH_SIZE,
  );
  private readonly contentImportEnabled =
    process.env.CONTENT_IMPORT_ENABLED === 'true';
  private readonly contentImageBackfillEnabled =
    process.env.CONTENT_IMPORT_IMAGE_BACKFILL_ENABLED === 'true';
  private readonly contentImageBackfillBatchSize = this.resolvePositiveInteger(
    process.env.CONTENT_IMPORT_IMAGE_BACKFILL_BATCH_SIZE,
    DEFAULT_CONTENT_IMAGE_BACKFILL_BATCH_SIZE,
  );
  private readonly mediaVariantBackfillEnabled =
    process.env.MEDIA_VARIANT_BACKFILL_ENABLED === 'true';
  private readonly mediaVariantBackfillIntervalMs = this.resolvePositiveInteger(
    process.env.MEDIA_VARIANT_BACKFILL_INTERVAL_MS,
    DEFAULT_MEDIA_VARIANT_BACKFILL_INTERVAL_MS,
  );
  private readonly mediaVariantBackfillBatchSize = this.resolvePositiveInteger(
    process.env.MEDIA_VARIANT_BACKFILL_BATCH_SIZE,
    DEFAULT_MEDIA_VARIANT_BACKFILL_BATCH_SIZE,
  );
  private readonly contentImportIntervalMs = this.resolvePositiveInteger(
    process.env.CONTENT_IMPORT_INTERVAL_MS,
    DEFAULT_CONTENT_IMPORT_INTERVAL_MS,
  );
  private readonly contentImportDailyAt = this.parseDailyImportTime(
    process.env.CONTENT_IMPORT_DAILY_AT,
    'CONTENT_IMPORT_DAILY_AT',
  );
  private readonly contentImportWeeklyDay = this.parseWeeklyImportDay(
    process.env.CONTENT_IMPORT_WEEKLY_DAY,
  );
  private readonly contentImportWeeklyAt = this.parseDailyImportTime(
    process.env.CONTENT_IMPORT_WEEKLY_AT,
    'CONTENT_IMPORT_WEEKLY_AT',
  );
  private readonly contentImportTimeZone = this.resolveContentImportTimeZone(
    process.env.CONTENT_IMPORT_TIME_ZONE,
  );
  private readonly contentGeocoderBackfillEnabled =
    process.env.CONTENT_GEOCODER_BACKFILL_ENABLED === 'true';
  private readonly contentGeocoderBackfillDailyAt = this.parseDailyImportTime(
    process.env.CONTENT_GEOCODER_BACKFILL_DAILY_AT,
    'CONTENT_GEOCODER_BACKFILL_DAILY_AT',
  ) ?? { hour: 22, minute: 0 };
  private readonly contentGeocoderDailyLimit = this.resolvePositiveInteger(
    process.env.CONTENT_GEOCODER_DAILY_LIMIT,
    DEFAULT_CONTENT_GEOCODER_DAILY_LIMIT,
  );
  private readonly contentManualImportIntervalMs = this.resolvePositiveInteger(
    process.env.CONTENT_MANUAL_IMPORT_INTERVAL_MS,
    DEFAULT_CONTENT_MANUAL_IMPORT_INTERVAL_MS,
  );
  private readonly contentManualGenerationIntervalMs = this.resolvePositiveInteger(
    process.env.CONTENT_MANUAL_GENERATION_INTERVAL_MS,
    DEFAULT_CONTENT_MANUAL_GENERATION_INTERVAL_MS,
  );
  private readonly contentRouteGenerationEnabled =
    process.env.CONTENT_ROUTE_GENERATION_ENABLED === 'true';
  private readonly contentRouteGenerationIntervalMs = this.resolvePositiveInteger(
    process.env.CONTENT_ROUTE_GENERATION_INTERVAL_MS,
    DEFAULT_CONTENT_ROUTE_GENERATION_INTERVAL_MS,
  );
  private readonly redis: Redis = createRedisPublisher(process.env.REDIS_URL ?? 'redis://localhost:6379');
  private readonly s3 = createS3Client();
  private readonly fakePushProvider = new FakePushProvider();
  private readonly fcmPushProvider = new FcmPushProvider();
  private readonly apnsPushProvider = new ApnsPushProvider();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly contentImportService?: ContentImportService,
    private readonly routeDraftGenerationService?: RouteDraftGenerationService,
  ) {
    this.redis.on('error', (error) => {
      console.error('[worker] redis publisher error', error);
    });
  }

  start() {
    if (this.outboxEnabled) {
      this.timer = setInterval(() => {
        void this.runScheduledTask('outbox', () => this.runOnce());
      }, 1500);
    }
    if (this.schedulesRoleEnabled) {
      this.systemNotificationTimer = setInterval(() => {
        void this.runScheduledTask(
          'system-notifications',
          () => this.runSystemNotificationScan(),
        );
      }, this.systemNotificationIntervalMs);
      this.eveningAutoAdvanceTimer = setInterval(() => {
        void this.runScheduledTask(
          'evening-auto-advance',
          () => this.runEveningAutoAdvanceScan(),
        );
      }, this.eveningAutoAdvanceIntervalMs);
    }
    if (this.schedulesRoleEnabled && this.retentionCleanupEnabled) {
      this.retentionCleanupTimer = setInterval(() => {
        void this.runScheduledTask(
          'retention-cleanup',
          () => this.runRetentionCleanup(),
        );
      }, this.retentionCleanupIntervalMs);
    }
    if (this.contentRoleEnabled) {
      this.contentManualImportTimer = setInterval(() => {
        void this.runScheduledTask(
          'content-manual-import',
          () => this.runPendingManualImportScan(),
        );
      }, this.contentManualImportIntervalMs);
      this.contentManualGenerationTimer = setInterval(() => {
        void this.runScheduledTask(
          'content-manual-generation',
          () => this.runPendingManualGenerationScan(),
        );
      }, this.contentManualGenerationIntervalMs);
    }
    if (this.contentRoleEnabled && this.contentImportEnabled) {
      this.startContentImportSchedule();
    }
    if (this.contentRoleEnabled && this.contentGeocoderBackfillEnabled) {
      this.startTicketlandGeocoderBackfillSchedule();
    }
    if (this.contentRoleEnabled && this.contentRouteGenerationEnabled) {
      this.contentRouteGenerationTimer = setInterval(() => {
        void this.runScheduledTask(
          'content-route-generation',
          () => this.runContentRouteGenerationScan(),
        );
      }, this.contentRouteGenerationIntervalMs);
    }
    if (this.outboxEnabled && this.mediaVariantBackfillEnabled) {
      this.mediaVariantBackfillTimer = setInterval(() => {
        void this.runScheduledTask(
          'media-variant-backfill',
          () => this.runMediaVariantBackfillScan(),
        );
      }, this.mediaVariantBackfillIntervalMs);
    }
    this.unrefTimers();

    if (this.outboxEnabled) {
      void this.runScheduledTask('outbox', () => this.runOnce());
    }
    if (this.schedulesRoleEnabled) {
      void this.runScheduledTask(
        'system-notifications',
        () => this.runSystemNotificationScan(),
      );
      void this.runScheduledTask(
        'evening-auto-advance',
        () => this.runEveningAutoAdvanceScan(),
      );
    }
    if (this.schedulesRoleEnabled && this.retentionCleanupEnabled) {
      void this.runScheduledTask(
        'retention-cleanup',
        () => this.runRetentionCleanup(),
      );
    }
    if (this.contentRoleEnabled) {
      void this.runScheduledTask(
        'content-manual-import',
        () => this.runPendingManualImportScan(),
      );
      void this.runScheduledTask(
        'content-manual-generation',
        () => this.runPendingManualGenerationScan(),
      );
    }
    if (
      this.contentRoleEnabled &&
      this.contentImportEnabled &&
      !this.contentImportDailyAt &&
      !this.hasWeeklyContentImportSchedule()
    ) {
      void this.runScheduledTask(
        'content-import',
        () => this.runContentImportScan(),
      );
    }
    if (this.contentRoleEnabled && this.contentRouteGenerationEnabled) {
      void this.runScheduledTask(
        'content-route-generation',
        () => this.runContentRouteGenerationScan(),
      );
    }
    if (this.outboxEnabled && this.mediaVariantBackfillEnabled) {
      void this.runScheduledTask(
        'media-variant-backfill',
        () => this.runMediaVariantBackfillScan(),
      );
    }
  }

  async onModuleDestroy() {
    this.shuttingDown = true;
    this.clearTimers();
    const shutdownResults = await Promise.allSettled([
      this.redis.quit(),
      this.fcmPushProvider.close(),
      Promise.resolve(this.apnsPushProvider.close()),
    ]);

    for (const result of shutdownResults) {
      if (result.status === 'rejected') {
        console.error('[worker] shutdown cleanup failed', result.reason);
      }
    }
  }

  private unrefTimers() {
    for (const timer of this.getTimers()) {
      timer?.unref?.();
    }
  }

  private clearTimers() {
    for (const timer of this.getTimers()) {
      if (timer) {
        clearInterval(timer);
      }
    }

    this.timer = undefined;
    this.systemNotificationTimer = undefined;
    this.retentionCleanupTimer = undefined;
    this.eveningAutoAdvanceTimer = undefined;
    this.contentImportTimer = undefined;
    this.contentManualImportTimer = undefined;
    this.contentManualGenerationTimer = undefined;
    this.contentRouteGenerationTimer = undefined;
    this.ticketlandGeocoderBackfillTimer = undefined;
    this.mediaVariantBackfillTimer = undefined;
  }

  private getTimers() {
    return [
      this.timer,
      this.systemNotificationTimer,
      this.retentionCleanupTimer,
      this.eveningAutoAdvanceTimer,
      this.contentImportTimer,
      this.contentManualImportTimer,
      this.contentManualGenerationTimer,
      this.contentRouteGenerationTimer,
      this.ticketlandGeocoderBackfillTimer,
      this.mediaVariantBackfillTimer,
    ];
  }

  private startContentImportSchedule() {
    if (this.hasWeeklyContentImportSchedule()) {
      this.scheduleNextWeeklyContentImport();
      return;
    }

    if (this.contentImportDailyAt) {
      this.scheduleNextDailyContentImport();
      return;
    }

    this.contentImportTimer = setInterval(() => {
      void this.runScheduledTask(
        'content-import',
        () => this.runContentImportScan(),
      );
    }, this.contentImportIntervalMs);
  }

  private hasWeeklyContentImportSchedule() {
    return this.contentImportWeeklyDay != null && this.contentImportWeeklyAt != null;
  }

  private scheduleNextWeeklyContentImport() {
    if (
      this.contentImportWeeklyDay == null ||
      !this.contentImportWeeklyAt ||
      this.shuttingDown
    ) {
      return;
    }

    this.contentImportTimer = setTimeout(() => {
      void this.runWeeklyContentImportAndReschedule();
    }, this.msUntilWeeklyImport(this.contentImportWeeklyDay, this.contentImportWeeklyAt));
    this.contentImportTimer.unref?.();
  }

  private async runWeeklyContentImportAndReschedule() {
    await this.runScheduledTask(
      'content-import',
      () => this.runContentImportScan(),
    );
    this.scheduleNextWeeklyContentImport();
  }

  private scheduleNextDailyContentImport() {
    if (!this.contentImportDailyAt || this.shuttingDown) {
      return;
    }

    this.contentImportTimer = setTimeout(() => {
      void this.runDailyContentImportAndReschedule();
    }, this.msUntilDailyImport(this.contentImportDailyAt));
    this.contentImportTimer.unref?.();
  }

  private async runDailyContentImportAndReschedule() {
    await this.runScheduledTask(
      'content-import',
      () => this.runContentImportScan(),
    );
    this.scheduleNextDailyContentImport();
  }

  private startTicketlandGeocoderBackfillSchedule() {
    this.scheduleNextTicketlandGeocoderBackfill();
  }

  private scheduleNextTicketlandGeocoderBackfill() {
    if (this.shuttingDown) {
      return;
    }

    this.ticketlandGeocoderBackfillTimer = setTimeout(() => {
      void this.runTicketlandGeocoderBackfillAndReschedule();
    }, this.msUntilDailyImport(this.contentGeocoderBackfillDailyAt));
    this.ticketlandGeocoderBackfillTimer.unref?.();
  }

  private async runTicketlandGeocoderBackfillAndReschedule() {
    await this.runScheduledTask(
      'ticketland-geocoder-backfill',
      () => this.runTicketlandGeocoderBackfillScan(),
    );
    this.scheduleNextTicketlandGeocoderBackfill();
  }

  private parseDailyImportTime(value?: string, envName = 'CONTENT_IMPORT_DAILY_AT'): DailyImportTime | null {
    const raw = value?.trim();
    if (!raw) {
      return null;
    }

    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(raw);
    if (!match) {
      console.warn(`[worker] ${envName} ignored, expected HH:mm`);
      return null;
    }

    return {
      hour: Number.parseInt(match[1]!, 10),
      minute: Number.parseInt(match[2]!, 10),
    };
  }

  private parseWeeklyImportDay(value?: string) {
    const raw = value?.trim();
    if (!raw) {
      return null;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 6) {
      console.warn('[worker] CONTENT_IMPORT_WEEKLY_DAY ignored, expected 0-6');
      return null;
    }
    return parsed;
  }

  private resolveContentImportTimeZone(value?: string) {
    const timeZone = value?.trim() || DEFAULT_CONTENT_IMPORT_TIME_ZONE;

    try {
      new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0));
      return timeZone;
    } catch {
      console.warn(
        '[worker] CONTENT_IMPORT_TIME_ZONE ignored, expected an IANA time zone',
      );
      return DEFAULT_CONTENT_IMPORT_TIME_ZONE;
    }
  }

  private msUntilDailyImport(target: DailyImportTime, now = new Date()) {
    const local = this.localTimeParts(now);
    const currentMs =
      ((local.hour * 60 + local.minute) * 60 + local.second) * 1000 +
      now.getMilliseconds();
    const targetMs = ((target.hour * 60 + target.minute) * 60) * 1000;
    const dayMs = 24 * 60 * 60 * 1000;
    const delay = targetMs - currentMs;
    return delay > 0 ? delay : delay + dayMs;
  }

  private msUntilWeeklyImport(targetWeekday: number, target: DailyImportTime, now = new Date()) {
    const local = this.localTimeParts(now);
    const currentMs =
      ((local.hour * 60 + local.minute) * 60 + local.second) * 1000 +
      now.getMilliseconds();
    const targetMs = ((target.hour * 60 + target.minute) * 60) * 1000;
    let daysUntil = (targetWeekday - local.weekday + 7) % 7;
    if (daysUntil === 0 && currentMs >= targetMs) {
      daysUntil = 7;
    }
    return daysUntil * 24 * 60 * 60 * 1000 + targetMs - currentMs;
  }

  private localTimeParts(date: Date) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: this.contentImportTimeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const value = (type: string) =>
      Number.parseInt(parts.find((part) => part.type === type)?.value ?? '0', 10);

    return {
      hour: value('hour'),
      minute: value('minute'),
      second: value('second'),
      weekday: weekdayNumber(parts.find((part) => part.type === 'weekday')?.value),
    };
  }

  private localDateParts(date: Date) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: this.contentImportTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }).formatToParts(date);
    const value = (type: string) =>
      Number.parseInt(parts.find((part) => part.type === type)?.value ?? '0', 10);

    return {
      year: value('year'),
      month: value('month'),
      day: value('day'),
      weekday: weekdayNumber(parts.find((part) => part.type === 'weekday')?.value),
    };
  }

  private async runScheduledTask(
    label: string,
    task: () => Promise<void>,
  ) {
    const startedAt = process.hrtime.bigint();
    try {
      await task();
      this.recordWorkerJobDuration(label, 'ok', startedAt);
    } catch (error) {
      this.recordWorkerJobDuration(label, 'error', startedAt);
      console.error(`[worker] scheduled task failed: ${label}`, error);
    }
  }

  async runOnce() {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      if (this.shouldUseBatchOutboxClaim()) {
        const events = await this.claimNextEvents();
        this.recordOutboxBacklogAge(events);
        await this.processClaimedEvents(events);
        return;
      }

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

  private async processClaimedEvents(events: ClaimedOutboxEvent[]) {
    const regularEvents: ClaimedOutboxEvent[] = [];
    const unreadBatches = new Map<string, ChatUnreadFanoutBatch>();

    for (const event of events) {
      const batchable = this.parseBatchableChatUnreadFanoutEvent(event);
      if (batchable == null) {
        regularEvents.push(event);
        continue;
      }

      const key = `${batchable.chatId}:${batchable.actorUserId}`;
      const batch = unreadBatches.get(key);
      if (batch) {
        batch.events.push(batchable);
      } else {
        unreadBatches.set(key, {
          chatId: batchable.chatId,
          actorUserId: batchable.actorUserId,
          events: [batchable],
        });
      }
    }

    await this.runWithConcurrency(
      [
        ...regularEvents.map((event) => ({
          run: () => this.processEvent(event),
        })),
        ...[...unreadBatches.values()].map((batch) => ({
          run: () => this.processChatUnreadFanoutBatch(batch),
        })),
      ],
      this.outboxProcessingConcurrency,
      async (task) => {
        await task.run();
      },
    );
  }

  private parseBatchableChatUnreadFanoutEvent(
    event: ClaimedOutboxEvent,
  ): BatchableChatUnreadFanoutEvent | null {
    if (event.type !== OUTBOX_EVENT_TYPES.chatUnreadFanout) {
      return null;
    }
    if (event.payload == null || typeof event.payload !== 'object') {
      return null;
    }

    const payload = event.payload as {
      chatId?: unknown;
      actorUserId?: unknown;
      cursor?: unknown;
      messageCreatedAt?: unknown;
    };
    if (payload.cursor != null) {
      return null;
    }
    if (typeof payload.chatId !== 'string' || typeof payload.actorUserId !== 'string') {
      return null;
    }

    const messageCreatedAt = this.parseMessageCreatedAt(payload.messageCreatedAt);
    if (messageCreatedAt == null) {
      return null;
    }

    return {
      id: event.id,
      attempts: event.attempts,
      chatId: payload.chatId,
      actorUserId: payload.actorUserId,
      messageCreatedAt,
    };
  }

  private async processChatUnreadFanoutBatch(batch: ChatUnreadFanoutBatch) {
    const startedAt = process.hrtime.bigint();
    try {
      await this.incrementUnreadCountsForMessages(
        batch.chatId,
        batch.actorUserId,
        batch.events.map((event) => event.messageCreatedAt),
      );
      await this.prismaService.client.outboxEvent.updateMany({
        where: {
          id: {
            in: batch.events.map((event) => event.id),
          },
        },
        data: {
          status: 'done',
          processedAt: new Date(),
          lockedAt: null,
        },
      });
      this.recordWorkerJobDuration(OUTBOX_EVENT_TYPES.chatUnreadFanout, 'ok', startedAt);
    } catch (error) {
      this.recordWorkerJobDuration(OUTBOX_EVENT_TYPES.chatUnreadFanout, 'error', startedAt);
      await Promise.all(
        batch.events.map((event) => this.handleFailure(event.id, event.attempts, error)),
      );
    }
  }

  private shouldUseBatchOutboxClaim() {
    if (process.env.WORKER_OUTBOX_BATCH_CLAIM === 'false') {
      return false;
    }

    return typeof this.prismaService.client.$queryRaw === 'function';
  }

  private recordOutboxBacklogAge(events: ClaimedOutboxEvent[]) {
    this.recordClaimedOutboxCounts(events);
    const oldest = events.reduce<ClaimedOutboxEvent | null>((current, event) => {
      if (event.createdAt == null) {
        return current;
      }
      if (current == null || current.createdAt == null) {
        return event;
      }
      return event.createdAt < current.createdAt ? event : current;
    }, null);

    if (oldest?.createdAt == null) {
      return;
    }

    const ageMs = Date.now() - oldest.createdAt.getTime();
    appMetrics.workerOutboxLagSeconds.set(
      { service: METRICS_SERVICE, event_type: oldest.type },
      ageMs / 1000,
    );
    if (ageMs < this.outboxBacklogWarnAgeMs) {
      return;
    }

    console.warn('[worker-outbox-backlog-age]', {
      oldestEventId: oldest.id,
      oldestEventType: oldest.type,
      ageMs,
      thresholdMs: this.outboxBacklogWarnAgeMs,
      claimedCount: events.length,
    });
  }

  private async processEvent(event: ClaimedOutboxEvent) {
    const startedAt = process.hrtime.bigint();
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
            messageCreatedAt?: string;
          });
          break;
        case OUTBOX_EVENT_TYPES.messageNotificationFanout:
          await this.handleMessageNotificationFanout(event.payload as {
            chatId?: string;
            actorUserId?: string;
            messageId?: string;
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
        case OUTBOX_EVENT_TYPES.safetySosDelivery:
          await this.handleSafetySosDelivery(event.payload as {
            sosAlertId?: string;
            contactId?: string;
            channel?: string;
            value?: string;
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
      this.recordWorkerJobDuration(event.type, 'ok', startedAt);
    } catch (error) {
      this.recordWorkerJobDuration(event.type, 'error', startedAt);
      await this.handleFailure(event.id, event.attempts, error);
    }
  }

  private async handleSafetySosDelivery(payload: {
    sosAlertId?: string;
    contactId?: string;
    channel?: string;
    value?: string;
  }) {
    if (!payload.sosAlertId || !payload.contactId) {
      return;
    }

    console.log('[safety-sos-delivery-queued]', {
      sosAlertId: payload.sosAlertId,
      contactId: payload.contactId,
      channel: payload.channel,
    });
  }

  private async claimNextEvents() {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - PROCESSING_STALE_AFTER_MS);

    return this.prismaService.client.$queryRaw<ClaimedOutboxEvent[]>`
      WITH next_events AS (
        SELECT "id"
        FROM "OutboxEvent"
        WHERE (
          "status" = 'pending'::"OutboxStatus"
          AND "availableAt" <= ${now}
        )
        OR (
          "status" = 'processing'::"OutboxStatus"
          AND "lockedAt" <= ${staleBefore}
        )
        ORDER BY "createdAt" ASC, "id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${this.maxEventsPerRun}
      )
      UPDATE "OutboxEvent" AS event
      SET
        "status" = 'processing'::"OutboxStatus",
        "lockedAt" = ${now},
        "attempts" = event."attempts" + 1
      FROM next_events
      WHERE event."id" = next_events."id"
      RETURNING
        event."id",
        event."type",
        event."payload",
        event."attempts",
        event."createdAt"
    `;
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
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        type: true,
        payload: true,
        attempts: true,
        createdAt: true,
      },
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
    if (shouldFailPermanently) {
      appMetrics.workerPermanentFailuresTotal.inc({
        service: METRICS_SERVICE,
        job_type: 'outbox',
      });
    } else {
      appMetrics.workerJobRetriesTotal.inc({
        service: METRICS_SERVICE,
        job_type: 'outbox',
      });
    }
  }

  private async handleMediaFinalize(payload: {
    assetId: string;
    chatId?: string;
    notifyChat?: boolean;
  }) {
    const asset = await this.prismaService.client.mediaAsset.findUnique({
      where: { id: payload.assetId },
      select: {
        id: true,
        kind: true,
        bucket: true,
        objectKey: true,
        mimeType: true,
        chatId: true,
      },
    });

    if (!asset) {
      return;
    }

    await this.s3.send(
      new HeadObjectCommand({
        Bucket: asset.bucket,
        Key: asset.objectKey,
      }),
      createS3RequestOptions(),
    );

    const rawVariants = await this.tryCreateMediaVariants(asset);
    const publicMedia = this.isPublicMediaAsset(asset);
    const variants = publicMedia
      ? rawVariants
      : this.toPrivateMediaVariants(asset.id, rawVariants);

    const data: Prisma.MediaAssetUpdateInput = {
      status: 'ready',
      ...(publicMedia ? { publicUrl: buildPublicAssetUrl(asset.objectKey) } : {}),
      ...(Object.keys(variants).length > 0 ? { variants } : {}),
    };

    await this.prismaService.client.mediaAsset.update({
      where: { id: asset.id },
      data,
    });

    if (payload.notifyChat !== false && (asset.chatId ?? payload.chatId)) {
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

  private async runMediaVariantBackfillScan() {
    if (this.mediaVariantBackfillRunning) {
      return;
    }
    this.mediaVariantBackfillRunning = true;
    try {
      const rows = await this.prismaService.client.mediaAsset.findMany({
        where: {
          status: 'ready',
          kind: {
            in: ['avatar', 'chat_attachment', 'story_media', 'event_cover'],
          },
          mimeType: { startsWith: 'image/' },
          NOT: { mimeType: 'image/gif' },
        },
        select: {
          id: true,
          variants: true,
        },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: this.mediaVariantBackfillBatchSize * 3,
      });

      const targets = rows
        .filter((row) => !this.hasAllProfileImageVariants(row.variants))
        .slice(0, this.mediaVariantBackfillBatchSize);
      let processed = 0;
      for (const target of targets) {
        await this.handleMediaFinalize({
          assetId: target.id,
          notifyChat: false,
        });
        processed += 1;
      }
      const dropProcessed = await this.runDropImageVariantBackfillScan();
      if (rows.length > 0) {
        console.info('[worker] media variant backfill completed', {
          scanned: rows.length,
          processed,
          dropProcessed,
        });
      }
    } finally {
      this.mediaVariantBackfillRunning = false;
    }
  }

  private async runDropImageVariantBackfillScan() {
    const rows = await this.prismaService.client.drop.findMany({
      where: {
        imageUrl: { not: null },
      },
      select: {
        id: true,
        imageUrl: true,
        imageVariants: true,
      },
      orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
      take: this.mediaVariantBackfillBatchSize * 3,
    });
    const targets = rows
      .filter((row) => !this.hasAllPublicCardImageVariants(row.imageVariants))
      .slice(0, this.mediaVariantBackfillBatchSize);

    let processed = 0;
    for (const target of targets) {
      const objectKey = target.imageUrl
        ? objectKeyFromPublicAssetUrl(target.imageUrl)
        : null;
      if (!objectKey) {
        continue;
      }
      const variants = await this.createPublicImageVariantsForObjectKey(objectKey);
      if (Object.keys(variants).length === 0) {
        continue;
      }
      await this.prismaService.client.drop.update({
        where: { id: target.id },
        data: { imageVariants: variants },
      });
      processed += 1;
    }
    return processed;
  }

  private async tryCreateMediaVariants(asset: {
    kind: string;
    bucket: string;
    objectKey: string;
    mimeType: string;
  }) {
    if (!this.shouldCreateMediaVariants(asset)) {
      return {};
    }

    try {
      const object = await this.s3.send(
        new GetObjectCommand({
          Bucket: asset.bucket,
          Key: asset.objectKey,
        }),
        createS3RequestOptions(),
      );
      if (!object.Body) {
        return {};
      }
      const sourceBytes = await streamToBuffer(object.Body as unknown as Readable);
      return await createImageVariants({
        s3: this.s3,
        sourceBytes,
        sourceObjectKey: asset.objectKey,
        specs: PROFILE_IMAGE_VARIANT_SPECS,
      });
    } catch (caught) {
      console.warn('[worker] media variants failed', {
        objectKey: asset.objectKey,
        reason: caught instanceof Error ? caught.message : 'unknown',
      });
      return {};
    }
  }

  private async createPublicImageVariantsForObjectKey(objectKey: string) {
    try {
      const object = await this.s3.send(
        new GetObjectCommand({
          Bucket: getS3Config().bucket,
          Key: objectKey,
        }),
        createS3RequestOptions(),
      );
      if (!object.Body) {
        return {};
      }
      const sourceBytes = await streamToBuffer(object.Body as unknown as Readable);
      return await createImageVariants({
        s3: this.s3,
        sourceBytes,
        sourceObjectKey: objectKey,
        specs: PROFILE_IMAGE_VARIANT_SPECS,
      });
    } catch (caught) {
      console.warn('[worker] public image variants failed', {
        objectKey,
        reason: caught instanceof Error ? caught.message : 'unknown',
      });
      return {};
    }
  }

  private shouldCreateMediaVariants(asset: { kind: string; mimeType: string }) {
    if (!asset.mimeType.startsWith('image/')) {
      return false;
    }
    if (asset.mimeType === 'image/gif') {
      return false;
    }
    return (
      asset.kind === 'avatar' ||
      asset.kind === 'chat_attachment' ||
      asset.kind === 'story_media' ||
      asset.kind === 'event_cover'
    );
  }

  private isPublicMediaAsset(asset: { kind: string }) {
    return asset.kind === 'avatar' || asset.kind === 'event_cover';
  }

  private hasAllProfileImageVariants(raw: unknown) {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
      return false;
    }
    const variants = raw as Record<string, unknown>;
    return PROFILE_IMAGE_VARIANT_SPECS.every((spec) => {
      const value = variants[spec.key];
      return value != null && typeof value === 'object' && !Array.isArray(value);
    });
  }

  private hasAllPublicCardImageVariants(raw: unknown) {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
      return false;
    }
    const variants = raw as Record<string, unknown>;
    return ['thumb', 'card', 'hero', 'fullscreen'].every((key) => {
      const value = variants[key];
      return value != null && typeof value === 'object' && !Array.isArray(value);
    });
  }

  private toPrivateMediaVariants(
    assetId: string,
    variants: Record<string, Record<string, unknown>>,
  ) {
    return Object.fromEntries(
      Object.entries(variants).map(([key, variant]) => {
        const url = `${buildMediaProxyPath(assetId)}/variants/${key}`;
        return [
          key,
          {
            ...variant,
            url,
            downloadUrl: null,
            downloadUrlPath: `${url}/download-url`,
          },
        ];
      }),
    );
  }

  private async handlePushDispatch(payload: { userId: string; notificationId: string }) {
    const notification = await this.prismaService.client.notification.findUnique({
      where: { id: payload.notificationId },
      select: {
        id: true,
        userId: true,
        actorUserId: true,
        title: true,
        body: true,
      },
    });

    if (!notification) {
      return;
    }

    const userId = notification.userId;
    if (
      typeof notification.actorUserId === 'string' &&
      notification.actorUserId.length > 0 &&
      (await this.isUserHidden(userId, notification.actorUserId))
    ) {
      return;
    }

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
      select: {
        provider: true,
        token: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: this.pushTokenBatchSize,
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

  private async handleMessageNotificationFanout(payload: {
    chatId?: string;
    actorUserId?: string;
    messageId?: string;
    cursor?: string;
  }) {
    if (
      typeof payload.chatId !== 'string' ||
      typeof payload.actorUserId !== 'string' ||
      typeof payload.messageId !== 'string'
    ) {
      return;
    }

    const message = await this.prismaService.client.message.findUnique({
      where: { id: payload.messageId },
      select: {
        id: true,
        chatId: true,
        senderId: true,
        text: true,
        attachments: {
          select: {
            id: true,
          },
          take: 1,
        },
        sender: {
          select: {
            displayName: true,
          },
        },
        chat: {
          select: {
            kind: true,
            title: true,
          },
        },
      },
    });

    if (
      !message ||
      message.chatId !== payload.chatId ||
      message.senderId !== payload.actorUserId
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

    if (hasMore && page.length > 0) {
      await this.prismaService.client.outboxEvent.create({
        data: {
          type: OUTBOX_EVENT_TYPES.messageNotificationFanout,
          payload: {
            chatId: payload.chatId,
            actorUserId: payload.actorUserId,
            messageId: payload.messageId,
            cursor: page[page.length - 1]!.id,
          },
        },
      });
    }

    const recipientIds = await this.filterPushAllowedRecipients(
      page.map((member) => member.userId),
      payload.actorUserId,
    );
    if (recipientIds.length === 0) {
      return;
    }

    const tokens = await this.prismaService.client.pushToken.findMany({
      where: {
        userId: {
          in: recipientIds,
        },
        disabledAt: null,
      },
      select: {
        userId: true,
        provider: true,
        token: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: this.pushTokenBatchSize * recipientIds.length,
    });
    const data = {
      type: 'chat_message',
      chatId: payload.chatId,
      messageId: payload.messageId,
      kind: String(message.chat.kind),
    };
    const title = this.chatPushTitle(
      message.sender.displayName,
      message.chat.title,
    );
    const body = this.chatPushBody(message.text);

    await this.runWithConcurrency(tokens, this.pushConcurrency, async (token) => {
      const provider = this.resolveProvider(token.provider);
      await provider.send({
        token: token.token,
        title,
        body,
        data,
      });
    });
  }

  private async filterPushAllowedRecipients(
    userIds: string[],
    actorUserId: string,
  ) {
    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length === 0) {
      return [];
    }

    const settingsRows = await this.prismaService.client.userSettings.findMany({
      where: {
        userId: {
          in: uniqueUserIds,
        },
      },
      select: {
        userId: true,
        allowPush: true,
        quietHours: true,
      },
    });
    const settingsByUserId = new Map(
      settingsRows.map((settings) => [settings.userId, settings]),
    );
    const allowed: string[] = [];

    for (const userId of uniqueUserIds) {
      const settings = settingsByUserId.get(userId);
      if (settings?.allowPush === false || settings?.quietHours === true) {
        continue;
      }
      if (await this.isUserHidden(userId, actorUserId)) {
        continue;
      }
      allowed.push(userId);
    }

    return allowed;
  }

  private chatPushTitle(senderDisplayName: string | null, chatTitle: string | null) {
    const sender = oneLine(senderDisplayName);
    if (sender) {
      return sender.slice(0, 80);
    }
    const title = oneLine(chatTitle);
    return title ? title.slice(0, 80) : 'Frendly';
  }

  private chatPushBody(text: string | null) {
    const body = oneLine(text);
    if (!body) {
      return 'Новое сообщение';
    }
    return capWithSuffix(body, 120);
  }

  private async isUserHidden(userId: string, targetUserId: string) {
    const block = await this.prismaService.client.userBlock.findFirst({
      where: {
        OR: [
          {
            userId,
            blockedUserId: targetUserId,
          },
          {
            userId: targetUserId,
            blockedUserId: userId,
          },
        ],
      },
      select: {
        id: true,
      },
    });

    return block != null;
  }

  private async handleNotificationCreate(payload: { notificationId?: string }) {
    if (typeof payload.notificationId !== 'string') {
      return;
    }

    const notification = await this.prismaService.client.notification.findUnique({
      where: { id: payload.notificationId },
      select: {
        id: true,
        userId: true,
        actorUserId: true,
        kind: true,
        title: true,
        body: true,
        payload: true,
        createdAt: true,
        readAt: true,
      },
    });

    if (!notification) {
      return;
    }

    if (
      typeof notification.actorUserId === 'string' &&
      notification.actorUserId.length > 0 &&
      (await this.isUserHidden(notification.userId, notification.actorUserId))
    ) {
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

  async runEveningAutoAdvanceScan(now = new Date()) {
    if (this.eveningAutoAdvanceRunning) {
      return;
    }

    this.eveningAutoAdvanceRunning = true;

    try {
      const sessions = await this.prismaService.client.eveningSession.findMany({
        where: {
          phase: 'live',
          mode: 'auto',
          currentStep: {
            not: null,
          },
          startedAt: {
            not: null,
          },
        },
        select: {
          id: true,
          chatId: true,
          hostUserId: true,
          routeId: true,
          currentStep: true,
          startedAt: true,
          route: {
            select: {
              steps: {
                orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
                select: {
                  id: true,
                  timeLabel: true,
                  endTimeLabel: true,
                  venue: true,
                },
              },
            },
          },
        },
        orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
        take: this.eveningAutoAdvanceBatchSize,
      });

      for (const session of sessions) {
        const transition = this.resolveEveningAutoTransition(session, now);
        if (!transition) {
          continue;
        }
        if (transition.kind === 'finish') {
          await this.finishAutoEveningSession(session, now);
        } else {
          await this.advanceAutoEveningSession(session, transition.stepNumber, now);
        }
      }
    } finally {
      this.eveningAutoAdvanceRunning = false;
    }
  }

  private resolveEveningAutoTransition(session: any, now: Date) {
    const steps = session.route?.steps ?? [];
    const startedAt = session.startedAt;
    if (!(startedAt instanceof Date) || steps.length === 0) {
      return null;
    }

    const currentStep = this.normalizeStepNumber(session.currentStep, steps.length);
    if (currentStep == null) {
      return null;
    }

    const firstStepClock = this.parseEveningClockMinutes(steps[0]?.timeLabel);
    if (firstStepClock == null) {
      return null;
    }

    const lastStep = steps[steps.length - 1]!;
    const lastEndClock = this.parseEveningClockMinutes(
      lastStep.endTimeLabel ?? lastStep.timeLabel,
    );
    if (lastEndClock != null) {
      const finishAt = new Date(
        startedAt.getTime() +
          this.normalizeEveningClockDelta(firstStepClock, lastEndClock),
      );
      if (now >= finishAt) {
        return { kind: 'finish' as const };
      }
    }

    let dueStep = currentStep;
    for (let index = currentStep; index < steps.length; index += 1) {
      const stepClock = this.parseEveningClockMinutes(steps[index]?.timeLabel);
      if (stepClock == null) {
        break;
      }
      const stepStartAt = new Date(
        startedAt.getTime() +
          this.normalizeEveningClockDelta(firstStepClock, stepClock),
      );
      if (now >= stepStartAt) {
        dueStep = index + 1;
      } else {
        break;
      }
    }

    if (dueStep > currentStep) {
      return {
        kind: 'advance' as const,
        stepNumber: dueStep,
      };
    }

    return null;
  }

  private async advanceAutoEveningSession(session: any, stepNumber: number, now: Date) {
    const steps = session.route.steps;
    const currentStep = this.normalizeStepNumber(session.currentStep, steps.length);
    if (currentStep == null || stepNumber <= currentStep || stepNumber > steps.length) {
      return;
    }

    const nextStep = steps[stepNumber - 1]!;
    const finishedStepIds = steps
      .slice(currentStep - 1, stepNumber - 1)
      .map((step: { id: string }) => step.id);

    await this.prismaService.client.$transaction(async (tx) => {
      const updated = await tx.eveningSession.updateMany({
        where: {
          id: session.id,
          phase: 'live',
          mode: 'auto',
          currentStep,
        },
        data: {
          currentStep: stepNumber,
        },
      });
      if (updated.count === 0) {
        return;
      }

      await tx.chat.update({
        where: { id: session.chatId },
        data: {
          currentStep: stepNumber,
        },
      });

      await tx.eveningSessionStepState.updateMany({
        where: {
          sessionId: session.id,
          stepId: {
            in: finishedStepIds,
          },
        },
        data: {
          status: 'done',
          finishedAt: now,
        },
      });

      await tx.eveningSessionStepState.upsert({
        where: {
          sessionId_stepId: {
            sessionId: session.id,
            stepId: nextStep.id,
          },
        },
        create: {
          sessionId: session.id,
          stepId: nextStep.id,
          status: 'current',
          startedAt: now,
        },
        update: {
          status: 'current',
          startedAt: now,
          finishedAt: null,
          skippedAt: null,
        },
      });

      await this.createEveningSystemMessage(tx, {
        chatId: session.chatId,
        senderId: session.hostUserId,
        clientMessageId: `evening-session:${session.id}:auto-step:${nextStep.id}`,
        text: `Авто-шаг · ${stepNumber}/${steps.length} · ${nextStep.venue}`,
        actorUserId: session.hostUserId,
      });
      await this.createEveningChatUpdatedEvent(tx, {
        chatId: session.chatId,
        sessionId: session.id,
        routeId: session.routeId,
        phase: 'live',
        currentStep: stepNumber,
        totalSteps: steps.length,
        currentPlace: nextStep.venue,
        endTime: nextStep.endTimeLabel ?? null,
      });
    });
  }

  private async finishAutoEveningSession(session: any, now: Date) {
    const steps = session.route?.steps ?? [];
    const currentStep = this.normalizeStepNumber(session.currentStep, steps.length);
    if (currentStep == null) {
      return;
    }

    await this.prismaService.client.$transaction(async (tx) => {
      const updated = await tx.eveningSession.updateMany({
        where: {
          id: session.id,
          phase: 'live',
          mode: 'auto',
          currentStep,
        },
        data: {
          phase: 'done',
          endedAt: now,
          currentStep: null,
        },
      });
      if (updated.count === 0) {
        return;
      }

      await tx.chat.update({
        where: { id: session.chatId },
        data: {
          meetupPhase: 'done',
          currentStep: null,
          meetupEndsAt: now,
        },
      });

      const unfinishedStepIds = steps
        .slice(currentStep - 1)
        .map((step: { id: string }) => step.id);
      if (unfinishedStepIds.length > 0) {
        await tx.eveningSessionStepState.updateMany({
          where: {
            sessionId: session.id,
            stepId: {
              in: unfinishedStepIds,
            },
          },
          data: {
            status: 'done',
            finishedAt: now,
          },
        });
      }

      await this.createEveningSystemMessage(tx, {
        chatId: session.chatId,
        senderId: session.hostUserId,
        clientMessageId: `evening-session:${session.id}:auto-finish`,
        text: 'Вечер завершен автоматически',
        actorUserId: session.hostUserId,
      });
      await this.createEveningChatUpdatedEvent(tx, {
        chatId: session.chatId,
        sessionId: session.id,
        routeId: session.routeId,
        phase: 'done',
        currentStep: null,
        totalSteps: steps.length,
        currentPlace: null,
        endTime: now.toISOString(),
      });
    });
  }

  private parseEveningClockMinutes(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }
    const match = value.match(/^(\d{1,2}):(\d{2})/);
    if (!match) {
      return null;
    }
    const hours = Number.parseInt(match[1]!, 10);
    const minutes = Number.parseInt(match[2]!, 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }
    return hours * 60 + minutes;
  }

  private normalizeEveningClockDelta(firstMinutes: number, targetMinutes: number) {
    let delta = targetMinutes - firstMinutes;
    while (delta < 0) {
      delta += 24 * 60;
    }
    return delta * 60_000;
  }

  private normalizeStepNumber(value: unknown, totalSteps: number) {
    if (typeof value !== 'number' || !Number.isFinite(value) || totalSteps <= 0) {
      return null;
    }
    return Math.min(totalSteps, Math.max(1, Math.trunc(value)));
  }

  private async createEveningSystemMessage(
    tx: any,
    params: {
      chatId: string;
      senderId: string;
      clientMessageId: string;
      text: string;
      actorUserId: string;
    },
  ) {
    const existing = await tx.message.findUnique({
      where: {
        chatId_clientMessageId: {
          chatId: params.chatId,
          clientMessageId: params.clientMessageId,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return existing;
    }

    const now = new Date();
    const message = await tx.message.create({
      data: {
        chatId: params.chatId,
        senderId: params.senderId,
        text: params.text,
        clientMessageId: params.clientMessageId,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });
    const createdAt =
      message.createdAt instanceof Date ? message.createdAt : now;
    const payload = {
      id: message.id,
      chatId: params.chatId,
      clientMessageId: params.clientMessageId,
      senderId: params.senderId,
      senderName: 'Frendly',
      senderAvatarUrl: null,
      text: params.text,
      createdAt: createdAt.toISOString(),
      replyTo: null,
      attachments: [],
    };
    const realtimeEvent = await tx.realtimeEvent.create({
      data: {
        chatId: params.chatId,
        eventType: 'message.created',
        payload,
      },
    });

    await tx.outboxEvent.createMany({
      data: [
        {
          type: OUTBOX_EVENT_TYPES.realtimePublish,
          payload: {
            type: 'message.created',
            payload: {
              ...payload,
              eventId: realtimeEvent.id.toString(),
            },
          },
        },
        {
          type: OUTBOX_EVENT_TYPES.chatUnreadFanout,
          payload: {
            chatId: params.chatId,
            actorUserId: params.actorUserId,
          },
        },
      ],
    });

    return message;
  }

  private async createEveningChatUpdatedEvent(
    tx: any,
    payload: {
      chatId: string;
      sessionId: string;
      routeId: string;
      phase: string;
      currentStep: number | null;
      totalSteps: number;
      currentPlace: string | null;
      endTime: string | null;
    },
  ) {
    await tx.outboxEvent.createMany({
      data: [
        {
          type: OUTBOX_EVENT_TYPES.realtimePublish,
          payload: {
            type: 'chat.updated',
            payload,
          },
        },
      ],
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
    messageCreatedAt?: string;
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
            messageCreatedAt: payload.messageCreatedAt,
          },
        },
      });
    }

    const messageCreatedAt = this.parseMessageCreatedAt(payload.messageCreatedAt);
    if (messageCreatedAt != null) {
      await this.incrementUnreadCountsForMessage(
        payload.chatId,
        payload.actorUserId,
        page.map((member) => member.userId),
        messageCreatedAt,
      );
      return;
    }

    await this.publishUnreadCounts(payload.chatId, page.map((member) => member.userId));
  }

  private parseMessageCreatedAt(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private async incrementUnreadCountsForMessage(
    chatId: string,
    actorUserId: string,
    userIds: string[],
    messageCreatedAt: Date,
  ) {
    if (userIds.length === 0) {
      return;
    }

    const uniqueUserIds = [...new Set(userIds)];
    const rows = await this.prismaService.client.$queryRaw<Array<{
      user_id: string;
      unread_count: bigint | number;
    }>>`
      UPDATE "ChatMember" cm
      SET "unreadCount" = cm."unreadCount" + 1
      WHERE cm."chatId" = ${chatId}
        AND cm."userId" IN (${Prisma.join(uniqueUserIds)})
        AND cm."userId" <> ${actorUserId}
        AND (
          cm."lastReadAt" IS NULL
          OR cm."lastReadAt" < ${messageCreatedAt}
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "UserBlock" ub
          WHERE (
            ub."userId" = cm."userId"
            AND ub."blockedUserId" = ${actorUserId}
          )
          OR (
            ub."userId" = ${actorUserId}
            AND ub."blockedUserId" = cm."userId"
          )
        )
      RETURNING cm."userId" AS user_id, cm."unreadCount" AS unread_count
    `;

    await this.runWithConcurrency(
      rows,
      this.busPublishConcurrency,
      async (row) => {
        await publishBusEvent(this.redis, {
          type: 'unread.updated',
          payload: {
            userId: row.user_id,
            chatId,
            unreadCount: Number(row.unread_count),
          },
        });
      },
    );
  }

  private async incrementUnreadCountsForMessages(
    chatId: string,
    actorUserId: string,
    messageCreatedAtValues: Date[],
  ) {
    if (messageCreatedAtValues.length === 0) {
      return;
    }

    const uniqueMessageCreatedAtValues = [
      ...new Map(
        messageCreatedAtValues.map((value) => [value.toISOString(), value]),
      ).values(),
    ];
    const values = uniqueMessageCreatedAtValues.map((createdAt) =>
      Prisma.sql`(${createdAt})`,
    );
    const rows = await this.prismaService.client.$queryRaw<Array<{
      user_id: string;
      unread_count: bigint | number;
    }>>`
      WITH message_events("createdAt") AS (
        VALUES ${Prisma.join(values)}
      ),
      increments AS (
        SELECT cm."userId" AS user_id, COUNT(*)::int AS increment_by
        FROM "ChatMember" cm
        JOIN message_events event
          ON (
            cm."lastReadAt" IS NULL
            OR cm."lastReadAt" < event."createdAt"
          )
        WHERE cm."chatId" = ${chatId}
          AND cm."userId" <> ${actorUserId}
          AND NOT EXISTS (
            SELECT 1
            FROM "UserBlock" ub
            WHERE (
              ub."userId" = cm."userId"
              AND ub."blockedUserId" = ${actorUserId}
            )
            OR (
              ub."userId" = ${actorUserId}
              AND ub."blockedUserId" = cm."userId"
            )
          )
        GROUP BY cm."userId"
      ),
      updated AS (
        UPDATE "ChatMember" cm
        SET "unreadCount" = cm."unreadCount" + increments.increment_by
        FROM increments
        WHERE cm."chatId" = ${chatId}
          AND cm."userId" = increments.user_id
        RETURNING cm."userId" AS user_id, cm."unreadCount" AS unread_count
      )
      SELECT user_id, unread_count
      FROM updated
    `;

    await this.runWithConcurrency(
      rows,
      this.busPublishConcurrency,
      async (row) => {
        await publishBusEvent(this.redis, {
          type: 'unread.updated',
          payload: {
            userId: row.user_id,
            chatId,
            unreadCount: Number(row.unread_count),
          },
        });
      },
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
        AND NOT EXISTS (
          SELECT 1
          FROM "UserBlock" ub
          WHERE (
            ub."userId" = cm."userId"
            AND ub."blockedUserId" = m."senderId"
          )
          OR (
            ub."userId" = m."senderId"
            AND ub."blockedUserId" = cm."userId"
          )
        )
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

    await this.persistUnreadCounts(chatId, uniqueUserIds, unreadByUserId);

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

  private async persistUnreadCounts(
    chatId: string,
    userIds: string[],
    unreadByUserId: Map<string, number>,
  ) {
    if (typeof this.prismaService.client.$executeRaw !== 'function') {
      return;
    }

    const values = userIds.map((userId) =>
      Prisma.sql`(${userId}, ${unreadByUserId.get(userId) ?? 0})`,
    );

    await this.prismaService.client.$executeRaw`
      UPDATE "ChatMember" cm
      SET "unreadCount" = data."unreadCount"
      FROM (VALUES ${Prisma.join(values)}) AS data("userId", "unreadCount")
      WHERE cm."chatId" = ${chatId}
        AND cm."userId" = data."userId"
    `;
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

  private async runRetentionCleanup() {
    if (this.retentionCleanupRunning) {
      return;
    }

    this.retentionCleanupRunning = true;

    try {
      const report = await runRetentionCleanup(this.prismaService.client, {
        batchSize: this.retentionBatchSize,
        onProgress: ({ label, deleted, total }) => {
          console.log(`[retention] ${label} deleted=${deleted} total=${total}`);
        },
      });

      for (const [label, total] of report.deletedByTask) {
        console.log(`[retention] ${label} done total=${total}`);
      }
    } finally {
      this.retentionCleanupRunning = false;
    }
  }

  private async runPendingManualImportScan() {
    if (this.contentManualImportRunning || !this.contentImportService) {
      return;
    }

    this.contentManualImportRunning = true;

    try {
      await this.contentImportService.processPendingManualRuns();
    } finally {
      this.contentManualImportRunning = false;
    }
  }

  private async runContentImportScan() {
    if (this.contentImportRunning || !this.contentImportService) {
      return;
    }

    this.contentImportRunning = true;

    try {
      const { from, to } = this.nextContentImportWeekRange();
      const sources = this.resolveContentSources();
      for (const city of this.resolveContentCities()) {
        if (sources.length > 0) {
          await this.contentImportService.runImport({
            city,
            sources,
            from,
            to,
          });
        }
        if (this.contentImageBackfillEnabled) {
          await this.contentImportService.backfillMirroredImages({
            city,
            limit: this.contentImageBackfillBatchSize,
          });
        }
      }
    } finally {
      this.contentImportRunning = false;
    }
  }

  private async runTicketlandGeocoderBackfillScan() {
    if (
      this.ticketlandGeocoderBackfillRunning ||
      this.contentImportRunning ||
      !this.contentImportService
    ) {
      return;
    }

    this.ticketlandGeocoderBackfillRunning = true;

    try {
      await this.contentImportService.backfillTicketlandCoordinates({
        limit: this.contentGeocoderDailyLimit,
      });
    } finally {
      this.ticketlandGeocoderBackfillRunning = false;
    }
  }

  private nextContentImportWeekRange(now = new Date()) {
    const local = this.localDateParts(now);
    const daysUntilNextMonday = ((8 - local.weekday) % 7) || 7;
    const startLocal = addCalendarDays(local, daysUntilNextMonday);
    const endLocal = addCalendarDays(startLocal, 7);
    return {
      from: zonedDateTimeToUtc(
        this.contentImportTimeZone,
        startLocal.year,
        startLocal.month,
        startLocal.day,
        0,
        0,
      ),
      to: zonedDateTimeToUtc(
        this.contentImportTimeZone,
        endLocal.year,
        endLocal.month,
        endLocal.day,
        0,
        0,
      ),
    };
  }

  private async runPendingManualGenerationScan() {
    if (this.contentManualGenerationRunning || !this.routeDraftGenerationService) {
      return;
    }

    this.contentManualGenerationRunning = true;

    try {
      await this.routeDraftGenerationService.processPendingManualBatches();
    } finally {
      this.contentManualGenerationRunning = false;
    }
  }

  private async runContentRouteGenerationScan() {
    if (this.contentRouteGenerationRunning || !this.routeDraftGenerationService) {
      return;
    }

    this.contentRouteGenerationRunning = true;

    try {
      await this.routeDraftGenerationService.runScheduledGeneration();
    } finally {
      this.contentRouteGenerationRunning = false;
    }
  }

  private resolveContentCities() {
    return csv(process.env.CONTENT_IMPORT_CITIES) ?? CONTENT_IMPORT_CITY_NAMES;
  }

  private resolveContentSources(): ExternalSourceCode[] {
    const requested = csv(process.env.CONTENT_IMPORT_SOURCES) ?? ['kudago', 'advcake_ticketland'];
    const resolved = requested.filter((source): source is ExternalSourceCode =>
      source === 'kudago' ||
      source === 'advcake_ticketland',
    );
    console.debug('[content-import] resolved source list', { requested, resolved });
    return resolved;
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
        select: {
          id: true,
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

  private recordClaimedOutboxCounts(events: ClaimedOutboxEvent[]) {
    const countsByType = new Map<string, number>();
    for (const event of events) {
      countsByType.set(event.type, (countsByType.get(event.type) ?? 0) + 1);
    }

    for (const [eventType, count] of countsByType) {
      appMetrics.workerOutboxPending.set(
        { service: METRICS_SERVICE, event_type: eventType },
        count,
      );
    }
  }

  private recordWorkerJobDuration(jobType: string, status: string, startedAt: bigint) {
    appMetrics.workerJobDurationSeconds.observe(
      { service: METRICS_SERVICE, job_type: jobType, status },
      Number(process.hrtime.bigint() - startedAt) / 1_000_000_000,
    );
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

function csv(raw: string | undefined) {
  if (typeof raw !== 'string') {
    return null;
  }
  const values = raw.split(',').map((item) => item.trim()).filter(Boolean);
  return values.length > 0 ? values : null;
}

function oneLine(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function capWithSuffix(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function weekdayNumber(value: string | undefined) {
  switch (value) {
    case 'Sun':
      return 0;
    case 'Mon':
      return 1;
    case 'Tue':
      return 2;
    case 'Wed':
      return 3;
    case 'Thu':
      return 4;
    case 'Fri':
      return 5;
    case 'Sat':
      return 6;
    default:
      return 0;
  }
}

function addCalendarDays(
  date: { year: number; month: number; day: number },
  days: number,
) {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
    weekday: utc.getUTCDay(),
  };
}

function zonedDateTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = timeZoneOffsetMs(guess, timeZone);
  const first = new Date(guess.getTime() - offset);
  const correctedOffset = timeZoneOffsetMs(first, timeZone);
  return new Date(guess.getTime() - correctedOffset);
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: string) =>
    Number.parseInt(parts.find((part) => part.type === type)?.value ?? '0', 10);
  const localAsUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
  return localAsUtc - date.getTime();
}

async function streamToBuffer(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
