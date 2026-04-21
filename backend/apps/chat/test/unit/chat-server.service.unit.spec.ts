jest.mock('@big-break/database', () => {
  const actual = jest.requireActual('@big-break/database');

  return {
    ...actual,
    createRedisPublisher: () => ({
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

describe('ChatServerService unit', () => {
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
});
