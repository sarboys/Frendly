import { EventsService } from '../../src/services/events.service';

describe('EventsService invites', () => {
  it('does not decline an invite from a blocked host', async () => {
    const transaction = jest.fn((callback: any) =>
      callback({
        eventJoinRequest: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        notification: {
          updateMany: jest.fn(),
          create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
        },
        outboxEvent: {
          createMany: jest.fn(),
        },
      }),
    );
    const service = new EventsService(
      {
        client: {
          eventJoinRequest: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'request-1',
              eventId: 'event-1',
              userId: 'guest-1',
              status: 'pending',
              reviewedById: 'host-1',
              event: {
                id: 'event-1',
                title: 'Закрытый ужин',
                hostId: 'host-1',
                chat: null,
              },
              user: {
                displayName: 'Гость',
              },
            }),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([
              {
                userId: 'guest-1',
                blockedUserId: 'host-1',
              },
            ]),
          },
          $transaction: transaction,
        },
      } as any,
      {} as any,
    );

    await expect(
      service.declineInvite('guest-1', 'event-1', 'request-1'),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'invite_not_found',
    });
    expect(transaction).not.toHaveBeenCalled();
  });
});
