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

  it('uses fallback draft when OpenRouter times out', async () => {
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
        status: 'completed',
        responseJson: expect.objectContaining({
          fallback: true,
          reasonCode: 'openrouter_timeout',
        }),
      }),
    }));
    expect(draftCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'needs_review',
        validationStatus: 'valid',
      }),
    }));
  });

  it('uses fallback draft instead of saving empty OpenRouter route objects', async () => {
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
        status: 'completed',
        responseJson: expect.objectContaining({
          fallback: true,
          reasonCode: 'openrouter_invalid_route_draft',
        }),
      }),
    }));
    expect(draftCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'needs_review',
        validationStatus: 'valid',
        steps: expect.objectContaining({
          create: expect.arrayContaining([
            expect.objectContaining({ externalContentItemId: 'item-1' }),
            expect.objectContaining({ externalContentItemId: 'item-2' }),
          ]),
        }),
      }),
    }));
  });

  it('uses fallback draft when OpenRouter returns invalid JSON', async () => {
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
                mood: 'social',
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
            502,
            'openrouter_invalid_json',
            'OpenRouter returned invalid JSON',
          ),
        ),
      } as any,
    );

    await service.processPendingManualBatches();

    expect(batchUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'batch-1' },
      data: expect.objectContaining({
        status: 'completed',
        responseJson: expect.objectContaining({
          fallback: true,
          reasonCode: 'openrouter_invalid_json',
        }),
      }),
    }));
    expect(draftCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'needs_review',
        validationStatus: 'valid',
      }),
    }));
  });

  it('selects timed events and flexible places as separate pools before fallback generation', async () => {
    const batchUpdate = jest.fn().mockResolvedValue({});
    const draftCreate = jest.fn().mockResolvedValue({});
    const eventItem = {
      id: 'event-1',
      sourceUrl: 'https://example.com/event',
      contentKind: 'event',
      city: 'Москва',
      title: 'Лекция о городе',
      shortSummary: 'Спокойное событие вечером',
      category: 'lecture',
      address: 'Никольская, 12',
      lat: 55.751,
      lng: 37.609,
      startsAt: new Date('2026-05-05T16:00:00.000Z'),
      endsAt: new Date('2026-05-05T17:00:00.000Z'),
      priceFrom: 500,
      source: { name: 'Timepad', code: 'timepad' },
    };
    const placeItem = {
      id: 'cafe-1',
      sourceUrl: 'https://example.com/cafe',
      contentKind: 'place',
      city: 'Москва',
      title: 'Кофейня рядом',
      shortSummary: 'Кофе перед событием',
      category: 'cafe',
      address: 'Никольская, 10',
      lat: 55.750,
      lng: 37.608,
      startsAt: null,
      endsAt: null,
      priceFrom: 300,
      source: { name: 'OSM Overpass', code: 'overpass' },
    };
    const findMany = jest.fn((query: any) => Promise.resolve(
      query.where.contentKind === 'event' ? [eventItem] : [placeItem],
    ));
    const service = new RouteDraftGenerationService(
      {
        client: {
          externalContentItem: { findMany },
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
            502,
            'openrouter_invalid_json',
            'OpenRouter returned invalid JSON',
          ),
        ),
      } as any,
    );

    await service.processPendingManualBatches();

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ contentKind: 'event' }),
    }));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ contentKind: 'place' }),
    }));
    expect(batchUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'batch-1' },
      data: expect.objectContaining({ status: 'completed' }),
    }));
    const createArg = draftCreate.mock.calls[0]?.[0];
    expect(createArg.data.validationStatus).toBe('valid');
    expect(new Set(createArg.data.steps.create.map((step: any) => step.externalContentItemId))).toEqual(
      new Set(['cafe-1', 'event-1']),
    );
  });

  it('rejects invalid OpenRouter drafts and saves a valid fallback instead', async () => {
    const batchUpdate = jest.fn().mockResolvedValue({});
    const draftCreate = jest.fn().mockResolvedValue({});
    const service = new RouteDraftGenerationService(
      {
        client: {
          externalContentItem: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'cafe-1',
                sourceUrl: 'https://example.com/cafe',
                contentKind: 'place',
                city: 'Москва',
                title: 'Кафе у театра',
                shortSummary: 'Тихое место перед событием',
                category: 'food',
                address: 'Петровка, 1',
                lat: 55.761,
                lng: 37.62,
                startsAt: null,
                endsAt: null,
                priceFrom: 400,
                source: { name: 'OSM Overpass', code: 'overpass' },
              },
              {
                id: 'quest-1',
                sourceUrl: 'https://example.com/quest',
                contentKind: 'event',
                city: 'Москва',
                title: 'Квест «Тайная комната»',
                shortSummary: 'Командный квест на вечер',
                category: 'quest',
                address: 'Петровка, 3',
                lat: 55.762,
                lng: 37.621,
                startsAt: new Date('2026-05-05T17:00:00.000Z'),
                endsAt: new Date('2026-05-05T18:45:00.000Z'),
                priceFrom: 1200,
                source: { name: 'KudaGo', code: 'kudago' },
              },
            ]),
          },
          generatedRouteDraftBatch: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'batch-1',
                city: 'Москва',
                area: null,
                mood: 'active',
                budget: 'mid',
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
                title: 'Квест после кофе',
                description: 'Кофе и квест рядом.',
                vibe: 'активно',
                durationLabel: '2 часа',
                totalPriceFrom: 1600,
                goal: 'social',
                steps: [
                  { externalContentItemId: 'cafe-1', timeLabel: '19:00', endTimeLabel: '19:45', kind: 'cafe', title: 'Кофе', venue: 'Кафе у театра', address: 'Петровка, 1', emoji: '☕', distanceLabel: 'старт', walkMin: 0, lat: 55.761, lng: 37.62 },
                  { externalContentItemId: 'quest-1', timeLabel: '20:00', endTimeLabel: '20:45', kind: 'quest', title: 'Квест', venue: 'Квест «Тайная комната»', address: 'Петровка, 3', emoji: '✨', distanceLabel: '5 минут пешком', walkMin: 5, lat: 55.762, lng: 37.621 },
                ],
              },
            ],
          },
          latencyMs: 10,
        }),
      } as any,
    );

    await service.processPendingManualBatches();

    expect(batchUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'batch-1' },
      data: expect.objectContaining({
        status: 'completed',
        responseJson: expect.objectContaining({
          fallback: true,
          reasonCode: 'openrouter_invalid_route_draft',
        }),
      }),
    }));
    const createArg = draftCreate.mock.calls[0]?.[0];
    expect(createArg.data.validationStatus).toBe('valid');
    expect(createArg.data.validationIssues).toEqual([]);
    expect(createArg.data.steps.create).toEqual(expect.arrayContaining([
      expect.objectContaining({ externalContentItemId: 'cafe-1' }),
      expect.objectContaining({
        externalContentItemId: 'quest-1',
        timeLabel: '20:00',
        endTimeLabel: '21:45',
      }),
    ]));
  });

  it('rejects OpenRouter drafts with two events of the same category', async () => {
    const batchUpdate = jest.fn().mockResolvedValue({});
    const draftCreate = jest.fn().mockResolvedValue({});
    const service = new RouteDraftGenerationService(
      {
        client: {
          externalContentItem: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'quest-1',
                sourceUrl: 'https://example.com/quest-1',
                contentKind: 'event',
                city: 'Москва',
                title: 'Квест «Один из нас»',
                shortSummary: 'Командный квест',
                category: 'quest',
                address: 'Вернисажная, 6',
                lat: 55.751,
                lng: 37.610,
                startsAt: new Date('2026-05-05T16:00:00.000Z'),
                endsAt: new Date('2026-05-05T17:00:00.000Z'),
                priceFrom: 1000,
                source: { name: 'KudaGo', code: 'kudago' },
              },
              {
                id: 'quest-2',
                sourceUrl: 'https://example.com/quest-2',
                contentKind: 'event',
                city: 'Москва',
                title: 'Квест «Мгла»',
                shortSummary: 'Еще один квест',
                category: 'quest',
                address: 'Советская, 80',
                lat: 55.760,
                lng: 37.620,
                startsAt: new Date('2026-05-05T17:30:00.000Z'),
                endsAt: new Date('2026-05-05T18:30:00.000Z'),
                priceFrom: 1000,
                source: { name: 'KudaGo', code: 'kudago' },
              },
              {
                id: 'cafe-1',
                sourceUrl: 'https://example.com/cafe',
                contentKind: 'place',
                city: 'Москва',
                title: 'Кафе рядом',
                shortSummary: 'Кофе перед событием',
                category: 'food',
                address: 'Вернисажная, 8',
                lat: 55.752,
                lng: 37.611,
                startsAt: null,
                endsAt: null,
                priceFrom: 400,
                source: { name: 'OSM Overpass', code: 'overpass' },
              },
            ]),
          },
          generatedRouteDraftBatch: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'batch-1',
                city: 'Москва',
                area: null,
                mood: 'active',
                budget: 'mid',
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
                title: 'Вечер квестов с друзьями',
                description: 'Два квеста подряд.',
                vibe: 'активно',
                durationLabel: '2 часа',
                totalPriceFrom: 2000,
                goal: 'social',
                steps: [
                  { externalContentItemId: 'quest-1', timeLabel: '19:00', endTimeLabel: '20:00', kind: 'quest', title: 'Квест', venue: 'Квест «Один из нас»', address: 'Вернисажная, 6', emoji: '✨', distanceLabel: 'старт', walkMin: 0, lat: 55.751, lng: 37.610 },
                  { externalContentItemId: 'quest-2', timeLabel: '20:30', endTimeLabel: '21:30', kind: 'quest', title: 'Квест', venue: 'Квест «Мгла»', address: 'Советская, 80', emoji: '✨', distanceLabel: '15 минут пешком', walkMin: 15, lat: 55.760, lng: 37.620 },
                ],
              },
            ],
          },
          latencyMs: 10,
        }),
      } as any,
    );

    await service.processPendingManualBatches();

    expect(batchUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'batch-1' },
      data: expect.objectContaining({
        status: 'completed',
        responseJson: expect.objectContaining({
          fallback: true,
          reasonCode: 'openrouter_invalid_route_draft',
        }),
      }),
    }));
    const createArg = draftCreate.mock.calls[0]?.[0];
    expect(createArg.data.validationStatus).toBe('valid');
    expect(createArg.data.steps.create.filter((step: any) => step.kind === 'quest')).toHaveLength(1);
  });

  it('uses fallback routes with one timed anchor and no repeated venue cluster', async () => {
    const batchUpdate = jest.fn().mockResolvedValue({});
    const draftCreate = jest.fn().mockResolvedValue({});
    const service = new RouteDraftGenerationService(
      {
        client: {
          externalContentItem: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'quest-1',
                sourceUrl: 'https://example.com/quest-1',
                contentKind: 'event',
                city: 'Москва',
                title: 'Квест «Один из нас»',
                shortSummary: 'Командный квест',
                category: 'quest',
                address: 'Советская, 80',
                lat: 55.751,
                lng: 37.61,
                startsAt: new Date('2026-05-05T16:00:00.000Z'),
                endsAt: new Date('2026-05-05T17:30:00.000Z'),
                priceFrom: 1200,
                source: { name: 'KudaGo', code: 'kudago' },
              },
              {
                id: 'quest-2',
                sourceUrl: 'https://example.com/quest-2',
                contentKind: 'event',
                city: 'Москва',
                title: 'Квест «Мгла»',
                shortSummary: 'Еще один квест',
                category: 'quest',
                address: 'Советская, 80, стр. 10',
                lat: 55.75101,
                lng: 37.61001,
                startsAt: new Date('2026-05-05T17:00:00.000Z'),
                endsAt: new Date('2026-05-05T18:30:00.000Z'),
                priceFrom: 1200,
                source: { name: 'KudaGo', code: 'kudago' },
              },
              {
                id: 'quest-3',
                sourceUrl: 'https://example.com/quest-3',
                contentKind: 'event',
                city: 'Москва',
                title: 'Квест «Зло внутри»',
                shortSummary: 'Третий квест',
                category: 'quest',
                address: 'Советская, 80, стр. 10',
                lat: 55.75102,
                lng: 37.61002,
                startsAt: new Date('2026-05-05T18:00:00.000Z'),
                endsAt: new Date('2026-05-05T19:30:00.000Z'),
                priceFrom: 1200,
                source: { name: 'KudaGo', code: 'kudago' },
              },
              {
                id: 'cafe-1',
                sourceUrl: 'https://example.com/cafe',
                contentKind: 'place',
                city: 'Москва',
                title: 'Кафе на углу',
                shortSummary: 'Еда перед активностью',
                category: 'food',
                address: 'Советская, 70',
                lat: 55.752,
                lng: 37.612,
                startsAt: null,
                endsAt: null,
                priceFrom: 600,
                source: { name: 'OSM Overpass', code: 'overpass' },
              },
              {
                id: 'bar-1',
                sourceUrl: 'https://example.com/bar',
                contentKind: 'place',
                city: 'Москва',
                title: 'Бар после игры',
                shortSummary: 'Место для обсуждения',
                category: 'bar',
                address: 'Советская, 72',
                lat: 55.753,
                lng: 37.613,
                startsAt: null,
                endsAt: null,
                priceFrom: 700,
                source: { name: 'OSM Overpass', code: 'overpass' },
              },
            ]),
          },
          generatedRouteDraftBatch: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'batch-1',
                city: 'Москва',
                area: null,
                mood: 'active',
                budget: 'mid',
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

    const createArg = draftCreate.mock.calls[0]?.[0];
    const steps = createArg.data.steps.create;
    expect(steps.filter((step: any) => step.kind === 'quest')).toHaveLength(1);
    expect(new Set(steps.map((step: any) => step.externalContentItemId))).toEqual(
      new Set(['cafe-1', 'quest-1', 'bar-1']),
    );
    expect(steps.find((step: any) => step.externalContentItemId === 'quest-1')).toEqual(
      expect.objectContaining({
        timeLabel: '19:00',
        endTimeLabel: '20:30',
      }),
    );
    expect(createArg.data).toEqual(expect.objectContaining({
      validationStatus: 'valid',
      durationLabel: '3.5 часа',
    }));
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
