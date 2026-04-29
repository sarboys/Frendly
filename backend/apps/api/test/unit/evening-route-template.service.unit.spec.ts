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
    durationLabel: '2.5 часа',
    totalPriceFrom: 1800,
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
});
