import { NotificationsService } from '../../src/services/notifications.service';

describe('NotificationsService unit', () => {
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
});
