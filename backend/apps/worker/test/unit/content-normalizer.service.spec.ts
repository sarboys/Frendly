import { ContentNormalizerService } from '../../src/content/content-normalizer.service';

describe('ContentNormalizerService', () => {
  it('trims text, maps categories and computes a stable normalized hash', () => {
    const service = new ContentNormalizerService();

    const item = service.normalize({
      sourceCode: 'kudago',
      sourceItemId: 'place-1',
      contentKind: 'place',
      city: 'Москва',
      timezone: 'Europe/Moscow',
      title: '  Кофейня Смена  ',
      description: '  тихое место рядом с парком  ',
      category: 'cafe',
      address: '  Москва, Тверская, 1  ',
      lat: 55.7558123,
      lng: 37.6173456,
      raw: { id: 1 },
    });

    expect(item).toMatchObject({
      title: 'Кофейня Смена',
      shortSummary: 'тихое место рядом с парком',
      category: 'food',
      address: 'Москва, Тверская, 1',
      normalizedHash: expect.any(String),
    });
  });

  it('keeps route planning categories specific for bars and quests', () => {
    const service = new ContentNormalizerService();

    const bar = service.normalize({
      sourceCode: 'overpass',
      sourceItemId: 'bar-1',
      contentKind: 'place',
      city: 'Москва',
      timezone: 'Europe/Moscow',
      title: 'Бар после спектакля',
      category: 'bar',
      address: 'Москва, Петровка, 7',
      lat: 55.756,
      lng: 37.617,
      raw: { id: 1 },
    });
    const quest = service.normalize({
      sourceCode: 'kudago',
      sourceItemId: 'event-1',
      contentKind: 'event',
      city: 'Москва',
      timezone: 'Europe/Moscow',
      title: 'Квест «Тайная комната»',
      category: 'quest',
      address: 'Москва, Петровка, 9',
      lat: 55.757,
      lng: 37.618,
      raw: { id: 2 },
    });

    expect(bar.category).toBe('bar');
    expect(quest.category).toBe('quest');
  });

  it('maps imported event categories into route planning categories', () => {
    const service = new ContentNormalizerService();

    expect(normalizedCategory(service, 'standup')).toBe('comedy');
    expect(normalizedCategory(service, 'quiz')).toBe('quiz');
    expect(normalizedCategory(service, 'theatre')).toBe('theatre');
    expect(normalizedCategory(service, 'concert')).toBe('concert');
    expect(normalizedCategory(service, 'workshop')).toBe('workshop');
    expect(normalizedCategory(service, 'market')).toBe('market');
    expect(normalizedCategory(service, 'festival')).toBe('festival');
    expect(normalizedCategory(service, 'cinema')).toBe('cinema');
    expect(normalizedCategory(service, 'spa')).toBe('spa');
    expect(normalizedCategory(service, 'sports_centre')).toBe('sport');
    expect(normalizedCategory(service, 'bicycle_rental')).toBe('bike');
    expect(normalizedCategory(service, 'atv')).toBe('adventure');
    expect(normalizedCategory(service, 'picnic_site')).toBe('outdoor');
  });

  it('maps selected KudaGo place categories into route planning categories', () => {
    const service = new ContentNormalizerService();

    expect(normalizedCategory(service, 'restaurants')).toBe('food');
    expect(normalizedCategory(service, 'anticafe')).toBe('cafe');
    expect(normalizedCategory(service, 'museums')).toBe('culture');
    expect(normalizedCategory(service, 'art-centers')).toBe('culture');
    expect(normalizedCategory(service, 'concert-hall')).toBe('concert');
    expect(normalizedCategory(service, 'questroom')).toBe('quest');
    expect(normalizedCategory(service, 'photo-places')).toBe('walk');
    expect(normalizedCategory(service, 'prirodnyj-zapovednik')).toBe('outdoor');
    expect(normalizedCategory(service, 'recreation')).toBe('sport');
    expect(normalizedCategory(service, 'salons')).toBe('spa');
    expect(normalizedCategory(service, 'stable')).toBe('adventure');
    expect(normalizedCategory(service, 'workshops')).toBe('workshop');
    expect(normalizedCategory(service, 'rynok')).toBe('market');
  });

  it('sets price mode without treating unknown price as free', () => {
    const service = new ContentNormalizerService();

    const free = service.normalize(baseEvent({ priceFrom: 0 }));
    const paid = service.normalize(baseEvent({ priceFrom: 750 }));
    const unknown = service.normalize(baseEvent({ priceFrom: null }));

    expect(free.priceMode).toBe('free');
    expect(paid.priceMode).toBe('paid');
    expect(unknown.priceMode).toBe('unknown');
  });

  it('keeps affiche fields for affiliate events', () => {
    const service = new ContentNormalizerService();

    const item = service.normalize(baseEvent({
      sourceCode: 'advcake_ticketland',
      priceFrom: 1200,
      venueName: 'Клуб',
      imageUrl: 'https://ticketland.ru/image.jpg',
      actionUrl: 'https://go.avred.online/click',
      actionKind: 'affiliate_ticket',
      isAffiliate: true,
      sourceProvider: 'Ticketland / MTS Live',
    }));

    expect(item).toMatchObject({
      priceMode: 'paid',
      venueName: 'Клуб',
      imageUrl: 'https://ticketland.ru/image.jpg',
      actionUrl: 'https://go.avred.online/click',
      actionKind: 'affiliate_ticket',
      isAffiliate: true,
      sourceProvider: 'Ticketland / MTS Live',
      lastSeenAt: expect.any(Date),
    });
  });
});

function normalizedCategory(service: ContentNormalizerService, category: string) {
  return service.normalize({
    sourceCode: 'kudago',
    sourceItemId: `event-${category}`,
    contentKind: 'event',
    city: 'Москва',
    timezone: 'Europe/Moscow',
    title: category,
    category,
    address: 'Москва, Петровка, 1',
    lat: 55.756,
    lng: 37.617,
    raw: { category },
  }).category;
}

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    sourceCode: 'kudago' as const,
    sourceItemId: 'event-1',
    contentKind: 'event' as const,
    city: 'Москва',
    timezone: 'Europe/Moscow',
    title: 'Событие',
    category: 'concert',
    address: 'Москва, Петровка, 1',
    lat: 55.756,
    lng: 37.617,
    startsAt: new Date('2026-05-05T16:00:00.000Z'),
    raw: { id: 1 },
    ...overrides,
  };
}
