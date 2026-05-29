import { appMetrics } from '@big-break/database';
import { EveningAiDraftService } from '../../src/services/evening-ai-draft.service';

describe('EveningAiDraftService unit', () => {
  const originalEveningAiModel = process.env.EVENING_AI_MODEL;
  const originalIntentMaxTokens = process.env.EVENING_AI_INTENT_MAX_TOKENS;
  const originalRouteMaxTokens = process.env.EVENING_AI_ROUTE_MAX_TOKENS;
  const originalIntentTimeoutMs = process.env.EVENING_AI_INTENT_TIMEOUT_MS;
  const originalRouteTimeoutMs = process.env.EVENING_AI_ROUTE_TIMEOUT_MS;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2099-06-01T12:00:00.000Z'));
    appMetrics.reset();
  });

  afterEach(() => {
    jest.useRealTimers();
    if (originalEveningAiModel == null) {
      delete process.env.EVENING_AI_MODEL;
    } else {
      process.env.EVENING_AI_MODEL = originalEveningAiModel;
    }
    if (originalIntentMaxTokens == null) {
      delete process.env.EVENING_AI_INTENT_MAX_TOKENS;
    } else {
      process.env.EVENING_AI_INTENT_MAX_TOKENS = originalIntentMaxTokens;
    }
    if (originalRouteMaxTokens == null) {
      delete process.env.EVENING_AI_ROUTE_MAX_TOKENS;
    } else {
      process.env.EVENING_AI_ROUTE_MAX_TOKENS = originalRouteMaxTokens;
    }
    if (originalIntentTimeoutMs == null) {
      delete process.env.EVENING_AI_INTENT_TIMEOUT_MS;
    } else {
      process.env.EVENING_AI_INTENT_TIMEOUT_MS = originalIntentTimeoutMs;
    }
    if (originalRouteTimeoutMs == null) {
      delete process.env.EVENING_AI_ROUTE_TIMEOUT_MS;
    } else {
      process.env.EVENING_AI_ROUTE_TIMEOUT_MS = originalRouteTimeoutMs;
    }
  });

  const externalItemFixture = (overrides: Record<string, unknown> = {}) => ({
    id: 'item-1',
    title: 'Brix',
    shortSummary: 'Короткое описание',
    category: 'bar',
    tags: ['bar', 'wine'],
    address: 'Покровка 12',
    lat: 55.76,
    lng: 37.61,
    startsAt: null,
    endsAt: null,
    priceFrom: 1200,
    currency: 'RUB',
    venueName: 'Brix',
    actionUrl: 'https://example.test/action',
    sourceUrl: 'https://example.test/source',
    priceMode: 'paid',
    sourceProvider: 'ТоМесто',
    placeKind: 'bar',
    imageUrl: 'https://cdn.test/default.jpg',
    imageVariants: null,
    source: { code: 'tomesto', name: 'ТоМесто' },
    ...overrides,
  });

  const routeSnapshot = {
    id: 'draft-route-1',
    title: 'Бар и стендап',
    vibe: 'Живой вечер',
    blurb: 'Сначала бар, потом шоу.',
    totalPriceFrom: 2400,
    totalSavings: 0,
    durationLabel: '19:00 - 22:00',
    area: 'Центр',
    goal: 'date',
    mood: 'social',
    budget: 'mid',
    format: 'mixed',
    premium: false,
    locked: false,
    recommendedFor: 'AI подобрал реальные места',
    hostsCount: 0,
    chatId: null,
    steps: [
      {
        externalContentItemId: 'tomesto-bar',
        id: 'step-1',
        time: '19:00',
        endTime: '20:00',
        kind: 'bar',
        title: 'Brix',
        venue: 'Brix',
        address: 'Покровка 12',
        emoji: '🍷',
        distance: 'старт',
        walkMin: null,
        perk: null,
        perkShort: null,
        ticketPrice: null,
        ticketCommission: null,
        ticketUrl: null,
        ticketSourceCode: 'tomesto',
        ticketProvider: 'ТоМесто',
        sponsored: false,
        premium: false,
        partnerId: null,
        venueId: null,
        partnerOfferId: null,
        description: 'Бар для старта',
        vibeTag: 'Бар',
        lat: 55.76,
        lng: 37.61,
        hasShareable: false,
        state: {
          perkUsed: false,
          ticketBought: false,
          sentToChat: false,
          chatMessageId: null,
        },
      },
      {
        externalContentItemId: 'ticketland-show',
        id: 'step-2',
        time: '20:30',
        endTime: '22:00',
        kind: 'show',
        title: 'Стендап',
        venue: 'Stage',
        address: 'Тверская 1',
        emoji: '🎤',
        distance: '0.7 км',
        walkMin: 9,
        perk: null,
        perkShort: null,
        ticketPrice: 1200,
        ticketCommission: null,
        ticketUrl: 'https://ticket.example.test',
        ticketSourceCode: 'advcake_ticketland',
        ticketProvider: 'Ticketland / MTS Live',
        sponsored: false,
        premium: false,
        partnerId: null,
        venueId: null,
        partnerOfferId: null,
        description: 'Шоу рядом',
        vibeTag: 'Шоу',
        lat: 55.765,
        lng: 37.615,
        hasShareable: true,
        state: {
          perkUsed: false,
          ticketBought: false,
          sentToChat: false,
          chatMessageId: null,
        },
      },
    ],
    userState: {
      usedPerkStepIds: [],
      boughtTicketStepIds: [],
      sentToChatStepIds: [],
    },
  };

  function createService(options: {
    ticketlandWithoutCoords?: boolean;
    externalItems?: Record<string, Array<Record<string, unknown>>>;
    filterExternalItemsByQuery?: boolean;
    taxonomyRows?: Array<{ tag: string; count?: number }>;
    tomestoImageCount?: number;
    openRouterResponses?: Array<Record<string, unknown> | Error>;
    intentResponse?: Record<string, unknown> | Error;
    draftOverrides?: Record<string, unknown>;
    weeklyLimitRejected?: boolean;
    aiDraftsThisWeek?: number;
  } = {}) {
    const externalFindMany = jest.fn((query: any) => {
      const code = query?.where?.source?.code;
      const configuredItems = options.externalItems?.[code];
      if (configuredItems) {
        const items = configuredItems.map((item) => externalItemFixture(item));
        return Promise.resolve(
          options.filterExternalItemsByQuery
            ? items.filter((item) => externalItemMatchesQuery(item, query))
            : items,
        );
      }
      if (code === 'tomesto') {
        return Promise.resolve([
          externalItemFixture({ id: 'tomesto-bar', title: 'Brix', venueName: 'Brix' }),
        ]);
      }
      if (code === 'advcake_ticketland') {
        return Promise.resolve([
          externalItemFixture({
            id: 'ticketland-show',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            title: 'Стендап',
            category: 'standup',
            contentKind: 'event',
            startsAt: new Date('2099-06-01T17:30:00.000Z'),
            priceFrom: 1200,
            lat: options.ticketlandWithoutCoords ? null : 55.765,
            lng: options.ticketlandWithoutCoords ? null : 37.615,
            sourceProvider: 'Ticketland / MTS Live',
          }),
        ]);
      }
      if (code === 'kudago') {
        return Promise.resolve([
          externalItemFixture({
            id: 'kudago-walk',
            source: { code: 'kudago', name: 'KudaGo' },
            title: 'Прогулка',
            category: 'walk',
            contentKind: 'event',
            startsAt: new Date('2099-06-01T18:00:00.000Z'),
            priceFrom: 0,
            priceMode: 'free',
            sourceProvider: 'KudaGo',
          }),
        ]);
      }
      return Promise.resolve([]);
    });
    let currentDraft: any = {
      id: 'draft-1',
      userId: 'user-1',
      status: 'reviewing',
      city: 'Москва',
      timezone: 'Europe/Moscow',
      stepCount: 2,
      prompt: 'Винный бар и стендап',
      candidatePackJson: [
        {
          id: 'tomesto-bar',
          role: 'place_bar',
          source: 'tomesto',
          contentKind: 'place',
          title: 'Brix',
          area: 'Центр',
          tags: ['bar'],
          priceMode: 'paid',
          priceFrom: 1200,
          startsAt: null,
          lat: 55.76,
          lng: 37.61,
          address: 'Покровка 12',
          venueName: 'Brix',
          actionUrl: null,
          sourceUrl: null,
          sourceProvider: 'ТоМесто',
          shortSummary: 'Бар для старта',
        },
        {
          id: 'tomesto-alt',
          role: 'place_bar',
          source: 'tomesto',
          contentKind: 'place',
          title: 'Винный шкаф',
          area: 'Центр',
          tags: ['bar', 'wine'],
          priceMode: 'paid',
          priceFrom: 1400,
          startsAt: null,
          lat: 55.761,
          lng: 37.612,
          address: 'Покровка 14',
          venueName: 'Винный шкаф',
          actionUrl: null,
          sourceUrl: null,
          sourceProvider: 'ТоМесто',
          shortSummary: 'Другой бар',
        },
        {
          id: 'ticketland-show',
          role: 'show',
          source: 'advcake_ticketland',
          contentKind: 'event',
          title: 'Стендап',
          area: 'Центр',
          tags: ['standup'],
          priceMode: 'paid',
          priceFrom: 1200,
          startsAt: '2099-06-01T17:30:00.000Z',
          lat: 55.765,
          lng: 37.615,
          address: 'Тверская 1',
          venueName: 'Stage',
          actionUrl: 'https://ticket.example.test',
          sourceUrl: null,
          sourceProvider: 'Ticketland / MTS Live',
          shortSummary: 'Шоу рядом',
        },
        {
          id: 'ticketland-alt',
          role: 'show',
          source: 'advcake_ticketland',
          contentKind: 'event',
          title: 'Джаз',
          area: 'Центр',
          tags: ['concert'],
          priceMode: 'paid',
          priceFrom: 1500,
          startsAt: '2099-06-01T18:00:00.000Z',
          lat: 55.766,
          lng: 37.616,
          address: 'Тверская 3',
          venueName: 'Jazz Stage',
          actionUrl: 'https://ticket-alt.example.test',
          sourceUrl: null,
          sourceProvider: 'Ticketland / MTS Live',
          shortSummary: 'Другой концерт',
        },
      ],
      routeSnapshotJson: routeSnapshot,
      acceptedStepIndexes: [0],
      rejectedExternalItemIds: ['old-rejected'],
      expiresAt: new Date('2026-05-16T08:00:00.000Z'),
      routeId: null,
      ...options.draftOverrides,
    };
    const draftCreate = jest.fn((input: any) => {
      currentDraft = {
        id: 'draft-1',
        ...input.data,
        createdAt: new Date('2026-05-15T08:00:00.000Z'),
        updatedAt: new Date('2026-05-15T08:00:00.000Z'),
      };
      return Promise.resolve(currentDraft);
    });
    const draftUpdate = jest.fn((input: any) => {
      currentDraft = {
        ...currentDraft,
        ...input.data,
        id: input.where.id,
        updatedAt: new Date('2026-05-15T08:05:00.000Z'),
      };
      return Promise.resolve(currentDraft);
    });
    const draftFindFirst = jest.fn(() => Promise.resolve(currentDraft));
    const eventCount = jest.fn().mockResolvedValue(
      options.weeklyLimitRejected ? 6 : 0,
    );
    const aiDraftCount = jest.fn().mockResolvedValue(
      options.aiDraftsThisWeek ?? (options.weeklyLimitRejected ? 1 : 0),
    );
    const routeCreate = jest.fn().mockResolvedValue({});
    const stepCreateMany = jest.fn().mockResolvedValue({ count: 2 });
    const prisma = {
      client: {
        event: { count: eventCount },
        externalContentItem: {
          findMany: externalFindMany,
          count: jest.fn().mockResolvedValue(options.tomestoImageCount ?? 1),
        },
        $queryRaw: jest.fn().mockResolvedValue(options.taxonomyRows ?? []),
        eveningAiRouteDraft: {
          count: aiDraftCount,
          create: draftCreate,
          findFirst: draftFindFirst,
          update: draftUpdate,
        },
        $transaction: jest.fn((callback) =>
          callback({
            eveningRoute: { create: routeCreate },
            eveningRouteStep: { createMany: stepCreateMany },
            eveningAiRouteDraft: { update: draftUpdate },
          }),
        ),
      },
    } as any;
    const subscriptionService = {
      hasPremiumAccess: jest.fn().mockResolvedValue(false),
      getPlusBenefitRules: jest.fn().mockResolvedValue({
        freeMeetupMonthlyLimit: 7,
        plusMeetupMonthlyLimit: null,
      }),
    };
    const defaultOpenRouterResponse = {
      parsedJson: {
        title: 'Бар и стендап',
        vibe: 'Живой вечер',
        blurb: 'Сначала бар, потом шоу.',
        steps: [
          {
            externalContentItemId: 'tomesto-bar',
            timeLabel: '19:00',
            endTimeLabel: '20:00',
            description: 'Бар для старта',
          },
          {
            externalContentItemId: 'ticketland-show',
            timeLabel: '20:30',
            endTimeLabel: '22:00',
            description: 'Шоу рядом',
          },
        ],
      },
      rawResponse: {},
      model: 'openrouter/owl-alpha',
      latencyMs: 123,
    };
    const openRouter = {
      generateJson: jest.fn(),
    };
    const routeResponses = [...(options.openRouterResponses ?? [])];
    openRouter.generateJson.mockImplementation((input: any) => {
      const schemaName = input?.responseFormat?.json_schema?.name;
      if (schemaName === 'evening_ai_route_intent') {
        if (options.intentResponse) {
          if (options.intentResponse instanceof Error) {
            return Promise.reject(options.intentResponse);
          }
          return Promise.resolve(completeIntentResponse(options.intentResponse, input.model));
        }
        const prompt = JSON.parse(input.userPrompt);
        const roles = testIntentRolesForPrompt(
          prompt.prompt,
          prompt.config?.requestedStepCount,
        );
        return Promise.resolve(
          completeIntentResponse(
            {
              parsedJson: {
                routeStepCount: roles.length,
                steps: roles.map((role: string) => ({
                  role,
                  preferredTerms: [],
                  avoidTerms: [],
                  instruction: '',
                })),
              },
            },
            input.model,
          ),
        );
      }
      const nextResponse = routeResponses.shift();
      if (nextResponse instanceof Error) {
        return Promise.reject(nextResponse);
      }
      return Promise.resolve(nextResponse ?? defaultOpenRouterResponse);
    });
    const service = new EveningAiDraftService(
      prisma,
      openRouter as any,
      subscriptionService as any,
    );
    return {
      service,
      externalFindMany,
      draftCreate,
      draftUpdate,
      routeCreate,
      stepCreateMany,
      openRouter,
      subscriptionService,
      eventCount,
      aiDraftCount,
      taxonomyQuery: prisma.client.$queryRaw,
    };
  }

  function completeIntentResponse(response: Record<string, unknown>, model: string) {
    const parsed = (response.parsedJson ?? {}) as Record<string, unknown>;
    const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
    return {
      rawResponse: {},
      model,
      latencyMs: 30,
      ...response,
      parsedJson: {
        routeStepCount: steps.length,
        stepCountReason: 'Тестовый intent.',
        participantsCount: 0,
        dateMode: 'none',
        localDate: '',
        dateReason: 'Дата не указана.',
        area: '',
        budget: '',
        ...parsed,
      },
    };
  }

  function testIntentRolesForPrompt(prompt: string | null, requestedStepCount?: number): string[] {
    const text = (prompt ?? '').toLowerCase();
    const mentions: Array<{ role: string; index: number }> = [
      { role: 'walk', index: firstTestTermIndex(text, ['погуля', 'прогул', 'парк']) },
      { role: 'place_food', index: firstTestTermIndex(text, ['ужин', 'поесть', 'покушать', 'кофе', 'ресторан']) },
      { role: 'place_bar', index: firstTestTermIndex(text, ['бар', 'пив', 'крафт', 'вино']) },
      { role: 'movie', index: firstTestTermIndex(text, ['кино', 'фильм', 'сеанс']) },
      { role: 'show', index: firstTestTermIndex(text, ['стендап', 'спектак', 'театр', 'шоу']) },
    ]
      .filter((item) => item.index >= 0)
      .sort((left, right) => left.index - right.index);
    const roles = mentions.map((item) => item.role);
    const targetCount = requestedStepCount ?? roles.length;
    while (roles.length > 0 && roles.length < Math.max(1, targetCount || 1)) {
      roles.push(roles[roles.length - 1]!);
    }
    return roles.length > 0 ? roles.slice(0, Math.max(1, targetCount || 1)) : ['place_bar'];
  }

  function firstTestTermIndex(text: string, terms: string[]) {
    return terms.reduce((best, term) => {
      const index = text.indexOf(term);
      if (index < 0) {
        return best;
      }
      return best < 0 ? index : Math.min(best, index);
    }, -1);
  }

  function externalItemMatchesQuery(item: any, query: any) {
    const startsAtFilter = query?.where?.startsAt;
    if (startsAtFilter && item.startsAt) {
      const startsAt = item.startsAt instanceof Date ? item.startsAt : new Date(item.startsAt);
      const gte = startsAtFilter.gte instanceof Date ? startsAtFilter.gte : null;
      const lte = startsAtFilter.lte instanceof Date ? startsAtFilter.lte : null;
      if (gte && startsAt.getTime() < gte.getTime()) {
        return false;
      }
      if (lte && startsAt.getTime() > lte.getTime()) {
        return false;
      }
    }
    const terms = query?.where?.OR;
    if (!Array.isArray(terms) || terms.length === 0) {
      return true;
    }
    return terms.some((term: any) => {
      const tag = term?.tags?.array_contains?.[0];
      if (typeof tag === 'string' && Array.isArray(item.tags)) {
        return item.tags.includes(tag);
      }
      return ['title', 'area', 'category', 'shortSummary', 'venueName', 'placeKind'].some(
        (field) => {
          const contains = term?.[field]?.contains;
          const value = item[field];
          return (
            typeof contains === 'string' &&
            typeof value === 'string' &&
            value.toLowerCase().includes(contains.toLowerCase())
          );
        },
      );
    });
  }

  it('creates a draft from source-specific candidates and OpenRouter JSON schema output', async () => {
    const { service, externalFindMany, draftCreate, openRouter } = createService();

    const result = await service.createDraft('user-1', {
      prompt: 'Винный бар и стендап',
      city: 'Москва',
      stepCount: 2,
    });

    expect(result).toMatchObject({
      draftId: 'draft-1',
      acceptedStepIndexes: [],
      currentStepIndex: 0,
      canConfirm: false,
      route: {
        title: 'Бар и стендап',
        steps: [
          expect.objectContaining({
            title: 'Brix',
            ticketSourceCode: 'tomesto',
            ticketUrl: 'https://example.test/action',
            ticketPrice: 1200,
            hasShareable: true,
          }),
          expect.objectContaining({
            title: 'Стендап',
            ticketSourceCode: 'advcake_ticketland',
          }),
        ],
      },
    });
    expect(externalFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: { code: 'tomesto' },
          contentKind: 'place',
        }),
      }),
    );
    expect(externalFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: { code: 'advcake_ticketland' },
          contentKind: 'event',
        }),
      }),
    );
    expect(openRouter.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'openrouter/owl-alpha',
          timeoutMs: 90000,
        responseFormat: expect.objectContaining({
          type: 'json_schema',
        }),
      }),
    );
    expect(draftCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          model: 'openrouter/owl-alpha',
          latencyMs: 123,
          candidatePackJson: expect.arrayContaining([
            expect.objectContaining({
              id: 'tomesto-bar',
              source: 'tomesto',
              role: 'place_bar',
            }),
          ]),
        }),
      }),
    );
  });

  it('records successful AI draft phase metrics', async () => {
    const histogram = (appMetrics as any).eveningAiDraftPhaseDurationSeconds;
    expect(histogram).toBeDefined();
    const observe = jest.spyOn(histogram, 'observe');
    const { service } = createService();

    try {
      await service.createDraft('user-1', {
        prompt: 'Винный бар и стендап',
        city: 'Москва',
        stepCount: 2,
      });

      const labels = observe.mock.calls.map(([callLabels]) => callLabels);
      expect(labels).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ operation: 'create_draft', phase: 'quota_checks', status: 'ok' }),
          expect.objectContaining({ operation: 'create_draft', phase: 'intent_taxonomy', status: 'ok' }),
          expect.objectContaining({ operation: 'create_draft', phase: 'intent_llm', status: 'ok' }),
          expect.objectContaining({ operation: 'create_draft', phase: 'candidate_load', status: 'ok' }),
          expect.objectContaining({ operation: 'create_draft', phase: 'candidate_rank', status: 'ok' }),
          expect.objectContaining({ operation: 'create_draft', phase: 'route_llm', status: 'ok' }),
          expect.objectContaining({ operation: 'create_draft', phase: 'draft_save', status: 'ok' }),
          expect.objectContaining({ operation: 'create_draft', phase: 'total', status: 'ok' }),
        ]),
      );
      for (const [callLabels, durationSeconds] of observe.mock.calls) {
        expect(callLabels).toEqual(expect.objectContaining({ service: 'api' }));
        expect(typeof durationSeconds).toBe('number');
        expect(durationSeconds).toBeGreaterThanOrEqual(0);
      }
    } finally {
      observe.mockRestore();
    }
  });

  it('marks total AI draft metrics as fallback when route generation falls back', async () => {
    const histogram = (appMetrics as any).eveningAiDraftPhaseDurationSeconds;
    expect(histogram).toBeDefined();
    const observe = jest.spyOn(histogram, 'observe');
    const { service } = createService({
      openRouterResponses: [
        new Error('route model unavailable'),
        new Error('route retry unavailable'),
      ],
    });

    try {
      await service.createDraft('user-1', {
        prompt: 'Винный бар и стендап',
        city: 'Москва',
        stepCount: 2,
      });

      expect(observe.mock.calls.map(([callLabels]) => callLabels)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ operation: 'create_draft', phase: 'route_llm', status: 'fallback' }),
          expect.objectContaining({ operation: 'create_draft', phase: 'total', status: 'fallback' }),
        ]),
      );
    } finally {
      observe.mockRestore();
    }
  });

  it('uses EVENING_AI_MODEL when it is configured', async () => {
    process.env.EVENING_AI_MODEL = 'openrouter/custom-test-model';
    const { service, openRouter } = createService();

    await service.createDraft('user-1', {
      prompt: 'Винный бар и стендап',
      city: 'Москва',
      stepCount: 2,
    });

    expect(openRouter.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'openrouter/custom-test-model',
        responseFormat: expect.objectContaining({
          json_schema: expect.objectContaining({ name: 'evening_ai_route_intent' }),
        }),
      }),
    );
    expect(openRouter.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'openrouter/custom-test-model',
        responseFormat: expect.objectContaining({
          json_schema: expect.objectContaining({ name: 'evening_ai_route' }),
        }),
      }),
    );
  });

  it('rejects AI draft creation before calling OpenRouter when weekly meetup limit is reached', async () => {
    const {
      service,
      openRouter,
      externalFindMany,
      draftCreate,
      subscriptionService,
      eventCount,
      aiDraftCount,
    } = createService({ weeklyLimitRejected: true });

    await expect(
      service.createDraft('user-1', {
        prompt: 'Винный бар и стендап',
        city: 'Москва',
      }),
    ).rejects.toMatchObject({
      statusCode: 429,
      code: 'event_weekly_limit_reached',
      details: {
        limit: 7,
        remaining: 0,
      },
    });

    expect(subscriptionService.hasPremiumAccess).toHaveBeenCalledWith('user-1');
    expect(eventCount).toHaveBeenCalled();
    expect(aiDraftCount).toHaveBeenCalled();
    expect(openRouter.generateJson).not.toHaveBeenCalled();
    expect(externalFindMany).not.toHaveBeenCalled();
    expect(draftCreate).not.toHaveBeenCalled();
  });

  it('limits free AI builder usage to 3 drafts per week', async () => {
    const {
      service,
      openRouter,
      externalFindMany,
      draftCreate,
      aiDraftCount,
    } = createService({ aiDraftsThisWeek: 3 });

    await expect(
      service.createDraft('user-1', {
        prompt: 'Винный бар и стендап',
        city: 'Москва',
      }),
    ).rejects.toMatchObject({
      statusCode: 429,
      code: 'event_weekly_limit_reached',
      details: {
        limit: 3,
        remaining: 0,
      },
    });

    expect(aiDraftCount).toHaveBeenCalled();
    expect(openRouter.generateJson).not.toHaveBeenCalled();
    expect(externalFindMany).not.toHaveBeenCalled();
    expect(draftCreate).not.toHaveBeenCalled();
  });

  it('uses configurable token budgets and timeouts for intent and route calls', async () => {
    process.env.EVENING_AI_INTENT_MAX_TOKENS = '4096';
    process.env.EVENING_AI_ROUTE_MAX_TOKENS = '32768';
    process.env.EVENING_AI_INTENT_TIMEOUT_MS = '91000';
    process.env.EVENING_AI_ROUTE_TIMEOUT_MS = '92000';
    const { service, openRouter } = createService();

    await service.createDraft('user-1', {
      prompt: 'Винный бар и стендап',
      city: 'Москва',
      stepCount: 2,
    });

    const intentCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route_intent',
    )?.[0];
    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    expect(intentCall.maxTokens).toBe(4096);
    expect(routeCall.maxTokens).toBe(32768);
    expect(intentCall.timeoutMs).toBe(91000);
    expect(routeCall.timeoutMs).toBe(92000);
  });

  it('passes real Tomesto taxonomy tags to the intent model', async () => {
    const { service, openRouter, taxonomyQuery } = createService({
      taxonomyRows: [
        { tag: 'cuisine:gruzinskaya', count: 120 },
        { tag: 'cuisine:italyanskaya', count: 100 },
        { tag: 'place:restaurant', count: 300 },
        { tag: 'set:cocktails', count: 40 },
        { tag: 'feature:quiet', count: 30 },
      ],
      intentResponse: {
        parsedJson: {
          steps: [
            {
              role: 'place_food',
              preferredTerms: ['cuisine:gruzinskaya', 'хинкали'],
              avoidTerms: [],
              instruction: 'Грузинская кухня',
            },
          ],
        },
      },
    });

    await service.createDraft('user-1', {
      prompt: 'хочу поесть хинкали',
      city: 'Москва',
    });

    const intentCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route_intent',
    )?.[0];
    const intentPrompt = JSON.parse(intentCall.userPrompt);
    expect(taxonomyQuery).toHaveBeenCalled();
    expect(intentPrompt.availableTaxonomy.cuisineTags).toEqual([
      'cuisine:gruzinskaya',
      'cuisine:italyanskaya',
    ]);
    expect(intentPrompt.availableTaxonomy.setTags).toEqual(['set:cocktails']);
    expect(intentPrompt.rules.join(' ')).toContain('taxonomyTags are the primary structured filter');
  });

  it('loads Tomesto candidates by city without text filters or take limit', async () => {
    const { service, externalFindMany } = createService({
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-dinner',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Любой ресторан',
            category: 'restaurant',
            tags: ['occasion:food'],
            priceFrom: 1800,
            placeKind: 'restaurant',
            venueName: 'Любой ресторан',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-show',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Стендап',
            category: 'standup',
            tags: ['стендап'],
            startsAt: new Date('2099-06-01T17:30:00.000Z'),
            priceFrom: 1200,
            actionUrl: 'https://ticket.example.test/show',
            sourceProvider: 'Ticketland / MTS Live',
          },
        ],
      },
    });

    await service.createDraft('user-1', {
      prompt: 'ужин и стендап',
      city: 'Москва',
    });

    const tomestoQueries = externalFindMany.mock.calls
      .map(([query]: [any]) => query)
      .filter((query: any) => query?.where?.source?.code === 'tomesto');
    expect(tomestoQueries).toHaveLength(1);
    expect(tomestoQueries[0]).toEqual(
      expect.objectContaining({
        where: expect.not.objectContaining({ OR: expect.any(Array) }),
      }),
    );
    expect(tomestoQueries[0]?.take).toBeUndefined();
  });

  it('excludes Tomesto candidates without images from the AI route pack', async () => {
    const { service, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          steps: [
            {
              role: 'place_food',
              preferredTerms: ['ресторан'],
              avoidTerms: [],
              instruction: 'Ресторан',
            },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-no-image',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Ресторан без фото',
            category: 'food',
            tags: ['occasion:food', 'place:restaurant'],
            lat: 55.731,
            lng: 37.601,
            placeKind: 'food',
            venueName: 'Ресторан без фото',
            sourceProvider: 'ТоМесто',
            imageUrl: null,
          },
          {
            id: 'tomesto-with-image',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Ресторан с фото',
            category: 'food',
            tags: ['occasion:food', 'place:restaurant'],
            lat: 55.732,
            lng: 37.602,
            placeKind: 'food',
            venueName: 'Ресторан с фото',
            sourceProvider: 'ТоМесто',
            imageUrl: 'https://cdn.test/restaurant.jpg',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Ресторан',
            vibe: 'С фото',
            blurb: 'Проверка картинок.',
            steps: [{ externalContentItemId: 'tomesto-with-image', timeLabel: '19:00' }],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt: 'хочу поесть в ресторане',
      city: 'Москва',
    });

    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    const candidateIds = routePrompt.candidates.map((candidate: any) => candidate.id);
    expect(candidateIds).toEqual(['tomesto-with-image']);
    expect(result.route.steps[0].title).toBe('Ресторан с фото');
  });

  it('keeps Tomesto candidates when the city has no imported Tomesto images yet', async () => {
    const { service, openRouter } = createService({
      tomestoImageCount: 0,
      intentResponse: {
        parsedJson: {
          steps: [
            {
              role: 'place_food',
              preferredTerms: ['ресторан'],
              avoidTerms: [],
              instruction: 'Ресторан',
            },
          ],
        },
      },
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-no-city-images-yet',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Ресторан без импортированной картинки',
            category: 'food',
            tags: ['occasion:food', 'place:restaurant'],
            lat: 55.732,
            lng: 37.602,
            placeKind: 'food',
            venueName: 'Ресторан без импортированной картинки',
            sourceProvider: 'ТоМесто',
            imageUrl: null,
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Ресторан',
            vibe: 'Без падения',
            blurb: 'Проверка fallback.',
            steps: [{ externalContentItemId: 'tomesto-no-city-images-yet', timeLabel: '19:00' }],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    await service.createDraft('user-1', {
      prompt: 'хочу ресторан',
      city: 'Москва',
    });

    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.candidates.map((candidate: any) => candidate.id)).toEqual([
      'tomesto-no-city-images-yet',
    ]);
  });

  it('carries candidate images into AI draft route steps', async () => {
    const imageVariants = {
      card: {
        url: 'https://cdn.test/brix__card.webp',
        width: 720,
        height: 540,
      },
    };
    const { service, draftCreate } = createService({
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-bar',
            title: 'Brix',
            venueName: 'Brix',
            imageUrl: 'https://cdn.test/brix.jpg',
            imageVariants,
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-show',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            title: 'Стендап',
            category: 'standup',
            contentKind: 'event',
            startsAt: new Date('2099-06-01T17:30:00.000Z'),
            priceFrom: 1200,
            lat: 55.765,
            lng: 37.615,
            imageUrl: 'https://cdn.test/show.jpg',
            sourceProvider: 'Ticketland / MTS Live',
          },
        ],
      },
    });

    const result = await service.createDraft('user-1', {
      prompt: 'Винный бар и стендап',
      city: 'Москва',
      stepCount: 2,
    });

    expect(result.route.steps[0]).toMatchObject({
      title: 'Brix',
      imageUrl: 'https://cdn.test/brix.jpg',
      imageVariants,
    });
    expect(result.route.steps[1]).toMatchObject({
      title: 'Стендап',
      imageUrl: 'https://cdn.test/show.jpg',
    });
    const createPayload = draftCreate.mock.calls[0]?.[0];
    expect(createPayload?.data.routeSnapshotJson.steps[0]).toMatchObject({
      imageUrl: 'https://cdn.test/brix.jpg',
      imageVariants,
    });
  });

  it('keeps Ticketland show candidates without coordinates in the AI draft pack', async () => {
    const { service, externalFindMany, draftCreate, openRouter } = createService({
      ticketlandWithoutCoords: true,
    });

    const result = await service.createDraft('user-1', {
      prompt: 'Винный бар и стендап',
      city: 'Москва',
      stepCount: 2,
    });

    const ticketlandCall = externalFindMany.mock.calls.find(
      ([query]) => query?.where?.source?.code === 'advcake_ticketland',
    )?.[0];
    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    expect(ticketlandCall?.where).not.toHaveProperty('lat');
    expect(ticketlandCall?.where).not.toHaveProperty('lng');
    expect(routeCall?.userPrompt).toContain('"geo":null');
    expect(draftCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          candidatePackJson: expect.arrayContaining([
            expect.objectContaining({
              id: 'ticketland-show',
              source: 'advcake_ticketland',
              lat: null,
              lng: null,
            }),
          ]),
        }),
      }),
    );
    expect(result.route.steps[1]).toEqual(
      expect.objectContaining({
        title: 'Стендап',
        ticketSourceCode: 'advcake_ticketland',
        distance: 'адрес в билете',
        walkMin: null,
        lat: expect.any(Number),
        lng: expect.any(Number),
      }),
    );
  });

  it('honors ordered walk, pasta and theatre intent from prompt', async () => {
    const prompt = 'хочу погулять сначала, потом поесть пасту и пойти в театр';
    const { service, draftCreate, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          routeStepCount: 3,
          stepCountReason: 'Пользователь просит три действия по порядку.',
          steps: [
            {
              role: 'walk',
              preferredTerms: ['прогул', 'маршрут'],
              avoidTerms: ['музей', 'выставка'],
              instruction: 'Сначала прогулка.',
            },
            {
              role: 'place_food',
              preferredTerms: ['паста', 'итальян'],
              avoidTerms: [],
              instruction: 'Потом место с пастой.',
            },
            {
              role: 'show',
              preferredTerms: ['театр', 'спектак'],
              avoidTerms: ['музей', 'выставка'],
              instruction: 'Затем театр.',
            },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 25,
      },
      externalItems: {
        kudago: [
          {
            id: 'kudago-walk-route',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'event',
            title: 'Прогулка по Чистым прудам',
            category: 'walk',
            tags: ['прогулка', 'маршрут'],
            startsAt: new Date('2099-06-01T16:00:00.000Z'),
            priceFrom: 0,
            priceMode: 'free',
            sourceProvider: 'KudaGo',
          },
          {
            id: 'kudago-museum',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'event',
            title: 'Государственный музей Пушкина',
            category: 'museum',
            tags: ['музей', 'выставка'],
            startsAt: new Date('2099-06-01T18:00:00.000Z'),
            priceFrom: 0,
            priceMode: 'free',
            sourceProvider: 'KudaGo',
          },
        ],
        tomesto: [
          {
            id: 'tomesto-generic',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'After Seven',
            category: 'restaurant',
            tags: ['restaurant'],
            placeKind: 'restaurant',
            venueName: 'After Seven',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-pasta',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Pasta Fresca',
            category: 'italian',
            tags: ['паста', 'итальянская кухня', 'cuisine:italyanskaya'],
            placeKind: 'restaurant',
            venueName: 'Pasta Fresca',
            shortSummary: 'Итальянский ресторан с пастой',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-theatre',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Спектакль в Театре на Малой Ордынке',
            category: 'theatre',
            tags: ['театр', 'спектакль'],
            startsAt: new Date('2099-06-01T19:30:00.000Z'),
            priceFrom: 1800,
            sourceProvider: 'Ticketland / MTS Live',
            actionUrl: 'https://ticket.example.test/theatre',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Прогулка, ужин и театр',
            vibe: 'Вечер по порядку',
            blurb: 'Сначала прогулка, потом паста и спектакль.',
            steps: [
              {
                externalContentItemId: 'kudago-walk-route',
                timeLabel: '18:00',
                endTimeLabel: '19:00',
                description: 'Маршрут для прогулки',
              },
              {
                externalContentItemId: 'tomesto-generic',
                timeLabel: '19:00',
                endTimeLabel: '20:00',
                description: 'Случайный ресторан',
              },
              {
                externalContentItemId: 'ticketland-theatre',
                timeLabel: '20:00',
                endTimeLabel: '22:00',
                description: 'Спектакль',
              },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 100,
        },
        {
          parsedJson: {
            title: 'Прогулка, паста и театр',
            vibe: 'Спокойный вечер',
            blurb: 'Сначала прогулка, потом паста и спектакль.',
            steps: [
              {
                externalContentItemId: 'kudago-walk-route',
                timeLabel: '18:00',
                endTimeLabel: '19:00',
                description: 'Маршрут для прогулки',
              },
              {
                externalContentItemId: 'tomesto-pasta',
                timeLabel: '19:00',
                endTimeLabel: '20:00',
                description: 'Итальянский ресторан с пастой',
              },
              {
                externalContentItemId: 'ticketland-theatre',
                timeLabel: '20:00',
                endTimeLabel: '22:00',
                description: 'Спектакль',
              },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 120,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt,
      city: 'Москва',
      stepCount: 3,
    });

    const routeCalls = openRouter.generateJson.mock.calls.filter(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    );
    const firstPrompt = JSON.parse(routeCalls[0][0].userPrompt);
    expect(firstPrompt.config.roles).toEqual(['walk', 'place_food', 'show']);
    expect(firstPrompt.config.roleHints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'walk',
          preferredTerms: expect.arrayContaining(['прогул', 'маршрут']),
        }),
        expect.objectContaining({
          role: 'place_food',
          preferredTerms: expect.arrayContaining(['паста', 'итальян']),
        }),
        expect.objectContaining({
          role: 'show',
          preferredTerms: expect.arrayContaining(['театр', 'спектак']),
        }),
      ]),
    );
    expect(firstPrompt.candidates.map((candidate: any) => candidate.id)).not.toContain('kudago-museum');
    expect(openRouter.generateJson).toHaveBeenCalledTimes(3);
    expect(routeCalls[1][0].userPrompt).toContain('intent_mismatch');
    expect(result.route.steps.map((step: any) => step.title)).toEqual([
      'Прогулка по Чистым прудам',
      'Pasta Fresca',
      'Спектакль в Театре на Малой Ордынке',
    ]);
    expect(draftCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          candidatePackJson: expect.arrayContaining([
            expect.objectContaining({ id: 'kudago-walk-route', role: 'walk' }),
            expect.objectContaining({ id: 'tomesto-pasta', role: 'place_food' }),
            expect.objectContaining({ id: 'ticketland-theatre', role: 'show' }),
          ]),
        }),
      }),
    );
  });

  it('uses LLM intent for arbitrary wording and repeated roles', async () => {
    const { service, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          routeStepCount: 3,
          stepCountReason: 'Пользователь просит три релевантные роли.',
          budget: 'low',
          steps: [
            {
              role: 'place_food',
              preferredTerms: ['матча', 'matcha'],
              avoidTerms: [],
              instruction: 'Сначала место с матчей.',
            },
            {
              role: 'show',
              preferredTerms: ['театр', 'спектакль'],
              avoidTerms: ['музей', 'выставка'],
              instruction: 'Потом театральное событие.',
            },
            {
              role: 'place_food',
              preferredTerms: ['кофе', 'кофейня'],
              avoidTerms: [],
              instruction: 'В конце кофе.',
            },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 25,
      },
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-matcha',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Matcha Point',
            category: 'cafe',
            tags: ['матча', 'чай'],
            placeKind: 'cafe',
            venueName: 'Matcha Point',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-coffee',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Кофейня после театра',
            category: 'cafe',
            tags: ['кофе', 'кофейня'],
            placeKind: 'cafe',
            venueName: 'Кофейня после театра',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-theatre',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Иммерсивный спектакль',
            category: 'theatre',
            tags: ['театр', 'спектакль'],
            startsAt: new Date('2099-06-01T19:30:00.000Z'),
            priceFrom: 1600,
            actionUrl: 'https://ticket.example.test/theatre',
            sourceProvider: 'Ticketland / MTS Live',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Матча, спектакль и кофе',
            vibe: 'Вечер по запросу',
            blurb: 'Сначала матча, потом спектакль и кофе.',
            steps: [
              {
                externalContentItemId: 'tomesto-matcha',
                timeLabel: '18:00',
                endTimeLabel: '19:00',
                description: 'Матча перед событием',
              },
              {
                externalContentItemId: 'ticketland-theatre',
                timeLabel: '19:30',
                endTimeLabel: '21:30',
                description: 'Спектакль',
              },
              {
                externalContentItemId: 'tomesto-coffee',
                timeLabel: '21:45',
                endTimeLabel: '22:30',
                description: 'Кофе после театра',
              },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 90,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt: 'хочу сначала матчовый ритуал, потом на сцену, в конце допить кофе',
      city: 'Москва',
      stepCount: 3,
    });

    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.config.roles).toEqual(['place_food', 'show', 'place_food']);
    expect(routePrompt.config.roleHints[0].preferredTerms).toEqual(
      expect.arrayContaining(['матча']),
    );
    expect(routePrompt.config.roleHints[2].preferredTerms).toEqual(
      expect.arrayContaining(['кофе']),
    );
    expect(result.route.steps.map((step: any) => step.title)).toEqual([
      'Matcha Point',
      'Иммерсивный спектакль',
      'Кофейня после театра',
    ]);
  });

  it('uses intent as source for a simple craft beer place without unrelated roles', async () => {
    const { service, externalFindMany, draftCreate, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          routeStepCount: 1,
          stepCountReason: 'Простой запрос про один тип места.',
          participantsCount: 0,
          dateMode: 'date',
          localDate: '2099-06-01',
          dateReason: 'Пользователь написал сегодня вечером.',
          area: 'center',
          budget: 'low',
          steps: [
            {
              role: 'place_bar',
              preferredTerms: ['крафтовое пиво', 'паб', 'тапрум', 'beer'],
              avoidTerms: ['концерт', 'театр', 'выставка', 'детское', 'активность'],
              instruction: 'Бар с крафтовым пивом.',
            },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-craft-1',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Craft Station',
            category: 'bar',
            tags: ['place:bar', 'feature:craft_beer', 'area:center', 'budget:cheap'],
            area: 'Центр',
            lat: 55.755,
            lng: 37.61,
            priceFrom: 900,
            placeKind: 'bar',
            venueName: 'Craft Station',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-craft-2',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Taproom Center',
            category: 'bar',
            tags: ['place:bar', 'set:craft_beer', 'metro:teatralnaya'],
            area: 'Центр',
            lat: 55.756,
            lng: 37.611,
            priceFrom: 1200,
            placeKind: 'bar',
            venueName: 'Taproom Center',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-show',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Лишний концерт',
            category: 'concert',
            tags: ['концерт'],
            startsAt: new Date('2099-06-01T18:00:00.000Z'),
            priceFrom: 1500,
            actionUrl: 'https://ticket.example.test/show',
            sourceProvider: 'Ticketland / MTS Live',
          },
        ],
        kudago: [
          {
            id: 'kudago-walk',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'place',
            title: 'Лишняя прогулка',
            category: 'walk',
            tags: ['прогулка'],
            priceMode: 'unknown',
            priceFrom: null,
            sourceProvider: 'KudaGo',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Крафтовое пиво в центре',
            vibe: 'Один бар без лишних активностей',
            blurb: 'Место с крафтовым пивом.',
            steps: [
              { externalContentItemId: 'tomesto-craft-1', timeLabel: '19:00' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 90,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt: 'хочу попить крафтового пива сегодня вечером в центре',
      city: 'Москва',
    });

    const intentPrompt = JSON.parse(openRouter.generateJson.mock.calls[0][0].userPrompt);
    expect(intentPrompt.config).toEqual(
      expect.objectContaining({
        city: 'Москва',
        timezone: 'Europe/Moscow',
        todayLocalDate: '2099-06-01',
        minStepCount: 1,
        maxStepCount: 5,
        stepCountMode: 'infer',
        area: null,
        budget: null,
      }),
    );
    expect(intentPrompt.config).not.toHaveProperty('defaultStepCount');
    expect(intentPrompt.config).not.toHaveProperty('fallbackRoles');
    expect(intentPrompt.config).not.toHaveProperty('suggestedStepCount');

    const sourceCodes = externalFindMany.mock.calls.map(
      ([query]: [any]) => query?.where?.source?.code,
    );
    expect(sourceCodes).toEqual(['tomesto']);

    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.config.roles).toEqual(['place_bar']);
    expect(routePrompt.config.stepCount).toBe(1);
    expect(routePrompt.config.area).toBe('center');
    expect(routePrompt.config.budget).toBe('low');
    expect(routePrompt.candidates.every((candidate: any) => candidate.role === 'place_bar')).toBe(true);

    expect(result.route.area).toBe('Центр');
    expect(result.route.steps.map((step: any) => step.ticketSourceCode)).toEqual(['tomesto']);
    expect(result.route.steps.map((step: any) => step.title)).toEqual(['Craft Station']);
    expect(draftCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          area: 'center',
          budget: 'low',
          stepCount: 1,
        }),
      }),
    );
  });

  it('sends only the top ranked candidates per route step to OpenRouter', async () => {
    const cityBars = Array.from({ length: 800 }, (_item, index) => ({
      id: `tomesto-large-${index}`,
      source: { code: 'tomesto', name: 'ТоМесто' },
      contentKind: 'place',
      title: `Craft Bar ${String(index).padStart(3, '0')}`,
      category: 'bar',
      tags: ['place:bar', index === 0 ? 'feature:craft_beer' : 'bar'],
      area: index % 2 === 0 ? 'Центр' : 'Север',
      lat: 55.7 + index / 10000,
      lng: 37.5 + index / 10000,
      priceFrom: 1000 + index,
      placeKind: 'bar',
      venueName: `Craft Bar ${index}`,
      sourceProvider: 'ТоМесто',
    }));
    const cityShows = Array.from({ length: 140 }, (_item, index) => ({
      id: `ticketland-large-${index}`,
      source: { code: 'advcake_ticketland', name: 'Ticketland' },
      contentKind: 'event',
      title: `Стендап ${String(index).padStart(3, '0')}`,
      category: 'standup',
      tags: ['standup'],
      area: 'Центр',
      lat: 55.73 + index / 10000,
      lng: 37.53 + index / 10000,
      startsAt: new Date('2099-06-01T17:30:00.000Z'),
      priceFrom: 1200 + index,
      venueName: `Stage ${index}`,
      sourceProvider: 'Ticketland / MTS Live',
    }));
    const cityWalks = Array.from({ length: 420 }, (_item, index) => ({
      id: `kudago-large-${index}`,
      source: { code: 'kudago', name: 'KudaGo' },
      contentKind: 'place',
      title: `Парк прогулка ${String(index).padStart(3, '0')}`,
      category: 'park',
      tags: ['walk', 'outdoor', 'park'],
      area: 'Центр',
      lat: 55.74 + index / 10000,
      lng: 37.54 + index / 10000,
      priceFrom: 0,
      priceMode: 'free',
      venueName: `Парк ${index}`,
      sourceProvider: 'KudaGo',
    }));
    const { service, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          routeStepCount: 3,
          stepCountReason: 'Пользователь попросил бар, шоу и прогулку.',
          participantsCount: 0,
          dateMode: 'date',
          localDate: '2099-06-01',
          dateReason: 'Пользователь указал сегодня.',
          area: 'center',
          budget: 'low',
          steps: [
            {
              role: 'place_bar',
              preferredTerms: ['крафт', 'пиво'],
              avoidTerms: [],
              instruction: 'Подобрать бар.',
            },
            {
              role: 'show',
              preferredTerms: ['стендап'],
              avoidTerms: [],
              instruction: 'Подобрать шоу.',
            },
            {
              role: 'walk',
              preferredTerms: ['прогулка', 'парк'],
              avoidTerms: [],
              instruction: 'Подобрать прогулку.',
            },
          ],
        },
      },
      externalItems: {
        tomesto: cityBars,
        advcake_ticketland: cityShows,
        kudago: cityWalks,
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Большой пул кандидатов',
            vibe: 'Выбор из города',
            blurb: 'Модель видит городские источники.',
            steps: [
              { externalContentItemId: 'tomesto-large-0', timeLabel: '19:00' },
              { externalContentItemId: 'ticketland-large-0', timeLabel: '20:00' },
              { externalContentItemId: 'kudago-large-0', timeLabel: '22:00' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 80,
        },
      ],
    });

    await service.createDraft('user-1', {
      prompt: 'крафтовое пиво, стендап и прогулка сегодня в центре',
      city: 'Москва',
    });

    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.candidates.filter((candidate: any) => candidate.source === 'tomesto')).toHaveLength(20);
    expect(
      routePrompt.candidates.filter((candidate: any) => candidate.source === 'advcake_ticketland'),
    ).toHaveLength(10);
    expect(routePrompt.candidates.filter((candidate: any) => candidate.source === 'kudago')).toHaveLength(10);
    expect(routePrompt.candidates).toHaveLength(40);
  });

  it('reuses the city Tomesto candidate scan across repeated Tomesto steps', async () => {
    const cityPlaces = [
      {
        id: 'tomesto-bar-1',
        source: { code: 'tomesto', name: 'ТоМесто' },
        contentKind: 'place',
        title: 'Craft Bar',
        category: 'bar',
        tags: ['place:bar', 'feature:craft_beer'],
        area: 'Центр',
        lat: 55.731,
        lng: 37.601,
        priceFrom: 1600,
        placeKind: 'bar',
        venueName: 'Craft Bar',
        sourceProvider: 'ТоМесто',
      },
      {
        id: 'tomesto-food-1',
        source: { code: 'tomesto', name: 'ТоМесто' },
        contentKind: 'place',
        title: 'Casa Bella',
        category: 'food',
        tags: ['occasion:food', 'cuisine:italyanskaya'],
        area: 'Центр',
        lat: 55.732,
        lng: 37.602,
        priceFrom: 2100,
        placeKind: 'food',
        venueName: 'Casa Bella',
        sourceProvider: 'ТоМесто',
      },
      {
        id: 'tomesto-bar-2',
        source: { code: 'tomesto', name: 'ТоМесто' },
        contentKind: 'place',
        title: 'Wine Room',
        category: 'bar',
        tags: ['place:bar', 'set:wine'],
        area: 'Центр',
        lat: 55.733,
        lng: 37.603,
        priceFrom: 1800,
        placeKind: 'bar',
        venueName: 'Wine Room',
        sourceProvider: 'ТоМесто',
      },
    ];
    const { service, externalFindMany } = createService({
      intentResponse: {
        parsedJson: {
          routeStepCount: 3,
          steps: [
            {
              role: 'place_bar',
              taxonomyTags: ['place:bar'],
              preferredTerms: ['крафт'],
              avoidTerms: [],
              instruction: '',
            },
            {
              role: 'place_food',
              taxonomyTags: ['cuisine:italyanskaya'],
              preferredTerms: ['итальянская кухня'],
              avoidTerms: [],
              instruction: '',
            },
            {
              role: 'place_bar',
              taxonomyTags: ['place:bar'],
              preferredTerms: ['вино'],
              avoidTerms: [],
              instruction: '',
            },
          ],
        },
      },
      externalItems: {
        tomesto: cityPlaces,
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Три места',
            vibe: 'Места из одного городского пула',
            blurb: 'Проверяем повторное чтение.',
            steps: [
              { externalContentItemId: 'tomesto-bar-1', timeLabel: '18:00' },
              { externalContentItemId: 'tomesto-food-1', timeLabel: '19:00' },
              { externalContentItemId: 'tomesto-bar-2', timeLabel: '20:00' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    await service.createDraft('user-1', {
      prompt: '3 места: крафтовое пиво, итальянская кухня и винный бар',
      city: 'Москва',
    });

    const tomestoQueries = externalFindMany.mock.calls
      .map(([query]: [any]) => query)
      .filter((query: any) => query?.where?.source?.code === 'tomesto');
    expect(tomestoQueries).toHaveLength(1);
  });

  it('lets intent turn an explicit three-place prompt into three steps', async () => {
    const { service, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          routeStepCount: 3,
          stepCountReason: 'Пользователь явно попросил 3 места.',
          participantsCount: 0,
          dateMode: 'none',
          localDate: '',
          dateReason: 'Дата не указана.',
          area: '',
          budget: '',
          steps: [
            { role: 'place_bar', preferredTerms: ['крафт'], avoidTerms: [], instruction: '' },
            { role: 'place_bar', preferredTerms: ['паб'], avoidTerms: [], instruction: '' },
            { role: 'place_bar', preferredTerms: ['beer'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-bar-1',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Craft One',
            category: 'bar',
            tags: ['place:bar', 'feature:craft_beer'],
            lat: 55.75,
            lng: 37.6,
            priceFrom: 1200,
            placeKind: 'bar',
            venueName: 'Craft One',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-bar-2',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Craft Two',
            category: 'bar',
            tags: ['place:bar', 'pub'],
            lat: 55.751,
            lng: 37.601,
            priceFrom: 1300,
            placeKind: 'bar',
            venueName: 'Craft Two',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-bar-3',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Craft Three',
            category: 'bar',
            tags: ['place:bar', 'beer'],
            lat: 55.752,
            lng: 37.602,
            priceFrom: 1400,
            placeKind: 'bar',
            venueName: 'Craft Three',
            sourceProvider: 'ТоМесто',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Три бара',
            vibe: 'По запросу',
            blurb: 'Три места с пивом.',
            steps: [
              { externalContentItemId: 'tomesto-bar-1', timeLabel: '19:00' },
              { externalContentItemId: 'tomesto-bar-2', timeLabel: '20:00' },
              { externalContentItemId: 'tomesto-bar-3', timeLabel: '21:00' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt: '3 места с крафтовым пивом',
      city: 'Москва',
    });

    const intentPrompt = JSON.parse(openRouter.generateJson.mock.calls[0][0].userPrompt);
    expect(intentPrompt.config).not.toHaveProperty('promptStepCountHint');
    expect(intentPrompt.config.maxStepCount).toBe(5);
    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.config.stepCount).toBe(3);
    expect(routePrompt.config.roles).toEqual(['place_bar', 'place_bar', 'place_bar']);
    expect(result.route.steps).toHaveLength(3);
  });

  it('lets LLM intent infer step count and low budget without button filters', async () => {
    const { service, draftCreate, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          routeStepCount: 2,
          stepCountReason: 'Пользователь просит прогулку и недорогую еду.',
          budget: 'low',
          steps: [
            {
              role: 'walk',
              preferredTerms: ['прогулка', 'парк'],
              avoidTerms: ['музей', 'каток'],
              instruction: 'Сначала прогулка.',
            },
            {
              role: 'place_food',
              preferredTerms: ['недорог', 'budget:cheap'],
              avoidTerms: [],
              instruction: 'Потом недорого поесть.',
            },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 40,
      },
      externalItems: {
        kudago: [
          {
            id: 'kudago-park',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'place',
            title: 'Парк Горького',
            category: 'park',
            tags: ['парк', 'прогулка'],
            priceMode: 'unknown',
            priceFrom: null,
            sourceProvider: 'KudaGo',
          },
        ],
        tomesto: [
          {
            id: 'tomesto-expensive',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Дорогой ресторан',
            category: 'restaurant',
            tags: ['restaurant'],
            priceFrom: 4200,
            placeKind: 'restaurant',
            venueName: 'Дорогой ресторан',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-cheap',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Недорогая паста',
            category: 'restaurant',
            tags: ['budget:cheap', 'паста'],
            priceFrom: 1000,
            placeKind: 'restaurant',
            venueName: 'Недорогая паста',
            sourceProvider: 'ТоМесто',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Прогулка и недорогая еда',
            vibe: 'Спокойно и бюджетно',
            blurb: 'Сначала парк, потом недорого поесть.',
            steps: [
              {
                externalContentItemId: 'kudago-park',
                timeLabel: '18:00',
                endTimeLabel: '19:00',
                description: 'Прогулка',
              },
              {
                externalContentItemId: 'tomesto-cheap',
                timeLabel: '19:00',
                endTimeLabel: '20:00',
                description: 'Недорого поесть',
              },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 90,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt: 'хочу погулять и покушать не дорого',
      city: 'Москва',
    });

    const intentPrompt = JSON.parse(openRouter.generateJson.mock.calls[0][0].userPrompt);
    expect(intentPrompt.config).toEqual(
      expect.objectContaining({
        stepCountMode: 'infer',
        maxStepCount: 5,
        budget: null,
      }),
    );
    expect(intentPrompt.config).not.toHaveProperty('promptStepCountHint');
    expect(intentPrompt.config).not.toHaveProperty('defaultStepCount');
    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.config.stepCount).toBe(2);
    expect(routePrompt.config.budget).toBe('low');
    const foodCandidateIds = routePrompt.candidates
      .filter((candidate: any) => candidate.role === 'place_food')
      .map((candidate: any) => candidate.id);
    expect(foodCandidateIds.indexOf('tomesto-cheap')).toBeLessThan(
      foodCandidateIds.indexOf('tomesto-expensive'),
    );
    expect(result.route.steps.map((step: any) => step.title)).toEqual([
      'Парк Горького',
      'Недорогая паста',
    ]);
    expect(draftCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          budget: 'low',
          stepCount: 2,
        }),
      }),
    );
  });

  it('does not treat participant count as route step count', async () => {
    const { service, draftCreate, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          routeStepCount: 2,
          stepCountReason: '4 человека это размер компании, не число точек.',
          participantsCount: 4,
          steps: [
            {
              role: 'walk',
              preferredTerms: ['центр', 'прогулка'],
              avoidTerms: [],
              instruction: 'Сначала прогулка по центру.',
            },
            {
              role: 'place_bar',
              preferredTerms: ['пивной бар', 'пиво'],
              avoidTerms: [],
              instruction: 'Потом пивной бар.',
            },
            {
              role: 'show',
              preferredTerms: ['шоу'],
              avoidTerms: [],
              instruction: 'Ошибочный лишний шаг.',
            },
            {
              role: 'free_activity',
              preferredTerms: ['прогулка'],
              avoidTerms: [],
              instruction: 'Ошибочный лишний шаг.',
            },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 40,
      },
      externalItems: {
        kudago: [
          {
            id: 'kudago-center-walk',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'place',
            title: 'Центральная прогулка',
            category: 'walk',
            tags: ['прогулка', 'центр', 'area:center'],
            priceMode: 'unknown',
            priceFrom: null,
            sourceProvider: 'KudaGo',
          },
          {
            id: 'kudago-free',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'event',
            title: 'Уличная активность',
            category: 'festival',
            tags: ['фестиваль'],
            startsAt: new Date('2099-06-01T18:00:00.000Z'),
            priceMode: 'free',
            priceFrom: 0,
            sourceProvider: 'KudaGo',
          },
        ],
        tomesto: [
          {
            id: 'tomesto-beer-bar',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Пивной бар на компанию',
            category: 'bar',
            tags: ['place:bar', 'drink:beer', 'пиво'],
            priceFrom: 1800,
            placeKind: 'bar',
            venueName: 'Пивной бар на компанию',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-show',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Лишнее шоу',
            category: 'show',
            tags: ['шоу'],
            startsAt: new Date('2099-06-01T19:30:00.000Z'),
            priceFrom: 1500,
            actionUrl: 'https://ticket.example.test/show',
            sourceProvider: 'Ticketland / MTS Live',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Прогулка и пивной бар',
            vibe: 'Спокойный вечер',
            blurb: 'Сначала центр, потом бар.',
            steps: [
              { externalContentItemId: 'kudago-center-walk', timeLabel: '19:00' },
              { externalContentItemId: 'tomesto-beer-bar', timeLabel: '20:00' },
              { externalContentItemId: 'ticketland-show', timeLabel: '21:00' },
              { externalContentItemId: 'kudago-free', timeLabel: '22:00' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt: 'хочу вечером прогуляться по центру и потом в пивной бар на 4 человек',
      city: 'Москва',
    });

    const intentPrompt = JSON.parse(openRouter.generateJson.mock.calls[0][0].userPrompt);
    expect(intentPrompt.config).toEqual(
      expect.objectContaining({
        stepCountMode: 'infer',
        maxStepCount: 5,
      }),
    );
    expect(intentPrompt.config).not.toHaveProperty('participantsCount');
    expect(intentPrompt.config).not.toHaveProperty('promptStepCountHint');
    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.config.stepCount).toBe(2);
    expect(routePrompt.config.roles).toEqual(['walk', 'place_bar']);
    expect(result.route.steps.map((step: any) => step.title)).toEqual([
      'Центральная прогулка',
      'Пивной бар на компанию',
    ]);
    expect(draftCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stepCount: 2,
        }),
      }),
    );
  });

  it('does not rewrite LLM intent roles from prompt keywords', async () => {
    const { service, draftCreate, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          routeStepCount: 2,
          stepCountReason: 'LLM chose unrelated roles with the right count.',
          participantsCount: 4,
          budget: 'mid',
          steps: [
            {
              role: 'place_food',
              preferredTerms: ['перекус', 'бургер'],
              avoidTerms: [],
              instruction: 'Перекус.',
            },
            {
              role: 'show',
              preferredTerms: ['шоу'],
              avoidTerms: [],
              instruction: 'Лишний шаг.',
            },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 40,
      },
      externalItems: {
        kudago: [
          {
            id: 'kudago-karting',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'event',
            title: 'Картинг на компанию',
            category: 'sport',
            tags: ['спорт', 'адреналин', 'картинг'],
            startsAt: new Date('2099-06-01T18:00:00.000Z'),
            priceMode: 'paid',
            priceFrom: 1800,
            sourceProvider: 'KudaGo',
          },
          {
            id: 'kudago-walk',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'place',
            title: 'Набережная для прогулки',
            category: 'walk',
            tags: ['прогулка'],
            priceMode: 'unknown',
            priceFrom: null,
            sourceProvider: 'KudaGo',
          },
        ],
        tomesto: [
          {
            id: 'tomesto-snack',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Бургерная после картинга',
            category: 'restaurant',
            tags: ['перекус', 'бургер', 'budget:mid'],
            priceFrom: 1200,
            placeKind: 'restaurant',
            venueName: 'Бургерная после картинга',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-bar',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Лишний бар',
            category: 'bar',
            tags: ['bar'],
            priceFrom: 1400,
            placeKind: 'bar',
            venueName: 'Лишний бар',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-show',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Шоу по версии AI',
            category: 'show',
            tags: ['шоу'],
            startsAt: new Date('2099-06-01T19:30:00.000Z'),
            priceFrom: 1500,
            actionUrl: 'https://ticket.example.test/show',
            sourceProvider: 'Ticketland / MTS Live',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Intent решает роли',
            vibe: 'Backend не переписывает',
            blurb: 'Проверяем, что backend не заменяет роли по словам prompt.',
            steps: [
              { externalContentItemId: 'tomesto-snack', timeLabel: '19:00' },
              { externalContentItemId: 'ticketland-show', timeLabel: '20:30' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 90,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt:
        'Собери активный вечер на 4-6 человек: что-то спортивное или адреналиновое, потом перекус. Бюджет до 3к на человека.',
      city: 'Москва',
    });

    const intentPrompt = JSON.parse(openRouter.generateJson.mock.calls[0][0].userPrompt);
    expect(intentPrompt.config).not.toHaveProperty('participantsCount');
    expect(intentPrompt.config.budget).toBeNull();
    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.config.stepCount).toBe(2);
    expect(routePrompt.config.roles).toEqual(['place_food', 'show']);
    expect(routePrompt.config.budget).toBe('mid');
    expect(result.route.steps.map((step: any) => step.title)).toEqual([
      'Бургерная после картинга',
      'Шоу по версии AI',
    ]);
    expect(draftCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stepCount: 2,
          budget: 'mid',
        }),
      }),
    );
  });

  it('uses LLM intent for a creative date as one unusual activity', async () => {
    const { service, draftCreate, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          routeStepCount: 1,
          stepCountReason: 'Примеры описывают один нестандартный формат.',
          participantsCount: 2,
          budget: '',
          steps: [
            {
              role: 'free_activity',
              preferredTerms: ['выставка', 'перформанс'],
              avoidTerms: [],
              instruction: 'Странное креативное место.',
            },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 40,
      },
      externalItems: {
        kudago: [
          {
            id: 'kudago-performance',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'event',
            title: 'Иммерсивный перформанс',
            category: 'exhibition',
            tags: ['выставка', 'перформанс', 'нестандартное'],
            startsAt: new Date('2099-06-01T18:00:00.000Z'),
            priceMode: 'free',
            priceFrom: 0,
            sourceProvider: 'KudaGo',
          },
          {
            id: 'kudago-walk',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'place',
            title: 'Прогулка',
            category: 'walk',
            tags: ['прогулка'],
            priceMode: 'unknown',
            priceFrom: null,
            sourceProvider: 'KudaGo',
          },
        ],
        tomesto: [
          {
            id: 'tomesto-food',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Лишняя еда',
            category: 'restaurant',
            tags: ['еда'],
            placeKind: 'restaurant',
            venueName: 'Лишняя еда',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-bar',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Лишний бар',
            category: 'bar',
            tags: ['bar'],
            placeKind: 'bar',
            venueName: 'Лишний бар',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-show',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Лишнее шоу',
            category: 'show',
            tags: ['шоу'],
            startsAt: new Date('2099-06-01T19:30:00.000Z'),
            priceFrom: 1500,
            actionUrl: 'https://ticket.example.test/show',
            sourceProvider: 'Ticketland / MTS Live',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Креативное свидание',
            vibe: 'Необычно',
            blurb: 'Одна сильная точка.',
            steps: [
              { externalContentItemId: 'kudago-performance', timeLabel: '19:00' },
              { externalContentItemId: 'tomesto-food', timeLabel: '20:00' },
              { externalContentItemId: 'kudago-walk', timeLabel: '21:00' },
              { externalContentItemId: 'tomesto-bar', timeLabel: '22:00' },
              { externalContentItemId: 'ticketland-show', timeLabel: '23:00' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 90,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt:
        'Что-нибудь странное и креативное для первого свидания - выставка, перформанс, нестандартное место. Удивить.',
      city: 'Москва',
    });

    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.config.stepCount).toBe(1);
    expect(routePrompt.config.roles).toEqual(['free_activity']);
    expect(result.route.steps.map((step: any) => step.title)).toEqual([
      'Иммерсивный перформанс',
    ]);
    expect(draftCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stepCount: 1,
        }),
      }),
    );
  });

  it.each([
    {
      name: 'intent call fails',
      intentResponse: new Error('intent down'),
    },
    {
      name: 'intent response cannot become a valid route intent',
      intentResponse: {
        parsedJson: {
          routeStepCount: 0,
          stepCountReason: 'Invalid count below product minimum.',
          participantsCount: 0,
          dateMode: 'none',
          localDate: '',
          dateReason: 'Дата не указана.',
          area: '',
          budget: '',
          steps: [
            { role: 'place_bar', preferredTerms: ['бар'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 20,
      },
    },
  ])('uses prompt-aware fallback when $name', async ({ intentResponse }) => {
    const { service, openRouter } = createService({
      intentResponse,
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-dinner',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Ресторан в центре',
            category: 'restaurant',
            tags: ['restaurant', 'area:center'],
            area: 'Центр',
            lat: 55.76,
            lng: 37.61,
            priceFrom: 2000,
            placeKind: 'restaurant',
            venueName: 'Ресторан в центре',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-theatre',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Спектакль в центре',
            category: 'theatre',
            tags: ['театр', 'спектакль'],
            startsAt: new Date('2099-06-01T19:30:00.000Z'),
            priceFrom: 2200,
            sourceProvider: 'Ticketland / MTS Live',
            actionUrl: 'https://ticket.example.test/theatre',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Ресторан и спектакль',
            vibe: 'Fallback',
            blurb: 'Fallback from prompt text.',
            steps: [
              { externalContentItemId: 'tomesto-dinner', timeLabel: '19:00' },
              { externalContentItemId: 'ticketland-theatre', timeLabel: '20:30' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    await service.createDraft('user-1', {
      prompt: '2 точки в центре: ресторан и спектакль',
      city: 'Москва',
    });

    expect(openRouter.generateJson.mock.calls[0][0].responseFormat.json_schema.name).toBe(
      'evening_ai_route_intent',
    );
    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.config.roles).toEqual(['place_food', 'show']);
    expect(routePrompt.config.area).toBe('center');
    expect(routePrompt.config.stepCount).toBe(2);
  });

  it('uses prompt sequence as fallback when intent call fails', async () => {
    const { service, openRouter, draftCreate } = createService({
      intentResponse: new Error('intent down'),
      externalItems: {
        kudago: [
          {
            id: 'kudago-center-walk',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'event',
            title: 'Прогулка по центру',
            category: 'walk',
            tags: ['прогулка', 'центр'],
            startsAt: new Date('2099-06-01T16:00:00.000Z'),
            priceFrom: 0,
            priceMode: 'free',
            sourceProvider: 'KudaGo',
          },
        ],
        tomesto: [
          {
            id: 'tomesto-beer-bar',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Пивной бар в центре',
            category: 'bar',
            tags: ['пиво', 'бар', 'area:center'],
            area: 'Центр',
            priceFrom: 1200,
            placeKind: 'bar',
            venueName: 'Пивной бар в центре',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-standup',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Стендап в центре',
            category: 'standup',
            tags: ['стендап'],
            startsAt: new Date('2099-06-01T19:30:00.000Z'),
            priceFrom: 1800,
            sourceProvider: 'Ticketland / MTS Live',
            actionUrl: 'https://ticket.example.test/standup',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Прогулка, бар и стендап',
            vibe: 'Вечер по шагам',
            blurb: 'Сначала прогулка, потом пиво и стендап.',
            steps: [
              { externalContentItemId: 'kudago-center-walk', timeLabel: '18:00' },
              { externalContentItemId: 'tomesto-beer-bar', timeLabel: '19:00' },
              { externalContentItemId: 'ticketland-standup', timeLabel: '20:30' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt: 'хочу погулять в центре, потом попить пива, потом на стендап',
      city: 'Москва',
    });

    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.config.roles).toEqual(['walk', 'place_bar', 'show']);
    expect(routePrompt.config.area).toBe('center');
    expect(routePrompt.config.stepCount).toBe(3);
    expect(result.route.steps.map((step: any) => step.title)).toEqual([
      'Прогулка по центру',
      'Пивной бар в центре',
      'Стендап в центре',
    ]);
    expect(draftCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stepCount: 3,
        }),
      }),
    );
  });

  it('uses explicit prompt place count as fallback when intent call fails', async () => {
    const { service, openRouter, draftCreate } = createService({
      intentResponse: new Error('intent down'),
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-dinner',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Необычная кухня',
            category: 'restaurant',
            tags: ['кухня', 'гастро', 'place:restaurant', 'area:center', 'set:patriki'],
            area: 'Патрики',
            priceFrom: 2500,
            placeKind: 'restaurant',
            venueName: 'Необычная кухня',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-cocktails',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Авторские коктейли',
            category: 'bar',
            tags: ['коктейли', 'bar', 'place:bar', 'set:cocktails', 'area:center', 'set:patriki'],
            area: 'Патрики',
            priceFrom: 1800,
            placeKind: 'bar',
            venueName: 'Авторские коктейли',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-tastes',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Новые вкусы',
            category: 'restaurant',
            tags: ['кухня', 'гастро', 'place:restaurant', 'area:center', 'set:patriki'],
            area: 'Патрики',
            priceFrom: 2200,
            placeKind: 'restaurant',
            venueName: 'Новые вкусы',
            sourceProvider: 'ТоМесто',
          },
        ],
        kudago: [
          {
            id: 'kudago-experience',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'event',
            title: 'Новые впечатления',
            category: 'performance',
            tags: ['перформанс', 'впечатления'],
            startsAt: new Date('2099-06-01T18:00:00.000Z'),
            priceFrom: 0,
            priceMode: 'free',
            sourceProvider: 'KudaGo',
          },
        ],
      },
    });

    const result = await service.createDraft('user-1', {
      prompt: 'Хочу гастро-тур по 3 местам в районе Патриарших: необычная кухня, авторские коктейли, новые впечатления.',
      city: 'Москва',
    });

    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.config.roles).toEqual(['place_food', 'place_bar', 'place_food']);
    expect(routePrompt.config.area).toBe('patriki');
    expect(routePrompt.config.stepCount).toBe(3);
    expect(result.route.steps).toHaveLength(3);
    expect(draftCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stepCount: 3,
        }),
      }),
    );
  });

  it('does not treat Barrikadnaya area wording as a bar in prompt fallback', async () => {
    const { service, openRouter } = createService({
      intentResponse: new Error('intent down'),
      externalItems: {
        kudago: [
          {
            id: 'kudago-barrikadnaya-walk',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'event',
            title: 'Прогулка на Баррикадной',
            category: 'walk',
            tags: ['прогулка', 'патрики'],
            startsAt: new Date('2099-06-01T16:00:00.000Z'),
            priceFrom: 0,
            priceMode: 'free',
            sourceProvider: 'KudaGo',
          },
        ],
      },
    });

    await service.createDraft('user-1', {
      prompt: 'хочу погулять на Баррикадной',
      city: 'Москва',
    });

    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.config.roles).toEqual(['walk']);
    expect(routePrompt.config.area).toBe('patriki');
  });

  it('defaults timed event candidates to today when intent has no date', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-16T12:00:00.000Z'));

    const { service, openRouter } = createService({
      filterExternalItemsByQuery: true,
      intentResponse: {
        parsedJson: {
          routeStepCount: 2,
          stepCountReason: 'Пользователь просит ужин и стендап.',
          participantsCount: 0,
          dateMode: 'none',
          localDate: '',
          dateReason: 'Дата не указана.',
          steps: [
            { role: 'place_food', preferredTerms: ['ужин'], avoidTerms: [], instruction: '' },
            { role: 'show', preferredTerms: ['стендап'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-dinner',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Ресторан для ужина',
            category: 'restaurant',
            tags: ['occasion:food', 'place:restaurant'],
            priceFrom: 2500,
            placeKind: 'restaurant',
            venueName: 'Ресторан для ужина',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-standup-today',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Стендап сегодня',
            category: 'standup',
            tags: ['стендап'],
            startsAt: new Date('2026-05-16T17:30:00.000Z'),
            priceFrom: 1800,
            actionUrl: 'https://ticket.example.test/standup-today',
            sourceProvider: 'Ticketland / MTS Live',
          },
          {
            id: 'ticketland-standup-tomorrow',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Стендап завтра',
            category: 'standup',
            tags: ['стендап'],
            startsAt: new Date('2026-05-17T17:30:00.000Z'),
            priceFrom: 1800,
            actionUrl: 'https://ticket.example.test/standup-tomorrow',
            sourceProvider: 'Ticketland / MTS Live',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Ужин и стендап сегодня',
            vibe: 'Без указанной даты',
            blurb: 'Берем ближайший день.',
            steps: [
              { externalContentItemId: 'tomesto-dinner', timeLabel: '19:00' },
              { externalContentItemId: 'ticketland-standup-today', timeLabel: '20:30' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    await service.createDraft('user-1', {
      prompt: 'ужин и стендап',
      city: 'Москва',
    });

    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.config.eventDateWindow).toEqual({
      label: 'today',
      from: '2026-05-16T12:00:00.000Z',
      to: '2026-05-16T20:59:59.999Z',
    });
    expect(
      routePrompt.candidates
        .filter((candidate: any) => candidate.role === 'show')
        .map((candidate: any) => candidate.id),
    ).toEqual(['ticketland-standup-today']);
  });

  it('uses KudaGo movie showings for the movie role', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-16T10:00:00.000Z'));

    const { service, openRouter } = createService({
      filterExternalItemsByQuery: true,
      intentResponse: {
        parsedJson: {
          routeStepCount: 1,
          stepCountReason: 'Пользователь просит кино.',
          participantsCount: 0,
          dateMode: 'none',
          localDate: '',
          dateReason: 'Дата не указана.',
          steps: [
            { role: 'movie', preferredTerms: ['кино'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        kudago: [
          {
            id: 'kudago-movie-showing',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'event',
            title: 'Фильм',
            category: 'cinema',
            tags: ['movie', 'cinema', 'film', 'metro:kurskaya'],
            startsAt: new Date('2026-05-16T17:30:00.000Z'),
            priceFrom: 650,
            priceMode: 'paid',
            lat: 55.75,
            lng: 37.61,
            venueName: 'Кинотеатр',
            sourceProvider: 'KudaGo',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Кино',
            vibe: 'Один киносеанс.',
            blurb: 'Выбираем ближайший сеанс.',
            steps: [
              { externalContentItemId: 'kudago-movie-showing', timeLabel: '20:30' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt: 'хочу в кино',
      city: 'Москва',
    });

    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.config.roles).toEqual(['movie']);
    expect(routePrompt.candidates).toEqual([
      expect.objectContaining({
        id: 'kudago-movie-showing',
        role: 'movie',
        source: 'kudago',
        category: 'cinema',
      }),
    ]);
    expect(result.route.steps[0]).toEqual(expect.objectContaining({
      title: 'Фильм',
      ticketSourceCode: 'kudago',
    }));
  });

  it('defaults timed event candidates to today in the selected city timezone', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-16T19:30:00.000Z'));

    const { service, openRouter } = createService({
      filterExternalItemsByQuery: true,
      intentResponse: {
        parsedJson: {
          routeStepCount: 2,
          stepCountReason: 'Пользователь просит ужин и стендап.',
          participantsCount: 0,
          dateMode: 'none',
          localDate: '',
          dateReason: 'Дата не указана.',
          steps: [
            { role: 'place_food', preferredTerms: ['ужин'], avoidTerms: [], instruction: '' },
            { role: 'show', preferredTerms: ['стендап'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-dinner',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Ресторан для ужина',
            category: 'restaurant',
            tags: ['occasion:food', 'place:restaurant'],
            priceFrom: 2500,
            placeKind: 'restaurant',
            venueName: 'Ресторан для ужина',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-moscow-today',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Стендап по московскому дню',
            category: 'standup',
            tags: ['стендап'],
            startsAt: new Date('2026-05-16T20:00:00.000Z'),
            priceFrom: 1800,
            actionUrl: 'https://ticket.example.test/moscow-today',
            sourceProvider: 'Ticketland / MTS Live',
          },
          {
            id: 'ticketland-city-today',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Стендап по дню города',
            category: 'standup',
            tags: ['стендап'],
            startsAt: new Date('2026-05-17T16:00:00.000Z'),
            priceFrom: 1800,
            actionUrl: 'https://ticket.example.test/city-today',
            sourceProvider: 'Ticketland / MTS Live',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Ужин и стендап сегодня',
            vibe: 'Городская дата',
            blurb: 'Берем сегодняшний день выбранного города.',
            steps: [
              { externalContentItemId: 'tomesto-dinner', timeLabel: '19:00' },
              { externalContentItemId: 'ticketland-city-today', timeLabel: '20:30' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    await service.createDraft('user-1', {
      prompt: 'ужин и стендап',
      city: 'Екатеринбург',
    });

    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.config.eventDateWindow).toEqual({
      label: 'today',
      from: '2026-05-16T19:30:00.000Z',
      to: '2026-05-17T18:59:59.999Z',
    });
    expect(
      routePrompt.candidates
        .filter((candidate: any) => candidate.role === 'show')
        .map((candidate: any) => candidate.id),
    ).toEqual(expect.arrayContaining(['ticketland-city-today']));
  });

  it('uses intent local date for timed event candidates', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-16T12:00:00.000Z'));

    const { service, externalFindMany, openRouter } = createService({
      filterExternalItemsByQuery: true,
      intentResponse: {
        parsedJson: {
          routeStepCount: 2,
          stepCountReason: 'Пользователь просит ужин и стендап.',
          participantsCount: 0,
          dateMode: 'date',
          localDate: '2026-05-17',
          dateReason: 'ИИ понял дату из текста.',
          steps: [
            { role: 'place_food', preferredTerms: ['ужин'], avoidTerms: [], instruction: '' },
            { role: 'show', preferredTerms: ['стендап'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-dinner',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Ресторан для ужина',
            category: 'restaurant',
            tags: ['occasion:food', 'place:restaurant'],
            priceFrom: 2500,
            placeKind: 'restaurant',
            venueName: 'Ресторан для ужина',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-standup-target',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Стендап завтра',
            category: 'standup',
            tags: ['стендап'],
            startsAt: new Date('2026-05-17T17:30:00.000Z'),
            priceFrom: 1800,
            actionUrl: 'https://ticket.example.test/standup-target',
            sourceProvider: 'Ticketland / MTS Live',
          },
          {
            id: 'ticketland-standup-other',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Стендап в другой день',
            category: 'standup',
            tags: ['стендап'],
            startsAt: new Date('2026-05-18T17:30:00.000Z'),
            priceFrom: 1800,
            actionUrl: 'https://ticket.example.test/standup-other',
            sourceProvider: 'Ticketland / MTS Live',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Ужин и стендап завтра',
            vibe: 'Дата от ИИ',
            blurb: 'Маршрут на выбранную дату.',
            steps: [
              { externalContentItemId: 'tomesto-dinner', timeLabel: '19:00' },
              { externalContentItemId: 'ticketland-standup-target', timeLabel: '20:30' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    await service.createDraft('user-1', {
      prompt: 'ужин и стендап',
      city: 'Москва',
    });

    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(
      routePrompt.candidates
        .filter((candidate: any) => candidate.role === 'show')
        .map((candidate: any) => candidate.id),
    ).toEqual(['ticketland-standup-target']);

    const ticketlandQueries = externalFindMany.mock.calls
      .map(([query]: [any]) => query)
      .filter((query: any) => query?.where?.source?.code === 'advcake_ticketland');
    expect(ticketlandQueries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          where: expect.objectContaining({
            startsAt: expect.objectContaining({
              gte: new Date('2026-05-16T21:00:00.000Z'),
              lte: new Date('2026-05-17T20:59:59.999Z'),
            }),
          }),
        }),
      ]),
    );
  });

  it('filters timed event candidates to today when prompt asks for today', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-16T12:00:00.000Z'));

    const { service, externalFindMany, openRouter } = createService({
      filterExternalItemsByQuery: true,
      intentResponse: {
        parsedJson: {
          routeStepCount: 3,
          stepCountReason: 'Пользователь перечислил прогулку, ужин и стендап.',
          participantsCount: 0,
          steps: [
            { role: 'walk', preferredTerms: ['прогулка'], avoidTerms: [], instruction: '' },
            { role: 'place_food', preferredTerms: ['ужин'], avoidTerms: [], instruction: '' },
            { role: 'show', preferredTerms: ['стендап'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        kudago: [
          {
            id: 'kudago-walk',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'place',
            title: 'Прогулка по центру',
            category: 'walk',
            tags: ['прогулка', 'центр'],
            priceMode: 'unknown',
            priceFrom: null,
            sourceProvider: 'KudaGo',
          },
        ],
        tomesto: [
          {
            id: 'tomesto-dinner',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Ресторан для ужина',
            category: 'restaurant',
            tags: ['occasion:food', 'place:restaurant'],
            priceFrom: 2500,
            placeKind: 'restaurant',
            venueName: 'Ресторан для ужина',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-standup-today',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Стендап сегодня',
            category: 'standup',
            tags: ['стендап'],
            startsAt: new Date('2026-05-16T17:30:00.000Z'),
            priceFrom: 1800,
            actionUrl: 'https://ticket.example.test/standup-today',
            sourceProvider: 'Ticketland / MTS Live',
          },
          {
            id: 'ticketland-standup-tomorrow',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Стендап завтра',
            category: 'standup',
            tags: ['стендап'],
            startsAt: new Date('2026-05-17T17:30:00.000Z'),
            priceFrom: 1800,
            actionUrl: 'https://ticket.example.test/standup-tomorrow',
            sourceProvider: 'Ticketland / MTS Live',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Прогулка, ужин и стендап',
            vibe: 'Вечер сегодня',
            blurb: 'Маршрут на сегодня.',
            steps: [
              { externalContentItemId: 'kudago-walk', timeLabel: '18:00' },
              { externalContentItemId: 'tomesto-dinner', timeLabel: '19:00' },
              { externalContentItemId: 'ticketland-standup-today', timeLabel: '20:30' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt: 'прогулка, ужин, стендап сегодня',
      city: 'Москва',
    });

    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    const showCandidateIds = routePrompt.candidates
      .filter((candidate: any) => candidate.role === 'show')
      .map((candidate: any) => candidate.id);
    expect(showCandidateIds).toEqual(['ticketland-standup-today']);
    expect(result.route.steps.map((step: any) => step.title)).toEqual([
      'Прогулка по центру',
      'Ресторан для ужина',
      'Стендап сегодня',
    ]);

    const ticketlandQueries = externalFindMany.mock.calls
      .map(([query]: [any]) => query)
      .filter((query: any) => query?.where?.source?.code === 'advcake_ticketland');
    expect(ticketlandQueries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          where: expect.objectContaining({
            startsAt: expect.objectContaining({
              gte: new Date('2026-05-16T12:00:00.000Z'),
              lte: new Date('2026-05-16T20:59:59.999Z'),
            }),
          }),
        }),
      ]),
    );
  });

  it('rejects a dated route when a requested event role has no candidates for that date', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-16T12:00:00.000Z'));

    const { service, draftCreate } = createService({
      filterExternalItemsByQuery: true,
      intentResponse: {
        parsedJson: {
          routeStepCount: 3,
          stepCountReason: 'Пользователь перечислил прогулку, ужин и стендап.',
          participantsCount: 0,
          steps: [
            { role: 'walk', preferredTerms: ['прогулка'], avoidTerms: [], instruction: '' },
            { role: 'place_food', preferredTerms: ['ужин'], avoidTerms: [], instruction: '' },
            { role: 'show', preferredTerms: ['стендап'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        kudago: [
          {
            id: 'kudago-walk',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'place',
            title: 'Прогулка по центру',
            category: 'walk',
            tags: ['прогулка', 'центр'],
            priceMode: 'unknown',
            priceFrom: null,
            sourceProvider: 'KudaGo',
          },
        ],
        tomesto: [
          {
            id: 'tomesto-dinner',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Ресторан для ужина',
            category: 'restaurant',
            tags: ['occasion:food', 'place:restaurant'],
            priceFrom: 2500,
            placeKind: 'restaurant',
            venueName: 'Ресторан для ужина',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-standup-tomorrow',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Стендап завтра',
            category: 'standup',
            tags: ['стендап'],
            startsAt: new Date('2026-05-17T17:30:00.000Z'),
            priceFrom: 1800,
            actionUrl: 'https://ticket.example.test/standup-tomorrow',
            sourceProvider: 'Ticketland / MTS Live',
          },
        ],
      },
    });

    await expect(
      service.createDraft('user-1', {
        prompt: 'прогулка, ужин, стендап сегодня',
        city: 'Москва',
      }),
    ).rejects.toMatchObject({
      code: 'evening_ai_candidates_not_found',
    });
    expect(draftCreate).not.toHaveBeenCalled();
  });

  it.each([
    {
      prompt: 'ужин и стендап завтра',
      localDate: '2026-05-17',
      expectedFrom: '2026-05-16T21:00:00.000Z',
      expectedTo: '2026-05-17T20:59:59.999Z',
      targetStartsAt: '2026-05-17T17:30:00.000Z',
      otherStartsAt: '2026-05-18T17:30:00.000Z',
    },
    {
      prompt: 'ужин и стендап в четверг',
      localDate: '2026-05-21',
      expectedFrom: '2026-05-20T21:00:00.000Z',
      expectedTo: '2026-05-21T20:59:59.999Z',
      targetStartsAt: '2026-05-21T17:30:00.000Z',
      otherStartsAt: '2026-05-22T17:30:00.000Z',
    },
    {
      prompt: 'ужин и стендап 24.05',
      localDate: '2026-05-24',
      expectedFrom: '2026-05-23T21:00:00.000Z',
      expectedTo: '2026-05-24T20:59:59.999Z',
      targetStartsAt: '2026-05-24T17:30:00.000Z',
      otherStartsAt: '2026-05-25T17:30:00.000Z',
    },
  ])('applies prompt date window for "$prompt"', async ({
    prompt,
    localDate,
    expectedFrom,
    expectedTo,
    targetStartsAt,
    otherStartsAt,
  }) => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-16T12:00:00.000Z'));

    const { service, externalFindMany, openRouter } = createService({
      filterExternalItemsByQuery: true,
      intentResponse: {
        parsedJson: {
          routeStepCount: 2,
          stepCountReason: 'Пользователь перечислил ужин и стендап.',
          participantsCount: 0,
          dateMode: 'date',
          localDate,
          dateReason: 'Intent resolved prompt date.',
          steps: [
            { role: 'place_food', preferredTerms: ['ужин'], avoidTerms: [], instruction: '' },
            { role: 'show', preferredTerms: ['стендап'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-dinner',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Ресторан для ужина',
            category: 'restaurant',
            tags: ['occasion:food', 'place:restaurant'],
            priceFrom: 2500,
            placeKind: 'restaurant',
            venueName: 'Ресторан для ужина',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-target-standup',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Стендап в нужный день',
            category: 'standup',
            tags: ['стендап'],
            startsAt: new Date(targetStartsAt),
            priceFrom: 1800,
            actionUrl: 'https://ticket.example.test/target-standup',
            sourceProvider: 'Ticketland / MTS Live',
          },
          {
            id: 'ticketland-other-standup',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Стендап в другой день',
            category: 'standup',
            tags: ['стендап'],
            startsAt: new Date(otherStartsAt),
            priceFrom: 1800,
            actionUrl: 'https://ticket.example.test/other-standup',
            sourceProvider: 'Ticketland / MTS Live',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Ужин и стендап',
            vibe: 'Вечер по дате',
            blurb: 'Маршрут на указанную дату.',
            steps: [
              { externalContentItemId: 'tomesto-dinner', timeLabel: '19:00' },
              { externalContentItemId: 'ticketland-target-standup', timeLabel: '20:30' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    await service.createDraft('user-1', {
      prompt,
      city: 'Москва',
    });

    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    const showCandidateIds = routePrompt.candidates
      .filter((candidate: any) => candidate.role === 'show')
      .map((candidate: any) => candidate.id);
    expect(showCandidateIds).toEqual(['ticketland-target-standup']);

    const ticketlandQueries = externalFindMany.mock.calls
      .map(([query]: [any]) => query)
      .filter((query: any) => query?.where?.source?.code === 'advcake_ticketland');
    expect(ticketlandQueries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          where: expect.objectContaining({
            startsAt: expect.objectContaining({
              gte: new Date(expectedFrom),
              lte: new Date(expectedTo),
            }),
          }),
        }),
      ]),
    );
  });

  it('lets LLM intent choose the prompt step count and budget', async () => {
    const { service, draftCreate, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          routeStepCount: 3,
          stepCountReason: 'ИИ понял, что пользователь просит три точки.',
          budget: 'mid',
          steps: [
            { role: 'walk', preferredTerms: ['парк'], avoidTerms: [], instruction: '' },
            { role: 'place_food', preferredTerms: ['итальян'], avoidTerms: [], instruction: '' },
            { role: 'show', preferredTerms: ['спектакль'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        kudago: [
          {
            id: 'kudago-park',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'place',
            title: 'Красивый парк',
            category: 'park',
            tags: ['парк', 'прогулка'],
            lat: 55.73,
            lng: 37.6,
            priceMode: 'unknown',
            priceFrom: null,
            sourceProvider: 'KudaGo',
          },
          {
            id: 'kudago-free',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'event',
            title: 'Бесплатная выставка',
            category: 'festival',
            tags: ['фестиваль'],
            lat: 55.74,
            lng: 37.61,
            startsAt: new Date('2099-06-01T17:00:00.000Z'),
            priceMode: 'free',
            priceFrom: 0,
            sourceProvider: 'KudaGo',
          },
        ],
        tomesto: [
          {
            id: 'tomesto-italian',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Итальянский ресторан',
            category: 'restaurant',
            tags: ['итальян', 'паста'],
            priceFrom: 2200,
            placeKind: 'restaurant',
            venueName: 'Итальянский ресторан',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-bar',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Тихий бар',
            category: 'bar',
            tags: ['bar', 'тихий'],
            priceFrom: 1800,
            placeKind: 'bar',
            venueName: 'Тихий бар',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-theatre',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Спектакль',
            category: 'theatre',
            tags: ['театр', 'спектакль'],
            startsAt: new Date('2099-06-01T19:30:00.000Z'),
            priceFrom: 2200,
            actionUrl: 'https://ticket.example.test/theatre',
            sourceProvider: 'Ticketland / MTS Live',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Свидание на три точки',
            vibe: 'Спокойное свидание',
            blurb: 'Парк, итальянский ресторан и спектакль.',
            steps: [
              { externalContentItemId: 'kudago-park', timeLabel: '18:00' },
              { externalContentItemId: 'tomesto-italian', timeLabel: '19:00' },
              { externalContentItemId: 'ticketland-theatre', timeLabel: '20:00' },
              { externalContentItemId: 'tomesto-bar', timeLabel: '22:00' },
              { externalContentItemId: 'kudago-free', timeLabel: '23:00' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt:
        'свидание на двоих завтра вечером. 3 точки, красивый парк, итальянский ресторан, спектакль. бюджет средний, не шумно',
      city: 'Москва',
    });

    const intentPrompt = JSON.parse(openRouter.generateJson.mock.calls[0][0].userPrompt);
    expect(intentPrompt.config).toEqual(
      expect.objectContaining({
        stepCountMode: 'infer',
        maxStepCount: 5,
        budget: null,
      }),
    );
    expect(intentPrompt.config).not.toHaveProperty('promptStepCountHint');
    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.config.stepCount).toBe(3);
    expect(routePrompt.config.budget).toBe('mid');
    expect(result.route.steps.map((step: any) => step.title)).toEqual([
      'Красивый парк',
      'Итальянский ресторан',
      'Спектакль',
    ]);
    expect(draftCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          budget: 'mid',
          stepCount: 3,
        }),
      }),
    );
  });

  it('finds cuisine candidates through taxonomy tags and keeps exact prompt step count', async () => {
    const { service } = createService({
      filterExternalItemsByQuery: true,
      intentResponse: {
        parsedJson: {
          steps: [
            { role: 'walk', preferredTerms: ['парк'], avoidTerms: [], instruction: '' },
            { role: 'place_food', preferredTerms: ['итальян'], avoidTerms: [], instruction: '' },
            { role: 'show', preferredTerms: ['спектакль'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        kudago: [
          {
            id: 'kudago-park',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'place',
            title: 'Красивый парк',
            category: 'park',
            tags: ['парк', 'прогулка'],
            lat: 55.73,
            lng: 37.6,
            priceMode: 'unknown',
            priceFrom: null,
            sourceProvider: 'KudaGo',
          },
        ],
        tomesto: [
          {
            id: 'tomesto-casa',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Casa Bella',
            category: 'food',
            tags: ['occasion:food', 'cuisine:italyanskaya', 'feature:quiet'],
            lat: 55.731,
            lng: 37.601,
            priceFrom: 2200,
            placeKind: 'food',
            venueName: 'Casa Bella',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-theatre',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Спектакль',
            category: 'theatre',
            tags: ['театр', 'спектакль'],
            startsAt: new Date('2099-06-01T19:30:00.000Z'),
            priceFrom: 2200,
            actionUrl: 'https://ticket.example.test/theatre',
            sourceProvider: 'Ticketland / MTS Live',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Свидание на три точки',
            vibe: 'Спокойное свидание',
            blurb: 'Парк, итальянский ресторан и спектакль.',
            steps: [
              { externalContentItemId: 'kudago-park', timeLabel: '18:00' },
              { externalContentItemId: 'tomesto-casa', timeLabel: '19:00' },
              { externalContentItemId: 'ticketland-theatre', timeLabel: '20:00' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt:
        'свидание на двоих вечером, 3 точки. красивый парк, итальянский ресторан, спектакль. бюджет средний, не шумно.',
      city: 'Москва',
    });

    expect(result.route.steps.map((step: any) => step.title)).toEqual([
      'Красивый парк',
      'Casa Bella',
      'Спектакль',
    ]);
    expect(result.route.steps[1].tagLabel).toBe('Итальянская');
  });

  it('scores expanded bar, cuisine, atmosphere and diet terms after loading all Tomesto candidates', async () => {
    const { service, externalFindMany } = createService({
      filterExternalItemsByQuery: true,
      intentResponse: {
        parsedJson: {
          steps: [
            { role: 'place_bar', preferredTerms: ['крафтовое пиво'], avoidTerms: [], instruction: '' },
            { role: 'place_bar', preferredTerms: ['камерные настойки'], avoidTerms: [], instruction: '' },
            { role: 'place_food', preferredTerms: ['паназиатская кухня'], avoidTerms: [], instruction: '' },
            { role: 'place_food', preferredTerms: ['мексиканская кухня'], avoidTerms: [], instruction: '' },
            { role: 'place_food', preferredTerms: ['веганское кафе'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-craft',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Taproom',
            category: 'drinks',
            tags: ['place:bar', 'feature:craft_beer'],
            lat: 55.731,
            lng: 37.601,
            priceFrom: 1600,
            placeKind: 'drinks',
            venueName: 'Taproom',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-infusions',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Cabinet',
            category: 'drinks',
            tags: ['place:bar', 'feature:quiet', 'set:nastoyki'],
            lat: 55.732,
            lng: 37.602,
            priceFrom: 1800,
            placeKind: 'drinks',
            venueName: 'Cabinet',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-panasian',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Asia Room',
            category: 'food',
            tags: ['occasion:food', 'cuisine:panaziatskaya'],
            lat: 55.733,
            lng: 37.603,
            priceFrom: 2100,
            placeKind: 'food',
            venueName: 'Asia Room',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-mexican',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Taco House',
            category: 'food',
            tags: ['occasion:food', 'cuisine:meksikanskaya'],
            lat: 55.734,
            lng: 37.604,
            priceFrom: 1900,
            placeKind: 'food',
            venueName: 'Taco House',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-vegan',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Green Cafe',
            category: 'food',
            tags: ['occasion:food', 'place:cafe', 'feature:vegan'],
            lat: 55.735,
            lng: 37.605,
            priceFrom: 1500,
            placeKind: 'food',
            venueName: 'Green Cafe',
            sourceProvider: 'ТоМесто',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Еда и бары по запросу',
            vibe: 'Точно по фильтрам',
            blurb: 'Пиво, настойки и кухни из промта.',
            steps: [
              { externalContentItemId: 'tomesto-craft', timeLabel: '18:00' },
              { externalContentItemId: 'tomesto-infusions', timeLabel: '19:00' },
              { externalContentItemId: 'tomesto-panasian', timeLabel: '20:00' },
              { externalContentItemId: 'tomesto-mexican', timeLabel: '21:00' },
              { externalContentItemId: 'tomesto-vegan', timeLabel: '22:00' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt:
        '5 точек: крафтовое пиво, камерные настойки, паназиатская кухня, мексиканская кухня, веганское кафе',
      city: 'Москва',
    });

    expect(result.route.steps.map((step: any) => step.title)).toEqual(
      expect.arrayContaining([
        'Taproom',
        'Cabinet',
        'Asia Room',
        'Taco House',
        'Green Cafe',
      ]),
    );
    expect(result.route.steps).toHaveLength(5);
    const tomestoQuery = externalFindMany.mock.calls
      .map(([query]: [any]) => query)
      .find((query: any) => query?.where?.source?.code === 'tomesto');
    expect(tomestoQuery?.where?.OR).toBeUndefined();
    expect(tomestoQuery?.take).toBeUndefined();
  });

  it('matches arbitrary Tomesto cuisine tags from intent terms', async () => {
    const { service, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          steps: [
            { role: 'place_food', preferredTerms: ['турецкая кухня', 'ресторан'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-generic',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Generic Restaurant',
            category: 'food',
            tags: ['occasion:food', 'place:restaurant'],
            lat: 55.731,
            lng: 37.601,
            placeKind: 'food',
            venueName: 'Generic Restaurant',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-turkish',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Istanbul',
            category: 'food',
            tags: ['occasion:food', 'place:restaurant', 'cuisine:turetskaya'],
            lat: 55.732,
            lng: 37.602,
            placeKind: 'food',
            venueName: 'Istanbul',
            sourceProvider: 'ТоМесто',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Турецкий ужин',
            vibe: 'По кухне',
            blurb: 'Проверка кухни.',
            steps: [{ externalContentItemId: 'tomesto-generic', timeLabel: '19:00' }],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt: 'хочу турецкую кухню',
      city: 'Москва',
    });

    const routeCalls = openRouter.generateJson.mock.calls.filter(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    );
    expect(routeCalls[1][0].userPrompt).toContain('intent_mismatch');
    expect(routeCalls[1][0].userPrompt).toContain('tomesto-generic');
    expect(result.route.steps.map((step: any) => step.title)).toContain('Istanbul');
  });

  it('prioritizes exact cuisine intent over generic cafe matches', async () => {
    const genericCafes = Array.from({ length: 30 }, (_, index) => ({
      id: `tomesto-generic-cafe-${String(index).padStart(2, '0')}`,
      source: { code: 'tomesto', name: 'ТоМесто' },
      contentKind: 'place',
      title: index === 0
        ? 'Кафе ресторан кофе бранч ужин еда покушать перекус coffee десерт паста итальянская'
        : `Кафе еда ресторан кофе ${index}`,
      category: 'food',
      shortSummary: index === 0
        ? 'Обычное кафе ресторан кофе бранч ужин еда покушать перекус coffee десерт паста итальянская в центре'
        : 'Обычное кафе ресторан кофе в центре',
      tags: ['occasion:food', 'place:cafe', 'area:center'],
      lat: 55.731 + index * 0.0001,
      lng: 37.601,
      placeKind: 'food',
      venueName: `Generic Cafe ${index}`,
      sourceProvider: 'ТоМесто',
    }));
    const { service, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          steps: [
            {
              role: 'place_food',
              preferredTerms: ['хинкали', 'грузинская кухня', 'кафе'],
              avoidTerms: [],
              instruction: 'Поесть хинкали в центре',
              locationMode: 'explicit',
              locationKind: 'area',
              locationQuery: 'центр',
              locationCode: 'center',
            },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        tomesto: [
          ...genericCafes,
          {
            id: 'tomesto-khinkali',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: '100 хинкали',
            category: 'food',
            shortSummary: 'Грузинская кухня и хинкали',
            tags: ['occasion:food', 'place:restaurant', 'cuisine:gruzinskaya', 'area:center'],
            lat: 55.735,
            lng: 37.605,
            placeKind: 'food',
            venueName: '100 хинкали',
            sourceProvider: 'ТоМесто',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Кафе вместо хинкали',
            vibe: 'Не по запросу',
            blurb: 'Проверка валидатора.',
            steps: [{ externalContentItemId: 'tomesto-generic-cafe-00', timeLabel: '19:00' }],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
        {
          parsedJson: {
            title: 'Хинкали',
            vibe: 'По кухне',
            blurb: 'Проверка кухни.',
            steps: [{ externalContentItemId: 'tomesto-khinkali', timeLabel: '19:00' }],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt: 'хочу погулять в центре и потом поесть хинкали',
      city: 'Москва',
    });

    const routeCalls = openRouter.generateJson.mock.calls.filter(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    );
    const routePrompt = JSON.parse(routeCalls[0][0].userPrompt);
    const candidateIds = routePrompt.candidates.map((candidate: any) => candidate.id);
    expect(candidateIds).toContain('tomesto-khinkali');
    expect(candidateIds).toContain('tomesto-generic-cafe-00');
    expect(routeCalls[1][0].userPrompt).toContain('intent_mismatch');
    expect(result.route.steps.map((step: any) => step.title)).toEqual(['100 хинкали']);
  });

  it('uses intent taxonomy tags as the primary match signal', async () => {
    const { service, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          routeStepCount: 1,
          stepCountReason: 'Пользователь просит грузинскую еду.',
          participantsCount: 1,
          dateMode: 'none',
          localDate: '',
          dateReason: '',
          area: '',
          budget: '',
          steps: [
            {
              role: 'place_food',
              taxonomyTags: ['cuisine:gruzinskaya'],
              preferredTerms: [],
              avoidTerms: [],
              instruction: 'Грузинская еда',
              locationMode: 'none',
              locationKind: 'none',
              locationQuery: '',
              locationCode: '',
            },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-no-sugar',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'No Sugar',
            category: 'food',
            shortSummary: 'Ресторан на Грузинском Валу',
            tags: ['occasion:food', 'place:restaurant', 'area:center'],
            lat: 55.735,
            lng: 37.605,
            placeKind: 'food',
            venueName: 'No Sugar',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-shvili',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Швили',
            category: 'food',
            shortSummary: 'Грузинская кухня',
            tags: ['occasion:food', 'place:restaurant', 'cuisine:gruzinskaya', 'area:center'],
            lat: 55.736,
            lng: 37.606,
            placeKind: 'food',
            venueName: 'Швили',
            sourceProvider: 'ТоМесто',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Не тот ресторан',
            vibe: 'Проверка тегов',
            blurb: 'Модель выбрала место без cuisine tag.',
            steps: [{ externalContentItemId: 'tomesto-no-sugar', timeLabel: '19:00' }],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
        {
          parsedJson: {
            title: 'Грузинская еда',
            vibe: 'По тегу',
            blurb: 'Модель выбрала место с cuisine tag.',
            steps: [{ externalContentItemId: 'tomesto-shvili', timeLabel: '19:00' }],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt: 'хочу грузинскую еду',
      city: 'Москва',
    });

    const routeCalls = openRouter.generateJson.mock.calls.filter(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    );
    expect(routeCalls[1][0].userPrompt).toContain('intent_mismatch');
    expect(result.route.steps.map((step: any) => step.title)).toEqual(['Швили']);
  });

  it('filters non-standup ticket events when intent asks for standup', async () => {
    const { service, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          steps: [
            {
              role: 'show',
              preferredTerms: ['стендап'],
              avoidTerms: ['театр', 'опера', 'оперетта', 'концерт'],
              instruction: 'Стендап вечером',
            },
          ],
        },
      },
      externalItems: {
        advcake_ticketland: [
          {
            id: 'ticketland-operetta',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Оперетта за столиками',
            category: 'theatre',
            tags: ['театр', 'оперетта'],
            startsAt: new Date('2099-06-01T19:00:00.000Z'),
            priceFrom: 800,
            sourceProvider: 'Ticketland / MTS Live',
          },
          {
            id: 'ticketland-standup',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Стендап без пафоса',
            category: 'standup',
            tags: ['standup', 'стендап'],
            startsAt: new Date('2099-06-01T19:30:00.000Z'),
            priceFrom: 900,
            sourceProvider: 'Ticketland / MTS Live',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Стендап',
            vibe: 'Без театра',
            blurb: 'Проверка фильтра.',
            steps: [{ externalContentItemId: 'ticketland-standup', timeLabel: '20:00' }],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt: 'хочу стендап вечером',
      city: 'Москва',
    });

    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.candidates.map((candidate: any) => candidate.id)).toEqual([
      'ticketland-standup',
    ]);
    expect(result.route.steps.map((step: any) => step.title)).toEqual(['Стендап без пафоса']);
  });

  it('uses bar when the prompt says standup or bar and standup is only an alternative', async () => {
    const { service, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          steps: [
            {
              role: 'walk',
              preferredTerms: ['прогулка'],
              avoidTerms: [],
              instruction: 'Спокойная прогулка',
            },
            {
              role: 'place_food',
              preferredTerms: ['ресторан'],
              avoidTerms: [],
              instruction: 'Ресторан',
            },
            {
              role: 'show',
              preferredTerms: ['стендап'],
              avoidTerms: ['театр', 'опера', 'оперетта'],
              instruction: 'Стендап или бар',
            },
          ],
        },
      },
      externalItems: {
        kudago: [
          {
            id: 'kudago-walk',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'place',
            title: 'Тихая набережная',
            category: 'walk',
            tags: ['walk'],
            lat: 55.731,
            lng: 37.601,
            priceMode: 'unknown',
            priceFrom: null,
            sourceProvider: 'KudaGo',
          },
        ],
        tomesto: [
          {
            id: 'tomesto-dinner',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Ресторан без пафоса',
            category: 'food',
            tags: ['occasion:food', 'place:restaurant'],
            lat: 55.732,
            lng: 37.602,
            placeKind: 'food',
            venueName: 'Ресторан без пафоса',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-bar',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Бар без пафоса',
            category: 'bar',
            tags: ['place:bar'],
            lat: 55.733,
            lng: 37.603,
            placeKind: 'bar',
            venueName: 'Бар без пафоса',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Суббота без пафоса',
            vibe: 'Спокойный вечер',
            blurb: 'Прогулка, ресторан и бар.',
            steps: [
              { externalContentItemId: 'kudago-walk', timeLabel: '16:00' },
              { externalContentItemId: 'tomesto-dinner', timeLabel: '19:00' },
              { externalContentItemId: 'tomesto-bar', timeLabel: '21:00' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt:
        'Хочу провести субботу в Москве с девушкой: днем что-то спокойное и красивое, вечером ресторан, потом стендап или бар. Бюджет средний, без пафоса.',
      city: 'Москва',
    });

    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.config.roles).toEqual(['walk', 'place_food', 'place_bar']);
    expect(routePrompt.candidates.map((candidate: any) => candidate.id)).toContain('tomesto-bar');
    expect(result.route.steps.map((step: any) => step.title)).toEqual([
      'Тихая набережная',
      'Ресторан без пафоса',
      'Бар без пафоса',
    ]);
  });

  it('keeps per-step locations and inherits same-as-previous location', async () => {
    const { service, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          routeStepCount: 3,
          stepCountReason: 'Пользователь перечислил три активности с разными локациями.',
          steps: [
            {
              role: 'walk',
              preferredTerms: ['прогулка'],
              avoidTerms: [],
              instruction: 'Погулять в центре',
              locationMode: 'explicit',
              locationKind: 'area',
              locationQuery: 'центр',
              locationCode: 'center',
            },
            {
              role: 'place_food',
              preferredTerms: ['паста', 'итальянская кухня'],
              avoidTerms: [],
              instruction: 'Паста на Братиславской',
              locationMode: 'explicit',
              locationKind: 'metro',
              locationQuery: 'на Братиславской',
              locationCode: '',
            },
            {
              role: 'show',
              preferredTerms: ['спектакль'],
              avoidTerms: [],
              instruction: 'Спектакль там же',
              locationMode: 'same_as_previous',
              locationKind: 'metro',
              locationQuery: 'там же',
              locationCode: '',
            },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        kudago: [
          {
            id: 'walk-center',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'place',
            title: 'Центральная прогулка',
            category: 'walk',
            tags: ['walk', 'area:center'],
            lat: 55.755,
            lng: 37.617,
            priceFrom: 0,
            priceMode: 'free',
            sourceProvider: 'KudaGo',
          },
        ],
        tomesto: [
          {
            id: 'pasta-center',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Паста в центре',
            category: 'food',
            tags: ['occasion:food', 'place:restaurant', 'cuisine:italyanskaya', 'metro:tverskaya_300_m_4_min'],
            lat: 55.765,
            lng: 37.605,
            placeKind: 'food',
            venueName: 'Паста в центре',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'pasta-bratislavskaya',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Паста на Братиславской',
            category: 'food',
            tags: ['occasion:food', 'place:restaurant', 'cuisine:italyanskaya', 'metro:bratislavskaya_420_m_6_min'],
            lat: 55.66,
            lng: 37.75,
            placeKind: 'food',
            venueName: 'Паста на Братиславской',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'show-center',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Спектакль в центре',
            category: 'theatre',
            tags: ['theatre'],
            startsAt: new Date('2099-06-01T17:30:00.000Z'),
            lat: 55.765,
            lng: 37.605,
            priceFrom: 1200,
            actionUrl: 'https://ticket.example.test/center',
            sourceProvider: 'Ticketland / MTS Live',
          },
          {
            id: 'show-bratislavskaya',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Спектакль на Братиславской',
            category: 'theatre',
            tags: ['theatre'],
            startsAt: new Date('2099-06-01T18:00:00.000Z'),
            lat: 55.66,
            lng: 37.75,
            priceFrom: 1200,
            actionUrl: 'https://ticket.example.test/bratislavskaya',
            sourceProvider: 'Ticketland / MTS Live',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Центр и Братиславская',
            vibe: 'По локациям',
            blurb: 'Маршрут учитывает разные районы.',
            steps: [
              { externalContentItemId: 'walk-center', timeLabel: '18:00' },
              { externalContentItemId: 'pasta-bratislavskaya', timeLabel: '19:00' },
              { externalContentItemId: 'show-bratislavskaya', timeLabel: '20:00' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    await service.createDraft('user-1', {
      prompt: 'хочу погулять в центре, поесть пасту на Братиславской и сходить на спектакль там же',
      city: 'Москва',
    });

    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.config.roleHints[0].location).toMatchObject({
      mode: 'explicit',
      kind: 'area',
      code: 'center',
    });
    expect(routePrompt.config.roleHints[1].location).toMatchObject({
      mode: 'explicit',
      kind: 'metro',
      code: 'metro:bratislavskaya',
    });
    expect(routePrompt.config.roleHints[2].location).toMatchObject({
      mode: 'same_as_previous',
      kind: 'metro',
      code: 'metro:bratislavskaya',
    });
    const foodCandidateIds = routePrompt.candidates
      .filter((candidate: any) => candidate.role === 'place_food')
      .map((candidate: any) => candidate.id);
    const showCandidateIds = routePrompt.candidates
      .filter((candidate: any) => candidate.role === 'show')
      .map((candidate: any) => candidate.id);
    expect(foodCandidateIds.indexOf('pasta-bratislavskaya')).toBeLessThan(
      foodCandidateIds.indexOf('pasta-center'),
    );
    expect(showCandidateIds.indexOf('show-bratislavskaya')).toBeLessThan(
      showCandidateIds.indexOf('show-center'),
    );
  });

  it('does not treat barbecue food wording as a bar tag', async () => {
    const { service, externalFindMany } = createService({
      filterExternalItemsByQuery: true,
      intentResponse: {
        parsedJson: {
          steps: [
            { role: 'place_food', preferredTerms: ['барбекю'], avoidTerms: [], instruction: '' },
            { role: 'show', preferredTerms: ['спектакль'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-bbq',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Smoke House',
            category: 'food',
            tags: ['occasion:food', 'place:restaurant', 'place:steakhouse'],
            lat: 55.731,
            lng: 37.601,
            priceFrom: 2200,
            placeKind: 'food',
            venueName: 'Smoke House',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-theatre',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Спектакль',
            category: 'theatre',
            tags: ['театр', 'спектакль'],
            startsAt: new Date('2099-06-01T19:30:00.000Z'),
            priceFrom: 2200,
            actionUrl: 'https://ticket.example.test/theatre',
            sourceProvider: 'Ticketland / MTS Live',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Барбекю и театр',
            vibe: 'Плотный ужин и спектакль',
            blurb: 'Сначала барбекю, потом театр.',
            steps: [
              { externalContentItemId: 'tomesto-bbq', timeLabel: '19:00' },
              { externalContentItemId: 'ticketland-theatre', timeLabel: '20:30' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    await service.createDraft('user-1', {
      prompt: '2 точки: барбекю и спектакль',
      city: 'Москва',
    });

    const tomestoQuery = externalFindMany.mock.calls
      .map(([query]: [any]) => query)
      .find((query: any) => query?.where?.source?.code === 'tomesto');
    expect(tomestoQuery?.where?.OR).toBeUndefined();
    expect(tomestoQuery?.take).toBeUndefined();
  });

  it('rejects exact prompt step count when a requested role has no candidates', async () => {
    const { service, draftCreate } = createService({
      filterExternalItemsByQuery: true,
      intentResponse: {
        parsedJson: {
          steps: [
            { role: 'walk', preferredTerms: ['парк'], avoidTerms: [], instruction: '' },
            { role: 'place_food', preferredTerms: ['итальян'], avoidTerms: [], instruction: '' },
            { role: 'show', preferredTerms: ['спектакль'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        kudago: [
          {
            id: 'kudago-park',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'place',
            title: 'Красивый парк',
            category: 'park',
            tags: ['парк', 'прогулка'],
            lat: 55.73,
            lng: 37.6,
            priceMode: 'unknown',
            priceFrom: null,
            sourceProvider: 'KudaGo',
          },
        ],
        tomesto: [],
        advcake_ticketland: [
          {
            id: 'ticketland-theatre',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Спектакль',
            category: 'theatre',
            tags: ['театр', 'спектакль'],
            startsAt: new Date('2099-06-01T19:30:00.000Z'),
            priceFrom: 2200,
            actionUrl: 'https://ticket.example.test/theatre',
            sourceProvider: 'Ticketland / MTS Live',
          },
        ],
      },
    });

    await expect(
      service.createDraft('user-1', {
        prompt:
          'свидание на двоих завтра вечером, 3 точки. красивый парк, итальянский ресторан, спектакль.',
        city: 'Москва',
      }),
    ).rejects.toMatchObject({
      code: 'evening_ai_candidates_not_found',
    });
    expect(draftCreate).not.toHaveBeenCalled();
  });

  it('does not rank AI draft candidates by user coordinates', async () => {
    const { service, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          steps: [
            { role: 'place_food', preferredTerms: [], avoidTerms: [], instruction: '' },
            { role: 'place_food', preferredTerms: [], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-far',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Дальний ресторан',
            category: 'restaurant',
            tags: ['restaurant'],
            lat: 55.1,
            lng: 37.1,
            priceFrom: 2000,
            placeKind: 'restaurant',
            venueName: 'Дальний ресторан',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-near',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Ближний ресторан',
            category: 'restaurant',
            tags: ['restaurant'],
            lat: 55.7298,
            lng: 37.6011,
            priceFrom: 2000,
            placeKind: 'restaurant',
            venueName: 'Ближний ресторан',
            sourceProvider: 'ТоМесто',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Два ресторана',
            vibe: 'Без привязки к гео',
            blurb: 'Порядок не зависит от текущей точки пользователя.',
            steps: [
              { externalContentItemId: 'tomesto-far', timeLabel: '19:00' },
              { externalContentItemId: 'tomesto-near', timeLabel: '20:00' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    await service.createDraft('user-1', {
      prompt: '2 точки: ресторан и ресторан',
      city: 'Москва',
      latitude: 55.7298,
      longitude: 37.6011,
    });

    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    const foodCandidateIds = routePrompt.candidates
      .filter((candidate: any) => candidate.role === 'place_food')
      .map((candidate: any) => candidate.id);
    expect(foodCandidateIds).toEqual(
      expect.arrayContaining(['tomesto-far', 'tomesto-near']),
    );
    expect(routePrompt.config).not.toHaveProperty('latitude');
    expect(routePrompt.config).not.toHaveProperty('longitude');
  });

  it('uses intent area for scoring and keeps public route area readable', async () => {
    const { service, draftCreate, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          area: 'center',
          steps: [
            { role: 'place_food', preferredTerms: ['ресторан'], avoidTerms: [], instruction: '' },
            { role: 'show', preferredTerms: ['спектакль'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-outside',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Ресторан у окраины',
            category: 'restaurant',
            tags: ['restaurant'],
            area: 'Север',
            lat: 55.9,
            lng: 37.7,
            priceFrom: 2000,
            placeKind: 'restaurant',
            venueName: 'Ресторан у окраины',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-center',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Ресторан в центре',
            category: 'restaurant',
            tags: ['restaurant', 'area:center', 'metro:teatralnaya', 'set:restaurants-center'],
            area: 'Центр',
            lat: 55.76,
            lng: 37.61,
            priceFrom: 2000,
            placeKind: 'restaurant',
            venueName: 'Ресторан в центре',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-theatre',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Спектакль в центре',
            category: 'theatre',
            tags: ['театр', 'спектакль'],
            startsAt: new Date('2099-06-01T19:30:00.000Z'),
            priceFrom: 2200,
            sourceProvider: 'Ticketland / MTS Live',
            actionUrl: 'https://ticket.example.test/theatre',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Ресторан и спектакль',
            vibe: 'В центре',
            blurb: 'Сначала ресторан, потом спектакль.',
            steps: [
              { externalContentItemId: 'tomesto-center', timeLabel: '19:00' },
              { externalContentItemId: 'ticketland-theatre', timeLabel: '20:30' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt: '2 точки в центре: ресторан и спектакль',
      city: 'Москва',
    });

    const intentPrompt = JSON.parse(openRouter.generateJson.mock.calls[0][0].userPrompt);
    expect(intentPrompt.config.area).toBe(null);
    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    expect(routePrompt.config.area).toBe('center');
    const foodCandidateIds = routePrompt.candidates
      .filter((candidate: any) => candidate.role === 'place_food')
      .map((candidate: any) => candidate.id);
    expect(foodCandidateIds.indexOf('tomesto-center')).toBeLessThan(
      foodCandidateIds.indexOf('tomesto-outside'),
    );
    expect(result.route.area).toBe('Центр');
    expect(draftCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          area: 'center',
        }),
      }),
    );
  });

  it('uses precise prompt area as fallback point for shows without coordinates', async () => {
    const { service } = createService({
      intentResponse: {
        parsedJson: {
          area: 'patriki',
          steps: [
            { role: 'place_food', preferredTerms: ['ресторан'], avoidTerms: [], instruction: '' },
            { role: 'show', preferredTerms: ['спектакль'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-patriki',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Ресторан на Патриках',
            category: 'restaurant',
            tags: ['restaurant', 'area:center', 'metro:barrikadnaya', 'set:patriki'],
            area: 'Патрики',
            lat: 55.7638,
            lng: 37.5932,
            priceFrom: 2500,
            placeKind: 'restaurant',
            venueName: 'Ресторан на Патриках',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-theatre',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Спектакль без координат',
            category: 'theatre',
            tags: ['театр', 'спектакль'],
            startsAt: new Date('2099-06-01T19:30:00.000Z'),
            priceFrom: 2200,
            lat: null,
            lng: null,
            sourceProvider: 'Ticketland / MTS Live',
            actionUrl: 'https://ticket.example.test/theatre',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Патрики и спектакль',
            vibe: 'В районе',
            blurb: 'Сначала ресторан, потом спектакль.',
            steps: [
              { externalContentItemId: 'tomesto-patriki', timeLabel: '19:00' },
              { externalContentItemId: 'ticketland-theatre', timeLabel: '20:30' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt: '2 точки на патриках: ресторан и спектакль',
      city: 'Москва',
    });

    expect(result.route.area).toBe('Патрики');
    expect(result.route.steps[1]).toEqual(
      expect.objectContaining({
        title: 'Спектакль без координат',
        lat: 55.7638,
        lng: 37.5932,
        distance: 'адрес в билете',
      }),
    );
  });

  it('understands city side area from prompt and boosts it', async () => {
    const { service, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          area: 'north',
          steps: [
            { role: 'place_food', preferredTerms: ['ресторан'], avoidTerms: [], instruction: '' },
            { role: 'show', preferredTerms: ['спектакль'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-center',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Центральный ресторан',
            category: 'restaurant',
            tags: ['restaurant', 'area:center'],
            area: 'Центр',
            priceFrom: 2000,
            placeKind: 'restaurant',
            venueName: 'Центральный ресторан',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-north',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Ресторан на севере',
            category: 'restaurant',
            tags: ['restaurant', 'area:north'],
            area: 'Север',
            priceFrom: 2000,
            placeKind: 'restaurant',
            venueName: 'Ресторан на севере',
            sourceProvider: 'ТоМесто',
          },
        ],
        advcake_ticketland: [
          {
            id: 'ticketland-theatre',
            source: { code: 'advcake_ticketland', name: 'Ticketland' },
            contentKind: 'event',
            title: 'Спектакль',
            category: 'theatre',
            tags: ['театр', 'спектакль'],
            startsAt: new Date('2099-06-01T19:30:00.000Z'),
            priceFrom: 2200,
            sourceProvider: 'Ticketland / MTS Live',
            actionUrl: 'https://ticket.example.test/theatre',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Север и спектакль',
            vibe: 'В районе',
            blurb: 'Сначала ресторан, потом спектакль.',
            steps: [
              { externalContentItemId: 'tomesto-north', timeLabel: '19:00' },
              { externalContentItemId: 'ticketland-theatre', timeLabel: '20:30' },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 95,
        },
      ],
    });

    await service.createDraft('user-1', {
      prompt: '2 точки на севере: ресторан и спектакль',
      city: 'Москва',
    });

    const intentPrompt = JSON.parse(openRouter.generateJson.mock.calls[0][0].userPrompt);
    expect(intentPrompt.config.area).toBe(null);
    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    const routePrompt = JSON.parse(routeCall.userPrompt);
    const foodCandidateIds = routePrompt.candidates
      .filter((candidate: any) => candidate.role === 'place_food')
      .map((candidate: any) => candidate.id);
    expect(foodCandidateIds.indexOf('tomesto-north')).toBeLessThan(
      foodCandidateIds.indexOf('tomesto-center'),
    );
  });

  it('allows KudaGo park places as walk candidates', async () => {
    const { service, draftCreate } = createService({
      externalItems: {
        kudago: [
          {
            id: 'kudago-park-place',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'place',
            title: 'Парк Горького',
            category: 'park',
            tags: ['парк', 'прогулка'],
            startsAt: null,
            priceFrom: null,
            priceMode: 'unknown',
            sourceProvider: 'KudaGo',
          },
          {
            id: 'kudago-rink',
            source: { code: 'kudago', name: 'KudaGo' },
            contentKind: 'event',
            title: 'Каток «Ледо» у парка Кусково',
            category: 'sport',
            tags: ['каток', 'парк', 'активность'],
            startsAt: new Date('2099-06-01T18:00:00.000Z'),
            priceFrom: 0,
            priceMode: 'free',
            sourceProvider: 'KudaGo',
          },
        ],
        tomesto: [
          {
            id: 'tomesto-coffee',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Кофе рядом',
            category: 'cafe',
            tags: ['кофе'],
            placeKind: 'cafe',
            venueName: 'Кофе рядом',
            sourceProvider: 'ТоМесто',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Парк и кофе',
            vibe: 'Спокойная прогулка',
            blurb: 'Сначала парк, потом кофе.',
            steps: [
              {
                externalContentItemId: 'kudago-park-place',
                timeLabel: '18:00',
                endTimeLabel: '19:00',
                description: 'Парк для прогулки',
              },
              {
                externalContentItemId: 'tomesto-coffee',
                timeLabel: '19:00',
                endTimeLabel: '20:00',
                description: 'Кофе после прогулки',
              },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 100,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt: 'сначала погулять в парке, потом кофе',
      city: 'Москва',
      stepCount: 2,
    });

    expect(result.route.steps[0]).toEqual(
      expect.objectContaining({
        title: 'Парк Горького',
        ticketSourceCode: 'kudago',
      }),
    );
    expect(draftCreate.mock.calls[0]?.[0]?.data?.candidatePackJson).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'kudago-rink',
        }),
      ]),
    );
    expect(draftCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          candidatePackJson: expect.arrayContaining([
            expect.objectContaining({
              id: 'kudago-park-place',
              role: 'walk',
              source: 'kudago',
              contentKind: 'place',
              priceMode: 'free',
            }),
          ]),
        }),
      }),
    );
  });

  it('accepts steps, regenerates one step and confirms a normal EveningRoute', async () => {
    const { service, draftUpdate, routeCreate, stepCreateMany, openRouter } = createService();

    const accepted = await service.acceptStep('user-1', 'draft-1', 1);
    expect(accepted.acceptedStepIndexes).toEqual([0, 1]);
    expect(accepted.canConfirm).toBe(true);

    const regenerated = await service.regenerateStep('user-1', 'draft-1', 1);
    expect(openRouter.generateJson).not.toHaveBeenCalled();
    expect(regenerated.route.steps.map((step: any) => step.title)).toEqual([
      'Brix',
      'Джаз',
    ]);
    expect(draftUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          acceptedStepIndexes: [0],
          rejectedExternalItemIds: expect.arrayContaining(['old-rejected', 'ticketland-show']),
        }),
      }),
    );

    await service.acceptStep('user-1', 'draft-1', 1);
    const confirmed = await service.confirmDraft('user-1', 'draft-1');
    expect(confirmed.route.id).toEqual(expect.stringMatching(/^route_/));
    expect(routeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'ai_openrouter',
          status: 'draft',
          badgeLabel: 'AI маршрут',
        }),
      }),
    );
    expect(stepCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            routeId: confirmed.route.id,
            title: 'Brix',
          }),
          expect.objectContaining({
            routeId: confirmed.route.id,
            title: 'Джаз',
          }),
        ]),
      }),
    );
  });

  it('regenerates one step from the saved candidate pack without calling OpenRouter', async () => {
    const { service, draftUpdate, openRouter } = createService();

    const result = await service.regenerateStep('user-1', 'draft-1', 1);

    expect(openRouter.generateJson).not.toHaveBeenCalled();
    expect(result.route.steps.map((step: any) => step.title)).toEqual([
      'Brix',
      'Джаз',
    ]);
    expect(result.acceptedStepIndexes).toEqual([0]);
    expect(draftUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          acceptedStepIndexes: [0],
          rejectedExternalItemIds: expect.arrayContaining(['old-rejected', 'ticketland-show']),
        }),
      }),
    );
  });

  it('regenerates the whole draft without reusing current route steps', async () => {
    const { service, draftUpdate, openRouter } = createService({
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Другой бар и джаз',
            vibe: 'Новый вариант',
            blurb: 'Маршрут заменен целиком.',
            steps: [
              {
                externalContentItemId: 'tomesto-alt',
                timeLabel: '19:00',
                endTimeLabel: '20:00',
                description: 'Другой бар',
              },
              {
                externalContentItemId: 'ticketland-alt',
                timeLabel: '20:30',
                endTimeLabel: '22:00',
                description: 'Другой концерт',
              },
            ],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 130,
        },
      ],
    });

    const result = await service.regenerateDraft('user-1', 'draft-1');

    const routeCall = openRouter.generateJson.mock.calls.find(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    )?.[0];
    expect(routeCall.userPrompt).toContain('tomesto-bar');
    expect(routeCall.userPrompt).toContain('ticketland-show');
    expect(result.acceptedStepIndexes).toEqual([]);
    expect(result.currentStepIndex).toBe(0);
    expect(result.route.steps.map((step: any) => step.title)).toEqual([
      'Винный шкаф',
      'Джаз',
    ]);
    expect(draftUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          acceptedStepIndexes: [],
          rejectedExternalItemIds: expect.arrayContaining([
            'old-rejected',
            'tomesto-bar',
            'ticketland-show',
          ]),
        }),
      }),
    );
  });

  it('returns a clear error when a step has no regenerate alternatives', async () => {
    const { service } = createService({
      draftOverrides: {
        candidatePackJson: [
          {
            id: 'tomesto-bar',
            role: 'place_bar',
            source: 'tomesto',
            contentKind: 'place',
            title: 'Brix',
            area: 'Центр',
            tags: ['bar'],
            priceMode: 'paid',
            priceFrom: 1200,
            startsAt: null,
            lat: 55.76,
            lng: 37.61,
            address: 'Покровка 12',
            venueName: 'Brix',
            actionUrl: null,
            sourceUrl: null,
            sourceProvider: 'ТоМесто',
            shortSummary: 'Бар для старта',
          },
          {
            id: 'ticketland-show',
            role: 'show',
            source: 'advcake_ticketland',
            contentKind: 'event',
            title: 'Стендап',
            area: 'Центр',
            tags: ['standup'],
            priceMode: 'paid',
            priceFrom: 1200,
            startsAt: '2099-06-01T17:30:00.000Z',
            lat: 55.765,
            lng: 37.615,
            address: 'Тверская 1',
            venueName: 'Stage',
            actionUrl: 'https://ticket.example.test',
            sourceUrl: null,
            sourceProvider: 'Ticketland / MTS Live',
            shortSummary: 'Шоу рядом',
          },
        ],
      },
    });

    await expect(service.regenerateStep('user-1', 'draft-1', 1)).rejects.toMatchObject({
      statusCode: 409,
      code: 'evening_ai_regenerate_candidates_exhausted',
    });
  });

  it('varies equal-score Tomesto candidates between new drafts', async () => {
    const { service, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          routeStepCount: 1,
          stepCountReason: 'Пользователь просит одно место для еды.',
          participantsCount: 0,
          budget: 'mid',
          steps: [
            {
              role: 'place_food',
              preferredTerms: ['ресторан'],
              avoidTerms: [],
              instruction: 'Одно место для еды.',
            },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 35,
      },
      externalItems: {
        tomesto: [
          {
            id: 'tomesto-alpha',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Alpha',
            category: 'restaurant',
            tags: ['occasion:food', 'place:restaurant'],
            priceFrom: 1800,
            placeKind: 'restaurant',
            venueName: 'Alpha',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-beta',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Beta',
            category: 'restaurant',
            tags: ['occasion:food', 'place:restaurant'],
            priceFrom: 1800,
            placeKind: 'restaurant',
            venueName: 'Beta',
            sourceProvider: 'ТоМесто',
          },
          {
            id: 'tomesto-gamma',
            source: { code: 'tomesto', name: 'ТоМесто' },
            contentKind: 'place',
            title: 'Gamma',
            category: 'restaurant',
            tags: ['occasion:food', 'place:restaurant'],
            priceFrom: 1800,
            placeKind: 'restaurant',
            venueName: 'Gamma',
            sourceProvider: 'ТоМесто',
          },
        ],
      },
      openRouterResponses: [
        {
          parsedJson: {
            title: 'Ужин',
            vibe: 'Еда',
            blurb: 'Один ресторан.',
            steps: [{ externalContentItemId: 'tomesto-alpha', timeLabel: '19:00' }],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 70,
        },
        {
          parsedJson: {
            title: 'Ужин',
            vibe: 'Еда',
            blurb: 'Один ресторан.',
            steps: [{ externalContentItemId: 'tomesto-alpha', timeLabel: '19:00' }],
          },
          rawResponse: {},
          model: 'openrouter/owl-alpha',
          latencyMs: 70,
        },
      ],
    });

    await service.createDraft('user-1', {
      prompt: 'Найди ресторан на вечер',
      city: 'Москва',
    });
    await service.createDraft('user-1', {
      prompt: 'Найди ресторан на вечер',
      city: 'Москва',
    });

    const routeCalls = openRouter.generateJson.mock.calls
      .map(([call]) => call)
      .filter((call) => call?.responseFormat?.json_schema?.name === 'evening_ai_route');
    const candidateOrders = routeCalls.map((call) =>
      JSON.parse(call.userPrompt).candidates.map((candidate: any) => candidate.id),
    );
    expect(new Set(candidateOrders.map((order) => JSON.stringify(order))).size).toBeGreaterThan(1);
  });

  it('retries bad LLM output once and falls back to deterministic draft', async () => {
    const { service, draftCreate, openRouter } = createService({
      openRouterResponses: [
        new Error('invalid json'),
        {
        parsedJson: {
          title: 'Плохой маршрут',
          vibe: 'Ошибка',
          blurb: 'LLM выбрала неизвестный id.',
          steps: [
            {
              externalContentItemId: 'missing-id',
              timeLabel: '19:00',
              endTimeLabel: '20:00',
              description: 'Нет такого кандидата',
            },
            {
              externalContentItemId: 'ticketland-show',
              timeLabel: '20:30',
              endTimeLabel: '22:00',
              description: 'Шоу рядом',
            },
          ],
        },
        rawResponse: {},
        model: 'openrouter/owl-alpha',
        latencyMs: 200,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt: 'Винный бар и стендап',
      city: 'Москва',
      stepCount: 2,
    });

    const routeCalls = openRouter.generateJson.mock.calls.filter(
      ([call]) => call?.responseFormat?.json_schema?.name === 'evening_ai_route',
    );
    expect(openRouter.generateJson).toHaveBeenCalledTimes(3);
    expect(routeCalls[1][0].userPrompt).toContain('llm_response_error');
    expect(result.route.steps).toEqual([
      expect.objectContaining({ title: 'Brix', ticketSourceCode: 'tomesto' }),
      expect.objectContaining({
        title: 'Стендап',
        ticketSourceCode: 'advcake_ticketland',
      }),
    ]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'llm_validation_fallback' }),
      ]),
    );
    expect(draftCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          validationIssues: expect.arrayContaining([
            expect.objectContaining({ code: 'llm_validation_fallback' }),
          ]),
        }),
      }),
    );
  });
});
