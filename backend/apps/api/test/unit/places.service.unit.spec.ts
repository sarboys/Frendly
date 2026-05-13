import { ApiError } from '../../src/common/api-error';
import { PlacesService } from '../../src/services/places.service';

describe('PlacesService unit', () => {
  it('returns only published Tomesto place rows with booking fields and promos', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'place-1',
          sourceId: 'source-tomesto',
          sourceUrl: 'https://tomesto.ru/moskva/places/brix',
          title: 'Brix',
          address: 'Покровка 12',
          city: 'Москва',
          category: 'bar',
          placeKind: 'bar',
          tags: ['place:bar', 'metro:kitay_gorod'],
          lat: 55.756,
          lng: 37.64,
          priceFrom: 1500,
          currency: 'RUB',
          actionUrl: 'https://tomesto.ru/moskva/places/brix?ref=frendly',
          sourceProvider: 'ТоМесто',
          raw: {
            slug: 'brix',
            rating: 4.7,
          },
          source: { code: 'tomesto', name: 'ТоМесто' },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'promo-1',
          title: 'Сет к вину',
          shortSummary: 'Компактное описание',
          startsAt: new Date('2026-05-01T00:00:00.000Z'),
          endsAt: new Date('2026-06-01T00:00:00.000Z'),
          actionUrl: 'https://tomesto.ru/moskva/promos/wine?ref=frendly',
          sourceUrl: 'https://tomesto.ru/moskva/promos/wine',
          raw: {
            kind: 'promo',
            placeSlug: 'brix',
            venueName: 'Brix',
          },
        },
      ]);
    const service = new PlacesService({
      client: {
        externalContentItem: { findMany },
      },
    } as any);

    const result = await service.searchPlaces({
      q: 'brix',
      city: 'Москва',
      latitude: 55.75,
      longitude: 37.61,
    });

    expect(findMany.mock.calls[0][0].where).toMatchObject({
      source: { code: 'tomesto' },
      contentKind: 'place',
      publicStatus: 'published',
      city: 'Москва',
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: 'place-1',
        name: 'Brix',
        bookingUrl: 'https://tomesto.ru/moskva/places/brix?ref=frendly',
        averageCheck: 1500,
        rating: 4.7,
        provider: 'ТоМесто',
        promos: [
          {
            title: 'Сет к вину',
            description: 'Компактное описание',
            validUntil: '2026-06-01T00:00:00.000Z',
            bookingUrl: 'https://tomesto.ru/moskva/promos/wine?ref=frendly',
            sourceUrl: 'https://tomesto.ru/moskva/promos/wine',
          },
        ],
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain('"raw"');
  });

  it('rejects short search queries', async () => {
    const service = new PlacesService({ client: {} } as any);

    await expect(service.searchPlaces({ q: 'a' })).rejects.toMatchObject({
      statusCode: 400,
      code: 'place_search_query_too_short',
    } satisfies Partial<ApiError>);
  });
});
