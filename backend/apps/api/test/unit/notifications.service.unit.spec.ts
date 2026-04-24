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
});
