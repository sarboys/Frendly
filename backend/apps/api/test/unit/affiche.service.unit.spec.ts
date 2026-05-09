import { AfficheService } from '../../src/services/affiche.service';

describe('AfficheService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    jest.restoreAllMocks();
    for (const key of [
      'S3_ACCESS_KEY',
      'S3_SECRET_KEY',
      'S3_BUCKET',
      'S3_PUBLIC_ENDPOINT',
      'S3_CDN_ENDPOINT',
    ]) {
      delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('lists only public event content and applies filters', async () => {
    const findMany = jest.fn().mockResolvedValue([
      afficheItem({
        id: 'event-1',
        source: { code: 'advcake_ticketland', name: 'AdvCake Ticketland' },
      }),
    ]);
    const service = new AfficheService({
      client: {
        externalContentItem: {
          findMany,
        },
      },
    } as any);

    const result = await service.listEvents({
      city: 'Москва',
      date: '2026-05-05',
      priceMode: 'paid',
      source: 'advcake_ticketland',
      category: 'comedy',
      featured: 'true',
      q: 'стендап',
      limit: '10',
    });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        city: 'Москва',
        contentKind: 'event',
        publicStatus: 'published',
        priceMode: 'paid',
        source: { code: 'advcake_ticketland' },
        category: 'comedy',
        imageUrl: { not: null },
      }),
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: 11,
    }));
    const findManyArgs = findMany.mock.calls[0][0];
    expect(findManyArgs).not.toHaveProperty('include');
    expect(findManyArgs.select).toEqual(expect.objectContaining({
      id: true,
      title: true,
      shortSummary: true,
      source: { select: { code: true, name: true } },
    }));
    expect(findManyArgs.select).not.toHaveProperty('raw');
    expect(findManyArgs.select).not.toHaveProperty('normalizedHash');
    expect(findManyArgs.select).not.toHaveProperty('importRunId');
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'event-1',
        priceMode: 'paid',
        sourceCode: 'advcake_ticketland',
        actionUrl: 'https://go.avred.online/click',
        actionKind: 'affiliate_ticket',
        isAffiliate: true,
        venue: 'Клуб',
      }),
    ]);
  });

  it('does not expose places through affiche detail', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new AfficheService({
      client: {
        externalContentItem: {
          findFirst,
        },
      },
    } as any);

    await expect(service.getEvent('place-1')).rejects.toMatchObject({
      code: 'affiche_event_not_found',
    });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'place-1',
        contentKind: 'event',
        publicStatus: 'published',
        priceMode: { in: ['free', 'paid'] },
      }),
    }));
    const findFirstArgs = findFirst.mock.calls[0][0];
    expect(findFirstArgs).not.toHaveProperty('include');
    expect(findFirstArgs.select).not.toHaveProperty('raw');
  });

  it('maps mirrored S3 event images to API proxy paths', async () => {
    process.env.S3_ACCESS_KEY = 'tenant-id:key-id';
    process.env.S3_SECRET_KEY = 'secret';
    process.env.S3_BUCKET = 'frendly-backet';
    process.env.S3_PUBLIC_ENDPOINT = 'https://s3.twcstorage.ru';
    process.env.S3_CDN_ENDPOINT = 'https://cdn.frendly.tech';

    const findMany = jest.fn().mockResolvedValue([
      afficheItem({
        imageUrl:
          'https://cdn.frendly.tech/external-content/advcake_ticketland/image.jpg',
      }),
    ]);
    const service = new AfficheService({
      client: {
        externalContentItem: {
          findMany,
        },
      },
    } as any);

    const result = await service.listEvents({ city: 'Москва', limit: '1' });

    expect(result.items[0]?.imageUrl).toBe(
      '/affiche/images?key=external-content%2Fadvcake_ticketland%2Fimage.jpg',
    );
  });

  it('maps mirrored S3 event image variants to API proxy paths', async () => {
    process.env.S3_ACCESS_KEY = 'tenant-id:key-id';
    process.env.S3_SECRET_KEY = 'secret';
    process.env.S3_BUCKET = 'frendly-backet';
    process.env.S3_PUBLIC_ENDPOINT = 'https://s3.twcstorage.ru';
    process.env.S3_CDN_ENDPOINT = 'https://cdn.frendly.tech';

    const findMany = jest.fn().mockResolvedValue([
      afficheItem({
        imageUrl:
          'https://cdn.frendly.tech/external-content/advcake_ticketland/image.jpg',
        imageVariants: {
          rail: {
            url: 'https://cdn.frendly.tech/external-content/advcake_ticketland/image-rail.webp',
            downloadUrl:
              'https://cdn.frendly.tech/external-content/advcake_ticketland/image-rail.webp',
            mimeType: 'image/webp',
            byteSize: 12000,
            cacheKey: 'external-content-image-rail',
          },
          hero: {
            url: 'https://cdn.frendly.tech/external-content/advcake_ticketland/image-hero.webp',
            downloadUrl:
              'https://cdn.frendly.tech/external-content/advcake_ticketland/image-hero.webp',
            mimeType: 'image/webp',
            byteSize: 74000,
            cacheKey: 'external-content-image-hero',
          },
        },
      }),
    ]);
    const service = new AfficheService({
      client: {
        externalContentItem: {
          findMany,
        },
      },
    } as any);

    const result = await service.listEvents({ city: 'Москва', limit: '1' });

    expect((result.items[0] as any)?.imageVariants).toMatchObject({
      rail: {
        url: '/affiche/images?key=external-content%2Fadvcake_ticketland%2Fimage-rail.webp',
        downloadUrl:
          '/affiche/images?key=external-content%2Fadvcake_ticketland%2Fimage-rail.webp',
        mimeType: 'image/webp',
        byteSize: 12000,
        cacheKey: 'external-content-image-rail',
      },
      hero: {
        url: '/affiche/images?key=external-content%2Fadvcake_ticketland%2Fimage-hero.webp',
      },
    });
  });

  it('maps safe third-party event image URLs to API proxy paths', async () => {
    const findMany = jest.fn().mockResolvedValue([
      afficheItem({
        imageUrl:
          'https://api.live.mts.ru/web-api/v3/image-scaling/?ScalingFactor=4&Url=https%3A%2F%2Fmedia.ticketland.ru%2Fimage.jpg',
      }),
    ]);
    const service = new AfficheService({
      client: {
        externalContentItem: {
          findMany,
        },
      },
    } as any);

    const result = await service.listEvents({ city: 'Москва', limit: '1' });

    expect(result.items[0]?.imageUrl).toBe(
      '/affiche/images?url=https%3A%2F%2Fapi.live.mts.ru%2Fweb-api%2Fv3%2Fimage-scaling%2F%3FScalingFactor%3D4%26Url%3Dhttps%253A%252F%252Fmedia.ticketland.ru%252Fimage.jpg',
    );
  });

  it('streams mirrored affiche images through the API proxy', async () => {
    process.env.S3_ACCESS_KEY = 'tenant-id:key-id';
    process.env.S3_SECRET_KEY = 'secret';
    process.env.S3_BUCKET = 'frendly-backet';
    process.env.S3_PUBLIC_ENDPOINT = 'https://s3.twcstorage.ru';
    process.env.S3_CDN_ENDPOINT = 'https://cdn.frendly.tech';
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('image-bytes', {
        status: 200,
        headers: {
          'content-type': 'image/jpeg',
          'content-length': '11',
        },
      }) as any,
    );
    const service = new AfficheService({
      client: {
        externalContentItem: {},
      },
    } as any);

    const image = await service.getImage('external-content/item.jpg');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(image).toMatchObject({
      cacheControl: 'public, max-age=31536000, immutable',
      etag: expect.stringContaining('affiche-image-'),
      mimeType: 'image/jpeg',
      contentLength: 11,
    });
    expect('stream' in image).toBe(true);
  });

  it('streams safe third-party affiche images through the API proxy', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('image-bytes', {
        status: 200,
        headers: {
          'content-type': 'image/jpeg',
          'content-length': '11',
        },
      }) as any,
    );
    const service = new AfficheService({
      client: {
        externalContentItem: {},
      },
    } as any);
    const imageUrl =
      'https://api.live.mts.ru/web-api/v3/image-scaling/?ScalingFactor=4&Url=https%3A%2F%2Fmedia.ticketland.ru%2Fimage.jpg';

    const image = await service.getImage(undefined, imageUrl);

    expect(fetchSpy).toHaveBeenCalledWith('https://media.ticketland.ru/image.jpg', {
      headers: expect.objectContaining({
        accept: expect.stringContaining('image/'),
        'user-agent': expect.stringContaining('FrendlyImageProxy'),
      }),
    });
    expect(image).toMatchObject({
      cacheControl: 'public, max-age=86400, stale-while-revalidate=604800',
      etag: expect.stringContaining('affiche-image-'),
      mimeType: 'image/jpeg',
      contentLength: 11,
    });
    expect('stream' in image).toBe(true);
  });
});

function afficheItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    title: 'Большой стендап',
    shortSummary: 'Вечер комедии',
    city: 'Москва',
    timezone: 'Europe/Moscow',
    venueName: 'Клуб',
    address: null,
    lat: null,
    lng: null,
    startsAt: new Date('2026-05-05T16:00:00.000Z'),
    endsAt: null,
    category: 'comedy',
    priceFrom: 1500,
    priceMode: 'paid',
    currency: 'RUB',
    imageUrl: 'https://ticketland.ru/image.jpg',
    sourceProvider: 'Ticketland / MTS Live',
    actionUrl: 'https://go.avred.online/click',
    actionKind: 'affiliate_ticket',
    isAffiliate: true,
    tags: ['18+'],
    source: { code: 'advcake_ticketland', name: 'AdvCake Ticketland' },
    ...overrides,
  };
}
