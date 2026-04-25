import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { decodeCursor, encodeCursor } from '@big-break/database';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prismaService: PrismaService) {}

  async listNotifications(userId: string, params: { cursor?: string; limit?: number }) {
    const blockedUserIds = await this.getBlockedUserIds(userId);
    const take = this.normalizeLimit(params.limit);
    const cursorId = this.decodeNotificationCursor(params.cursor);
    const cursorNotification = cursorId
      ? await this.prismaService.client.notification.findFirst({
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
        })
      : null;
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
              ? encodeCursor({ value: page[page.length - 1]!.id })
              : null,
    };
  }

  async getUnreadCount(userId: string) {
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

    const blockedIds = [...blockedUserIds];
    const blockedList = Prisma.join(blockedIds);
    const rows = await this.prismaService.client.$queryRaw<Array<{ unread_count: bigint | number }>>`
      SELECT COUNT(*) AS unread_count
      FROM "Notification" n
      LEFT JOIN "Event" e ON e."id" = n."eventId"
      LEFT JOIN "Message" m ON m."id" = n."messageId"
      LEFT JOIN "EventJoinRequest" r ON r."id" = n."requestId"
      WHERE n."userId" = ${userId}
        AND n."readAt" IS NULL
        AND n."kind" <> 'message'::"NotificationKind"
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
    const unreadCount = Number(rows[0]?.unread_count ?? 0);

    return { unreadCount };
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prismaService.client.notification.findUnique({
      where: { id: notificationId },
      select: {
        id: true,
        userId: true,
        readAt: true,
      },
    });

    if (!notification || notification.userId !== userId) {
      throw new ApiError(404, 'notification_not_found', 'Notification not found');
    }

    if (notification.readAt != null) {
      return {
        ok: true,
        notificationId,
        alreadyRead: true,
      };
    }

    await this.prismaService.client.notification.update({
      where: { id: notificationId },
      data: {
        readAt: new Date(),
      },
    });

    return {
      ok: true,
      notificationId,
      alreadyRead: false,
    };
  }

  async markAllRead(userId: string) {
    const result = await this.prismaService.client.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return {
      ok: true,
      updatedCount: result.count,
    };
  }

  async registerPushToken(userId: string, body: Record<string, unknown>) {
    const token = typeof body.token === 'string' ? body.token : undefined;
    const provider = body.provider === 'apns' ? 'apns' : 'fcm';

    if (!token) {
      throw new ApiError(400, 'invalid_push_token', 'token is required');
    }

    return this.prismaService.client.pushToken.upsert({
      where: { token },
      update: {
        userId,
        provider,
        deviceId: typeof body.deviceId === 'string' ? body.deviceId : undefined,
        platform: typeof body.platform === 'string' ? body.platform : undefined,
        disabledAt: null,
      },
      create: {
        userId,
        token,
        provider,
        deviceId: typeof body.deviceId === 'string' ? body.deviceId : undefined,
        platform: typeof body.platform === 'string' ? body.platform : undefined,
      },
    });
  }

  async deletePushToken(userId: string, tokenId: string) {
    const token = await this.prismaService.client.pushToken.findUnique({
      where: { id: tokenId },
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
    if (deviceId.trim().length === 0) {
      throw new ApiError(400, 'invalid_push_device', 'deviceId is required');
    }

    const result = await this.prismaService.client.pushToken.deleteMany({
      where: {
        userId,
        deviceId,
      },
    });

    return { ok: true, deletedCount: result.count };
  }

  private async collectVisibleNotificationsPage(
    userId: string,
    blockedUserIds: Set<string>,
    take: number,
    cursorNotification:
      | {
          id: string;
          createdAt: Date;
        }
      | null,
  ) {
    const collected: Array<{
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
    }> = [];
    let boundary = cursorNotification;
    const batchSize = Math.max(take + 1, 50);

    while (collected.length < take + 1) {
      const notifications = await this.prismaService.client.notification.findMany({
        where: {
          userId,
          kind: {
            not: 'message',
          },
          ...this.buildActorVisibilityWhere(blockedUserIds),
          ...(boundary
            ? {
                OR: [
                  {
                    createdAt: {
                      lt: boundary.createdAt,
                    },
                  },
                  {
                    createdAt: boundary.createdAt,
                    id: {
                      lt: boundary.id,
                    },
                  },
                ],
              }
            : {}),
        },
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        take: batchSize,
      });

      if (notifications.length === 0) {
        break;
      }

      const visibleBatch = await this.filterVisibleNotifications(
        userId,
        notifications,
        blockedUserIds,
      );
      collected.push(...visibleBatch);

      if (notifications.length < batchSize) {
        break;
      }

      const tail = notifications[notifications.length - 1]!;
      boundary = {
        id: tail.id,
        createdAt: tail.createdAt,
      };
    }

    return collected;
  }

  private async filterVisibleNotifications<T extends {
    id: string;
    actorUserId: string | null;
    chatId: string | null;
    messageId: string | null;
    eventId: string | null;
    requestId: string | null;
    readAt: Date | null;
    createdAt: Date;
  }>(
    userId: string,
    notifications: T[],
    blockedUserIds: Set<string>,
  ) {
    if (notifications.length === 0) {
      return notifications;
    }

    if (blockedUserIds.size === 0) {
      return notifications;
    }

    const notificationsWithoutActor = notifications.filter(
      (notification) => notification.actorUserId == null,
    );
    if (notificationsWithoutActor.length === 0) {
      return notifications.filter(
        (notification) =>
          notification.actorUserId == null ||
          !blockedUserIds.has(notification.actorUserId),
      );
    }

    const chatIds = new Set<string>();
    const eventIds = new Set<string>();
    const messageIds = new Set<string>();
    const requestIds = new Set<string>();

    for (const notification of notificationsWithoutActor) {
      if (notification.chatId != null) {
        chatIds.add(notification.chatId);
      }
      if (notification.eventId != null) {
        eventIds.add(notification.eventId);
      }
      if (notification.messageId != null) {
        messageIds.add(notification.messageId);
      }
      if (notification.requestId != null) {
        requestIds.add(notification.requestId);
      }
    }

    const [chats, events, messages, requests] = await Promise.all([
      chatIds.size === 0
        ? []
        : this.prismaService.client.chat.findMany({
            where: { id: { in: [...chatIds] } },
            include: {
              members: {
                select: {
                  userId: true,
                },
              },
            },
          }),
      eventIds.size === 0
        ? []
        : this.prismaService.client.event.findMany({
            where: { id: { in: [...eventIds] } },
            select: {
              id: true,
              hostId: true,
            },
          }),
      messageIds.size === 0
        ? []
        : this.prismaService.client.message.findMany({
            where: { id: { in: [...messageIds] } },
            select: {
              id: true,
              senderId: true,
            },
          }),
      requestIds.size === 0
        ? []
        : this.prismaService.client.eventJoinRequest.findMany({
            where: { id: { in: [...requestIds] } },
            select: {
              id: true,
              userId: true,
            },
          }),
    ]);

    const hiddenChatIds = new Set(
      chats
        .filter((chat) => {
          if (chat.kind !== 'direct') {
            return false;
          }
          return chat.members.some(
            (member) => member.userId !== userId && blockedUserIds.has(member.userId),
          );
        })
        .map((chat) => chat.id),
    );

    const hiddenEventIds = new Set(
      events
        .filter((event) => blockedUserIds.has(event.hostId))
        .map((event) => event.id),
    );

    const hiddenMessageIds = new Set(
      messages
        .filter((message) => blockedUserIds.has(message.senderId))
        .map((message) => message.id),
    );

    const hiddenRequestIds = new Set(
      requests
        .filter((request) => blockedUserIds.has(request.userId))
        .map((request) => request.id),
    );

    return notifications.filter((notification) => {
      if (notification.actorUserId != null) {
        return !blockedUserIds.has(notification.actorUserId);
      }

      const chatId = notification.chatId;
      const eventId = notification.eventId;
      const messageId = notification.messageId;
      const requestId = notification.requestId;

      if (chatId != null && hiddenChatIds.has(chatId)) {
        return false;
      }

      if (eventId != null && hiddenEventIds.has(eventId)) {
        return false;
      }

      if (messageId != null && hiddenMessageIds.has(messageId)) {
        return false;
      }

      if (requestId != null && hiddenRequestIds.has(requestId)) {
        return false;
      }

      return true;
    });
  }

  private async getBlockedUserIds(userId: string) {
    const blocks = await this.prismaService.client.userBlock.findMany({
      where: {
        OR: [
          { userId },
          { blockedUserId: userId },
        ],
      },
      select: {
        userId: true,
        blockedUserId: true,
      },
    });

    const blockedUserIds = new Set<string>();
    for (const block of blocks) {
      if (block.userId === userId) {
        blockedUserIds.add(block.blockedUserId);
      }
      if (block.blockedUserId === userId) {
        blockedUserIds.add(block.userId);
      }
    }

    return blockedUserIds;
  }

  private buildActorVisibilityWhere(blockedUserIds: Set<string>) {
    if (blockedUserIds.size === 0) {
      return {};
    }

    return {
      OR: [
        { actorUserId: null },
        {
          actorUserId: {
            notIn: [...blockedUserIds],
          },
        },
      ],
    };
  }

  private normalizeLimit(limit?: number) {
    if (limit == null || !Number.isFinite(limit)) {
      return 20;
    }

    return Math.max(1, Math.min(Math.trunc(limit), 100));
  }

  private decodeNotificationCursor(cursor?: string) {
    if (!cursor) {
      return null;
    }

    try {
      return decodeCursor(cursor)?.value ?? null;
    } catch {
      return cursor;
    }
  }
}
