import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { NotificationsService } from '../services/notifications.service';

@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('notifications')
  getNotifications(
    @CurrentUser() currentUser: { userId: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.listNotifications(currentUser.userId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('notifications/unread-count')
  getUnreadCount(@CurrentUser() currentUser: { userId: string }) {
    return this.notificationsService.getUnreadCount(currentUser.userId);
  }

  @Post('notifications/:notificationId/read')
  markRead(
    @CurrentUser() currentUser: { userId: string },
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markRead(currentUser.userId, notificationId);
  }

  @Post('notifications/read-all')
  markAllRead(@CurrentUser() currentUser: { userId: string }) {
    return this.notificationsService.markAllRead(currentUser.userId);
  }

  @Post('push-tokens')
  registerPushToken(@CurrentUser() currentUser: { userId: string }, @Body() body: Record<string, unknown>) {
    return this.notificationsService.registerPushToken(currentUser.userId, body);
  }

  @Delete('push-tokens/device/:deviceId')
  deletePushTokenByDeviceId(
    @CurrentUser() currentUser: { userId: string },
    @Param('deviceId') deviceId: string,
  ) {
    return this.notificationsService.deletePushTokenByDeviceId(currentUser.userId, deviceId);
  }

  @Delete('push-tokens/:tokenId')
  deletePushToken(@CurrentUser() currentUser: { userId: string }, @Param('tokenId') tokenId: string) {
    return this.notificationsService.deletePushToken(currentUser.userId, tokenId);
  }
}
