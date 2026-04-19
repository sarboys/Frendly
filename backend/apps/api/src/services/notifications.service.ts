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

    const mapped = notifications.map((notification) => ({
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
    const unreadCount = await this.prismaService.client.notification.count({
      where: {
        userId,
        readAt: null,
      },
    });

    return { unreadCount };
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
}
