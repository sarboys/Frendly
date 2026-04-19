import WebSocket, { RawData } from 'ws';
import { signAccessToken } from '@big-break/database';

jest.setTimeout(30000);

describe('chat websocket auth', () => {
  it('opens websocket and receives auth event', async () => {
    const token = signAccessToken('user-me', 'realtime-test-session');
    const wsUrl = process.env.WS_URL ?? 'ws://127.0.0.1:3001';

    await expect(
      new Promise((resolve, reject) => {
        const socket = new WebSocket(wsUrl);
        socket.once('open', () => {
          socket.send(JSON.stringify({ type: 'session.authenticate', payload: { accessToken: token } }));
        });
        socket.once('message', (data: RawData) => {
          resolve(data.toString());
          socket.close();
        });
        socket.once('error', reject);
      }),
    ).resolves.toContain('session.authenticated');
  });

  it('subscribes, sends message and marks it as read', async () => {
    const token = signAccessToken('user-me', 'realtime-message-session');
    const wsUrl = process.env.WS_URL ?? 'ws://127.0.0.1:3001';
    const clientMessageId = `test-${Date.now()}`;

    await expect(
      new Promise((resolve, reject) => {
        const socket = new WebSocket(wsUrl);

        socket.once('open', () => {
          socket.send(JSON.stringify({ type: 'session.authenticate', payload: { accessToken: token } }));
        });

        socket.on('message', (data: RawData) => {
          const event = JSON.parse(data.toString()) as { type: string; payload: any };

          if (event.type === 'session.authenticated') {
            socket.send(JSON.stringify({ type: 'chat.subscribe', payload: { chatId: 'p1' } }));
            return;
          }

          if (event.type === 'chat.updated') {
            socket.send(
              JSON.stringify({
                type: 'message.send',
                payload: {
                  chatId: 'p1',
                  text: 'integration ws message',
                  clientMessageId,
                },
              }),
            );
            return;
          }

          if (event.type === 'message.created' && event.payload.clientMessageId === clientMessageId) {
            socket.send(
              JSON.stringify({
                type: 'message.read',
                payload: {
                  chatId: 'p1',
                  messageId: event.payload.id,
                },
              }),
            );
            return;
          }

          if (event.type === 'message.read' && event.payload.chatId === 'p1') {
            resolve(event.payload.messageId);
            socket.close();
          }
        });

        socket.once('error', reject);
      }),
    ).resolves.toEqual(expect.any(String));
  });
});
