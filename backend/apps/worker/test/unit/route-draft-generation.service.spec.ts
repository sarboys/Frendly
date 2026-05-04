import { OpenRouterClientError } from '@big-break/database';
import { RouteDraftGenerationService } from '../../src/content/route-draft-generation.service';

describe('RouteDraftGenerationService', () => {
  it('saves generated review drafts without publishing routes', async () => {
    const batchCreate = jest.fn().mockResolvedValue({ id: 'batch-1' });
    const batchUpdate = jest.fn().mockResolvedValue({});
    const draftCreate = jest.fn().mockResolvedValue({});
    const service = new RouteDraftGenerationService(
      {
        client: {
          externalContentItem: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'item-1',
                sourceItemId: 'place-1',
                sourceUrl: 'https://example.com/place',
                contentKind: 'place',
                city: 'Москва',
                title: 'Кофейня',
                shortSummary: 'Тихий кофе',
                category: 'food',
                address: 'Тверская, 1',
                lat: 55.75,
                lng: 37.61,
                startsAt: null,
                priceFrom: 300,
                source: { name: 'KudaGo', code: 'kudago' },
              },
              {
                id: 'item-2',
                sourceItemId: 'place-2',
                sourceUrl: 'https://example.com/museum',
                contentKind: 'place',
                city: 'Москва',
                title: 'Галерея',
                shortSummary: 'Небольшая выставка',
                category: 'culture',
                address: 'Арбат, 2',
                lat: 55.751,
                lng: 37.609,
                startsAt: null,
                priceFrom: 0,
                source: { name: 'OSM Overpass', code: 'overpass' },
              },
            ]),
          },
          generatedRouteDraftBatch: {
            create: batchCreate,
            update: batchUpdate,
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          generatedRouteReviewDraft: { create: draftCreate },
        },
      } as any,
      {
        configuredModel: 'test-model',
        generateJson: jest.fn().mockResolvedValue({
          rawResponse: { choices: [] },
          parsedJson: {
            routes: [
              {
                title: 'Тихий центр',
                description: 'Кофе и галерея рядом.',
                vibe: 'спокойно',
                durationLabel: '2 часа',
                totalPriceFrom: 300,
                goal: 'social',
                recommendedFor: 'друзья',
                steps: [
                  { externalContentItemId: 'item-1', timeLabel: '19:00', kind: 'cafe', title: 'Кофе', venue: 'Кофейня', address: 'Тверская, 1', emoji: '☕', distanceLabel: '10 минут', walkMin: 10, lat: 55.75, lng: 37.61 },
                  { externalContentItemId: 'item-2', timeLabel: '20:00', kind: 'gallery', title: 'Выставка', venue: 'Галерея', address: 'Арбат, 2', emoji: '🖼️', distanceLabel: '10 минут', walkMin: 10, lat: 55.751, lng: 37.609 },
                ],
              },
            ],
          },
          latencyMs: 10,
        }),
      } as any,
    );

    await service.generateForCity({ city: 'Москва', area: null, mood: 'calm', budget: 'low', maxDrafts: 2 });

    expect(batchCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ city: 'Москва', status: 'running' }),
    }));
    expect(draftCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'needs_review' }),
    }));
  });

  it('processes pending manual generation batches from admin', async () => {
    const batchUpdate = jest.fn().mockResolvedValue({});
    const draftCreate = jest.fn().mockResolvedValue({});
    const service = new RouteDraftGenerationService(
      {
        client: {
          externalContentItem: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'item-1',
                sourceUrl: 'https://example.com/place',
                contentKind: 'place',
                city: 'Москва',
                title: 'Кофейня',
                shortSummary: 'Тихий кофе',
                category: 'food',
                address: 'Тверская, 1',
                lat: 55.75,
                lng: 37.61,
                startsAt: null,
                priceFrom: 300,
                source: { name: 'KudaGo', code: 'kudago' },
              },
              {
                id: 'item-2',
                sourceUrl: 'https://example.com/event',
                contentKind: 'event',
                city: 'Москва',
                title: 'Экскурсия',
                shortSummary: 'Прогулка',
                category: 'culture',
                address: 'Никольская, 12',
                lat: 55.751,
                lng: 37.609,
                startsAt: new Date('2026-05-05T16:00:00.000Z'),
                priceFrom: 500,
                source: { name: 'Timepad', code: 'timepad' },
              },
            ]),
          },
          generatedRouteDraftBatch: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'batch-1',
                city: 'Москва',
                area: null,
                mood: 'calm',
                budget: 'low',
                requestJson: { maxDrafts: 1 },
              },
            ]),
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            update: batchUpdate,
          },
          generatedRouteReviewDraft: { create: draftCreate },
        },
      } as any,
      {
        generateJson: jest.fn().mockResolvedValue({
          rawResponse: { choices: [] },
          parsedJson: {
            routes: [
              {
                title: 'Центр без спешки',
                description: 'Кофе и прогулка рядом.',
                vibe: 'спокойно',
                durationLabel: '2 часа',
                totalPriceFrom: 800,
                goal: 'social',
                steps: [
                  { externalContentItemId: 'item-1', timeLabel: '19:00', kind: 'cafe', title: 'Кофе', venue: 'Кофейня', address: 'Тверская, 1', emoji: '☕', distanceLabel: '10 минут', walkMin: 10, lat: 55.75, lng: 37.61 },
                  { externalContentItemId: 'item-2', timeLabel: '20:00', kind: 'walk', title: 'Прогулка', venue: 'Экскурсия', address: 'Никольская, 12', emoji: '🚶', distanceLabel: '10 минут', walkMin: 10, lat: 55.751, lng: 37.609 },
                ],
              },
            ],
          },
          latencyMs: 10,
        }),
      } as any,
    );

    await service.processPendingManualBatches();

    expect(batchUpdate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { id: 'batch-1' },
      data: expect.objectContaining({ status: 'running' }),
    }));
    expect(batchUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'batch-1' },
      data: expect.objectContaining({ status: 'completed' }),
    }));
    expect(draftCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ batchId: 'batch-1', status: 'needs_review' }),
    }));
  });

  it('stores OpenRouter timeout code on failed manual generation', async () => {
    const batchUpdate = jest.fn().mockResolvedValue({});
    const draftCreate = jest.fn().mockResolvedValue({});
    const service = new RouteDraftGenerationService(
      {
        client: {
          externalContentItem: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'item-1',
                sourceUrl: 'https://example.com/place',
                contentKind: 'place',
                city: 'Москва',
                title: 'Кофейня',
                shortSummary: 'Тихий кофе',
                category: 'food',
                address: 'Тверская, 1',
                lat: 55.75,
                lng: 37.61,
                startsAt: null,
                priceFrom: 300,
                source: { name: 'KudaGo', code: 'kudago' },
              },
              {
                id: 'item-2',
                sourceUrl: 'https://example.com/event',
                contentKind: 'event',
                city: 'Москва',
                title: 'Экскурсия',
                shortSummary: 'Прогулка',
                category: 'culture',
                address: 'Никольская, 12',
                lat: 55.751,
                lng: 37.609,
                startsAt: new Date('2026-05-05T16:00:00.000Z'),
                priceFrom: 500,
                source: { name: 'Timepad', code: 'timepad' },
              },
            ]),
          },
          generatedRouteDraftBatch: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'batch-1',
                city: 'Москва',
                area: null,
                mood: 'calm',
                budget: 'low',
                requestJson: { maxDrafts: 1 },
              },
            ]),
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            update: batchUpdate,
          },
          generatedRouteReviewDraft: { create: draftCreate },
        },
      } as any,
      {
        generateJson: jest.fn().mockRejectedValue(
          new OpenRouterClientError(
            504,
            'openrouter_timeout',
            'OpenRouter request timed out after 1000ms',
          ),
        ),
      } as any,
    );

    await service.processPendingManualBatches();

    expect(batchUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'batch-1' },
      data: expect.objectContaining({
        status: 'failed',
        errorCode: 'openrouter_timeout',
        errorMessage: 'OpenRouter request timed out after 1000ms',
      }),
    }));
    expect(draftCreate).not.toHaveBeenCalled();
  });

  it('fails batch instead of saving empty OpenRouter route objects', async () => {
    const batchUpdate = jest.fn().mockResolvedValue({});
    const draftCreate = jest.fn().mockResolvedValue({});
    const service = new RouteDraftGenerationService(
      {
        client: {
          externalContentItem: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'item-1',
                sourceUrl: 'https://example.com/place',
                contentKind: 'place',
                city: 'Москва',
                title: 'Кофейня',
                shortSummary: 'Тихий кофе',
                category: 'food',
                address: 'Тверская, 1',
                lat: 55.75,
                lng: 37.61,
                startsAt: null,
                priceFrom: 300,
                source: { name: 'KudaGo', code: 'kudago' },
              },
              {
                id: 'item-2',
                sourceUrl: 'https://example.com/event',
                contentKind: 'event',
                city: 'Москва',
                title: 'Экскурсия',
                shortSummary: 'Прогулка',
                category: 'culture',
                address: 'Никольская, 12',
                lat: 55.751,
                lng: 37.609,
                startsAt: new Date('2026-05-05T16:00:00.000Z'),
                priceFrom: 500,
                source: { name: 'Timepad', code: 'timepad' },
              },
            ]),
          },
          generatedRouteDraftBatch: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'batch-1',
                city: 'Москва',
                area: null,
                mood: 'calm',
                budget: 'low',
                requestJson: { maxDrafts: 1 },
              },
            ]),
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            update: batchUpdate,
          },
          generatedRouteReviewDraft: { create: draftCreate },
        },
      } as any,
      {
        generateJson: jest.fn().mockResolvedValue({
          rawResponse: { choices: [] },
          parsedJson: {
            routes: [{ '': '' }],
          },
          latencyMs: 10,
        }),
      } as any,
    );

    await service.processPendingManualBatches();

    expect(batchUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'batch-1' },
      data: expect.objectContaining({
        status: 'failed',
        errorCode: 'openrouter_invalid_route_draft',
        errorMessage: 'OpenRouter returned no route drafts with 2 to 4 steps',
      }),
    }));
    expect(draftCreate).not.toHaveBeenCalled();
  });

  it('fails stale running generation batches before processing manual queue', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new RouteDraftGenerationService(
      {
        client: {
          externalContentItem: {
            findMany: jest.fn(),
          },
          generatedRouteDraftBatch: {
            findMany,
            updateMany,
            update: jest.fn(),
          },
          generatedRouteReviewDraft: { create: jest.fn() },
        },
      } as any,
      {
        generateJson: jest.fn(),
      } as any,
    );

    await service.processPendingManualBatches();

    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'running',
        createdAt: expect.objectContaining({ lt: expect.any(Date) }),
      }),
      data: expect.objectContaining({
        status: 'failed',
        errorCode: 'route_generation_interrupted',
      }),
    }));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'pending_manual' },
    }));
  });
});
