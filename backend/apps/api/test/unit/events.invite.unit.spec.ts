import { EventsService } from '../../src/services/events.service';

describe('EventsService invites', () => {
  it('lets a joined participant invite a followed user with the inviter as notification actor', async () => {
    const eventJoinRequestCreate = jest.fn().mockResolvedValue({
      id: 'request-1',
      eventId: 'event-1',
      userId: 'guest-1',
      status: 'pending',
    });
    const notificationCreate = jest.fn().mockResolvedValue({
      id: 'notification-1',
    });
    const outboxCreateMany = jest.fn();
    const service = new EventsService(
      {
        client: {
          event: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'event-1',
              title: 'Винный вечер',
              hostId: 'host-1',
              canceledAt: null,
              participants: [{ userId: 'member-1' }],
              chat: { id: 'chat-1' },
            }),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'guest-1',
              displayName: 'Гость',
              settings: {
                discoverable: true,
              },
            }),
          },
          userFollow: {
            findUnique: jest.fn().mockResolvedValue({
              followerUserId: 'member-1',
              targetUserId: 'guest-1',
            }),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          eventJoinRequest: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
          $transaction: jest.fn((callback: any) =>
            callback({
              $queryRaw: jest.fn().mockResolvedValue([{ capacity: 4 }]),
              eventParticipant: {
                count: jest.fn().mockResolvedValue(1),
              },
              eventJoinRequest: {
                create: eventJoinRequestCreate,
              },
              notification: {
                create: notificationCreate,
              },
              outboxEvent: {
                createMany: outboxCreateMany,
              },
            }),
          ),
        },
      } as any,
      {} as any,
    );

    const result = await service.inviteUserToEvent(
      'member-1',
      'event-1',
      'guest-1',
    );

    expect(result).toMatchObject({
      id: 'request-1',
      eventId: 'event-1',
      userId: 'guest-1',
      status: 'pending',
      inviteState: 'pending_invite',
    });
    expect(eventJoinRequestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: 'event-1',
          userId: 'guest-1',
          reviewedById: 'host-1',
        }),
      }),
    );
    expect(notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'guest-1',
          actorUserId: 'member-1',
          kind: 'event_invite',
        }),
      }),
    );
    expect(outboxCreateMany).toHaveBeenCalled();
  });

  it('rejects event invites from users who are not participants', async () => {
    const service = new EventsService(
      {
        client: {
          event: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'event-1',
              title: 'Винный вечер',
              hostId: 'host-1',
              canceledAt: null,
              participants: [{ userId: 'member-1' }],
              chat: { id: 'chat-1' },
            }),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        },
      } as any,
      {} as any,
    );

    await expect(
      service.inviteUserToEvent('stranger-1', 'event-1', 'guest-1'),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'event_invite_forbidden',
    });
  });

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
