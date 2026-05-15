import { AdvCakeTicketlandAdapter } from '../../src/content/advcake-ticketland.adapter';
import { KudaGoAdapter } from '../../src/content/kudago.adapter';
import { OverpassAdapter } from '../../src/content/overpass.adapter';
import { TimepadAdapter } from '../../src/content/timepad.adapter';
import { TomestoAdapter } from '../../src/content/tomesto.adapter';

const originalTimepadToken = process.env.TIMEPAD_API_TOKEN;
const originalAdvCakePass = process.env.ADVCAKE_API_PASS;
const originalTomestoRefQuery = process.env.TOMESTO_REF_QUERY;
const originalTomestoRequestDelayMs = process.env.TOMESTO_REQUEST_DELAY_MS;
const originalTomestoImportImages = process.env.TOMESTO_IMPORT_IMAGES;
const originalTomestoCatalogBatchSize = process.env.TOMESTO_CATALOG_BATCH_SIZE;

describe('content source adapters', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalTimepadToken == null) {
      delete process.env.TIMEPAD_API_TOKEN;
    } else {
      process.env.TIMEPAD_API_TOKEN = originalTimepadToken;
    }
    if (originalAdvCakePass == null) {
      delete process.env.ADVCAKE_API_PASS;
    } else {
      process.env.ADVCAKE_API_PASS = originalAdvCakePass;
    }
    if (originalTomestoRefQuery == null) {
      delete process.env.TOMESTO_REF_QUERY;
    } else {
      process.env.TOMESTO_REF_QUERY = originalTomestoRefQuery;
    }
    if (originalTomestoRequestDelayMs == null) {
      delete process.env.TOMESTO_REQUEST_DELAY_MS;
    } else {
      process.env.TOMESTO_REQUEST_DELAY_MS = originalTomestoRequestDelayMs;
    }
    if (originalTomestoImportImages == null) {
      delete process.env.TOMESTO_IMPORT_IMAGES;
    } else {
      process.env.TOMESTO_IMPORT_IMAGES = originalTomestoImportImages;
    }
    if (originalTomestoCatalogBatchSize == null) {
      delete process.env.TOMESTO_CATALOG_BATCH_SIZE;
    } else {
      process.env.TOMESTO_CATALOG_BATCH_SIZE = originalTomestoCatalogBatchSize;
    }
  });

  it('loads all KudaGo pages for the selected period', async () => {
    const adapter = new KudaGoAdapter();
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));
      const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
      const isEvents = url.pathname.endsWith('/events/');
      const count = isEvents ? (page <= 5 ? 100 : page === 6 ? 1 : 0) : 0;
      return jsonResponse({
        results: Array.from({ length: count }, (_, index) => kudagoEvent(page * 1000 + index)),
      });
    });

    const items = await adapter.fetchItems(fetchInput());

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes('/events/') && url.includes('page=6'))).toBe(true);
    expect(items.filter((item) => item.contentKind === 'event')).toHaveLength(501);
  });

  it('filters KudaGo events and places by route-worthy categories', async () => {
    const adapter = new KudaGoAdapter();
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ results: [] }) as any);

    await adapter.fetchItems(fetchInput());

    const urls = fetchMock.mock.calls.map((call) => new URL(String(call[0])));
    const eventCategories = urls
      .find((url) => url.pathname.endsWith('/events/'))
      ?.searchParams.get('categories');
    const placeCategories = urls
      .find((url) => url.pathname.endsWith('/places/'))
      ?.searchParams.get('categories');
    const eventExpand = urls
      .find((url) => url.pathname.endsWith('/events/'))
      ?.searchParams.get('expand');

    expect(eventCategories).toBe([
      'cinema',
      'concert',
      'education',
      'entertainment',
      'exhibition',
      'festival',
      'holiday',
      'party',
      'photo',
      'quest',
      'recreation',
      'theater',
      'tour',
      'yarmarki-razvlecheniya-yarmarki',
    ].join(','));
    expect(eventCategories).not.toContain('business-events');
    expect(eventCategories).not.toContain('kids');
    expect(eventCategories).not.toContain('stock');
    expect(eventExpand).toBe('place');

    expect(placeCategories).toBe([
      'amusement',
      'anticafe',
      'art-centers',
      'art-space',
      'attractions',
      'bar',
      'brewery',
      'bridge',
      'cinema',
      'clubs',
      'comedy-club',
      'concert-hall',
      'culture',
      'dance-studio',
      'fountain',
      'handmade',
      'homesteads',
      'library',
      'museums',
      'observatory',
      'palace',
      'park',
      'photo-places',
      'prirodnyj-zapovednik',
      'questroom',
      'recreation',
      'restaurants',
      'rynok',
      'salons',
      'sights',
      'stable',
      'suburb',
      'theatre',
      'workshops',
    ].join(','));
    expect(placeCategories).not.toContain('airports');
    expect(placeCategories).not.toContain('car-washes');
    expect(placeCategories).not.toContain('metro');
    expect(placeCategories).not.toContain('animal-shelters');
  });

  it('uses KudaGo location codes for supported million-plus cities', async () => {
    const adapter = new KudaGoAdapter();
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ results: [] }) as any);

    await adapter.fetchItems(fetchInput({ city: 'Казань', cityCode: 'kzn' }));

    const urls = fetchMock.mock.calls.map((call) => new URL(String(call[0])));
    expect(urls.every((url) => url.searchParams.get('location') === 'kzn')).toBe(true);
  });

  it('maps expanded KudaGo event place coordinates and venue name', async () => {
    const adapter = new KudaGoAdapter();
    jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({
        results: [kudagoEvent(100, {
          place: {
            id: 96,
            title: 'Дарвиновский музей',
            address: 'ул. Вавилова, 57',
            coords: { lat: 55.6894, lon: 37.5629 },
          },
        })],
      }) as any)
      .mockResolvedValueOnce(jsonResponse({ results: [] }) as any);

    const items = await adapter.fetchItems(fetchInput());

    expect(items[0]).toMatchObject({
      sourceCode: 'kudago',
      sourceItemId: 'event-100',
      contentKind: 'event',
      venueName: 'Дарвиновский музей',
      address: 'ул. Вавилова, 57',
      lat: 55.6894,
      lng: 37.5629,
    });
  });

  it('loads all Timepad pages until the selected period ends', async () => {
    process.env.TIMEPAD_API_TOKEN = 'test-token';
    const adapter = new TimepadAdapter();
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));
      const skip = Number.parseInt(url.searchParams.get('skip') ?? '0', 10);
      const count = skip <= 500 ? 100 : skip === 600 ? 2 : 0;
      return jsonResponse({
        values: Array.from({ length: count }, (_, index) =>
          timepadEvent(skip + index, index === 1 && skip === 600 ? '2026-06-20T19:00:00.000Z' : '2026-05-06T19:00:00.000Z'),
        ),
      });
    });

    const items = await adapter.fetchItems(fetchInput());
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));

    expect(urls.some((url) => url.includes('skip=600'))).toBe(true);
    expect(urls.some((url) => url.includes('skip=700'))).toBe(false);
    expect(items).toHaveLength(601);
    expect(items.every((item) => item.startsAt == null || item.startsAt <= fetchInput().to)).toBe(true);
  });

  it('loads AdvCake feed url and maps Ticketland YML offers', async () => {
    process.env.ADVCAKE_API_PASS = 'fake-pass';
    const adapter = new AdvCakeTicketlandAdapter();
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/common-feeds')) {
        expect(url).toContain('offer_id=663');
        expect(url).toContain('pass=fake-pass');
        return jsonResponse({
          data: [
            { format: 'csv', url: 'https://feeds.advcake.ru/csv-feed' },
            { format: 'yml', url: 'https://feeds.advcake.ru/yml-feed' },
          ],
        });
      }
      expect(url).toBe('https://feeds.advcake.ru/yml-feed');
      return textResponse(ticketlandYml());
    });

    const items = await adapter.fetchItems(fetchInput());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceCode: 'advcake_ticketland',
      sourceItemId: 'offer-100',
      contentKind: 'event',
      city: 'Москва',
      title: 'Большой стендап',
      category: 'comedy',
      venueName: 'Клуб',
      imageUrl: 'https://api.live.mts.ru/web-api/v3/image-scaling/?ScalingFactor=4&Url=https%3A%2F%2Fmedia.ticketland.ru%2Fimages%2F250x250%2F24%2F16%2Fimage.png',
      actionUrl: 'https://go.avred.online/click',
      actionKind: 'affiliate_ticket',
      priceMode: 'paid',
      isAffiliate: true,
      sourceProvider: 'Ticketland / MTS Live',
      priceFrom: 1500,
      currency: 'RUB',
      description: 'Описание & детали',
    });
    expect(items[0]?.startsAt?.toISOString()).toBe('2026-05-05T16:00:00.000Z');
  });

  it('maps Ticketland sport offers to the affiche sport category', async () => {
    process.env.ADVCAKE_API_PASS = 'fake-pass';
    const adapter = new AdvCakeTicketlandAdapter();
    jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ feeds: [{ format: 'yml', url: 'https://feeds.advcake.ru/yml-feed' }] }) as any)
      .mockResolvedValueOnce(textResponse(ticketlandYml({
        typePrefix: 'Спорт',
        title: 'ЦСКА - Локомотив. Матч 2',
      })) as any);

    const items = await adapter.fetchItems(fetchInput());

    expect(items).toHaveLength(1);
    expect(items[0]?.category).toBe('sport');
  });

  it('keeps Ticketland offers for supported million-plus city regions', async () => {
    process.env.ADVCAKE_API_PASS = 'fake-pass';
    const adapter = new AdvCakeTicketlandAdapter();
    jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ feeds: [{ format: 'yml', url: 'https://feeds.advcake.ru/yml-feed' }] }) as any)
      .mockResolvedValueOnce(textResponse(ticketlandYml({
        region: 'Казань',
        title: 'Казанский концерт',
      })) as any);

    const items = await adapter.fetchItems(fetchInput({ city: 'Казань', cityCode: 'kzn' }));

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      city: 'Казань',
      title: 'Казанский концерт',
    });
  });

  it('filters AdvCake offers by city, date and required fields', async () => {
    process.env.ADVCAKE_API_PASS = 'fake-pass';
    const adapter = new AdvCakeTicketlandAdapter();
    jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ feeds: [{ format: 'yml', url: 'https://feeds.advcake.ru/yml-feed' }] }) as any)
      .mockResolvedValueOnce(textResponse(ticketlandYml({
        extraOffers: `
          <offer id="101"><url>https://go.avred.online/spb</url><price>2000</price><currencyId>RUB</currencyId><model>СПб</model><vendor>Зал</vendor><typePrefix>Драмы</typePrefix><region>Санкт-Петербург</region><date>2026-05-05 19:00:00</date></offer>
          <offer id="102"><url>https://go.avred.online/late</url><price>2000</price><currencyId>RUB</currencyId><model>Поздно</model><vendor>Зал</vendor><typePrefix>Рок</typePrefix><region>Москва</region><date>2026-07-05 19:00:00</date></offer>
          <offer id="103"><price>2000</price><currencyId>RUB</currencyId><model>Без ссылки</model><vendor>Зал</vendor><typePrefix>Рок</typePrefix><region>Москва</region><date>2026-05-05 19:00:00</date></offer>
        `,
      })) as any);

    const items = await adapter.fetchItems(fetchInput());

    expect(items.map((item) => item.sourceItemId)).toEqual(['offer-100']);
  });

  it('rejects non-allowlisted AdvCake feed urls and skips unsafe action urls', async () => {
    process.env.ADVCAKE_API_PASS = 'fake-pass';
    const adapter = new AdvCakeTicketlandAdapter();
    jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ feeds: [{ format: 'yml', url: 'https://evil.example/feed.yml' }] }) as any);

    await expect(adapter.fetchItems(fetchInput())).rejects.toThrow('advcake_feed_url_forbidden');

    jest.restoreAllMocks();
    const safeAdapter = new AdvCakeTicketlandAdapter();
    jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ feeds: [{ format: 'yml', url: 'https://feeds.advcake.ru/yml-feed' }] }) as any)
      .mockResolvedValueOnce(textResponse(ticketlandYml({ url: 'http://ticketland.ru/not-https' })) as any);

    await expect(safeAdapter.fetchItems(fetchInput())).resolves.toHaveLength(0);
  });

  it('imports outdoor and bike places from Overpass tags', async () => {
    const adapter = new OverpassAdapter();
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ elements: [] }) as any);

    await adapter.fetchItems(fetchInput());

    const body = fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams;
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    const query = body.get('data') ?? '';
    expect(query).toContain('"amenity"="bicycle_rental"');
    expect(query).toContain('"tourism"="picnic_site"');
    expect(query).toContain('"tourism"="viewpoint"');
    expect(query).toContain('out center;');
    expect(query).not.toContain('out center 500;');
    expect(headers.Accept).toBe('application/json');
    expect(headers['User-Agent']).toBe('FrendlyRouteImporter/1.0');
  });

  it('runs Overpass imports for million-plus cities outside Moscow and Saint Petersburg', async () => {
    const adapter = new OverpassAdapter();
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ elements: [] }) as any);

    await adapter.fetchItems(fetchInput({ city: 'Пермь', cityCode: 'Пермь' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(body.get('data')).toContain('57.85,55.80,58.10,56.45');
  });

  it('loads Tomesto Moscow pages, skips unsafe links, parses details and appends ref query', async () => {
    process.env.TOMESTO_REF_QUERY = 'utm_source=frendly&ref=unit';
    process.env.TOMESTO_REQUEST_DELAY_MS = '0';
    const adapter = new TomestoAdapter();
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/moskva/places') {
        return textResponse(`
          <a href="/moskva/places/cafe-one">place</a>
          <a href="/moskva/places/cafe-one/reservations/new">bad</a>
          <a href="/moskva/places/favorite">favorite</a>
          <a href="/moskva/places/cafe-one/occurrences/1">occurrence</a>
        `);
      }
      if (url.pathname === '/moskva/places/page/2') {
        return textResponse('<a href="/moskva/places/cafe-one">duplicate</a>');
      }
      if (url.pathname === '/moskva/events') {
        expect(url.searchParams.get('date_from')).toBe('2026-05-04');
        expect(url.searchParams.get('date_to')).toBe('2026-06-03');
        return textResponse('<a href="/moskva/events/standup-night">event</a>');
      }
      if (url.pathname === '/moskva/events/page/2') {
        return textResponse('');
      }
      if (url.pathname === '/moskva/promos') {
        return textResponse(`
          <a href="/moskva/promos/birthday-sale">birthday promo</a>
          <a href="/moskva/promos/birthday-gift">birthday gift</a>
          <a href="/moskva/promos/den-rozhdeniya/birthday-menu">birthday menu</a>
          <a href="/moskva/promos/bankety/banquet-discount">banquet promo</a>
          <a href="/moskva/promos/svadby/wedding-offer">wedding promo</a>
          <a href="/moskva/promos/wine-set">regular promo</a>
        `);
      }
      if (url.pathname === '/moskva/promos/page/2') {
        return textResponse('');
      }
      if (url.pathname === '/moskva/places/cafe-one') {
        return textResponse(tomestoPlaceHtml());
      }
      if (url.pathname === '/moskva/events/standup-night') {
        return textResponse(tomestoEventHtml());
      }
      if (url.pathname === '/moskva/promos/birthday-sale') {
        return textResponse(tomestoBirthdayPromoHtml());
      }
      if (url.pathname === '/moskva/promos/birthday-gift') {
        return textResponse(tomestoBirthdayGiftPromoHtml());
      }
      if (url.pathname === '/moskva/promos/den-rozhdeniya/birthday-menu') {
        return textResponse(tomestoBirthdayMenuPromoHtml());
      }
      if (url.pathname === '/moskva/promos/bankety/banquet-discount') {
        return textResponse(tomestoBanquetPromoHtml());
      }
      if (url.pathname === '/moskva/promos/svadby/wedding-offer') {
        return textResponse(tomestoWeddingPromoHtml());
      }
      if (url.pathname === '/moskva/promos/wine-set') {
        return textResponse(tomestoPromoHtml());
      }
      throw new Error(`unexpected_url_${url.pathname}`);
    });

    const items = await adapter.fetchItems(fetchInput({ cityCode: 'moskva' }));

    expect(fetchMock.mock.calls.map((call) => new URL(String(call[0])).pathname)).not.toContain('/moskva/places/cafe-one/reservations/new');
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      sourceCode: 'tomesto',
      sourceItemId: 'place:cafe-one',
      contentKind: 'place',
      city: 'Москва',
      title: 'Кафе Центр',
      address: 'Москва, Тверская, 1',
      lat: 55.7601,
      lng: 37.6187,
      priceFrom: 900,
      imageUrl: null,
      actionKind: 'affiliate_booking',
      isAffiliate: true,
      sourceProvider: 'ТоМесто',
      raw: expect.objectContaining({
        taxonomy: expect.objectContaining({
          metro: ['teatralnaya'],
          features: expect.arrayContaining(['business_lunch', 'summer_terrace']),
        }),
      }),
    });
    expect(items[0]?.tags).toEqual(expect.arrayContaining([
      'area:center',
      'occasion:food',
      'budget:cheap',
      'metro:teatralnaya',
      'feature:business_lunch',
      'feature:summer_terrace',
      'set:nedorogie-restorany-v-tsentre',
    ]));
    expect(items[0]?.actionUrl).toBe('https://tomesto.ru/moskva/places/cafe-one?existing=1&utm_source=frendly&ref=unit');
    expect(items[1]).toMatchObject({
      sourceItemId: 'event:stendap:standup-night',
      contentKind: 'event',
      title: 'Стендап вечер',
      venueName: 'Клуб',
      category: 'comedy',
      priceFrom: 1200,
      priceMode: 'paid',
    });
    expect(items[1]?.startsAt?.toISOString()).toBe('2026-05-12T16:00:00.000Z');
    expect(items[2]).toMatchObject({
      sourceItemId: 'promo:skidki:wine-set',
      contentKind: 'event',
      category: 'promo',
      raw: expect.objectContaining({ kind: 'promo' }),
    });
    expect(items.map((item) => item.sourceItemId)).not.toContain('promo:birthday:birthday-sale');
    expect(items.map((item) => item.sourceItemId)).not.toContain('promo:birthday:birthday-gift');
    expect(items.map((item) => item.sourceItemId)).not.toContain('promo:den-rozhdeniya:birthday-menu');
    expect(items.map((item) => item.sourceItemId)).not.toContain('promo:bankety:banquet-discount');
    expect(items.map((item) => item.sourceItemId)).not.toContain('promo:svadby:wedding-offer');
  });

  it('loads Tomesto catalog places from sitemap slices without events or promos', async () => {
    process.env.TOMESTO_REQUEST_DELAY_MS = '0';
    const adapter = new TomestoAdapter();
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/moskva/sitemap.xml') {
        return textResponse(`
          <urlset>
            <url><loc>https://tomesto.ru/moskva/places/bankets</loc></url>
            <url><loc>https://tomesto.ru/moskva/places/cafe-one</loc></url>
            <url><loc>https://tomesto.ru/moskva/places/cafe-two</loc></url>
            <url><loc>https://tomesto.ru/moskva/places/cafe-two/reviews</loc></url>
            <url><loc>https://tomesto.ru/moskva/events/standup-night</loc></url>
          </urlset>
        `);
      }
      if (url.pathname === '/moskva/places/cafe-one') {
        return textResponse(tomestoPlaceHtml());
      }
      throw new Error(`unexpected_url_${url.pathname}`);
    });

    const items = await adapter.fetchItems(fetchInput({
      cityCode: 'moskva',
      importMode: 'tomesto_places_catalog',
      catalogOffset: 0,
      catalogLimit: 1,
    } as any));

    expect(fetchMock.mock.calls.map((call) => new URL(String(call[0])).pathname)).toEqual([
      '/moskva/sitemap.xml',
      '/moskva/places/cafe-one',
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceItemId: 'place:cafe-one',
      contentKind: 'place',
      raw: expect.objectContaining({
        catalog: {
          mode: 'tomesto_places_catalog',
          offset: 0,
          limit: 1,
          total: 2,
        },
      }),
    });
  });

  it('returns no Tomesto items outside Moscow and logs a warning', async () => {
    process.env.TOMESTO_REQUEST_DELAY_MS = '0';
    const adapter = new TomestoAdapter();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(textResponse('') as any);

    const items = await adapter.fetchItems(fetchInput({ city: 'Санкт-Петербург', cityCode: 'spb' }));

    expect(items).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('[tomesto] skipped unsupported city', expect.objectContaining({
      city: 'Санкт-Петербург',
    }));
  });
});

function fetchInput(overrides: Partial<ReturnType<typeof fetchInputBase>> = {}) {
  return {
    ...fetchInputBase(),
    ...overrides,
  };
}

function fetchInputBase() {
  return {
    city: 'Москва',
    cityCode: 'msk',
    timezone: 'Europe/Moscow',
    from: new Date('2026-05-04T00:00:00.000Z'),
    to: new Date('2026-06-03T00:00:00.000Z'),
    signal: new AbortController().signal,
  };
}

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload,
    headers: { get: () => null },
  } as unknown as Response;
}

function textResponse(payload: string) {
  return {
    ok: true,
    text: async () => payload,
    headers: { get: () => String(Buffer.byteLength(payload, 'utf8')) },
  } as unknown as Response;
}

function kudagoEvent(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Событие ${id}`,
    site_url: `https://example.com/events/${id}`,
    categories: ['concert'],
    dates: [{ start: 1770000000, end: 1770003600 }],
    place: {
      id: 1,
      title: 'Парк',
      address: 'Москва, Парк',
      coords: { lat: 55.75, lon: 37.61 },
    },
    price: '500',
    ...overrides,
  };
}

function timepadEvent(id: number, startsAt: string) {
  return {
    id,
    name: `Timepad ${id}`,
    url: `https://example.com/timepad/${id}`,
    starts_at: startsAt,
    ends_at: '2026-05-06T20:00:00.000Z',
    price_min: 500,
    location: {
      address: 'Москва, Парк',
      latitude: 55.75,
      longitude: 37.61,
    },
    categories: [{ name: 'outdoor' }],
  };
}

function tomestoPlaceHtml() {
  return `
    <html>
      <head>
        <link rel="canonical" href="https://tomesto.ru/moskva/places/cafe-one?existing=1">
        <meta name="description" content="Короткое описание места">
      </head>
      <body>
        <h1>Кафе Центр</h1>
        <a class="place-category" href="/moskva/places/restorany">Ресторан</a>
        <a href="/moskva/places/nedorogie-restorany-v-tsentre">Подборка</a>
        <div itemprop="address">Москва, Тверская, 1</div>
        <div class="average-check">Средний чек 900 руб</div>
        <span data-metro="Театральная"></span>
        <ul class="features">
          <li>Бизнес-ланч</li>
          <li>Летняя веранда</li>
        </ul>
        <script type="application/ld+json">
          {"@type":"Restaurant","geo":{"latitude":55.7601,"longitude":37.6187},"aggregateRating":{"ratingValue":"4.7"}}
        </script>
      </body>
    </html>
  `;
}

function tomestoEventHtml() {
  return `
    <html>
      <head>
        <link rel="canonical" href="https://tomesto.ru/moskva/events/standup-night">
        <meta name="description" content="Смешной вечер в центре">
      </head>
      <body>
        <h1>Стендап вечер</h1>
        <a class="event-category" href="/moskva/events/stendap">Стендап</a>
        <div class="venue"><a>Клуб</a></div>
        <time datetime="2026-05-12T19:00:00+03:00">12 мая</time>
        <div class="price">от 1200 руб</div>
      </body>
    </html>
  `;
}

function tomestoBirthdayPromoHtml() {
  return `
    <html>
      <head>
        <link rel="canonical" href="https://tomesto.ru/moskva/promos/birthday-sale">
      </head>
      <body>
        <h1>Скидка на день рождения</h1>
        <a class="promo-category" href="/moskva/promos/birthday">birthday</a>
        <div class="promo-place"><a>Кафе Центр</a></div>
        <time datetime="2026-05-15T12:00:00+03:00">15 мая</time>
      </body>
    </html>
  `;
}

function tomestoBirthdayGiftPromoHtml() {
  return `
    <html>
      <head>
        <link rel="canonical" href="https://tomesto.ru/moskva/promos/birthday-gift">
      </head>
      <body>
        <h1>Подарок в день рождения</h1>
        <a class="promo-category" href="/moskva/promos/birthday">birthday</a>
        <div class="promo-place"><a>Кафе Центр</a></div>
        <time datetime="2026-05-15T12:00:00+03:00">15 мая</time>
      </body>
    </html>
  `;
}

function tomestoBirthdayMenuPromoHtml() {
  return `
    <html>
      <head>
        <link rel="canonical" href="https://tomesto.ru/moskva/promos/den-rozhdeniya/birthday-menu">
      </head>
      <body>
        <h1>Меню на день рождения</h1>
        <a class="promo-category" href="/moskva/promos/den-rozhdeniya">День рождения</a>
        <div class="promo-place"><a>Кафе Центр</a></div>
        <time datetime="2026-05-15T12:00:00+03:00">15 мая</time>
      </body>
    </html>
  `;
}

function tomestoBanquetPromoHtml() {
  return `
    <html>
      <head>
        <link rel="canonical" href="https://tomesto.ru/moskva/promos/bankety/banquet-discount">
      </head>
      <body>
        <h1>Скидка 10% на банкеты</h1>
        <a class="promo-category" href="/moskva/promos/bankety">Банкеты</a>
        <div class="promo-place"><a>Кафе Центр</a></div>
        <time datetime="2026-05-15T12:00:00+03:00">15 мая</time>
      </body>
    </html>
  `;
}

function tomestoWeddingPromoHtml() {
  return `
    <html>
      <head>
        <link rel="canonical" href="https://tomesto.ru/moskva/promos/svadby/wedding-offer">
      </head>
      <body>
        <h1>Свадебный банкет без аренды зала</h1>
        <a class="promo-category" href="/moskva/promos/svadby">Свадьбы</a>
        <div class="promo-place"><a>Кафе Центр</a></div>
        <time datetime="2026-05-15T12:00:00+03:00">15 мая</time>
      </body>
    </html>
  `;
}

function tomestoPromoHtml() {
  return `
    <html>
      <head>
        <link rel="canonical" href="https://tomesto.ru/moskva/promos/wine-set">
      </head>
      <body>
        <h1>Винный сет в подарок</h1>
        <a class="promo-category" href="/moskva/promos/skidki">Скидки</a>
        <div class="promo-place"><a>Кафе Центр</a></div>
        <time datetime="2026-05-15T12:00:00+03:00">15 мая</time>
      </body>
    </html>
  `;
}

function ticketlandYml(options: {
  extraOffers?: string;
  region?: string;
  title?: string;
  typePrefix?: string;
  url?: string;
} = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog>
  <shop>
    <offers>
      <offer id="100">
        <url>${options.url ?? 'https://go.avred.online/click'}</url>
        <picture>https://api.live.mts.ru/web-api/v3/image-scaling/?ScalingFactor=2&amp;Url=https%3A%2F%2Fmedia.ticketland.ru%2Fimages%2F250x250%2F24%2F16%2Fimage.png</picture>
        <price>1500</price>
        <currencyId>RUB</currencyId>
        <model>${options.title ?? 'Большой стендап'}</model>
        <vendor>Клуб</vendor>
        <categoryId>10</categoryId>
        <typePrefix>${options.typePrefix ?? 'Комедии'}</typePrefix>
        <region>${options.region ?? 'Москва'}</region>
        <date>2026-05-05 19:00:00</date>
        <description>&lt;p&gt;Описание &amp;amp; детали&lt;/p&gt;</description>
        <age>18+</age>
      </offer>
      ${options.extraOffers ?? ''}
    </offers>
  </shop>
</yml_catalog>`;
}
