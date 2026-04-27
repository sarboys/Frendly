import { NotificationsService } from '../../src/services/notifications.service';

describe('NotificationsService unit', () => {
  it('lists visible notifications with blocked users through one SQL page query', async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      {
        id: 'notification-1',
        actorUserId: null,
        chatId: 'chat-1',
        messageId: null,
        eventId: null,
        requestId: null,
        kind: 'event_invite',
        title: 'Title',
        body: 'Body',
        payload: { chatId: 'chat-1' },
        readAt: null,
        createdAt: new Date('2026-04-24T10:00:00.000Z'),
      },
    ]);
    const client = {
      userBlock: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'user-me',
            blockedUserId: 'blocked-user',
          },
        ]),
      },
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      chat: {
        findMany: jest.fn(),
      },
      event: {
        findMany: jest.fn(),
      },
      message: {
        findMany: jest.fn(),
      },
      eventJoinRequest: {
        findMany: jest.fn(),
      },
      $queryRaw: queryRaw,
    };
    const service = new NotificationsService({ client } as any);

    await expect(
      service.listNotifications('user-me', { limit: 20 }),
    ).resolves.toEqual({
      items: [
        {
          id: 'notification-1',
          kind: 'event_invite',
          title: 'Title',
          body: 'Body',
          payload: { chatId: 'chat-1' },
          readAt: null,
          createdAt: '2026-04-24T10:00:00.000Z',
        },
      ],
      nextCursor: null,
    });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(client.notification.findMany).not.toHaveBeenCalled();
    expect(client.chat.findMany).not.toHaveBeenCalled();
    expect(client.event.findMany).not.toHaveBeenCalled();
    expect(client.message.findMany).not.toHaveBeenCalled();
    expect(client.eventJoinRequest.findMany).not.toHaveBeenCalled();
  });

  it('counts unread notifications with blocked users through one SQL query', async () => {
    const client = {
      userBlock: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'user-me',
            blockedUserId: 'blocked-user',
          },
        ]),
      },
      notification: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ unread_count: BigInt(3) }]),
    };
    const service = new NotificationsService({ client } as any);

    await expect(service.getUnreadCount('user-me')).resolves.toEqual({
      unreadCount: 3,
    });

    expect(client.notification.count).not.toHaveBeenCalled();
    expect(client.notification.findMany).not.toHaveBeenCalled();
    expect(client.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('does not count chat message notifications as central unread notifications', async () => {
    const count = jest.fn().mockResolvedValue(2);
    const service = new NotificationsService({
      client: {
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        notification: {
          count,
        },
      },
    } as any);

    await expect(service.getUnreadCount('user-me')).resolves.toEqual({
      unreadCount: 2,
    });

    expect(count).toHaveBeenCalledWith({
      where: {
        userId: 'user-me',
        readAt: null,
        kind: {
          not: 'message',
        },
      },
    });
  });

  it('deletes push tokens by current device id only for current user', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new NotificationsService({
      client: {
        pushToken: {
          deleteMany,
        },
      },
    } as any);

    await expect(
      service.deletePushTokenByDeviceId('user-me', 'device-1'),
    ).resolves.toEqual({ ok: true, deletedCount: 1 });

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-me',
        deviceId: 'device-1',
      },
    });
  });

  it('trims device id before deleting current user push tokens', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new NotificationsService({
      client: {
        pushToken: {
          deleteMany,
        },
      },
    } as any);

    await expect(
      service.deletePushTokenByDeviceId('user-me', '  device-1  '),
    ).resolves.toEqual({ ok: true, deletedCount: 1 });

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-me',
        deviceId: 'device-1',
      },
    });
  });

  it('trims push token payload before registering and rejects blank tokens', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 'push-1' });
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new NotificationsService({
      client: {
        pushToken: {
          upsert,
          deleteMany,
        },
      },
    } as any);

    await expect(
      service.registerPushToken('user-me', {
        token: '  token-1  ',
        provider: 'apns',
        deviceId: '  device-1  ',
        platform: '  ios  ',
      }),
    ).resolves.toEqual({ id: 'push-1' });
    expect(upsert).toHaveBeenCalledWith({
      where: { token: 'token-1' },
      update: {
        userId: 'user-me',
        provider: 'apns',
        deviceId: 'device-1',
        platform: 'ios',
        disabledAt: null,
      },
      create: {
        userId: 'user-me',
        token: 'token-1',
        provider: 'apns',
        deviceId: 'device-1',
        platform: 'ios',
      },
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-me',
        deviceId: 'device-1',
        token: {
          not: 'token-1',
        },
      },
    });

    await expect(
      service.registerPushToken('user-me', {
        token: '   ',
      }),
    ).rejects.toMatchObject({
      code: 'invalid_push_token',
    });
  });

  it('marks only central notifications as read', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const service = new NotificationsService({
      client: {
        notification: {
          updateMany,
        },
      },
    } as any);

    await expect(service.markAllRead('user-me')).resolves.toEqual({
      ok: true,
      updatedCount: 2,
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-me',
        readAt: null,
        kind: {
          not: 'message',
        },
      },
      data: {
        readAt: expect.any(Date),
      },
    });
  });

  it('does not mark chat message notifications through the central read endpoint', async () => {
    const update = jest.fn();
    const service = new NotificationsService({
      client: {
        notification: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'notification-message',
            userId: 'user-me',
            kind: 'message',
            readAt: null,
          }),
          update,
        },
      },
    } as any);

    await expect(
      service.markRead('user-me', 'notification-message'),
    ).rejects.toMatchObject({
      code: 'notification_not_found',
    });
    expect(update).not.toHaveBeenCalled();
  });
});
