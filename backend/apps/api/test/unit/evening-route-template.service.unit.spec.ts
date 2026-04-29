import { EveningRouteTemplateService } from '../../src/services/evening-route-template.service';

describe('EveningRouteTemplateService unit', () => {
  const route = {
    id: 'route-1',
    title: 'Кино без кино',
    vibe: 'спокойный вечер',
    blurb: 'Два места в центре Москвы.',
    city: 'Москва',
    area: 'центр',
    badgeLabel: 'Маршрут от команды Frendly',
    coverAssetId: null,
    budget: 'mid',
    totalSavings: 650,
    durationLabel: '2.5 часа',
    totalPriceFrom: 1800,
    mood: 'chill',
    premium: true,
    hostsCount: 8,
    steps: [
      {
        id: 'step-1',
        sortOrder: 1,
        title: 'Начать с вина',
        venue: 'Example Bar',
        emoji: '🍷',
        timeLabel: '19:00',
        endTimeLabel: '20:15',
        kind: 'bar',
        address: 'Москва, улица 1',
        distanceLabel: '7 минут пешком',
        walkMin: 7,
        perk: 'Комплимент',
        perkShort: 'Подарок',
        ticketPrice: null,
        ticketCommission: null,
        sponsored: true,
        premium: false,
        partnerId: 'partner-1',
        partnerOfferId: 'offer-1',
        offerTitleSnapshot: 'Комплимент',
        offerShortLabelSnapshot: 'Подарок',
        description: 'Тихий старт.',
        vibeTag: null,
        lat: 55.7558,
        lng: 37.6173,
      },
    ],
  };

  it('lists only published templates for the requested city', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'template-1',
        status: 'published',
        city: 'Москва',
        area: 'центр',
        currentRouteId: 'route-1',
        currentRoute: route,
        sessions: [],
      },
    ]);
    const service = new EveningRouteTemplateService(
      {
        client: {
          eveningRouteTemplate: {
            findMany,
          },
        },
      } as any,
      { track: jest.fn() } as any,
    );

    const result = await service.listRouteTemplates({
      city: 'Москва',
      limit: '20',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'published',
          city: 'Москва',
          currentRouteId: { not: null },
        },
        take: 20,
      }),
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'template-1',
        routeId: 'route-1',
        title: 'Кино без кино',
        city: 'Москва',
        totalSavings: 650,
        mood: 'chill',
        premium: true,
        hostsCount: 8,
        stepsPreview: [
          expect.objectContaining({
            venue: 'Example Bar',
            time: '19:00',
            kind: 'bar',
          }),
        ],
      }),
    ]);
  });

  it('hides archived templates defensively', async () => {
    const service = new EveningRouteTemplateService(
      {
        client: {
          eveningRouteTemplate: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'template-archived',
                status: 'archived',
                city: 'Москва',
                currentRouteId: 'route-1',
                currentRoute: route,
                sessions: [],
              },
            ]),
          },
        },
      } as any,
      { track: jest.fn() } as any,
    );

    const result = await service.listRouteTemplates({ city: 'Москва' });

    expect(result.items).toEqual([]);
  });

  it('creates a session from the current route revision', async () => {
    const sessionCreate = jest.fn().mockResolvedValue({
      id: 'session-1',
      chatId: 'chat-1',
      routeId: 'route-current',
      routeTemplateId: 'template-1',
      privacy: 'request',
      capacity: 8,
      phase: 'scheduled',
      mode: 'hybrid',
      inviteToken: null,
    });
    const track = jest.fn();
    const service = new EveningRouteTemplateService(
      {
        client: {
          eveningRouteTemplate: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'template-1',
              status: 'published',
              city: 'Москва',
              timezone: 'Europe/Moscow',
              currentRouteId: 'route-current',
              currentRoute: route,
            }),
          },
          eveningSession: {
            count: jest.fn().mockResolvedValue(0),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'user-host',
              createdAt: new Date('2026-01-01T08:00:00.000Z'),
            }),
          },
          $transaction: jest.fn((callback) =>
            callback({
              chat: {
                create: jest.fn().mockResolvedValue({ id: 'chat-1' }),
                update: jest.fn(),
              },
              eveningSession: {
                create: sessionCreate,
                updateMany: jest.fn(),
              },
              chatMember: { upsert: jest.fn() },
              eveningSessionParticipant: { upsert: jest.fn() },
              eveningSessionStepState: { createMany: jest.fn() },
              message: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 'message-1' }),
              },
              realtimeEvent: { create: jest.fn().mockResolvedValue({ id: 1 }) },
              outboxEvent: { createMany: jest.fn() },
            }),
          ),
        },
      } as any,
      { track } as any,
    );

    const result = await service.createSessionFromTemplate(
      'user-host',
      'template-1',
      {
        startsAt: '2026-04-30T16:00:00.000Z',
        privacy: 'request',
        capacity: 8,
        hostNote: 'Встречаемся без спешки',
      },
    );

    expect(sessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        routeId: 'route-current',
        routeTemplateId: 'template-1',
        hostUserId: 'user-host',
        chatId: 'chat-1',
        privacy: 'request',
        capacity: 8,
      }),
    });
    expect(track).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'route_session_created',
        userId: 'user-host',
        routeTemplateId: 'template-1',
        routeId: 'route-current',
      }),
    );
    expect(result).toMatchObject({
      sessionId: 'session-1',
      routeId: 'route-current',
      routeTemplateId: 'template-1',
      chatId: 'chat-1',
    });
  });

  it('does not move old sessions when a template has a newer current revision', async () => {
    const sessionUpdateMany = jest.fn();
    const service = new EveningRouteTemplateService(
      {
        client: {
          eveningRouteTemplate: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'template-1',
              status: 'published',
              city: 'Москва',
              timezone: 'Europe/Moscow',
              currentRouteId: 'route-v2',
              currentRoute: { ...route, id: 'route-v2' },
            }),
          },
          eveningSession: {
            count: jest.fn().mockResolvedValue(0),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'user-host',
              createdAt: new Date('2026-01-01T08:00:00.000Z'),
            }),
          },
          $transaction: jest.fn((callback) =>
            callback({
              chat: {
                create: jest.fn().mockResolvedValue({ id: 'chat-2' }),
                update: jest.fn(),
              },
              eveningSession: {
                create: jest.fn().mockResolvedValue({
                  id: 'session-2',
                  chatId: 'chat-2',
                  routeId: 'route-v2',
                  routeTemplateId: 'template-1',
                  privacy: 'open',
                  capacity: 8,
                  phase: 'scheduled',
                  mode: 'hybrid',
                  inviteToken: null,
                }),
                updateMany: sessionUpdateMany,
              },
              chatMember: { upsert: jest.fn() },
              eveningSessionParticipant: { upsert: jest.fn() },
              eveningSessionStepState: { createMany: jest.fn() },
              message: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 'message-2' }),
              },
              realtimeEvent: { create: jest.fn().mockResolvedValue({ id: 2 }) },
              outboxEvent: { createMany: jest.fn() },
            }),
          ),
        },
      } as any,
      { track: jest.fn() } as any,
    );

    const result = await service.createSessionFromTemplate(
      'user-host',
      'template-1',
      {
        startsAt: '2026-04-30T18:00:00.000Z',
        privacy: 'open',
      },
    );

    expect(result.routeId).toBe('route-v2');
    expect(sessionUpdateMany).not.toHaveBeenCalled();
  });
});
