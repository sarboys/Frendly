import { AdminEveningRouteService } from '../../src/services/admin-evening-route.service';

describe('AdminEveningRouteService unit', () => {
  it('creates a second revision without moving existing sessions from the old route', async () => {
    const routeCreate = jest.fn().mockResolvedValue({
      id: 'route-new',
      version: 2,
    });
    const stepCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const templateUpdate = jest.fn().mockResolvedValue({
      id: 'template-1',
      currentRouteId: 'route-new',
      status: 'draft',
      city: 'Москва',
      timezone: 'Europe/Moscow',
      area: 'центр',
      currentRoute: null,
      revisions: [],
      createdAt: new Date('2026-04-29T08:00:00.000Z'),
      updatedAt: new Date('2026-04-29T08:00:00.000Z'),
    });
    const sessionUpdateMany = jest.fn();
    const tx = {
      eveningRouteTemplate: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'template-1',
          city: 'Москва',
          timezone: 'Europe/Moscow',
          area: 'центр',
          currentRouteId: 'route-old',
          currentRoute: {
            id: 'route-old',
            version: 1,
          },
        }),
        update: templateUpdate,
      },
      venue: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'venue-1',
          partnerId: 'partner-1',
          name: 'Example Bar',
          address: 'Москва, Example street, 1',
          lat: 55.7558,
          lng: 37.6173,
        }),
      },
      partnerOffer: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'offer-1',
          partnerId: 'partner-1',
          venueId: 'venue-1',
          title: 'Комплимент',
          description: 'Бокал игристого',
          terms: 'По QR',
          shortLabel: 'Подарок',
          validFrom: null,
          validTo: null,
        }),
      },
      eveningRoute: {
        create: routeCreate,
      },
      eveningRouteStep: {
        createMany: stepCreateMany,
      },
      eveningSession: {
        updateMany: sessionUpdateMany,
      },
    };
    const service = new AdminEveningRouteService({
      client: {
        $transaction: jest.fn((callback) => callback(tx)),
      },
    } as any);

    await service.createRevision('template-1', {
      title: 'Кино без кино',
      vibe: 'спокойный вечер',
      blurb: 'Два места в центре Москвы.',
      totalPriceFrom: 1800,
      totalSavings: 300,
      durationLabel: '2.5 часа',
      area: 'центр',
      goal: 'date',
      mood: 'chill',
      budget: 'mid',
      format: 'mixed',
      recommendedFor: 'свидание',
      badgeLabel: 'Маршрут от команды Frendly',
      steps: [
        {
          sortOrder: 1,
          timeLabel: '19:00',
          endTimeLabel: '20:15',
          kind: 'bar',
          title: 'Начать с вина',
          venueId: 'venue-1',
          partnerOfferId: 'offer-1',
          description: 'Тихий старт.',
          emoji: '🍷',
          distanceLabel: '7 минут пешком',
          walkMin: 7,
        },
      ],
    });

    expect(routeCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.any(String),
        templateId: 'template-1',
        version: 2,
        status: 'draft',
        isCurated: true,
      }),
    });
    expect(stepCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          routeId: expect.any(String),
          venueId: 'venue-1',
          partnerOfferId: 'offer-1',
          venue: 'Example Bar',
          address: 'Москва, Example street, 1',
          lat: 55.7558,
          lng: 37.6173,
          perk: 'Комплимент',
          perkShort: 'Подарок',
          partnerId: 'partner-1',
          sponsored: true,
        }),
      ],
    });
    expect(templateUpdate).toHaveBeenCalledWith({
      where: { id: 'template-1' },
      data: expect.objectContaining({
        currentRouteId: expect.any(String),
      }),
      include: expect.any(Object),
    });
    expect(sessionUpdateMany).not.toHaveBeenCalled();
  });
});
