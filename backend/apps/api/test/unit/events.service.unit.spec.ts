import { Prisma } from '@prisma/client';
import { EventsService } from '../../src/services/events.service';

describe('EventsService unit', () => {
  it('caps event search query before building contains filters', async () => {
    const eventFindMany = jest.fn().mockResolvedValue([]);
    const service = new EventsService(
      {
        client: {
          event: {
            findMany: eventFindMany,
            findUnique: jest.fn(),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        },
      } as any,
      {} as any,
    );

    await service.listEvents('user-me', {
      filter: 'nearby',
      q: `  ${'вечер'.repeat(20)}  `,
    });

    const where = eventFindMany.mock.calls[0][0].where as any;
    const searchCondition = where.AND.find(
      (condition: any) =>
        Array.isArray(condition.OR) && condition.OR[0]?.title?.contains != null,
    );

    expect(searchCondition.OR[0].title.contains).toHaveLength(64);
    expect(searchCondition.OR[0].title.contains).toBe('вечер'.repeat(20).slice(0, 64));
  });

  it('limits participant preview in event feed queries', async () => {
    const eventFindMany = jest.fn().mockResolvedValue([
      {
        id: 'event-1',
        title: 'Большая встреча',
        emoji: '☕',
        startsAt: new Date(Date.now() + 60 * 60 * 1000),
        place: 'Кафе',
        distanceKm: 0.4,
        latitude: null,
        longitude: null,
        vibe: 'Спокойно',
        tone: 'warm',
        hostNote: null,
        lifestyle: 'neutral',
        priceMode: 'free',
        priceAmountFrom: null,
        priceAmountTo: null,
        accessMode: 'open',
        genderMode: 'all',
        visibilityMode: 'public',
        joinMode: 'open',
        capacity: 100,
        hostId: 'host-1',
        participants: Array.from({ length: 20 }, (_, index) => ({
          userId: `user-${index}`,
          user: { displayName: `User ${index}` },
        })),
        joinRequests: [],
        attendances: [],
        liveState: null,
      },
    ]);
    const service = new EventsService(
      {
        client: {
          event: {
            findMany: eventFindMany,
            findUnique: jest.fn(),
          },
          eventParticipant: {
            findMany: jest.fn().mockResolvedValue([]),
            groupBy: jest.fn().mockResolvedValue([
              {
                eventId: 'event-1',
                _count: { _all: 20 },
              },
            ]),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        },
      } as any,
      {} as any,
    );

    await service.listEvents('user-me', { filter: 'nearby' });

    expect(eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          participants: expect.objectContaining({
            take: 6,
          }),
        }),
      }),
    );
  });

  it('returns the existing event when a concurrent create hits the same idempotency key', async () => {
    const duplicateKeyError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`hostId`,`idempotencyKey`)',
      {
        code: 'P2002',
        clientVersion: 'test',
      },
    );
    const client = {
      event: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'event-existing' }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ displayName: 'Никита' }),
      },
      userBlock: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn().mockRejectedValue(duplicateKeyError),
    };
    const service = new EventsService(
      { client } as any,
      {} as any,
    );
    const eventDetail = { id: 'event-existing', title: 'Повтор встречи' };
    const getEventDetail = jest
      .spyOn(service, 'getEventDetail')
      .mockResolvedValue(eventDetail as any);

    await expect(
      service.createEvent(
        'user-me',
        {
          title: 'Повтор встречи',
          description: 'Проверяем повторный submit формы',
          place: 'Покровка 10',
          startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          capacity: 4,
          distanceKm: 1,
        },
        'create-event-key',
      ),
    ).resolves.toBe(eventDetail);

    expect(client.event.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          hostId: 'user-me',
          idempotencyKey: 'create-event-key',
        },
      }),
    );
    expect(getEventDetail).toHaveBeenCalledWith('user-me', 'event-existing');
  });
});
