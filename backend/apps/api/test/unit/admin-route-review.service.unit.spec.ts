import { AdminRouteReviewService } from '../../src/services/admin-route-review.service';

describe('AdminRouteReviewService', () => {
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
