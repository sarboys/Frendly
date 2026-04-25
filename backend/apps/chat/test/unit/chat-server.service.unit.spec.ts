const mockRedisPublish = jest.fn().mockResolvedValue(1);

jest.mock('@big-break/database', () => {
  const actual = jest.requireActual('@big-break/database');

  return {
    ...actual,
    createRedisPublisher: () => ({
      publish: mockRedisPublish,
      quit: jest.fn().mockResolvedValue(undefined),
    }),
    createRedisSubscriber: () => ({
      subscribe: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
    }),
  };
});

import { WebSocket } from 'ws';
import { ChatServerService } from '../../src/chat-server.service';

function createChatServiceForBroadcast() {
  return new ChatServerService({
    client: {
      userBlock: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    },
  } as any);
}

function createOpenSocket(options: { bufferedAmount?: number } = {}) {
  return {
    readyState: WebSocket.OPEN,
    bufferedAmount: options.bufferedAmount ?? 0,
    send: jest.fn(),
  };
}

describe('ChatServerService unit', () => {
  beforeEach(() => {
    mockRedisPublish.mockClear();
  });

  it('limits sync snapshots and returns a continuation cursor', async () => {
    const socket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
    };
    const events = Array.from({ length: 151 }, (_, index) => ({
      id: BigInt(index + 1),
      eventType: 'message.created',
      payload: { chatId: 'chat-1', senderId: 'user-peer' },
      createdAt: new Date('2026-04-24T00:00:00.000Z'),
    }));
    const service = new ChatServerService({
      client: {
        chatMember: {
          findFirst: jest.fn().mockResolvedValue({
            chat: {
              kind: 'direct',
              members: [{ userId: 'user-me' }, { userId: 'user-peer' }],
            },
          }),
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        realtimeEvent: {
          findMany: jest.fn().mockResolvedValue(events),
        },
      },
    } as any);

    (service as any).stateBySocket.set(socket, {
      userId: 'user-me',
      subscriptions: new Set(['chat-1']),
    });

    await (service as any).sync(socket, { chatId: 'chat-1' });

    const sent = JSON.parse(socket.send.mock.calls[0][0]);
    expect(sent).toMatchObject({
      type: 'sync.snapshot',
      payload: {
        chatId: 'chat-1',
        hasMore: true,
        nextEventId: '100',
      },
    });
    expect(sent.payload.events).toHaveLength(100);
  });

  it('broadcasts message event with one blocked-user lookup per actor', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        userId: 'user-actor',
        blockedUserId: 'user-blocked',
      },
    ]);
    const findFirst = jest.fn();

    const service = new ChatServerService({
      client: {
        userBlock: {
          findMany,
          findFirst,
        },
      },
    } as any);

    const openSocket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
    };
    const blockedSocket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
    };
    const unsubscribedSocket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
    };

    (service as any).stateBySocket.set(openSocket, {
      userId: 'user-open',
      subscriptions: new Set(['chat-1']),
    });
    (service as any).stateBySocket.set(blockedSocket, {
      userId: 'user-blocked',
      subscriptions: new Set(['chat-1']),
    });
    (service as any).stateBySocket.set(unsubscribedSocket, {
      userId: 'user-other',
      subscriptions: new Set(['chat-2']),
    });
    (service as any).socketsByChatId.set('chat-1', new Set([openSocket, blockedSocket]));

    await (service as any).broadcastEvent({
      type: 'message.created',
      payload: {
        chatId: 'chat-1',
        senderId: 'user-actor',
      },
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findFirst).not.toHaveBeenCalled();
    expect(openSocket.send).toHaveBeenCalledTimes(1);
    expect(blockedSocket.send).not.toHaveBeenCalled();
    expect(unsubscribedSocket.send).not.toHaveBeenCalled();
  });

  it('broadcasts chat events only to sockets indexed by chat id', async () => {
    const service = createChatServiceForBroadcast();
    const subscribedSocket = createOpenSocket();
    const unrelatedSocket = createOpenSocket();

    (service as any).stateBySocket.set(subscribedSocket, {
      userId: 'user-1',
      subscriptions: new Set(['chat-1']),
    });
    (service as any).stateBySocket.set(unrelatedSocket, {
      userId: 'user-2',
      subscriptions: new Set(['chat-2']),
    });
    (service as any).socketsByChatId.set('chat-1', new Set([subscribedSocket]));

    await (service as any).broadcastEvent({
      type: 'message.created',
      payload: {
        chatId: 'chat-1',
        senderId: 'user-actor',
      },
    });

    expect(subscribedSocket.send).toHaveBeenCalledTimes(1);
    expect(unrelatedSocket.send).not.toHaveBeenCalled();
  });

  it('broadcasts notification events only to sockets indexed by user id', async () => {
    const service = createChatServiceForBroadcast();
    const recipientSocket = createOpenSocket();
    const unrelatedSocket = createOpenSocket();

    (service as any).stateBySocket.set(recipientSocket, {
      userId: 'user-1',
      subscriptions: new Set(),
    });
    (service as any).stateBySocket.set(unrelatedSocket, {
      userId: 'user-2',
      subscriptions: new Set(),
    });
    (service as any).socketsByUserId.set('user-1', new Set([recipientSocket]));

    await (service as any).broadcastEvent({
      type: 'notification.created',
      payload: {
        userId: 'user-1',
      },
    });

    expect(recipientSocket.send).toHaveBeenCalledTimes(1);
    expect(unrelatedSocket.send).not.toHaveBeenCalled();
  });

  it('skips sockets with too much buffered websocket data', async () => {
    const service = createChatServiceForBroadcast();
    const slowSocket = createOpenSocket({ bufferedAmount: 2_000_000 });

    (service as any).stateBySocket.set(slowSocket, {
      userId: 'user-1',
      subscriptions: new Set(['chat-1']),
    });
    (service as any).socketsByChatId.set('chat-1', new Set([slowSocket]));

    await (service as any).broadcastEvent({
      type: 'message.created',
      payload: {
        chatId: 'chat-1',
      },
    });

    expect(slowSocket.send).not.toHaveBeenCalled();
  });

  it('throttles repeated typing events before another membership lookup', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      chat: {
        kind: 'direct',
        members: [{ userId: 'user-me' }, { userId: 'user-peer' }],
      },
    });
    const service = new ChatServerService({
      client: {
        chatMember: {
          findFirst,
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as any);
    const socket = createOpenSocket();

    (service as any).stateBySocket.set(socket, {
      userId: 'user-me',
      subscriptions: new Set(['chat-1']),
    });

    await (service as any).publishTyping(socket, 'chat-1', true);
    await (service as any).publishTyping(socket, 'chat-1', true);

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(mockRedisPublish).toHaveBeenCalledTimes(1);
  });

  it('queues chat unread fanout outside the websocket send transaction',
    async () => {
      const socket = createOpenSocket();
      const txOutboxCreate = jest.fn().mockResolvedValue({});
      const txOutboxCreateMany = jest.fn().mockResolvedValue({});
      const txNotificationCreateMany = jest.fn().mockResolvedValue({});
      const txChatMemberFindMany = jest.fn().mockResolvedValue(
        Array.from({ length: 50 }, (_, index) => ({
          userId: `user-${index}`,
        })),
      );
      const service = new ChatServerService({
        client: {
          chatMember: {
            findFirst: jest.fn().mockResolvedValue({
              chat: {
                kind: 'community',
                members: [],
              },
            }),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          message: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          mediaAsset: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          $transaction: jest.fn(async (callback) =>
            callback({
              message: {
                create: jest.fn().mockResolvedValue({
                  id: 'message-1',
                  chatId: 'community-chat',
                  senderId: 'user-me',
                  text: 'hello',
                  clientMessageId: 'client-1',
                  createdAt: new Date('2026-04-24T00:00:00.000Z'),
                  sender: { displayName: 'Никита' },
                  replyTo: null,
                  attachments: [],
                }),
              },
              chat: {
                update: jest.fn().mockResolvedValue({}),
              },
              realtimeEvent: {
                create: jest.fn().mockResolvedValue({ id: BigInt(10) }),
              },
              chatMember: {
                findMany: txChatMemberFindMany,
              },
              notification: {
                createMany: txNotificationCreateMany,
              },
              outboxEvent: {
                create: txOutboxCreate,
                createMany: txOutboxCreateMany,
              },
            }),
          ),
        },
      } as any);

      (service as any).stateBySocket.set(socket, {
        userId: 'user-me',
        subscriptions: new Set(['community-chat']),
      });

      await (service as any).sendMessage(socket, {
        chatId: 'community-chat',
        text: 'hello',
        clientMessageId: 'client-1',
      });

      expect(txChatMemberFindMany).not.toHaveBeenCalled();
      expect(txNotificationCreateMany).not.toHaveBeenCalled();
      expect(txOutboxCreateMany).not.toHaveBeenCalled();
      expect(txOutboxCreate).toHaveBeenCalledWith({
        data: {
          type: 'chat.unread_fanout',
          payload: {
            chatId: 'community-chat',
            actorUserId: 'user-me',
          },
        },
      });
    });

  it('adds direct download resolver path to mapped attachments', () => {
    const service = createChatServiceForBroadcast();
    const mapped = (service as any).mapMessage({
      id: 'message-1',
      chatId: 'chat-1',
      senderId: 'user-1',
      text: '',
      clientMessageId: 'client-1',
      createdAt: new Date('2026-04-24T00:00:00.000Z'),
      sender: {
        displayName: 'User',
      },
      replyTo: null,
      attachments: [
        {
          mediaAsset: {
            id: 'asset-1',
            kind: 'chat_voice',
            status: 'ready',
            publicUrl: null,
            mimeType: 'audio/webm',
            byteSize: 1024,
            durationMs: 5000,
            waveform: [0.2, 0.8],
            originalFileName: 'voice.webm',
            objectKey: 'chat-attachments/user-1/voice.webm',
          },
        },
      ],
    });

    expect(mapped.attachments[0]).toMatchObject({
      id: 'asset-1',
      url: '/media/asset-1',
      downloadUrlPath: '/media/asset-1/download-url',
    });
  });
});
