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

  it('uses event list cursor payload without reading the cursor event again', async () => {
    const firstEvent = eventFixture({
      id: 'event-near',
      distanceKm: 0.4,
      startsAt: new Date('2026-05-01T18:00:00.000Z'),
    });
    const secondEvent = eventFixture({
      id: 'event-far',
      distanceKm: 0.8,
      startsAt: new Date('2026-05-01T19:00:00.000Z'),
    });
    const eventFindMany = jest
      .fn()
      .mockResolvedValueOnce([firstEvent, secondEvent])
      .mockResolvedValueOnce([]);
    const eventFindUnique = jest.fn().mockResolvedValue({
      id: firstEvent.id,
      distanceKm: firstEvent.distanceKm,
      startsAt: firstEvent.startsAt,
    });
    const service = new EventsService(
      {
        client: {
          profile: {
            findUnique: jest.fn().mockResolvedValue({ gender: 'male' }),
          },
          event: {
            findMany: eventFindMany,
            findUnique: eventFindUnique,
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

    const firstPage = await service.listEvents('user-me', {
      filter: 'nearby',
      limit: 1,
    });
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    await service.listEvents('user-me', {
      filter: 'nearby',
      cursor: firstPage.nextCursor!,
      limit: 1,
    });

    expect(eventFindUnique).not.toHaveBeenCalled();
    expect(eventFindMany.mock.calls[1][0].where.AND).toEqual(
      expect.arrayContaining([
        {
          OR: [
            {
              distanceKm: {
                gt: firstEvent.distanceKm,
              },
            },
            {
              distanceKm: firstEvent.distanceKm,
              id: {
                gt: firstEvent.id,
              },
            },
          ],
        },
      ]),
    );
  });

  it('bounds event detail attendees without losing access for joined viewers outside the preview', async () => {
    const participants = Array.from({ length: 24 }, (_, index) => ({
      userId: `guest-${index}`,
      user: {
        id: `guest-${index}`,
        displayName: `Guest ${index}`,
        profile: { avatarUrl: null },
      },
    }));
    const eventFindUnique = jest.fn().mockResolvedValue(
      eventFixture({
        id: 'event-private',
        title: 'Большая встреча',
        capacity: 100,
        genderMode: 'male',
        visibilityMode: 'friends',
        description: 'Закрытая встреча для участников',
        partnerName: null,
        partnerOffer: null,
        participants,
        host: {
          id: 'host-1',
          displayName: 'Host',
          verified: true,
          profile: {
            rating: 4.8,
            meetupCount: 12,
            avatarUrl: 'https://cdn.test/host.jpg',
          },
        },
        chat: { id: 'chat-1' },
      }),
    );
    const participantFindUnique = jest.fn().mockResolvedValue({ id: 'ep-viewer' });
    const participantCount = jest.fn().mockResolvedValue(42);
    const service = new EventsService(
      {
        client: {
          profile: {
            findUnique: jest.fn().mockResolvedValue({ gender: 'female' }),
          },
          event: {
            findUnique: eventFindUnique,
          },
          eventParticipant: {
            findUnique: participantFindUnique,
            count: participantCount,
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        },
      } as any,
      {} as any,
    );

    const result = await service.getEventDetail('user-me', 'event-private');

    expect(eventFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          host: {
            select: {
              id: true,
              displayName: true,
              verified: true,
              profile: {
                select: {
                  rating: true,
                  meetupCount: true,
                  avatarUrl: true,
                },
              },
            },
          },
          participants: expect.objectContaining({
            take: 25,
            orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
            select: {
              userId: true,
              user: {
                select: {
                  id: true,
                  displayName: true,
                  profile: {
                    select: {
                      avatarUrl: true,
                    },
                  },
                },
              },
            },
          }),
          joinRequests: {
            where: { userId: 'user-me' },
            take: 1,
            select: {
              userId: true,
              status: true,
              reviewedById: true,
            },
          },
          attendances: {
            where: { userId: 'user-me' },
            take: 1,
            select: {
              userId: true,
              status: true,
            },
          },
          liveState: {
            select: { status: true },
          },
          chat: {
            select: { id: true },
          },
        }),
      }),
    );
    expect(participantFindUnique).toHaveBeenCalledWith({
      where: {
        eventId_userId: {
          eventId: 'event-private',
          userId: 'user-me',
        },
      },
      select: { id: true },
    });
    expect(participantCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventId: 'event-private',
        }),
      }),
    );
    expect(result.going).toBe(42);
    expect(result.joined).toBe(true);
    expect(result.chatId).toBe('chat-1');
    expect(result.attendees).toHaveLength(24);
  });

  it('counts live meetup stories without loading every story row', async () => {
    const eventFindUnique = jest
      .fn()
      .mockResolvedValueOnce({ hostId: 'host-1' })
      .mockResolvedValueOnce({
        id: 'event-1',
        title: 'Живая встреча',
        place: 'Крыша',
        participants: [
          {
            userId: 'user-me',
            user: {
              id: 'user-me',
              displayName: 'Me',
              verified: true,
              online: true,
              profile: { avatarUrl: null },
            },
          },
        ],
        attendances: [],
        liveState: {
          status: 'live',
          startedAt: new Date(Date.now() - 5 * 60 * 1000),
        },
        chat: { id: 'chat-1' },
      });
    const storyCount = jest.fn().mockResolvedValue(3);
    const userBlockFindMany = jest.fn().mockResolvedValue([
      {
        userId: 'user-me',
        blockedUserId: 'blocked-author',
      },
    ]);
    const service = new EventsService(
      {
        client: {
          event: {
            findUnique: eventFindUnique,
          },
          eventParticipant: {
            findUnique: jest.fn().mockResolvedValue({ id: 'participant-1' }),
          },
          eventStory: {
            count: storyCount,
          },
          userBlock: {
            findMany: userBlockFindMany,
          },
        },
      } as any,
      {} as any,
    );

    const result = await service.getLiveMeetup('user-me', 'event-1');
    const liveEventQuery = eventFindUnique.mock.calls[1][0];

    expect(liveEventQuery.include.stories).toBeUndefined();
    expect(liveEventQuery.include.participants.where).toEqual({
      userId: {
        notIn: ['blocked-author'],
      },
    });
    expect(liveEventQuery.include.participants.select).toEqual({
      userId: true,
      user: {
        select: {
          id: true,
          displayName: true,
          verified: true,
          online: true,
          profile: {
            select: {
              avatarUrl: true,
            },
          },
        },
      },
    });
    expect(liveEventQuery.include.attendances).toEqual({
      where: {
        userId: {
          notIn: ['blocked-author'],
        },
      },
      select: {
        userId: true,
        status: true,
      },
    });
    expect(liveEventQuery.include.liveState).toEqual({
      select: {
        status: true,
        startedAt: true,
      },
    });
    expect(liveEventQuery.include.chat).toEqual({
      select: {
        id: true,
      },
    });
    expect(storyCount).toHaveBeenCalledWith({
      where: {
        eventId: 'event-1',
        authorId: {
          notIn: ['blocked-author'],
        },
      },
    });
    expect(userBlockFindMany).toHaveBeenCalledTimes(1);
    expect(result.storiesCount).toBe(3);
  });

  it('loads check-in attendees with preview fields only', async () => {
    const eventFindUnique = jest
      .fn()
      .mockResolvedValueOnce({ hostId: 'host-1' })
      .mockResolvedValueOnce({
        id: 'event-1',
        title: 'Check-in',
        place: 'Cafe',
        latitude: null,
        longitude: null,
        participants: [
          {
            userId: 'user-me',
            user: {
              id: 'user-me',
              displayName: 'Me',
              verified: true,
              online: true,
              profile: { avatarUrl: null },
            },
          },
        ],
        attendances: [{ userId: 'user-me', status: 'checked_in' }],
      });
    const service = new EventsService(
      {
        client: {
          event: {
            findUnique: eventFindUnique,
          },
          eventParticipant: {
            findUnique: jest.fn().mockResolvedValue({ id: 'participant-1' }),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        },
      } as any,
      {} as any,
    );

    await service.getCheckIn('user-me', 'event-1');

    const checkInQuery = eventFindUnique.mock.calls[1][0];
    expect(checkInQuery.include.participants.select).toEqual({
      userId: true,
      user: {
        select: {
          id: true,
          displayName: true,
          verified: true,
          online: true,
          profile: {
            select: {
              avatarUrl: true,
            },
          },
        },
      },
    });
    expect(checkInQuery.include.attendances.select).toEqual({
      userId: true,
      status: true,
    });
  });

  it('loads after-party attendees with preview fields only', async () => {
    const eventFindUnique = jest
      .fn()
      .mockResolvedValueOnce({ hostId: 'host-1' })
      .mockResolvedValueOnce({
        id: 'event-1',
        title: 'After-party',
        emoji: '*',
        participants: [
          {
            userId: 'user-peer',
            user: {
              displayName: 'Peer',
              profile: { avatarUrl: null },
            },
          },
        ],
        feedbacks: [],
        favorites: [],
      });
    const service = new EventsService(
      {
        client: {
          event: {
            findUnique: eventFindUnique,
          },
          eventParticipant: {
            findUnique: jest.fn().mockResolvedValue({ id: 'participant-1' }),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        },
      } as any,
      {} as any,
    );

    await service.getAfterParty('user-me', 'event-1');

    const afterPartyQuery = eventFindUnique.mock.calls[1][0];
    expect(afterPartyQuery.include.participants.select).toEqual({
      userId: true,
      user: {
        select: {
          displayName: true,
          profile: {
            select: {
              avatarUrl: true,
            },
          },
        },
      },
    });
    expect(afterPartyQuery.include.feedbacks.select).toEqual({
      vibe: true,
      hostRating: true,
      note: true,
    });
    expect(afterPartyQuery.include.favorites.select).toEqual({
      targetUserId: true,
    });
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
            findMany: jest.fn().mockResolvedValue([
              {
                userId: 'user-me',
                blockedUserId: 'blocked-host',
              },
            ]),
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
            findMany: jest.fn().mockResolvedValue([
              {
                userId: 'user-me',
                blockedUserId: 'blocked-host',
              },
            ]),
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
    const postgisCall = queryRaw.mock.calls[0] as any[];
    const postgisQuery = postgisCall[0] as any;
    const postgisSql = Array.isArray(postgisQuery)
      ? postgisQuery.join(' ')
      : [
          postgisQuery.strings.join(' '),
          ...postgisCall
            .slice(1)
            .filter((part) => Array.isArray(part?.strings))
            .map((part) => part.strings.join(' ')),
        ].join(' ');
    expect(postgisSql).toContain('ST_DWithin');
    expect(postgisSql).toContain('e."isAfterDark" = false');
    expect(postgisSql).toContain('e."startsAt" >=');
    expect(postgisSql).toContain('e."hostId" NOT IN');
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

  it('skips Prisma event scan when PostGIS finds no candidates', async () => {
    process.env.ENABLE_POSTGIS_EVENT_FEED = 'true';
    const queryRaw = jest.fn().mockResolvedValue([]);
    const eventFindMany = jest.fn().mockResolvedValue([]);
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
      limit: 20,
    } as any);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(eventFindMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      items: [],
      nextCursor: null,
    });
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

  it('does not reopen a join request that was reviewed during request refresh', async () => {
    const requestUpsert = jest.fn().mockResolvedValue({
      id: 'req-1',
      eventId: 'event-1',
      userId: 'guest-1',
      status: 'approved',
      note: 'Хочу прийти',
      compatibilityScore: 61,
      createdAt: new Date('2026-04-24T12:00:00.000Z'),
    });
    const tx = {
      eventJoinRequest: {
        upsert: requestUpsert,
      },
      notification: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      outboxEvent: {
        createMany: jest.fn(),
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
            findUnique: jest.fn().mockResolvedValue({
              id: 'req-1',
              eventId: 'event-1',
              userId: 'guest-1',
              status: 'pending',
            }),
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

    await expect(
      service.createJoinRequest('guest-1', 'event-1', {
        note: 'Хочу прийти',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'join_request_already_reviewed',
    });
    expect(requestUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.not.objectContaining({
          status: 'pending',
          reviewedAt: null,
          reviewedById: null,
        }),
      }),
    );
  });

  it('lets an existing event participant reopen a full event', async () => {
    const participantFindUnique = jest.fn().mockResolvedValue({
      eventId: 'event-1',
      userId: 'guest-1',
    });
    const capacityLock = jest.fn().mockResolvedValue([{ capacity: 1 }]);
    const participantCount = jest.fn().mockResolvedValue(1);
    const participantUpsert = jest.fn().mockResolvedValue({});
    const attendanceUpsert = jest.fn().mockResolvedValue({});
    const chatMemberUpsert = jest.fn().mockResolvedValue({});
    const detail = { id: 'event-1', joined: true };
    const service = new EventsService(
      {
        client: {
          profile: {
            findUnique: jest.fn().mockResolvedValue({ gender: 'male' }),
          },
          event: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'event-1',
              hostId: 'host-1',
              genderMode: 'all',
              joinMode: 'open',
              chat: { id: 'chat-1' },
            }),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          $transaction: jest.fn((callback: any) =>
            callback({
              $queryRaw: capacityLock,
              eventParticipant: {
                findUnique: participantFindUnique,
                count: participantCount,
                upsert: participantUpsert,
              },
              eventAttendance: {
                upsert: attendanceUpsert,
              },
              chatMember: {
                upsert: chatMemberUpsert,
              },
              chat: {
                update: jest.fn(),
              },
            }),
          ),
        },
      } as any,
      {} as any,
    );
    jest.spyOn(service, 'getEventDetail').mockResolvedValue(detail as any);

    await expect(service.joinEvent('guest-1', 'event-1')).resolves.toBe(detail);
    expect(capacityLock).not.toHaveBeenCalled();
    expect(participantCount).not.toHaveBeenCalled();
    expect(participantUpsert).toHaveBeenCalled();
    expect(attendanceUpsert).toHaveBeenCalled();
    expect(chatMemberUpsert).toHaveBeenCalled();
  });

  it('rejects stale invite accept when the invite was already reviewed', async () => {
    const inviteUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
    const service = new EventsService(
      {
        client: {
          eventJoinRequest: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'invite-1',
              eventId: 'event-1',
              userId: 'guest-1',
              status: 'pending',
              reviewedById: 'host-1',
              event: {
                id: 'event-1',
                hostId: 'host-1',
                chat: { id: 'chat-1' },
              },
            }),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          $transaction: jest.fn((callback: any) =>
            callback({
              $queryRaw: jest.fn().mockResolvedValue([{ capacity: 4 }]),
              eventParticipant: {
                count: jest.fn().mockResolvedValue(1),
                upsert: jest.fn(),
              },
              eventAttendance: {
                upsert: jest.fn(),
              },
              eventJoinRequest: {
                updateMany: inviteUpdateMany,
              },
              chatMember: {
                upsert: jest.fn(),
              },
              notification: {
                updateMany: jest.fn(),
              },
            }),
          ),
        },
      } as any,
      {} as any,
    );

    await expect(
      service.acceptInvite('guest-1', 'event-1', 'invite-1'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'invite_already_reviewed',
    });
    expect(inviteUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'invite-1',
        eventId: 'event-1',
        userId: 'guest-1',
        status: 'pending',
        reviewedById: 'host-1',
      },
      data: expect.objectContaining({
        status: 'approved',
      }),
    });
  });

  it('rejects stale invite decline when the invite was already reviewed', async () => {
    const inviteUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
    const service = new EventsService(
      {
        client: {
          eventJoinRequest: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'invite-1',
              eventId: 'event-1',
              userId: 'guest-1',
              status: 'pending',
              reviewedById: 'host-1',
              user: { displayName: 'Гость' },
              event: {
                id: 'event-1',
                hostId: 'host-1',
                title: 'Встреча',
                chat: { id: 'chat-1' },
              },
            }),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          $transaction: jest.fn((callback: any) =>
            callback({
              eventJoinRequest: {
                updateMany: inviteUpdateMany,
              },
              notification: {
                updateMany: jest.fn(),
                create: jest.fn(),
              },
              message: {
                create: jest.fn(),
              },
              chat: {
                update: jest.fn(),
              },
              realtimeEvent: {
                create: jest.fn(),
              },
              outboxEvent: {
                create: jest.fn(),
                createMany: jest.fn(),
              },
            }),
          ),
        },
      } as any,
      {} as any,
    );

    await expect(
      service.declineInvite('guest-1', 'event-1', 'invite-1'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'invite_already_reviewed',
    });
    expect(inviteUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'invite-1',
        eventId: 'event-1',
        userId: 'guest-1',
        status: 'pending',
        reviewedById: 'host-1',
      },
      data: expect.objectContaining({
        status: 'rejected',
      }),
    });
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

  it('creates a private evening route when event is created from custom route steps', async () => {
    const eventCreate = jest.fn().mockResolvedValue({
      id: 'event-created',
      title: 'Маршрут на вечер',
      emoji: '🗺️',
      startsAt: new Date(Date.now() + 60 * 60 * 1000),
      place: 'Маршрут: Футбол и хинкали',
    });
    const eveningRouteCreate = jest.fn().mockResolvedValue({
      id: 'route-event-created',
      title: 'Футбол и хинкали',
    });
    const tx = {
      eveningRoute: { create: eveningRouteCreate },
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
      title: 'Маршрут на вечер',
    } as any);

    await service.createEvent('user-me', {
      title: 'Маршрут на вечер',
      description: 'Сначала играем, потом ужинаем',
      emoji: '🗺️',
      vibe: 'Активно',
      startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      capacity: 6,
      distanceKm: 0,
      route: {
        type: 'custom',
        title: 'Футбол и хинкали',
        durationLabel: '2 шага',
        steps: [
          {
            time: '15:00',
            emoji: '⚽',
            title: 'Поиграть в футбол',
            place: 'Парк Горького',
          },
          {
            time: '18:00',
            emoji: '🥟',
            title: 'Пойти есть хинкали',
            place: 'Хинкальная',
          },
        ],
      },
    });

    expect(eveningRouteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateId: null,
          source: 'meetup_create',
          status: 'private',
          isCurated: false,
          title: 'Футбол и хинкали',
          steps: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({
                sortOrder: 0,
                timeLabel: '15:00',
                emoji: '⚽',
                title: 'Поиграть в футбол',
                venue: 'Парк Горького',
              }),
            ]),
          }),
        }),
      }),
    );
    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          place: 'Маршрут: Футбол и хинкали',
          distanceKm: 0,
          eveningRouteId: 'route-event-created',
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

  it('deduplicates after-party favorite users before saving feedback', async () => {
    const favoriteCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const participantFindMany = jest.fn().mockResolvedValue([
      { userId: 'user-peer' },
    ]);
    const eventFindUnique = jest
      .fn()
      .mockResolvedValueOnce({ hostId: 'host-1' })
      .mockResolvedValueOnce({
        id: 'event-1',
        startsAt: new Date(Date.now() - 60_000),
        participants: [
          { userId: 'user-me' },
          { userId: 'user-peer' },
        ],
        liveState: { status: 'finished' },
      });
    const service = new EventsService(
      {
        client: {
          eventParticipant: {
            findUnique: jest.fn().mockResolvedValue({
              eventId: 'event-1',
              userId: 'user-me',
            }),
            findMany: participantFindMany,
          },
          event: {
            findUnique: eventFindUnique,
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          $transaction: jest.fn((callback: any) =>
            callback({
              eventFeedback: {
                upsert: jest.fn(),
              },
              eventFavorite: {
                deleteMany: jest.fn(),
                createMany: favoriteCreateMany,
              },
            }),
          ),
        },
      } as any,
      {} as any,
    );

    const result = await service.saveFeedback('user-me', 'event-1', {
      favoriteUserIds: ['user-peer', 'user-peer'],
    });
    const feedbackEventQuery = eventFindUnique.mock.calls[1][0];

    expect(feedbackEventQuery.include.participants).toBeUndefined();
    expect(participantFindMany).toHaveBeenCalledWith({
      where: {
        eventId: 'event-1',
        userId: {
          in: ['user-peer'],
        },
      },
      select: { userId: true },
    });
    expect(favoriteCreateMany).toHaveBeenCalledWith({
      data: [
        {
          eventId: 'event-1',
          sourceUserId: 'user-me',
          targetUserId: 'user-peer',
        },
      ],
      skipDuplicates: true,
    });
    expect(result.favoritesCount).toBe(1);
  });
});
