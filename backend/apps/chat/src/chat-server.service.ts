import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  PUBSUB_CHANNEL,
  OUTBOX_EVENT_TYPES,
  appMetrics,
  buildMediaProxyPath,
  buildMessagePreview,
  createRedisPublisher,
  createRedisSubscriber,
  getBlockedUserIds as loadBlockedUserIds,
  publishBusEvent,
  verifyAccessToken,
} from '@big-break/database';
import Redis from 'ioredis';
import { Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { PrismaService } from './prisma.service';

interface SocketState {
  userId?: string;
  sessionId?: string;
  tokenExpiresAtMs?: number;
  authCheckedAtMs?: number;
  subscriptions: Set<string>;
  isAlive: boolean;
}

interface Envelope {
  type: string;
  payload: any;
}

interface AuthSessionSnapshot {
  userId: string;
  revokedAt: Date | null;
}

interface AuthSessionCacheEntry {
  expiresAt: number;
  value: AuthSessionSnapshot;
}

interface BlockedUserIdsCacheEntry {
  expiresAt: number;
  value: Set<string>;
}

interface MessageAuthorSnapshot {
  displayName: string;
  profile: { avatarUrl: string | null } | null;
}

interface MessageAuthorCacheEntry {
  expiresAt: number;
  value: MessageAuthorSnapshot;
}

interface MessageUnreadUpdate {
  userId: string;
  unreadCount: number;
}

interface MessageWriteResult {
  created: Parameters<ChatServerService['mapMessage']>[0];
  realtimeEventId: string;
  unreadUpdates: MessageUnreadUpdate[];
}

type MessageWriteTask<T> = {
  operation: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

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
const DEFAULT_MEMBERSHIP_CACHE_MAX_ENTRIES = 10_000;
const DEFAULT_AUTH_RECHECK_MS = 30_000;
const DEFAULT_MESSAGE_TRANSACTION_MAX_WAIT_MS = 10_000;
const DEFAULT_MESSAGE_TRANSACTION_TIMEOUT_MS = 10_000;
const DEFAULT_MESSAGE_CHAT_TOUCH_INTERVAL_MS = 10_000;
const DEFAULT_MESSAGE_WRITE_CONCURRENCY = 16;
const DEFAULT_MESSAGE_WRITE_QUEUE_MAX = 1000;
const AUTH_SESSION_CACHE_SECONDS = 5;
const AUTH_SESSION_CACHE_MAX_ENTRIES = 10_000;
const BLOCKED_USER_IDS_CACHE_SECONDS = 5;
const BLOCKED_USER_IDS_CACHE_MAX_ENTRIES = 10_000;
const MESSAGE_AUTHOR_CACHE_SECONDS = 30;
const MESSAGE_AUTHOR_CACHE_MAX_ENTRIES = 10_000;
const DIRECT_MESSAGE_ACK_SKIP_TTL_MS = 30_000;
const DEFAULT_MAX_PAYLOAD_BYTES = 64 * 1024;
const DEFAULT_MAX_MESSAGE_TEXT_LENGTH = 4000;
const DEFAULT_MAX_ATTACHMENT_COUNT = 10;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;
const DEFAULT_PAYLOAD_WARN_BYTES = 32 * 1024;
const METRICS_SERVICE = 'chat';

const messageReplyAttachmentSelect = {
  mediaAsset: {
    select: {
      kind: true,
    },
  },
} satisfies Prisma.MessageAttachmentSelect;

const messageAttachmentSelect = {
  mediaAsset: {
    select: {
      id: true,
      kind: true,
      status: true,
      mimeType: true,
      byteSize: true,
      durationMs: true,
      waveform: true,
      originalFileName: true,
    },
  },
} satisfies Prisma.MessageAttachmentSelect;

const chatMessageSelect = {
  id: true,
  chatId: true,
  senderId: true,
  text: true,
  clientMessageId: true,
  locationLatitude: true,
  locationLongitude: true,
  locationLabel: true,
  locationExpiresAt: true,
  createdAt: true,
  sender: {
    select: {
      displayName: true,
      profile: {
        select: {
          avatarUrl: true,
        },
      },
    },
  },
  replyTo: {
    select: {
      id: true,
      senderId: true,
      text: true,
      sender: {
        select: {
          displayName: true,
        },
      },
      attachments: {
        select: messageReplyAttachmentSelect,
      },
    },
  },
  attachments: {
    select: messageAttachmentSelect,
  },
} satisfies Prisma.MessageSelect;

const plainChatMessageSelect = {
  id: true,
  chatId: true,
  senderId: true,
  text: true,
  clientMessageId: true,
  locationLatitude: true,
  locationLongitude: true,
  locationLabel: true,
  locationExpiresAt: true,
  createdAt: true,
} satisfies Prisma.MessageSelect;

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
  private readonly authRecheckMs = this.resolveDurationMs(
    process.env.CHAT_AUTH_RECHECK_MS,
    DEFAULT_AUTH_RECHECK_MS,
  );
  private readonly maxPayloadBytes = this.resolvePositiveInteger(
    process.env.CHAT_WS_MAX_PAYLOAD_BYTES,
    DEFAULT_MAX_PAYLOAD_BYTES,
  );
  private readonly payloadWarnBytes = this.resolvePositiveInteger(
    process.env.CHAT_WS_PAYLOAD_WARN_BYTES,
    Math.min(DEFAULT_PAYLOAD_WARN_BYTES, this.maxPayloadBytes),
  );
  private readonly maxMessageTextLength = this.resolvePositiveInteger(
    process.env.CHAT_MESSAGE_TEXT_MAX_LENGTH,
    DEFAULT_MAX_MESSAGE_TEXT_LENGTH,
  );
  private readonly maxAttachmentCount = this.resolvePositiveInteger(
    process.env.CHAT_MESSAGE_ATTACHMENT_MAX_COUNT,
    DEFAULT_MAX_ATTACHMENT_COUNT,
  );
  private readonly membershipCacheTtlMs = this.resolveDurationMs(
    process.env.CHAT_MEMBERSHIP_CACHE_TTL_MS,
    DEFAULT_MEMBERSHIP_CACHE_TTL_MS,
  );
  private readonly membershipCacheMaxEntries = this.resolvePositiveInteger(
    process.env.CHAT_MEMBERSHIP_CACHE_MAX_ENTRIES,
    DEFAULT_MEMBERSHIP_CACHE_MAX_ENTRIES,
  );
  private readonly messageTransactionMaxWaitMs = this.resolveDurationMs(
    process.env.CHAT_MESSAGE_TRANSACTION_MAX_WAIT_MS,
    DEFAULT_MESSAGE_TRANSACTION_MAX_WAIT_MS,
  );
  private readonly messageTransactionTimeoutMs = this.resolveDurationMs(
    process.env.CHAT_MESSAGE_TRANSACTION_TIMEOUT_MS,
    DEFAULT_MESSAGE_TRANSACTION_TIMEOUT_MS,
  );
  private readonly messageChatTouchIntervalMs = this.resolveDurationMs(
    process.env.CHAT_MESSAGE_CHAT_TOUCH_INTERVAL_MS,
    DEFAULT_MESSAGE_CHAT_TOUCH_INTERVAL_MS,
  );
  private readonly messageWriteConcurrency = this.resolvePositiveInteger(
    process.env.CHAT_MESSAGE_WRITE_CONCURRENCY,
    DEFAULT_MESSAGE_WRITE_CONCURRENCY,
  );
  private readonly messageWriteQueueMax = this.resolvePositiveInteger(
    process.env.CHAT_MESSAGE_WRITE_QUEUE_MAX,
    DEFAULT_MESSAGE_WRITE_QUEUE_MAX,
  );
  private readonly messageInlineUnreadUpdates = this.resolveBoolean(
    process.env.CHAT_MESSAGE_INLINE_UNREAD_UPDATES,
    true,
  );
  private readonly heartbeatIntervalMs = this.resolveDurationMs(
    process.env.CHAT_WS_HEARTBEAT_INTERVAL_MS,
    DEFAULT_HEARTBEAT_INTERVAL_MS,
  );
  private readonly lastTypingSentAtBySocket = new Map<WebSocket, Map<string, number>>();
  private readonly membershipCache = new Map<string, number>();
  private readonly pendingMembershipChecks = new Map<string, Promise<void>>();
  private readonly authSessionCache = new Map<string, AuthSessionCacheEntry>();
  private readonly pendingAuthSessionLoads = new Map<
    string,
    Promise<AuthSessionSnapshot | null>
  >();
  private readonly blockedUserIdsCache = new Map<string, BlockedUserIdsCacheEntry>();
  private readonly pendingBlockedUserLoads = new Map<string, Promise<Set<string>>>();
  private readonly messageAuthorCache = new Map<string, MessageAuthorCacheEntry>();
  private readonly pendingMessageAuthorLoads = new Map<string, Promise<MessageAuthorSnapshot>>();
  private readonly lastMessageChatTouchAt = new Map<string, number>();
  private readonly messageWriteQueue: Array<MessageWriteTask<any>> = [];
  private readonly directMessageAckedSockets = new Map<string, Set<WebSocket>>();
  private activeMessageWrites = 0;
  private readonly publisher: Redis = createRedisPublisher(process.env.REDIS_URL ?? 'redis://localhost:6379');
  private readonly subscriber: Redis = createRedisSubscriber(process.env.REDIS_URL ?? 'redis://localhost:6379');
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(private readonly prismaService: PrismaService) {
    this.publisher.on('error', (error) => this.logRedisError('publisher', error));
    this.subscriber.on('error', (error) => this.logRedisError('subscriber', error));
  }

  attach(server: HttpServer) {
    this.wss = new WebSocketServer({
      server,
      maxPayload: this.maxPayloadBytes,
    });
    this.wss.on('connection', (socket: WebSocket) => this.handleConnection(socket));
    this.startHeartbeat();

    this.subscriber
      .subscribe(PUBSUB_CHANNEL)
      .then(() => {
        this.subscriber.on('message', (_channel, payload) => {
          void this.handleRedisMessage(payload);
        });
      })
      .catch((error) => this.logRedisError('subscriber subscribe', error));
  }

  async onModuleDestroy() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    for (const socket of this.wss?.clients ?? []) {
      this.terminateSocket(socket);
    }
    this.wss?.close();
    await Promise.allSettled([this.publisher.quit(), this.subscriber.quit()]);
  }

  private handleConnection(socket: WebSocket) {
    this.stateBySocket.set(socket, { subscriptions: new Set(), isAlive: true });
    this.updateWebSocketGauges();

    socket.on('pong', () => {
      const state = this.stateBySocket.get(socket);
      if (state) {
        state.isAlive = true;
      }
    });

    socket.on('message', async (raw: RawData) => {
      try {
        const payloadBytes = this.rawDataByteLength(raw);
        if (payloadBytes > this.maxPayloadBytes) {
          appMetrics.websocketInboundTotal.inc({
            service: METRICS_SERVICE,
            event_type: 'unknown',
            status: 'payload_too_large',
          });
          throw new ChatServerError('payload_too_large', 'Payload is too large');
        }

        const envelope = JSON.parse(this.rawDataToString(raw)) as Envelope;
        const eventType = this.metricsEventType(envelope.type);
        appMetrics.websocketInboundTotal.inc({
          service: METRICS_SERVICE,
          event_type: eventType,
          status: 'ok',
        });
        this.recordPayloadSize(eventType, 'inbound', payloadBytes);
        await this.handleEnvelope(socket, envelope);
      } catch (error) {
        appMetrics.websocketInboundTotal.inc({
          service: METRICS_SERVICE,
          event_type: 'unknown',
          status: 'error',
        });
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

  private startHeartbeat() {
    if (this.heartbeatIntervalMs <= 0 || this.heartbeatTimer) {
      return;
    }

    this.heartbeatTimer = setInterval(() => this.runHeartbeat(), this.heartbeatIntervalMs);
    this.heartbeatTimer.unref?.();
  }

  private runHeartbeat() {
    for (const socket of this.wss?.clients ?? this.stateBySocket.keys()) {
      const state = this.stateBySocket.get(socket);
      if (!state) {
        continue;
      }

      if (!state.isAlive) {
        this.terminateSocket(socket);
        continue;
      }

      state.isAlive = false;
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.ping();
        } catch {
          this.terminateSocket(socket);
        }
      }
    }
  }

  private async handleRedisMessage(payload: string) {
    try {
      const event = JSON.parse(payload) as Envelope;
      await this.broadcastEvent(event);
    } catch (error) {
      console.error('[chat] redis message handling failed', {
        message: error instanceof Error ? error.message : 'Unknown redis message error',
        payloadBytes: Buffer.byteLength(payload),
      });
    }
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
      case 'message.edit':
        await this.editMessage(socket, envelope.payload);
        return;
      case 'message.delete':
        await this.deleteMessage(socket, envelope.payload);
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

    const session = await this.loadSession(payload.sessionId);

    if (!session || session.userId !== payload.userId || session.revokedAt != null) {
      throw new ChatServerError('stale_access_token', 'Access token is stale');
    }

    const tokenExpiresAtMs =
      typeof payload.exp === 'number' ? payload.exp * 1000 : undefined;
    const now = Date.now();
    if (tokenExpiresAtMs != null && tokenExpiresAtMs <= now) {
      throw new ChatServerError('stale_access_token', 'Access token is stale');
    }

    const state = this.getState(socket);
    if (state.userId != null && state.userId !== payload.userId) {
      this.clearAuthenticatedState(socket, state);
    }
    state.userId = payload.userId;
    state.sessionId = payload.sessionId;
    state.tokenExpiresAtMs = tokenExpiresAtMs;
    state.authCheckedAtMs = now;
    this.addIndexedSocket(this.socketsByUserId, payload.userId, socket);
    this.updateWebSocketGauges();

    this.send(socket, {
      type: 'session.authenticated',
      payload: {
        userId: payload.userId,
      },
    });
  }

  private async subscribe(socket: WebSocket, chatId?: string) {
    const state = await this.requireAuthenticated(socket);
    if (!chatId) {
      throw new Error('chatId is required');
    }

    await this.assertMembership(state.userId!, chatId);
    state.subscriptions.add(chatId);
    this.addIndexedSocket(this.socketsByChatId, chatId, socket);
    this.updateWebSocketGauges();
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
    this.updateWebSocketGauges();
  }

  private async sendMessage(socket: WebSocket, payload: any) {
    const state = await this.requireAuthenticated(socket);
    const chatId = payload?.chatId as string | undefined;
    const text =
      typeof payload?.text === 'string' ? payload.text.trim() : '';
    const clientMessageId = payload?.clientMessageId as string | undefined;
    const replyToMessageId = payload?.replyToMessageId as string | undefined;
    const attachmentIds = Array.isArray(payload?.attachmentIds)
      ? payload.attachmentIds.filter((item: unknown): item is string => typeof item === 'string')
      : [];
    const location = this.parseLocationPayload(payload?.location);

    if (!chatId || !clientMessageId) {
      throw new Error('chatId and clientMessageId are required');
    }

    if (text.length === 0 && attachmentIds.length === 0 && location == null) {
      throw new ChatServerError(
        'message_payload_empty',
        'text, attachmentIds or location are required',
      );
    }

    if (text.length > this.maxMessageTextLength) {
      throw new ChatServerError(
        'message_text_too_long',
        'Message text is too long',
      );
    }

    if (attachmentIds.length > this.maxAttachmentCount) {
      throw new ChatServerError(
        'message_attachment_limit_exceeded',
        'Too many attachments',
      );
    }

    await this.assertMembership(state.userId!, chatId);

    const readyAssets = attachmentIds.length > 0
      ? await this.prismaService.client.mediaAsset.findMany({
          where: {
            id: {
              in: attachmentIds,
            },
            ownerId: state.userId!,
            status: 'ready',
          },
          select: {
            id: true,
            chatId: true,
          },
        })
      : [];

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
        select: {
          id: true,
          senderId: true,
        },
      });

      if (!replyTarget || (await this.isUserBlocked(state.userId!, replyTarget.senderId))) {
        throw new ChatServerError(
          'reply_message_not_found',
          'Reply target was not found in chat',
        );
      }
    }

    const isPlainMessage = readyAssets.length === 0 && !replyToMessageId;
    const plainMessageAuthor = isPlainMessage
      ? await this.getMessageAuthor(state.userId!)
      : null;

    let message: MessageWriteResult;
    try {
      message = await this.enqueueMessageWrite<MessageWriteResult>(() => {
        if (
          isPlainMessage &&
          plainMessageAuthor != null &&
          typeof this.prismaService.client.$queryRaw === 'function'
        ) {
          return this.createPlainMessageFast({
            chatId,
            senderId: state.userId!,
            text,
            clientMessageId,
            location,
            author: plainMessageAuthor,
          });
        }

        return this.prismaService.client.$transaction(
            async (tx) => {
              const now = new Date();
              const messageData = {
                chatId,
                senderId: state.userId!,
                text,
                clientMessageId,
                replyToMessageId,
                locationLatitude: location?.latitude,
                locationLongitude: location?.longitude,
                locationLabel: location?.label,
                locationExpiresAt: location?.expiresAt,
                ...(readyAssets.length > 0
                  ? {
                      attachments: {
                        createMany: {
                          data: readyAssets.map((asset) => ({
                            mediaAssetId: asset.id,
                          })),
                        },
                      },
                    }
                  : {}),
              };
              const created = isPlainMessage
                ? {
                    ...(await tx.message.create({
                      data: messageData,
                      select: plainChatMessageSelect,
                    })),
                    sender: plainMessageAuthor!,
                    replyTo: null,
                    attachments: [],
                  }
                : await tx.message.create({
                    data: messageData,
                    select: chatMessageSelect,
                  });

              if (this.shouldTouchChatForMessage(chatId, now.getTime())) {
                await tx.chat.update({
                  where: { id: chatId },
                  data: { updatedAt: now },
                });
              }

              const realtimeEvent = await tx.realtimeEvent.create({
                data: {
                  chatId,
                  eventType: 'message.created',
                  payload: this.mapMessage(created),
                },
              });

              await tx.outboxEvent.createMany({
                data: this.messageOutboxRows({
                  chatId,
                  actorUserId: state.userId!,
                  messageId: created.id,
                  messageCreatedAt: created.createdAt,
                }),
              });

              return {
                created,
                realtimeEventId: realtimeEvent.id.toString(),
                unreadUpdates: [],
              };
            },
            {
              maxWait: this.messageTransactionMaxWaitMs,
              timeout: this.messageTransactionTimeoutMs,
            },
          );
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const existing = await this.prismaService.client.message.findFirst({
          where: {
            chatId,
            senderId: state.userId!,
            clientMessageId,
          },
          select: chatMessageSelect,
        });

        if (existing) {
          this.send(socket, {
            type: 'message.created',
            payload: await this.mapMessageForUser(existing, undefined, state.userId!),
          });
          return;
        }

        throw new ChatServerError(
          'client_message_id_conflict',
          'clientMessageId already exists in this chat',
        );
      }
      throw error;
    }

    const directAckPayload = await this.mapMessageForUser(
      message.created,
      message.realtimeEventId,
      state.userId!,
    );
    this.send(socket, {
      type: 'message.created',
      payload: directAckPayload,
    });
    this.rememberDirectMessageAckedSocket(directAckPayload, socket);

    await publishBusEvent(this.publisher, {
      type: 'message.created',
      payload: this.mapMessage(
        message.created,
        message.realtimeEventId,
      ),
    });
    await this.publishUnreadUpdates(message.created.chatId, message.unreadUpdates);
  }

  private enqueueMessageWrite<T>(operation: () => Promise<T>) {
    if (
      this.activeMessageWrites >= this.messageWriteConcurrency &&
      this.messageWriteQueue.length >= this.messageWriteQueueMax
    ) {
      throw new ChatServerError(
        'message_write_backpressure',
        'Message write queue is full',
      );
    }

    return new Promise<T>((resolve, reject) => {
      this.messageWriteQueue.push({ operation, resolve, reject });
      this.updateMessageWriteMetrics();
      this.drainMessageWriteQueue();
    });
  }

  private drainMessageWriteQueue() {
    while (
      this.activeMessageWrites < this.messageWriteConcurrency &&
      this.messageWriteQueue.length > 0
    ) {
      const task = this.messageWriteQueue.shift();
      if (task == null) {
        return;
      }

      this.activeMessageWrites += 1;
      this.updateMessageWriteMetrics();

      void Promise.resolve()
        .then(task.operation)
        .then(task.resolve, task.reject)
        .finally(() => {
          this.activeMessageWrites -= 1;
          this.updateMessageWriteMetrics();
          this.drainMessageWriteQueue();
        });
    }
  }

  private updateMessageWriteMetrics() {
    appMetrics.websocketMessageWriteActive.set(
      { service: METRICS_SERVICE },
      this.activeMessageWrites,
    );
    appMetrics.websocketMessageWriteQueueDepth.set(
      { service: METRICS_SERVICE },
      this.messageWriteQueue.length,
    );
  }

  private async createPlainMessageFast(params: {
    chatId: string;
    senderId: string;
    text: string;
    clientMessageId: string;
    location: {
      latitude: number;
      longitude: number;
      label: string | null;
      expiresAt: Date;
    } | null;
    author: MessageAuthorSnapshot;
  }) {
    const now = new Date();
    const messageId = randomUUID();
    const unreadOutboxEventId = randomUUID();
    const notificationOutboxEventId = randomUUID();
    const touchChat = this.shouldTouchChatForMessage(params.chatId, now.getTime());
    const created = {
      id: messageId,
      chatId: params.chatId,
      senderId: params.senderId,
      text: params.text,
      clientMessageId: params.clientMessageId,
      locationLatitude: params.location?.latitude ?? null,
      locationLongitude: params.location?.longitude ?? null,
      locationLabel: params.location?.label ?? null,
      locationExpiresAt: params.location?.expiresAt ?? null,
      createdAt: now,
      sender: params.author,
      replyTo: null,
      attachments: [],
    };
    const realtimePayload = JSON.stringify(this.mapMessage(created));
    if (!this.messageInlineUnreadUpdates) {
      const rows = await this.prismaService.client.$queryRaw<Array<{
        realtime_event_id: string | bigint;
      }>>(Prisma.sql`
        WITH inserted_message AS (
          INSERT INTO "Message" (
            "id",
            "chatId",
            "senderId",
            "text",
            "clientMessageId",
            "locationLatitude",
            "locationLongitude",
            "locationLabel",
            "locationExpiresAt",
            "createdAt"
          )
          VALUES (
            ${messageId},
            ${params.chatId},
            ${params.senderId},
            ${params.text},
            ${params.clientMessageId},
            ${created.locationLatitude},
            ${created.locationLongitude},
            ${created.locationLabel},
            ${created.locationExpiresAt},
            ${now}
          )
          RETURNING "id"
        ),
        touched_chat AS (
          UPDATE "Chat"
          SET "updatedAt" = ${now}
          WHERE "id" = ${params.chatId}
            AND ${touchChat}
          RETURNING "id"
        ),
        inserted_realtime AS (
          INSERT INTO "RealtimeEvent" ("chatId", "eventType", "payload", "createdAt")
          SELECT ${params.chatId}, ${'message.created'}, ${realtimePayload}::jsonb, ${now}
          FROM inserted_message
          RETURNING "id"
        ),
        inserted_outbox AS (
          INSERT INTO "OutboxEvent" ("id", "type", "payload", "createdAt", "availableAt")
          SELECT
            outbox."id",
            outbox."type",
            outbox."payload",
            ${now},
            ${now}
          FROM inserted_message
          CROSS JOIN (
            VALUES
              (
                ${unreadOutboxEventId},
                ${OUTBOX_EVENT_TYPES.chatUnreadFanout},
                jsonb_build_object(
                  'chatId', ${params.chatId},
                  'actorUserId', ${params.senderId},
                  'messageCreatedAt', ${now.toISOString()}
                )
              ),
              (
                ${notificationOutboxEventId},
                ${OUTBOX_EVENT_TYPES.messageNotificationFanout},
                jsonb_build_object(
                  'chatId', ${params.chatId},
                  'actorUserId', ${params.senderId},
                  'messageId', ${messageId},
                  'messageCreatedAt', ${now.toISOString()}
                )
              )
          ) AS outbox("id", "type", "payload")
          RETURNING "id"
        )
        SELECT inserted_realtime."id"::text AS realtime_event_id
        FROM inserted_realtime
      `);

      const realtimeEventId = rows[0]?.realtime_event_id;
      if (realtimeEventId == null) {
        throw new Error('Plain message insert did not return realtime event id');
      }

      return {
        created,
        realtimeEventId: realtimeEventId.toString(),
        unreadUpdates: [],
      };
    }

    const rows = await this.prismaService.client.$queryRaw<Array<{
      realtime_event_id: string | bigint;
      unread_updates?: unknown;
    }>>(Prisma.sql`
      WITH inserted_message AS (
        INSERT INTO "Message" (
          "id",
          "chatId",
          "senderId",
          "text",
          "clientMessageId",
          "locationLatitude",
          "locationLongitude",
          "locationLabel",
          "locationExpiresAt",
          "createdAt"
        )
        VALUES (
          ${messageId},
          ${params.chatId},
          ${params.senderId},
          ${params.text},
          ${params.clientMessageId},
          ${created.locationLatitude},
          ${created.locationLongitude},
          ${created.locationLabel},
          ${created.locationExpiresAt},
          ${now}
        )
        RETURNING "id"
      ),
      touched_chat AS (
        UPDATE "Chat"
        SET "updatedAt" = ${now}
        WHERE "id" = ${params.chatId}
          AND ${touchChat}
        RETURNING "id"
      ),
      inserted_realtime AS (
        INSERT INTO "RealtimeEvent" ("chatId", "eventType", "payload", "createdAt")
        SELECT ${params.chatId}, ${'message.created'}, ${realtimePayload}::jsonb, ${now}
        FROM inserted_message
        RETURNING "id"
      ),
      inserted_outbox AS (
        INSERT INTO "OutboxEvent" ("id", "type", "payload", "createdAt", "availableAt")
        SELECT
          ${notificationOutboxEventId},
          ${OUTBOX_EVENT_TYPES.messageNotificationFanout},
          jsonb_build_object(
            'chatId', ${params.chatId},
            'actorUserId', ${params.senderId},
            'messageId', ${messageId},
            'messageCreatedAt', ${now.toISOString()}
          ),
          ${now},
          ${now}
        FROM inserted_message
        RETURNING "id"
      ),
      updated_unread AS (
        UPDATE "ChatMember" cm
        SET "unreadCount" = cm."unreadCount" + 1
        WHERE cm."chatId" = ${params.chatId}
          AND cm."userId" <> ${params.senderId}
          AND (
            cm."lastReadAt" IS NULL
            OR cm."lastReadAt" < ${now}
          )
          AND NOT EXISTS (
            SELECT 1
            FROM "UserBlock" ub
            WHERE (
              ub."userId" = cm."userId"
              AND ub."blockedUserId" = ${params.senderId}
            )
            OR (
              ub."userId" = ${params.senderId}
              AND ub."blockedUserId" = cm."userId"
            )
          )
        RETURNING cm."userId" AS user_id, cm."unreadCount" AS unread_count
      )
      SELECT
        inserted_realtime."id"::text AS realtime_event_id,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'userId', updated_unread.user_id,
              'unreadCount', updated_unread.unread_count
            )
          ) FILTER (WHERE updated_unread.user_id IS NOT NULL),
          '[]'::jsonb
        ) AS unread_updates
      FROM inserted_realtime
      LEFT JOIN updated_unread ON true
      GROUP BY inserted_realtime."id"
    `);

    const realtimeEventId = rows[0]?.realtime_event_id;
    if (realtimeEventId == null) {
      throw new Error('Plain message insert did not return realtime event id');
    }

    return {
      created,
      realtimeEventId: realtimeEventId.toString(),
      unreadUpdates: this.normalizeUnreadUpdates(rows[0]?.unread_updates),
    };
  }

  private messageOutboxRows(params: {
    chatId: string;
    actorUserId: string;
    messageId: string;
    messageCreatedAt: Date;
  }) {
    const messageCreatedAt = params.messageCreatedAt.toISOString();
    return [
      {
        type: OUTBOX_EVENT_TYPES.chatUnreadFanout,
        payload: {
          chatId: params.chatId,
          actorUserId: params.actorUserId,
          messageCreatedAt,
        },
      },
      {
        type: OUTBOX_EVENT_TYPES.messageNotificationFanout,
        payload: {
          chatId: params.chatId,
          actorUserId: params.actorUserId,
          messageId: params.messageId,
          messageCreatedAt,
        },
      },
    ];
  }

  private parseLocationPayload(value: unknown) {
    if (value == null || typeof value !== 'object') {
      return null;
    }
    const raw = value as Record<string, unknown>;
    const latitude =
      typeof raw.latitude === 'number' ? raw.latitude : Number(raw.latitude);
    const longitude =
      typeof raw.longitude === 'number' ? raw.longitude : Number(raw.longitude);
    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new ChatServerError(
        'message_location_invalid',
        'Location coordinates are invalid',
      );
    }
    const label =
      typeof raw.label === 'string' && raw.label.trim().length > 0
        ? raw.label.trim().slice(0, 120)
        : null;
    return {
      latitude,
      longitude,
      label,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }

  private isUniqueConstraintError(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }
    if (error.code === 'P2002') {
      return true;
    }
    return (
      error.code === 'P2010' &&
      typeof error.meta?.code === 'string' &&
      error.meta.code === '23505'
    );
  }

  private shouldTouchChatForMessage(chatId: string, nowMs: number) {
    if (this.messageChatTouchIntervalMs <= 0) {
      return true;
    }

    const lastTouchedAt = this.lastMessageChatTouchAt.get(chatId);
    if (lastTouchedAt != null && nowMs - lastTouchedAt < this.messageChatTouchIntervalMs) {
      return false;
    }

    this.lastMessageChatTouchAt.set(chatId, nowMs);
    return true;
  }

  private async editMessage(socket: WebSocket, payload: any) {
    const state = await this.requireAuthenticated(socket);
    const chatId = payload?.chatId as string | undefined;
    const messageId = payload?.messageId as string | undefined;
    const text =
      typeof payload?.text === 'string' ? payload.text.trim() : '';

    if (!chatId || !messageId) {
      throw new Error('chatId and messageId are required');
    }

    if (text.length === 0) {
      throw new ChatServerError(
        'message_payload_empty',
        'text is required',
      );
    }

    if (text.length > this.maxMessageTextLength) {
      throw new ChatServerError(
        'message_text_too_long',
        'Message text is too long',
      );
    }

    await this.assertMembership(state.userId!, chatId);

    const result = await this.prismaService.client.$transaction(async (tx) => {
      const existing = await tx.message.findFirst({
        where: {
          id: messageId,
          chatId,
          senderId: state.userId!,
        },
        select: { id: true },
      });

      if (!existing) {
        throw new ChatServerError(
          'message_not_found',
          'Message was not found',
        );
      }

      const updated = await tx.message.update({
        where: { id: messageId },
        data: { text },
        select: chatMessageSelect,
      });

      await tx.chat.update({
        where: { id: chatId },
        data: { updatedAt: new Date() },
      });

      const realtimeEvent = await tx.realtimeEvent.create({
        data: {
          chatId,
          eventType: 'message.updated',
          payload: this.mapMessage(updated),
        },
      });

      return {
        updated,
        realtimeEventId: realtimeEvent.id.toString(),
      };
    });

    const eventPayload = this.mapMessage(
      result.updated,
      result.realtimeEventId,
    );

    await publishBusEvent(this.publisher, {
      type: 'message.updated',
      payload: eventPayload,
    });

    if (!state.subscriptions.has(chatId)) {
      this.send(socket, {
        type: 'message.updated',
        payload: await this.mapMessageForUser(
          result.updated,
          result.realtimeEventId,
          state.userId!,
        ),
      });
    }
  }

  private async deleteMessage(socket: WebSocket, payload: any) {
    const state = await this.requireAuthenticated(socket);
    const chatId = payload?.chatId as string | undefined;
    const messageId = payload?.messageId as string | undefined;

    if (!chatId || !messageId) {
      throw new Error('chatId and messageId are required');
    }

    await this.assertMembership(state.userId!, chatId);

    const result = await this.prismaService.client.$transaction(async (tx) => {
      const existing = await tx.message.findFirst({
        where: {
          id: messageId,
          chatId,
          senderId: state.userId!,
        },
        select: {
          id: true,
          chatId: true,
          senderId: true,
          clientMessageId: true,
        },
      });

      if (!existing) {
        throw new ChatServerError(
          'message_not_found',
          'Message was not found',
        );
      }

      await tx.message.delete({
        where: { id: messageId },
      });

      await tx.chat.update({
        where: { id: chatId },
        data: { updatedAt: new Date() },
      });

      const payloadRecord = {
        chatId: existing.chatId,
        messageId: existing.id,
        senderId: existing.senderId,
        clientMessageId: existing.clientMessageId,
      };

      const realtimeEvent = await tx.realtimeEvent.create({
        data: {
          chatId,
          eventType: 'message.deleted',
          payload: payloadRecord,
        },
      });

      return {
        payloadRecord: {
          ...payloadRecord,
          eventId: realtimeEvent.id.toString(),
        },
      };
    });

    await publishBusEvent(this.publisher, {
      type: 'message.deleted',
      payload: result.payloadRecord,
    });

    if (!state.subscriptions.has(chatId)) {
      this.send(socket, {
        type: 'message.deleted',
        payload: result.payloadRecord,
      });
    }
  }

  private async markRead(socket: WebSocket, payload: any) {
    const state = await this.requireAuthenticated(socket);
    const chatId = payload?.chatId as string | undefined;
    const messageId = payload?.messageId as string | undefined;

    if (!chatId || !messageId) {
      throw new Error('chatId and messageId are required');
    }

    await this.assertMembership(state.userId!, chatId);
    const blockedUserIds = await this.getBlockedUserIds(state.userId!);
    const message = await this.prismaService.client.message.findFirst({
      where: {
        id: messageId,
        chatId,
        senderId: {
          notIn: [...blockedUserIds],
        },
      },
      select: { id: true },
    });

    if (!message) {
      throw new ChatServerError(
        'message_not_found',
        'Message was not found',
      );
    }

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
          unreadCount: 0,
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
    const state = await this.requireAuthenticated(socket);

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
    appMetrics.websocketSyncRequestsTotal.inc({
      service: METRICS_SERVICE,
      status: 'received',
    });
    const state = await this.requireAuthenticated(socket);
    const chatId = payload?.chatId as string | undefined;
    const sinceEventId = payload?.sinceEventId as string | undefined;
    const take = this.normalizeSyncEventLimit(payload?.limit);

    if (!chatId) {
      throw new Error('chatId is required');
    }

    await this.assertMembership(state.userId!, chatId);
    const blockedUserIds = await this.getBlockedUserIds(state.userId!);
    const parsedSinceEventId = this.parseSyncEventId(sinceEventId);

    if (sinceEventId != null && parsedSinceEventId == null) {
      this.send(socket, {
        type: 'sync.snapshot',
        payload: {
          chatId,
          sinceEventId,
          reset: true,
          hasMore: false,
          nextEventId: null,
          events: [],
        },
      });
      appMetrics.websocketSyncRequestsTotal.inc({
        service: METRICS_SERVICE,
        status: 'reset',
      });
      return;
    }

    if (
      parsedSinceEventId != null &&
      (await this.isSyncCursorOlderThanRetainedEvents(chatId, parsedSinceEventId))
    ) {
      this.send(socket, {
        type: 'sync.snapshot',
        payload: {
          chatId,
          sinceEventId,
          reset: true,
          hasMore: false,
          nextEventId: null,
          events: [],
        },
      });
      appMetrics.websocketSyncRequestsTotal.inc({
        service: METRICS_SERVICE,
        status: 'reset',
      });
      return;
    }

    const events = await this.prismaService.client.realtimeEvent.findMany({
      where: {
        chatId,
        ...(parsedSinceEventId != null
          ? {
              id: {
                gt: parsedSinceEventId,
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
          payload: this.sanitizeEventPayloadForBlockedUsers(
            event.payload,
            blockedUserIds,
          ),
          createdAt: event.createdAt.toISOString(),
        })),
      },
    });
    appMetrics.websocketSyncRequestsTotal.inc({
      service: METRICS_SERVICE,
      status: 'ok',
    });
  }

  private async isSyncCursorOlderThanRetainedEvents(
    chatId: string,
    sinceEventId: bigint,
  ) {
    const firstEvent = await this.prismaService.client.realtimeEvent.findFirst({
      where: { chatId },
      orderBy: { id: 'asc' },
      select: { id: true },
    });

    if (firstEvent == null) {
      return false;
    }

    return firstEvent.id > sinceEventId + BigInt(1);
  }

  private parseSyncEventId(eventId?: string) {
    if (eventId == null) {
      return null;
    }

    try {
      return BigInt(eventId);
    } catch {
      return null;
    }
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

      const serializedEvent = JSON.stringify(event);
      for (const socket of this.socketsByUserId.get(userId) ?? []) {
        const state = this.stateBySocket.get(socket);
        if (state?.userId === userId) {
          this.sendSerialized(socket, serializedEvent);
        }
      }
      return;
    }

    const chatId = event.payload?.chatId as string | undefined;
    if (!chatId) {
      return;
    }

    const actorUserId = this.getActorUserId(event);
    const replyAuthorId = this.getReplyAuthorId(event.payload);
    const subscribedSockets: WebSocket[] = [];
    const userIdsForBlockLookup = new Set<string>();
    if (actorUserId != null) {
      userIdsForBlockLookup.add(actorUserId);
    }

    for (const socket of this.socketsByChatId.get(chatId) ?? []) {
      const state = this.stateBySocket.get(socket);
      if (state == null || !state.subscriptions.has(chatId)) {
        continue;
      }

      subscribedSockets.push(socket);
      if (state.userId != null) {
        userIdsForBlockLookup.add(state.userId);
      }
    }

    if (subscribedSockets.length === 0) {
      return;
    }

    const blockedUserIdsByUserId = await this.getBlockedUserIdsByUserIds(
      [...userIdsForBlockLookup],
    );
    const actorBlockedUserIds =
      actorUserId == null ? null : blockedUserIdsByUserId.get(actorUserId) ?? new Set<string>();
    const serializedEvent = replyAuthorId == null ? JSON.stringify(event) : null;

    for (const socket of subscribedSockets) {
      const state = this.stateBySocket.get(socket);
      if (state == null) {
        continue;
      }

      if (
        actorBlockedUserIds != null &&
        state.userId != null &&
        actorUserId !== state.userId &&
        actorBlockedUserIds.has(state.userId)
      ) {
        continue;
      }

      if (this.shouldSkipDirectMessageAckedSocket(event, socket)) {
        continue;
      }

      if (replyAuthorId != null && state.userId != null) {
        const blockedForRecipient =
          blockedUserIdsByUserId.get(state.userId) ?? new Set<string>();

        this.send(socket, {
          ...event,
          payload: this.sanitizeEventPayloadForBlockedUsers(
            event.payload,
            blockedForRecipient,
          ),
        });
        continue;
      }

      if (serializedEvent != null) {
        this.sendSerialized(socket, serializedEvent);
      } else {
        this.send(socket, event);
      }
    }
  }

  private async getBlockedUserIdsByUserIds(userIds: string[]) {
    const uniqueUserIds = [...new Set(userIds)].filter((userId) => userId.length > 0);
    if (uniqueUserIds.length === 0) {
      return new Map<string, Set<string>>();
    }

    const rows = await this.prismaService.client.userBlock.findMany({
      where: {
        OR: [
          {
            userId: {
              in: uniqueUserIds,
            },
          },
          {
            blockedUserId: {
              in: uniqueUserIds,
            },
          },
        ],
      },
      select: {
        userId: true,
        blockedUserId: true,
      },
    });
    const uniqueUserIdSet = new Set(uniqueUserIds);
    const result = new Map<string, Set<string>>();
    const add = (userId: string, blockedUserId: string) => {
      const current = result.get(userId);
      if (current) {
        current.add(blockedUserId);
        return;
      }
      result.set(userId, new Set([blockedUserId]));
    };

    for (const row of rows) {
      if (uniqueUserIdSet.has(row.userId)) {
        add(row.userId, row.blockedUserId);
      }
      if (uniqueUserIdSet.has(row.blockedUserId)) {
        add(row.blockedUserId, row.userId);
      }
    }

    return result;
  }

  private rememberDirectMessageAckedSocket(payload: unknown, socket: WebSocket) {
    const key = this.directMessageAckKey(payload);
    if (key == null) {
      return;
    }

    const sockets = this.directMessageAckedSockets.get(key) ?? new Set<WebSocket>();
    sockets.add(socket);
    this.directMessageAckedSockets.set(key, sockets);

    const timer = setTimeout(() => {
      const current = this.directMessageAckedSockets.get(key);
      if (current == null) {
        return;
      }
      current.delete(socket);
      if (current.size === 0) {
        this.directMessageAckedSockets.delete(key);
      }
    }, DIRECT_MESSAGE_ACK_SKIP_TTL_MS);
    timer.unref?.();
  }

  private shouldSkipDirectMessageAckedSocket(event: Envelope, socket: WebSocket) {
    if (event.type !== 'message.created') {
      return false;
    }

    const key = this.directMessageAckKey(event.payload);
    if (key == null) {
      return false;
    }

    return this.directMessageAckedSockets.get(key)?.has(socket) ?? false;
  }

  private directMessageAckKey(payload: unknown) {
    if (payload == null || typeof payload !== 'object') {
      return null;
    }

    const value = payload as Record<string, unknown>;
    const chatId = typeof value.chatId === 'string' ? value.chatId : null;
    const senderId = typeof value.senderId === 'string' ? value.senderId : null;
    const clientMessageId =
      typeof value.clientMessageId === 'string' ? value.clientMessageId : null;

    if (chatId == null || senderId == null || clientMessageId == null) {
      return null;
    }

    return `${chatId}:${senderId}:${clientMessageId}`;
  }

  private normalizeUnreadUpdates(value: unknown): MessageUnreadUpdate[] {
    const items = typeof value === 'string' ? this.parseJsonArray(value) : value;
    if (!Array.isArray(items)) {
      return [];
    }

    return items.flatMap((item) => {
      if (item == null || typeof item !== 'object') {
        return [];
      }

      const record = item as Record<string, unknown>;
      const userId = typeof record.userId === 'string' ? record.userId : null;
      const unreadCount = Number(record.unreadCount);
      if (userId == null || !Number.isFinite(unreadCount)) {
        return [];
      }

      return [{ userId, unreadCount }];
    });
  }

  private parseJsonArray(value: string) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async publishUnreadUpdates(chatId: string, updates: MessageUnreadUpdate[]) {
    await Promise.all(
      updates.map((update) =>
        publishBusEvent(this.publisher, {
          type: 'unread.updated',
          payload: {
            userId: update.userId,
            chatId,
            unreadCount: update.unreadCount,
          },
        }),
      ),
    );
  }

  private async requireAuthenticated(socket: WebSocket) {
    const state = this.getState(socket);
    if (!state.userId || !state.sessionId) {
      throw new Error('Not authenticated');
    }

    const now = Date.now();
    if (state.tokenExpiresAtMs != null && state.tokenExpiresAtMs <= now) {
      this.clearAuthenticatedState(socket, state);
      throw new ChatServerError('stale_access_token', 'Access token is stale');
    }

    if (
      this.authRecheckMs > 0 &&
      state.authCheckedAtMs != null &&
      now - state.authCheckedAtMs < this.authRecheckMs
    ) {
      return state;
    }

    const session = await this.loadSession(state.sessionId);

    if (!session || session.userId !== state.userId || session.revokedAt != null) {
      this.clearAuthenticatedState(socket, state);
      throw new ChatServerError('stale_access_token', 'Access token is stale');
    }

    state.authCheckedAtMs = now;
    return state;
  }

  private async loadSession(sessionId: string): Promise<AuthSessionSnapshot | null> {
    const cached = this.getAuthSessionCache(sessionId);
    if (cached != null) {
      return cached;
    }

    const pending = this.pendingAuthSessionLoads.get(sessionId);
    if (pending != null) {
      return pending;
    }

    const loading = this.loadFreshSession(sessionId)
      .then((session) => {
        if (session != null && session.revokedAt == null) {
          this.setAuthSessionCache(sessionId, session);
        }
        return session;
      })
      .finally(() => {
        this.pendingAuthSessionLoads.delete(sessionId);
      });
    this.pendingAuthSessionLoads.set(sessionId, loading);
    return loading;
  }

  private async loadFreshSession(sessionId: string): Promise<AuthSessionSnapshot | null> {
    return this.prismaService.client.session.findUnique({
      where: { id: sessionId },
      select: {
        userId: true,
        revokedAt: true,
      },
    });
  }

  private getAuthSessionCache(sessionId: string) {
    const entry = this.authSessionCache.get(sessionId);
    if (entry == null) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.authSessionCache.delete(sessionId);
      return null;
    }
    return entry.value;
  }

  private setAuthSessionCache(sessionId: string, session: AuthSessionSnapshot) {
    if (this.authSessionCache.size >= AUTH_SESSION_CACHE_MAX_ENTRIES) {
      const oldestKey = this.authSessionCache.keys().next().value;
      if (oldestKey) {
        this.authSessionCache.delete(oldestKey);
      }
    }
    this.authSessionCache.set(sessionId, {
      expiresAt: Date.now() + AUTH_SESSION_CACHE_SECONDS * 1000,
      value: session,
    });
  }

  private getState(socket: WebSocket): SocketState {
    const state = this.stateBySocket.get(socket);
    if (!state) {
      throw new Error('Socket state not found');
    }
    return state;
  }

  private send(socket: WebSocket, event: Envelope) {
    this.sendSerialized(socket, JSON.stringify(event));
  }

  private sendSerialized(socket: WebSocket, payload: string) {
    const bufferedAmount =
      typeof socket.bufferedAmount === 'number' ? socket.bufferedAmount : 0;
    const eventType = this.metricsEventTypeFromSerializedPayload(payload);
    if (
      socket.readyState === WebSocket.OPEN &&
      bufferedAmount <= this.maxBufferedBytes
    ) {
      try {
        socket.send(payload);
        appMetrics.websocketOutboundTotal.inc({
          service: METRICS_SERVICE,
          event_type: eventType,
          status: 'ok',
        });
        this.recordPayloadSize(
          eventType,
          'outbound',
          Buffer.byteLength(payload),
        );
      } catch (error) {
        appMetrics.websocketDroppedTotal.inc({
          service: METRICS_SERVICE,
          event_type: eventType,
          reason: 'send_error',
        });
        console.error('[chat] websocket send failed', error);
        this.terminateSocket(socket);
      }
      return;
    }

    appMetrics.websocketDroppedTotal.inc({
      service: METRICS_SERVICE,
      event_type: eventType,
      reason:
        socket.readyState === WebSocket.OPEN
          ? 'buffered_amount'
          : 'socket_not_open',
    });
  }

  private metricsEventTypeFromSerializedPayload(payload: string) {
    try {
      const parsed = JSON.parse(payload) as Partial<Envelope>;
      return this.metricsEventType(parsed.type);
    } catch {
      return 'unknown';
    }
  }

  private metricsEventType(type: unknown) {
    return typeof type === 'string' && type.length > 0 ? type : 'unknown';
  }

  private recordPayloadSize(
    eventType: string,
    direction: 'inbound' | 'outbound',
    bytes: number,
  ) {
    appMetrics.payloadSizeBytes.observe(
      { service: METRICS_SERVICE, event_type: eventType, direction },
      bytes,
    );

    if (bytes <= this.payloadWarnBytes) {
      return;
    }

    appMetrics.payloadWarningTotal.inc({
      service: METRICS_SERVICE,
      event_type: eventType,
      direction,
    });
  }

  private rawDataByteLength(raw: RawData) {
    if (Array.isArray(raw)) {
      return raw.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    }

    return raw.byteLength;
  }

  private rawDataToString(raw: RawData) {
    if (Array.isArray(raw)) {
      return Buffer.concat(raw).toString();
    }

    if (Buffer.isBuffer(raw)) {
      return raw.toString();
    }

    return Buffer.from(raw).toString();
  }

  private cleanupSocket(socket: WebSocket) {
    const state = this.stateBySocket.get(socket);
    if (!state) {
      return;
    }

    this.clearAuthenticatedState(socket, state);
    this.stateBySocket.delete(socket);
    this.lastTypingSentAtBySocket.delete(socket);
    this.updateWebSocketGauges();
  }

  private terminateSocket(socket: WebSocket) {
    this.cleanupSocket(socket);
    try {
      socket.terminate();
    } catch (error) {
      console.error('[chat] websocket terminate failed', error);
    }
  }

  private logRedisError(scope: string, error: unknown) {
    console.error(`[chat] redis ${scope} error`, error);
  }

  private clearAuthenticatedState(socket: WebSocket, state: SocketState) {
    if (state.userId != null) {
      this.removeIndexedSocket(this.socketsByUserId, state.userId, socket);
    }

    for (const chatId of state.subscriptions) {
      this.removeIndexedSocket(this.socketsByChatId, chatId, socket);
    }

    state.subscriptions.clear();
    state.userId = undefined;
    state.sessionId = undefined;
    state.tokenExpiresAtMs = undefined;
    state.authCheckedAtMs = undefined;
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
    const now = Date.now();
    const cachedUntil = this.membershipCache.get(membershipCacheKey);
    if (cachedUntil != null && cachedUntil > now) {
      appMetrics.websocketMembershipCacheTotal.inc({
        service: METRICS_SERVICE,
        status: 'hit',
      });
      return;
    }
    if (cachedUntil != null) {
      this.membershipCache.delete(membershipCacheKey);
    }
    appMetrics.websocketMembershipCacheTotal.inc({
      service: METRICS_SERVICE,
      status: 'miss',
    });

    const pending = this.pendingMembershipChecks.get(membershipCacheKey);
    if (pending != null) {
      await pending;
      return;
    }

    const loading = this.loadMembership(userId, chatId, membershipCacheKey)
      .finally(() => {
        this.pendingMembershipChecks.delete(membershipCacheKey);
      });
    this.pendingMembershipChecks.set(membershipCacheKey, loading);
    await loading;
  }

  private async loadMembership(
    userId: string,
    chatId: string,
    membershipCacheKey: string,
  ) {
    let membership = await this.prismaService.client.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
      select: {
        chat: {
          select: {
            kind: true,
            event: {
              select: {
                hostId: true,
              },
            },
          },
        },
      },
    });

    if (!membership) {
      membership = await this.restoreMeetupChatMembership(userId, chatId);
      if (!membership) {
        throw new ChatServerError('chat_forbidden', 'Not a chat member');
      }
    }

    if (membership.chat.kind === 'direct') {
      const peer = await this.prismaService.client.chatMember.findFirst({
        where: {
          chatId,
          userId: {
            not: userId,
          },
        },
        select: {
          userId: true,
        },
      });
      if (peer?.userId != null) {
        const blockedUserIds = await this.getBlockedUserIds(userId);
        if (blockedUserIds.has(peer.userId)) {
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
      this.setMembershipCache(
        membershipCacheKey,
        Date.now() + this.membershipCacheTtlMs,
      );
    }
  }

  private async restoreMeetupChatMembership(userId: string, chatId: string) {
    const chat = await this.prismaService.client.chat.findUnique({
      where: { id: chatId },
      select: {
        kind: true,
        event: {
          select: {
            hostId: true,
            participants: {
              where: { userId },
              select: { userId: true },
              take: 1,
            },
          },
        },
      },
    });

    if (chat?.kind !== 'meetup' || chat.event == null) {
      return null;
    }

    const hasEventAccess =
      chat.event.hostId === userId || chat.event.participants.length > 0;
    if (!hasEventAccess) {
      return null;
    }

    await this.prismaService.client.chatMember.upsert({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
      update: {},
      create: {
        chatId,
        userId,
      },
    });

    return {
      chat: {
        kind: chat.kind,
        event: {
          hostId: chat.event.hostId,
        },
      },
    };
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

  private setMembershipCache(key: string, expiresAt: number) {
    this.membershipCache.set(key, expiresAt);
    if (this.membershipCache.size <= this.membershipCacheMaxEntries) {
      return;
    }

    this.pruneExpiredMembershipCacheEntries(Date.now());
    while (this.membershipCache.size > this.membershipCacheMaxEntries) {
      const oldestKey = this.membershipCache.keys().next().value as string | undefined;
      if (oldestKey == null) {
        break;
      }
      this.membershipCache.delete(oldestKey);
    }
  }

  private pruneExpiredMembershipCacheEntries(now: number) {
    for (const [key, expiresAt] of this.membershipCache) {
      if (expiresAt <= now) {
        this.membershipCache.delete(key);
      }
    }
  }

  private resolveDurationMs(raw: string | undefined, fallback: number) {
    const parsed = raw == null ? fallback : Number(raw);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.max(0, Math.trunc(parsed));
  }

  private resolvePositiveInteger(raw: string | undefined, fallback: number) {
    const parsed = raw == null ? fallback : Number(raw);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.max(1, Math.trunc(parsed));
  }

  private resolveBoolean(raw: string | undefined, fallback: boolean) {
    if (raw == null || raw.trim() === '') {
      return fallback;
    }
    return !['0', 'false', 'off', 'no'].includes(raw.trim().toLowerCase());
  }

  private async getBlockedUserIds(userId: string) {
    const cached = this.getBlockedUserIdsCache(userId);
    if (cached != null) {
      return cached;
    }

    const pending = this.pendingBlockedUserLoads.get(userId);
    if (pending != null) {
      return pending;
    }

    const loading = loadBlockedUserIds(this.prismaService.client, userId)
      .then((blockedUserIds) => {
        this.setBlockedUserIdsCache(userId, blockedUserIds);
        return blockedUserIds;
      })
      .finally(() => {
        this.pendingBlockedUserLoads.delete(userId);
      });
    this.pendingBlockedUserLoads.set(userId, loading);
    return loading;
  }

  private getBlockedUserIdsCache(userId: string) {
    const entry = this.blockedUserIdsCache.get(userId);
    if (entry == null) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.blockedUserIdsCache.delete(userId);
      return null;
    }
    return entry.value;
  }

  private setBlockedUserIdsCache(userId: string, blockedUserIds: Set<string>) {
    if (this.blockedUserIdsCache.size >= BLOCKED_USER_IDS_CACHE_MAX_ENTRIES) {
      const oldestKey = this.blockedUserIdsCache.keys().next().value;
      if (oldestKey) {
        this.blockedUserIdsCache.delete(oldestKey);
      }
    }
    this.blockedUserIdsCache.set(userId, {
      expiresAt: Date.now() + BLOCKED_USER_IDS_CACHE_SECONDS * 1000,
      value: blockedUserIds,
    });
  }

  private async getMessageAuthor(userId: string): Promise<MessageAuthorSnapshot> {
    const cached = this.getMessageAuthorCache(userId);
    if (cached != null) {
      return cached;
    }

    const pending = this.pendingMessageAuthorLoads.get(userId);
    if (pending != null) {
      return pending;
    }

    const loading = this.prismaService.client.user.findUnique({
      where: { id: userId },
      select: {
        displayName: true,
        profile: {
          select: {
            avatarUrl: true,
          },
        },
      },
    }).then((user) => {
      if (user == null) {
        throw new ChatServerError('stale_access_token', 'Access token is stale');
      }

      const author = {
        displayName: user.displayName,
        profile: user.profile ?? null,
      };
      this.setMessageAuthorCache(userId, author);
      return author;
    }).finally(() => {
      this.pendingMessageAuthorLoads.delete(userId);
    });

    this.pendingMessageAuthorLoads.set(userId, loading);
    return loading;
  }

  private getMessageAuthorCache(userId: string) {
    const entry = this.messageAuthorCache.get(userId);
    if (entry == null) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.messageAuthorCache.delete(userId);
      return null;
    }
    return entry.value;
  }

  private setMessageAuthorCache(
    userId: string,
    author: MessageAuthorSnapshot,
  ) {
    if (this.messageAuthorCache.size >= MESSAGE_AUTHOR_CACHE_MAX_ENTRIES) {
      const oldestKey = this.messageAuthorCache.keys().next().value;
      if (oldestKey) {
        this.messageAuthorCache.delete(oldestKey);
      }
    }
    this.messageAuthorCache.set(userId, {
      expiresAt: Date.now() + MESSAGE_AUTHOR_CACHE_SECONDS * 1000,
      value: author,
    });
  }

  private updateWebSocketGauges() {
    appMetrics.websocketActiveConnections.set(
      { service: METRICS_SERVICE },
      this.stateBySocket.size,
    );
    appMetrics.websocketAuthenticatedConnections.set(
      { service: METRICS_SERVICE },
      [...this.socketsByUserId.values()].reduce((sum, sockets) => sum + sockets.size, 0),
    );
    appMetrics.websocketSubscribedRooms.set(
      { service: METRICS_SERVICE },
      this.socketsByChatId.size,
    );
  }

  private async isUserBlocked(userId: string, targetUserId: string) {
    const blockedUserIds = await this.getBlockedUserIds(userId);
    return blockedUserIds.has(targetUserId);
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

  private getReplyAuthorId(payload: unknown) {
    if (payload == null || typeof payload !== 'object') {
      return undefined;
    }

    const replyTo = (payload as { replyTo?: unknown }).replyTo;
    if (replyTo == null || typeof replyTo !== 'object') {
      return undefined;
    }

    const authorId = (replyTo as { authorId?: unknown }).authorId;
    return typeof authorId === 'string' ? authorId : undefined;
  }

  private sanitizeEventPayloadForBlockedUsers(
    payload: unknown,
    blockedUserIds: Set<string>,
  ) {
    const replyAuthorId = this.getReplyAuthorId(payload);
    if (replyAuthorId == null || !blockedUserIds.has(replyAuthorId)) {
      return payload;
    }

    return {
      ...(payload as Record<string, unknown>),
      replyTo: null,
    };
  }

  private async mapMessageForUser(
    message: Parameters<ChatServerService['mapMessage']>[0],
    eventId: string | undefined,
    userId: string,
  ) {
    const payload = this.mapMessage(message, eventId);
    if (this.getReplyAuthorId(payload) == null) {
      return payload;
    }

    return this.sanitizeEventPayloadForBlockedUsers(
      payload,
      await this.getBlockedUserIds(userId),
    );
  }

  private mapMessage(message: {
    id: string;
    chatId: string;
    senderId: string;
    text: string;
    clientMessageId: string;
    locationLatitude?: number | null;
    locationLongitude?: number | null;
    locationLabel?: string | null;
    locationExpiresAt?: Date | null;
    createdAt: Date;
    sender: {
      displayName: string;
      profile?: { avatarUrl: string | null } | null;
    };
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
        mimeType: string;
        byteSize: number;
        durationMs: number | null;
        waveform: number[];
        originalFileName: string;
      };
    }>;
  }, eventId?: string) {
    return {
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      senderName: message.sender.displayName,
      senderAvatarUrl: message.sender.profile?.avatarUrl ?? null,
      text: message.text,
      clientMessageId: message.clientMessageId,
      createdAt: message.createdAt.toISOString(),
      ...(eventId != null ? { eventId } : {}),
      location:
        message.locationLatitude == null ||
        message.locationLongitude == null ||
        message.locationExpiresAt == null
          ? null
          : {
              latitude: message.locationLatitude,
              longitude: message.locationLongitude,
              label: message.locationLabel ?? null,
              expiresAt: message.locationExpiresAt.toISOString(),
            },
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
