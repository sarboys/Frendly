# Push Notifications MVP Design

Date: 2026-06-02

## Goal

Ship a small reliable push notification system for the release.

The MVP covers only events that matter immediately:

- profile and dating likes
- new chat messages
- meetup invites
- meetup join requests and host decisions
- event starting soon reminders
- verification result notifications

Nearby meetup alerts, digests, advanced delivery analytics, grouping and broad notification preferences stay out of this release scope.

## Existing Base

The project already has the main delivery path:

```text
Product event
  -> Notification row, when the event belongs in the in-app notification list
  -> OutboxEvent
  -> worker
  -> APNS or FCM
  -> mobile device
```

Relevant existing files:

- `backend/apps/api/src/services/notifications.service.ts`
- `backend/apps/api/src/controllers/notifications.controller.ts`
- `backend/apps/worker/src/worker.service.ts`
- `backend/apps/worker/src/push.providers.ts`
- `mobile2/lib/app/core/device/app_push_token_service.dart`

`PushToken` stores active device tokens. `Notification` stores in-app notifications. `OutboxEvent` keeps delivery off the request hot path.

The worker already respects basic user settings:

- `allowPush=false` disables pushes
- `quietHours=true` disables pushes
- blocked users are filtered before delivery

## Scope

### In-App Notifications With Push

These events should create a `Notification` row and enqueue:

- `push.dispatch`
- `notification.create`

Covered kinds:

- `like`
- `event_invite`
- `event_joined`
- `event_starting`
- `verification`
- `subscription_expiring`, if already present

The in-app notification screen stays the source of truth for these events.

### Chat Message Pushes

New messages need push delivery, but they should not be added to the central notification list.

Reason:

- chats already have unread counters
- adding every message to `Notification` would pollute the notification screen
- chat open state and read state already live in chat-specific models

For new message pushes, the backend should enqueue a lightweight outbox event after the message is written. The worker loads recipients from `ChatMember`, excludes the sender and blocked users, then sends push messages to active tokens.

The push payload should include enough data for deep linking:

```json
{
  "type": "chat_message",
  "chatId": "...",
  "messageId": "...",
  "kind": "meetup|personal|community"
}
```

The visible text should be short:

- title: sender or chat title
- body: message text preview, or "Новое сообщение" for media-only messages

Message text should be trimmed before push. Do not include private media URLs in push payloads.

## Data Flow

### Device Token Registration

Mobile registers the device token after auth, through `POST /push-tokens`.

Required fields:

- `token`
- `provider`, `apns` or `fcm`
- `deviceId`
- `platform`

Logout or token reset removes the device token by `deviceId` when available.

### Normal Notification Flow

1. API service creates `Notification`.
2. API service creates outbox events in the same transaction.
3. Worker processes `notification.create` and publishes realtime `notification.created`.
4. Worker processes `push.dispatch`.
5. APNS or FCM sends the push.

### Chat Message Flow

1. Chat server writes `Message`, `RealtimeEvent` and unread outbox work.
2. Chat server also creates message push fanout outbox work.
3. Worker reads chat recipients in bounded batches.
4. Worker sends push only to users with active tokens.
5. Mobile opens the target chat from the push payload.

This must stay off the WebSocket ACK hot path. Creating one small outbox row inside the existing message transaction is acceptable, because the system already writes outbox work for unread fanout.

## Mobile Behavior

Mobile should:

- keep token registration on supported iOS and Android devices
- re-register after token refresh when the platform reports a new token
- avoid blocking app startup on push registration
- route notification taps by payload

Routes:

- `chat_message` opens the chat thread
- `like` opens the relevant dating profile or public profile based on payload source
- `event_invite`, `event_joined`, `event_starting` open the meetup detail or host flow
- `verification` opens verification

If a payload is incomplete, mobile opens the notification screen.

## Backend Rules

Push dispatch must:

- never run on the API request path
- cap token fanout with existing worker batch settings
- skip disabled tokens
- skip blocked actor pairs
- keep token values out of logs
- use fake provider by default unless `PUSH_PROVIDER` is configured

If APNS or FCM rejects a token as invalid, a follow-up implementation should disable that token. This is useful, but not required for the first MVP if provider error shapes need more work.

## Release Checks

Backend:

- unit tests for notification outbox creation
- worker unit tests for chat message push fanout
- build check for API and worker

Flutter:

- token service tests
- payload routing tests
- `flutter analyze`

Manual QA:

- iOS real device receives a like push
- Android real device receives a like push
- iOS real device receives a chat push while app is backgrounded
- Android real device receives a chat push while app is backgrounded
- tapping a chat push opens the correct chat
- user with `allowPush=false` receives no push

## Out Of Scope

- nearby meetup recommendations
- daily or weekly digests
- push grouping
- rich images in pushes
- per-category settings UI
- delivery analytics dashboard
- retry policy changes beyond existing outbox retries
- marketing pushes

