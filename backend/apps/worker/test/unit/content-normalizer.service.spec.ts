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
});
