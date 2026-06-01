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

1. Render recent messages from `ChatLocalStore` when local-first cache is available.
2. Load recent messages through REST: `GET /chats/:chatId/messages`.
3. Keep `nextCursor` from the REST page and request older history when the user scrolls near the top.
4. Connect socket.
5. Send `session.authenticate` with access token.
6. Subscribe with `chat.subscribe`.
7. Request missed events with `sync.request`.
8. Store sync cursor per chat.
9. Store pending send, edit, delete and read commands in the durable outbox.

On reconnect, authenticate, resend queued commands, resubscribe known chat ids and request sync from stored cursor.

When local-first cache is enabled and the current user id is known, mobile uses `DriftChatOutboxStorage` backed by `pending_commands`. It migrates legacy `chat.outbox.commands` from `SharedPreferences`, dedupes by the existing command `dedupeKey`, and falls back to the old SharedPreferences storage when Drift is disabled or unavailable.

Chat thread sync prefers the stored `sync_cursors` value when it exists. REST `lastEventId`, live events and `sync.snapshot` updates are written back to Drift, so a reopened thread can request only missed realtime events after showing the cached message window.

Chat lists also expose per-user `isPinned`. Mobile toggles it through `POST /chats/:chatId/pin`, updates the row optimistically, then refetches the list.

Mobile meetup chat list requests send `includeSocial=false` for the compact list path. The backend keeps member ids, names and online flags, but skips social preview aggregation unless a caller explicitly keeps social previews enabled.

Mobile chat delete uses REST `DELETE /chats/:chatId`, not WebSocket. Direct chat delete removes only the current `ChatMember`. Event meetup chat delete removes non-host users from `EventParticipant`, marks attendance `left` and removes `ChatMember`; host delete hides only the host's `ChatMember`. Evening meetup chat delete marks non-host participants `left`; host delete hides only the host's `ChatMember`. Community chat delete removes `CommunityMember` plus `ChatMember` for non-owner users; owner delete hides only the owner's `ChatMember`. Mobile removes the row optimistically and rolls back on API error. For old backend compatibility, mobile falls back from chat delete to event or community leave endpoints when possible. Backend starts best-effort cleanup after delete; if no members remain, it removes messages, chat media, notifications, realtime events and the empty direct chat row.

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
- Authenticated commands re-check session with `CHAT_AUTH_RECHECK_MS`, default 30 seconds. High-load chat runtime can raise this, for example 300 seconds, after accepting the longer revocation window.
- Active session DB lookups have a 5 second process-local cache and in-flight coalescing by session id.
- Payload size is bounded by `CHAT_WS_MAX_PAYLOAD_BYTES`.
- Payload warning metrics use `CHAT_WS_PAYLOAD_WARN_BYTES`, default `32768`, and increment `frendly_payload_warning_total` for inbound or outbound payloads above the threshold.
- All chat actions require `ChatMember`.
- Membership check has bounded in-memory TTL cache and in-flight miss coalescing by user and chat. High-load chat runtime can use `CHAT_MEMBERSHIP_CACHE_TTL_MS=60000` after accepting the longer membership revocation window.
- Direct chat checks load current member plus one peer, not all members.
- API and chat server share hidden-user set through `getBlockedUserIds`. Chat server keeps a short process-local blocked-user cache and coalesces in-flight loads.

## Messages

Flutter creates optimistic local message and `clientMessageId`, then sends `message.send`.

`ChatLocalStore` stores recent message JSON in `chat_messages`. Rows have `messageId` plus optional `clientMessageId`; when the server echo arrives with the same client id, the pending local row is replaced by the server row.

Meetup and personal chat lists read cached summaries first and refresh REST in the background. Realtime preview, unread and delete patches still update Riverpod local state immediately; subsequent REST refresh writes the latest summary rows back to Drift.

Event meetup chat phase becomes `done` once `startsAt` is at least 24 hours old, even without an explicit host finish action.

REST meetup and personal chat list endpoints support optional `If-None-Match`. They keep the same JSON body on normal `200`, set a private weak `ETag`, and return empty `304` when the list payload is unchanged.

Backend chat REST hot paths use short process-local cache before Redis for repeated reads. Chat lists keep a 2 second local L1 and Redis L2 payload cache. Message history keeps a 1 second local L1 and Redis L2 cache plus in-flight coalescing by user, chat, cursor and limit. `POST /chats/:chatId/read` skips repeated already-read markers and keeps a short 10 second local idempotency cache by user, chat and message.
Chat list last-message previews must not use Prisma relation `messages: { take: 1 }` on many chats. Prisma can fan this out into a large `Message WHERE chatId IN (...) ORDER BY createdAt DESC` read. The API first loads one latest visible message id per chat with a bounded `LATERAL ... ORDER BY createdAt DESC, id DESC LIMIT 1` lookup per chat, then fetches only those messages with the normal presenter select.

Server validates:

- auth and membership
- non-empty text or attachments
- attachment ownership, ready status and chat match
- reply target in same chat
- blocked reply sender

Server writes `Message`, attachment links, `RealtimeEvent`, may update `Chat.updatedAt`, queues unread fanout and publishes Redis event.

For the text-only new-message hot path, the chat server skips the duplicate preflight `Message.findFirst`, skips `MediaAsset.findMany` when `attachmentIds` is empty, selects the plain message shape without attachment and reply joins, and omits empty `attachments.createMany`. Duplicate retries are handled after the unique constraint conflict by loading the existing sender message.

`Chat.updatedAt` touches are throttled per chat and per process by `CHAT_MESSAGE_CHAT_TOUCH_INTERVAL_MS`, default 10000 ms. This reduces row-update pressure during bursty sends, but means very rapid messages in the same chat can share one chat-list recency touch inside the interval.

Message transaction wait and timeout are controlled by `CHAT_MESSAGE_TRANSACTION_MAX_WAIT_MS` and `CHAT_MESSAGE_TRANSACTION_TIMEOUT_MS`, both defaulting to 10000 ms.
`message.send` DB writes go through a bounded per-chat-container write pipeline before Prisma starts the write. `CHAT_MESSAGE_WRITE_CONCURRENCY` defaults to `16`; current high-load release env uses `64` after testing `32` still filled queues sooner. `CHAT_MESSAGE_WRITE_QUEUE_MAX` defaults to `1000`; current high-load release env uses `10000` so short 1000-1500 msg/sec bursts can queue instead of returning `message_write_backpressure`. Metrics: `frendly_websocket_message_write_active` and `frendly_websocket_message_write_queue_depth`.
Plain text `message.send` uses a short process-local author snapshot cache for sender display name and avatar, then writes `Message`, optional `Chat.updatedAt`, `RealtimeEvent` and unread work with one raw SQL CTE. By default it does inline `ChatMember.unreadCount` increments. High-load release env uses `CHAT_MESSAGE_INLINE_UNREAD_UPDATES=false`, which moves unread work to `OutboxEvent` for `worker_realtime`, removes `ChatMember` tuple locks from the sender ACK path, and relies on worker batch processing to catch up. Attachment and reply messages still use the fuller Prisma transaction path because they need extra relation writes and selects.
After a successful write, the sender socket receives a direct `message.created` ACK. When the same Redis fanout returns to the same chat process, that socket is skipped for the same `chatId + senderId + clientMessageId` for a short TTL to avoid duplicate sender ACKs.
High-load release env uses `CHAT_MESSAGE_CHAT_TOUCH_INTERVAL_MS=60000`; lower values create row-lock pressure on hot chats.
Attachment and reply `message.send` outbox payloads include `messageCreatedAt`; the worker uses that to increment `ChatMember.unreadCount` for affected recipients instead of recounting unread messages with `COUNT(Message)` for every new message. Old outbox payloads without `messageCreatedAt` still use the full recount fallback.
Redis `message.created` fanout exits early when the current chat process has no local subscribers for that chat. This avoids doing `UserBlock` lookups on every chat replica for messages that cannot be delivered by that process.

Retries are resolved by `chatId + senderId + clientMessageId`. Cross-sender client id collisions return `client_message_id_conflict`.

Payloads include ids, sender summary, text, `kind`, optional `systemKind`, `replyTo`, attachments and timestamps.

`kind=system` renders as a centered muted pill in Flutter.

## Read, unread, typing, sync

- `message.read` verifies the message and blocks before updating `ChatMember`.
- Mobile sends read through WebSocket and also calls `POST /chats/:chatId/read` as a best-effort REST fallback, then clears local meetup, personal and community chat badges immediately.
- Read resets `ChatMember.unreadCount` to `0`.
- Chat list REST items include `lastMessageId`; mobile uses it to clear unread when the latest unread message is not in the loaded thread window.
- Worker recomputes unread counts and excludes symmetrically blocked senders.
- Typing events are throttled.
- `sync.request` reads `RealtimeEvent` by chat id, default limit `100`, max `500`.
- `sync.snapshot` can include `reset=true`; Flutter reloads recent REST history then syncs again.

## Attachments and voice

Generic file:

- `/uploads/chat-attachment/upload-url`
- direct upload to S3-compatible storage with all returned upload headers
- `/uploads/chat-attachment/complete`
- send returned asset id in `message.send`

Voice:

- Recorder: `AppVoiceRecorderService`.
- Kind: `chat_voice`.
- Metadata: `durationMs`, `waveform`.
- Playback: `ChatVoicePlaybackController`, `BbVoiceMessage`.

Private media download checks membership and blocks before signed URL.

Flutter `AppAttachmentService` coalesces in-flight signed download URL requests and keeps a four-minute local TTL cache by `downloadUrlPath` or media asset id. Chat thread warmup uses the same service for recent ready attachments: images warm signed URLs plus cached files, and voice warms signed URLs only. Private voice playback must not feed `/media/:id` directly into `just_audio`; it should resolve `downloadUrlPath` first because the player does not attach REST auth headers.

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
- `worker_realtime` batches claimed `chat.unread_fanout` events by `chatId + actorUserId` when `messageCreatedAt` is present and there is no cursor. One batch SQL counts how many message timestamps are newer than each member's `lastReadAt`, increments `ChatMember.unreadCount`, publishes one final `unread.updated` per affected user, then marks all grouped outbox events done.
- Attachments upload direct to storage, not through WebSocket.

## Performance notes

- Initial message load is bounded to the latest page, and older messages load by cursor only after the user scrolls upward.
- Compact meetup chat lists skip social preview aggregation on the backend to keep the initial chat list query lighter.
- Sync is bounded.
- Membership cache is capped by `CHAT_MEMBERSHIP_CACHE_MAX_ENTRIES`.
- Membership cache hit and miss are counted through `frendly_websocket_membership_cache_total`.
- WebSocket input payload, message text and attachment count are bounded before DB writes.
- Slow sockets over `CHAT_WS_MAX_BUFFERED_BYTES` are skipped and counted through `frendly_websocket_dropped_total{reason="buffered_amount"}`.
- Push and unread fanout stay outside the hot WebSocket path.
- `backend/scripts/load-chat-ws.mjs` is the current WebSocket load tool. It can validate authenticated connection count, inbound typing event throughput and `message.send` write throughput without printing tokens.
- The load tool caps pacing drift instead of catching up missed ticks in a burst, so `events-rps` means maximum send rate rather than burst-after-lag rate.
- For `message.send`, the load tool tracks unique `message.created` acknowledgements by `clientMessageId`; use `messageAcks` and `messagePending`, not only `sendErrors` or server `errors`, to decide whether a durable write test passed.
- Large fanout tests should not count every inbound event on every socket. Use `--event-senders N --receive-mode senders` so the load client tracks ACKs only on sender sockets. For 15000 subscribed sockets, use `--event-senders-unsubscribe` when the sender sockets should receive only their own ACK instead of the full room fanout. Use `--close-mode terminate` for large connection counts so the result is printed before socket cleanup can hold the process open.
- Do not treat large WebSocket tests run from VPS1 as clean server evidence once the load container itself consumes significant CPU. In the latest 15000 WS plus 500 msg/sec attempts, the load generator on VPS1 reached about 128% CPU and became part of the bottleneck. A local Mac run against the public endpoint attempted 15000 WS but only connected 4058 and failed 10942, mostly `open timeout`, while VPS1 CPU stayed low; that indicates client network or external route limits, not a backend result.
- Last verified high-load gate on VPS1: 15000 authenticated WebSocket connections passed with 0 failed connections across 3 load containers. During connect, nginx was about 155-181% CPU, chat containers were mostly about 30-60% CPU, and all services stayed healthy after close.
- That gate does not prove 5000 `message.send` writes per second or large-room fanout. Message write and fanout need separate room-size tests.
- Current corrected `message.send` evidence on VPS1 with `chat_a` through `chat_h`, `CHAT_MESSAGE_WRITE_CONCURRENCY=64`, `CHAT_MESSAGE_WRITE_QUEUE_MAX=10000`, `CHAT_MESSAGE_INLINE_UNREAD_UPDATES=false`, and direct chat DB URL to Postgres with Prisma `connection_limit=10`: the load tool now reports actual send time. Earlier tests found that two generators configured as 750/sec plus 750/sec sent about 1398/sec and left about 14758 pending after drain with inline unread updates. Moving plain text unread updates to outbox removed `ChatMember` tuple locks from the sender ACK path but still left about 8173 pending before the fanout fix. The next root cause was `broadcastEvent`: every chat replica received each Redis event and did a `UserBlock` lookup even when it had no local subscribers. A clean 15s DB slice before the fix showed about 151k `UserBlock` queries. After the early return, those queries disappeared from the top SQL list, and a 60s two-generator durable message test passed at about 1530 actual `message.send`/sec with 96000 sent, 96000 ACK, 0 pending and 0 errors. The main insert CTE averaged about 0.424 ms over 96000 calls. Docker CPU limits were not set (`NanoCpus=0`, `CpuQuota=0`, empty `CpusetCpus`).
- Async unread evidence after the 1530 message/sec run: one `worker_realtime` drained only about 200 `chat.unread_fanout` events/sec, and four unbatched workers drained only about 450/sec, so backlog still grew. After worker batch processing and `WORKER_REALTIME_SCALE=4`, pending `chat.unread_fanout` dropped by about 56000 in 20 seconds, roughly 2800/sec, with low worker CPU. A control 30s durable write test after the worker fix passed at about 1558 actual `message.send`/sec with 48000 sent, 48000 ACK, 0 pending, 0 errors, and all 48000 recent `chat.unread_fanout` events were `done` within a few seconds. This is enough headroom for the current 1530 message/sec gate.
- Current corrected typing fanout evidence on VPS1: 4 load containers with 1000 total authenticated subscribed sockets, 40 sender sockets unsubscribed, and 960 receiver sockets subscribed passed at about 5639 actual typing events/sec for 10 seconds with 0 send errors and 0 server errors. Chat CPU stayed roughly 15-34% in that test. A 2-generator all-subscribed receive-heavy test only sent about 2139 events/sec because the load clients were parsing about 1.56M received events; treat that as load-client limited, not backend failure.
- Current 5000/sec durable `message.send` evidence on VPS1: a 10 second burst with 16 generators reached about 5400-5500 actual sends/sec, sent 60000, received 60000 ACKs, and had 0 errors. A 30 second target at 5000/sec reached about 4680-4730 actual sends/sec before dropping redundant `OutboxEvent` status indexes, then about 4780-4820 actual sends/sec after dropping them. Both 30 second runs sent 149760 messages, received all 149760 ACKs, had 0 pending and 0 errors. A later 15 second control with 16 generators and 800 total sockets sent 74880, received 74880 ACKs, had 0 pending and 0 errors at about 4.8k actual sends/sec. Postgres waits during active writes were mostly `WALWrite` and occasional `WALSync`; the hot insert CTE averaged about 2.2 ms after the index drop. The remaining limit is the single Postgres WAL write path for per-message `Message`, `RealtimeEvent` and `OutboxEvent` writes. Stable 5000/sec and above likely needs DB tier headroom, lower durability semantics, batching, sharding, or a larger write-path architecture change.

## Tests

- Chat server unit: `backend/apps/chat/test/unit/chat-server.service.unit.spec.ts`.
- Realtime session: `backend/apps/chat/test/realtime/session.realtime.spec.ts`.
- Flutter chat tests: `mobile/test/features/chats/presentation/`, `mobile/test/shared/models/message_test.dart`.

