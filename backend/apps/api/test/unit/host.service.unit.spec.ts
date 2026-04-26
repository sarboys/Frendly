import { HostService } from '../../src/services/host.service';

describe('HostService unit', () => {
  it('loads dashboard stats through one aggregate query without all participant rows', async () => {
    const eventFindMany = jest.fn().mockResolvedValueOnce([
      {
        id: 'event-1',
        title: 'Ужин',
        emoji: '🍽️',
        startsAt: new Date('2026-04-28T18:00:00.000Z'),
        durationMinutes: 120,
        place: 'Центр',
        distanceKm: 1,
        vibe: 'Спокойно',
        tone: 'warm',
        joinMode: 'open',
        lifestyle: 'neutral',
        priceMode: 'free',
        priceAmountFrom: null,
        priceAmountTo: null,
        accessMode: 'open',
        genderMode: 'all',
        visibilityMode: 'public',
        hostNote: null,
        description: 'Описание',
        partnerName: null,
        partnerOffer: null,
        isAfterDark: false,
        afterDarkCategory: null,
        afterDarkGlow: null,
        dressCode: null,
        ageRange: null,
        ratioLabel: null,
        consentRequired: false,
        rules: null,
        capacity: 4,
        idempotencyKey: null,
        isCalm: true,
        isNewcomers: true,
        isDate: false,
        sourcePosterId: null,
        hostId: 'user-me',
        createdAt: new Date('2026-04-24T00:00:00.000Z'),
        updatedAt: new Date('2026-04-24T00:00:00.000Z'),
        participants: [],
        joinRequests: [],
        liveState: null,
      },
    ]);
    const client = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-me',
          displayName: 'Host',
          profile: {
            rating: 4.8,
          },
        }),
      },
      event: {
        findMany: eventFindMany,
        findUnique: jest.fn().mockResolvedValue(null),
      },
      eventJoinRequest: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      userBlock: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([
        {
          meetups_count: BigInt(12),
          fill_rate: 75,
        },
      ]),
    };
    const service = new HostService({ client } as any);

    const result = await service.getDashboard('user-me', {
      eventsLimit: 1,
      requestsLimit: 1,
    });

    expect(result.stats).toMatchObject({
      meetupsCount: 12,
      fillRate: 75,
      rating: 4.8,
    });
    expect(eventFindMany).toHaveBeenCalledTimes(1);
    expect(eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
      }),
    );
    expect(client.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
