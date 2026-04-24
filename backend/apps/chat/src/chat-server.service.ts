import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  PUBSUB_CHANNEL,
  OUTBOX_EVENT_TYPES,
  buildMediaProxyPath,
  buildMessagePreview,
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

class ChatServerError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const DEFAULT_SYNC_EVENT_LIMIT = 100;
const MAX_SYNC_EVENT_LIMIT = 500;
const DEFAULT_TYPING_THROTTLE_MS = 1500;
const DEFAULT_MEMBERSHIP_CACHE_TTL_MS = 5000;

@Injectable()
export class ChatServerService implements OnModuleDestroy {
  private wss?: WebSocketServer;
  private readonly stateBySocket = new Map<WebSocket, SocketState>();
  private readonly socketsByUserId = new Map<string, Set<WebSocket>>();
  private readonly socketsByChatId = new Map<string, Set<WebSocket>>();
  private readonly maxBufferedBytes = Number(process.env.CHAT_WS_MAX_BUFFERED_BYTES ?? 1_048_576);
  private readonly typingThrottleMs = this.resolveDurationMs(
    process.env.CHAT_TYPING_THROTTLE_MS,
    DEFAULT_TYPING_THROTTLE_MS,
  );
  private readonly membershipCacheTtlMs = this.resolveDurationMs(
    process.env.CHAT_MEMBERSHIP_CACHE_TTL_MS,
    DEFAULT_MEMBERSHIP_CACHE_TTL_MS,
  );
  private readonly lastTypingSentAtBySocket = new Map<WebSocket, Map<string, number>>();
  private readonly membershipCache = new Map<string, number>();
  private readonly publisher: Redis = createRedisPublisher(process.env.REDIS_URL ?? 'redis://localhost:6379');
  private readonly subscriber: Redis = createRedisSubscriber(process.env.REDIS_URL ?? 'redis://localhost:6379');

  constructor(private readonly prismaService: PrismaService) {}

  attach(server: HttpServer) {
    this.wss = new WebSocketServer({ server });
    this.wss.on('connection', (socket: WebSocket) => this.handleConnection(socket));

    this.subscriber.subscribe(PUBSUB_CHANNEL).then(() => {
      this.subscriber.on('message', async (_channel, payload) => {
        const event = JSON.parse(payload) as Envelope;
        await this.broadcastEvent(event);
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
            code: error instanceof ChatServerError ? error.code : 'invalid_message',
            message: error instanceof Error ? error.message : 'Unable to process message',
          },
        });
      }
    });

    socket.on('close', () => {
      this.cleanupSocket(socket);
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
      throw new ChatServerError('auth_required', 'accessToken is required');
    }

    let payload;

    try {
      payload = verifyAccessToken(accessToken);
    } catch {
      throw new ChatServerError('invalid_access_token', 'Access token is invalid');
    }

    const session = await this.prismaService.client.session.findUnique({
      where: { id: payload.sessionId },
      select: {
        userId: true,
        revokedAt: true,
      },
    });

    if (!session || session.userId !== payload.userId || session.revokedAt != null) {
      throw new ChatServerError('stale_access_token', 'Access token is stale');
    }

    const state = this.getState(socket);
    if (state.userId != null && state.userId !== payload.userId) {
      this.removeIndexedSocket(this.socketsByUserId, state.userId, socket);
    }
    state.userId = payload.userId;
    state.sessionId = payload.sessionId;
    this.addIndexedSocket(this.socketsByUserId, payload.userId, socket);

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
    this.addIndexedSocket(this.socketsByChatId, chatId, socket);
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
    this.removeIndexedSocket(this.socketsByChatId, chatId, socket);
  }

  private async sendMessage(socket: WebSocket, payload: any) {
    const state = this.requireAuthenticated(socket);
    const chatId = payload?.chatId as string | undefined;
    const text =
      typeof payload?.text === 'string' ? payload.text.trim() : '';
    const clientMessageId = payload?.clientMessageId as string | undefined;
    const replyToMessageId = payload?.replyToMessageId as string | undefined;
    const attachmentIds = Array.isArray(payload?.attachmentIds)
      ? payload.attachmentIds.filter((item: unknown): item is string => typeof item === 'string')
      : [];

    if (!chatId || !clientMessageId) {
      throw new Error('chatId and clientMessageId are required');
    }

    if (text.length === 0 && attachmentIds.length === 0) {
      throw new ChatServerError(
        'message_payload_empty',
        'text or attachmentIds are required',
      );
    }

    await this.assertMembership(state.userId!, chatId);

    const existing = await this.prismaService.client.message.findFirst({
      where: {
        chatId,
        clientMessageId,
      },
      include: {
        sender: true,
        replyTo: {
          include: {
            sender: true,
            attachments: {
              include: {
                mediaAsset: true,
              },
            },
          },
        },
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

    if (readyAssets.some((asset) => asset.chatId !== chatId)) {
      throw new ChatServerError(
        'attachment_chat_mismatch',
        'Attachment belongs to another chat',
      );
    }

    if (replyToMessageId) {
      const replyTarget = await this.prismaService.client.message.findFirst({
        where: {
          id: replyToMessageId,
          chatId,
        },
        select: { id: true },
      });

      if (!replyTarget) {
        throw new ChatServerError(
          'reply_message_not_found',
          'Reply target was not found in chat',
        );
      }
    }

    const previewText = buildMessagePreview({
      text,
      attachments: readyAssets.map((asset) => ({
        kind: asset.kind,
      })),
    });

    const message = await this.prismaService.client.$transaction(async (tx) => {
      const now = new Date();
      const created = await tx.message.create({
        data: {
          chatId,
          senderId: state.userId!,
          text,
          clientMessageId,
          replyToMessageId,
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
          replyTo: {
            include: {
              sender: true,
              attachments: {
                include: {
                  mediaAsset: true,
                },
              },
            },
          },
          attachments: {
            include: {
              mediaAsset: true,
            },
          },
        },
      });

      await tx.chat.update({
        where: { id: chatId },
        data: { updatedAt: now },
      });

      const realtimeEvent = await tx.realtimeEvent.create({
        data: {
          chatId,
          eventType: 'message.created',
          payload: this.mapMessage(created),
        },
      });

      await tx.outboxEvent.create({
        data: {
          type: OUTBOX_EVENT_TYPES.messageNotificationFanout,
          payload: {
            chatId,
            actorUserId: state.userId!,
            messageId: created.id,
            body: previewText,
          },
        },
      });

      return {
        created,
        realtimeEventId: realtimeEvent.id.toString(),
      };
    });

    await publishBusEvent(this.publisher, {
      type: 'message.created',
      payload: this.mapMessage(
        message.created,
        message.realtimeEventId,
      ),
    });

    if (!state.subscriptions.has(chatId)) {
      this.send(socket, {
        type: 'message.created',
        payload: this.mapMessage(
          message.created,
          message.realtimeEventId,
        ),
      });
    }
  }

  private async markRead(socket: WebSocket, payload: any) {
    const state = this.requireAuthenticated(socket);
    const chatId = payload?.chatId as string | undefined;
    const messageId = payload?.messageId as string | undefined;

    if (!chatId || !messageId) {
      throw new Error('chatId and messageId are required');
    }

    await this.assertMembership(state.userId!, chatId);

    const result = await this.prismaService.client.$transaction(async (tx) => {
      const now = new Date();

      await tx.chatMember.update({
        where: {
          chatId_userId: {
            chatId,
            userId: state.userId!,
          },
        },
        data: {
          lastReadMessageId: messageId,
          lastReadAt: now,
        },
      });

      await tx.notification.updateMany({
        where: {
          userId: state.userId!,
          kind: 'message',
          readAt: null,
          chatId,
        },
        data: {
          readAt: now,
        },
      });

      const payloadRecord = {
        chatId,
        userId: state.userId!,
        messageId,
        readAt: now.toISOString(),
      };

      await tx.realtimeEvent.create({
        data: {
          chatId,
          eventType: 'message.read',
          payload: payloadRecord,
        },
      });

      return {
        payloadRecord,
        unreadCount: 0,
      };
    });

    await publishBusEvent(this.publisher, {
      type: 'message.read',
      payload: result.payloadRecord,
    });

    await publishBusEvent(this.publisher, {
      type: 'unread.updated',
      payload: {
        userId: state.userId!,
        chatId,
        unreadCount: result.unreadCount,
      },
    });
  }

  private async publishTyping(socket: WebSocket, chatId?: string, isTyping?: boolean) {
    const state = this.requireAuthenticated(socket);

    if (!chatId) {
      throw new Error('chatId is required');
    }

    if (this.isTypingThrottled(socket, chatId, Boolean(isTyping))) {
      return;
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
    const take = this.normalizeSyncEventLimit(payload?.limit);

    if (!chatId) {
      throw new Error('chatId is required');
    }

    await this.assertMembership(state.userId!, chatId);
    const blockedUserIds = await this.getBlockedUserIds(state.userId!);

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
      take: take + 1,
    });
    const hasMore = events.length > take;
    const page = hasMore ? events.slice(0, take) : events;
    const visibleEvents = page.filter((event) => {
      const actorUserId = this.getActorUserId({
        type: event.eventType,
        payload: event.payload,
      });

      return actorUserId == null || !blockedUserIds.has(actorUserId);
    });

    this.send(socket, {
      type: 'sync.snapshot',
      payload: {
        chatId,
        sinceEventId,
        hasMore,
        nextEventId:
          hasMore && page.length > 0
            ? page[page.length - 1]!.id.toString()
            : null,
        events: visibleEvents.map((event) => ({
          id: event.id.toString(),
          type: event.eventType,
          payload: event.payload,
          createdAt: event.createdAt.toISOString(),
        })),
      },
    });
  }

  private normalizeSyncEventLimit(limit: unknown) {
    const numericLimit =
      typeof limit === 'number'
        ? limit
        : typeof limit === 'string'
          ? Number(limit)
          : DEFAULT_SYNC_EVENT_LIMIT;

    if (!Number.isFinite(numericLimit)) {
      return DEFAULT_SYNC_EVENT_LIMIT;
    }

    return Math.max(1, Math.min(Math.trunc(numericLimit), MAX_SYNC_EVENT_LIMIT));
  }

  private async broadcastEvent(event: Envelope) {
    if (event.type === 'notification.created' || event.type === 'unread.updated') {
      const userId = event.payload?.userId as string | undefined;
      if (!userId) {
        return;
      }

      for (const socket of this.socketsByUserId.get(userId) ?? []) {
        const state = this.stateBySocket.get(socket);
        if (state?.userId === userId) {
          this.send(socket, event);
        }
      }
      return;
    }

    const chatId = event.payload?.chatId as string | undefined;
    if (!chatId) {
      return;
    }

    const actorUserId = this.getActorUserId(event);
    const blockedUserIds =
      actorUserId != null ? await this.getBlockedUserIds(actorUserId) : null;

    for (const socket of this.socketsByChatId.get(chatId) ?? []) {
      const state = this.stateBySocket.get(socket);
      if (state == null || !state.subscriptions.has(chatId)) {
        continue;
      }

      if (
        blockedUserIds != null &&
        state.userId != null &&
        actorUserId !== state.userId &&
        blockedUserIds.has(state.userId)
      ) {
        continue;
      }

      this.send(socket, event);
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
    const bufferedAmount =
      typeof socket.bufferedAmount === 'number' ? socket.bufferedAmount : 0;
    if (
      socket.readyState === WebSocket.OPEN &&
      bufferedAmount <= this.maxBufferedBytes
    ) {
      socket.send(JSON.stringify(event));
    }
  }

  private cleanupSocket(socket: WebSocket) {
    const state = this.stateBySocket.get(socket);
    if (!state) {
      return;
    }

    if (state.userId != null) {
      this.removeIndexedSocket(this.socketsByUserId, state.userId, socket);
    }

    for (const chatId of state.subscriptions) {
      this.removeIndexedSocket(this.socketsByChatId, chatId, socket);
    }

    this.stateBySocket.delete(socket);
    this.lastTypingSentAtBySocket.delete(socket);
  }

  private addIndexedSocket(
    index: Map<string, Set<WebSocket>>,
    key: string,
    socket: WebSocket,
  ) {
    const sockets = index.get(key);
    if (sockets) {
      sockets.add(socket);
      return;
    }

    index.set(key, new Set([socket]));
  }

  private removeIndexedSocket(
    index: Map<string, Set<WebSocket>>,
    key: string,
    socket: WebSocket,
  ) {
    const sockets = index.get(key);
    if (!sockets) {
      return;
    }

    sockets.delete(socket);
    if (sockets.size === 0) {
      index.delete(key);
    }
  }

  private async assertMembership(userId: string, chatId: string) {
    const membershipCacheKey = this.buildMembershipCacheKey(userId, chatId);
    const cachedUntil = this.membershipCache.get(membershipCacheKey);
    if (cachedUntil != null && cachedUntil > Date.now()) {
      return;
    }

    const membership = await this.prismaService.client.chatMember.findFirst({
      where: {
        chatId,
        userId,
      },
      include: {
        chat: {
          include: {
            event: {
              select: {
                hostId: true,
              },
            },
            members: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new ChatServerError('chat_forbidden', 'Not a chat member');
    }

    if (membership.chat.kind === 'direct') {
      const peerUserId = membership.chat.members.find((entry) => entry.userId !== userId)?.userId;
      if (peerUserId != null) {
        const blockedUserIds = await this.getBlockedUserIds(userId);
        if (blockedUserIds.has(peerUserId)) {
          throw new ChatServerError('chat_forbidden', 'Not a chat member');
        }
      }
    }

    if (membership.chat.kind === 'meetup' && membership.chat.event?.hostId != null) {
      const blockedUserIds = await this.getBlockedUserIds(userId);
      if (blockedUserIds.has(membership.chat.event.hostId) && membership.chat.event.hostId !== userId) {
        throw new ChatServerError('chat_forbidden', 'Not a chat member');
      }
    }

    if (this.membershipCacheTtlMs > 0) {
      this.membershipCache.set(
        membershipCacheKey,
        Date.now() + this.membershipCacheTtlMs,
      );
    }
  }

  private isTypingThrottled(
    socket: WebSocket,
    chatId: string,
    isTyping: boolean,
  ) {
    if (this.typingThrottleMs <= 0) {
      return false;
    }

    const now = Date.now();
    const key = `${chatId}:${isTyping ? '1' : '0'}`;
    const lastByKey = this.lastTypingSentAtBySocket.get(socket);
    const lastSentAt = lastByKey?.get(key);
    if (lastSentAt != null && now - lastSentAt < this.typingThrottleMs) {
      return true;
    }

    if (lastByKey) {
      lastByKey.set(key, now);
    } else {
      this.lastTypingSentAtBySocket.set(socket, new Map([[key, now]]));
    }

    return false;
  }

  private buildMembershipCacheKey(userId: string, chatId: string) {
    return `${userId}:${chatId}`;
  }

  private resolveDurationMs(raw: string | undefined, fallback: number) {
    const parsed = raw == null ? fallback : Number(raw);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.max(0, Math.trunc(parsed));
  }

  private async getBlockedUserIds(userId: string) {
    const blocks = await this.prismaService.client.userBlock.findMany({
      where: {
        OR: [
          { userId },
          { blockedUserId: userId },
        ],
      },
      select: {
        userId: true,
        blockedUserId: true,
      },
    });

    const blockedUserIds = new Set<string>();
    for (const block of blocks) {
      if (block.userId === userId) {
        blockedUserIds.add(block.blockedUserId);
      }
      if (block.blockedUserId === userId) {
        blockedUserIds.add(block.userId);
      }
    }

    return blockedUserIds;
  }

  private getActorUserId(event: Envelope) {
    const payload = event.payload as Record<string, unknown> | null;
    if (!payload) {
      return undefined;
    }

    if (typeof payload.senderId === 'string') {
      return payload.senderId;
    }

    if (typeof payload.userId === 'string') {
      return payload.userId;
    }

    return undefined;
  }

  private mapMessage(message: {
    id: string;
    chatId: string;
    senderId: string;
    text: string;
    clientMessageId: string;
    createdAt: Date;
    sender: { displayName: string };
    replyTo?: {
      id: string;
      senderId: string;
      text: string;
      sender: { displayName: string };
      attachments: Array<{
        mediaAsset: {
          kind: string;
        };
      }>;
    } | null;
    attachments: Array<{
      mediaAsset: {
        id: string;
        kind: string;
        status: string;
        publicUrl: string | null;
        mimeType: string;
        byteSize: number;
        durationMs: number | null;
        waveform: number[];
        originalFileName: string;
        objectKey: string;
      };
    }>;
  }, eventId?: string) {
    return {
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      senderName: message.sender.displayName,
      text: message.text,
      clientMessageId: message.clientMessageId,
      createdAt: message.createdAt.toISOString(),
      ...(eventId != null ? { eventId } : {}),
      replyTo: message.replyTo
          ? {
              id: message.replyTo.id,
              authorId: message.replyTo.senderId,
              author: message.replyTo.sender.displayName,
              text: buildMessagePreview({
                text: message.replyTo.text,
                attachments: message.replyTo.attachments.map((entry) => ({
                  kind: entry.mediaAsset.kind,
                })),
              }),
              isVoice: message.replyTo.attachments.some(
                (entry) => entry.mediaAsset.kind === 'chat_voice',
              ),
            }
          : null,
      attachments: message.attachments.map((entry) => ({
        id: entry.mediaAsset.id,
        kind: entry.mediaAsset.kind,
        status: entry.mediaAsset.status,
        url: buildMediaProxyPath(entry.mediaAsset.id),
        downloadUrlPath: `${buildMediaProxyPath(entry.mediaAsset.id)}/download-url`,
        mimeType: entry.mediaAsset.mimeType,
        byteSize: entry.mediaAsset.byteSize,
        fileName: entry.mediaAsset.originalFileName,
        durationMs: entry.mediaAsset.durationMs ?? null,
        waveform: entry.mediaAsset.waveform ?? [],
      })),
    };
  }
}
