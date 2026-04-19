import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  OUTBOX_EVENT_TYPES,
  PUBSUB_CHANNEL,
  buildPublicAssetUrl,
  createRedisPublisher,
  createRedisSubscriber,
  publishBusEvent,
  verifyAccessToken,
} from '@big-break/database';
import Redis from 'ioredis';
import { Server as HttpServer } from 'node:http';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { PrismaService } from './prisma.service';

interface SocketState {
  userId?: string;
  sessionId?: string;
  subscriptions: Set<string>;
}

interface Envelope {
  type: string;
  payload: any;
}

@Injectable()
export class ChatServerService implements OnModuleDestroy {
  private wss?: WebSocketServer;
  private readonly stateBySocket = new Map<WebSocket, SocketState>();
  private readonly publisher: Redis = createRedisPublisher(process.env.REDIS_URL ?? 'redis://localhost:6379');
  private readonly subscriber: Redis = createRedisSubscriber(process.env.REDIS_URL ?? 'redis://localhost:6379');

  constructor(private readonly prismaService: PrismaService) {}

  attach(server: HttpServer) {
    this.wss = new WebSocketServer({ server });
    this.wss.on('connection', (socket: WebSocket) => this.handleConnection(socket));

    this.subscriber.subscribe(PUBSUB_CHANNEL).then(() => {
      this.subscriber.on('message', (_channel, payload) => {
        const event = JSON.parse(payload) as Envelope;
        this.broadcastEvent(event);
      });
    });
  }

  async onModuleDestroy() {
    await this.publisher.quit();
    await this.subscriber.quit();
    this.wss?.close();
  }

  private handleConnection(socket: WebSocket) {
    this.stateBySocket.set(socket, { subscriptions: new Set() });

    socket.on('message', async (raw: RawData) => {
      try {
        const envelope = JSON.parse(raw.toString()) as Envelope;
        await this.handleEnvelope(socket, envelope);
      } catch (error) {
        this.send(socket, {
          type: 'error',
          payload: {
            code: 'invalid_message',
            message: error instanceof Error ? error.message : 'Unable to process message',
          },
        });
      }
    });

    socket.on('close', () => {
      this.stateBySocket.delete(socket);
    });
  }

  private async handleEnvelope(socket: WebSocket, envelope: Envelope) {
    switch (envelope.type) {
      case 'session.authenticate':
        await this.authenticate(socket, envelope.payload?.accessToken);
        return;
      case 'chat.subscribe':
        await this.subscribe(socket, envelope.payload?.chatId);
        return;
      case 'chat.unsubscribe':
        this.unsubscribe(socket, envelope.payload?.chatId);
        return;
      case 'message.send':
        await this.sendMessage(socket, envelope.payload);
        return;
      case 'message.read':
        await this.markRead(socket, envelope.payload);
        return;
      case 'typing.start':
        await this.publishTyping(socket, envelope.payload?.chatId, true);
        return;
      case 'typing.stop':
        await this.publishTyping(socket, envelope.payload?.chatId, false);
        return;
      case 'sync.request':
        await this.sync(socket, envelope.payload);
        return;
      default:
        this.send(socket, {
          type: 'error',
          payload: {
            code: 'unknown_event',
            message: `Unknown event: ${envelope.type}`,
          },
        });
    }
  }

  private async authenticate(socket: WebSocket, accessToken?: string) {
    if (!accessToken) {
      throw new Error('accessToken is required');
    }

    const payload = verifyAccessToken(accessToken);
    const state = this.getState(socket);
    state.userId = payload.userId;
    state.sessionId = payload.sessionId;

    this.send(socket, {
      type: 'session.authenticated',
      payload: {
        userId: payload.userId,
      },
    });
  }

  private async subscribe(socket: WebSocket, chatId?: string) {
    const state = this.requireAuthenticated(socket);
    if (!chatId) {
      throw new Error('chatId is required');
    }

    await this.assertMembership(state.userId!, chatId);
    state.subscriptions.add(chatId);
    this.send(socket, {
      type: 'chat.updated',
      payload: { chatId },
    });
  }

  private unsubscribe(socket: WebSocket, chatId?: string) {
    if (!chatId) {
      return;
    }

    this.getState(socket).subscriptions.delete(chatId);
  }

  private async sendMessage(socket: WebSocket, payload: any) {
    const state = this.requireAuthenticated(socket);
    const chatId = payload?.chatId as string | undefined;
    const text = payload?.text as string | undefined;
    const clientMessageId = payload?.clientMessageId as string | undefined;
    const attachmentIds = Array.isArray(payload?.attachmentIds)
      ? payload.attachmentIds.filter((item: unknown): item is string => typeof item === 'string')
      : [];

    if (!chatId || !text || !clientMessageId) {
      throw new Error('chatId, text and clientMessageId are required');
    }

    await this.assertMembership(state.userId!, chatId);

    const existing = await this.prismaService.client.message.findFirst({
      where: {
        chatId,
        clientMessageId,
      },
      include: {
        sender: true,
        attachments: {
          include: {
            mediaAsset: true,
          },
        },
      },
    });

    if (existing) {
      this.send(socket, {
        type: 'message.created',
        payload: this.mapMessage(existing),
      });
      return;
    }

    const readyAssets = await this.prismaService.client.mediaAsset.findMany({
      where: {
        id: {
          in: attachmentIds,
        },
        ownerId: state.userId!,
        status: 'ready',
      },
    });

    if (readyAssets.length !== attachmentIds.length) {
      throw new Error('Some attachments are missing or not ready');
    }

    const message = await this.prismaService.client.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          chatId,
          senderId: state.userId!,
          text,
          clientMessageId,
          attachments: {
            createMany: {
              data: readyAssets.map((asset) => ({
                mediaAssetId: asset.id,
              })),
            },
          },
        },
        include: {
          sender: true,
          attachments: {
            include: {
              mediaAsset: true,
            },
          },
        },
      });

      await tx.chat.update({
        where: { id: chatId },
        data: { updatedAt: new Date() },
      });

      const realtimeEvent = await tx.realtimeEvent.create({
        data: {
          chatId,
          eventType: 'message.created',
          payload: this.mapMessage(created),
        },
      });

      const members = await tx.chatMember.findMany({
        where: { chatId },
      });

      for (const member of members) {
        if (member.userId === state.userId) {
          continue;
        }

        const notification = await tx.notification.create({
          data: {
            userId: member.userId,
            kind: 'message',
            title: 'Новое сообщение',
            body: text,
            payload: { chatId, messageId: created.id },
          },
        });

        await tx.outboxEvent.create({
          data: {
            type: OUTBOX_EVENT_TYPES.pushDispatch,
            payload: {
              userId: member.userId,
              notificationId: notification.id,
            },
          },
        });

        await publishBusEvent(this.publisher, {
          type: 'notification.created',
          payload: {
            userId: member.userId,
            notificationId: notification.id,
            kind: notification.kind,
          },
        });
      }

      await publishBusEvent(this.publisher, {
        type: 'message.created',
        payload: this.mapMessage(created),
      });

      for (const member of members) {
        const unreadCount = await this.countUnread(chatId, member.userId, member.lastReadMessageId ?? undefined);
        await publishBusEvent(this.publisher, {
          type: 'unread.updated',
          payload: {
            userId: member.userId,
            chatId,
            unreadCount,
          },
        });
      }

      return { created, realtimeEventId: realtimeEvent.id.toString() };
    });

    this.send(socket, {
      type: 'message.created',
      payload: this.mapMessage(message.created),
    });
  }

  private async markRead(socket: WebSocket, payload: any) {
    const state = this.requireAuthenticated(socket);
    const chatId = payload?.chatId as string | undefined;
    const messageId = payload?.messageId as string | undefined;

    if (!chatId || !messageId) {
      throw new Error('chatId and messageId are required');
    }

    await this.assertMembership(state.userId!, chatId);

    await this.prismaService.client.$transaction(async (tx) => {
      await tx.chatMember.update({
        where: {
          chatId_userId: {
            chatId,
            userId: state.userId!,
          },
        },
        data: {
          lastReadMessageId: messageId,
          lastReadAt: new Date(),
        },
      });

      const payloadRecord = {
        chatId,
        userId: state.userId!,
        messageId,
        readAt: new Date().toISOString(),
      };

      await tx.realtimeEvent.create({
        data: {
          chatId,
          eventType: 'message.read',
          payload: payloadRecord,
        },
      });

      await publishBusEvent(this.publisher, {
        type: 'message.read',
        payload: payloadRecord,
      });

      const unreadCount = await this.countUnread(chatId, state.userId!, messageId);
      await publishBusEvent(this.publisher, {
        type: 'unread.updated',
        payload: {
          userId: state.userId!,
          chatId,
          unreadCount,
        },
      });
    });
  }

  private async publishTyping(socket: WebSocket, chatId?: string, isTyping?: boolean) {
    const state = this.requireAuthenticated(socket);

    if (!chatId) {
      throw new Error('chatId is required');
    }

    await this.assertMembership(state.userId!, chatId);
    await publishBusEvent(this.publisher, {
      type: 'typing.changed',
      payload: {
        chatId,
        userId: state.userId!,
        isTyping: Boolean(isTyping),
      },
    });
  }

  private async sync(socket: WebSocket, payload: any) {
    const state = this.requireAuthenticated(socket);
    const chatId = payload?.chatId as string | undefined;
    const sinceEventId = payload?.sinceEventId as string | undefined;

    if (!chatId) {
      throw new Error('chatId is required');
    }

    await this.assertMembership(state.userId!, chatId);

    const events = await this.prismaService.client.realtimeEvent.findMany({
      where: {
        chatId,
        ...(sinceEventId
          ? {
              id: {
                gt: BigInt(sinceEventId),
              },
            }
          : {}),
      },
      orderBy: { id: 'asc' },
    });

    this.send(socket, {
      type: 'sync.snapshot',
      payload: {
        chatId,
        sinceEventId,
        events: events.map((event) => ({
          id: event.id.toString(),
          type: event.eventType,
          payload: event.payload,
          createdAt: event.createdAt.toISOString(),
        })),
      },
    });
  }

  private broadcastEvent(event: Envelope) {
    for (const [socket, state] of this.stateBySocket.entries()) {
      if (socket.readyState !== WebSocket.OPEN) {
        continue;
      }

      if (event.type === 'notification.created' || event.type === 'unread.updated') {
        if (state.userId === event.payload.userId) {
          this.send(socket, event);
        }
        continue;
      }

      const chatId = event.payload?.chatId as string | undefined;
      if (chatId && state.subscriptions.has(chatId)) {
        this.send(socket, event);
      }
    }
  }

  private requireAuthenticated(socket: WebSocket) {
    const state = this.getState(socket);
    if (!state.userId) {
      throw new Error('Not authenticated');
    }
    return state;
  }

  private getState(socket: WebSocket): SocketState {
    const state = this.stateBySocket.get(socket);
    if (!state) {
      throw new Error('Socket state not found');
    }
    return state;
  }

  private send(socket: WebSocket, event: Envelope) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event));
    }
  }

  private async assertMembership(userId: string, chatId: string) {
    const membership = await this.prismaService.client.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new Error('Not a chat member');
    }
  }

  private async countUnread(chatId: string, userId: string, lastReadMessageId?: string) {
    let createdAfter: Date | undefined;

    if (lastReadMessageId) {
      const lastReadMessage = await this.prismaService.client.message.findUnique({
        where: { id: lastReadMessageId },
      });
      createdAfter = lastReadMessage?.createdAt;
    }

    return this.prismaService.client.message.count({
      where: {
        chatId,
        senderId: { not: userId },
        ...(createdAfter ? { createdAt: { gt: createdAfter } } : {}),
      },
    });
  }

  private mapMessage(message: {
    id: string;
    chatId: string;
    senderId: string;
    text: string;
    clientMessageId: string;
    createdAt: Date;
    sender: { displayName: string };
    attachments: Array<{
      mediaAsset: {
        id: string;
        kind: string;
        status: string;
        publicUrl: string | null;
        mimeType: string;
        byteSize: number;
        originalFileName: string;
        objectKey: string;
      };
    }>;
  }) {
    return {
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      senderName: message.sender.displayName,
      text: message.text,
      clientMessageId: message.clientMessageId,
      createdAt: message.createdAt.toISOString(),
      attachments: message.attachments.map((entry) => ({
        id: entry.mediaAsset.id,
        kind: entry.mediaAsset.kind,
        status: entry.mediaAsset.status,
        url: entry.mediaAsset.publicUrl ?? buildPublicAssetUrl(entry.mediaAsset.objectKey),
        mimeType: entry.mediaAsset.mimeType,
        byteSize: entry.mediaAsset.byteSize,
        fileName: entry.mediaAsset.originalFileName,
      })),
    };
  }
}
