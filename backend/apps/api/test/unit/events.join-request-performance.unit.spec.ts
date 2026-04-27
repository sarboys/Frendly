import { EventsService } from '../../src/services/events.service';

describe('EventsService join request performance', () => {
  it('loads only participant ids before calculating compatibility', async () => {
    const eventFindUnique = jest.fn().mockResolvedValue({
      id: 'event-1',
      title: 'Закрытый ужин',
      hostId: 'host-1',
      genderMode: 'all',
      joinMode: 'request',
      participants: [],
    });
    const service = new EventsService(
      {
        client: {
          profile: {
            findUnique: jest.fn().mockResolvedValue({ gender: 'male' }),
          },
          event: {
            findUnique: eventFindUnique,
          },
          eventJoinRequest: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'guest-1',
              onboarding: {
                interests: ['Кофе'],
              },
            }),
            findMany: jest.fn().mockResolvedValue([]),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          $transaction: jest.fn((callback: any) =>
            callback({
              eventJoinRequest: {
                upsert: jest.fn().mockResolvedValue({
                  id: 'req-1',
                  eventId: 'event-1',
                  userId: 'guest-1',
                  status: 'pending',
                  note: '',
                  compatibilityScore: 52,
                  createdAt: new Date('2026-04-24T12:00:00.000Z'),
                }),
              },
              notification: {
                findUnique: jest.fn().mockResolvedValue({ id: 'notif-existing' }),
              },
              outboxEvent: {
                createMany: jest.fn(),
              },
            }),
          ),
        },
      } as any,
      {} as any,
    );

    await service.createJoinRequest('guest-1', 'event-1', {});

    expect(eventFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          participants: {
            select: {
              userId: true,
            },
          },
        },
      }),
    );
  });
});
