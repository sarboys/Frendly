import { KudaGoAdapter } from '../../src/content/kudago.adapter';
import { OverpassAdapter } from '../../src/content/overpass.adapter';
import { TimepadAdapter } from '../../src/content/timepad.adapter';

const originalTimepadToken = process.env.TIMEPAD_API_TOKEN;

describe('content source adapters', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalTimepadToken == null) {
      delete process.env.TIMEPAD_API_TOKEN;
    } else {
      process.env.TIMEPAD_API_TOKEN = originalTimepadToken;
    }
  });

  it('loads multiple KudaGo pages instead of only the first 100 items', async () => {
    const adapter = new KudaGoAdapter();
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));
      const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
      const isEvents = url.pathname.endsWith('/events/');
      const count = isEvents ? (page === 1 ? 100 : page === 2 ? 1 : 0) : 0;
      return jsonResponse({
        results: Array.from({ length: count }, (_, index) => kudagoEvent(page * 1000 + index)),
      });
    });

    const items = await adapter.fetchItems(fetchInput());

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes('/events/') && url.includes('page=2'))).toBe(true);
    expect(items.filter((item) => item.contentKind === 'event')).toHaveLength(101);
  });

  it('loads multiple Timepad pages and cuts events after the import window', async () => {
    process.env.TIMEPAD_API_TOKEN = 'test-token';
    const adapter = new TimepadAdapter();
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));
      const skip = Number.parseInt(url.searchParams.get('skip') ?? '0', 10);
      const count = skip === 0 ? 100 : skip === 100 ? 2 : 0;
      return jsonResponse({
        values: Array.from({ length: count }, (_, index) =>
          timepadEvent(skip + index, index === 1 && skip === 100 ? '2026-06-20T19:00:00.000Z' : '2026-05-06T19:00:00.000Z'),
        ),
      });
    });

    const items = await adapter.fetchItems(fetchInput());

    expect(items).toHaveLength(101);
    expect(items.every((item) => item.startsAt == null || item.startsAt <= fetchInput().to)).toBe(true);
  });

  it('imports outdoor and bike places from Overpass tags', async () => {
    const adapter = new OverpassAdapter();
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ elements: [] }) as any);

    await adapter.fetchItems(fetchInput());

    const body = fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams;
    const query = body.get('data') ?? '';
    expect(query).toContain('"amenity"="bicycle_rental"');
    expect(query).toContain('"tourism"="picnic_site"');
    expect(query).toContain('"tourism"="viewpoint"');
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
  } as Response;
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
