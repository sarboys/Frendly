import { SharesService } from '../../src/services/shares.service';

describe('SharesService unit', () => {
  const eventFixture = (overrides: Record<string, unknown> = {}) => ({
    id: 'event-1',
    title: 'Винный вечер',
    emoji: '🍷',
    startsAt: new Date('2026-05-01T16:30:00.000Z'),
    durationMinutes: 120,
    place: 'Brix Wine, Покровка 12',
    distanceKm: 1.2,
    latitude: 55.756,
    longitude: 37.642,
    vibe: 'Камерно',
    description: 'Знакомимся за бокалом и идем гулять.',
    partnerName: 'Brix Wine',
    partnerOffer: '-15% на бокалы',
    capacity: 8,
    visibilityMode: 'public',
    isAfterDark: false,
    host: {
      id: 'host-1',
      displayName: 'Никита',
      verified: true,
      profile: {
        avatarUrl: '/media/avatar-host',
      },
    },
    participants: [
      {
        userId: 'guest-1',
        user: {
          id: 'guest-1',
          displayName: 'Аня',
          profile: { avatarUrl: null },
        },
      },
    ],
    _count: {
      participants: 3,
    },
    ...overrides,
  });

  it('reuses an existing event share slug', async () => {
    const publicShareFindFirst = jest.fn().mockResolvedValue({
      slug: 'abc123share',
    });
    const service = new SharesService({
      client: {
        event: {
          findUnique: jest.fn().mockResolvedValue(eventFixture()),
        },
        publicShare: {
          findFirst: publicShareFindFirst,
          create: jest.fn(),
        },
      },
    } as any);

    await expect(
      service.createShare('user-me', {
        targetType: 'event',
        targetId: 'event-1',
      }),
    ).resolves.toMatchObject({
      slug: 'abc123share',
      url: 'https://frendly.tech/abc123share',
      appPath: '/event/event-1',
      deepLink: 'frendly:///event/event-1',
    });
  });

  it('maps a public event snapshot without private ids', async () => {
    const service = new SharesService({
      client: {
        publicShare: {
          findUnique: jest.fn().mockResolvedValue({
            slug: 'abc123share',
            targetType: 'event',
            event: eventFixture(),
            eveningSession: null,
          }),
        },
      },
    } as any);

    await expect(service.getPublicShare('abc123share')).resolves.toMatchObject({
      slug: 'abc123share',
      kind: 'event',
      title: 'Винный вечер',
      url: 'https://frendly.tech/abc123share',
      appPath: '/event/event-1',
      deepLink: 'frendly:///event/event-1',
      host: {
        name: 'Никита',
        avatarUrl: '/media/avatar-host',
      },
      people: {
        count: 3,
        preview: [{ name: 'Аня', avatarUrl: null }],
      },
    });
  });

  it('rejects private event shares', async () => {
    const service = new SharesService({
      client: {
        event: {
          findUnique: jest.fn().mockResolvedValue(
            eventFixture({
              visibilityMode: 'friends',
            }),
          ),
        },
      },
    } as any);

    await expect(
      service.createShare('user-me', {
        targetType: 'event',
        targetId: 'event-1',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'share_target_not_public',
    });
  });

  it('maps an evening session with route steps', async () => {
    const service = new SharesService({
      client: {
        publicShare: {
          findUnique: jest.fn().mockResolvedValue({
            slug: 'route123abc',
            targetType: 'evening_session',
            event: null,
            eveningSession: {
              id: 'session-1',
              phase: 'scheduled',
              privacy: 'open',
              startsAt: new Date('2026-05-01T16:00:00.000Z'),
              capacity: 10,
              host: {
                id: 'host-1',
                displayName: 'Никита',
                profile: { avatarUrl: null },
              },
              participants: [],
              route: {
                id: 'route-1',
                title: 'Маршрут по Покровке',
                vibe: 'Камерно',
                blurb: 'Бар, ужин и прогулка.',
                area: 'Чистые пруды',
                durationLabel: '19:00 - 23:00',
                totalPriceFrom: 1800,
                totalSavings: 400,
                steps: [
                  {
                    id: 'step-1',
                    sortOrder: 0,
                    timeLabel: '19:00',
                    endTimeLabel: '20:00',
                    title: 'Аперитив',
                    venue: 'Brix Wine',
                    address: 'Покровка 12',
                    emoji: '🍷',
                    description: 'Первый бокал.',
                    distanceLabel: '1.2 км',
                    walkMin: 12,
                    perkShort: '-15%',
                    lat: 55.756,
                    lng: 37.642,
                  },
                ],
              },
              _count: {
                participants: 4,
              },
            },
          }),
        },
      },
    } as any);

    await expect(service.getPublicShare('route123abc')).resolves.toMatchObject({
      kind: 'evening_session',
      appPath: '/evening-preview/session-1',
      deepLink: 'frendly:///evening-preview/session-1',
      title: 'Маршрут по Покровке',
      route: {
        area: 'Чистые пруды',
        steps: [
          {
            title: 'Аперитив',
            venue: 'Brix Wine',
            perk: '-15%',
          },
        ],
      },
      people: {
        count: 4,
      },
    });
  });
});
