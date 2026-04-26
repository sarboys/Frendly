import { Prisma } from '@prisma/client';
import { EventsService } from '../../src/services/events.service';

describe('EventsService unit', () => {
  afterEach(() => {
    delete process.env.ENABLE_POSTGIS_EVENT_FEED;
  });

  const eventFixture = (overrides: Record<string, unknown> = {}) => ({
    id: 'event-1',
    title: 'Встреча',
    emoji: '☕',
    startsAt: new Date(Date.now() + 60 * 60 * 1000),
    place: 'Кафе',
    distanceKm: 1,
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
    capacity: 8,
    hostId: 'host-1',
    participants: [],
    joinRequests: [],
    attendances: [],
    liveState: null,
    ...overrides,
  });

  it('caps event search query before building contains filters', async () => {
    const eventFindMany = jest.fn().mockResolvedValue([]);
    const service = new EventsService(
      {
        client: {
          profile: {
            findUnique: jest.fn().mockResolvedValue({ gender: 'male' }),
          },
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
          profile: {
            findUnique: jest.fn().mockResolvedValue({ gender: 'male' }),
          },
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

  it('hides gender-specific events from users with the opposite gender', async () => {
    const eventFindMany = jest.fn().mockResolvedValue([]);
    const service = new EventsService(
      {
        client: {
          profile: {
            findUnique: jest.fn().mockResolvedValue({ gender: 'female' }),
          },
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

    await service.listEvents('user-female', { filter: 'nearby' });

    const where = eventFindMany.mock.calls[0][0].where as any;
    expect(where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          OR: expect.arrayContaining([
            { genderMode: 'all' },
            { genderMode: 'female' },
          ]),
        }),
      ]),
    );
  });

  it('orders nearby events by real coordinates when user point is provided', async () => {
    const eventFindMany = jest.fn().mockResolvedValue([
      eventFixture({
        id: 'event-far',
        title: 'Дальняя встреча',
        distanceKm: 0.2,
        latitude: 55.82,
        longitude: 37.75,
      }),
      eventFixture({
        id: 'event-near',
        title: 'Ближняя встреча',
        distanceKm: 20,
        latitude: 55.751,
        longitude: 37.611,
      }),
    ]);
    const service = new EventsService(
      {
        client: {
          profile: {
            findUnique: jest.fn().mockResolvedValue({ gender: 'male' }),
          },
          event: {
            findMany: eventFindMany,
            findUnique: jest.fn(),
          },
          eventParticipant: {
            findMany: jest.fn().mockResolvedValue([]),
            groupBy: jest.fn().mockResolvedValue([]),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        },
      } as any,
      {} as any,
    );

    const result = await service.listEvents('user-me', {
      filter: 'nearby',
      latitude: 55.75,
      longitude: 37.61,
      radiusKm: 25,
      limit: 2,
    } as any);

    const where = eventFindMany.mock.calls[0][0].where as any;
    expect(where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          latitude: expect.objectContaining({
            gte: expect.any(Number),
            lte: expect.any(Number),
          }),
          longitude: expect.objectContaining({
            gte: expect.any(Number),
            lte: expect.any(Number),
          }),
        }),
      ]),
    );
    expect(result.items.map((item: any) => item.id)).toEqual([
      'event-near',
      'event-far',
    ]);
    expect(result.items[0]!.distance).toBe('0.1 км');
  });

  it('uses PostGIS candidate scan for first geo page when enabled', async () => {
    process.env.ENABLE_POSTGIS_EVENT_FEED = 'true';
    const queryRaw = jest.fn().mockResolvedValue([
      {
        event_id: 'event-near',
        distance_km: 0.12,
      },
      {
        event_id: 'event-far',
        distance_km: 3.5,
      },
    ]);
    const eventFindMany = jest.fn().mockResolvedValue([
      eventFixture({
        id: 'event-far',
        title: 'Дальняя встреча',
        distanceKm: 20,
      }),
      eventFixture({
        id: 'event-near',
        title: 'Ближняя встреча',
        distanceKm: 5,
      }),
    ]);
    const service = new EventsService(
      {
        client: {
          $queryRaw: queryRaw,
          profile: {
            findUnique: jest.fn().mockResolvedValue({ gender: 'male' }),
          },
          event: {
            findMany: eventFindMany,
            findUnique: jest.fn(),
          },
          eventParticipant: {
            findMany: jest.fn().mockResolvedValue([]),
            groupBy: jest.fn().mockResolvedValue([]),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        },
      } as any,
      {} as any,
    );

    const result = await service.listEvents('user-me', {
      filter: 'nearby',
      latitude: 55.75,
      longitude: 37.61,
      radiusKm: 25,
      limit: 2,
    } as any);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const postgisQuery = queryRaw.mock.calls[0][0] as any;
    const postgisSql = Array.isArray(postgisQuery)
      ? postgisQuery.join(' ')
      : postgisQuery.strings.join(' ');
    expect(postgisSql).toContain('ST_DWithin');
    expect(postgisSql).toContain('e."isAfterDark" = false');
    expect(postgisSql).toContain('e."startsAt" >=');
    expect(eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              id: {
                in: ['event-near', 'event-far'],
              },
            }),
          ]),
        }),
      }),
    );
    expect(result.items.map((item: any) => item.id)).toEqual([
      'event-near',
      'event-far',
    ]);
    expect(result.items[0]!.distance).toBe('0.1 км');
  });

  it('creates notification for host when a join request is submitted', async () => {
    const notificationCreate = jest.fn().mockResolvedValue({ id: 'notif-host' });
    const notificationFindUnique = jest.fn().mockResolvedValue(null);
    const outboxCreateMany = jest.fn().mockResolvedValue({});
    const requestUpsert = jest.fn().mockResolvedValue({
      id: 'req-1',
      eventId: 'event-1',
      userId: 'guest-1',
      status: 'pending',
      note: 'Хочу прийти',
      compatibilityScore: 61,
      createdAt: new Date('2026-04-24T12:00:00.000Z'),
    });
    const tx = {
      eventJoinRequest: {
        upsert: requestUpsert,
      },
      notification: {
        create: notificationCreate,
        findUnique: notificationFindUnique,
      },
      outboxEvent: {
        createMany: outboxCreateMany,
      },
    };
    const service = new EventsService(
      {
        client: {
          profile: {
            findUnique: jest.fn().mockResolvedValue({ gender: 'male' }),
          },
          event: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'event-1',
              title: 'Закрытый ужин',
              hostId: 'host-1',
              genderMode: 'all',
              joinMode: 'request',
              participants: [],
            }),
          },
          eventJoinRequest: {
            findUnique: jest.fn().mockResolvedValue(null),
            upsert: requestUpsert,
          },
          user: {
            findUnique: jest
              .fn()
              .mockResolvedValue({ id: 'guest-1', displayName: 'Гость' }),
            findMany: jest.fn().mockResolvedValue([]),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          $transaction: jest.fn((callback: any) => callback(tx)),
        },
      } as any,
      {} as any,
    );

    await service.createJoinRequest('guest-1', 'event-1', {
      note: 'Хочу прийти',
    });

    expect(notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'host-1',
          actorUserId: 'guest-1',
          title: 'Новая заявка',
          eventId: 'event-1',
          requestId: 'req-1',
          dedupeKey: 'event_join_request:event-1:guest-1',
        }),
      }),
    );
    expect(outboxCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            payload: {
              userId: 'host-1',
              notificationId: 'notif-host',
            },
          }),
          expect.objectContaining({
            payload: {
              notificationId: 'notif-host',
            },
          }),
        ]),
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

  it('creates a community meetup preview when event has community id', async () => {
    const eventCreate = jest.fn().mockResolvedValue({
      id: 'event-created',
      title: 'Бранч клуба',
      emoji: '🥐',
      startsAt: new Date(Date.now() + 60 * 60 * 1000),
      place: 'Friends Bistro',
    });
    const chatCreate = jest.fn().mockResolvedValue({ id: 'event-created-chat' });
    const communityMeetupCreate = jest.fn().mockResolvedValue({ id: 'cm-created' });
    const tx = {
      event: { create: eventCreate },
      chat: { create: chatCreate },
      eventParticipant: { create: jest.fn().mockResolvedValue({}) },
      eventAttendance: { create: jest.fn().mockResolvedValue({}) },
      eventLiveState: { create: jest.fn().mockResolvedValue({}) },
      chatMember: { create: jest.fn().mockResolvedValue({}) },
      communityMeetupItem: { create: communityMeetupCreate },
    };
    const client = {
      event: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ displayName: 'Никита' }),
      },
      userBlock: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      community: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'community-1',
          createdById: 'user-me',
          members: [{ role: 'owner' }],
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new EventsService(
      { client } as any,
      {} as any,
    );
    jest.spyOn(service, 'getEventDetail').mockResolvedValue({
      id: 'event-created',
      title: 'Бранч клуба',
    } as any);

    await service.createEvent('user-me', {
      title: 'Бранч клуба',
      description: 'Клубная встреча',
      emoji: '🥐',
      place: 'Friends Bistro',
      vibe: 'Спокойно',
      startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      capacity: 8,
      distanceKm: 1,
      communityId: 'community-1',
    });

    expect(client.community.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'community-1',
          OR: [
            { createdById: 'user-me' },
            { members: { some: { userId: 'user-me' } } },
          ],
        },
      }),
    );
    expect(communityMeetupCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'event-created',
          communityId: 'community-1',
          title: 'Бранч клуба',
          emoji: '🥐',
          place: 'Friends Bistro',
          going: 1,
        }),
      }),
    );
  });

  it('persists coordinates and distance when event is created from a resolved place', async () => {
    const eventCreate = jest.fn().mockResolvedValue({
      id: 'event-created',
      title: 'Кофе на Тверской',
      emoji: '☕',
      startsAt: new Date(Date.now() + 60 * 60 * 1000),
      place: 'Кофемания, Тверская 10',
    });
    const tx = {
      event: { create: eventCreate },
      chat: { create: jest.fn().mockResolvedValue({ id: 'event-created-chat' }) },
      eventParticipant: { create: jest.fn().mockResolvedValue({}) },
      eventAttendance: { create: jest.fn().mockResolvedValue({}) },
      eventLiveState: { create: jest.fn().mockResolvedValue({}) },
      chatMember: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new EventsService(
      {
        client: {
          event: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue({ displayName: 'Никита' }),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          $transaction: jest.fn((callback) => callback(tx)),
        },
      } as any,
      {} as any,
    );
    jest.spyOn(service, 'getEventDetail').mockResolvedValue({
      id: 'event-created',
      title: 'Кофе на Тверской',
    } as any);

    await service.createEvent('user-me', {
      title: 'Кофе на Тверской',
      description: 'Короткая встреча после работы',
      emoji: '☕',
      place: 'Кофемания, Тверская 10',
      vibe: 'Спокойно',
      startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      capacity: 6,
      distanceKm: 1.7,
      latitude: 55.765,
      longitude: 37.605,
    });

    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          distanceKm: 1.7,
          latitude: 55.765,
          longitude: 37.605,
        }),
      }),
    );
  });

  it('rejects partial event coordinates', async () => {
    const service = new EventsService(
      {
        client: {},
      } as any,
      {} as any,
    );

    await expect(
      service.createEvent('user-me', {
        title: 'Кофе на Тверской',
        description: 'Короткая встреча после работы',
        place: 'Кофемания, Тверская 10',
        startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        capacity: 6,
        distanceKm: 1.7,
        latitude: 55.765,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'invalid_event_payload',
    });
  });
});
