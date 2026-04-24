jest.mock('@big-break/database', () => ({
  OUTBOX_EVENT_TYPES: {
    mediaFinalize: 'media.finalize',
    pushDispatch: 'push.dispatch',
    unreadFanout: 'unread.fanout',
    notificationCreate: 'notification.create',
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
});
