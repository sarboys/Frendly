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

  it('filters standup by standup signals instead of theatre comedy category', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new AfficheService({
      client: {
        externalContentItem: {
          findMany,
        },
      },
    } as any);

    await service.listEvents({
      city: 'Москва',
      category: 'standup',
    });

    const findManyArgs = findMany.mock.calls[0][0];
    expect(findManyArgs.where).toEqual(
      expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({
            OR: expect.arrayContaining([
              { category: 'standup' },
              { title: { contains: 'стендап', mode: 'insensitive' } },
              {
                tags: {
                  array_contains: ['стендап'],
                },
              },
            ]),
          }),
        ]),
      }),
    );
    expect(findManyArgs.where).not.toEqual(
      expect.objectContaining({ category: 'comedy' }),
    );
  });

  it('prioritizes standups and concerts when no content filter is set', async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      { id: 'standup-late', startsAt: new Date('2026-05-07T16:00:00.000Z'), sortPriority: 0 },
      { id: 'concert-mid', startsAt: new Date('2026-05-06T16:00:00.000Z'), sortPriority: 1 },
      { id: 'theatre-early', startsAt: new Date('2026-05-05T16:00:00.000Z'), sortPriority: 2 },
      { id: 'next-page', startsAt: new Date('2026-05-08T16:00:00.000Z'), sortPriority: 2 },
    ]);
    const findMany = jest.fn().mockResolvedValue([
      afficheItem({ id: 'theatre-early', title: 'Ранний театр', category: 'theatre' }),
      afficheItem({ id: 'concert-mid', title: 'Большой концерт', category: 'concert' }),
      afficheItem({ id: 'standup-late', title: 'Поздний стендап', category: 'comedy' }),
    ]);
    const service = new AfficheService({
      client: {
        $queryRaw: queryRaw,
        externalContentItem: {
          findMany,
        },
      },
    } as any);

    const result = await service.listEvents({
      city: 'Москва',
      limit: '3',
    });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['standup-late', 'concert-mid', 'theatre-early'] } },
      select: expect.any(Object),
    }));
    expect(result.items.map((item) => item.id)).toEqual([
      'standup-late',
      'concert-mid',
      'theatre-early',
    ]);
    expect(result.nextCursor).toEqual(expect.any(String));
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

  it('saves valid Ticketland client coordinates and enrichment metadata', async () => {
    const findFirst = jest.fn().mockResolvedValue(
      afficheItem({
        id: 'affiche-1',
        sourceItemId: 'ticketland-1',
        city: 'Москва',
        venueName: 'Клуб 16 тонн',
        address: null,
        lat: null,
        lng: null,
        startsAt: new Date('2030-05-05T16:00:00.000Z'),
        moderationStatus: 'pending',
        raw: { ticketland: { id: 'ticketland-1' } },
      }),
    );
    const update = jest.fn().mockResolvedValue(
      afficheItem({
        id: 'affiche-1',
        address: 'Клуб 16 тонн',
        lat: 55.763,
        lng: 37.564,
      }),
    );
    const service = new AfficheService({
      client: {
        externalContentItem: {
          findFirst,
          update,
        },
        event: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      },
    } as any);

    const result = await service.saveClientGeo('affiche-1', 'user-1', 'session-1', {
      lat: 55.763,
      lng: 37.564,
      provider: 'yandex_mapkit_client',
      query: 'Москва, Клуб 16 тонн',
      displayName: 'Клуб 16 тонн',
      venueName: 'Клуб 16 тонн',
    });

    expect(result).toMatchObject({
      id: 'affiche-1',
      lat: 55.763,
      lng: 37.564,
      address: 'Клуб 16 тонн',
      saved: true,
      code: 'saved',
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'affiche-1' },
      data: expect.objectContaining({
        lat: 55.763,
        lng: 37.564,
        address: 'Клуб 16 тонн',
        publicStatus: 'published',
        raw: expect.objectContaining({
          ticketland: { id: 'ticketland-1' },
          enrichment: expect.objectContaining({
            provider: 'yandex_mapkit_client',
            role: 'client_affiche_geo_enriched',
            query: 'Москва, Клуб 16 тонн',
            displayName: 'Клуб 16 тонн',
            geoConfidence: 'client_place_search',
            updatedByUserId: 'user-1',
            fields: ['lat', 'lng', 'address'],
          }),
        }),
      }),
    });
  });

  it('publishes paid Ticketland event with actionUrl after client geo save', async () => {
    const findFirst = jest.fn().mockResolvedValue(
      afficheItem({
        id: 'affiche-1',
        venueName: 'Клуб 16 тонн',
        lat: null,
        lng: null,
        startsAt: new Date('2030-05-05T16:00:00.000Z'),
        priceMode: 'paid',
        actionUrl: 'https://go.avred.online/click',
        publicStatus: 'pending',
        moderationStatus: 'pending',
      }),
    );
    const update = jest.fn().mockResolvedValue(afficheItem({ id: 'affiche-1' }));
    const service = new AfficheService({
      client: {
        externalContentItem: { findFirst, update },
        event: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      },
    } as any);

    await service.saveClientGeo('affiche-1', 'user-1', 'session-1', {
      lat: 55.763,
      lng: 37.564,
      provider: 'yandex_mapkit_client',
      query: 'Москва, Клуб 16 тонн',
      displayName: 'Клуб 16 тонн',
      venueName: 'Клуб 16 тонн',
    });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ publicStatus: 'published' }),
    }));
  });

  it('propagates saved client coordinates to linked meetings without coordinates', async () => {
    const findFirst = jest.fn().mockResolvedValue(
      afficheItem({
        id: 'affiche-1',
        venueName: 'Клуб 16 тонн',
        lat: null,
        lng: null,
        startsAt: new Date('2030-05-05T16:00:00.000Z'),
        priceMode: 'paid',
        actionUrl: 'https://go.avred.online/click',
        publicStatus: 'published',
        moderationStatus: 'pending',
      }),
    );
    const update = jest.fn().mockResolvedValue(
      afficheItem({
        id: 'affiche-1',
        address: 'Клуб 16 тонн',
        lat: 55.763,
        lng: 37.564,
      }),
    );
    const eventUpdateMany = jest.fn().mockResolvedValue({ count: 2 });
    const service = new AfficheService({
      client: {
        externalContentItem: { findFirst, update },
        event: { updateMany: eventUpdateMany },
      },
    } as any);

    await service.saveClientGeo('affiche-1', 'user-1', 'session-1', {
      lat: 55.763,
      lng: 37.564,
      provider: 'yandex_mapkit_client',
      query: 'Москва, Клуб 16 тонн',
      displayName: 'Клуб 16 тонн',
      venueName: 'Клуб 16 тонн',
    });

    expect(eventUpdateMany).toHaveBeenCalledWith({
      where: {
        sourceExternalContentItemId: 'affiche-1',
        OR: [{ latitude: null }, { longitude: null }],
      },
      data: {
        latitude: 55.763,
        longitude: 37.564,
      },
    });
  });

  it('is idempotent for existing backend coordinates and does not overwrite them', async () => {
    const findFirst = jest.fn().mockResolvedValue(
      afficheItem({
        id: 'affiche-1',
        venueName: 'Клуб 16 тонн',
        address: 'Старая точка',
        lat: 55.7,
        lng: 37.5,
        startsAt: new Date('2030-05-05T16:00:00.000Z'),
        moderationStatus: 'pending',
      }),
    );
    const update = jest.fn();
    const service = new AfficheService({
      client: {
        externalContentItem: { findFirst, update },
      },
    } as any);

    const result = await service.saveClientGeo('affiche-1', 'user-1', 'session-1', {
      lat: 55.763,
      lng: 37.564,
      provider: 'yandex_mapkit_client',
      query: 'Москва, Клуб 16 тонн',
      displayName: 'Клуб 16 тонн',
      venueName: 'Клуб 16 тонн',
    });

    expect(result).toMatchObject({
      lat: 55.7,
      lng: 37.5,
      address: 'Старая точка',
      saved: false,
      code: 'already_has_coords',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('returns same_coords when the same client point is submitted twice', async () => {
    const findFirst = jest.fn().mockResolvedValue(
      afficheItem({
        id: 'affiche-1',
        venueName: 'Клуб 16 тонн',
        lat: 55.7630001,
        lng: 37.5640001,
        startsAt: new Date('2030-05-05T16:00:00.000Z'),
        raw: {
          enrichment: {
            provider: 'yandex_mapkit_client',
          },
        },
      }),
    );
    const service = new AfficheService({
      client: {
        externalContentItem: { findFirst, update: jest.fn() },
      },
    } as any);

    const result = await service.saveClientGeo('affiche-1', 'user-1', 'session-1', {
      lat: 55.763,
      lng: 37.564,
      provider: 'yandex_mapkit_client',
      query: 'Москва, Клуб 16 тонн',
      displayName: 'Клуб 16 тонн',
      venueName: 'Клуб 16 тонн',
    });

    expect(result.code).toBe('same_coords');
    expect(result.saved).toBe(false);
  });

  it('rejects client coordinates outside the event city bbox', async () => {
    const service = new AfficheService({
      client: {
        externalContentItem: {
          findFirst: jest.fn().mockResolvedValue(
            afficheItem({
              id: 'affiche-1',
              city: 'Москва',
              venueName: 'Клуб 16 тонн',
              startsAt: new Date('2030-05-05T16:00:00.000Z'),
            }),
          ),
          update: jest.fn(),
        },
      },
    } as any);

    await expect(
      service.saveClientGeo('affiche-1', 'user-1', 'session-1', {
        lat: 59.93,
        lng: 30.33,
        provider: 'yandex_mapkit_client',
        query: 'Москва, Клуб 16 тонн',
        displayName: 'Клуб 16 тонн',
        venueName: 'Клуб 16 тонн',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'client_geo_out_of_city_bbox',
    });
  });

  it('rejects mismatched venue names and rejected moderation', async () => {
    const service = new AfficheService({
      client: {
        externalContentItem: {
          findFirst: jest.fn().mockResolvedValue(
            afficheItem({
              id: 'affiche-1',
              venueName: 'Клуб 16 тонн',
              startsAt: new Date('2030-05-05T16:00:00.000Z'),
              moderationStatus: 'pending',
            }),
          ),
          update: jest.fn(),
        },
      },
    } as any);

    await expect(
      service.saveClientGeo('affiche-1', 'user-1', 'session-1', {
        lat: 55.763,
        lng: 37.564,
        provider: 'yandex_mapkit_client',
        query: 'Москва, Парк Горького',
        displayName: 'Парк Горького',
        venueName: 'Парк Горького',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'client_geo_venue_mismatch',
    });

    const rejectedService = new AfficheService({
      client: {
        externalContentItem: {
          findFirst: jest.fn().mockResolvedValue(
            afficheItem({
              id: 'affiche-2',
              venueName: 'Клуб 16 тонн',
              startsAt: new Date('2030-05-05T16:00:00.000Z'),
              moderationStatus: 'rejected',
            }),
          ),
          update: jest.fn(),
        },
      },
    } as any);

    await expect(
      rejectedService.saveClientGeo('affiche-2', 'user-1', 'session-1', {
        lat: 55.763,
        lng: 37.564,
        provider: 'yandex_mapkit_client',
        query: 'Москва, Клуб 16 тонн',
        displayName: 'Клуб 16 тонн',
        venueName: 'Клуб 16 тонн',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'client_geo_event_rejected',
    });
  });

  it('rate limits client geo saves per user session', async () => {
    const service = new AfficheService({
      client: {
        externalContentItem: {
          findFirst: jest.fn().mockResolvedValue(
            afficheItem({
              id: 'affiche-1',
              venueName: 'Клуб 16 тонн',
              startsAt: new Date('2030-05-05T16:00:00.000Z'),
            }),
          ),
          update: jest.fn().mockResolvedValue(afficheItem({ id: 'affiche-1' })),
        },
        event: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      },
    } as any);

    for (let index = 0; index < 10; index += 1) {
      await service.saveClientGeo(`affiche-${index}`, 'user-1', 'session-1', {
        lat: 55.763,
        lng: 37.564,
        provider: 'yandex_mapkit_client',
        query: 'Москва, Клуб 16 тонн',
        displayName: 'Клуб 16 тонн',
        venueName: 'Клуб 16 тонн',
      });
    }

    await expect(
      service.saveClientGeo('affiche-11', 'user-1', 'session-1', {
        lat: 55.763,
        lng: 37.564,
        provider: 'yandex_mapkit_client',
        query: 'Москва, Клуб 16 тонн',
        displayName: 'Клуб 16 тонн',
        venueName: 'Клуб 16 тонн',
      }),
    ).rejects.toMatchObject({
      statusCode: 429,
      code: 'client_geo_rate_limited',
    });
  });

  it('keeps mirrored S3 event images on CDN URLs', async () => {
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
      'https://cdn.frendly.tech/external-content/advcake_ticketland/image.jpg',
    );
  });

  it('cleans html entities and tags in public affiche text', async () => {
    const findMany = jest.fn().mockResolvedValue([
      afficheItem({
        title: '&laquo;Лолита 2.0&raquo;',
        shortSummary: '<p>&laquo;Лолита 2.0&raquo; &mdash; смелый спектакль&nbsp;для взрослых.</p>',
        venueName: 'Театр&nbsp;&laquo;Циники&raquo;',
        address: 'Москва, <b>Курская</b>',
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

    expect(result.items[0]).toEqual(expect.objectContaining({
      title: '«Лолита 2.0»',
      description: '«Лолита 2.0» \u2014 смелый спектакль для взрослых.',
      venue: 'Театр «Циники»',
      address: 'Москва, Курская',
    }));
  });

  it('keeps mirrored S3 event image variants on CDN URLs', async () => {
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
        url: 'https://cdn.frendly.tech/external-content/advcake_ticketland/image-rail.webp',
        downloadUrl:
          'https://cdn.frendly.tech/external-content/advcake_ticketland/image-rail.webp',
        mimeType: 'image/webp',
        byteSize: 12000,
        cacheKey: 'external-content-image-rail',
      },
      hero: {
        url: 'https://cdn.frendly.tech/external-content/advcake_ticketland/image-hero.webp',
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
