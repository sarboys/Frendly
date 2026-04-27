jest.mock('@big-break/database', () => ({
	  OUTBOX_EVENT_TYPES: {
	    mediaFinalize: 'media.finalize',
	    pushDispatch: 'push.dispatch',
	    unreadFanout: 'unread.fanout',
	    chatUnreadFanout: 'chat.unread_fanout',
	    messageNotificationFanout: 'message.notification_fanout',
	    notificationCreate: 'notification.create',
    realtimePublish: 'realtime.publish',
    attachmentReady: 'attachment.ready',
  },
  buildPublicAssetUrl: jest.fn((key: string) => `/media/${key}`),
  createRedisPublisher: jest.fn(() => ({
    quit: jest.fn().mockResolvedValue(undefined),
  })),
  createS3Client: jest.fn(() => ({
    send: jest.fn(),
  })),
  publishBusEvent: jest.fn(),
  runRetentionCleanup: jest.fn().mockResolvedValue({
    deletedByTask: new Map(),
    skippedRealtimeEvents: true,
  }),
}));

import { WorkerService } from '../../src/worker.service';

describe('worker outbox recovery', () => {
  beforeEach(() => {
    jest.requireMock('@big-break/database').publishBusEvent.mockClear();
  });

  afterEach(() => {
    delete process.env.WORKER_OUTBOX_BATCH_CLAIM;
    delete process.env.WORKER_OUTBOX_PROCESSING_CONCURRENCY;
    delete process.env.WORKER_RETENTION_CLEANUP_ENABLED;
    delete process.env.WORKER_RETENTION_CLEANUP_INTERVAL_MS;
  });

  it('runs startup scans through the safe scheduled runner', async () => {
    const service = new WorkerService({
      client: {},
    } as any);
    const runScheduledTask = jest
      .fn((_label: string, task: () => Promise<void>) => {
        void task();
      });
    (service as any).runScheduledTask = runScheduledTask;
    (service as any).runOnce = jest.fn().mockResolvedValue(undefined);
    (service as any).runSystemNotificationScan = jest.fn().mockResolvedValue(undefined);
    (service as any).runEveningAutoAdvanceScan = jest.fn().mockResolvedValue(undefined);

    service.start();

    expect(runScheduledTask).toHaveBeenCalledWith('outbox', expect.any(Function));
    expect(runScheduledTask).toHaveBeenCalledWith('system-notifications', expect.any(Function));
    expect(runScheduledTask).toHaveBeenCalledWith('evening-auto-advance', expect.any(Function));

    await service.onModuleDestroy();
  });

  it('logs scheduled task failures without rethrowing', async () => {
    const service = new WorkerService({
      client: {},
    } as any);
    const error = new Error('scan failed');
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      (service as any).runScheduledTask('outbox', async () => {
        throw error;
      }),
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith(
      '[worker] scheduled task failed: outbox',
      error,
    );
    consoleError.mockRestore();
    await service.onModuleDestroy();
  });

  it('starts retention cleanup timer only when enabled', async () => {
    process.env.WORKER_RETENTION_CLEANUP_ENABLED = 'true';
    process.env.WORKER_RETENTION_CLEANUP_INTERVAL_MS = '1000';
    const runRetentionCleanup = jest.requireMock('@big-break/database')
      .runRetentionCleanup as jest.Mock;
    runRetentionCleanup.mockClear();

    const service = new WorkerService({
      client: {},
    } as any);
    (service as any).runOnce = jest.fn();
    (service as any).runSystemNotificationScan = jest.fn();
    (service as any).runEveningAutoAdvanceScan = jest.fn();

    service.start();
    await Promise.resolve();

    expect(runRetentionCleanup).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        batchSize: 500,
      }),
    );

    await service.onModuleDestroy();
  });

  it('reclaims stale processing events and marks them done', async () => {
    const now = Date.now();
    const event = {
      id: 'evt-1',
      type: 'push.dispatch',
      payload: {
        userId: 'user-me',
        notificationId: 'n-1',
      },
      attempts: 2,
      status: 'processing',
      lockedAt: new Date(now - 120_000),
      createdAt: new Date(now - 180_000),
    };
    const findFirst = jest.fn()
      .mockResolvedValueOnce(event)
      .mockResolvedValueOnce(null);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue({});
    const findNotification = jest.fn().mockResolvedValue(null);
    const findPushTokens = jest.fn().mockResolvedValue([]);

    const prismaService = {
      client: {
        outboxEvent: {
          findFirst,
          updateMany,
          update,
        },
        notification: {
          findUnique: findNotification,
        },
        pushToken: {
          findMany: findPushTokens,
        },
      },
    } as any;

    const service = new WorkerService(prismaService);

    await service.runOnce();

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              status: 'processing',
            }),
          ]),
        }),
      }),
    );

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'evt-1',
          OR: expect.arrayContaining([
            expect.objectContaining({
              status: 'processing',
            }),
          ]),
        }),
      }),
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: expect.objectContaining({
        status: 'done',
        lockedAt: null,
      }),
    });
  });

  it('processes multiple available outbox events in one run', async () => {
    const now = Date.now();
    const firstEvent = {
      id: 'evt-1',
      type: 'push.dispatch',
      payload: {
        userId: 'user-me',
        notificationId: 'n-1',
      },
      attempts: 0,
      status: 'pending',
      lockedAt: null,
      createdAt: new Date(now - 180_000),
    };
    const secondEvent = {
      id: 'evt-2',
      type: 'push.dispatch',
      payload: {
        userId: 'user-me',
        notificationId: 'n-2',
      },
      attempts: 0,
      status: 'pending',
      lockedAt: null,
      createdAt: new Date(now - 120_000),
    };
    const findFirst = jest.fn()
      .mockResolvedValueOnce(firstEvent)
      .mockResolvedValueOnce(secondEvent)
      .mockResolvedValueOnce(null);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue({});
    const findNotification = jest.fn().mockResolvedValue(null);
    const findPushTokens = jest.fn().mockResolvedValue([]);

    const prismaService = {
      client: {
        outboxEvent: {
          findFirst,
          updateMany,
          update,
        },
        notification: {
          findUnique: findNotification,
        },
        pushToken: {
          findMany: findPushTokens,
        },
      },
    } as any;

    const service = new WorkerService(prismaService);

    await service.runOnce();

    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: 'evt-1' },
      data: expect.objectContaining({
        status: 'done',
      }),
    });
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: 'evt-2' },
      data: expect.objectContaining({
        status: 'done',
      }),
    });
  });

  it('claims available outbox events in a batch with skip locked SQL', async () => {
    process.env.WORKER_OUTBOX_BATCH_CLAIM = 'true';
    const events = [
      {
        id: 'evt-1',
        type: 'push.dispatch',
        payload: {
          userId: 'user-me',
          notificationId: 'n-1',
        },
        attempts: 1,
      },
      {
        id: 'evt-2',
        type: 'push.dispatch',
        payload: {
          userId: 'user-me',
          notificationId: 'n-2',
        },
        attempts: 1,
      },
    ];
    const queryRaw = jest.fn().mockResolvedValue(events);
    const update = jest.fn().mockResolvedValue({});
    const findNotification = jest.fn().mockResolvedValue(null);

    const prismaService = {
      client: {
        $queryRaw: queryRaw,
        outboxEvent: {
          update,
        },
        notification: {
          findUnique: findNotification,
        },
        pushToken: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as any;

    const service = new WorkerService(prismaService);

    await service.runOnce();

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(String(queryRaw.mock.calls[0][0])).toContain('SKIP LOCKED');
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: 'evt-1' },
      data: expect.objectContaining({
        status: 'done',
      }),
    });
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: 'evt-2' },
      data: expect.objectContaining({
        status: 'done',
      }),
    });
  });

  it('processes claimed outbox batch with bounded concurrency when enabled', async () => {
    process.env.WORKER_OUTBOX_BATCH_CLAIM = 'true';
    process.env.WORKER_OUTBOX_PROCESSING_CONCURRENCY = '2';
    const queryRaw = jest.fn().mockResolvedValue([
      { id: 'evt-1', type: 'push.dispatch', payload: {}, attempts: 1 },
      { id: 'evt-2', type: 'push.dispatch', payload: {}, attempts: 1 },
      { id: 'evt-3', type: 'push.dispatch', payload: {}, attempts: 1 },
    ]);

    const service = new WorkerService({
      client: {
        $queryRaw: queryRaw,
      },
    } as any);

    let active = 0;
    let maxActive = 0;
    (service as any).processEvent = jest.fn().mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
    });

    await service.runOnce();

    expect((service as any).processEvent).toHaveBeenCalledTimes(3);
    expect(maxActive).toBe(2);
  });

  it('auto-advances due Frendly Evening sessions and publishes chat update', async () => {
    const route = {
      id: 'r-cozy-circle',
      steps: [
        {
          id: 's1-1',
          timeLabel: '19:00',
          endTimeLabel: '20:15',
          venue: 'Brix Wine',
        },
        {
          id: 's1-2',
          timeLabel: '20:30',
          endTimeLabel: '22:00',
          venue: 'Standup Store',
        },
      ],
    };
    const session = {
      id: 'evening-session-auto',
      routeId: route.id,
      chatId: 'evening-chat-auto',
      hostUserId: 'host-user',
      phase: 'live',
      mode: 'auto',
      currentStep: 1,
      startedAt: new Date('2026-04-26T16:00:00.000Z'),
      route,
    };
    const findMany = jest.fn().mockResolvedValue([session]);
    const sessionUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const chatUpdate = jest.fn().mockResolvedValue({});
    const stepUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const stepUpsert = jest.fn().mockResolvedValue({});
    const outboxCreateMany = jest.fn().mockResolvedValue({ count: 1 });

    const prismaService = {
      client: {
        eveningSession: {
          findMany,
        },
        $transaction: jest.fn((callback) =>
          callback({
            eveningSession: { updateMany: sessionUpdateMany },
            chat: { update: chatUpdate },
            eveningSessionStepState: {
              updateMany: stepUpdateMany,
              upsert: stepUpsert,
            },
            message: {
              findUnique: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue({
                id: 'sys-auto-step',
                createdAt: new Date('2026-04-26T17:30:00.000Z'),
              }),
            },
            realtimeEvent: {
              create: jest.fn().mockResolvedValue({ id: 77 }),
            },
            outboxEvent: {
              createMany: outboxCreateMany,
            },
          }),
        ),
      },
    } as any;

    const service = new WorkerService(prismaService);
    await service.runEveningAutoAdvanceScan(
      new Date('2026-04-26T17:30:00.000Z'),
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          phase: 'live',
          mode: 'auto',
        }),
      }),
    );
    expect(sessionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'evening-session-auto',
        phase: 'live',
        mode: 'auto',
        currentStep: 1,
      },
      data: {
        currentStep: 2,
      },
    });
    expect(chatUpdate).toHaveBeenCalledWith({
      where: { id: 'evening-chat-auto' },
      data: {
        currentStep: 2,
      },
    });
    expect(stepUpdateMany).toHaveBeenCalledWith({
      where: {
        sessionId: 'evening-session-auto',
        stepId: {
          in: ['s1-1'],
        },
      },
      data: {
        status: 'done',
        finishedAt: new Date('2026-04-26T17:30:00.000Z'),
      },
    });
    expect(stepUpsert).toHaveBeenCalledWith({
      where: {
        sessionId_stepId: {
          sessionId: 'evening-session-auto',
          stepId: 's1-2',
        },
      },
      create: {
        sessionId: 'evening-session-auto',
        stepId: 's1-2',
        status: 'current',
        startedAt: new Date('2026-04-26T17:30:00.000Z'),
      },
      update: {
        status: 'current',
        startedAt: new Date('2026-04-26T17:30:00.000Z'),
        finishedAt: null,
        skippedAt: null,
      },
    });
    expect(outboxCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          type: 'realtime.publish',
          payload: expect.objectContaining({
            type: 'chat.updated',
            payload: expect.objectContaining({
              chatId: 'evening-chat-auto',
              sessionId: 'evening-session-auto',
              phase: 'live',
              currentStep: 2,
              currentPlace: 'Standup Store',
            }),
          }),
        }),
      ]),
    });
  });

  it('auto-finishes expired Frendly Evening sessions', async () => {
    const route = {
      id: 'r-cozy-circle',
      steps: [
        {
          id: 's1-1',
          timeLabel: '19:00',
          endTimeLabel: '20:15',
          venue: 'Brix Wine',
        },
        {
          id: 's1-2',
          timeLabel: '20:30',
          endTimeLabel: '22:00',
          venue: 'Standup Store',
        },
      ],
    };
    const session = {
      id: 'evening-session-auto',
      routeId: route.id,
      chatId: 'evening-chat-auto',
      hostUserId: 'host-user',
      phase: 'live',
      mode: 'auto',
      currentStep: 1,
      startedAt: new Date('2026-04-26T16:00:00.000Z'),
      route,
    };
    const sessionUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const chatUpdate = jest.fn().mockResolvedValue({});
    const stepUpdateMany = jest.fn().mockResolvedValue({ count: 2 });
    const outboxCreateMany = jest.fn().mockResolvedValue({ count: 1 });

    const prismaService = {
      client: {
        eveningSession: {
          findMany: jest.fn().mockResolvedValue([session]),
        },
        $transaction: jest.fn((callback) =>
          callback({
            eveningSession: { updateMany: sessionUpdateMany },
            chat: { update: chatUpdate },
            eveningSessionStepState: {
              updateMany: stepUpdateMany,
            },
            message: {
              findUnique: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue({
                id: 'sys-auto-finish',
                createdAt: new Date('2026-04-26T19:00:00.000Z'),
              }),
            },
            realtimeEvent: {
              create: jest.fn().mockResolvedValue({ id: 78 }),
            },
            outboxEvent: {
              createMany: outboxCreateMany,
            },
          }),
        ),
      },
    } as any;

    const service = new WorkerService(prismaService);
    await service.runEveningAutoAdvanceScan(
      new Date('2026-04-26T19:00:00.000Z'),
    );

    expect(sessionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'evening-session-auto',
        phase: 'live',
        mode: 'auto',
        currentStep: 1,
      },
      data: {
        phase: 'done',
        endedAt: new Date('2026-04-26T19:00:00.000Z'),
        currentStep: null,
      },
    });
    expect(chatUpdate).toHaveBeenCalledWith({
      where: { id: 'evening-chat-auto' },
      data: {
        meetupPhase: 'done',
        currentStep: null,
        meetupEndsAt: new Date('2026-04-26T19:00:00.000Z'),
      },
    });
    expect(stepUpdateMany).toHaveBeenCalledWith({
      where: {
        sessionId: 'evening-session-auto',
        stepId: {
          in: ['s1-1', 's1-2'],
        },
      },
      data: {
        status: 'done',
        finishedAt: new Date('2026-04-26T19:00:00.000Z'),
      },
    });
    expect(outboxCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          type: 'realtime.publish',
          payload: expect.objectContaining({
            type: 'chat.updated',
            payload: expect.objectContaining({
              chatId: 'evening-chat-auto',
              sessionId: 'evening-session-auto',
              phase: 'done',
              currentStep: null,
            }),
          }),
        }),
      ]),
    });
  });

  it('publishes unread fanout events from outbox payload', async () => {
    const now = Date.now();
    const event = {
      id: 'evt-unread',
      type: 'unread.fanout',
      payload: {
        chatId: 'chat-1',
        userIds: ['user-1', 'user-2'],
      },
      attempts: 0,
      status: 'pending',
      lockedAt: null,
      createdAt: new Date(now - 60_000),
    };
    const findFirst = jest.fn()
      .mockResolvedValueOnce(event)
      .mockResolvedValueOnce(null);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue({});
    const queryRaw = jest.fn().mockResolvedValue([
      {
        user_id: 'user-2',
        unread_count: BigInt(3),
      },
    ]);
    const executeRaw = jest.fn().mockResolvedValue(2);

    const prismaService = {
      client: {
        outboxEvent: {
          findFirst,
          updateMany,
          update,
        },
        notification: {
          findUnique: jest.fn(),
        },
        $queryRaw: queryRaw,
        $executeRaw: executeRaw,
        pushToken: {
          findMany: jest.fn(),
        },
      },
    } as any;
    const publishBusEvent = jest.requireMock('@big-break/database')
      .publishBusEvent as jest.Mock;

    const service = new WorkerService(prismaService);

    await service.runOnce();

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const unreadQuery = queryRaw.mock.calls[0][0] as any;
    const unreadSql = Array.isArray(unreadQuery)
      ? unreadQuery.join(' ')
      : unreadQuery.strings.join(' ');
    expect(unreadSql).toContain('"UserBlock"');
    expect(unreadSql).toContain('"blockedUserId"');
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(publishBusEvent).toHaveBeenCalledWith(
      expect.anything(),
      {
        type: 'unread.updated',
        payload: {
          userId: 'user-1',
          chatId: 'chat-1',
          unreadCount: 0,
        },
      },
    );
    expect(publishBusEvent).toHaveBeenCalledWith(
      expect.anything(),
      {
        type: 'unread.updated',
        payload: {
          userId: 'user-2',
          chatId: 'chat-1',
          unreadCount: 3,
        },
      },
    );
  });

  it('publishes unread fanout events with bounded parallelism', async () => {
    const previousConcurrency = process.env.WORKER_BUS_PUBLISH_CONCURRENCY;
    process.env.WORKER_BUS_PUBLISH_CONCURRENCY = '2';
    const now = Date.now();
    const event = {
      id: 'evt-unread-bounded',
      type: 'unread.fanout',
      payload: {
        chatId: 'chat-1',
        userIds: ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'],
      },
      attempts: 0,
      status: 'pending',
      lockedAt: null,
      createdAt: new Date(now - 60_000),
    };
    const findFirst = jest.fn()
      .mockResolvedValueOnce(event)
      .mockResolvedValueOnce(null);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue({});
    const queryRaw = jest.fn().mockResolvedValue([]);

    const prismaService = {
      client: {
        outboxEvent: {
          findFirst,
          updateMany,
          update,
        },
        notification: {
          findUnique: jest.fn(),
        },
        $queryRaw: queryRaw,
        pushToken: {
          findMany: jest.fn(),
        },
      },
    } as any;
    const publishBusEvent = jest.requireMock('@big-break/database')
      .publishBusEvent as jest.Mock;
    let activePublishes = 0;
    let maxActivePublishes = 0;
    publishBusEvent.mockImplementation(async () => {
      activePublishes += 1;
      maxActivePublishes = Math.max(maxActivePublishes, activePublishes);
      await new Promise((resolve) => setTimeout(resolve, 10));
      activePublishes -= 1;
    });

    const service = new WorkerService(prismaService);

    try {
      await service.runOnce();
      expect(publishBusEvent).toHaveBeenCalledTimes(5);
      expect(maxActivePublishes).toBe(2);
    } finally {
      publishBusEvent.mockReset();
      if (previousConcurrency == null) {
        delete process.env.WORKER_BUS_PUBLISH_CONCURRENCY;
      } else {
        process.env.WORKER_BUS_PUBLISH_CONCURRENCY = previousConcurrency;
      }
    }
  });

  it('publishes notification create events from outbox payload', async () => {
    const createdAt = new Date('2026-04-24T12:00:00.000Z');
    const event = {
      id: 'evt-notification',
      type: 'notification.create',
      payload: {
        notificationId: 'notification-1',
      },
      attempts: 0,
      status: 'pending',
      lockedAt: null,
      createdAt,
    };
    const findFirst = jest.fn()
      .mockResolvedValueOnce(event)
      .mockResolvedValueOnce(null);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue({});
    const findNotification = jest.fn().mockResolvedValue({
      id: 'notification-1',
      userId: 'user-sonya',
      kind: 'event_joined',
      title: 'Приглашение на встречу',
      body: 'приглашает тебя на встречу',
      payload: {
        eventId: 'event-1',
        invite: true,
      },
      readAt: null,
      createdAt,
    });

    const prismaService = {
      client: {
        outboxEvent: {
          findFirst,
          updateMany,
          update,
        },
        notification: {
          findUnique: findNotification,
        },
      },
    } as any;
    const publishBusEvent = jest.requireMock('@big-break/database')
      .publishBusEvent as jest.Mock;
    const service = new WorkerService(prismaService);

    await service.runOnce();

    expect(publishBusEvent).toHaveBeenCalledWith(
      expect.anything(),
      {
        type: 'notification.created',
        payload: {
          userId: 'user-sonya',
          notificationId: 'notification-1',
          kind: 'event_joined',
          title: 'Приглашение на встречу',
          body: 'приглашает тебя на встречу',
          payload: {
            eventId: 'event-1',
            invite: true,
          },
          createdAt: createdAt.toISOString(),
          readAt: null,
        },
      },
    );
  });

  it('skips realtime notification create events from blocked actors', async () => {
    const createdAt = new Date('2026-04-24T12:00:00.000Z');
    const event = {
      id: 'evt-notification-blocked',
      type: 'notification.create',
      payload: {
        notificationId: 'notification-1',
      },
      attempts: 0,
      status: 'pending',
      lockedAt: null,
      createdAt,
    };
    const findFirst = jest.fn()
      .mockResolvedValueOnce(event)
      .mockResolvedValueOnce(null);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue({});
    const findNotification = jest.fn().mockResolvedValue({
      id: 'notification-1',
      userId: 'user-sonya',
      actorUserId: 'blocked-actor',
      kind: 'event_joined',
      title: 'Приглашение на встречу',
      body: 'приглашает тебя на встречу',
      payload: {
        eventId: 'event-1',
      },
      readAt: null,
      createdAt,
    });
    const findBlock = jest.fn().mockResolvedValue({ id: 'block-1' });

    const prismaService = {
      client: {
        outboxEvent: {
          findFirst,
          updateMany,
          update,
        },
        notification: {
          findUnique: findNotification,
        },
        userBlock: {
          findFirst: findBlock,
        },
      },
    } as any;
    const publishBusEvent = jest.requireMock('@big-break/database')
      .publishBusEvent as jest.Mock;
    const service = new WorkerService(prismaService);

    await service.runOnce();

    expect(findBlock).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            userId: 'user-sonya',
            blockedUserId: 'blocked-actor',
          },
          {
            userId: 'blocked-actor',
            blockedUserId: 'user-sonya',
          },
        ],
      },
      select: {
        id: true,
      },
    });
    expect(publishBusEvent).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'notification.created',
      }),
    );
  });

  it('publishes realtime bus events from outbox payload', async () => {
    const event = {
      id: 'evt-realtime',
      type: 'realtime.publish',
      payload: {
        type: 'message.created',
        payload: {
          chatId: 'chat-1',
          messageId: 'message-1',
        },
      },
      attempts: 0,
      status: 'pending',
      lockedAt: null,
      createdAt: new Date(),
    };
    const findFirst = jest.fn()
      .mockResolvedValueOnce(event)
      .mockResolvedValueOnce(null);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue({});

    const prismaService = {
      client: {
        outboxEvent: {
          findFirst,
          updateMany,
          update,
        },
      },
    } as any;
    const publishBusEvent = jest.requireMock('@big-break/database')
      .publishBusEvent as jest.Mock;
    const service = new WorkerService(prismaService);

    await service.runOnce();

    expect(publishBusEvent).toHaveBeenCalledWith(
      expect.anything(),
      {
        type: 'message.created',
        payload: {
          chatId: 'chat-1',
          messageId: 'message-1',
        },
      },
    );
  });

  it('processes chat unread fanout in bounded batches without message notifications', async () => {
    const previousBatchSize = process.env.WORKER_MESSAGE_NOTIFICATION_BATCH_SIZE;
    process.env.WORKER_MESSAGE_NOTIFICATION_BATCH_SIZE = '2';
    const now = Date.now();
    const event = {
      id: 'evt-message-fanout',
      type: 'chat.unread_fanout',
      payload: {
        chatId: 'chat-1',
        actorUserId: 'user-me',
      },
      attempts: 0,
      status: 'pending',
      lockedAt: null,
      createdAt: new Date(now - 60_000),
    };
    const findFirst = jest.fn()
      .mockResolvedValueOnce(event)
      .mockResolvedValueOnce(null);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue({});
    const findMany = jest.fn().mockResolvedValue([
      { id: 'member-1', userId: 'user-1' },
      { id: 'member-2', userId: 'user-2' },
      { id: 'member-3', userId: 'user-3' },
    ]);
    const outboxCreate = jest.fn().mockResolvedValue({});
    const queryRaw = jest.fn().mockResolvedValue([
      {
        user_id: 'user-1',
        unread_count: BigInt(2),
      },
    ]);

    const prismaService = {
      client: {
        outboxEvent: {
          findFirst,
          updateMany,
          update,
          create: outboxCreate,
        },
        chatMember: {
          findMany,
        },
        notification: {
          findUnique: jest.fn(),
        },
        $queryRaw: queryRaw,
        pushToken: {
          findMany: jest.fn(),
        },
      },
    } as any;
    const publishBusEvent = jest.requireMock('@big-break/database')
      .publishBusEvent as jest.Mock;
    const service = new WorkerService(prismaService);

    try {
      await service.runOnce();
    } finally {
      if (previousBatchSize == null) {
        delete process.env.WORKER_MESSAGE_NOTIFICATION_BATCH_SIZE;
      } else {
        process.env.WORKER_MESSAGE_NOTIFICATION_BATCH_SIZE = previousBatchSize;
      }
    }

    expect(findMany).toHaveBeenCalledWith({
      where: {
        chatId: 'chat-1',
        userId: {
          not: 'user-me',
        },
      },
      select: {
        id: true,
        userId: true,
      },
      orderBy: { id: 'asc' },
      take: 3,
    });
    expect(outboxCreate).toHaveBeenCalledWith({
      data: {
        type: 'chat.unread_fanout',
        payload: {
          chatId: 'chat-1',
          actorUserId: 'user-me',
          cursor: 'member-2',
        },
      },
    });
    expect(publishBusEvent).toHaveBeenCalledWith(
      expect.anything(),
      {
        type: 'unread.updated',
        payload: {
          userId: 'user-1',
          chatId: 'chat-1',
          unreadCount: 2,
        },
      },
    );
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('sends push notifications with bounded parallelism', async () => {
    const previousConcurrency = process.env.WORKER_PUSH_CONCURRENCY;
    process.env.WORKER_PUSH_CONCURRENCY = '2';
    const now = Date.now();
    const event = {
      id: 'evt-push',
      type: 'push.dispatch',
      payload: {
        userId: 'user-me',
        notificationId: 'n-1',
      },
      attempts: 0,
      status: 'pending',
      lockedAt: null,
      createdAt: new Date(now - 60_000),
    };
    const findFirst = jest.fn()
      .mockResolvedValueOnce(event)
      .mockResolvedValueOnce(null);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue({});
    const findNotification = jest.fn().mockResolvedValue({
      id: 'n-1',
      userId: 'user-me',
      title: 'Title',
      body: 'Body',
    });
    const findPushTokens = jest.fn().mockResolvedValue(
      Array.from({ length: 5 }, (_, index) => ({
        provider: 'fcm',
        token: `token-${index}`,
      })),
    );
    const findSettings = jest.fn().mockResolvedValue({
      allowPush: true,
      quietHours: false,
    });
    let activeSends = 0;
    let maxActiveSends = 0;
    const send = jest.fn().mockImplementation(async () => {
      activeSends += 1;
      maxActiveSends = Math.max(maxActiveSends, activeSends);
      await new Promise((resolve) => setTimeout(resolve, 10));
      activeSends -= 1;
    });

    const prismaService = {
      client: {
        outboxEvent: {
          findFirst,
          updateMany,
          update,
        },
        notification: {
          findUnique: findNotification,
        },
        pushToken: {
          findMany: findPushTokens,
        },
        userSettings: {
          findUnique: findSettings,
        },
      },
    } as any;
    const service = new WorkerService(prismaService);
    (service as any).resolveProvider = () => ({ send });

    try {
      await service.runOnce();
    } finally {
      if (previousConcurrency == null) {
        delete process.env.WORKER_PUSH_CONCURRENCY;
      } else {
        process.env.WORKER_PUSH_CONCURRENCY = previousConcurrency;
      }
    }

    expect(send).toHaveBeenCalledTimes(5);
    expect(maxActiveSends).toBe(2);
  });

  it('uses notification owner for push dispatch instead of payload user id', async () => {
    const now = Date.now();
    const event = {
      id: 'evt-push-owner',
      type: 'push.dispatch',
      payload: {
        userId: 'wrong-user',
        notificationId: 'n-1',
      },
      attempts: 0,
      status: 'pending',
      lockedAt: null,
      createdAt: new Date(now - 60_000),
    };
    const findFirst = jest.fn()
      .mockResolvedValueOnce(event)
      .mockResolvedValueOnce(null);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue({});
    const findNotification = jest.fn().mockResolvedValue({
      id: 'n-1',
      userId: 'owner-user',
      title: 'Title',
      body: 'Body',
    });
    const findPushTokens = jest.fn().mockResolvedValue([
      {
        provider: 'fcm',
        token: 'token-1',
      },
    ]);
    const findSettings = jest.fn().mockResolvedValue({
      allowPush: true,
      quietHours: false,
    });
    const send = jest.fn();

    const prismaService = {
      client: {
        outboxEvent: {
          findFirst,
          updateMany,
          update,
        },
        notification: {
          findUnique: findNotification,
        },
        pushToken: {
          findMany: findPushTokens,
        },
        userSettings: {
          findUnique: findSettings,
        },
      },
    } as any;
    const service = new WorkerService(prismaService);
    (service as any).resolveProvider = () => ({ send });

    await service.runOnce();

    expect(findSettings).toHaveBeenCalledWith({
      where: { userId: 'owner-user' },
      select: {
        allowPush: true,
        quietHours: true,
      },
    });
    expect(findPushTokens).toHaveBeenCalledWith({
      where: {
        userId: 'owner-user',
        disabledAt: null,
      },
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('skips push dispatch for notifications from blocked actors', async () => {
    const now = Date.now();
    const event = {
      id: 'evt-push-blocked',
      type: 'push.dispatch',
      payload: {
        userId: 'user-me',
        notificationId: 'n-1',
      },
      attempts: 0,
      status: 'pending',
      lockedAt: null,
      createdAt: new Date(now - 60_000),
    };
    const findFirst = jest.fn()
      .mockResolvedValueOnce(event)
      .mockResolvedValueOnce(null);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue({});
    const findNotification = jest.fn().mockResolvedValue({
      id: 'n-1',
      userId: 'user-me',
      actorUserId: 'blocked-actor',
      title: 'Title',
      body: 'Body',
    });
    const findPushTokens = jest.fn().mockResolvedValue([
      {
        provider: 'fcm',
        token: 'token-1',
      },
    ]);
    const findSettings = jest.fn().mockResolvedValue({
      allowPush: true,
      quietHours: false,
    });
    const findBlock = jest.fn().mockResolvedValue({ id: 'block-1' });
    const send = jest.fn();

    const prismaService = {
      client: {
        outboxEvent: {
          findFirst,
          updateMany,
          update,
        },
        notification: {
          findUnique: findNotification,
        },
        pushToken: {
          findMany: findPushTokens,
        },
        userSettings: {
          findUnique: findSettings,
        },
        userBlock: {
          findFirst: findBlock,
        },
      },
    } as any;
    const service = new WorkerService(prismaService);
    (service as any).resolveProvider = () => ({ send });

    await service.runOnce();

    expect(findBlock).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            userId: 'user-me',
            blockedUserId: 'blocked-actor',
          },
          {
            userId: 'blocked-actor',
            blockedUserId: 'user-me',
          },
        ],
      },
      select: {
        id: true,
      },
    });
    expect(findPushTokens).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('skips push dispatch when user disabled push or quiet hours are on', async () => {
    const now = Date.now();
    const event = {
      id: 'evt-push-disabled',
      type: 'push.dispatch',
      payload: {
        userId: 'user-me',
        notificationId: 'n-1',
      },
      attempts: 0,
      status: 'pending',
      lockedAt: null,
      createdAt: new Date(now - 60_000),
    };
    const findFirst = jest.fn()
      .mockResolvedValueOnce(event)
      .mockResolvedValueOnce(null);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue({});
    const findNotification = jest.fn().mockResolvedValue({
      id: 'n-1',
      userId: 'user-me',
      title: 'Title',
      body: 'Body',
    });
    const findPushTokens = jest.fn().mockResolvedValue([
      {
        provider: 'fcm',
        token: 'token-1',
      },
    ]);
    const findSettings = jest.fn().mockResolvedValue({
      allowPush: false,
      quietHours: false,
    });
    const send = jest.fn();

    const prismaService = {
      client: {
        outboxEvent: {
          findFirst,
          updateMany,
          update,
        },
        notification: {
          findUnique: findNotification,
        },
        pushToken: {
          findMany: findPushTokens,
        },
        userSettings: {
          findUnique: findSettings,
        },
      },
    } as any;
    const service = new WorkerService(prismaService);
    (service as any).resolveProvider = () => ({ send });

    await service.runOnce();

    expect(findSettings).toHaveBeenCalledWith({
      where: { userId: 'user-me' },
      select: {
        allowPush: true,
        quietHours: true,
      },
    });
    expect(findPushTokens).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('creates event starting system notifications with push and realtime outbox', async () => {
    const startsAt = new Date('2026-04-25T18:00:00.000Z');
    const queryRaw = jest.fn()
      .mockResolvedValueOnce([
        {
          user_id: 'user-1',
          event_id: 'event-1',
          event_title: 'Ужин на Патриках',
          starts_at: startsAt,
          dedupe_key: 'event_starting:event-1:user-1:30m',
        },
      ])
      .mockResolvedValueOnce([]);
    const notificationCreate = jest.fn().mockResolvedValue({
      id: 'notification-event',
      userId: 'user-1',
    });
    const outboxCreateMany = jest.fn().mockResolvedValue({});
    const prismaService = {
      client: {
        $queryRaw: queryRaw,
        notification: {
          create: notificationCreate,
        },
        outboxEvent: {
          createMany: outboxCreateMany,
        },
      },
    } as any;
    const service = new WorkerService(prismaService);

    await (service as any).runSystemNotificationScan();

    expect(notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        kind: 'event_starting',
        title: 'Встреча скоро начнется',
        eventId: 'event-1',
        dedupeKey: 'event_starting:event-1:user-1:30m',
      }),
    });
    expect(outboxCreateMany).toHaveBeenCalledWith({
      data: [
        {
          type: 'push.dispatch',
          payload: {
            userId: 'user-1',
            notificationId: 'notification-event',
          },
        },
        {
          type: 'notification.create',
          payload: {
            notificationId: 'notification-event',
          },
        },
      ],
    });
  });

  it('creates subscription expiring system notifications with push and realtime outbox', async () => {
    const endsAt = new Date('2026-04-27T18:00:00.000Z');
    const queryRaw = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          user_id: 'user-1',
          subscription_id: 'subscription-1',
          plan: 'month',
          status: 'active',
          ends_at: endsAt,
          dedupe_key: 'subscription_expiring:subscription-1:3d',
        },
      ]);
    const notificationCreate = jest.fn().mockResolvedValue({
      id: 'notification-subscription',
      userId: 'user-1',
    });
    const outboxCreateMany = jest.fn().mockResolvedValue({});
    const prismaService = {
      client: {
        $queryRaw: queryRaw,
        notification: {
          create: notificationCreate,
        },
        outboxEvent: {
          createMany: outboxCreateMany,
        },
      },
    } as any;
    const service = new WorkerService(prismaService);

    await (service as any).runSystemNotificationScan();

    expect(notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        kind: 'subscription_expiring',
        title: 'Подписка скоро закончится',
        dedupeKey: 'subscription_expiring:subscription-1:3d',
      }),
    });
    expect(outboxCreateMany).toHaveBeenCalledWith({
      data: [
        {
          type: 'push.dispatch',
          payload: {
            userId: 'user-1',
            notificationId: 'notification-subscription',
          },
        },
        {
          type: 'notification.create',
          payload: {
            notificationId: 'notification-subscription',
          },
        },
      ],
    });
  });
});
