import { Injectable, Optional } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import {
  decodeCursor,
  encodeCursor,
  getBlockedUserIds as loadBlockedUserIds,
} from '@big-break/database';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { RedisCacheService } from './redis-cache.service';

interface NotificationCursor {
  id: string;
  createdAt: Date;
}

const NOTIFICATION_LIST_CACHE_SECONDS = 5;

@Injectable()
export class NotificationsService {
  private readonly pendingListLoads = new Map<string, Promise<any>>();
  private readonly pendingUnreadCountLoads = new Map<
    string,
    Promise<{ unreadCount: number }>
  >();
  private readonly listMemoryCache = new Map<
    string,
    { expiresAt: number; value: unknown }
  >();

  constructor(
    private readonly prismaService: PrismaService,
    @Optional() private readonly redisCache?: RedisCacheService,
  ) {}

  async listNotifications(userId: string, params: { cursor?: string; limit?: number }) {
    const cacheKey = this.listCacheKey(userId, params);
    const cached = this.getMemoryCachedList(cacheKey);
    if (cached != null) {
      return cached;
    }
    const pending = this.pendingListLoads.get(cacheKey);
    if (pending != null) {
      return pending;
    }
    const loading = this.loadFreshNotifications(userId, params)
      .then((response) => {
        this.setMemoryCachedList(cacheKey, response);
        return response;
      })
      .finally(() => {
        this.pendingListLoads.delete(cacheKey);
      });
    this.pendingListLoads.set(cacheKey, loading);
    return loading;
  }

  private async loadFreshNotifications(
    userId: string,
    params: { cursor?: string; limit?: number },
  ) {
    const blockedUserIds = await this.getBlockedUserIds(userId);
    const take = this.normalizeLimit(params.limit);
    const cursorNotification = await this.resolveNotificationCursor(userId, params.cursor);
    const visibleNotifications = await this.collectVisibleNotificationsPage(
      userId,
      blockedUserIds,
      take,
      cursorNotification,
    );

    const hasMore = visibleNotifications.length > take;
    const page = hasMore
      ? visibleNotifications.slice(0, take)
      : visibleNotifications;
    const mapped = page.map((notification) => ({
      id: notification.id,
      kind: notification.kind,
      title: notification.title,
      body: notification.body,
      payload: notification.payload,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
    }));

    return {
      items: mapped,
      nextCursor:
          hasMore && page.length > 0
              ? this.encodeNotificationCursor(page[page.length - 1]!)
              : null,
    };
  }

  private listCacheKey(
    userId: string,
    params: { cursor?: string; limit?: number },
  ) {
    return [
      'notifications',
      'list',
      'v1',
      userId,
      params.cursor ?? '',
      this.normalizeLimit(params.limit),
    ].join(':');
  }

  private getMemoryCachedList(cacheKey: string) {
    const entry = this.listMemoryCache.get(cacheKey);
    if (entry == null) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.listMemoryCache.delete(cacheKey);
      return null;
    }
    return entry.value;
  }

  private setMemoryCachedList(cacheKey: string, value: unknown) {
    this.listMemoryCache.set(cacheKey, {
      expiresAt: Date.now() + NOTIFICATION_LIST_CACHE_SECONDS * 1000,
      value,
    });
  }

  private clearListCache() {
    this.pendingListLoads.clear();
    this.listMemoryCache.clear();
  }

  async getUnreadCount(userId: string) {
    const cacheKey = this.unreadCountCacheKey(userId);
    const cached = await this.loadCachedUnreadCount(cacheKey);
    if (cached != null) {
      return cached;
    }

    const pending = this.pendingUnreadCountLoads.get(cacheKey);
    if (pending != null) {
      return pending;
    }

    const loading = this.loadFreshUnreadCount(userId)
      .then(async (response) => {
        await this.storeCachedUnreadCount(cacheKey, response);
        return response;
      })
      .finally(() => {
        this.pendingUnreadCountLoads.delete(cacheKey);
      });
    this.pendingUnreadCountLoads.set(cacheKey, loading);

    return loading;
  }

  private async loadFreshUnreadCount(userId: string) {
    const blockedUserIds = await this.getBlockedUserIds(userId);
    if (blockedUserIds.size === 0) {
      const unreadCount = await this.prismaService.client.notification.count({
        where: {
          userId,
          readAt: null,
          kind: {
            not: 'message',
          },
        },
      });

      return { unreadCount };
    }

    const rows = await this.prismaService.client.$queryRaw<Array<{ unread_count: bigint | number }>>`
      SELECT COUNT(*) AS unread_count
      FROM "Notification" n
      LEFT JOIN "Event" e ON e."id" = n."eventId"
      LEFT JOIN "Message" m ON m."id" = n."messageId"
      LEFT JOIN "EventJoinRequest" r ON r."id" = n."requestId"
      WHERE n."userId" = ${userId}
        AND n."readAt" IS NULL
        AND n."kind" <> 'message'::"NotificationKind"
        ${this.buildBlockedNotificationVisibilitySql(userId, blockedUserIds)}
    `;
    const unreadCount = Number(rows[0]?.unread_count ?? 0);

    return { unreadCount };
  }

  private async loadCachedUnreadCount(
    cacheKey: string,
  ): Promise<{ unreadCount: number } | null> {
    try {
      const cached = await this.redisCache?.getJson<{ unreadCount: number }>(
        cacheKey,
      );
      if (
        cached != null &&
        typeof cached.unreadCount === 'number' &&
        Number.isFinite(cached.unreadCount)
      ) {
        return cached;
      }
    } catch {
      return null;
    }

    return null;
  }

  private async storeCachedUnreadCount(
    cacheKey: string,
    response: { unreadCount: number },
  ): Promise<void> {
    try {
      await this.redisCache?.setJson(cacheKey, response, 5);
    } catch {
      return;
    }
  }

  private async clearUnreadCountCache(userId: string): Promise<void> {
    try {
      await this.redisCache?.delete(this.unreadCountCacheKey(userId));
    } catch {
      return;
    }
  }

  private unreadCountCacheKey(userId: string) {
    return `notifications:unread-count:v1:${userId}`;
  }

  async markRead(userId: string, notificationId: string) {
    const result = await this.prismaService.client.notification.updateMany({
      where: {
        id: notificationId,
        userId,
        readAt: null,
        kind: {
          not: 'message',
        },
      },
      data: {
        readAt: new Date(),
      },
    });

    if (result.count > 0) {
      await this.clearUnreadCountCache(userId);
      this.clearListCache();
      return {
        ok: true,
        notificationId,
        alreadyRead: false,
      };
    }

    const notification = await this.prismaService.client.notification.findUnique({
      where: { id: notificationId },
      select: {
        id: true,
        userId: true,
        kind: true,
        readAt: true,
      },
    });

    if (!notification || notification.userId !== userId || notification.kind === 'message') {
      throw new ApiError(404, 'notification_not_found', 'Notification not found');
    }

    return {
      ok: true,
      notificationId,
      alreadyRead: true,
    };
  }

  async markAllRead(userId: string) {
    const result = await this.prismaService.client.notification.updateMany({
      where: {
        userId,
        readAt: null,
        kind: {
          not: 'message',
        },
      },
      data: {
        readAt: new Date(),
      },
    });
    await this.clearUnreadCountCache(userId);
    this.clearListCache();

    return {
      ok: true,
      updatedCount: result.count,
    };
  }

  async registerPushToken(userId: string, body: Record<string, unknown>) {
    const token = this.optionalTrimmedString(body.token);
    const provider = body.provider === 'apns' ? 'apns' : 'fcm';
    const deviceId = this.optionalTrimmedString(body.deviceId);
    const platform = this.optionalTrimmedString(body.platform);

    if (!token) {
      throw new ApiError(400, 'invalid_push_token', 'token is required');
    }

    return this.writePushTokenWithDeviceCleanup({
      userId,
      token,
      provider,
      deviceId: deviceId ?? null,
      platform: platform ?? null,
      retryOnDeviceRace: true,
    });
  }

  private async writePushTokenWithDeviceCleanup(input: {
    userId: string;
    token: string;
    provider: 'apns' | 'fcm';
    deviceId: string | null;
    platform: string | null;
    retryOnDeviceRace: boolean;
  }): Promise<unknown> {
    try {
      return await this.writePushTokenOnce(input);
    } catch (error) {
      if (!input.retryOnDeviceRace || !this.isUniqueConflict(error)) {
        throw error;
      }

      return this.writePushTokenWithDeviceCleanup({
        ...input,
        retryOnDeviceRace: false,
      });
    }
  }

  private async writePushTokenOnce(input: {
    userId: string;
    token: string;
    provider: 'apns' | 'fcm';
    deviceId: string | null;
    platform: string | null;
  }) {
    const client = this.prismaService.client;
    if (input.deviceId) {
      await client.pushToken.deleteMany({
        where: {
          userId: input.userId,
          deviceId: input.deviceId,
          token: {
            not: input.token,
          },
        },
      });
    }

    return client.pushToken.upsert({
      where: { token: input.token },
      update: {
        userId: input.userId,
        provider: input.provider,
        deviceId: input.deviceId,
        platform: input.platform,
        disabledAt: null,
      },
      create: {
        userId: input.userId,
        token: input.token,
        provider: input.provider,
        deviceId: input.deviceId,
        platform: input.platform,
      },
    });
  }

  private isUniqueConflict(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) || (
      typeof error === 'object' &&
      error != null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }

  async deletePushToken(userId: string, tokenId: string) {
    const token = await this.prismaService.client.pushToken.findUnique({
      where: { id: tokenId },
      select: {
        userId: true,
      },
    });

    if (!token || token.userId !== userId) {
      throw new ApiError(404, 'push_token_not_found', 'Push token not found');
    }

    await this.prismaService.client.pushToken.delete({
      where: { id: tokenId },
    });

    return { ok: true };
  }

  async deletePushTokenByDeviceId(userId: string, deviceId: string) {
    const normalizedDeviceId = deviceId.trim();
    if (normalizedDeviceId.length === 0) {
      throw new ApiError(400, 'invalid_push_device', 'deviceId is required');
    }

    const result = await this.prismaService.client.pushToken.deleteMany({
      where: {
        userId,
        deviceId: normalizedDeviceId,
      },
    });

    return { ok: true, deletedCount: result.count };
  }

  private async collectVisibleNotificationsPage(
    userId: string,
    blockedUserIds: Set<string>,
    take: number,
    cursorNotification: NotificationCursor | null,
  ) {
    if (blockedUserIds.size > 0) {
      return this.collectVisibleNotificationsPageBySql(
        userId,
        blockedUserIds,
        take,
        cursorNotification,
      );
    }

    return this.prismaService.client.notification.findMany({
      where: {
        userId,
        kind: {
          not: 'message',
        },
        ...(cursorNotification
          ? {
              OR: [
                {
                  createdAt: {
                    lt: cursorNotification.createdAt,
                  },
                },
                {
                  createdAt: cursorNotification.createdAt,
                  id: {
                    lt: cursorNotification.id,
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        kind: true,
        title: true,
        body: true,
        payload: true,
        readAt: true,
        createdAt: true,
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: take + 1,
    });
  }

  private async collectVisibleNotificationsPageBySql(
    userId: string,
    blockedUserIds: Set<string>,
    take: number,
    cursorNotification: NotificationCursor | null,
  ) {
    const cursorFilter = cursorNotification
      ? Prisma.sql`
        AND (
          n."createdAt" < ${cursorNotification.createdAt}
          OR (
            n."createdAt" = ${cursorNotification.createdAt}
            AND n."id" < ${cursorNotification.id}
          )
        )
      `
      : Prisma.empty;

    return this.prismaService.client.$queryRaw<Array<{
      id: string;
      actorUserId: string | null;
      chatId: string | null;
      messageId: string | null;
      eventId: string | null;
      requestId: string | null;
      kind: string;
      title: string;
      body: string;
      payload: unknown;
      readAt: Date | null;
      createdAt: Date;
    }>>`
      SELECT
        n."id",
        n."actorUserId" AS "actorUserId",
        n."chatId" AS "chatId",
        n."messageId" AS "messageId",
        n."eventId" AS "eventId",
        n."requestId" AS "requestId",
        n."kind",
        n."title",
        n."body",
        n."payload",
        n."readAt" AS "readAt",
        n."createdAt" AS "createdAt"
      FROM "Notification" n
      LEFT JOIN "Event" e ON e."id" = n."eventId"
      LEFT JOIN "Message" m ON m."id" = n."messageId"
      LEFT JOIN "EventJoinRequest" r ON r."id" = n."requestId"
      WHERE n."userId" = ${userId}
        AND n."kind" <> 'message'::"NotificationKind"
        ${cursorFilter}
        ${this.buildBlockedNotificationVisibilitySql(userId, blockedUserIds)}
      ORDER BY n."createdAt" DESC, n."id" DESC
      LIMIT ${take + 1}
    `;
  }

  private buildBlockedNotificationVisibilitySql(
    userId: string,
    blockedUserIds: Set<string>,
  ) {
    const blockedList = Prisma.join([...blockedUserIds]);
    return Prisma.sql`
      AND (
        (
          n."actorUserId" IS NOT NULL
          AND n."actorUserId" NOT IN (${blockedList})
        )
        OR (
          n."actorUserId" IS NULL
          AND (n."eventId" IS NULL OR e."hostId" IS NULL OR e."hostId" NOT IN (${blockedList}))
          AND (n."messageId" IS NULL OR m."senderId" IS NULL OR m."senderId" NOT IN (${blockedList}))
          AND (n."requestId" IS NULL OR r."userId" IS NULL OR r."userId" NOT IN (${blockedList}))
          AND NOT EXISTS (
            SELECT 1
            FROM "Chat" c
            JOIN "ChatMember" cm ON cm."chatId" = c."id"
            WHERE c."id" = n."chatId"
              AND c."kind" = 'direct'::"ChatKind"
              AND cm."userId" <> ${userId}
              AND cm."userId" IN (${blockedList})
          )
        )
      )
    `;
  }

  private async getBlockedUserIds(userId: string) {
    return loadBlockedUserIds(this.prismaService.client, userId);
  }

  private normalizeLimit(limit?: number) {
    if (limit == null || !Number.isFinite(limit)) {
      return 20;
    }

    return Math.max(1, Math.min(Math.trunc(limit), 100));
  }

  private async resolveNotificationCursor(
    userId: string,
    cursor?: string,
  ): Promise<NotificationCursor | null> {
    if (!cursor) {
      return null;
    }

    let decoded: ReturnType<typeof decodeCursor> = null;
    let cursorId: string | null = null;
    try {
      decoded = decodeCursor(cursor);
      cursorId = decoded?.value ?? null;
    } catch {
      cursorId = cursor;
    }

    if (!cursorId) {
      return null;
    }

    const createdAt = this.parseCursorDate(decoded?.createdAt);
    if (createdAt) {
      return {
        id: cursorId,
        createdAt,
      };
    }

    return this.prismaService.client.notification.findFirst({
      where: {
        id: cursorId,
        userId,
        kind: {
          not: 'message',
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
    });
  }

  private encodeNotificationCursor(notification: NotificationCursor) {
    return encodeCursor({
      value: notification.id,
      createdAt: notification.createdAt.toISOString(),
    });
  }

  private parseCursorDate(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }

    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  private optionalTrimmedString(value: unknown) {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
}
