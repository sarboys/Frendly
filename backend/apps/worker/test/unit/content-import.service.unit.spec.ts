import { ContentImportService } from '../../src/content/content-import.service';
import type { NormalizedExternalContentItem } from '../../src/content/content-source.types';

describe('ContentImportService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.CONTENT_IMPORT_TIMEOUT_MS;
  });

  it('updates run counters after each fetched batch', async () => {
    const adapter = {
      code: 'kudago',
      async *fetchBatches() {
        yield [{ sourceItemId: 'one' }, { sourceItemId: 'two' }];
        yield [{ sourceItemId: 'three' }];
      },
    };
    const externalImportRunUpdate = jest.fn().mockResolvedValue({});
    const prisma = prismaMock({
      externalImportRun: {
        update: externalImportRunUpdate,
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      externalContentItem: {
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      externalContentSource: {
        update: jest.fn().mockResolvedValue({}),
      },
    });
    const service = new ContentImportService(
      prisma as any,
      {
        normalize: (raw: any) => normalizedItem(raw.sourceItemId),
      } as any,
      {
        getAdapter: () => adapter,
      } as any,
    );

    await (service as any).executeRun({
      runId: 'run-1',
      sourceId: 'source-1',
      sourceCode: 'kudago',
      city: 'Москва',
      from: new Date('2026-05-14T00:00:00.000Z'),
      to: new Date('2026-05-15T00:00:00.000Z'),
    });

    expect(externalImportRunUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'run-1' },
      data: expect.objectContaining({
        status: 'running',
        fetchedCount: 2,
        normalizedCount: 2,
      }),
    }));
    expect(externalImportRunUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'run-1' },
      data: expect.objectContaining({
        status: 'running',
        fetchedCount: 3,
        normalizedCount: 3,
      }),
    }));
    expect(externalImportRunUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'completed',
        fetchedCount: 3,
        normalizedCount: 3,
      }),
    }));
  });

  it('queues a resume run for stale Tomesto catalog imports', async () => {
    process.env.CONTENT_IMPORT_TIMEOUT_MS = '1';
    const externalImportRunCreate = jest.fn().mockResolvedValue({ id: 'resume-run' });
    const prisma = prismaMock({
      externalImportRun: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'stale-run',
            sourceId: 'tomesto-source',
            city: 'Москва',
            metadata: {
              from: '2026-05-14T00:00:00.000Z',
              to: '2026-06-13T00:00:00.000Z',
              importMode: 'tomesto_places_catalog',
              catalogOffset: 1750,
              catalogLimit: 250,
              catalogTotal: 8464,
            },
            source: { code: 'tomesto' },
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(null),
        create: externalImportRunCreate,
      },
    });
    const service = new ContentImportService(prisma as any, {} as any, {} as any);

    await (service as any).failStaleRunningRuns();

    expect(externalImportRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceId: 'tomesto-source',
        city: 'Москва',
        status: 'pending_manual',
        metadata: expect.objectContaining({
          requestedBy: 'worker-resume',
          importMode: 'tomesto_places_catalog',
          catalogOffset: 1750,
          catalogLimit: 250,
          catalogTotal: 8464,
          previousRunId: 'stale-run',
        }),
      }),
    });
  });

  it('imports permanently closed Tomesto places as hidden', async () => {
    const adapter = {
      code: 'tomesto',
      async *fetchBatches() {
        yield [{ sourceItemId: 'place:balsamiq' }];
      },
    };
    const externalContentItemUpsert = jest.fn().mockResolvedValue({});
    const prisma = prismaMock({
      externalImportRun: {
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      externalContentItem: {
        upsert: externalContentItemUpsert,
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      externalContentSource: {
        update: jest.fn().mockResolvedValue({}),
      },
    });
    const service = new ContentImportService(
      prisma as any,
      {
        normalize: () => normalizedItem('place:balsamiq', {
          sourceCode: 'tomesto',
          title: 'BalsamiQ',
          raw: {
            status: {
              closed: true,
              permanentlyClosed: true,
              label: 'Место закрыто навсегда',
            },
          },
        }),
      } as any,
      {
        getAdapter: () => adapter,
      } as any,
    );

    await (service as any).executeRun({
      runId: 'run-1',
      sourceId: 'source-1',
      sourceCode: 'tomesto',
      city: 'Москва',
      from: new Date('2026-05-14T00:00:00.000Z'),
      to: new Date('2026-05-15T00:00:00.000Z'),
    });

    expect(externalContentItemUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sourceItemId: 'place:balsamiq',
          publicStatus: 'hidden',
        }),
        update: expect.objectContaining({
          publicStatus: { set: 'hidden' },
        }),
      }),
    );
  });

  it('backfills paid Ticketland coordinates in city priority order and publishes geocoded rows', async () => {
    const moscowRow = ticketlandRow({
      id: 'ticket-moscow',
      city: 'Москва',
      address: 'Таганская площадь, 1',
      venueName: 'Театр на Таганке',
      title: 'Спектакль',
      raw: {},
    });
    const spbRow = ticketlandRow({
      id: 'ticket-spb',
      city: 'Санкт-Петербург',
      address: null,
      venueName: 'А2 Green Concert',
      title: 'Концерт',
      raw: {},
    });
    const otherRow = ticketlandRow({
      id: 'ticket-kazan',
      city: 'Казань',
      address: null,
      venueName: null,
      title: 'Казанский концерт',
      raw: {},
    });
    const findMany = jest.fn()
      .mockResolvedValueOnce([moscowRow])
      .mockResolvedValueOnce([spbRow])
      .mockResolvedValueOnce([otherRow]);
    const update = jest.fn().mockResolvedValue({});
    const geocodeOrThrow = jest.fn()
      .mockResolvedValueOnce({
        address: 'Россия, Москва, Таганская площадь, 1',
        lat: 55.742,
        lng: 37.653,
        provider: 'yandex',
        query: 'Москва, Таганская площадь, 1',
        precision: 'exact',
        kind: 'house',
      })
      .mockResolvedValueOnce({
        address: 'Россия, Санкт-Петербург, проспект Медиков',
        lat: 59.973,
        lng: 30.321,
        provider: 'yandex',
        query: 'Санкт-Петербург, А2 Green Concert',
        precision: 'exact',
        kind: 'house',
      })
      .mockResolvedValueOnce({
        address: 'Россия, Республика Татарстан, Казань',
        lat: 55.79,
        lng: 49.12,
        provider: 'yandex',
        query: 'Казань, Казанский концерт',
        precision: 'exact',
        kind: 'house',
      });
    const service = new ContentImportService(
      prismaMock({
        externalContentItem: {
          findMany,
          update,
        },
      }) as any,
      {} as any,
      {} as any,
      undefined,
      { geocodeOrThrow } as any,
    );

    const result = await service.backfillTicketlandCoordinates({ limit: 1000 });

    expect(findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ city: 'Москва' }),
    }));
    expect(findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ city: 'Санкт-Петербург' }),
    }));
    expect(findMany).toHaveBeenNthCalledWith(3, expect.objectContaining({
      where: expect.objectContaining({ city: { notIn: ['Москва', 'Санкт-Петербург'] } }),
    }));
    expect(geocodeOrThrow).toHaveBeenCalledTimes(3);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ticket-moscow' },
      data: expect.objectContaining({
        lat: 55.742,
        lng: 37.653,
        publicStatus: 'published',
        raw: expect.objectContaining({
          enrichment: expect.objectContaining({
            role: 'ticketland_geocoder_backfill',
          }),
        }),
      }),
    }));
    expect(result).toEqual(expect.objectContaining({
      scanned: 3,
      attempted: 3,
      geocoded: 3,
      stoppedReason: null,
    }));
  });

  it('stops Ticketland coordinate backfill when the geocoder limit is reached', async () => {
    const findMany = jest.fn().mockResolvedValueOnce([
      ticketlandRow({ id: 'ticket-1', city: 'Москва', address: 'Адрес 1', venueName: null, title: 'A' }),
      ticketlandRow({ id: 'ticket-2', city: 'Москва', address: 'Адрес 2', venueName: null, title: 'B' }),
    ]);
    const update = jest.fn().mockResolvedValue({});
    const error = new Error('rate limited') as Error & { statusCode: number };
    error.statusCode = 429;
    const geocodeOrThrow = jest.fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(error);
    const service = new ContentImportService(
      prismaMock({
        externalContentItem: {
          findMany,
          update,
        },
      }) as any,
      {} as any,
      {} as any,
      undefined,
      { geocodeOrThrow } as any,
    );

    const result = await service.backfillTicketlandCoordinates({ limit: 1000 });

    expect(geocodeOrThrow).toHaveBeenCalledTimes(2);
    expect(update).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      scanned: 2,
      attempted: 2,
      geocoded: 0,
      stoppedReason: 'geocoder_limited',
    }));
  });
});

function prismaMock(client: Record<string, unknown>) {
  return {
    client,
  };
}

function normalizedItem(
  sourceItemId: string,
  overrides: Partial<NormalizedExternalContentItem> = {},
): NormalizedExternalContentItem {
  return {
    sourceCode: 'kudago',
    sourceItemId,
    sourceUrl: null,
    contentKind: 'place',
    city: 'Москва',
    timezone: 'Europe/Moscow',
    area: null,
    title: sourceItemId,
    shortSummary: null,
    category: 'food',
    tags: [],
    address: 'Москва',
    lat: 55.7558,
    lng: 37.6173,
    startsAt: null,
    endsAt: null,
    priceFrom: null,
    currency: null,
    venueName: null,
    imageUrl: null,
    imageVariants: null,
    actionUrl: null,
    actionKind: null,
    priceMode: 'unknown',
    isAffiliate: false,
    sourceProvider: null,
    placeKind: 'restaurant',
    lastSeenAt: new Date('2026-05-14T00:00:00.000Z'),
    raw: {},
    normalizedHash: sourceItemId,
    expiresAt: null,
    ...overrides,
  };
}

function ticketlandRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    city: 'Москва',
    title: 'Ticketland event',
    address: null,
    venueName: 'Ticketland venue',
    lat: null,
    lng: null,
    startsAt: new Date('2026-05-25T16:00:00.000Z'),
    priceMode: 'paid',
    actionUrl: 'https://go.avred.online/click',
    publicStatus: 'hidden',
    moderationStatus: 'pending',
    raw: {},
    ...overrides,
  };
}
