import { PrismaClient } from '@prisma/client';
import WebSocket, { RawData } from 'ws';
import { randomUUID } from 'node:crypto';
import { buildPublicAssetUrl, signAccessToken } from '@big-break/database';

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/big_break';

jest.setTimeout(30000);

describe('chat websocket auth', () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const wsUrl = process.env.WS_URL ?? 'ws://127.0.0.1:3001';

  const createSessionToken = async (userId: string, options?: { revokedAt?: Date | null }) => {
    const sessionId = `realtime-${randomUUID()}`;

    await prisma.session.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenId: randomUUID(),
        revokedAt: options?.revokedAt ?? null,
      },
    });

    return signAccessToken(userId, sessionId);
  };

  it('opens websocket and receives auth event for active session', async () => {
    const token = await createSessionToken('user-me');

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

  it('rejects stale access token during websocket auth', async () => {
    const token = signAccessToken('user-me', `missing-session-${Date.now()}`);

    await expect(
      new Promise((resolve, reject) => {
        const socket = new WebSocket(wsUrl);
        socket.once('open', () => {
          socket.send(JSON.stringify({ type: 'session.authenticate', payload: { accessToken: token } }));
        });
        socket.once('message', (data: RawData) => {
          resolve(JSON.parse(data.toString()) as { type: string; payload: { code: string; message: string } });
          socket.close();
        });
        socket.once('error', reject);
      }),
    ).resolves.toMatchObject({
      type: 'error',
      payload: {
        code: 'stale_access_token',
      },
    });
  });

  it('subscribes, sends message with attachment metadata and marks it as read', async () => {
    const token = await createSessionToken('user-me');
    const clientMessageId = `test-${Date.now()}`;
    const attachmentId = `asset-${randomUUID()}`;
    const objectKey = `chat-attachments/user-me/${attachmentId}-note.pdf`;

    await prisma.mediaAsset.create({
      data: {
        id: attachmentId,
        ownerId: 'user-me',
        kind: 'chat_attachment',
        status: 'ready',
        bucket: process.env.S3_BUCKET ?? 'big-break',
        objectKey,
        mimeType: 'application/pdf',
        byteSize: 128,
        originalFileName: 'note.pdf',
        publicUrl: buildPublicAssetUrl(objectKey),
        chatId: 'p1',
      },
    });

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
                  text: 'integration ws message with attachment',
                  clientMessageId,
                  attachmentIds: [attachmentId],
                },
              }),
            );
            return;
          }

          if (event.type === 'message.created' && event.payload.clientMessageId === clientMessageId) {
            expect(event.payload.attachments).toHaveLength(1);
            expect(event.payload.attachments[0]).toMatchObject({
              id: attachmentId,
              kind: 'chat_attachment',
              status: 'ready',
              mimeType: 'application/pdf',
              byteSize: 128,
              fileName: 'note.pdf',
            });

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

  it('rejects sending attachment linked to another chat', async () => {
    const token = await createSessionToken('user-me');
    const attachmentId = `asset-${randomUUID()}`;
    const objectKey = `chat-attachments/user-me/${attachmentId}-note.pdf`;

    await prisma.mediaAsset.create({
      data: {
        id: attachmentId,
        ownerId: 'user-me',
        kind: 'chat_attachment',
        status: 'ready',
        bucket: process.env.S3_BUCKET ?? 'big-break',
        objectKey,
        mimeType: 'application/pdf',
        byteSize: 96,
        originalFileName: 'note.pdf',
        publicUrl: buildPublicAssetUrl(objectKey),
        chatId: 'p3',
      },
    });

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
                  text: 'wrong attachment chat',
                  clientMessageId: `bad-${Date.now()}`,
                  attachmentIds: [attachmentId],
                },
              }),
            );
            return;
          }

          if (event.type === 'error') {
            resolve(event);
            socket.close();
          }
        });

        socket.once('error', reject);
      }),
    ).resolves.toMatchObject({
      type: 'error',
      payload: {
        code: 'attachment_chat_mismatch',
      },
    });
  });

  it('marks related message notification as read on websocket message.read', async () => {
    await prisma.notification.update({
      where: { id: 'n1' },
      data: { readAt: null },
    });

    const token = await createSessionToken('user-me');

    await expect(
      new Promise((resolve, reject) => {
        const socket = new WebSocket(wsUrl);

        socket.once('open', () => {
          socket.send(JSON.stringify({ type: 'session.authenticate', payload: { accessToken: token } }));
        });

        socket.on('message', async (data: RawData) => {
          const event = JSON.parse(data.toString()) as { type: string; payload: any };

          if (event.type === 'session.authenticated') {
            socket.send(JSON.stringify({ type: 'chat.subscribe', payload: { chatId: 'p1' } }));
            return;
          }

          if (event.type === 'chat.updated') {
            socket.send(
              JSON.stringify({
                type: 'message.read',
                payload: {
                  chatId: 'p1',
                  messageId: 'p6',
                },
              }),
            );
            return;
          }

          if (event.type === 'message.read' && event.payload.chatId === 'p1') {
            const notification = await prisma.notification.findUnique({
              where: { id: 'n1' },
            });
            resolve(notification?.readAt?.toISOString() ?? null);
            socket.close();
          }
        });

        socket.once('error', reject);
      }),
    ).resolves.toEqual(expect.any(String));
  });

  it('publishes message.created to other subscribers only after the message is committed', async () => {
    const senderToken = await createSessionToken('user-me');
    const receiverToken = await createSessionToken('user-anya');
    const clientMessageId = `commit-${Date.now()}`;

    await expect(
      new Promise((resolve, reject) => {
        const senderSocket = new WebSocket(wsUrl);
        const receiverSocket = new WebSocket(wsUrl);
        let senderReady = false;
        let receiverReady = false;
        let sent = false;

        const maybeSend = () => {
          if (senderReady && receiverReady && !sent) {
            sent = true;
            senderSocket.send(
              JSON.stringify({
                type: 'message.send',
                payload: {
                  chatId: 'p1',
                  text: 'message commit visibility check',
                  clientMessageId,
                },
              }),
            );
          }
        };

        senderSocket.once('open', () => {
          senderSocket.send(JSON.stringify({ type: 'session.authenticate', payload: { accessToken: senderToken } }));
        });

        receiverSocket.once('open', () => {
          receiverSocket.send(JSON.stringify({ type: 'session.authenticate', payload: { accessToken: receiverToken } }));
        });

        senderSocket.on('message', (data: RawData) => {
          const event = JSON.parse(data.toString()) as { type: string; payload: any };

          if (event.type === 'session.authenticated') {
            senderSocket.send(JSON.stringify({ type: 'chat.subscribe', payload: { chatId: 'p1' } }));
            return;
          }

          if (event.type === 'chat.updated') {
            senderReady = true;
            maybeSend();
          }
        });

        receiverSocket.on('message', async (data: RawData) => {
          const event = JSON.parse(data.toString()) as { type: string; payload: any };

          if (event.type === 'session.authenticated') {
            receiverSocket.send(JSON.stringify({ type: 'chat.subscribe', payload: { chatId: 'p1' } }));
            return;
          }

          if (event.type === 'chat.updated') {
            receiverReady = true;
            maybeSend();
            return;
          }

          if (event.type === 'message.created' && event.payload.clientMessageId === clientMessageId) {
            const message = await prisma.message.findUnique({
              where: { id: event.payload.id as string },
            });

            resolve(message?.id ?? null);
            senderSocket.close();
            receiverSocket.close();
          }
        });

        senderSocket.once('error', reject);
        receiverSocket.once('error', reject);
      }),
    ).resolves.toEqual(expect.any(String));
  });

  it('does not emit duplicate message.created to the subscribed sender', async () => {
    const senderToken = await createSessionToken('user-me');
    const clientMessageId = `dup-${Date.now()}`;

    await expect(
      new Promise((resolve, reject) => {
        const socket = new WebSocket(wsUrl);
        let createdEvents = 0;
        let settled = false;

        const finish = (value: number) => {
          if (settled) {
            return;
          }
          settled = true;
          resolve(value);
          socket.close();
        };

        socket.once('open', () => {
          socket.send(JSON.stringify({ type: 'session.authenticate', payload: { accessToken: senderToken } }));
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
                  text: 'duplicate delivery check',
                  clientMessageId,
                },
              }),
            );
            return;
          }

          if (event.type === 'message.created' && event.payload.clientMessageId === clientMessageId) {
            createdEvents += 1;
            setTimeout(() => finish(createdEvents), 400);
          }
        });

        socket.once('error', reject);
      }),
    ).resolves.toBe(1);
  });
});
