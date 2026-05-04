import { AdvCakeTicketlandAdapter } from '../../src/content/advcake-ticketland.adapter';
import { KudaGoAdapter } from '../../src/content/kudago.adapter';
import { OverpassAdapter } from '../../src/content/overpass.adapter';
import { TimepadAdapter } from '../../src/content/timepad.adapter';

const originalTimepadToken = process.env.TIMEPAD_API_TOKEN;
const originalAdvCakePass = process.env.ADVCAKE_API_PASS;

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
      imageUrl: 'https://ticketland.ru/image.jpg',
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
});

function fetchInput() {
  return {
    city: 'Москва',
    cityCode: 'msk',
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

function kudagoEvent(id: number) {
  return {
    id,
    title: `Событие ${id}`,
    site_url: `https://example.com/events/${id}`,
    categories: ['concert'],
    dates: [{ start: 1770000000, end: 1770003600 }],
    place: {
      address: 'Москва, Парк',
      coords: { lat: 55.75, lon: 37.61 },
    },
    price: '500',
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

function ticketlandYml(options: { extraOffers?: string; url?: string } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog>
  <shop>
    <offers>
      <offer id="100">
        <url>${options.url ?? 'https://go.avred.online/click'}</url>
        <picture>https://ticketland.ru/image.jpg</picture>
        <price>1500</price>
        <currencyId>RUB</currencyId>
        <model>Большой стендап</model>
        <vendor>Клуб</vendor>
        <categoryId>10</categoryId>
        <typePrefix>Комедии</typePrefix>
        <region>Москва</region>
        <date>2026-05-05 19:00:00</date>
        <description><![CDATA[<p>Описание &amp; детали</p>]]></description>
        <age>18+</age>
      </offer>
      ${options.extraOffers ?? ''}
    </offers>
  </shop>
</yml_catalog>`;
}
