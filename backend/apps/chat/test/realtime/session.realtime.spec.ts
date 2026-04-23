import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import WebSocket, { RawData } from 'ws';
import { randomUUID } from 'node:crypto';
import { buildPublicAssetUrl, signAccessToken } from '@big-break/database';
import { ChatAppModule } from '../../src/app.module';
import { ChatServerService } from '../../src/chat-server.service';

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/big_break';

jest.setTimeout(30000);

describe('chat websocket auth', () => {
  const prisma = new PrismaClient();
  let app: INestApplication;
  let wsUrl = '';

  beforeAll(async () => {
    app = await NestFactory.create(ChatAppModule, { logger: false });
    app.get(ChatServerService).attach(app.getHttpServer());
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port =
      typeof address === 'string' ? Number(address.split(':').pop()) : address.port;
    wsUrl = `ws://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

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
            expect(event.payload.eventId).toEqual(expect.any(String));
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

  it('sends reply message with reply preview metadata', async () => {
    const token = await createSessionToken('user-me');
    const clientMessageId = `reply-${Date.now()}`;

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
                  text: 'Отвечаю на первое сообщение',
                  clientMessageId,
                  replyToMessageId: 'p1',
                },
              }),
            );
            return;
          }

          if (event.type === 'message.created' && event.payload.clientMessageId === clientMessageId) {
            resolve(event);
            socket.close();
          }
        });

        socket.once('error', reject);
      }),
    ).resolves.toMatchObject({
      type: 'message.created',
      payload: {
        clientMessageId,
        text: 'Отвечаю на первое сообщение',
        replyTo: {
          id: 'p1',
          authorId: 'user-anya',
          text: 'Привет, классно посидели вчера.',
          isVoice: false,
        },
      },
    });
  });

  it('sends voice-only message with empty text and emits duration metadata', async () => {
    const token = await createSessionToken('user-me');
    const clientMessageId = `voice-${Date.now()}`;
    const attachmentId = `asset-${randomUUID()}`;
    const objectKey = `chat-attachments/user-me/${attachmentId}-voice.webm`;
    const waveform = [0.12, 0.34, 0.58, 0.81];
    const recipientUserId =
      (
        await prisma.chatMember.findFirst({
          where: {
            chatId: 'p1',
            userId: {
              not: 'user-me',
            },
          },
          select: {
            userId: true,
          },
        })
      )?.userId ?? 'user-sonya';
    let createdMessageId: string | null = null;

    await prisma.mediaAsset.create({
      data: {
        id: attachmentId,
        ownerId: 'user-me',
        kind: 'chat_voice',
        status: 'ready',
        bucket: process.env.S3_BUCKET ?? 'big-break',
        objectKey,
        mimeType: 'audio/webm',
        byteSize: 4096,
        durationMs: 14000,
        waveform,
        originalFileName: 'voice.webm',
        publicUrl: buildPublicAssetUrl(objectKey),
        chatId: 'p1',
      } as any,
    });

    try {
      createdMessageId = await new Promise<string>((resolve, reject) => {
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
                  text: '',
                  clientMessageId,
                  attachmentIds: [attachmentId],
                },
              }),
            );
            return;
          }

          if (event.type === 'message.created' && event.payload.clientMessageId === clientMessageId) {
            expect(event.payload.text).toBe('');
            expect(event.payload.eventId).toEqual(expect.any(String));
            expect(event.payload.attachments[0]).toMatchObject({
              id: attachmentId,
              kind: 'chat_voice',
              mimeType: 'audio/webm',
              durationMs: 14000,
              waveform,
            });
            resolve(event.payload.id as string);
            socket.close();
          }
        });

        socket.once('error', reject);
      });

      const notifications = await prisma.notification.findMany({
        where: {
          userId: recipientUserId,
          kind: 'message',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      });

      const notification = notifications.find((item) => {
        const payload = item.payload as Record<string, unknown> | null;
        return payload?.messageId === createdMessageId;
      });

      expect(notification?.body).toBe('Голосовое сообщение');
      expect(notification?.chatId).toBe('p1');
      expect(notification?.messageId).toBe(createdMessageId);
    } finally {
      if (createdMessageId != null) {
        const notifications = await prisma.notification.findMany({
          where: {
            userId: recipientUserId,
            kind: 'message',
          },
          select: {
            id: true,
            payload: true,
          },
        });

        const notificationIds = notifications
          .filter((item) => {
            const payload = item.payload as Record<string, unknown> | null;
            return payload?.messageId === createdMessageId;
          })
          .map((item) => item.id);

        if (notificationIds.length > 0) {
          await prisma.notification.deleteMany({
            where: {
              id: {
                in: notificationIds,
              },
            },
          });
        }
        await prisma.message.delete({ where: { id: createdMessageId } });
      }

      await prisma.mediaAsset.deleteMany({
        where: { id: attachmentId },
      });
    }
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

  it('publishes rich notification.created payload to recipient user', async () => {
    const senderToken = await createSessionToken('user-me');
    const recipientToken = await createSessionToken('user-anya');
    const clientMessageId = `notification-${Date.now()}`;

    await expect(
      new Promise((resolve, reject) => {
        const senderSocket = new WebSocket(wsUrl);
        const recipientSocket = new WebSocket(wsUrl);
        let senderReady = false;
        let recipientReady = false;
        let sent = false;

        const maybeSend = () => {
          if (!senderReady || !recipientReady || sent) {
            return;
          }
          sent = true;
          senderSocket.send(
            JSON.stringify({
              type: 'message.send',
              payload: {
                chatId: 'p1',
                text: 'notification payload check',
                clientMessageId,
              },
            }),
          );
        };

        senderSocket.once('open', () => {
          senderSocket.send(
            JSON.stringify({
              type: 'session.authenticate',
              payload: { accessToken: senderToken },
            }),
          );
        });

        recipientSocket.once('open', () => {
          recipientSocket.send(
            JSON.stringify({
              type: 'session.authenticate',
              payload: { accessToken: recipientToken },
            }),
          );
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

        recipientSocket.on('message', (data: RawData) => {
          const event = JSON.parse(data.toString()) as { type: string; payload: any };

          if (event.type === 'session.authenticated') {
            recipientReady = true;
            maybeSend();
            return;
          }

          if (event.type === 'notification.created') {
            resolve(event);
            senderSocket.close();
            recipientSocket.close();
          }
        });

        senderSocket.once('error', reject);
        recipientSocket.once('error', reject);
      }),
    ).resolves.toMatchObject({
      type: 'notification.created',
      payload: {
        userId: 'user-anya',
        kind: 'message',
        title: 'Новое сообщение',
        body: 'notification payload check',
        payload: {
          chatId: 'p1',
          messageId: expect.any(String),
        },
        createdAt: expect.any(String),
        readAt: null,
      },
    });
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
