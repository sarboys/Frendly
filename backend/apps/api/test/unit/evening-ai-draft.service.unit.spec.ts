import { EveningAiDraftService } from '../../src/services/evening-ai-draft.service';

describe('EveningAiDraftService unit', () => {
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
    openRouterResponses?: Array<Record<string, unknown> | Error>;
    intentResponse?: Record<string, unknown>;
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
    const routeCreate = jest.fn().mockResolvedValue({});
    const stepCreateMany = jest.fn().mockResolvedValue({ count: 2 });
    const prisma = {
      client: {
        externalContentItem: { findMany: externalFindMany },
        eveningAiRouteDraft: {
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
        model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
          return Promise.resolve(options.intentResponse);
        }
        const prompt = JSON.parse(input.userPrompt);
        const fallbackRoles = prompt.config?.fallbackRoles ?? ['place_bar', 'show'];
        return Promise.resolve({
          parsedJson: {
            steps: fallbackRoles.map((role: string) => ({
              role,
              preferredTerms: [],
              avoidTerms: [],
              instruction: '',
            })),
          },
          rawResponse: {},
          model: 'qwen/qwen3-next-80b-a3b-instruct:free',
          latencyMs: 30,
        });
      }
      const nextResponse = routeResponses.shift();
      if (nextResponse instanceof Error) {
        return Promise.reject(nextResponse);
      }
      return Promise.resolve(nextResponse ?? defaultOpenRouterResponse);
    });
    const service = new EveningAiDraftService(prisma, openRouter as any);
    return { service, externalFindMany, draftCreate, draftUpdate, routeCreate, stepCreateMany, openRouter };
  }

  function externalItemMatchesQuery(item: any, query: any) {
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

  it('creates a draft from source-specific candidates and Qwen JSON schema output', async () => {
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
          expect.objectContaining({ title: 'Brix', ticketSourceCode: 'tomesto' }),
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
        model: 'qwen/qwen3-next-80b-a3b-instruct:free',
        timeoutMs: 4500,
        responseFormat: expect.objectContaining({
          type: 'json_schema',
        }),
      }),
    );
    expect(draftCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
            tags: ['паста', 'итальянская кухня'],
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
          model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
          model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
        model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
          model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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

  it('infers prompt step count and low budget without button filters', async () => {
    const { service, draftCreate, openRouter } = createService({
      intentResponse: {
        parsedJson: {
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
        model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
          model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
        defaultStepCount: 5,
        maxStepCount: 5,
        budget: 'low',
      }),
    );
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
          routeStepCount: 4,
          stepCountReason: 'Модель ошибочно взяла число людей за шаги.',
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
        model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
          model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
        participantsCount: 4,
        stepCountMode: 'infer',
        maxStepCount: 5,
      }),
    );
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

  it('treats step count written in prompt as exact even when intent returns extra roles', async () => {
    const { service, draftCreate, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          steps: [
            { role: 'walk', preferredTerms: ['парк'], avoidTerms: [], instruction: '' },
            { role: 'place_food', preferredTerms: ['итальян'], avoidTerms: [], instruction: '' },
            { role: 'show', preferredTerms: ['спектакль'], avoidTerms: [], instruction: '' },
            { role: 'place_bar', preferredTerms: ['тихий'], avoidTerms: [], instruction: '' },
            { role: 'free_activity', preferredTerms: ['выставка'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
          model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
        stepCountMode: 'exact',
        maxStepCount: 3,
        budget: 'mid',
      }),
    );
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
        model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
          model: 'qwen/qwen3-next-80b-a3b-instruct:free',
          latencyMs: 95,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt:
        'свидание на двоих завтра вечером, 3 точки. красивый парк, итальянский ресторан, спектакль. бюджет средний, не шумно.',
      city: 'Москва',
    });

    expect(result.route.steps.map((step: any) => step.title)).toEqual([
      'Красивый парк',
      'Casa Bella',
      'Спектакль',
    ]);
  });

  it('finds expanded bar, cuisine, atmosphere and diet terms through taxonomy tags', async () => {
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
        model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
          model: 'qwen/qwen3-next-80b-a3b-instruct:free',
          latencyMs: 95,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt:
        '5 точек: крафтовое пиво, камерные настойки, паназиатская кухня, мексиканская кухня, веганское кафе',
      city: 'Москва',
    });

    expect(result.route.steps.map((step: any) => step.title)).toEqual([
      'Taproom',
      'Cabinet',
      'Asia Room',
      'Taco House',
      'Green Cafe',
    ]);
    const queriedTags = externalFindMany.mock.calls.flatMap(([query]: [any]) =>
      (query?.where?.OR ?? [])
        .map((term: any) => term?.tags?.array_contains?.[0])
        .filter((tag: unknown): tag is string => typeof tag === 'string'),
    );
    expect(queriedTags).toEqual(
      expect.arrayContaining([
        'feature:craft_beer',
        'set:nastoyki',
        'cuisine:panaziatskaya',
        'cuisine:meksikanskaya',
        'feature:vegan',
      ]),
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
        model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
          model: 'qwen/qwen3-next-80b-a3b-instruct:free',
          latencyMs: 95,
        },
      ],
    });

    await service.createDraft('user-1', {
      prompt: '2 точки: барбекю и спектакль',
      city: 'Москва',
    });

    const queriedTags = externalFindMany.mock.calls.flatMap(([query]: [any]) =>
      (query?.where?.OR ?? [])
        .map((term: any) => term?.tags?.array_contains?.[0])
        .filter((tag: unknown): tag is string => typeof tag === 'string'),
    );
    expect(queriedTags).toContain('place:steakhouse');
    expect(queriedTags).not.toContain('place:bar');
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
        model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
        model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
          model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
    expect(foodCandidateIds.slice(0, 2)).toEqual(['tomesto-far', 'tomesto-near']);
  });

  it('infers prompt area before LLM and boosts matching area candidates', async () => {
    const { service, draftCreate, openRouter } = createService({
      intentResponse: {
        parsedJson: {
          steps: [
            { role: 'place_food', preferredTerms: ['ресторан'], avoidTerms: [], instruction: '' },
            { role: 'show', preferredTerms: ['спектакль'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
          model: 'qwen/qwen3-next-80b-a3b-instruct:free',
          latencyMs: 95,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt: '2 точки в центре: ресторан и спектакль',
      city: 'Москва',
    });

    const intentPrompt = JSON.parse(openRouter.generateJson.mock.calls[0][0].userPrompt);
    expect(intentPrompt.config.area).toBe('center');
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
    expect(result.route.area).toBe('center');
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
          steps: [
            { role: 'place_food', preferredTerms: ['ресторан'], avoidTerms: [], instruction: '' },
            { role: 'show', preferredTerms: ['спектакль'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
          model: 'qwen/qwen3-next-80b-a3b-instruct:free',
          latencyMs: 95,
        },
      ],
    });

    const result = await service.createDraft('user-1', {
      prompt: '2 точки на патриках: ресторан и спектакль',
      city: 'Москва',
    });

    expect(result.route.area).toBe('patriki');
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
          steps: [
            { role: 'place_food', preferredTerms: ['ресторан'], avoidTerms: [], instruction: '' },
            { role: 'show', preferredTerms: ['спектакль'], avoidTerms: [], instruction: '' },
          ],
        },
        rawResponse: {},
        model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
          model: 'qwen/qwen3-next-80b-a3b-instruct:free',
          latencyMs: 95,
        },
      ],
    });

    await service.createDraft('user-1', {
      prompt: '2 точки на севере: ресторан и спектакль',
      city: 'Москва',
    });

    const intentPrompt = JSON.parse(openRouter.generateJson.mock.calls[0][0].userPrompt);
    expect(intentPrompt.config.area).toBe('north');
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
          model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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

    await service.regenerateStep('user-1', 'draft-1', 1);
    expect(openRouter.generateJson).toHaveBeenLastCalledWith(
      expect.objectContaining({
        timeoutMs: 3500,
        userPrompt: expect.stringContaining('old-rejected'),
      }),
    );
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
        ]),
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
          model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
        model: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
