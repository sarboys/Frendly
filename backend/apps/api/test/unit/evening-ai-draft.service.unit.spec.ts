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

  function createService() {
    const externalFindMany = jest.fn((query: any) => {
      const code = query?.where?.source?.code;
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
    const openRouter = {
      generateJson: jest.fn().mockResolvedValue({
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
      }),
    };
    const service = new EveningAiDraftService(prisma, openRouter as any);
    return { service, externalFindMany, draftCreate, draftUpdate, routeCreate, stepCreateMany, openRouter };
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

  it('retries bad LLM output once and falls back to deterministic draft', async () => {
    const { service, draftCreate, openRouter } = createService();
    openRouter.generateJson
      .mockRejectedValueOnce(new Error('invalid json'))
      .mockResolvedValueOnce({
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
      });

    const result = await service.createDraft('user-1', {
      prompt: 'Винный бар и стендап',
      city: 'Москва',
      stepCount: 2,
    });

    expect(openRouter.generateJson).toHaveBeenCalledTimes(2);
    expect(openRouter.generateJson.mock.calls[1][0].userPrompt).toContain('llm_response_error');
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
