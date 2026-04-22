jest.mock('@big-break/database', () => ({
  OUTBOX_EVENT_TYPES: {
    mediaFinalize: 'media.finalize',
    pushDispatch: 'push.dispatch',
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
  it('reclaims stale processing events and marks them done', async () => {
    const now = Date.now();
    const findFirst = jest.fn().mockResolvedValue({
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
    });
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
});
