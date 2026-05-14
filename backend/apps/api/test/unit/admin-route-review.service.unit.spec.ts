import { AdminRouteReviewService } from '../../src/services/admin-route-review.service';

describe('AdminRouteReviewService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('moves drafts through approve, convert and publish without direct auto publish', async () => {
    const draftUpdate = jest
      .fn()
      .mockResolvedValueOnce(reviewDraft({ status: 'approved', reviewedAt: new Date('2026-05-04T11:00:00.000Z') }))
      .mockResolvedValueOnce(reviewDraft({ status: 'published', createdTemplateId: 'template-1', publishedAt: new Date('2026-05-04T12:00:00.000Z') }));
    const routeService = {
      createTemplate: jest.fn().mockResolvedValue({ id: 'template-1' }),
      createRevision: jest.fn().mockResolvedValue({ id: 'template-1', currentRouteId: 'route-1' }),
      publishTemplate: jest.fn().mockResolvedValue({ id: 'template-1', status: 'published' }),
    };
    const prisma = {
      client: {
        generatedRouteReviewDraft: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce(reviewDraft({ status: 'needs_review' }))
            .mockResolvedValueOnce(reviewDraft({ status: 'approved' }))
            .mockResolvedValueOnce(reviewDraft({ status: 'converted', createdTemplateId: 'template-1' })),
          update: draftUpdate,
        },
      },
    };
    const service = new AdminRouteReviewService(prisma as any, routeService as any);

    await service.approveDraft('draft-1', { reviewNote: 'ок' });
    await service.convertDraft('draft-1');
    await service.publishDraft('draft-1');

    expect(routeService.createTemplate).toHaveBeenCalledWith(expect.objectContaining({
      city: 'Москва',
      source: 'aggregation',
    }));
    expect(routeService.createRevision).toHaveBeenCalledWith('template-1', expect.objectContaining({
      steps: expect.arrayContaining([
        expect.objectContaining({
          ticketUrl: 'https://example.com',
          ticketProvider: 'KudaGo',
        }),
      ]),
    }));
    expect(routeService.publishTemplate).toHaveBeenCalledWith('template-1');
    expect(draftUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'published' }),
    }));
  });

  it('rejects direct publish before convert', async () => {
    const service = new AdminRouteReviewService(
      {
        client: {
          generatedRouteReviewDraft: {
            findUnique: jest.fn().mockResolvedValue(reviewDraft({ status: 'approved' })),
          },
        },
      } as any,
      {} as any,
    );

    await expect(service.publishDraft('draft-1')).rejects.toMatchObject({
      code: 'route_review_invalid_status',
    });
  });

  it('lists imported source items for admin inspection', async () => {
    const service = new AdminRouteReviewService(
      {
        client: {
          externalContentItem: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'item-1',
                sourceId: 'source-1',
                sourceItemId: 'event-1',
                sourceUrl: 'https://example.com/event',
                contentKind: 'event',
                city: 'Москва',
                timezone: 'Europe/Moscow',
                area: null,
                title: 'Экскурсия',
                shortSummary: 'Прогулка по центру',
                category: 'culture',
                tags: ['walk'],
                address: 'Никольская, 12',
                lat: 55.75,
                lng: 37.62,
                startsAt: new Date('2026-05-05T16:00:00.000Z'),
                endsAt: null,
                priceFrom: 500,
                currency: 'RUB',
                priceMode: 'paid',
                publicStatus: 'published',
                moderationStatus: 'pending',
                importedAt: new Date('2026-05-04T10:00:00.000Z'),
                expiresAt: null,
                source: { code: 'timepad', name: 'Timepad' },
              },
            ]),
          },
        },
      } as any,
      {} as any,
    );

    const result = await service.listContentItems({ city: 'Москва', source: 'timepad', limit: 10 });

    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'item-1',
        sourceCode: 'timepad',
        title: 'Экскурсия',
        sourceUrl: 'https://example.com/event',
        hasCoords: true,
        routePlannerBlockedReason: null,
      }),
    ]);
  });

  it('moderates imported content items and exposes route planner visibility', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'item-1',
      sourceId: 'source-1',
      sourceItemId: 'ticket-1',
      sourceUrl: 'https://go.avred.online/click',
      contentKind: 'event',
      city: 'Москва',
      timezone: 'Europe/Moscow',
      area: null,
      title: 'Большой стендап',
      shortSummary: null,
      category: 'comedy',
      tags: [],
      address: null,
      lat: null,
      lng: null,
      startsAt: new Date('2026-05-05T16:00:00.000Z'),
      endsAt: null,
      priceFrom: 1500,
      currency: 'RUB',
      venueName: 'Клуб',
      imageUrl: null,
      actionUrl: 'https://go.avred.online/click',
      actionKind: 'affiliate_ticket',
      priceMode: 'paid',
      isAffiliate: true,
      sourceProvider: 'Ticketland / MTS Live',
      placeKind: null,
      publicStatus: 'published',
      raw: { enrichment: { sourceCode: 'kudago', confidence: 'high' } },
      moderationStatus: 'approved',
      importedAt: new Date('2026-05-04T10:00:00.000Z'),
      expiresAt: null,
      source: { code: 'advcake_ticketland', name: 'AdvCake Ticketland' },
    });
    const service = new AdminRouteReviewService(
      {
        client: {
          externalContentItem: { update },
        },
      } as any,
      {} as any,
    );

    const result = await service.moderateContentItem('item-1', 'publish');

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'item-1' },
      data: { publicStatus: 'published', moderationStatus: 'approved' },
    }));
    expect(result).toEqual(expect.objectContaining({
      publicStatus: 'published',
      moderationStatus: 'approved',
      hasCoords: false,
      routePlannerBlockedReason: 'missing_coords',
      rawSummary: expect.stringContaining('enrichment'),
    }));
  });

  it('queues route generation runs without calling OpenRouter in API path', async () => {
    const batchCreate = jest.fn().mockResolvedValue({
      id: 'batch-1',
      city: 'Москва',
      timezone: 'Europe/Moscow',
      area: null,
      mood: 'calm',
      budget: 'low',
      audience: 'friends',
      format: 'evening_route',
      source: 'aggregation',
      status: 'pending_manual',
      promptVersion: 'aggregation-route-review-v1',
      requestJson: {
        maxDrafts: 2,
        requestedBy: 'admin',
      },
      responseJson: null,
      errorCode: null,
      errorMessage: null,
      createdAt: new Date('2026-05-04T10:00:00.000Z'),
      finishedAt: null,
      _count: { drafts: 0 },
    });
    const service = new AdminRouteReviewService(
      {
        client: {
          generatedRouteDraftBatch: {
            create: batchCreate,
          },
        },
      } as any,
      {} as any,
    );

    const result = await service.createGenerationRun({
      city: 'Москва',
      mood: 'calm',
      budget: 'low',
      maxDrafts: 2,
    });

    expect(batchCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        city: 'Москва',
        status: 'pending_manual',
        requestJson: expect.objectContaining({ maxDrafts: 2, requestedBy: 'admin' }),
      }),
    }));
    expect(result.status).toBe('pending_manual');
    expect(result.draftCount).toBe(0);
  });

  it('uses city timezone for manual route generation runs', async () => {
    const batchCreate = jest.fn().mockResolvedValue({
      id: 'batch-1',
      city: 'Екатеринбург',
      timezone: 'Asia/Yekaterinburg',
      area: null,
      mood: 'calm',
      budget: 'low',
      audience: 'friends',
      format: 'evening_route',
      source: 'aggregation',
      status: 'pending_manual',
      promptVersion: 'aggregation-route-review-v1',
      requestJson: { maxDrafts: 1, requestedBy: 'admin' },
      responseJson: null,
      errorCode: null,
      errorMessage: null,
      createdAt: new Date('2026-05-04T10:00:00.000Z'),
      finishedAt: null,
      _count: { drafts: 0 },
    });
    const service = new AdminRouteReviewService(
      {
        client: {
          generatedRouteDraftBatch: { create: batchCreate },
        },
      } as any,
      {} as any,
    );

    await service.createGenerationRun({
      city: 'Екатеринбург',
      mood: 'calm',
      budget: 'low',
      maxDrafts: 1,
    });

    expect(batchCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        city: 'Екатеринбург',
        timezone: 'Asia/Yekaterinburg',
      }),
    }));
  });

  it('creates a pending manual import run for Tomesto', async () => {
    const sourceUpsert = jest.fn().mockResolvedValue({ id: 'source-tomesto' });
    const runCreate = jest.fn().mockResolvedValue({
      id: 'run-tomesto',
      sourceId: 'source-tomesto',
      source: { code: 'tomesto' },
      city: 'Москва',
      status: 'pending_manual',
      startedAt: new Date('2026-05-04T10:00:00.000Z'),
      finishedAt: null,
      fetchedCount: 0,
      normalizedCount: 0,
      skippedCount: 0,
      errorCode: null,
      errorMessage: null,
    });
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const service = new AdminRouteReviewService(
      {
        client: {
          externalContentSource: { upsert: sourceUpsert },
          externalImportRun: { create: runCreate },
        },
      } as any,
      {} as any,
    );

    const result = await service.createImportRuns({
      city: 'Москва',
      from: '2026-05-04T00:00:00.000Z',
      to: '2026-06-03T00:00:00.000Z',
      sources: ['tomesto'],
    });

    expect(sourceUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { code: 'tomesto' },
      create: expect.objectContaining({
        code: 'tomesto',
        name: 'ТоМесто',
        kind: 'affiliate_places_events_promos',
        baseUrl: 'https://tomesto.ru',
        status: 'active',
      }),
    }));
    expect(runCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        sourceId: 'source-tomesto',
        city: 'Москва',
        status: 'pending_manual',
      }),
    }));
    expect(result.items[0]).toEqual(expect.objectContaining({
      id: 'run-tomesto',
      sourceCode: 'tomesto',
      status: 'pending_manual',
    }));
  });

  it('creates a Tomesto catalog import run with catalog metadata', async () => {
    const sourceUpsert = jest.fn().mockResolvedValue({ id: 'source-tomesto' });
    const runCreate = jest.fn().mockResolvedValue({
      id: 'run-tomesto-catalog',
      sourceId: 'source-tomesto',
      source: { code: 'tomesto' },
      city: 'Москва',
      status: 'pending_manual',
      startedAt: new Date('2026-05-04T10:00:00.000Z'),
      finishedAt: null,
      fetchedCount: 0,
      normalizedCount: 0,
      skippedCount: 0,
      errorCode: null,
      errorMessage: null,
    });
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const service = new AdminRouteReviewService(
      {
        client: {
          externalContentSource: { upsert: sourceUpsert },
          externalImportRun: { create: runCreate },
        },
      } as any,
      {} as any,
    );

    await service.createImportRuns({
      city: 'Москва',
      from: '2026-05-04T00:00:00.000Z',
      to: '2026-06-03T00:00:00.000Z',
      sources: ['tomesto'],
      importMode: 'tomesto_places_catalog',
    });

    expect(runCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        sourceId: 'source-tomesto',
        status: 'pending_manual',
        metadata: expect.objectContaining({
          importMode: 'tomesto_places_catalog',
          catalogOffset: 0,
          catalogLimit: 250,
        }),
      }),
    }));
  });

  it('rejects invalid manual import sources', async () => {
    const service = new AdminRouteReviewService({ client: {} } as any, {} as any);

    await expect(service.createImportRuns({
      city: 'Москва',
      from: '2026-05-04T00:00:00.000Z',
      to: '2026-06-03T00:00:00.000Z',
      sources: ['unknown'],
    })).rejects.toMatchObject({
      code: 'content_import_source_invalid',
    });
  });

  it('rejects Tomesto catalog mode mixed with other sources', async () => {
    const service = new AdminRouteReviewService({ client: {} } as any, {} as any);

    await expect(service.createImportRuns({
      city: 'Москва',
      from: '2026-05-04T00:00:00.000Z',
      to: '2026-06-03T00:00:00.000Z',
      sources: ['tomesto', 'kudago'],
      importMode: 'tomesto_places_catalog',
    })).rejects.toMatchObject({
      code: 'content_import_mode_invalid',
    });
  });
});

function reviewDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    batchId: 'batch-1',
    status: 'needs_review',
    title: 'Тихий центр',
    description: 'Кофе и галерея.',
    city: 'Москва',
    timezone: 'Europe/Moscow',
    area: 'центр',
    vibe: 'спокойно',
    budget: 'low',
    durationLabel: '2 часа',
    totalPriceFrom: 300,
    goal: 'social',
    mood: 'calm',
    format: null,
    recommendedFor: 'друзья',
    badgeLabel: null,
    score: 80,
    validationStatus: 'valid',
    validationIssues: [],
    reviewedByAdminId: null,
    reviewedAt: null,
    reviewNote: null,
    createdTemplateId: null,
    publishedAt: null,
    rejectedAt: null,
    archivedAt: null,
    createdAt: new Date('2026-05-04T10:00:00.000Z'),
    updatedAt: new Date('2026-05-04T10:00:00.000Z'),
    steps: [
      {
        id: 'step-1',
        draftId: 'draft-1',
        externalContentItemId: 'item-1',
        sortOrder: 1,
        timeLabel: '19:00',
        endTimeLabel: null,
        kind: 'cafe',
        title: 'Кофе',
        venue: 'Кофейня',
        address: 'Тверская, 1',
        emoji: '☕',
        distanceLabel: '10 минут',
        walkMin: 10,
        description: 'Начало.',
        vibeTag: null,
        ticketPrice: null,
        lat: 55.75,
        lng: 37.61,
        sourceUrl: 'https://example.com',
        sourceName: 'KudaGo',
        sourceTitle: 'Кофейня',
      },
    ],
    ...overrides,
  };
}
