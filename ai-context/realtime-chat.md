# Realtime Chat Map

Use this for WebSocket, chat sync, unread, typing, messages, attachments and Evening realtime.

## Fast paths

- Flutter socket client: `mobile/lib/app/core/network/chat_socket_client.dart`.
- Thread state: `mobile/lib/features/chats/presentation/chat_thread_providers.dart`.
- Thread UI: `mobile/lib/features/chats/presentation/chat_thread_screen.dart`.
- Meetup wrapper: `mobile/lib/features/meetup_chat/presentation/meetup_chat_screen.dart`.
- Personal wrapper: `mobile/lib/features/personal_chat/presentation/personal_chat_screen.dart`.
- Chat list and app sync: `mobile/lib/shared/data/app_providers.dart`.
- Backend WebSocket: `backend/apps/chat/src/chat-server.service.ts`.
- REST chat history: `backend/apps/api/src/services/chats.service.ts`.
- Contracts: `backend/packages/contracts/src/index.ts`.
- DB: `Chat`, `ChatMember`, `Message`, `MessageAttachment`, `RealtimeEvent`, `OutboxEvent`.

## Network

- Chat app default port: `3001`.
- Public WebSocket path: `/ws`.
- Nginx routes `/ws` to chat service.
- Flutter URL comes from `BIG_BREAK_CHAT_WS_URL`.
- Local default can point to `wss://api.frendly.tech/ws` unless env overrides it.

## Client lifecycle

1. Load recent messages through REST: `GET /chats/:chatId/messages`.
2. Keep `nextCursor` from the REST page and request older history when the user scrolls near the top.
3. Connect socket.
4. Send `session.authenticate` with access token.
5. Subscribe with `chat.subscribe`.
6. Request missed events with `sync.request`.
7. Store sync cursor per chat.
8. Store pending send, edit, delete and read commands in SharedPreferences outbox.

On reconnect, authenticate, resend queued commands, resubscribe known chat ids and request sync from stored cursor.

Chat lists also expose per-user `isPinned`. Mobile toggles it through `POST /chats/:chatId/pin`, updates the row optimistically, then refetches the list.

Mobile meetup chat list requests send `includeSocial=false` for the compact list path. The backend keeps member ids, names and online flags, but skips social preview aggregation unless a caller explicitly keeps social previews enabled.

## App-level sync

`chatRealtimeSyncProvider` starts after auth. `ChatsScreen` uses `chatRealtimeSyncForScopeProvider` so segment-specific tabs only subscribe the chat kinds they loaded.

It subscribes to known meetup and personal chat ids and handles:

- `message.created`
- `typing.changed`
- `unread.updated`
- `notification.created`
- `chat.updated`

For Evening, `chat.updated` patches phase, current step, total steps, current place and end time, then invalidates Evening providers.

## Events

Client events:

- `session.authenticate`, `chat.subscribe`, `chat.unsubscribe`
- `message.send`, `message.edit`, `message.delete`, `message.read`
- `typing.start`, `typing.stop`
- `sync.request`

Server events:

- `session.authenticated`
- `message.created`, `message.updated`, `message.deleted`, `message.attachment_ready`, `message.read`
- `typing.changed`
- `chat.updated`
- `unread.updated`
- `notification.created`
- `sync.snapshot`

## Auth and membership

- WebSocket uses the same access token as REST.
- Server verifies JWT and DB `Session`.
- Authenticated commands re-check session with short TTL.
- Payload size is bounded by `CHAT_WS_MAX_PAYLOAD_BYTES`.
- All chat actions require `ChatMember`.
- Membership check has bounded in-memory TTL cache.
- Direct chat checks load current member plus one peer, not all members.
- API and chat server share hidden-user set through `getBlockedUserIds`.

## Messages

Flutter creates optimistic local message and `clientMessageId`, then sends `message.send`.

Server validates:

- auth and membership
- non-empty text or attachments
- attachment ownership, ready status and chat match
- reply target in same chat
- blocked reply sender

Server writes `Message`, attachment links, `RealtimeEvent`, updates `Chat.updatedAt`, queues unread fanout and publishes Redis event.

Retries are resolved by `chatId + senderId + clientMessageId`. Cross-sender client id collisions return `client_message_id_conflict`.

Payloads include ids, sender summary, text, `kind`, optional `systemKind`, `replyTo`, attachments and timestamps.

`kind=system` renders as a centered muted pill in Flutter.

## Read, unread, typing, sync

- `message.read` verifies the message and blocks before updating `ChatMember`.
- Read resets `ChatMember.unreadCount` to `0`.
- Chat list REST items include `lastMessageId`; mobile uses it to clear unread when the latest unread message is not in the loaded thread window.
- Worker recomputes unread counts and excludes symmetrically blocked senders.
- Typing events are throttled.
- `sync.request` reads `RealtimeEvent` by chat id, default limit `100`, max `500`.
- `sync.snapshot` can include `reset=true`; Flutter reloads recent REST history then syncs again.

## Attachments and voice

Generic file:

- `/uploads/chat-attachment/upload-url`
- direct upload to S3-compatible storage
- `/uploads/chat-attachment/complete`
- send returned asset id in `message.send`

Voice:

- Recorder: `AppVoiceRecorderService`.
- Kind: `chat_voice`.
- Metadata: `durationMs`, `waveform`.
- Playback: `ChatVoicePlaybackController`, `BbVoiceMessage`.

Private media download checks membership and blocks before signed URL.

Flutter `AppAttachmentService` coalesces in-flight signed download URL requests and keeps a four-minute local TTL cache by `downloadUrlPath` or media asset id. Chat thread warmup uses the same service for recent ready voice and image attachments, so private media playback and image widgets should stay on this path to avoid duplicate `/media/:id/download-url` calls while scrolling.

`GET /media/:assetId` supports `ETag` and `Last-Modified`. Fresh conditional requests return `304` before S3 streaming or signed URL generation, while private media still uses `Cache-Control: private, max-age=300`.

## Evening realtime

- Session-linked meetup chats expose `sessionId`, `privacy`, `joinedCount`, `maxGuests`, `hostName`, `area`.
- Live cards use `currentStep`, `totalSteps`, `currentPlace`.
- Evening lifecycle messages are normal chat messages with `kind=system`.
- Publish, start, late join, host approve, check-in, step transition and finish can write system messages.
- Request join, approve and reject create central notifications and push outbox.
- Dedicated `evening.session.updated` is not implemented. Evening refresh uses `chat.updated`.
- Current limitation: no dedicated realtime payload for check-in counters.

## Redis and worker

- Redis channel: `big-break:events`.
- Helper: `backend/packages/database/src/pubsub.ts`.
- Worker publishes unread, notification, attachment and realtime events through outbox.
- Attachments upload direct to storage, not through WebSocket.

## Performance notes

- Initial message load is bounded to the latest page, and older messages load by cursor only after the user scrolls upward.
- Compact meetup chat lists skip social preview aggregation on the backend to keep the initial chat list query lighter.
- Sync is bounded.
- Membership cache is capped by `CHAT_MEMBERSHIP_CACHE_MAX_ENTRIES`.
- WebSocket input payload, message text and attachment count are bounded before DB writes.
- Push and unread fanout stay outside the hot WebSocket path.

## Tests

- Chat server unit: `backend/apps/chat/test/unit/chat-server.service.unit.spec.ts`.
- Realtime session: `backend/apps/chat/test/realtime/session.realtime.spec.ts`.
- Flutter chat tests: `mobile/test/features/chats/presentation/`, `mobile/test/shared/models/message_test.dart`.

