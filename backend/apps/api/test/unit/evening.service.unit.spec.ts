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

  it('publishes an evening route as a scheduled session without reusing route chat', async () => {
    const findUnique = jest.fn().mockResolvedValue(routeFixture());
    const chatMemberUpsert = jest.fn().mockResolvedValue({});
    const chatCreate = jest.fn().mockResolvedValue({
      id: 'evening-chat-new',
    });
    const sessionCreate = jest.fn().mockResolvedValue({
      id: 'evening-session-new',
      chatId: 'evening-chat-new',
      privacy: 'request',
      capacity: 10,
      phase: 'scheduled',
      mode: 'manual',
    });
    const participantUpsert = jest.fn().mockResolvedValue({});
    const stepStateCreateMany = jest.fn().mockResolvedValue({ count: 2 });
    const messageFindUnique = jest.fn().mockResolvedValue(null);
    const messageCreate = jest.fn().mockResolvedValue({ id: 'sys-publish' });
    const realtimeEventCreate = jest.fn().mockResolvedValue({ id: 9 });
    const outboxCreateMany = jest.fn().mockResolvedValue({ count: 2 });
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
                update: jest.fn(),
              },
              eveningSession: {
                create: sessionCreate,
              },
              eveningSessionParticipant: {
                upsert: participantUpsert,
              },
              eveningSessionStepState: {
                createMany: stepStateCreateMany,
              },
              chatMember: {
                upsert: chatMemberUpsert,
              },
              message: {
                findUnique: messageFindUnique,
                create: messageCreate,
              },
              realtimeEvent: {
                create: realtimeEventCreate,
              },
              outboxEvent: {
                createMany: outboxCreateMany,
              },
            }),
          ),
        },
      } as any,
    );

    const result = await service.launchRoute('user-me', 'r-cozy-circle', {
      mode: 'manual',
      startDelayMin: 15,
      privacy: 'request',
    });

    expect(chatCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: 'meetup',
        origin: 'meetup',
        title: 'Теплый круг на Покровке',
        meetupPhase: 'soon',
        meetupMode: 'manual',
        currentStep: null,
      }),
    });
    expect(sessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        routeId: 'r-cozy-circle',
        hostUserId: 'user-me',
        chatId: 'evening-chat-new',
        phase: 'scheduled',
        privacy: 'request',
        mode: 'manual',
        capacity: 10,
      }),
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
    expect(participantUpsert).toHaveBeenCalledWith({
      where: {
        sessionId_userId: {
          sessionId: 'evening-session-new',
          userId: 'user-me',
        },
      },
      create: expect.objectContaining({
        sessionId: 'evening-session-new',
        userId: 'user-me',
        role: 'host',
        status: 'joined',
      }),
      update: expect.objectContaining({
        status: 'joined',
      }),
    });
    expect(result).toMatchObject({
      sessionId: 'evening-session-new',
      routeId: 'r-cozy-circle',
      chatId: 'evening-chat-new',
      phase: 'scheduled',
      chatPhase: 'soon',
      privacy: 'request',
      mode: 'manual',
      joinedCount: 1,
      maxGuests: 10,
    });
  });

  it('publishes the same route twice into different sessions and chats', async () => {
    const findUnique = jest.fn().mockResolvedValue(routeFixture());
    const chatCreate = jest
      .fn()
      .mockResolvedValueOnce({ id: 'evening-chat-a' })
      .mockResolvedValueOnce({ id: 'evening-chat-b' });
    const sessionCreate = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'evening-session-a',
        chatId: 'evening-chat-a',
        privacy: 'open',
        capacity: 10,
        phase: 'scheduled',
        mode: 'hybrid',
      })
      .mockResolvedValueOnce({
        id: 'evening-session-b',
        chatId: 'evening-chat-b',
        privacy: 'invite',
        capacity: 10,
        phase: 'scheduled',
        mode: 'hybrid',
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
              chat: { create: chatCreate, update: jest.fn() },
              eveningSession: { create: sessionCreate },
              eveningSessionParticipant: { upsert: jest.fn() },
              eveningSessionStepState: { createMany: jest.fn() },
              chatMember: { upsert: jest.fn() },
              message: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 'sys' }),
              },
              realtimeEvent: { create: jest.fn().mockResolvedValue({ id: 1 }) },
              outboxEvent: { createMany: jest.fn() },
            }),
          ),
        },
      } as any,
    );

    const first = await service.launchRoute('user-me', 'r-cozy-circle', {
      privacy: 'open',
    });
    const second = await service.launchRoute('user-me', 'r-cozy-circle', {
      privacy: 'invite',
    });

    expect(first).toMatchObject({
      sessionId: 'evening-session-a',
      chatId: 'evening-chat-a',
      privacy: 'open',
      phase: 'scheduled',
    });
    expect(second).toMatchObject({
      sessionId: 'evening-session-b',
      chatId: 'evening-chat-b',
      privacy: 'invite',
      phase: 'scheduled',
    });
    expect(chatCreate).toHaveBeenCalledTimes(2);
    expect(sessionCreate).toHaveBeenCalledTimes(2);
  });

  it('maps live session coordinates from the current route step', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'evening-session-live',
        routeId: 'r-cozy-circle',
        chatId: 'evening-chat-live',
        phase: 'live',
        privacy: 'open',
        mode: 'hybrid',
        capacity: 10,
        startsAt: new Date('2026-04-26T16:00:00.000Z'),
        startedAt: new Date('2026-04-26T16:00:00.000Z'),
        endedAt: null,
        currentStep: 2,
        inviteToken: null,
        hostUserId: 'host-user',
        host: {
          id: 'host-user',
          displayName: 'Аня К',
        },
        route: routeFixture(),
        participants: [
          {
            userId: 'host-user',
            role: 'host',
            status: 'joined',
            user: {
              id: 'host-user',
              displayName: 'Аня К',
            },
          },
        ],
        stepStates: [],
        checkIns: [],
        joinRequests: [],
      },
    ]);
    const service = new EveningService({
      client: {
        eveningSession: {
          findMany,
        },
      },
    } as any);

    const result = await service.listSessions('user-guest');

    expect(result.items[0]).toMatchObject({
      id: 'evening-session-live',
      currentPlace: 'Standup Store',
      lat: 0.55,
      lng: 0.32,
    });
  });

  it('maps current user request state for request-only sessions', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'evening-session-request',
        routeId: 'r-cozy-circle',
        chatId: 'evening-chat-request',
        phase: 'scheduled',
        privacy: 'request',
        mode: 'hybrid',
        capacity: 10,
        startsAt: new Date('2026-04-26T16:00:00.000Z'),
        startedAt: null,
        endedAt: null,
        currentStep: null,
        inviteToken: null,
        hostUserId: 'host-user',
        host: {
          id: 'host-user',
          displayName: 'Аня К',
        },
        route: routeFixture(),
        participants: [
          {
            userId: 'host-user',
            role: 'host',
            status: 'joined',
            user: {
              id: 'host-user',
              displayName: 'Аня К',
            },
          },
        ],
        stepStates: [],
        checkIns: [],
        joinRequests: [
          {
            id: 'request-guest',
            userId: 'user-guest',
            status: 'requested',
            note: null,
            createdAt: new Date('2026-04-26T15:50:00.000Z'),
            user: {
              displayName: 'Ира',
            },
          },
        ],
      },
    ]);
    const service = new EveningService({
      client: {
        eveningSession: {
          findMany,
        },
      },
    } as any);

    const result = await service.listSessions('user-guest');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          joinRequests: expect.objectContaining({
            where: {
              status: 'requested',
              userId: 'user-guest',
            },
          }),
        }),
      }),
    );
    expect(result.items[0]).toMatchObject({
      id: 'evening-session-request',
      isJoined: false,
      isRequested: true,
    });
  });

  it('loads pending requests only for the session host detail', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'evening-session-request',
      routeId: 'r-cozy-circle',
      chatId: 'evening-chat-request',
      phase: 'scheduled',
      privacy: 'request',
      mode: 'hybrid',
      capacity: 10,
      startsAt: new Date('2026-04-26T16:00:00.000Z'),
      startedAt: null,
      endedAt: null,
      currentStep: null,
      inviteToken: null,
      hostUserId: 'host-user',
      host: {
        id: 'host-user',
        displayName: 'Аня К',
      },
      route: routeFixture(),
      participants: [
        {
          userId: 'host-user',
          role: 'host',
          status: 'joined',
          user: {
            id: 'host-user',
            displayName: 'Аня К',
          },
        },
      ],
      stepStates: [],
      checkIns: [],
      joinRequests: [],
    });
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'request-guest',
        userId: 'user-guest',
        status: 'requested',
        note: 'Хочу пойти',
        createdAt: new Date('2026-04-26T15:50:00.000Z'),
        user: {
          displayName: 'Ира',
        },
      },
    ]);
    const service = new EveningService({
      client: {
        eveningSession: {
          findUnique,
        },
        eveningSessionJoinRequest: {
          findMany,
        },
      },
    } as any);

    const result = await service.getSession('host-user', 'evening-session-request');

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          joinRequests: expect.objectContaining({
            where: {
              status: 'requested',
              userId: 'host-user',
            },
          }),
        }),
      }),
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sessionId: 'evening-session-request',
          status: 'requested',
        },
      }),
    );
    expect(result.pendingRequests).toEqual([
      expect.objectContaining({
        id: 'request-guest',
        userId: 'user-guest',
        name: 'Ира',
        status: 'requested',
      }),
    ]);
  });

  it('returns invite token when host publishes invite-only session', async () => {
    const sessionCreate = jest.fn().mockResolvedValue({
      id: 'evening-session-invite',
      chatId: 'evening-chat-invite',
      privacy: 'invite',
      inviteToken: 'secret-token',
      capacity: 10,
      phase: 'scheduled',
      mode: 'hybrid',
    });
    const service = new EveningService(
      {
        client: {
          eveningRoute: {
            findUnique: jest.fn().mockResolvedValue(routeFixture()),
          },
          userSubscription: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          $transaction: jest.fn((callback) =>
            callback({
              chat: {
                create: jest.fn().mockResolvedValue({
                  id: 'evening-chat-invite',
                }),
              },
              eveningSession: { create: sessionCreate },
              eveningSessionParticipant: { upsert: jest.fn() },
              eveningSessionStepState: { createMany: jest.fn() },
              chatMember: { upsert: jest.fn() },
              message: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 'sys-publish' }),
              },
              realtimeEvent: { create: jest.fn().mockResolvedValue({ id: 10 }) },
              outboxEvent: { createMany: jest.fn() },
            }),
          ),
        },
      } as any,
    );

    const result = await service.launchRoute('user-me', 'r-cozy-circle', {
      privacy: 'invite',
    });

    expect(sessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        privacy: 'invite',
        inviteToken: expect.any(String),
      }),
    });
    expect(result).toMatchObject({
      sessionId: 'evening-session-invite',
      privacy: 'invite',
      inviteToken: 'secret-token',
    });
  });

  it('starts a scheduled evening session from host chat', async () => {
    const sessionUpdate = jest.fn().mockResolvedValue({
      id: 'evening-session-new',
      chatId: 'evening-chat-new',
      routeId: 'r-cozy-circle',
      phase: 'live',
      currentStep: 1,
    });
    const chatUpdate = jest.fn().mockResolvedValue({});
    const stepStateUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const outboxCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new EveningService(
      {
        client: {
          eveningSession: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'evening-session-new',
              routeId: 'r-cozy-circle',
              chatId: 'evening-chat-new',
              hostUserId: 'user-me',
              phase: 'scheduled',
              mode: 'hybrid',
              privacy: 'open',
              capacity: 10,
              route: routeFixture(),
            }),
            update: sessionUpdate,
          },
          $transaction: jest.fn((callback) =>
            callback({
              eveningSession: { update: sessionUpdate },
              chat: { update: chatUpdate },
              eveningSessionStepState: { updateMany: stepStateUpdateMany },
              message: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 'sys-start' }),
              },
              realtimeEvent: { create: jest.fn().mockResolvedValue({ id: 7 }) },
              outboxEvent: { createMany: outboxCreateMany },
            }),
          ),
        },
      } as any,
    );

    const result = await service.startSession('user-me', 'evening-session-new');

    expect(chatUpdate).toHaveBeenCalledWith({
      where: { id: 'evening-chat-new' },
      data: expect.objectContaining({
        meetupPhase: 'live',
        currentStep: 1,
      }),
    });
    expect(sessionUpdate).toHaveBeenCalledWith({
      where: { id: 'evening-session-new' },
      data: expect.objectContaining({
        phase: 'live',
        currentStep: 1,
      }),
    });
    expect(result).toMatchObject({
      sessionId: 'evening-session-new',
      chatId: 'evening-chat-new',
      phase: 'live',
      currentStep: 1,
      totalSteps: 2,
    });
    expect(outboxCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          type: 'realtime.publish',
          payload: expect.objectContaining({
            type: 'chat.updated',
            payload: expect.objectContaining({
              chatId: 'evening-chat-new',
              sessionId: 'evening-session-new',
              phase: 'live',
              currentStep: 1,
              currentPlace: 'Brix Wine',
            }),
          }),
        }),
      ]),
    });
  });

  it('does not reset an already live session on repeated start', async () => {
    const transaction = jest.fn();
    const service = new EveningService(
      {
        client: {
          eveningSession: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'evening-session-live',
              routeId: 'r-cozy-circle',
              chatId: 'evening-chat-live',
              hostUserId: 'user-me',
              phase: 'live',
              currentStep: 2,
              startsAt: new Date('2026-04-26T17:00:00.000Z'),
              route: routeFixture(),
            }),
          },
          $transaction: transaction,
        },
      } as any,
    );

    const result = await service.startSession('user-me', 'evening-session-live');

    expect(transaction).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      sessionId: 'evening-session-live',
      chatId: 'evening-chat-live',
      phase: 'live',
      currentStep: 2,
      currentPlace: 'Standup Store',
      totalSteps: 2,
    });
  });

  it('rejects session start by a non-host user', async () => {
    const service = new EveningService(
      {
        client: {
          eveningSession: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'evening-session-new',
              hostUserId: 'host-user',
              route: routeFixture(),
            }),
          },
        },
      } as any,
    );

    await expect(
      service.startSession('user-me', 'evening-session-new'),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'evening_session_host_required',
    });
  });

  it('joins open live session and writes late join system message', async () => {
    const participantCount = jest.fn().mockResolvedValue(3);
    const participantUpsert = jest.fn().mockResolvedValue({});
    const chatMemberUpsert = jest.fn().mockResolvedValue({});
    const realtimeEventCreate = jest.fn().mockResolvedValue({ id: 8 });
    const service = new EveningService(
      {
        client: {
          eveningSession: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'evening-session-live',
              routeId: 'r-cozy-circle',
              chatId: 'evening-chat-live',
              hostUserId: 'host-user',
              phase: 'live',
              privacy: 'open',
              capacity: 10,
              currentStep: 2,
              inviteToken: null,
              route: routeFixture(),
            }),
          },
          eveningSessionParticipant: {
            findUnique: jest.fn().mockResolvedValue(null),
            count: participantCount,
          },
          user: {
            findUnique: jest.fn().mockResolvedValue({ displayName: 'Марк' }),
          },
          $transaction: jest.fn((callback) =>
            callback({
              eveningSessionParticipant: { upsert: participantUpsert },
              chatMember: { upsert: chatMemberUpsert },
              message: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 'sys-join' }),
              },
              realtimeEvent: { create: realtimeEventCreate },
              outboxEvent: { createMany: jest.fn() },
              chat: { update: jest.fn() },
            }),
          ),
        },
      } as any,
    );

    const result = await service.joinSession('user-guest', 'evening-session-live', {});

    expect(participantUpsert).toHaveBeenCalledWith({
      where: {
        sessionId_userId: {
          sessionId: 'evening-session-live',
          userId: 'user-guest',
        },
      },
      create: expect.objectContaining({
        sessionId: 'evening-session-live',
        userId: 'user-guest',
        status: 'joined',
      }),
      update: expect.objectContaining({
        status: 'joined',
      }),
    });
    expect(chatMemberUpsert).toHaveBeenCalledWith({
      where: {
        chatId_userId: {
          chatId: 'evening-chat-live',
          userId: 'user-guest',
        },
      },
      create: {
        chatId: 'evening-chat-live',
        userId: 'user-guest',
      },
      update: {},
    });
    expect(result).toMatchObject({
      status: 'joined',
      chatId: 'evening-chat-live',
      phase: 'live',
      currentStep: 2,
    });
    expect(realtimeEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'message.created',
        payload: expect.objectContaining({
          kind: 'system',
          senderName: 'Frendly',
          text: 'Марк присоединился · шаг 2/2',
        }),
      }),
    });
  });

  it('lets an existing joined guest reopen a full session without duplicate join message', async () => {
    const messageCreate = jest.fn();
    const chatMemberUpsert = jest.fn().mockResolvedValue({});
    const service = new EveningService(
      {
        client: {
          eveningSession: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'evening-session-live',
              routeId: 'r-cozy-circle',
              chatId: 'evening-chat-live',
              hostUserId: 'host-user',
              phase: 'live',
              privacy: 'open',
              capacity: 3,
              currentStep: 2,
              inviteToken: null,
              route: routeFixture(),
            }),
          },
          eveningSessionParticipant: {
            findUnique: jest.fn().mockResolvedValue({
              sessionId: 'evening-session-live',
              userId: 'user-guest',
              status: 'joined',
            }),
            count: jest.fn().mockResolvedValue(3),
          },
          chatMember: {
            upsert: chatMemberUpsert,
          },
          message: {
            create: messageCreate,
          },
        },
      } as any,
    );

    const result = await service.joinSession('user-guest', 'evening-session-live', {});

    expect(result).toMatchObject({
      status: 'joined',
      chatId: 'evening-chat-live',
      phase: 'live',
      currentStep: 2,
    });
    expect(chatMemberUpsert).toHaveBeenCalledWith({
      where: {
        chatId_userId: {
          chatId: 'evening-chat-live',
          userId: 'user-guest',
        },
      },
      create: {
        chatId: 'evening-chat-live',
        userId: 'user-guest',
      },
      update: {},
    });
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it('creates join request for request-only session', async () => {
    const requestUpsert = jest.fn().mockResolvedValue({
      id: 'request-1',
      status: 'requested',
    });
    const notificationCreate = jest.fn().mockResolvedValue({ id: 'notif-host' });
    const notificationFindUnique = jest.fn().mockResolvedValue(null);
    const outboxCreateMany = jest.fn();
    const service = new EveningService(
      {
        client: {
          $transaction: jest.fn((callback) =>
            callback({
              eveningSessionJoinRequest: {
                upsert: requestUpsert,
              },
              notification: {
                create: notificationCreate,
                findUnique: notificationFindUnique,
              },
              outboxEvent: {
                createMany: outboxCreateMany,
              },
            }),
          ),
          eveningSession: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'evening-session-request',
              chatId: 'evening-chat-request',
              hostUserId: 'host-user',
              privacy: 'request',
              capacity: 10,
              phase: 'scheduled',
              route: routeFixture(),
            }),
          },
          eveningSessionParticipant: {
            findUnique: jest.fn().mockResolvedValue(null),
            count: jest.fn().mockResolvedValue(4),
          },
        },
      } as any,
    );

    const result = await service.joinSession('user-guest', 'evening-session-request', {
      note: 'Хочу присоединиться',
    });

    expect(requestUpsert).toHaveBeenCalledWith({
      where: {
        sessionId_userId: {
          sessionId: 'evening-session-request',
          userId: 'user-guest',
        },
      },
      create: expect.objectContaining({
        sessionId: 'evening-session-request',
        userId: 'user-guest',
        status: 'requested',
        note: 'Хочу присоединиться',
      }),
      update: expect.objectContaining({
        status: 'requested',
        note: 'Хочу присоединиться',
      }),
    });
    expect(result).toMatchObject({
      status: 'requested',
      chatId: null,
    });
    expect(notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'host-user',
        actorUserId: 'user-guest',
        kind: 'event_joined',
        title: 'Новая заявка',
        body: 'Новая заявка на вечер «Теплый круг на Покровке»',
        chatId: 'evening-chat-request',
        requestId: 'request-1',
        dedupeKey: 'evening_join_request:evening-session-request:user-guest',
        payload: expect.objectContaining({
          sessionId: 'evening-session-request',
          requestId: 'request-1',
          status: 'requested',
          userId: 'user-guest',
        }),
      }),
    });
    expect(outboxCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          type: 'push.dispatch',
          payload: expect.objectContaining({
            userId: 'host-user',
            notificationId: 'notif-host',
          }),
        }),
        expect.objectContaining({
          type: 'notification.create',
          payload: expect.objectContaining({
            notificationId: 'notif-host',
          }),
        }),
      ]),
    });
  });

  it('requires matching invite token for invite-only session', async () => {
    const service = new EveningService(
      {
        client: {
          eveningSession: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'evening-session-invite',
              chatId: 'evening-chat-invite',
              privacy: 'invite',
              inviteToken: 'secret-token',
              capacity: 10,
              phase: 'scheduled',
              route: routeFixture(),
            }),
          },
          eveningSessionParticipant: {
            findUnique: jest.fn().mockResolvedValue(null),
            count: jest.fn().mockResolvedValue(2),
          },
        },
      } as any,
    );

    await expect(
      service.joinSession('user-guest', 'evening-session-invite', {
        inviteToken: 'wrong-token',
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'evening_invite_required',
    });
  });

  it('approves evening join request and adds guest to chat', async () => {
    const requestUpdate = jest.fn().mockResolvedValue({
      id: 'request-1',
      status: 'approved',
    });
    const participantUpsert = jest.fn().mockResolvedValue({});
    const chatMemberUpsert = jest.fn().mockResolvedValue({});
    const notificationCreate = jest.fn().mockResolvedValue({ id: 'notif-guest' });
    const notificationFindUnique = jest.fn().mockResolvedValue(null);
    const service = new EveningService(
      {
        client: {
          eveningSession: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'evening-session-request',
              chatId: 'evening-chat-request',
              hostUserId: 'host-user',
              capacity: 10,
              route: routeFixture(),
            }),
          },
          eveningSessionJoinRequest: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'request-1',
              sessionId: 'evening-session-request',
              userId: 'user-guest',
              status: 'requested',
              user: { displayName: 'Марк' },
            }),
          },
          eveningSessionParticipant: {
            count: jest.fn().mockResolvedValue(4),
          },
          $transaction: jest.fn((callback) =>
            callback({
              eveningSessionJoinRequest: { update: requestUpdate },
              eveningSessionParticipant: { upsert: participantUpsert },
              chatMember: { upsert: chatMemberUpsert },
              chat: { update: jest.fn() },
              message: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 'sys-approve' }),
              },
              notification: {
                create: notificationCreate,
                findUnique: notificationFindUnique,
              },
              realtimeEvent: { create: jest.fn().mockResolvedValue({ id: 12 }) },
              outboxEvent: { createMany: jest.fn() },
            }),
          ),
        },
      } as any,
    );

    const result = await service.approveJoinRequest(
      'host-user',
      'evening-session-request',
      'request-1',
    );

    expect(requestUpdate).toHaveBeenCalledWith({
      where: { id: 'request-1' },
      data: expect.objectContaining({
        status: 'approved',
        reviewedById: 'host-user',
      }),
    });
    expect(participantUpsert).toHaveBeenCalledWith({
      where: {
        sessionId_userId: {
          sessionId: 'evening-session-request',
          userId: 'user-guest',
        },
      },
      create: expect.objectContaining({
        role: 'guest',
        status: 'joined',
      }),
      update: expect.objectContaining({
        status: 'joined',
      }),
    });
    expect(chatMemberUpsert).toHaveBeenCalledWith({
      where: {
        chatId_userId: {
          chatId: 'evening-chat-request',
          userId: 'user-guest',
        },
      },
      create: {
        chatId: 'evening-chat-request',
        userId: 'user-guest',
      },
      update: {},
    });
    expect(result).toMatchObject({
      status: 'approved',
      chatId: 'evening-chat-request',
      userId: 'user-guest',
    });
    expect(notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-guest',
        actorUserId: 'host-user',
        kind: 'event_invite',
        title: 'Заявка принята',
        body: 'Ты в вечере «Теплый круг на Покровке»',
        chatId: 'evening-chat-request',
        requestId: 'request-1',
        dedupeKey:
          'evening_join_request_approved:evening-session-request:request-1',
        payload: expect.objectContaining({
          sessionId: 'evening-session-request',
          requestId: 'request-1',
          status: 'approved',
          chatId: 'evening-chat-request',
        }),
      }),
    });
  });

  it('rejects evening join request and notifies guest', async () => {
    const requestUpdate = jest.fn().mockResolvedValue({
      id: 'request-1',
      status: 'rejected',
    });
    const notificationCreate = jest.fn().mockResolvedValue({ id: 'notif-reject' });
    const notificationFindUnique = jest.fn().mockResolvedValue(null);
    const service = new EveningService(
      {
        client: {
          eveningSession: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'evening-session-request',
              routeId: 'r-cozy-circle',
              chatId: 'evening-chat-request',
              hostUserId: 'host-user',
              route: {
                title: 'Теплый круг на Покровке',
              },
            }),
          },
          eveningSessionJoinRequest: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'request-1',
              sessionId: 'evening-session-request',
              userId: 'user-guest',
              status: 'requested',
            }),
          },
          $transaction: jest.fn((callback) =>
            callback({
              eveningSessionJoinRequest: { update: requestUpdate },
              notification: {
                create: notificationCreate,
                findUnique: notificationFindUnique,
              },
              outboxEvent: { createMany: jest.fn() },
            }),
          ),
        },
      } as any,
    );

    const result = await service.rejectJoinRequest(
      'host-user',
      'evening-session-request',
      'request-1',
    );

    expect(requestUpdate).toHaveBeenCalledWith({
      where: { id: 'request-1' },
      data: expect.objectContaining({
        status: 'rejected',
        reviewedById: 'host-user',
      }),
    });
    expect(notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-guest',
        actorUserId: 'host-user',
        kind: 'event_invite',
        title: 'Заявка отклонена',
        body: 'Заявка на вечер «Теплый круг на Покровке» отклонена',
        requestId: 'request-1',
        dedupeKey:
          'evening_join_request_rejected:evening-session-request:request-1',
        payload: expect.objectContaining({
          sessionId: 'evening-session-request',
          requestId: 'request-1',
          status: 'rejected',
        }),
      }),
    });
    expect(result).toMatchObject({
      status: 'rejected',
      requestId: 'request-1',
      userId: 'user-guest',
    });
  });

  it('checks in a joined evening participant for the current step', async () => {
    const checkInUpsert = jest.fn().mockResolvedValue({
      id: 'checkin-1',
      checkedInAt: new Date('2026-04-26T20:35:00.000Z'),
    });
    const service = new EveningService(
      {
        client: {
          eveningSession: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'evening-session-live',
              routeId: 'r-cozy-circle',
              chatId: 'evening-chat-live',
              hostUserId: 'host-user',
              phase: 'live',
              currentStep: 2,
              route: routeFixture(),
            }),
          },
          eveningSessionParticipant: {
            findUnique: jest.fn().mockResolvedValue({
              userId: 'user-guest',
              status: 'joined',
            }),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue({ displayName: 'Марк' }),
          },
          $transaction: jest.fn((callback) =>
            callback({
              eveningStepCheckIn: { upsert: checkInUpsert },
              message: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 'sys-checkin' }),
              },
              realtimeEvent: { create: jest.fn().mockResolvedValue({ id: 13 }) },
              outboxEvent: { createMany: jest.fn() },
            }),
          ),
        },
      } as any,
    );

    const result = await service.checkInStep(
      'user-guest',
      'evening-session-live',
      's1-2',
    );

    expect(checkInUpsert).toHaveBeenCalledWith({
      where: {
        sessionId_stepId_userId: {
          sessionId: 'evening-session-live',
          stepId: 's1-2',
          userId: 'user-guest',
        },
      },
      create: expect.objectContaining({
        sessionId: 'evening-session-live',
        stepId: 's1-2',
        userId: 'user-guest',
      }),
      update: expect.any(Object),
    });
    expect(result).toMatchObject({
      sessionId: 'evening-session-live',
      stepId: 's1-2',
      checkedIn: true,
    });
  });

  it('advances a live evening session to the next step', async () => {
    const sessionUpdate = jest.fn().mockResolvedValue({});
    const chatUpdate = jest.fn().mockResolvedValue({});
    const stepStateUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const stepStateUpsert = jest.fn().mockResolvedValue({});
    const service = new EveningService(
      {
        client: {
          eveningSession: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'evening-session-live',
              routeId: 'r-cozy-circle',
              chatId: 'evening-chat-live',
              hostUserId: 'host-user',
              phase: 'live',
              currentStep: 1,
              route: routeFixture(),
            }),
          },
          $transaction: jest.fn((callback) =>
            callback({
              eveningSession: { update: sessionUpdate },
              chat: { update: chatUpdate },
              eveningSessionStepState: {
                updateMany: stepStateUpdateMany,
                upsert: stepStateUpsert,
              },
              message: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 'sys-advance' }),
              },
              realtimeEvent: { create: jest.fn().mockResolvedValue({ id: 14 }) },
              outboxEvent: { createMany: jest.fn() },
            }),
          ),
        },
      } as any,
    );

    const result = await service.advanceStep(
      'host-user',
      'evening-session-live',
      's1-1',
    );

    expect(sessionUpdate).toHaveBeenCalledWith({
      where: { id: 'evening-session-live' },
      data: { currentStep: 2 },
    });
    expect(chatUpdate).toHaveBeenCalledWith({
      where: { id: 'evening-chat-live' },
      data: { currentStep: 2 },
    });
    expect(result).toMatchObject({
      sessionId: 'evening-session-live',
      currentStep: 2,
      currentPlace: 'Standup Store',
    });
  });

  it('saves after-party feedback for a joined participant', async () => {
    const feedbackUpsert = jest.fn().mockResolvedValue({
      id: 'feedback-1',
      rating: 5,
      reaction: 'repeat',
      comment: 'Хочу еще',
    });
    const service = new EveningService(
      {
        client: {
          eveningSession: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'evening-session-done',
              phase: 'done',
              route: routeFixture(),
            }),
          },
          eveningSessionParticipant: {
            findUnique: jest.fn().mockResolvedValue({
              userId: 'user-guest',
              status: 'joined',
            }),
          },
          eveningAfterPartyFeedback: {
            upsert: feedbackUpsert,
          },
        },
      } as any,
    );

    const result = await service.saveAfterPartyFeedback(
      'user-guest',
      'evening-session-done',
      { rating: 5, reaction: 'repeat', comment: 'Хочу еще' },
    );

    expect(feedbackUpsert).toHaveBeenCalledWith({
      where: {
        sessionId_userId: {
          sessionId: 'evening-session-done',
          userId: 'user-guest',
        },
      },
      create: expect.objectContaining({
        rating: 5,
        reaction: 'repeat',
      }),
      update: expect.objectContaining({
        rating: 5,
        reaction: 'repeat',
      }),
    });
    expect(result).toMatchObject({
      sessionId: 'evening-session-done',
      feedbackId: 'feedback-1',
      rating: 5,
    });
  });

  it('launches an evening route by creating a meetup chat when missing', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValue(routeFixture({ chatId: null }));
    const chatCreate = jest.fn().mockResolvedValue({
      id: 'evening-chat-new',
    });
    const sessionCreate = jest.fn().mockResolvedValue({
      id: 'evening-session-new',
      chatId: 'evening-chat-new',
      privacy: 'open',
      capacity: 10,
      phase: 'scheduled',
      mode: 'hybrid',
    });
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
              eveningSession: {
                create: sessionCreate,
              },
              eveningSessionParticipant: {
                upsert: jest.fn(),
              },
              eveningSessionStepState: {
                createMany: jest.fn(),
              },
              chatMember: {
                upsert: chatMemberUpsert,
              },
              message: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 'sys-publish' }),
              },
              realtimeEvent: {
                create: jest.fn().mockResolvedValue({ id: 11 }),
              },
              outboxEvent: {
                createMany: jest.fn(),
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
        meetupPhase: 'soon',
        meetupMode: 'hybrid',
        currentStep: null,
      }),
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
    expect(result.sessionId).toBe('evening-session-new');
    expect(result.phase).toBe('scheduled');
  });

  it('keeps legacy route finish endpoint tied to route chat', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'r-cozy-circle',
      premium: false,
      chatId: 'evening-chat-r-cozy-circle',
    });
    const chatUpdate = jest.fn().mockResolvedValue({});
    const service = new EveningService(
      {
        client: {
          eveningRoute: {
            findUnique,
          },
          userSubscription: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          chat: {
            update: chatUpdate,
          },
        },
      } as any,
    );

    const result = await service.finishRoute('user-me', 'r-cozy-circle');

    expect(chatUpdate).toHaveBeenCalledWith({
      where: { id: 'evening-chat-r-cozy-circle' },
      data: expect.objectContaining({
        meetupPhase: 'done',
        currentStep: null,
      }),
    });
    expect(result.phase).toBe('done');
    expect(result.chatId).toBe('evening-chat-r-cozy-circle');
  });

  it('legacy launch route result keeps mode when old consumers call it', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValue(routeFixture({ chatId: null }));
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
              chat: { create: jest.fn().mockResolvedValue({ id: 'chat-1' }) },
              eveningSession: {
                create: jest.fn().mockResolvedValue({
                  id: 'session-1',
                  chatId: 'chat-1',
                  privacy: 'open',
                  capacity: 10,
                  phase: 'scheduled',
                  mode: 'manual',
                }),
              },
              eveningSessionParticipant: { upsert: jest.fn() },
              eveningSessionStepState: { createMany: jest.fn() },
              chatMember: { upsert: jest.fn() },
              message: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 'sys' }),
              },
              realtimeEvent: { create: jest.fn().mockResolvedValue({ id: 1 }) },
              outboxEvent: { createMany: jest.fn() },
            }),
          ),
        },
      } as any,
    );

    const result = await service.launchRoute('user-me', 'r-cozy-circle', {
      mode: 'manual',
    });

    expect(result.mode).toBe('manual');
  });
});
