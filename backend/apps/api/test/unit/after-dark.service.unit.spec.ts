import { AfterDarkService } from '../../src/services/after-dark.service';

describe('AfterDarkService', () => {
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
        }),
      }),
    );
    expect(detail.going).toBe(42);
    expect(detail.joined).toBe(true);
  });
});
