import { AdminEveningAiService } from '../../src/services/admin-evening-ai.service';

describe('AdminEveningAiService unit', () => {
  const briefRow = {
    id: 'brief-1',
    city: 'Москва',
    timezone: 'Europe/Moscow',
    area: 'центр',
    titleIdea: 'Кино без кино',
    audience: 'свидание',
    format: 'bar gallery',
    mood: 'chill',
    budget: 'mid',
    durationMinutes: 150,
    minSteps: 2,
    maxSteps: 4,
    requiredVenueIds: [],
    excludedVenueIds: [],
    partnerGoal: 'partner',
    tone: 'calm',
    boldness: null,
    status: 'draft',
    createdAt: new Date('2026-04-29T08:00:00.000Z'),
    updatedAt: new Date('2026-04-29T08:00:00.000Z'),
  };

  it('creates a brief with normalized defaults', async () => {
    const service = newService({
      prisma: {
        aiEveningBrief: {
          create: jest.fn().mockResolvedValue(briefRow),
        },
      },
    });

    const result = await service.createBrief({
      city: 'Москва',
      titleIdea: 'Кино без кино',
      audience: 'свидание',
      format: 'bar gallery',
      mood: 'chill',
      budget: 'mid',
      durationMinutes: 150,
    });

    expect(result.id).toBe('brief-1');
    expect(result.minSteps).toBe(2);
    expect(result.maxSteps).toBe(4);
  });

  it('saves prompt request, raw response, draft and steps', async () => {
    const runCreate = jest.fn().mockResolvedValue({ id: 'run-1' });
    const runUpdate = jest.fn().mockResolvedValue(null);
    const draftCreate = jest.fn().mockImplementation((args: any) =>
      Promise.resolve({
        id: 'draft-1',
        briefId: 'brief-1',
        runId: 'run-1',
        title: args.data.title,
        description: args.data.description,
        city: args.data.city,
        area: args.data.area,
        vibe: args.data.vibe,
        budget: args.data.budget,
        durationLabel: args.data.durationLabel,
        totalPriceFrom: args.data.totalPriceFrom,
        score: args.data.score,
        validationStatus: args.data.validationStatus,
        validationIssues: args.data.validationIssues,
        selectedAt: null,
        createdRouteId: null,
        createdAt: new Date('2026-04-29T08:00:00.000Z'),
        updatedAt: new Date('2026-04-29T08:00:00.000Z'),
        steps: args.data.steps.create.map((step: any, index: number) => ({
          id: `step-${index + 1}`,
          ...step,
        })),
      }),
    );
    const service = newService({
      prisma: {
        aiEveningBrief: {
          findUnique: jest.fn().mockResolvedValue(briefRow),
        },
        aiEveningGenerationRun: {
          create: runCreate,
          update: runUpdate,
        },
        aiEveningDraft: {
          create: draftCreate,
        },
      },
      candidates: {
        selectCandidates: jest.fn().mockResolvedValue([
          {
            id: 'venue-1',
            partnerId: 'partner-1',
            city: 'Москва',
            area: 'центр',
            name: 'Brix',
            address: 'Москва, Example, 1',
            lat: 55.75,
            lng: 37.61,
            category: 'bar',
            tags: ['chill'],
            averageCheck: 1800,
            openingHours: { mon: [['12:00', '23:00']] },
            offers: [
              {
                id: 'offer-1',
                partnerId: 'partner-1',
                venueId: 'venue-1',
                title: 'Бокал',
                description: 'По QR',
                terms: null,
                shortLabel: 'Подарок',
              },
            ],
          },
          {
            id: 'venue-2',
            partnerId: null,
            city: 'Москва',
            area: 'центр',
            name: 'Gallery',
            address: 'Москва, Example, 2',
            lat: 55.76,
            lng: 37.62,
            category: 'gallery',
            tags: ['chill'],
            averageCheck: null,
            openingHours: { mon: [['12:00', '23:00']] },
            offers: [],
          },
        ]),
      },
      openRouter: {
        configuredModel: 'test-model',
        generateJson: jest.fn().mockResolvedValue({
          rawResponse: { choices: [] },
          parsedJson: {
            routes: [
              {
                title: 'Кино без кино',
                description: 'Тихий вечер.',
                vibe: 'chill',
                budget: 'mid',
                durationLabel: '2.5 часа',
                totalPriceFrom: 1800,
                steps: [
                  {
                    venueId: 'venue-1',
                    partnerOfferId: 'offer-1',
                    kind: 'bar',
                    title: 'Начать с вина',
                    timeLabel: '19:00',
                    endTimeLabel: '20:00',
                    description: 'Старт',
                    transition: '7 минут пешком',
                    walkMin: 7,
                  },
                  {
                    venueId: 'venue-2',
                    kind: 'gallery',
                    title: 'Галерея',
                    timeLabel: '20:10',
                    endTimeLabel: '21:00',
                    description: 'Второй шаг',
                    transition: null,
                    walkMin: 7,
                  },
                ],
              },
            ],
          },
          latencyMs: 123,
        }),
      },
    });

    const result = await service.generateDrafts('brief-1');

    expect(runCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestJson: expect.objectContaining({
          approvedVenues: expect.any(Array),
        }),
      }),
    });
    expect(runUpdate).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({
        status: 'completed',
        responseJson: { choices: [] },
      }),
    });
    expect(draftCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        validationStatus: 'valid',
        steps: {
          create: expect.arrayContaining([
            expect.objectContaining({ venueId: 'venue-1' }),
          ]),
        },
      }),
      include: expect.any(Object),
    });
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0]?.score).toBe(100);
  });

  it('converts selectable draft through route service', async () => {
    const routeService = {
      createTemplate: jest.fn().mockResolvedValue({ id: 'template-1' }),
      createRevision: jest.fn().mockResolvedValue({
        id: 'template-1',
        currentRouteId: 'route-1',
      }),
      getTemplate: jest.fn(),
    };
    const draftUpdate = jest.fn().mockResolvedValue(null);
    const service = newService({
      prisma: {
        aiEveningDraft: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'draft-1',
            title: 'Кино без кино',
            description: 'Тихий вечер.',
            city: 'Москва',
            area: 'центр',
            vibe: 'chill',
            budget: 'mid',
            durationLabel: '2.5 часа',
            totalPriceFrom: 1800,
            validationStatus: 'valid',
            createdRouteId: null,
            brief: briefRow,
            steps: [
              {
                timeLabel: '19:00',
                endTimeLabel: '20:00',
                kind: 'bar',
                title: 'Начать с вина',
                venueId: 'venue-1',
                partnerOfferId: 'offer-1',
                description: 'Старт',
                transition: '7 минут пешком',
                walkMin: 7,
              },
            ],
          }),
          update: draftUpdate,
        },
        eveningRoute: {
          findUnique: jest.fn(),
        },
      },
      routeService,
    });

    const result = await service.convertDraft('draft-1');

    expect(routeService.createTemplate).toHaveBeenCalledWith({
      city: 'Москва',
      timezone: 'Europe/Moscow',
      area: 'центр',
      source: 'team',
    });
    expect(routeService.createRevision).toHaveBeenCalledWith(
      'template-1',
      expect.objectContaining({
        title: 'Кино без кино',
        steps: [
          expect.objectContaining({
            venueId: 'venue-1',
            partnerOfferId: 'offer-1',
          }),
        ],
      }),
    );
    expect(draftUpdate).toHaveBeenCalledWith({
      where: { id: 'draft-1' },
      data: expect.objectContaining({
        selectedAt: expect.any(Date),
        createdRouteId: 'route-1',
      }),
    });
    expect(result.currentRouteId).toBe('route-1');
  });
});

function newService(overrides: {
  prisma?: any;
  candidates?: any;
  validator?: any;
  openRouter?: any;
  routeService?: any;
}) {
  return new AdminEveningAiService(
    { client: overrides.prisma ?? {} } as any,
    overrides.candidates ?? { selectCandidates: jest.fn() },
    overrides.validator ?? new (jest.requireActual(
      '../../src/services/evening-route-ai-validator.service',
    ).EveningRouteAiValidatorService)(),
    overrides.openRouter ?? {
      configuredModel: 'test-model',
      generateJson: jest.fn(),
    },
    overrides.routeService ?? {
      createTemplate: jest.fn(),
      createRevision: jest.fn(),
      getTemplate: jest.fn(),
    },
  );
}
