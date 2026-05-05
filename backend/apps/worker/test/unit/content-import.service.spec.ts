import { ContentImportService } from '../../src/content/content-import.service';
import { ContentNormalizerService } from '../../src/content/content-normalizer.service';
import type { ExternalSourceAdapter } from '../../src/content/content-source.types';

describe('ContentImportService', () => {
  const originalAdvCakePass = process.env.ADVCAKE_API_PASS;
  const originalIncludeUnmonetizedPaid = process.env.CONTENT_IMPORT_INCLUDE_UNMONETIZED_PAID;

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalAdvCakePass == null) {
      delete process.env.ADVCAKE_API_PASS;
    } else {
      process.env.ADVCAKE_API_PASS = originalAdvCakePass;
    }
    if (originalIncludeUnmonetizedPaid == null) {
      delete process.env.CONTENT_IMPORT_INCLUDE_UNMONETIZED_PAID;
    } else {
      process.env.CONTENT_IMPORT_INCLUDE_UNMONETIZED_PAID = originalIncludeUnmonetizedPaid;
    }
  });

  it('creates runs, upserts source and items, and records counters', async () => {
    const sourceCreate = jest.fn().mockResolvedValue({ id: 'source-1', code: 'kudago' });
    const runCreate = jest.fn().mockResolvedValue({ id: 'run-1' });
    const runUpdate = jest.fn().mockResolvedValue({});
    const itemUpsert = jest.fn().mockResolvedValue({});
    const itemUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
    const adapter: ExternalSourceAdapter = {
      code: 'kudago',
      fetchItems: jest.fn().mockResolvedValue([
        {
          sourceCode: 'kudago',
          sourceItemId: 'place-1',
          contentKind: 'place',
          city: 'Москва',
          timezone: 'Europe/Moscow',
          title: 'Кофейня',
          category: 'cafe',
          lat: 55.75,
          lng: 37.61,
          priceFrom: null,
          raw: {},
        },
      ]),
    };
    const service = new ContentImportService(
      {
        client: {
          externalContentSource: { upsert: sourceCreate, update: jest.fn().mockResolvedValue({}) },
          externalImportRun: { create: runCreate, update: runUpdate },
          externalContentItem: { upsert: itemUpsert, updateMany: itemUpdateMany },
        },
      } as any,
      new ContentNormalizerService(),
      {
        getAdapters: () => [adapter],
        getAdapter: () => adapter,
        getInfo: () => ({
          code: 'kudago',
          name: 'KudaGo',
          kind: 'events_places',
          baseUrl: 'https://kudago.com/public-api/v1.4',
        }),
      } as any,
    );

    await service.runImport({
      city: 'Москва',
      sources: ['kudago'],
      from: new Date('2026-05-04T00:00:00.000Z'),
      to: new Date('2026-05-11T00:00:00.000Z'),
    });

    expect(sourceCreate).toHaveBeenCalledWith(expect.objectContaining({
      where: { code: 'kudago' },
    }));
    expect(itemUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { sourceId_sourceItemId: { sourceId: 'source-1', sourceItemId: 'place-1' } },
      create: expect.objectContaining({
        priceMode: 'unknown',
        publicStatus: 'published',
      }),
    }));
    expect(runUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'run-1' },
      data: expect.objectContaining({
        status: 'completed',
        fetchedCount: 1,
        normalizedCount: 1,
        publishedCount: 1,
        unknownPriceCount: 1,
        missingCoordsCount: 0,
      }),
    }));
  });

  it('imports adapter batches without collecting the whole feed first', async () => {
    const itemUpsert = jest.fn().mockResolvedValue({});
    const fetchItems = jest.fn().mockResolvedValue([]);
    const service = new ContentImportService(
      prismaMock({
        source: { id: 'source-1', code: 'kudago' },
        itemUpsert,
      }) as any,
      new ContentNormalizerService(),
      registryMock({
        code: 'kudago',
        fetchItems,
        fetchBatches: async function* () {
          yield [
            rawEvent({ sourceItemId: 'event-1', priceFrom: 0 }),
            rawEvent({ sourceItemId: 'event-2', priceFrom: 0 }),
          ];
          yield [
            rawEvent({ sourceItemId: 'event-3', priceFrom: 0 }),
          ];
        },
      }),
    );

    await service.runImport({
      city: 'Москва',
      sources: ['kudago'],
      from: new Date('2026-05-04T00:00:00.000Z'),
      to: new Date('2026-05-11T00:00:00.000Z'),
    });

    expect(fetchItems).not.toHaveBeenCalled();
    expect(itemUpsert).toHaveBeenCalledTimes(3);
  });

  it('mirrors imported external images before saving content items', async () => {
    const itemUpsert = jest.fn().mockResolvedValue({});
    const imageMirror = {
      mirrorExternalImage: jest.fn().mockImplementation(async (item) => ({
        ...item,
        imageUrl: 'https://cdn.frendly.tech/external-content/kudago/event-1.jpg',
      })),
    };
    const service = new ContentImportService(
      prismaMock({
        source: { id: 'source-1', code: 'kudago' },
        itemUpsert,
      }) as any,
      new ContentNormalizerService(),
      registryMock({
        code: 'kudago',
        fetchItems: jest.fn().mockResolvedValue([
          rawEvent({
            sourceItemId: 'event-1',
            imageUrl: 'https://kudago.com/images/event-1.jpg',
          }),
        ]),
      }),
      imageMirror as any,
    );

    await service.runImport({
      city: 'Москва',
      sources: ['kudago'],
      from: new Date('2026-05-04T00:00:00.000Z'),
      to: new Date('2026-05-11T00:00:00.000Z'),
    });

    expect(imageMirror.mirrorExternalImage).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: 'https://kudago.com/images/event-1.jpg',
      }),
    );
    expect(itemUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        imageUrl: 'https://cdn.frendly.tech/external-content/kudago/event-1.jpg',
      }),
      update: expect.objectContaining({
        imageUrl: 'https://cdn.frendly.tech/external-content/kudago/event-1.jpg',
      }),
    }));
  });

  it('preloads event duplicates once per source day instead of querying per item', async () => {
    const itemFindMany = jest.fn().mockResolvedValue([]);
    const service = new ContentImportService(
      prismaMock({
        source: { id: 'source-1', code: 'kudago' },
        itemFindMany,
      }) as any,
      new ContentNormalizerService(),
      registryMock({
        code: 'kudago',
        fetchItems: jest.fn().mockResolvedValue(
          Array.from({ length: 100 }, (_, index) =>
            rawEvent({
              sourceItemId: `event-${index}`,
              title: `Событие ${index}`,
              priceFrom: 0,
            }),
          ),
        ),
      }),
    );

    await service.runImport({
      city: 'Москва',
      sources: ['kudago'],
      from: new Date('2026-05-04T00:00:00.000Z'),
      to: new Date('2026-05-11T00:00:00.000Z'),
    });

    expect(itemFindMany).toHaveBeenCalledTimes(1);
    expect(itemFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        city: 'Москва',
        contentKind: 'event',
      }),
    }));
  });

  it('publishes only monetized paid events and exact free KudaGo or Timepad events', async () => {
    const itemUpsert = jest.fn().mockResolvedValue({});
    const service = new ContentImportService(
      prismaMock({
        source: { id: 'source-1', code: 'kudago' },
        itemUpsert,
      }) as any,
      new ContentNormalizerService(),
      registryMock({
        code: 'kudago',
        fetchItems: jest.fn().mockResolvedValue([
          rawEvent({ sourceItemId: 'free', priceFrom: 0 }),
          rawEvent({ sourceItemId: 'paid', priceFrom: 500 }),
          rawEvent({ sourceItemId: 'unknown', priceFrom: null }),
        ]),
      }),
    );

    await service.runImport({
      city: 'Москва',
      sources: ['kudago'],
      from: new Date('2026-05-04T00:00:00.000Z'),
      to: new Date('2026-05-11T00:00:00.000Z'),
    });

    const publicStatuses = itemUpsert.mock.calls.map((call) => call[0].create.publicStatus);
    expect(publicStatuses).toEqual(['published', 'hidden', 'hidden']);
  });

  it('keeps AdvCake paid affiliate events public and masks secrets on failure', async () => {
    process.env.ADVCAKE_API_PASS = 'fake-unit-pass';
    const runUpdate = jest.fn().mockResolvedValue({});
    const service = new ContentImportService(
      prismaMock({
        source: { id: 'source-1', code: 'advcake_ticketland' },
        runUpdate,
      }) as any,
      new ContentNormalizerService(),
      registryMock({
        code: 'advcake_ticketland',
        fetchItems: jest.fn().mockRejectedValue(
          new Error('https://api.advcake.com/common-feeds?pass=fake-unit-pass&offer_id=663 failed'),
        ),
      }),
    );

    await service.runImport({
      city: 'Москва',
      sources: ['advcake_ticketland'],
      from: new Date('2026-05-04T00:00:00.000Z'),
      to: new Date('2026-05-11T00:00:00.000Z'),
    });

    const failedUpdate = runUpdate.mock.calls.find((call) => call[0].data.status === 'failed')?.[0];
    expect(failedUpdate.data.errorMessage).toContain('pass=***');
    expect(failedUpdate.data.errorMessage).not.toContain('fake-unit-pass');
  });

  it('publishes paid AdvCake event when affiliate action is present', async () => {
    const itemUpsert = jest.fn().mockResolvedValue({});
    const service = new ContentImportService(
      prismaMock({
        source: { id: 'source-1', code: 'advcake_ticketland' },
        itemUpsert,
      }) as any,
      new ContentNormalizerService(),
      registryMock({
        code: 'advcake_ticketland',
        fetchItems: jest.fn().mockResolvedValue([
          rawEvent({
            sourceCode: 'advcake_ticketland',
            sourceItemId: 'ticket-1',
            priceFrom: 1500,
            actionUrl: 'https://go.avred.online/click',
            actionKind: 'affiliate_ticket',
            isAffiliate: true,
          }),
        ]),
      }),
    );

    await service.runImport({
      city: 'Москва',
      sources: ['advcake_ticketland'],
      from: new Date('2026-05-04T00:00:00.000Z'),
      to: new Date('2026-05-11T00:00:00.000Z'),
    });

    expect(itemUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        priceMode: 'paid',
        publicStatus: 'published',
        actionKind: 'affiliate_ticket',
        isAffiliate: true,
      }),
    }));
  });

  it('enriches AdvCake duplicate with KudaGo coordinates and hides source duplicate', async () => {
    const itemUpsert = jest.fn().mockResolvedValue({});
    const itemUpdate = jest.fn().mockResolvedValue({});
    const service = new ContentImportService(
      prismaMock({
        source: { id: 'source-advcake', code: 'advcake_ticketland' },
        itemUpsert,
        itemFindMany: jest.fn().mockResolvedValue([
          {
            id: 'kudago-item',
            sourceItemId: 'event-k1',
            source: { code: 'kudago', name: 'KudaGo' },
            sourceUrl: 'https://kudago.com/event',
            contentKind: 'event',
            city: 'Москва',
            title: 'Событие',
            venueName: 'Клуб',
            address: 'Тверская 1',
            lat: 55.75,
            lng: 37.61,
            startsAt: new Date('2026-05-05T15:00:00.000Z'),
            raw: {},
          },
        ]),
        itemUpdate,
      }) as any,
      new ContentNormalizerService(),
      registryMock({
        code: 'advcake_ticketland',
        fetchItems: jest.fn().mockResolvedValue([
          rawEvent({
            sourceCode: 'advcake_ticketland',
            sourceItemId: 'ticket-1',
            venueName: 'Клуб',
            priceFrom: 1500,
            actionUrl: 'https://go.avred.online/click',
            actionKind: 'affiliate_ticket',
            isAffiliate: true,
          }),
        ]),
      }),
    );

    await service.runImport({
      city: 'Москва',
      sources: ['advcake_ticketland'],
      from: new Date('2026-05-04T00:00:00.000Z'),
      to: new Date('2026-05-11T00:00:00.000Z'),
    });

    expect(itemUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        sourceItemId: 'ticket-1',
        address: 'Тверская 1',
        lat: 55.75,
        lng: 37.61,
        publicStatus: 'published',
        raw: expect.objectContaining({
          enrichment: expect.objectContaining({
            sourceCode: 'kudago',
            confidence: 'high',
            role: 'affiliate_event_enriched',
          }),
        }),
      }),
    }));
    expect(itemUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'kudago-item' },
      data: expect.objectContaining({
        publicStatus: 'hidden',
      }),
    }));
  });

  it('enriches an existing AdvCake item when a free source duplicate arrives later', async () => {
    const itemUpsert = jest.fn().mockResolvedValue({});
    const itemUpdate = jest.fn().mockResolvedValue({});
    const service = new ContentImportService(
      prismaMock({
        source: { id: 'source-kudago', code: 'kudago' },
        itemUpsert,
        itemFindMany: jest.fn().mockResolvedValue([
          {
            id: 'advcake-item',
            sourceItemId: 'ticket-1',
            source: { code: 'advcake_ticketland', name: 'AdvCake Ticketland' },
            sourceUrl: 'https://go.avred.online/click',
            actionUrl: 'https://go.avred.online/click',
            contentKind: 'event',
            city: 'Москва',
            title: 'Событие',
            venueName: 'Клуб',
            address: null,
            lat: null,
            lng: null,
            startsAt: new Date('2026-05-05T15:00:00.000Z'),
            priceMode: 'paid',
            publicStatus: 'published',
            raw: {},
          },
        ]),
        itemUpdate,
      }) as any,
      new ContentNormalizerService(),
      registryMock({
        code: 'kudago',
        fetchItems: jest.fn().mockResolvedValue([
          rawEvent({
            sourceCode: 'kudago',
            sourceItemId: 'event-k1',
            priceFrom: 0,
            venueName: 'Клуб',
            address: 'Тверская 1',
            lat: 55.75,
            lng: 37.61,
          }),
        ]),
      }),
    );

    await service.runImport({
      city: 'Москва',
      sources: ['kudago'],
      from: new Date('2026-05-04T00:00:00.000Z'),
      to: new Date('2026-05-11T00:00:00.000Z'),
    });

    expect(itemUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'advcake-item' },
      data: expect.objectContaining({
        address: 'Тверская 1',
        lat: 55.75,
        lng: 37.61,
        publicStatus: 'published',
        raw: expect.objectContaining({
          enrichment: expect.objectContaining({
            sourceCode: 'kudago',
            sourceItemId: 'event-k1',
            role: 'affiliate_event_enriched',
          }),
        }),
      }),
    }));
    expect(itemUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        sourceItemId: 'event-k1',
        publicStatus: 'hidden',
        raw: expect.objectContaining({
          enrichment: expect.objectContaining({
            sourceCode: 'advcake_ticketland',
            role: 'duplicate_of_affiliate_event',
          }),
        }),
      }),
    }));
  });
});

function prismaMock(options: {
  source: { id: string; code: string };
  itemUpsert?: jest.Mock;
  itemFindMany?: jest.Mock;
  itemUpdate?: jest.Mock;
  runUpdate?: jest.Mock;
}) {
  return {
    client: {
      externalContentSource: {
        upsert: jest.fn().mockResolvedValue(options.source),
        update: jest.fn().mockResolvedValue({}),
      },
      externalImportRun: {
        create: jest.fn().mockResolvedValue({ id: 'run-1' }),
        update: options.runUpdate ?? jest.fn().mockResolvedValue({}),
      },
      externalContentItem: {
        upsert: options.itemUpsert ?? jest.fn().mockResolvedValue({}),
        findMany: options.itemFindMany ?? jest.fn().mockResolvedValue([]),
        update: options.itemUpdate ?? jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    },
  };
}

function registryMock(adapter: ExternalSourceAdapter) {
  return {
    getAdapters: () => [adapter],
    getAdapter: () => adapter,
    getInfo: () => ({
      code: adapter.code,
      name: adapter.code,
      kind: adapter.code === 'advcake_ticketland' ? 'affiliate_events' : 'events_places',
      baseUrl: 'https://example.com',
    }),
  } as any;
}

function rawEvent(overrides: Record<string, unknown> = {}) {
  return {
    sourceCode: 'kudago',
    sourceItemId: 'event-1',
    contentKind: 'event',
    city: 'Москва',
    timezone: 'Europe/Moscow',
    title: 'Событие',
    category: 'concert',
    startsAt: new Date('2026-05-05T16:00:00.000Z'),
    raw: {},
    ...overrides,
  } as any;
}
