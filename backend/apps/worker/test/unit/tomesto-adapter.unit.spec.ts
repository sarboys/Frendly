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
    expect(fetchSpy).toHaveBeenCalledTimes(5);
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
