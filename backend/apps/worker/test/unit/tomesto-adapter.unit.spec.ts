import { TomestoAdapter } from '../../src/content/tomesto.adapter';

const from = new Date('2026-05-14T00:00:00.000Z');
const to = new Date('2026-05-15T00:00:00.000Z');

describe('TomestoAdapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env = {
      ...originalEnv,
      TOMESTO_CATALOG_CONCURRENCY: '2',
      TOMESTO_CATALOG_REQUEST_DELAY_MS: '0',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('fetches catalog place pages concurrently', async () => {
    let activeDetailRequests = 0;
    let maxActiveDetailRequests = 0;
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const value = String(url);
      if (value.endsWith('/moskva/sitemap.xml')) {
        return new Response(sitemapXml(4), {
          status: 200,
          headers: { 'content-type': 'application/xml' },
        }) as any;
      }

      activeDetailRequests += 1;
      maxActiveDetailRequests = Math.max(maxActiveDetailRequests, activeDetailRequests);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeDetailRequests -= 1;
      return new Response(placeHtml(value), {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }) as any;
    });

    const items = await new TomestoAdapter().fetchItems({
      city: 'Москва',
      cityCode: 'moskva',
      timezone: 'Europe/Moscow',
      from,
      to,
      signal: new AbortController().signal,
      importMode: 'tomesto_places_catalog',
      catalogOffset: 0,
      catalogLimit: 4,
    });

    expect(items).toHaveLength(4);
    expect(maxActiveDetailRequests).toBe(2);
    const placeDetailCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes('/moskva/places/place-'),
    );
    expect(placeDetailCalls).toHaveLength(4);
  });

  it('marks permanently closed catalog places in raw status', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const value = String(url);
      if (value.endsWith('/moskva/sitemap.xml')) {
        return new Response(sitemapXml(1), {
          status: 200,
          headers: { 'content-type': 'application/xml' },
        }) as any;
      }

      return new Response(placeHtml(value, '<div>Место закрыто</div><div>навсегда</div>'), {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }) as any;
    });

    const items = await new TomestoAdapter().fetchItems({
      city: 'Москва',
      cityCode: 'moskva',
      timezone: 'Europe/Moscow',
      from,
      to,
      signal: new AbortController().signal,
      importMode: 'tomesto_places_catalog',
      catalogOffset: 0,
      catalogLimit: 1,
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.raw).toEqual(
      expect.objectContaining({
        status: expect.objectContaining({
          closed: true,
          permanentlyClosed: true,
        }),
      }),
    );
  });

  it('parses catalog promos from current Tomesto markup', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const value = String(url);
      if (value.endsWith('/moskva/sitemap.xml')) {
        return new Response(sitemapXml(1), {
          status: 200,
          headers: { 'content-type': 'application/xml' },
        }) as any;
      }
      if (value.includes('/moskva/places/place-1')) {
        return new Response(placeHtml(value), {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }) as any;
      }
      if (value.includes('/moskva/promos')) {
        if (value.includes('/promos/ostalnye/pitstsa-1-1-3')) {
          return new Response(promoHtml(value), {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }) as any;
        }
        return new Response(`
          <html>
            <body>
              <a href="https://tomesto.ru/moskva/promos/ostalnye/pitstsa-1-1-3">Пицца 1+1=3</a>
            </body>
          </html>
        `, {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }) as any;
      }

      return new Response('', {
        status: 404,
        headers: { 'content-type': 'text/html' },
      }) as any;
    });

    const items = await new TomestoAdapter().fetchItems({
      city: 'Москва',
      cityCode: 'moskva',
      timezone: 'Europe/Moscow',
      from: new Date('2026-05-26T21:00:00.000Z'),
      to: new Date('2026-06-26T21:00:00.000Z'),
      signal: new AbortController().signal,
      importMode: 'tomesto_places_catalog',
      catalogOffset: 0,
      catalogLimit: 1,
    });

    const promo = items.find((item) => (item.raw as any)?.kind === 'promo');

    expect(promo).toEqual(
      expect.objectContaining({
        title: 'Пицца 1+1=3',
        venueName: 'Листок',
        startsAt: new Date('2026-05-27T09:00:00.000Z'),
      }),
    );
    expect(promo?.raw).toEqual(
      expect.objectContaining({
        placeSlug: 'listok',
        placeSourceItemId: 'place:listok',
      }),
    );
  });
});

function sitemapXml(count: number) {
  const locs = Array.from({ length: count }, (_, index) =>
    `<url><loc>https://tomesto.ru/moskva/places/place-${index + 1}</loc></url>`,
  ).join('');
  return `<urlset>${locs}</urlset>`;
}

function placeHtml(sourceUrl: string, bodyExtra = '') {
  return `
    <html>
      <head>
        <link rel="canonical" href="${sourceUrl}" />
        <meta name="description" content="Описание" />
      </head>
      <body>
        <h1>Заведение</h1>
        <address>Москва, Тверская, 1</address>
        <script type="application/ld+json">
          {"geo":{"latitude":55.7558,"longitude":37.6173}}
        </script>
        ${bodyExtra}
      </body>
    </html>
  `;
}

function promoHtml(sourceUrl: string) {
  return `
    <html>
      <head>
        <link rel="canonical" href="${sourceUrl}" />
        <meta name="description" content="Закажите 2 пиццы и получите третью в подарок." />
      </head>
      <body>
        <h1>
          <span class="uptitle">
            <a href="https://tomesto.ru/moskva/promos">Акции и скидки</a>:
            <a href="https://tomesto.ru/moskva/promos/ostalnye">Остальные</a>
          </span>
          <span class="text-3xl sm:text-4xl break-words">Пицца 1+1=3</span>
          <div class="mt-2 mb-1">в кафе
            <a href="https://tomesto.ru/moskva/places/listok">Листок</a>
          </div>
        </h1>
        <div class="row occurrences">
          <h4>Ближайшие даты</h4>
          <div class="flex flex-col md:flex-row justify-between flex-wrap gap-2 bg-sky-50 even:bg-sky-100 p-2">
            <div title="">
              <span class="font-semibold">27 мая,</span>
              весь день
            </div>
            <a href="https://tomesto.ru/moskva/promos/ostalnye/pitstsa-1-1-3/occurrences/2648782/book">Забронировать</a>
          </div>
        </div>
      </body>
    </html>
  `;
}
