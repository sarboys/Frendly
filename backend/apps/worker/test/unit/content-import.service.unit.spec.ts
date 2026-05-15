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
