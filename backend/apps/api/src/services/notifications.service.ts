import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { paginateArray } from '../common/pagination';
import { PrismaService } from './prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prismaService: PrismaService) {}

  async listNotifications(userId: string, params: { cursor?: string; limit?: number }) {
    const notifications = await this.prismaService.client.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const visibleNotifications = await this.filterVisibleNotifications(userId, notifications);

    const mapped = visibleNotifications.map((notification) => ({
      id: notification.id,
      kind: notification.kind,
      title: notification.title,
      body: notification.body,
      payload: notification.payload,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
    }));

    return paginateArray(mapped, params.limit ?? 20, (item) => item.id, params.cursor);
  }

  async getUnreadCount(userId: string) {
    const notifications = await this.prismaService.client.notification.findMany({
      where: {
        userId,
        readAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    const visibleNotifications = await this.filterVisibleNotifications(userId, notifications);

    return { unreadCount: visibleNotifications.length };
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

  private async filterVisibleNotifications(
    userId: string,
    notifications: Array<{
      id: string;
      kind: string;
      title: string;
      body: string;
      payload: unknown;
      readAt: Date | null;
      createdAt: Date;
    }>,
  ) {
    if (notifications.length === 0) {
      return notifications;
    }

    const blockedUserIds = await this.getBlockedUserIds(userId);
    if (blockedUserIds.size === 0) {
      return notifications;
    }

    const chatIds = new Set<string>();
    const eventIds = new Set<string>();
    const messageIds = new Set<string>();
    const requestIds = new Set<string>();

    for (const notification of notifications) {
      const payload = this.asPayloadMap(notification.payload);
      if (typeof payload?.chatId === 'string') {
        chatIds.add(payload.chatId);
      }
      if (typeof payload?.eventId === 'string') {
        eventIds.add(payload.eventId);
      }
      if (typeof payload?.messageId === 'string') {
        messageIds.add(payload.messageId);
      }
      if (typeof payload?.requestId === 'string') {
        requestIds.add(payload.requestId);
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
      const payload = this.asPayloadMap(notification.payload);
      const chatId = typeof payload?.chatId === 'string' ? payload.chatId : null;
      const eventId = typeof payload?.eventId === 'string' ? payload.eventId : null;
      const messageId = typeof payload?.messageId === 'string' ? payload.messageId : null;
      const requestId = typeof payload?.requestId === 'string' ? payload.requestId : null;

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

  private asPayloadMap(payload: unknown) {
    if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    return payload as Record<string, unknown>;
  }
}
