import { buildRouteSkeletons, validateRouteDraft } from '../../src/content/route-planner';

describe('route planner', () => {
  it('builds a date route around theatre with dinner before and bar after', () => {
    const routes = buildRouteSkeletons(
      { city: 'Москва', mood: 'date', budget: 'mid', timezone: 'Europe/Moscow', maxDrafts: 1 },
      [
        place('dinner-1', 'Ресторан у театра', 'restaurant', 55.760, 37.620, 1800),
        event('theatre-1', 'Спектакль «Чайка»', 'theatre', 55.761, 37.621, '2026-05-05T16:00:00.000Z', '2026-05-05T18:15:00.000Z', 2200),
        place('bar-1', 'Винный бар рядом', 'bar', 55.762, 37.622, 1200),
      ],
    );

    expect(routes).toHaveLength(1);
    expect(routes[0]?.steps.map((step) => step.kind)).toEqual(['food', 'theatre', 'bar']);
    expect(routes[0]?.steps.find((step) => step.externalContentItemId === 'theatre-1')).toEqual(
      expect.objectContaining({
        timeLabel: '19:00',
        endTimeLabel: '21:15',
      }),
    );
    expect(routes[0]).toEqual(expect.objectContaining({
      durationLabel: '4.5 часа',
      totalPriceFrom: 5200,
    }));
  });

  it('keeps free routes inside free budget and rejects paid generated drafts for free budget', () => {
    const candidates = [
      place('park-1', 'Парк у воды', 'park', 55.760, 37.620, 0),
      place('gallery-1', 'Бесплатная галерея', 'gallery', 55.761, 37.621, 0),
      place('paid-bar-1', 'Коктейльный бар', 'bar', 55.762, 37.622, 1300),
    ];

    const routes = buildRouteSkeletons(
      { city: 'Москва', mood: 'calm', budget: 'free', timezone: 'Europe/Moscow', maxDrafts: 1 },
      candidates,
    );

    expect(routes).toHaveLength(1);
    expect(routes[0]?.totalPriceFrom).toBe(0);
    expect(routes[0]?.steps.map((step) => step.externalContentItemId)).not.toContain('paid-bar-1');

    const validation = validateRouteDraft(
      {
        title: 'Платный бесплатный маршрут',
        description: 'Так нельзя.',
        steps: [
          { externalContentItemId: 'park-1', timeLabel: '19:00', endTimeLabel: '19:30', walkMin: 0, lat: 55.760, lng: 37.620 },
          { externalContentItemId: 'paid-bar-1', timeLabel: '19:45', endTimeLabel: '20:45', walkMin: 8, lat: 55.762, lng: 37.622 },
        ],
      },
      candidates,
      'Europe/Moscow',
      'free',
    );
    expect(validation.status).toBe('invalid');
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'budget_exceeded' }),
    ]));
  });

  it('creates social routes around standup or quiz instead of generic culture', () => {
    const routes = buildRouteSkeletons(
      { city: 'Москва', mood: 'social', budget: 'low', timezone: 'Europe/Moscow', maxDrafts: 1 },
      [
        place('burger-1', 'Бургерная', 'restaurant', 55.760, 37.620, 700),
        event('standup-1', 'Стендап вечер', 'standup', 55.761, 37.621, '2026-05-05T17:00:00.000Z', '2026-05-05T18:30:00.000Z', 900),
        place('bar-1', 'Бар после стендапа', 'bar', 55.762, 37.622, 600),
      ],
    );

    expect(routes).toHaveLength(1);
    expect(routes[0]?.steps.map((step) => step.kind)).toEqual(['food', 'comedy', 'bar']);
    expect(routes[0]?.totalPriceFrom).toBe(2200);
  });

  it('uses category duration profiles for flexible places', () => {
    const routes = buildRouteSkeletons(
      { city: 'Москва', mood: 'culture', budget: 'mid', timezone: 'Europe/Moscow', maxDrafts: 1 },
      [
        place('coffee-1', 'Кофе перед музеем', 'cafe', 55.760, 37.620, 300),
        place('museum-1', 'Музей архитектуры', 'museum', 55.761, 37.621, 500),
        place('bar-1', 'Тихий бар', 'bar', 55.762, 37.622, 900),
      ],
    );

    expect(routes).toHaveLength(1);
    expect(routes[0]?.steps.map((step) => ({
      id: step.externalContentItemId,
      start: step.timeLabel,
      end: step.endTimeLabel,
    }))).toEqual([
      { id: 'coffee-1', start: '19:00', end: '19:45' },
      { id: 'museum-1', start: '19:55', end: '21:10' },
      { id: 'bar-1', start: '21:20', end: '22:20' },
    ]);
  });

  it('finds a nearby place cluster instead of picking first matching categories across the city', () => {
    const candidates = [
      place('far-cafe-1', 'Кафе на севере', 'cafe', 55.850, 37.450, 300),
      place('far-museum-1', 'Музей на юге', 'museum', 55.620, 37.700, 500),
      place('far-bar-1', 'Бар на востоке', 'bar', 55.800, 37.900, 900),
      place('cluster-cafe-1', 'Кофе у Арбата', 'cafe', 55.752, 37.596, 300),
      place('cluster-gallery-1', 'Галерея на Арбате', 'attraction', 55.753, 37.597, 500),
      place('cluster-bar-1', 'Бар на Смоленской', 'bar', 55.754, 37.598, 900),
    ];

    const routes = buildRouteSkeletons(
      { city: 'Москва', mood: 'culture', budget: 'mid', timezone: 'Europe/Moscow', maxDrafts: 1 },
      candidates,
    );

    expect(routes).toHaveLength(1);
    expect(routes[0]?.steps.map((step) => step.externalContentItemId)).toEqual([
      'cluster-cafe-1',
      'cluster-gallery-1',
      'cluster-bar-1',
    ]);
    expect(validateRouteDraft(routes[0]!, candidates, 'Europe/Moscow', 'mid').status).toBe('valid');
  });

  it('builds a reviewable event-hop route when places are missing but events fit by time and distance', () => {
    const candidates = [
      event('lecture-1', 'Лекция про город', 'lecture', 55.760, 37.620, '2026-05-05T16:00:00.000Z', '2026-05-05T17:00:00.000Z', 400),
      event('concert-1', 'Камерный концерт', 'concert', 55.768, 37.628, '2026-05-05T18:00:00.000Z', '2026-05-05T19:15:00.000Z', 900),
    ];

    const routes = buildRouteSkeletons(
      { city: 'Москва', mood: 'culture', budget: 'low', timezone: 'Europe/Moscow', maxDrafts: 1 },
      candidates,
    );

    expect(routes).toHaveLength(1);
    expect(routes[0]?.steps.map((step) => step.externalContentItemId)).toEqual(['lecture-1', 'concert-1']);

    const validation = validateRouteDraft(routes[0]!, candidates, 'Europe/Moscow', 'low');
    expect(validation.status).toBe('warning');
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'too_many_timed_events', severity: 'warning' }),
    ]));
  });

  it('does not build a route from repeated quests in the same venue cluster', () => {
    const routes = buildRouteSkeletons(
      { city: 'Москва', mood: 'active', budget: 'mid', timezone: 'Europe/Moscow', maxDrafts: 1 },
      [
        event('quest-1', 'Квест «Один из нас»', 'quest', 55.751, 37.610, '2026-05-05T16:00:00.000Z', '2026-05-05T17:30:00.000Z', 1200),
        event('quest-2', 'Квест «Мгла»', 'quest', 55.75101, 37.61001, '2026-05-05T18:00:00.000Z', '2026-05-05T19:30:00.000Z', 1200),
      ],
    );

    expect(routes).toHaveLength(0);
  });

  it('rejects two timed events with the same planning category even in different places', () => {
    const candidates = [
      event('quest-1', 'Квест «Один из нас»', 'quest', 55.751, 37.610, '2026-05-05T16:00:00.000Z', '2026-05-05T17:00:00.000Z', 1000),
      event('quest-2', 'Квест «Мгла»', 'quest', 55.760, 37.620, '2026-05-05T17:30:00.000Z', '2026-05-05T18:30:00.000Z', 1000),
    ];

    const validation = validateRouteDraft(
      {
        title: 'Вечер квестов',
        description: 'Два квеста подряд.',
        steps: [
          { externalContentItemId: 'quest-1', timeLabel: '19:00', endTimeLabel: '20:00', walkMin: 0, lat: 55.751, lng: 37.610 },
          { externalContentItemId: 'quest-2', timeLabel: '20:30', endTimeLabel: '21:30', walkMin: 15, lat: 55.760, lng: 37.620 },
        ],
      },
      candidates,
      'Europe/Moscow',
      'mid',
    );

    expect(validation.status).toBe('invalid');
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'event_category_repeated', stepIndex: 1 }),
    ]));
  });

  it('builds outdoor routes from bike and park candidates before quests', () => {
    const routes = buildRouteSkeletons(
      { city: 'Москва', mood: 'outdoor', budget: 'low', timezone: 'Europe/Moscow', maxDrafts: 1 },
      [
        place('bike-1', 'Велопрокат у парка', 'bicycle_rental', 55.760, 37.620, 500),
        place('park-1', 'Парк у воды', 'park', 55.765, 37.625, 0),
        place('food-1', 'Кафе у входа', 'cafe', 55.770, 37.630, 600),
        event('quest-1', 'Квест в помещении', 'quest', 55.761, 37.621, '2026-05-05T16:00:00.000Z', '2026-05-05T17:30:00.000Z', 1200),
      ],
    );

    expect(routes).toHaveLength(1);
    expect(routes[0]?.title).toContain('На природе');
    expect(routes[0]?.steps.map((step) => step.kind)).toEqual(['walk', 'bike', 'cafe']);
    expect(routes[0]?.steps.map((step) => step.externalContentItemId)).not.toContain('quest-1');
  });
});

function event(
  id: string,
  title: string,
  category: string,
  lat: number,
  lng: number,
  startsAt: string,
  endsAt: string,
  priceFrom: number,
) {
  return {
    id,
    sourceUrl: `https://example.com/${id}`,
    contentKind: 'event',
    city: 'Москва',
    title,
    shortSummary: title,
    category,
    address: 'Петровка, 1',
    lat,
    lng,
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
    priceFrom,
    source: { name: 'Test', code: 'test' },
  };
}

function place(
  id: string,
  title: string,
  category: string,
  lat: number,
  lng: number,
  priceFrom: number,
) {
  return {
    id,
    sourceUrl: `https://example.com/${id}`,
    contentKind: 'place',
    city: 'Москва',
    title,
    shortSummary: title,
    category,
    address: 'Петровка, 1',
    lat,
    lng,
    startsAt: null,
    endsAt: null,
    priceFrom,
    source: { name: 'Test', code: 'test' },
  };
}
