jest.mock('@big-break/database', () => ({
  OUTBOX_EVENT_TYPES: {
    mediaFinalize: 'media.finalize',
    pushDispatch: 'push.dispatch',
    unreadFanout: 'unread.fanout',
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
}));

import { WorkerService } from '../../src/worker.service';

describe('worker outbox recovery', () => {
  beforeEach(() => {
    jest.requireMock('@big-break/database').publishBusEvent.mockClear();
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
    const groupBy = jest.fn().mockResolvedValue([
      {
        userId: 'user-2',
        _count: {
          _all: 3,
        },
      },
    ]);

    const prismaService = {
      client: {
        outboxEvent: {
          findFirst,
          updateMany,
          update,
        },
        notification: {
          groupBy,
          findUnique: jest.fn(),
        },
        pushToken: {
          findMany: jest.fn(),
        },
      },
    } as any;
    const publishBusEvent = jest.requireMock('@big-break/database')
      .publishBusEvent as jest.Mock;

    const service = new WorkerService(prismaService);

    await service.runOnce();

    expect(groupBy).toHaveBeenCalledWith({
      by: ['userId'],
      where: {
        chatId: 'chat-1',
        kind: 'message',
        readAt: null,
        userId: {
          in: ['user-1', 'user-2'],
        },
      },
      _count: {
        _all: true,
      },
    });
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
    const groupBy = jest.fn().mockResolvedValue([]);

    const prismaService = {
      client: {
        outboxEvent: {
          findFirst,
          updateMany,
          update,
        },
        notification: {
          groupBy,
          findUnique: jest.fn(),
        },
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

  it('processes message notification fanout in bounded batches', async () => {
    const previousBatchSize = process.env.WORKER_MESSAGE_NOTIFICATION_BATCH_SIZE;
    process.env.WORKER_MESSAGE_NOTIFICATION_BATCH_SIZE = '2';
    const now = Date.now();
    const event = {
      id: 'evt-message-fanout',
      type: 'message.notification_fanout',
      payload: {
        chatId: 'chat-1',
        actorUserId: 'user-me',
        messageId: 'message-1',
        body: 'hello',
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
    const notificationCreateMany = jest.fn().mockResolvedValue({});
    const outboxCreateMany = jest.fn().mockResolvedValue({});
    const outboxCreate = jest.fn().mockResolvedValue({});
    const notificationGroupBy = jest.fn().mockResolvedValue([
      {
        userId: 'user-1',
        _count: {
          _all: 2,
        },
      },
    ]);

    const prismaService = {
      client: {
        outboxEvent: {
          findFirst,
          updateMany,
          update,
          create: outboxCreate,
          createMany: outboxCreateMany,
        },
        chatMember: {
          findMany,
        },
        notification: {
          createMany: notificationCreateMany,
          groupBy: notificationGroupBy,
          findUnique: jest.fn(),
        },
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
    expect(notificationCreateMany.mock.calls[0][0].data).toHaveLength(2);
    expect(outboxCreateMany.mock.calls[0][0].data).toHaveLength(2);
    expect(outboxCreate).toHaveBeenCalledWith({
      data: {
        type: 'message.notification_fanout',
        payload: {
          chatId: 'chat-1',
          actorUserId: 'user-me',
          messageId: 'message-1',
          body: 'hello',
          cursor: 'member-2',
        },
      },
    });
    expect(publishBusEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'notification.created',
        payload: expect.objectContaining({
          userId: 'user-1',
          payload: {
            chatId: 'chat-1',
            messageId: 'message-1',
          },
        }),
      }),
    );
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
});
