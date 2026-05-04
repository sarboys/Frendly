import { ContentImportService } from '../../src/content/content-import.service';
import { ContentNormalizerService } from '../../src/content/content-normalizer.service';
import type { ExternalSourceAdapter } from '../../src/content/content-source.types';

describe('ContentImportService', () => {
  it('creates runs, upserts source and items, and records counters', async () => {
    const sourceCreate = jest.fn().mockResolvedValue({ id: 'source-1', code: 'kudago' });
    const runCreate = jest.fn().mockResolvedValue({ id: 'run-1' });
    const runUpdate = jest.fn().mockResolvedValue({});
    const itemUpsert = jest.fn().mockResolvedValue({});
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
          raw: {},
        },
      ]),
    };
    const service = new ContentImportService(
      {
        client: {
          externalContentSource: { upsert: sourceCreate },
          externalImportRun: { create: runCreate, update: runUpdate },
          externalContentItem: { upsert: itemUpsert },
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
    }));
    expect(runUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'run-1' },
      data: expect.objectContaining({ status: 'completed', fetchedCount: 1, normalizedCount: 1 }),
    }));
  });
});
