# Push Notifications MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver release MVP push notifications for likes, meetup notifications, verification, event reminders and new chat messages.

**Architecture:** Keep push delivery async through the existing `OutboxEvent` worker path. Normal product notifications keep using `Notification` rows. Chat messages use the existing `message.notification_fanout` outbox type for push fanout without adding rows to the central notification list.

**Tech Stack:** NestJS services, Prisma, worker outbox, APNS, FCM, Flutter, Riverpod, GoRouter, `firebase_messaging`, iOS `FlutterMethodChannel`.

---

## File Structure

- Modify `backend/apps/chat/src/chat-server.service.ts`
  - Enqueue `OUTBOX_EVENT_TYPES.messageNotificationFanout` when a message is written.
- Modify `backend/apps/chat/test/unit/chat-server.service.unit.spec.ts`
  - Cover the extra chat outbox event.
- Modify `backend/apps/worker/src/worker.service.ts`
  - Add enriched data to normal notification pushes.
  - Implement `message.notification_fanout` as real chat push fanout.
- Modify `backend/apps/worker/test/unit/worker.service.spec.ts`
  - Cover notification push data and chat push fanout.
- Create `mobile2/lib/app/core/device/app_push_navigation.dart`
  - Map push and notification payloads to app routes.
- Create `mobile2/test/core/app_push_navigation_test.dart`
  - Cover route mapping for chat, meetup, profile and fallback payloads.
- Create `mobile2/lib/app/core/device/app_push_notification_controller.dart`
  - Listen for push taps and route through `GoRouter`.
- Modify `mobile2/lib/app/dateasy_app.dart`
  - Start the push notification controller near the existing app links listener.
- Modify `mobile2/lib/features/notifications/presentation/notifications_screen.dart`
  - Reuse `appRouteForPushPayload` instead of local route parsing.
- Create `mobile2/test/core/app_push_notification_controller_test.dart`
  - Cover controller routing without depending on real Firebase.
- Modify `ai-context/infra.md`, `ai-context/realtime-chat.md` and `ai-context/frontend-flutter.md` only if implementation changes the documented flow.

## Task 1: Enqueue Chat Message Push Fanout

**Files:**
- Modify: `backend/apps/chat/src/chat-server.service.ts`
- Modify: `backend/apps/chat/test/unit/chat-server.service.unit.spec.ts`

- [ ] **Step 1: Write the failing chat server test**

Add a unit test near the existing `message.send` tests or the `updatedAt` message tests:

```ts
it('queues message notification fanout when a plain message is written through the fast path', async () => {
  const queryRaw = jest.fn().mockResolvedValue([{ realtime_event_id: 'event-1' }]);
  const service = new ChatServerService({
    client: {
      $queryRaw: queryRaw,
    },
  } as any);
  (service as any).messageInlineUnreadUpdates = false;
  (service as any).shouldTouchChatForMessage = jest.fn().mockReturnValue(false);

  await (service as any).createPlainMessageFast({
    chatId: 'chat-1',
    senderId: 'user-sender',
    text: 'Привет',
    clientMessageId: 'client-1',
    location: null,
    author: {
      displayName: 'Саша',
      profile: { avatarUrl: null },
    },
  });

  const sql = String(queryRaw.mock.calls[0][0]);
  expect(sql).toContain('message.notification_fanout');
  expect(sql).toContain('messageId');
  expect(sql).toContain('chatId');
  expect(sql).toContain('actorUserId');
});
```

Add a focused helper test by extracting message outbox payload building into a private method in Step 3:

```ts
it('builds unread and message notification outbox rows for message writes', () => {
  const service = new ChatServerService({ client: {} } as any);
  const rows = (service as any).messageOutboxRows({
    chatId: 'chat-1',
    actorUserId: 'user-sender',
    messageId: 'message-1',
    messageCreatedAt: new Date('2026-06-02T08:00:00.000Z'),
    includeUnreadFanout: true,
  });

  expect(rows).toEqual([
    {
      type: 'chat.unread_fanout',
      payload: {
        chatId: 'chat-1',
        actorUserId: 'user-sender',
        messageCreatedAt: '2026-06-02T08:00:00.000Z',
      },
    },
    {
      type: 'message.notification_fanout',
      payload: {
        chatId: 'chat-1',
        actorUserId: 'user-sender',
        messageId: 'message-1',
        messageCreatedAt: '2026-06-02T08:00:00.000Z',
      },
    },
  ]);
});
```

- [ ] **Step 2: Run the failing chat test**

Run:

```bash
cd backend && pnpm --filter @big-break/chat test -- --runInBand test/unit/chat-server.service.unit.spec.ts
```

Expected: the new fast-path test fails because the SQL inserts only `chat.unread_fanout`.

- [ ] **Step 3: Add message notification outbox events**

In `createPlainMessageFast`, add a second outbox id:

```ts
const outboxEventId = randomUUID();
const messageNotificationOutboxEventId = randomUUID();
```

In the `!this.messageInlineUnreadUpdates` CTE, replace the single `inserted_outbox` CTE with two focused CTEs:

```ts
inserted_unread_outbox AS (
  INSERT INTO "OutboxEvent" ("id", "type", "payload", "createdAt", "availableAt")
  SELECT
    ${outboxEventId},
    ${OUTBOX_EVENT_TYPES.chatUnreadFanout},
    jsonb_build_object(
      'chatId', ${params.chatId},
      'actorUserId', ${params.senderId},
      'messageCreatedAt', ${now.toISOString()}
    ),
    ${now},
    ${now}
  FROM inserted_message
  RETURNING "id"
),
inserted_message_notification_outbox AS (
  INSERT INTO "OutboxEvent" ("id", "type", "payload", "createdAt", "availableAt")
  SELECT
    ${messageNotificationOutboxEventId},
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
)
```

In the inline unread CTE path, add only `message.notification_fanout`, because unread was updated inline:

```ts
inserted_message_notification_outbox AS (
  INSERT INTO "OutboxEvent" ("id", "type", "payload", "createdAt", "availableAt")
  SELECT
    ${messageNotificationOutboxEventId},
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
)
```

Add a private helper to `ChatServerService`:

```ts
private messageOutboxRows(params: {
  chatId: string;
  actorUserId: string;
  messageId: string;
  messageCreatedAt: Date;
  includeUnreadFanout: boolean;
}) {
  const messageCreatedAt = params.messageCreatedAt.toISOString();
  return [
    ...(params.includeUnreadFanout
      ? [
          {
            type: OUTBOX_EVENT_TYPES.chatUnreadFanout,
            payload: {
              chatId: params.chatId,
              actorUserId: params.actorUserId,
              messageCreatedAt,
            },
          },
        ]
      : []),
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
```

In the Prisma transaction path, replace `tx.outboxEvent.create` with:

```ts
await tx.outboxEvent.createMany({
  data: this.messageOutboxRows({
    chatId,
    actorUserId: state.userId!,
    messageId: created.id,
    messageCreatedAt: created.createdAt,
    includeUnreadFanout: true,
  }),
});
```

- [ ] **Step 4: Run chat test again**

Run:

```bash
cd backend && pnpm --filter @big-break/chat test -- --runInBand test/unit/chat-server.service.unit.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit task 1**

Run:

```bash
git add backend/apps/chat/src/chat-server.service.ts backend/apps/chat/test/unit/chat-server.service.unit.spec.ts
git commit -m "feat: enqueue chat message push fanout"
```

## Task 2: Add Route Data To Normal Notification Pushes

**Files:**
- Modify: `backend/apps/worker/src/worker.service.ts`
- Modify: `backend/apps/worker/test/unit/worker.service.spec.ts`

- [ ] **Step 1: Write the failing worker test**

Add a test in `worker.service.spec.ts`:

```ts
it('adds route-safe data to notification push dispatches', async () => {
  const send = jest.fn().mockResolvedValue(undefined);
  const service = new WorkerService({
    client: {
      notification: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'notification-1',
          userId: 'user-1',
          actorUserId: 'actor-1',
          kind: 'event_invite',
          title: 'Новая заявка',
          body: 'Анна хочет на встречу',
          chatId: null,
          messageId: null,
          eventId: 'event-1',
          requestId: 'request-1',
          payload: {
            eventId: 'event-1',
            requestId: 'request-1',
            invite: true,
          },
        }),
      },
      userBlock: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({ allowPush: true, quietHours: false }),
      },
      pushToken: {
        findMany: jest.fn().mockResolvedValue([
          { provider: 'fcm', token: 'token-1' },
        ]),
      },
    },
  } as any);
  (service as any).fcmPushProvider = { send };

  await (service as any).handlePushDispatch({
    userId: 'user-1',
    notificationId: 'notification-1',
  });

  expect(send).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({
      type: 'notification',
      notificationId: 'notification-1',
      notificationKind: 'event_invite',
      eventId: 'event-1',
      requestId: 'request-1',
      invite: 'true',
    }),
  }));
});
```

- [ ] **Step 2: Run the failing worker test**

Run:

```bash
cd backend && pnpm --filter @big-break/worker test:unit -- worker.service.spec.ts
```

Expected: FAIL because `handlePushDispatch` only sends `notificationId`.

- [ ] **Step 3: Load notification fields needed for route data**

In `handlePushDispatch`, extend the notification select:

```ts
select: {
  id: true,
  userId: true,
  actorUserId: true,
  kind: true,
  title: true,
  body: true,
  chatId: true,
  messageId: true,
  eventId: true,
  requestId: true,
  payload: true,
},
```

Add helper methods near `handlePushDispatch`:

```ts
private buildNotificationPushData(notification: {
  id: string;
  kind: string;
  chatId?: string | null;
  messageId?: string | null;
  eventId?: string | null;
  requestId?: string | null;
  actorUserId?: string | null;
  payload?: unknown;
}) {
  const data: Record<string, string> = {
    type: 'notification',
    notificationId: notification.id,
    notificationKind: notification.kind,
  };
  this.assignPushDataValue(data, 'chatId', notification.chatId);
  this.assignPushDataValue(data, 'messageId', notification.messageId);
  this.assignPushDataValue(data, 'eventId', notification.eventId);
  this.assignPushDataValue(data, 'requestId', notification.requestId);
  this.assignPushDataValue(data, 'actorUserId', notification.actorUserId);
  if (notification.payload && typeof notification.payload === 'object') {
    const payload = notification.payload as Record<string, unknown>;
    this.assignPushDataValue(data, 'source', payload.source);
    this.assignPushDataValue(data, 'action', payload.action);
    this.assignPushDataValue(data, 'userId', payload.userId);
    this.assignPushDataValue(data, 'eventId', payload.eventId);
    this.assignPushDataValue(data, 'requestId', payload.requestId);
    this.assignPushDataValue(data, 'chatId', payload.chatId);
    if (payload.invite === true) {
      data.invite = 'true';
    }
  }
  return data;
}

private assignPushDataValue(
  data: Record<string, string>,
  key: string,
  value: unknown,
) {
  if (typeof value === 'string' && value.trim().length > 0) {
    data[key] = value.trim();
  }
}
```

Change the provider send call:

```ts
await provider.send({
  token: token.token,
  title: notification.title,
  body: notification.body,
  data: this.buildNotificationPushData(notification),
});
```

- [ ] **Step 4: Run worker test again**

Run:

```bash
cd backend && pnpm --filter @big-break/worker test:unit -- worker.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit task 2**

Run:

```bash
git add backend/apps/worker/src/worker.service.ts backend/apps/worker/test/unit/worker.service.spec.ts
git commit -m "feat: add push route data"
```

## Task 3: Implement Chat Message Push Fanout In Worker

**Files:**
- Modify: `backend/apps/worker/src/worker.service.ts`
- Modify: `backend/apps/worker/test/unit/worker.service.spec.ts`

- [ ] **Step 1: Write failing worker tests for chat push**

Add this test:

```ts
it('sends chat message pushes to recipients and skips the sender', async () => {
  const send = jest.fn().mockResolvedValue(undefined);
  const client = {
    message: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'message-1',
        chatId: 'chat-1',
        senderId: 'user-sender',
        text: 'Привет, идем?',
        attachments: [],
        sender: { displayName: 'Саша' },
        chat: { kind: 'direct', title: null },
      }),
    },
    chatMember: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'member-2', userId: 'user-recipient' },
      ]),
    },
    userBlock: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    userSettings: {
      findMany: jest.fn().mockResolvedValue([
        { userId: 'user-recipient', allowPush: true, quietHours: false },
      ]),
    },
    pushToken: {
      findMany: jest.fn().mockResolvedValue([
        { userId: 'user-recipient', provider: 'fcm', token: 'token-1' },
      ]),
    },
  };
  const service = new WorkerService({ client } as any);
  (service as any).fcmPushProvider = { send };

  await (service as any).handleMessageNotificationFanout({
    chatId: 'chat-1',
    actorUserId: 'user-sender',
    messageId: 'message-1',
  });

  expect(send).toHaveBeenCalledWith({
    token: 'token-1',
    title: 'Саша',
    body: 'Привет, идем?',
    data: {
      type: 'chat_message',
      chatId: 'chat-1',
      messageId: 'message-1',
      kind: 'direct',
    },
  });
});
```

Add a media-only preview test:

```ts
it('uses a generic body for media-only chat message pushes', async () => {
  const send = jest.fn().mockResolvedValue(undefined);
  const client = {
    message: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'message-1',
        chatId: 'chat-1',
        senderId: 'user-sender',
        text: '',
        attachments: [{ mediaAssetId: 'asset-1' }],
        sender: { displayName: 'Саша' },
        chat: { kind: 'event', title: 'Кофе' },
      }),
    },
    chatMember: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'member-2', userId: 'user-recipient' },
      ]),
    },
    userBlock: { findFirst: jest.fn().mockResolvedValue(null) },
    userSettings: {
      findMany: jest.fn().mockResolvedValue([
        { userId: 'user-recipient', allowPush: true, quietHours: false },
      ]),
    },
    pushToken: {
      findMany: jest.fn().mockResolvedValue([
        { userId: 'user-recipient', provider: 'fcm', token: 'token-1' },
      ]),
    },
  };
  const service = new WorkerService({ client } as any);
  (service as any).fcmPushProvider = { send };

  await (service as any).handleMessageNotificationFanout({
    chatId: 'chat-1',
    actorUserId: 'user-sender',
    messageId: 'message-1',
  });

  expect(send).toHaveBeenCalledWith(expect.objectContaining({
    title: 'Саша',
    body: 'Новое сообщение',
  }));
});
```

- [ ] **Step 2: Run failing worker tests**

Run:

```bash
cd backend && pnpm --filter @big-break/worker test:unit -- worker.service.spec.ts
```

Expected: FAIL because `message.notification_fanout` still calls unread fanout.

- [ ] **Step 3: Route `message.notification_fanout` to a new handler**

In `processEvent`, change:

```ts
case OUTBOX_EVENT_TYPES.messageNotificationFanout:
  await this.handleChatUnreadFanout(event.payload as {
    chatId?: string;
    actorUserId?: string;
    cursor?: string;
    messageCreatedAt?: string;
  });
  break;
```

to:

```ts
case OUTBOX_EVENT_TYPES.messageNotificationFanout:
  await this.handleMessageNotificationFanout(event.payload as {
    chatId?: string;
    actorUserId?: string;
    messageId?: string;
    cursor?: string;
  });
  break;
```

- [ ] **Step 4: Implement `handleMessageNotificationFanout`**

Add this method near `handleChatUnreadFanout`:

```ts
private async handleMessageNotificationFanout(payload: {
  chatId?: string;
  actorUserId?: string;
  messageId?: string;
  cursor?: string;
}) {
  if (
    typeof payload.chatId !== 'string' ||
    typeof payload.actorUserId !== 'string' ||
    typeof payload.messageId !== 'string'
  ) {
    return;
  }

  const message = await this.prismaService.client.message.findUnique({
    where: { id: payload.messageId },
    select: {
      id: true,
      chatId: true,
      senderId: true,
      text: true,
      attachments: { select: { mediaAssetId: true }, take: 1 },
      sender: { select: { displayName: true } },
      chat: { select: { kind: true, title: true } },
    },
  });
  if (!message || message.chatId !== payload.chatId) {
    return;
  }

  const members = await this.prismaService.client.chatMember.findMany({
    where: {
      chatId: payload.chatId,
      userId: { not: payload.actorUserId },
      ...(typeof payload.cursor === 'string'
        ? { id: { gt: payload.cursor } }
        : {}),
    },
    select: { id: true, userId: true },
    orderBy: { id: 'asc' },
    take: this.messageNotificationBatchSize + 1,
  });
  const hasMore = members.length > this.messageNotificationBatchSize;
  const page = hasMore
    ? members.slice(0, this.messageNotificationBatchSize)
    : members;
  if (page.length === 0) {
    return;
  }

  if (hasMore) {
    await this.prismaService.client.outboxEvent.create({
      data: {
        type: OUTBOX_EVENT_TYPES.messageNotificationFanout,
        payload: {
          chatId: payload.chatId,
          actorUserId: payload.actorUserId,
          messageId: payload.messageId,
          cursor: page[page.length - 1]!.id,
        },
      },
    });
  }

  const recipients = await this.filterPushAllowedRecipients(
    page.map((member) => member.userId),
    payload.actorUserId,
  );
  if (recipients.length === 0) {
    return;
  }

  const tokens = await this.prismaService.client.pushToken.findMany({
    where: {
      userId: { in: recipients },
      disabledAt: null,
    },
    select: {
      userId: true,
      provider: true,
      token: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: this.pushTokenBatchSize * recipients.length,
  });

  const title = this.chatPushTitle(message.sender.displayName, message.chat.title);
  const body = this.chatPushBody(message.text, message.attachments.length > 0);

  await this.runWithConcurrency(tokens, this.pushConcurrency, async (token) => {
    const provider = this.resolveProvider(token.provider);
    await provider.send({
      token: token.token,
      title,
      body,
      data: {
        type: 'chat_message',
        chatId: message.chatId,
        messageId: message.id,
        kind: String(message.chat.kind),
      },
    });
  });
}
```

Add helpers below it:

```ts
private async filterPushAllowedRecipients(
  userIds: string[],
  actorUserId: string,
) {
  const uniqueUserIds = [...new Set(userIds)];
  const allowed: string[] = [];
  const settingsRows = await this.prismaService.client.userSettings.findMany({
    where: { userId: { in: uniqueUserIds } },
    select: { userId: true, allowPush: true, quietHours: true },
  });
  const settingsByUserId = new Map(settingsRows.map((row) => [row.userId, row]));
  for (const userId of uniqueUserIds) {
    const settings = settingsByUserId.get(userId);
    if (settings?.allowPush === false || settings?.quietHours === true) {
      continue;
    }
    if (await this.isUserHidden(userId, actorUserId)) {
      continue;
    }
    allowed.push(userId);
  }
  return allowed;
}

private chatPushTitle(senderName: string | null | undefined, chatTitle: string | null | undefined) {
  const normalizedSender = senderName?.trim();
  if (normalizedSender) {
    return normalizedSender.slice(0, 80);
  }
  const normalizedChat = chatTitle?.trim();
  return normalizedChat ? normalizedChat.slice(0, 80) : 'Frendly';
}

private chatPushBody(text: string | null | undefined, hasAttachments: boolean) {
  const normalized = text?.replace(/\s+/g, ' ').trim();
  if (normalized) {
    return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
  }
  return hasAttachments ? 'Новое сообщение' : 'Новое сообщение';
}
```

- [ ] **Step 5: Run worker tests again**

Run:

```bash
cd backend && pnpm --filter @big-break/worker test:unit -- worker.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit task 3**

Run:

```bash
git add backend/apps/worker/src/worker.service.ts backend/apps/worker/test/unit/worker.service.spec.ts
git commit -m "feat: send chat message pushes"
```

## Task 4: Add Shared Mobile Push Route Mapping

**Files:**
- Create: `mobile2/lib/app/core/device/app_push_navigation.dart`
- Create: `mobile2/test/core/app_push_navigation_test.dart`
- Modify: `mobile2/lib/features/notifications/presentation/notifications_screen.dart`

- [ ] **Step 1: Write route helper tests**

Create `mobile2/test/core/app_push_navigation_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/app/core/device/app_push_navigation.dart';

void main() {
  test('routes chat message push to chat thread', () {
    expect(
      appRouteForPushPayload({
        'type': 'chat_message',
        'chatId': 'chat 1',
        'messageId': 'message-1',
      }),
      '/chats/chat%201',
    );
  });

  test('routes invite payload to meetup with request id', () {
    expect(
      appRouteForPushPayload({
        'type': 'notification',
        'notificationKind': 'event_invite',
        'eventId': 'event-1',
        'requestId': 'request-1',
        'invite': 'true',
      }),
      '/meetings/event-1?inviteRequestId=request-1',
    );
  });

  test('routes event payload to meetup detail', () {
    expect(
      appRouteForPushPayload({
        'eventId': 'event-1',
      }),
      '/meetings/event-1',
    );
  });

  test('routes user payload to public profile', () {
    expect(
      appRouteForPushPayload({
        'userId': 'user-1',
      }),
      '/u/user-1',
    );
  });

  test('falls back to notifications for incomplete payload', () {
    expect(appRouteForPushPayload({'type': 'notification'}), '/notifications');
  });
}
```

- [ ] **Step 2: Run failing route helper tests**

Run:

```bash
cd mobile2 && flutter test test/core/app_push_navigation_test.dart
```

Expected: FAIL because the helper file does not exist.

- [ ] **Step 3: Create route helper**

Create `mobile2/lib/app/core/device/app_push_navigation.dart`:

```dart
String appRouteForPushPayload(Map<String, Object?> data) {
  final payload = _normalizedPayload(data);
  final chatId = _stringValue(payload['chatId']);
  if (payload['type'] == 'chat_message' && chatId != null) {
    return '/chats/${Uri.encodeComponent(chatId)}';
  }

  final eventId = _stringValue(payload['eventId']);
  if (eventId != null) {
    final requestId = _stringValue(payload['requestId']);
    final invite = _boolValue(payload['invite']);
    if (invite && requestId != null) {
      return '/meetings/${Uri.encodeComponent(eventId)}'
          '?inviteRequestId=${Uri.encodeComponent(requestId)}';
    }
    return '/meetings/${Uri.encodeComponent(eventId)}';
  }

  if (chatId != null) {
    return '/chats/${Uri.encodeComponent(chatId)}';
  }

  final userId = _stringValue(payload['userId']);
  if (userId != null) {
    return '/u/${Uri.encodeComponent(userId)}';
  }

  return '/notifications';
}

Map<String, Object?> _normalizedPayload(Map<String, Object?> data) {
  final nested = data['payload'];
  if (nested is Map) {
    return {
      ...data,
      ...nested.map((key, value) => MapEntry(key.toString(), value)),
    };
  }
  return data;
}

String? _stringValue(Object? value) {
  if (value == null) {
    return null;
  }
  final string = value.toString().trim();
  return string.isEmpty ? null : string;
}

bool _boolValue(Object? value) {
  return value == true || value?.toString().toLowerCase() == 'true';
}
```

- [ ] **Step 4: Reuse helper from notifications screen**

In `mobile2/lib/features/notifications/presentation/notifications_screen.dart`, add:

```dart
import 'package:mobile2/app/core/device/app_push_navigation.dart';
```

Replace `_routeFromPayload` body with:

```dart
String? _routeFromPayload(Map<String, Object?> raw) {
  final route = appRouteForPushPayload(raw);
  return route == '/notifications' ? null : route;
}
```

- [ ] **Step 5: Run route helper and notification layout tests**

Run:

```bash
cd mobile2 && flutter test test/core/app_push_navigation_test.dart test/features/notifications_layout_test.dart
```

Expected: PASS.

- [ ] **Step 6: Commit task 4**

Run:

```bash
git add mobile2/lib/app/core/device/app_push_navigation.dart mobile2/test/core/app_push_navigation_test.dart mobile2/lib/features/notifications/presentation/notifications_screen.dart
git commit -m "feat: add push navigation mapping"
```

## Task 5: Wire Mobile Push Tap Handling

**Files:**
- Create: `mobile2/lib/app/core/device/app_push_notification_controller.dart`
- Create: `mobile2/test/core/app_push_notification_controller_test.dart`
- Modify: `mobile2/lib/app/dateasy_app.dart`
- Modify: `mobile2/ios/Runner/AppDelegate.swift`

- [ ] **Step 1: Write controller test**

Create `mobile2/test/core/app_push_notification_controller_test.dart`:

```dart
import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/app/core/device/app_push_notification_controller.dart';

void main() {
  test('routes push data through callback', () async {
    final controller = AppPushNotificationController(
      onRoute: expectAsync1((route) {
        expect(route, '/chats/chat-1');
      }),
      initialMessageLoader: () async => null,
      openedMessageStream: Stream.value({
        'type': 'chat_message',
        'chatId': 'chat-1',
      }),
      iosInitialPayloadLoader: () async => null,
      iosPayloadStream: const Stream.empty(),
    );

    await controller.start();
    await Future<void>.delayed(Duration.zero);
    await controller.dispose();
  });

  test('ignores empty push data', () async {
    final routes = <String>[];
    final controller = AppPushNotificationController(
      onRoute: routes.add,
      initialMessageLoader: () async => <String, Object?>{},
      openedMessageStream: const Stream.empty(),
      iosInitialPayloadLoader: () async => null,
      iosPayloadStream: const Stream.empty(),
    );

    await controller.start();
    await Future<void>.delayed(Duration.zero);
    await controller.dispose();

    expect(routes, isEmpty);
  });
}
```

- [ ] **Step 2: Run failing controller test**

Run:

```bash
cd mobile2 && flutter test test/core/app_push_notification_controller_test.dart
```

Expected: FAIL because the controller file does not exist.

- [ ] **Step 3: Create controller**

Create `mobile2/lib/app/core/device/app_push_notification_controller.dart`:

```dart
import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/services.dart';
import 'package:mobile2/app/core/device/app_push_navigation.dart';

const _iosPushTapChannel = MethodChannel('app.push.tap');

class AppPushNotificationController {
  AppPushNotificationController({
    required this.onRoute,
    Future<Map<String, Object?>?> Function()? initialMessageLoader,
    Stream<Map<String, Object?>>? openedMessageStream,
    Future<Map<String, Object?>?> Function()? iosInitialPayloadLoader,
    Stream<Map<String, Object?>>? iosPayloadStream,
    MethodChannel? iosChannel,
  })  : _initialMessageLoader = initialMessageLoader ?? _loadFirebaseInitialMessage,
        _openedMessageStream = openedMessageStream ?? _firebaseOpenedMessageStream(),
        _iosInitialPayloadLoader = iosInitialPayloadLoader,
        _iosPayloadStream = iosPayloadStream,
        _iosChannel = iosChannel ?? _iosPushTapChannel;

  final void Function(String route) onRoute;
  final Future<Map<String, Object?>?> Function() _initialMessageLoader;
  final Stream<Map<String, Object?>> _openedMessageStream;
  final Future<Map<String, Object?>?> Function()? _iosInitialPayloadLoader;
  final Stream<Map<String, Object?>>? _iosPayloadStream;
  final MethodChannel _iosChannel;
  StreamSubscription<Map<String, Object?>>? _firebaseSub;
  StreamSubscription<Map<String, Object?>>? _iosSub;
  bool _started = false;

  Future<void> start() async {
    if (_started) {
      return;
    }
    _started = true;
    final initial = await _initialMessageLoader();
    _handleData(initial);
    final iosInitial = await (_iosInitialPayloadLoader ?? _loadIosInitialPayload).call();
    _handleData(iosInitial);
    _firebaseSub = _openedMessageStream.listen(_handleData);
    _iosSub = (_iosPayloadStream ?? _iosPayloads()).listen(_handleData);
  }

  Future<void> dispose() async {
    await _firebaseSub?.cancel();
    await _iosSub?.cancel();
    _firebaseSub = null;
    _iosSub = null;
    _started = false;
  }

  void _handleData(Map<String, Object?>? data) {
    if (data == null || data.isEmpty) {
      return;
    }
    onRoute(appRouteForPushPayload(data));
  }

  static Future<Map<String, Object?>?> _loadFirebaseInitialMessage() async {
    final message = await FirebaseMessaging.instance.getInitialMessage();
    return message?.data;
  }

  static Stream<Map<String, Object?>> _firebaseOpenedMessageStream() {
    return FirebaseMessaging.onMessageOpenedApp.map((message) => message.data);
  }

  Future<Map<String, Object?>?> _loadIosInitialPayload() async {
    try {
      final payload = await _iosChannel.invokeMapMethod<String, Object?>(
        'initialPayload',
      );
      return payload == null ? null : Map<String, Object?>.from(payload);
    } on MissingPluginException {
      return null;
    } on PlatformException {
      return null;
    }
  }

  Stream<Map<String, Object?>> _iosPayloads() {
    const eventChannel = EventChannel('app.push.tap.events');
    return eventChannel
        .receiveBroadcastStream()
        .where((event) => event is Map)
        .map((event) => Map<String, Object?>.from(event as Map));
  }
}
```

- [ ] **Step 4: Wire controller into app**

In `mobile2/lib/app/dateasy_app.dart`, import:

```dart
import 'package:mobile2/app/core/device/app_push_notification_controller.dart';
```

Add a field:

```dart
AppPushNotificationController? _pushController;
```

In `dispose`:

```dart
unawaited(_pushController?.dispose());
```

In the `Consumer` builder after `_startAppLinks();`, add:

```dart
_startPushNotifications();
```

Add this method:

```dart
void _startPushNotifications() {
  _pushController ??= AppPushNotificationController(
    onRoute: (route) {
      if (!mounted) {
        return;
      }
      _router?.go(route);
    },
  );
  unawaited(_pushController!.start());
}
```

- [ ] **Step 5: Forward iOS push tap payloads**

In `mobile2/ios/Runner/AppDelegate.swift`, add constants:

```swift
private let pushTapChannelName = "app.push.tap"
private let pushTapEventChannelName = "app.push.tap.events"
```

Add fields:

```swift
private var pushTapChannel: FlutterMethodChannel?
private var pushTapEventChannel: FlutterEventChannel?
private var pushTapEventSink: FlutterEventSink?
private var initialPushTapPayload: [String: Any]?
```

Register channels in `didFinishLaunchingWithOptions`:

```swift
registerPushTapChannels(with: registrar)
```

Add method:

```swift
private func registerPushTapChannels(with registrar: FlutterPluginRegistrar) {
  let methodChannel = FlutterMethodChannel(
    name: pushTapChannelName,
    binaryMessenger: registrar.messenger()
  )
  methodChannel.setMethodCallHandler { [weak self] call, result in
    guard call.method == "initialPayload" else {
      result(FlutterMethodNotImplemented)
      return
    }
    result(self?.initialPushTapPayload)
    self?.initialPushTapPayload = nil
  }
  pushTapChannel = methodChannel

  let eventChannel = FlutterEventChannel(
    name: pushTapEventChannelName,
    binaryMessenger: registrar.messenger()
  )
  eventChannel.setStreamHandler(self)
  pushTapEventChannel = eventChannel
}
```

Make `AppDelegate` conform to `FlutterStreamHandler`:

```swift
extension AppDelegate: FlutterStreamHandler {
  func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
    pushTapEventSink = events
    return nil
  }

  func onCancel(withArguments arguments: Any?) -> FlutterError? {
    pushTapEventSink = nil
    return nil
  }
}
```

Add APNS response forwarding:

```swift
override func userNotificationCenter(
  _ center: UNUserNotificationCenter,
  didReceive response: UNNotificationResponse,
  withCompletionHandler completionHandler: @escaping () -> Void
) {
  let payload = response.notification.request.content.userInfo.reduce(into: [String: Any]()) { result, item in
    if let key = item.key as? String {
      result[key] = item.value
    }
  }
  if let sink = pushTapEventSink {
    sink(payload)
  } else {
    initialPushTapPayload = payload
  }
  completionHandler()
}
```

- [ ] **Step 6: Run mobile tests**

Run:

```bash
cd mobile2 && flutter test test/core/app_push_notification_controller_test.dart test/core/app_push_navigation_test.dart
```

Expected: PASS.

- [ ] **Step 7: Commit task 5**

Run:

```bash
git add mobile2/lib/app/core/device/app_push_notification_controller.dart mobile2/test/core/app_push_notification_controller_test.dart mobile2/lib/app/dateasy_app.dart mobile2/ios/Runner/AppDelegate.swift
git commit -m "feat: route push notification taps"
```

## Task 6: Final Verification And Context Update

**Files:**
- Modify: `ai-context/infra.md`
- Modify: `ai-context/realtime-chat.md`
- Modify: `ai-context/frontend-flutter.md`

- [ ] **Step 1: Run backend checks**

Run:

```bash
cd backend && pnpm --filter @big-break/chat test -- --runInBand test/unit/chat-server.service.unit.spec.ts
cd backend && pnpm --filter @big-break/worker test:unit -- worker.service.spec.ts
cd backend && pnpm --filter @big-break/chat build
cd backend && pnpm --filter @big-break/worker build
```

Expected: all pass.

- [ ] **Step 2: Run Flutter checks**

Run:

```bash
cd mobile2 && flutter test test/core/app_push_token_service_test.dart test/core/app_push_navigation_test.dart test/core/app_push_notification_controller_test.dart test/features/notifications_layout_test.dart
cd mobile2 && flutter analyze
```

Expected: all pass.

- [ ] **Step 3: Update AI context**

Add these notes:

```md
Chat message pushes use `message.notification_fanout` and do not create central `Notification` rows. Worker sends `type=chat_message`, `chatId`, `messageId` and chat `kind` as push data.
```

Place this in:

- `ai-context/realtime-chat.md`
- `ai-context/infra.md`
- `ai-context/frontend-flutter.md`

- [ ] **Step 4: Update understand graph**

Run:

```bash
bash scripts/update-understand-graph.sh
```

Expected: command exits with code 0.

- [ ] **Step 5: Final commit**

Run:

```bash
git add ai-context/realtime-chat.md ai-context/infra.md ai-context/frontend-flutter.md .understand-anything
git commit -m "docs: update push notification context"
```
