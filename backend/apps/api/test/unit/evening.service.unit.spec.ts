import { EveningService } from '../../src/services/evening.service';

describe('EveningService unit', () => {
  const routeFixture = (overrides: Record<string, unknown> = {}) => ({
    id: 'r-cozy-circle',
    title: 'Теплый круг на Покровке',
    vibe: 'Камерный вечер',
    blurb: 'Аперитив и стендап',
    totalPriceFrom: 1400,
    totalSavings: 650,
    durationLabel: '19:00 - 00:30',
    area: 'Чистые пруды',
    goal: 'newfriends',
    mood: 'chill',
    budget: 'mid',
    format: 'mixed',
    premium: false,
    recommendedFor: 'Для тех, кто впервые',
    hostsCount: 8,
    chatId: 'evening-chat-r-cozy-circle',
    steps: [
      {
        id: 's1-1',
        routeId: 'r-cozy-circle',
        sortOrder: 0,
        timeLabel: '19:00',
        endTimeLabel: '20:15',
        kind: 'bar',
        title: 'Аперитив в Brix Wine',
        venue: 'Brix Wine',
        address: 'Покровка 12',
        emoji: '🍇',
        distanceLabel: '1.2 км',
        walkMin: 14,
        perk: '-15% на бокалы',
        perkShort: '-15%',
        ticketPrice: null,
        ticketCommission: null,
        sponsored: false,
        premium: false,
        partnerId: 'p-brix',
        description: 'Знакомство за бокалом',
        vibeTag: 'Уютно',
        lat: 0.42,
        lng: 0.38,
      },
      {
        id: 's1-2',
        routeId: 'r-cozy-circle',
        sortOrder: 1,
        timeLabel: '20:30',
        endTimeLabel: '22:00',
        kind: 'show',
        title: 'Открытый микрофон',
        venue: 'Standup Store',
        address: 'Бол. Дмитровка 32',
        emoji: '🎤',
        distanceLabel: '2.1 км',
        walkMin: 6,
        perk: null,
        perkShort: null,
        ticketPrice: 800,
        ticketCommission: 80,
        sponsored: false,
        premium: false,
        partnerId: null,
        description: 'Короткие сеты',
        vibeTag: 'Смех',
        lat: 0.55,
        lng: 0.32,
      },
    ],
    ...overrides,
  });

  it('resolves the strongest matching route and maps user step state', async () => {
    const findMany = jest.fn().mockResolvedValue([
      routeFixture({ id: 'r-other', goal: 'quiet', mood: 'chill', budget: 'low' }),
      routeFixture(),
    ]);
    const actionFindMany = jest.fn().mockResolvedValue([
      {
        stepId: 's1-1',
        perkUsedAt: new Date('2026-04-26T10:00:00.000Z'),
        ticketBoughtAt: null,
        sentToChatAt: new Date('2026-04-26T10:05:00.000Z'),
        chatMessageId: 'msg-1',
      },
    ]);
    const service = new EveningService(
      {
        client: {
          eveningRoute: {
            findMany,
            findUnique: jest.fn(),
            findFirst: jest.fn(),
          },
          userEveningStepAction: {
            findMany: actionFindMany,
          },
          userSubscription: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        },
      } as any,
    );

    const result = await service.resolveRoute('user-me', {
      goal: 'newfriends',
      mood: 'chill',
      budget: 'mid',
    });

    expect(result.id).toBe('r-cozy-circle');
    expect(result.locked).toBe(false);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]).toMatchObject({
      id: 's1-1',
      time: '19:00',
      distance: '1.2 км',
      hasShareable: true,
      state: {
        perkUsed: true,
        ticketBought: false,
        sentToChat: true,
        chatMessageId: 'msg-1',
      },
    });
    expect(result.userState).toEqual({
      usedPerkStepIds: ['s1-1'],
      boughtTicketStepIds: [],
      sentToChatStepIds: ['s1-1'],
    });
  });

  it('rejects perk usage when the step has no perk', async () => {
    const service = new EveningService(
      {
        client: {
          eveningRouteStep: {
            findFirst: jest.fn().mockResolvedValue({
              id: 's1-2',
              routeId: 'r-cozy-circle',
              perk: null,
              route: {
                id: 'r-cozy-circle',
                premium: false,
              },
            }),
          },
          userSubscription: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          userEveningStepAction: {
            upsert: jest.fn(),
          },
        },
      } as any,
    );

    await expect(
      service.markPerkUsed('user-me', 'r-cozy-circle', 's1-2'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'evening_perk_not_available',
    });
  });

  it('shares a step to the route chat only once', async () => {
    const step = {
      id: 's1-1',
      routeId: 'r-cozy-circle',
      timeLabel: '19:00',
      endTimeLabel: '20:15',
      title: 'Аперитив в Brix Wine',
      venue: 'Brix Wine',
      perk: '-15% на бокалы',
      perkShort: '-15%',
      ticketPrice: null,
      route: {
        id: 'r-cozy-circle',
        premium: false,
        chatId: 'evening-chat-r-cozy-circle',
      },
    };
    const message = {
      id: 'msg-1',
      chatId: 'evening-chat-r-cozy-circle',
      senderId: 'user-me',
      sender: {
        id: 'user-me',
        displayName: 'Никита',
        profile: { avatarUrl: null },
      },
      text: '19:00 - 20:15 · ✨ Перк: -15% · Brix Wine',
      clientMessageId: 'evening-share:user-me:s1-1',
      createdAt: new Date('2026-04-26T10:00:00.000Z'),
      replyTo: null,
      attachments: [],
    };
    const tx = {
      chatMember: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      userEveningStepAction: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          stepId: 's1-1',
          sentToChatAt: new Date('2026-04-26T10:00:00.000Z'),
          chatMessageId: 'msg-1',
        }),
      },
      message: {
        create: jest.fn().mockResolvedValue(message),
      },
      chat: {
        update: jest.fn().mockResolvedValue({}),
      },
      realtimeEvent: {
        create: jest.fn().mockResolvedValue({ id: BigInt(42) }),
      },
      outboxEvent: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const service = new EveningService(
      {
        client: {
          eveningRouteStep: {
            findFirst: jest.fn().mockResolvedValue(step),
          },
          userSubscription: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          $transaction: jest.fn((callback) => callback(tx)),
        },
      } as any,
    );

    const result = await service.shareStepToChat(
      'user-me',
      'r-cozy-circle',
      's1-1',
    );

    expect(result).toMatchObject({
      stepId: 's1-1',
      sentToChat: true,
      chatId: 'evening-chat-r-cozy-circle',
      messageId: 'msg-1',
      previewText: '19:00 - 20:15 · ✨ Перк: -15% · Brix Wine',
      alreadySent: false,
    });
    expect(tx.chatMember.upsert).toHaveBeenCalledTimes(1);
    expect(tx.message.create).toHaveBeenCalledTimes(1);
    expect(tx.outboxEvent.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ type: 'realtime.publish' }),
        expect.objectContaining({ type: 'chat.unread_fanout' }),
      ]),
    });
  });

  it('launches an evening route by updating the linked chat phase', async () => {
    const findUnique = jest.fn().mockResolvedValue(routeFixture());
    const chatMemberUpsert = jest.fn().mockResolvedValue({});
    const chatUpdate = jest.fn().mockResolvedValue({
      id: 'evening-chat-r-cozy-circle',
      meetupPhase: 'live',
      meetupMode: 'manual',
      currentStep: 1,
    });
    const service = new EveningService(
      {
        client: {
          eveningRoute: {
            findUnique,
          },
          userSubscription: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          $transaction: jest.fn((callback) =>
            callback({
              chatMember: {
                upsert: chatMemberUpsert,
              },
              chat: {
                update: chatUpdate,
              },
            }),
          ),
        },
      } as any,
    );

    const result = await service.launchRoute('user-me', 'r-cozy-circle', {
      mode: 'manual',
      startDelayMin: 15,
    });

    expect(chatMemberUpsert).toHaveBeenCalledWith({
      where: {
        chatId_userId: {
          chatId: 'evening-chat-r-cozy-circle',
          userId: 'user-me',
        },
      },
      create: {
        chatId: 'evening-chat-r-cozy-circle',
        userId: 'user-me',
      },
      update: {},
    });
    expect(chatUpdate).toHaveBeenCalledWith({
      where: { id: 'evening-chat-r-cozy-circle' },
      data: expect.objectContaining({
        meetupPhase: 'live',
        meetupMode: 'manual',
        currentStep: 1,
      }),
    });
    expect(result.phase).toBe('live');
    expect(result.chatId).toBe('evening-chat-r-cozy-circle');
    expect(result.mode).toBe('manual');
  });

  it('launches an evening route by creating a meetup chat when missing', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValue(routeFixture({ chatId: null }));
    const chatCreate = jest.fn().mockResolvedValue({
      id: 'evening-chat-new',
    });
    const eveningRouteUpdate = jest.fn().mockResolvedValue({});
    const chatMemberUpsert = jest.fn().mockResolvedValue({});
    const service = new EveningService(
      {
        client: {
          eveningRoute: {
            findUnique,
          },
          userSubscription: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          $transaction: jest.fn((callback) =>
            callback({
              chat: {
                create: chatCreate,
              },
              eveningRoute: {
                update: eveningRouteUpdate,
              },
              chatMember: {
                upsert: chatMemberUpsert,
              },
            }),
          ),
        },
      } as any,
    );

    const result = await service.launchRoute('user-me', 'r-cozy-circle', {
      mode: 'hybrid',
    });

    expect(chatCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: 'meetup',
        origin: 'meetup',
        title: 'Теплый круг на Покровке',
        meetupPhase: 'live',
        meetupMode: 'hybrid',
        currentStep: 1,
      }),
    });
    expect(eveningRouteUpdate).toHaveBeenCalledWith({
      where: { id: 'r-cozy-circle' },
      data: { chatId: 'evening-chat-new' },
    });
    expect(chatMemberUpsert).toHaveBeenCalledWith({
      where: {
        chatId_userId: {
          chatId: 'evening-chat-new',
          userId: 'user-me',
        },
      },
      create: {
        chatId: 'evening-chat-new',
        userId: 'user-me',
      },
      update: {},
    });
    expect(result.chatId).toBe('evening-chat-new');
    expect(result.phase).toBe('live');
  });
});
