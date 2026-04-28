import { AfterDarkService } from '../../src/services/after-dark.service';

describe('AfterDarkService', () => {
  const makeListEvent = (
    id: string,
    startsAt: Date,
  ) => ({
    id,
    title: `Event ${id}`,
    emoji: '*',
    startsAt,
    place: 'Center',
    distanceKm: 1,
    capacity: 20,
    vibe: 'Quiet',
    afterDarkCategory: null,
    afterDarkGlow: null,
    dressCode: null,
    ageRange: null,
    ratioLabel: null,
    consentRequired: false,
    priceMode: 'free',
    priceAmountFrom: null,
    priceAmountTo: null,
    participants: [],
    _count: {
      participants: 3,
    },
    joinRequests: [],
    host: {
      verified: true,
    },
  });

  it('does not load all event participants for after-dark list summaries', async () => {
    const eventFindMany = jest.fn().mockResolvedValue([]);
    const client = {
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({
          afterDarkAgeConfirmedAt: new Date('2026-01-01T00:00:00Z'),
          afterDarkCodeAcceptedAt: new Date('2026-01-01T00:00:00Z'),
        }),
      },
      userVerification: {
        findUnique: jest.fn().mockResolvedValue({ status: 'verified' }),
      },
      event: {
        count: jest.fn().mockResolvedValue(1),
        findMany: eventFindMany,
      },
      userBlock: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'user-me',
            blockedUserId: 'blocked-user',
          },
        ]),
      },
    };
    const service = new AfterDarkService(
      { client } as any,
      {
        getCurrent: jest.fn().mockResolvedValue({
          status: 'active',
          plan: 'month',
        }),
      } as any,
      {} as any,
    );

    await service.listEvents('user-me', { limit: 10 });

    expect(eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          host: {
            select: {
              verified: true,
            },
          },
          participants: expect.objectContaining({
            where: {
              userId: 'user-me',
            },
            select: {
              userId: true,
            },
            take: 1,
          }),
          _count: {
            select: {
              participants: {
                where: {
                  userId: {
                    notIn: ['blocked-user'],
                  },
                },
              },
            },
          },
        }),
      }),
    );
  });

  it('uses after-dark cursor payload without reading the cursor event again', async () => {
    const firstEvent = makeListEvent(
      'event-1',
      new Date('2026-01-01T20:00:00Z'),
    );
    const secondEvent = makeListEvent(
      'event-2',
      new Date('2026-01-02T20:00:00Z'),
    );
    const eventFindMany = jest
      .fn()
      .mockResolvedValueOnce([firstEvent, secondEvent])
      .mockResolvedValueOnce([]);
    const eventFindFirst = jest.fn().mockResolvedValue({
      id: firstEvent.id,
      startsAt: firstEvent.startsAt,
    });
    const client = {
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({
          afterDarkAgeConfirmedAt: new Date('2026-01-01T00:00:00Z'),
          afterDarkCodeAcceptedAt: new Date('2026-01-01T00:00:00Z'),
        }),
      },
      userVerification: {
        findUnique: jest.fn().mockResolvedValue({ status: 'verified' }),
      },
      event: {
        count: jest.fn().mockResolvedValue(2),
        findFirst: eventFindFirst,
        findMany: eventFindMany,
      },
      userBlock: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new AfterDarkService(
      { client } as any,
      {
        getCurrent: jest.fn().mockResolvedValue({
          status: 'active',
          plan: 'month',
        }),
      } as any,
      {} as any,
    );

    const firstPage = await service.listEvents('user-me', { limit: 1 });
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    await service.listEvents('user-me', {
      cursor: firstPage.nextCursor!,
      limit: 1,
    });

    expect(eventFindFirst).not.toHaveBeenCalled();
    expect(eventFindMany.mock.calls[1][0].where.OR).toEqual([
      {
        startsAt: {
          gt: firstEvent.startsAt,
        },
      },
      {
        startsAt: firstEvent.startsAt,
        id: {
          gt: firstEvent.id,
        },
      },
    ]);
  });

  it('does not load all event participants for after-dark detail', async () => {
    const eventFindFirst = jest.fn().mockResolvedValue({
      id: 'event-1',
      title: 'After dark',
      emoji: '*',
      startsAt: new Date('2026-01-01T20:00:00Z'),
      place: 'Center',
      distanceKm: 1,
      capacity: 20,
      vibe: 'Quiet',
      description: 'Detail',
      hostNote: null,
      afterDarkCategory: null,
      afterDarkGlow: null,
      dressCode: null,
      ageRange: null,
      ratioLabel: null,
      consentRequired: false,
      priceMode: 'free',
      priceAmountFrom: null,
      priceAmountTo: null,
      rules: [],
      hostId: 'host-1',
      participants: [{ userId: 'user-me' }],
      _count: {
        participants: 42,
      },
      joinRequests: [],
      chat: { id: 'chat-1' },
      host: {
        id: 'host-1',
        displayName: 'Host',
        verified: true,
        profile: {
          rating: 4.8,
          meetupCount: 12,
          avatarUrl: null,
        },
      },
    });
    const client = {
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({
          afterDarkAgeConfirmedAt: new Date('2026-01-01T00:00:00Z'),
          afterDarkCodeAcceptedAt: new Date('2026-01-01T00:00:00Z'),
        }),
      },
      userVerification: {
        findUnique: jest.fn().mockResolvedValue({ status: 'verified' }),
      },
      event: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: eventFindFirst,
      },
      userBlock: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new AfterDarkService(
      { client } as any,
      {
        getCurrent: jest.fn().mockResolvedValue({
          status: 'active',
          plan: 'month',
        }),
      } as any,
      {} as any,
    );

    const detail = await service.getEventDetail('user-me', 'event-1');

    expect(eventFindFirst).toHaveBeenCalledWith(
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
            where: {
              userId: 'user-me',
            },
            select: {
              userId: true,
            },
            take: 1,
          }),
          _count: {
            select: {
              participants: {
                where: {
                  userId: {
                    notIn: [],
                  },
                },
              },
            },
          },
          chat: {
            select: {
              id: true,
            },
          },
        }),
      }),
    );
    expect(detail.going).toBe(42);
    expect(detail.joined).toBe(true);
  });
});
