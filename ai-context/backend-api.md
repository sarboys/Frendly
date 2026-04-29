# Backend API Map

## Быстрый выбор файла

- Endpoint behavior: `backend/apps/api/src/controllers/<domain>.controller.ts`.
- Business logic: `backend/apps/api/src/services/<domain>.service.ts`.
- Prisma access wrapper: `backend/apps/api/src/services/prisma.service.ts`.
- Shared DTO and WebSocket contracts: `backend/packages/contracts/src/index.ts`.
- Presenters and mapping helpers: `backend/apps/api/src/common/presenters.ts`, `media-presenters.ts`.
- Auth guard and current user: `backend/apps/api/src/common/auth.guard.ts`, `current-user.decorator.ts`.
- Unit tests: `backend/apps/api/test/unit/`.
- Integration tests: `backend/apps/api/test/integration/`.

## Root

- Backend path: `backend/`.
- Package manager: pnpm workspace.
- API app: `backend/apps/api/`.
- API entry: `backend/apps/api/src/main.ts`.
- API module: `backend/apps/api/src/app.module.ts`.
- Shared DB package: `backend/packages/database/`.
- Shared contracts: `backend/packages/contracts/`.

## Runtime rules

- NestJS app listens on `PORT`, default `3000`.
- Global `ValidationPipe`:
  - whitelist enabled.
  - transform enabled.
- Global auth guard: `AuthGuard`.
- Public routes use `@Public()`.
- Current user comes from `@CurrentUser()`.
- Request context stores `requestId`, `userId`, `sessionId`.
- Partner routes additionally store `partnerAccountId` and `partnerId` in request context through `PartnerAuthGuard`.
- Errors use `ApiError` and `ApiExceptionFilter`.
- CORS is enabled only when `CORS_ORIGIN` is set.

## Module structure

- `ApiAppModule` wires all controllers and services in one flat module.
- There are no Nest feature modules per domain.
- Controllers live in `apps/api/src/controllers/`.
- Services live in `apps/api/src/services/`.
- Shared helpers live in `apps/api/src/common/`.

## Controller and service index

- Auth:
  - controller: `auth.controller.ts`
  - services: `auth.service.ts`, `telegram-auth.service.ts`, `social-auth.service.ts`, `social-identity-verifier.service.ts`
  - endpoints: `/auth/*`, `/me`.
- Partner Auth:
  - controller: `partner-auth.controller.ts`
  - admin approval controller: `admin-partner-accounts.controller.ts`.
  - service: `partner-auth.service.ts`
  - guard: `partner-auth.guard.ts`, current partner decorator: `current-partner.decorator.ts`.
  - endpoints: `/partner/auth/register`, login, refresh, logout and `/partner/me`.
  - admin endpoints: `/admin/partner-accounts`, approve, reject and suspend, guarded by `@Admin()`.
  - registration creates `PartnerAccount` with `status=pending`; login uses email plus password and separate `PartnerSession`.
- Profile:
  - controller: `profile.controller.ts`
  - service: `profile.service.ts`
  - endpoints: `/profile/me`, avatar, photos.
- Onboarding:
  - controller: `onboarding.controller.ts`
  - service: `onboarding.service.ts`
  - endpoints: `/onboarding/me`.
- Events:
  - controller: `events.controller.ts`
  - service: `events.service.ts`
  - endpoints: `/events`, join, invites, check-in, live, after-party, feedback.
- Host:
  - controller: `host.controller.ts`
  - service: `host.service.ts`
  - endpoints: `/host/dashboard`, host event, approve/reject, check-in, live start/finish.
- Chats:
  - controller: `chats.controller.ts`
  - service: `chats.service.ts`
  - endpoints: `/chats/meetups`, `/chats/personal`, messages, read.
- Evening:
  - controller: `evening.controller.ts`
  - services: `evening.service.ts`, `partner-offer-code.service.ts`
  - endpoints: `/evening/*`.
  - public route template endpoints:
    - `GET /evening/route-templates`
    - `GET /evening/route-templates/:templateId`
    - `GET /evening/route-templates/:templateId/sessions`
    - `POST /evening/route-templates/:templateId/sessions`
    - list and detail expose only published templates in the user's city.
    - summary DTO includes card UI fields from the current route: `mood`, `premium`, `totalSavings`, `hostsCount`, and step preview `time` plus `kind`.
    - session creation uses the template current route revision and creates a dedicated Evening session chat.
  - offer QR endpoints:
    - `POST /evening/sessions/:sessionId/steps/:stepId/offers/:offerId/code`
    - `GET /evening/offer-codes/:codeId`
    - service validates session membership, route step ownership and step offer snapshot.
    - issued URLs point to `https://frendly.tech/code/<code>`, raw code is not stored.
- Admin Evening:
  - controller: `admin-evening.controller.ts`
  - services: `admin-venue.service.ts`, `admin-evening-route.service.ts`, `admin-evening-ai.service.ts`, `admin-evening-analytics.service.ts`.
  - endpoints under `/admin/evening/*` are guarded by `@Admin()`.
  - route template endpoints cover list, create, get, patch, publish, archive and create revision.
  - venue catalog endpoints cover partners, venues and offers.
  - AI Route Studio endpoints create briefs, generate drafts, list drafts and convert a draft into a route template revision.
  - analytics endpoint `GET /admin/evening/analytics/partners` returns partner, venue and offer activation metrics.
- Partner Portal:
  - controller: `partner-portal.controller.ts`.
  - service: `partner-portal.service.ts`.
  - endpoints under `/partner/portal/*` are guarded by `PartnerAuthGuard`.
  - CRUD covers partner meetups, communities, posters and featuring requests.
  - every query scopes by `partnerId` from the partner session; client input cannot set scope.
  - partner-created meetups use `Partner.hostUserId` as the Event host and create it lazily for the organization.
- People:
  - controller: `people.controller.ts`
  - service: `people.service.ts`
  - endpoints: `/people`, profile, direct chat.
- Dating and matches:
  - controllers: `dating.controller.ts`, `matches.controller.ts`
  - services: `dating.service.ts`, `matches.service.ts`
  - endpoints: `/dating/*`, `/matches`.
- Communities:
  - controller: `communities.controller.ts`
  - service: `communities.service.ts`
  - endpoints: `/communities/*`.
- After Dark:
  - controller: `after-dark.controller.ts`
  - service: `after-dark.service.ts`
  - endpoints: `/after-dark/*`.
- Posters:
  - controller: `posters.controller.ts`
  - service: `posters.service.ts`
  - endpoints: `/posters`.
- Uploads and media:
  - controllers: `uploads.controller.ts`, `media.controller.ts`
  - services: `uploads.service.ts`, `media.service.ts`
  - endpoints: `/uploads/*`, `/media/:assetId`.
- Notifications:
  - controller: `notifications.controller.ts`
  - service: `notifications.service.ts`
  - endpoints: `/notifications/*`, `/push-tokens`.
  - `markRead` first tries a conditional `updateMany` for unread central notifications, then falls back to a read only for already-read/not-found cases.
- Safety:
  - controller: `safety.controller.ts`
  - service: `safety.service.ts`
  - endpoints: `/safety/*`, `/reports`, `/blocks`.
  - trusted contacts support `channel` plus `value` for `phone`, `telegram` and `email`; `phoneNumber` remains for legacy clients.
  - `POST /safety/sos` validates optional event participation, creates `SafetySosAlert`, queues `safety.sos_delivery` outbox rows and returns notified contacts count.
- Settings:
  - controller: `settings.controller.ts`
  - service: `settings.service.ts`.
- Public shares:
  - controller: `shares.controller.ts`
  - service: `shares.service.ts`
  - endpoints: `POST /shares`, `GET /public/shares/:slug`.
  - creates stable short slugs for public events and Evening sessions, returns `https://frendly.tech/:slug` plus app deep link.
  - public snapshot excludes chat ids, invite tokens and private join/request state.
- Public offer codes:
  - controller: `public-code.controller.ts`.
  - endpoint: `POST /public/offer-codes/:code/activate`.
  - route is `@Public()`.
  - returns activation status, offer title, venue or partner name and activation time only.
  - does not return user id, profile, phone or avatar.
- Subscription:
  - controller: `subscription.controller.ts`
  - service: `subscription.service.ts`.
- Verification:
  - controller: `verification.controller.ts`
  - service: `verification.service.ts`.
- Stories:
  - controller: `stories.controller.ts`
  - service: `stories.service.ts`.
- Internal Telegram:
  - controller: `internal-telegram.controller.ts`
  - used by telegram relay.

## Important endpoint groups

### Auth

- `POST /auth/dev/login`
- `POST /auth/phone/request`
- `POST /auth/phone/verify`
- `POST /auth/phone/test-login`
- `POST /auth/refresh`
- `POST /auth/telegram/start`
- `POST /auth/telegram/verify`
- `POST /auth/google/verify`
- `POST /auth/yandex/verify`
- `POST /auth/logout`
- `GET /me`
- `POST /auth/phone/request` starts OTP delivery and existing-user lookup in parallel after rate checks.
- `GET /me` selects only user fields and profile `city`/`area` needed by the response.

Google/Yandex OAuth behavior:

- Mobile sends Google `idToken` to `/auth/google/verify`.
- Mobile sends Yandex native LoginSDK `oauthToken` to `/auth/yandex/verify`.
- API verifies provider identity server-side, writes `ExternalAuthAccount`, then issues normal app access and refresh tokens.
- Provider session source is saved in `Session.provider`.

### Onboarding

- `GET /onboarding/me` starts session provider lookup and onboarding preferences upsert in parallel.
- Required contact calculation still depends on session provider plus current email or phone.

### Events

- `GET /events`
- `GET /events/:eventId`
- `POST /events`
- `POST /events/:eventId/join`
- `DELETE /events/:eventId/join`
- `POST /events/:eventId/join-request`
- `DELETE /events/:eventId/join-request`
- `POST /events/:eventId/invites/:requestId/accept`
- `POST /events/:eventId/invites/:requestId/decline`
- `GET /events/:eventId/check-in`
- `POST /events/:eventId/check-in/confirm`
- `GET /events/:eventId/live`
- `GET /events/:eventId/after-party`
- `POST /events/:eventId/feedback`

### Public shares

- `POST /shares` creates or reuses a public share link for `targetType=event` or `targetType=evening_session`.
- Event shares are limited to `visibilityMode=public` and non-After-Dark events.
- Evening session shares are blocked for `privacy=invite` and `phase=canceled`.
- `GET /public/shares/:slug` is public and used by `landing/src/pages/PublicSharePage.tsx`.
- Deep links point to app routes: `/event/:eventId` for events and `/evening-preview/:sessionId` for Evening sessions.

Event join/review behavior:

- `joinEvent` is idempotent for existing participants; it heals attendance/chat membership without re-checking capacity.
- new direct joins lock the event row and check capacity inside the write transaction.
- `createJoinRequest` must not reset a reviewed request back to `pending`; if the row is reviewed during refresh, API returns 409.
- `createJoinRequest` loads only participant ids before compatibility scoring; participant onboarding is fetched once in the scoring query.
- invite `accept` and `decline` update the request only when it is still `pending` for that invited user.
- invite `accept` and `decline` both hide invites from hosts blocked by the invited user.
- `GET /events/:eventId` loads a bounded attendee preview, counts visible participants separately, and checks current-user membership separately so private access is not tied to preview contents.
- `GET /events/:eventId/live` counts visible stories with `EventStory.count` instead of loading story rows.
- Participant endpoints reuse the block lookup from `assertParticipant`; check-in, live and after-party participant includes filter blocked users in Prisma.
- Check-in and live endpoint attendance includes also filter blocked users in Prisma instead of loading all attendance rows.
- Event detail, live, check-in and after-party nested relations use narrow selects for host, attendee previews, join requests, attendance rows, live state and chat id.
- When PostGIS event feed is enabled, the candidate SQL filters blocked hosts before candidate limit, so blocked nearby hosts do not shrink the visible first page.
- Event list cursors carry `distanceKm`, `startsAt` and id, so next pages avoid a separate cursor event lookup. Old id-only cursors still work.
- `POST /events/:eventId/feedback` validates favorite ids by querying only requested participants instead of loading every event participant.

### Chats

- `GET /chats/meetups`
- `GET /chats/personal`
- `GET /chats/:chatId/messages`
- `POST /chats/:chatId/read`

Meetup list response can include Evening phase fields:

- `phase`
- `currentStep`
- `totalSteps`
- `currentPlace`
- `endTime`
- `startsInLabel`
- `routeId`
- `sessionId`
- `privacy`
- `joinedCount`
- `maxGuests`
- `hostName`
- `area`
- `mode`

Phase mapping lives in `ChatsService.mapEveningChatPhase`.

- Session-linked Evening chats use `Chat.eveningSession` as source of truth for privacy, host, capacity and route metadata.
- Legacy route-linked Evening chats can still fall back to `Chat.eveningRoute`.
- Regular meetup chats derive phase from `Event.liveState`, `Event.startsAt`, and `Event.durationMinutes`.
- `liveState=live` maps to `live`.
- `liveState=finished` or current time after `startsAt + durationMinutes` maps to `done`.
- Future start within 2 hours maps to `soon`.
- Other future chats map to `upcoming`.
- REST chat membership checks use `ChatMember.chatId_userId` and load only one peer for direct chats. Meetup checks do not load the whole member list.
- Chat list member previews are bounded to 8 visible members and filter blocked users in the Prisma include.
- Evening session chat list metadata uses a filtered participant count for `joinedCount` instead of loading every session participant.
- Chat list last-message preview filters blocked senders in the Prisma message include, so a blocked latest message does not hide the previous visible preview.
- Message history strips `replyTo` previews when the replied message author is blocked by the current user.
- Chat list and message history cursors carry their sort key (`updatedAt` or `createdAt`) plus id, so new page requests avoid an extra cursor-row lookup. Old id-only cursors still work through a fallback lookup.
- Message history loads the page and latest realtime event marker in parallel after membership, block and cursor checks.
- REST chat read markers reject messages from blocked senders before updating `ChatMember`.
- Chat and community unread fallback SQL excludes messages from symmetrically blocked users. Community unread counters fall back to raw SQL when `CHAT_UNREAD_COUNTER_READS=true` but the current user has blocks; that path reuses the loaded blocked-user set as a direct sender filter.

### Uploads and media

- Direct upload complete paths are idempotent for chat attachments, story media, avatars and profile photos.
- `MediaAsset.objectKey` is unique. Repeated complete calls return the existing ready asset when owner, kind and target match.
- If the same object key is completed for another owner, kind, chat or profile-photo target, API returns `upload_object_conflict`.
- Chat attachment direct complete validates chat membership, object key prefix, MIME and size before creating the ready asset.
- Story media direct complete validates event participation, object key prefix, MIME and size before creating the ready asset.
- Existing story media upload assets are checked against `EventStory.mediaAssetId`; completing the same object key for another event returns `upload_object_conflict`.
- Profile photo direct complete reuses the existing profile photo row on retry instead of creating a duplicate asset.
- Profile photo direct complete and avatar file upload lock the profile row before changing photo `sortOrder`, so concurrent uploads do not create duplicate ordering.
- `/media/:assetId/download-url` checks blocks for private chat media. A chat member cannot resolve media owned by a blocked user, and meetup media is hidden when the meetup host is blocked.
- Private media access starts block lookup in parallel with chat membership or story participation lookup.
- Direct complete rejects empty chat attachment, voice, story media, avatar and profile photo uploads. Ready media assets must have a positive byte size.
- Multipart file upload endpoints return controlled `media_file_required` or avatar file errors when the request has no file, instead of falling through to `TypeError`.
- Chat and story media asset creates return only response fields on direct complete and multipart file upload paths.
- Avatar and profile photo file upload paths create `MediaAsset` and `ProfilePhoto` with response-only selects. Existing profile photo retry reads only conflict-check and photo response fields.
- Avatar upload URL creation validates the requested MIME type before issuing a presigned upload URL.
- `/media/:assetId` supports normal byte ranges, open-ended ranges and suffix ranges such as `bytes=-500`. Oversized range ends are clamped to the asset size when the start is still valid.
- Story media download URL resolution checks event participation inside the story lookup, then checks blocks for the media owner and event host before returning a signed URL.
- Chat attachment direct complete uses a narrow membership read and starts object-key asset lookup while membership is still loading.
- Story media direct complete starts event participation validation and object-key asset lookup in parallel after basic payload validation.

### Stories

- Story list first validates event participation, then pages by `createdAt desc, id desc`.
- Blocked authors are filtered in the Prisma query, not after fetching, so pagination stays correct and bounded.
- `listStories` reuses the loaded blocked-user set for host visibility checks instead of loading blocks twice.
- Story list cursors carry `createdAt` plus id, so next pages avoid a separate cursor story lookup. Old id-only cursors still work.
- `createStory` checks media retry idempotency before rate limits; a retry with the same `mediaAssetId`, author and event returns the existing story even after the user hits the recent-story cap.
- `createStory` runs recent-story count and media asset validation in parallel after the media retry check.
- Story list, create and retry queries select only story response fields, author display name and avatar URL, plus media fields needed for signed media mapping.

### Dating

- Dating list and likes queries bound profile photos to 6 items per user card.
- Dating list, likes and action target queries select only card fields, onboarding interests and bounded profile photo media fields. Settings are used only in `where`, not loaded into the response payload.
- Dating `recordAction` loads the target profile and previous action in parallel after self and block checks.
- Dating like notifications use `dedupeKey=dating_like:<targetUserId>:<actorUserId>` and skip duplicate outbox work on retry or race.
- Direct chat creation through People hides users with `settings.discoverable=false` and respects symmetric blocks.
- People direct chat creation checks peer visibility and existing direct chat in parallel after block checks.
- People list cursors carry `displayName` plus id, so next pages avoid a separate cursor user lookup. Old id-only cursors still work.
- People profile detail selects only response, visibility and age-display fields, including bounded media fields for profile photos.
- Matches list loads only one profile photo preview per matched user and reuses the current user's onboarding lookup across scan batches.
- Matches list selects only target user card fields, target interests, current-user interests, reverse favorite keys and matched event title.
- `/matches` returns a paginated `{ items, nextCursor }` response; Flutter parses the `items` array.

### Communities

- Private communities remain discoverable to non-members.
- Private community content is gated: non-members do not receive `chatPreview` or media previews, and `/communities/:communityId/media` requires public, owner or member access.
- Community list cursors carry `createdAt` plus id, and community media cursors carry `communityId`, `sortOrder` and id. New page requests avoid separate cursor-row lookups. Old id-only cursors still work.

### Profile

- `GET /profile/me` selects only fields used by the profile response and profile photo media presenter.
- Profile photo reorder requires a non-empty unique list of all current photo ids. Duplicate ids are rejected before sort order updates.
- `PATCH /profile/me` updates only fields present in the payload. Missing fields are preserved; explicit `null` clears nullable profile fields.

### Settings

- `GET /settings` and `PATCH /settings` use the same narrow response select for public boolean settings.
- Testing access updates still use a transaction because they touch settings and subscriptions together.

### Subscription

- Current subscription reads select only plan, status and date fields used by the response.
- `POST /subscription/subscribe` returns the already loaded active same-plan subscription without calling `getCurrent` again.
- New subscription creation returns the created row through a narrow `select`, avoiding a follow-up current-subscription read.

### Verification

- Verification reads and submit upserts select only `status`, `selfieDone`, `documentDone` and `reviewedAt`.

### Posters

- Poster search uses the shared bounded `normalizeSearchQuery` helper before building Prisma `contains` filters.
- Poster list cursors carry `isFeatured`, `startsAt` and id, so new page requests avoid a separate cursor poster lookup. Old id-only cursors still work.

### Host

- Host dashboard event cards do not load all participants. They load a small participant preview and a filtered participant count.
- Host dashboard event cards do not include pending join requests; requests are loaded through the separate paginated request query.
- Host dashboard host, event preview, live state and request page queries use response-only selects.
- Host dashboard pending request count and request page filter blocked users before pagination.
- Host dashboard event and request cursors carry their sort key plus id, so next pages avoid separate cursor-row reads. Old id-only cursors still work.
- Host event detail filters blocked attendees, attendances and pending requests inside the Prisma query, uses a filtered participant count for summary `going`, and selects only attendee preview, request preview, live status and chat id.
- Host approve and reject request paths read only fields needed for ownership checks, chat membership, notifications and request response mapping.

### After Dark

- After Dark list and detail responses do not load all event participants. They load current-user participation plus a filtered participant count.
- After Dark detail selects only host summary fields and chat id instead of loading full host profile and chat rows.
- After Dark event list cursors carry `startsAt` plus id, so next pages avoid a separate cursor event lookup. Old id-only cursors still work.

### Blocking

- Symmetric hidden-user lookup lives in `backend/packages/database/src/user-blocks.ts` as `getBlockedUserIds`.
- API services import it from `@big-break/database` instead of duplicating `UserBlock` query and set-building logic.
- `SafetyService` keeps a separate query for listing blocks created by the current user.
- Trusted contacts rely on a database unique constraint for `(userId, channel, value)`; old phone duplicates still map to `trusted_contact_duplicate`.
- `GET /safety/me` reads only `Profile.meetupCount` and `UserVerification.status` for trust score user data.
- `GET /reports/me` selects only response fields and does not join `targetUser`, because the response currently does not expose target preview data.
- `GET /blocks` selects only block response fields plus blocked user `id` and `displayName`.
- `SafetyService.createReport` checks target existence and active duplicate report in parallel before the write transaction; it still uses a transaction advisory lock plus an in-transaction duplicate check.
- `POST /safety/sos` checks optional event existence and current-user participation in parallel, then loads user and trusted contacts in parallel.
- People direct chat creation only treats `P2002` on `directKey` as a create race; unrelated database errors are rethrown.

### Notifications

- Central notification list and unread count exclude `kind=message`.
- When blocked users exist, central notification list uses a single raw SQL page query with the same visibility predicate as unread count.
- Central notification list cursors carry `createdAt` plus id, so next pages avoid a separate cursor notification lookup. Old id-only cursors still work.
- `POST /notifications/read-all` also excludes `kind=message`; chat message read state is handled by chat read APIs and `ChatMember.unreadCount`.
- `POST /notifications/:notificationId/read` also excludes `kind=message`.
- Push token registration trims `token`, `deviceId` and `platform`; blank tokens return `invalid_push_token`.
- Push token registration removes older tokens for the same current user and `deviceId`.
- Push token delete by device id trims the device id before calling `deleteMany`.

### Evening

- `GET /evening/options`
- `POST /evening/routes/resolve`
- `GET /evening/routes/:routeId`
- `POST /evening/routes/:routeId/launch`
- `POST /evening/routes/:routeId/finish`
- `GET /evening/sessions`
- `GET /evening/sessions/:sessionId`
- `POST /evening/sessions/:sessionId/start`
- `POST /evening/sessions/:sessionId/join`
- `POST /evening/sessions/:sessionId/join-request`
- `POST /evening/sessions/:sessionId/join-requests/:requestId/approve`
- `POST /evening/sessions/:sessionId/join-requests/:requestId/reject`
- `POST /evening/sessions/:sessionId/finish`
- `POST /evening/sessions/:sessionId/steps/:stepId/check-in`
- `POST /evening/sessions/:sessionId/steps/:stepId/advance`
- `POST /evening/sessions/:sessionId/steps/:stepId/skip`
- `GET /evening/sessions/:sessionId/after-party`
- `POST /evening/sessions/:sessionId/after-party/feedback`
- `POST /evening/sessions/:sessionId/after-party/photos`
- `POST /evening/routes/:routeId/steps/:stepId/perk/use`
- `POST /evening/routes/:routeId/steps/:stepId/ticket/buy`
- `POST /evening/routes/:routeId/steps/:stepId/share-chat`

Session list/detail response includes route metadata, host, participants, capacity, privacy, current user's joined/requested state and map coordinates for the current live step or first route step.
`GET /evening/sessions` keeps join request work bounded by loading only the current user's pending request state.
`GET /evening/sessions/:sessionId` loads all pending join requests only when the current user is the session host.
Session detail response includes route metadata, host, participants, capacity, privacy and steps.
For each step it includes session live fields:

- `status`: `upcoming`, `current`, `done` or `skipped`.
- `checkedIn`: current user's check-in state for that step.
- `startedAt`, `finishedAt`, `skippedAt`.

For the host only, session detail includes `pendingRequests` with request id, user id, requester display name, status, note and creation time.
For the host only, invite-only publish/session detail can expose `inviteToken`; guests do not receive it in session detail.

Evening lifecycle chat messages use `evening-session:*` client message ids. API message presenters expose them with `kind=system`, `senderName=Frendly` and optional `systemKind`, so REST history and realtime payloads render like front system pills.

`launchRoute` behavior:

- validates route and premium access.
- if the route template is missing in production DB, creates the canonical template from shared seed data before publish.
- publishes a new `EveningSession` from the route.
- parses privacy: `open`, `request`, `invite`.
- creates a dedicated meetup chat for that session.
- stores `meetupPhase=soon`, `meetupMode=hybrid`, `currentStep=null`, `meetupStartsAt`.
- creates host participant and step states.
- writes a system message into the session chat.
- returns session id, chat id, route id, privacy and phase. Invite-only publish also returns `inviteToken` to the host.

`startSession` behavior:

- only the host can start.
- repeated start on an already `live` session is idempotent and returns the current live step without resetting progress.
- switches session to `live`.
- sets `currentStep=1`, `startedAt`, chat `meetupPhase=live`.
- marks first step as current.
- writes a system message.

`joinSession` is idempotent for users who are already `joined`; it returns the existing chat/session data before capacity checks, so a full session does not block already accepted participants from reopening preview or chat.

`joinSession` behavior:

- `open` sessions join immediately.
- immediate joins lock the session row and re-check joined capacity inside the write transaction.
- `request` sessions create or return a join request unless called through the request endpoint.
- request-mode join updates only still-requested requests. Approved or rejected requests are not reset back to `requested`; API returns 409.
- request-mode join creates a deduped central notification for the host and outbox work for push plus `notification.create`.
- `invite` sessions require a valid invite token.
- invite-only sessions accept `inviteToken` through the join body.
- live late join writes a deduped system message with the participant name and current step; Flutter rewrites the joining user's own view to `Ты присоединился · шаг N/M`.

`approveJoinRequest` and `rejectJoinRequest` behavior:

- only the host can approve or reject.
- approve locks the session row, re-checks capacity inside the transaction, marks the request approved only if it is still `requested`, adds participant, adds chat member and writes a system message.
- approve creates a deduped central notification for the guest and outbox work for push plus `notification.create`.
- reject stores reviewer and review time only if the request is still `requested`, without adding chat membership.
- reject creates a deduped central notification for the guest and outbox work for push plus `notification.create`.

Step live endpoints:

- `check-in` requires joined participant and current live step, then writes check-in and system message.
- `advance` and `skip` require host, move session/chat `currentStep` to the next route step and write system message.
- last step still uses explicit finish endpoint.

`finishSession` behavior:

- only the host can finish.
- marks session and chat as done.
- clears active step and writes a system message.

Realtime:

- `startSession`, `advanceStep`, `skipStep` and `finishSession` write `chat.updated` realtime outbox events.
- Payload can include `chatId`, `sessionId`, `routeId`, `phase`, `currentStep`, `totalSteps`, `currentPlace` and `endTime`.

Auto mode:

- Worker runs a bounded `runEveningAutoAdvanceScan`.
- It finds live `mode=auto` sessions, compares route step time labels against `startedAt`, advances due steps and finishes expired sessions.
- Auto transitions write system messages and `chat.updated` realtime outbox events.
- Batch size and interval are controlled by `WORKER_EVENING_AUTO_ADVANCE_BATCH_SIZE` and `WORKER_EVENING_AUTO_ADVANCE_INTERVAL_MS`.

After-party endpoints:

- detail is available to host or joined participants.
- feedback stores rating, reaction and comment per participant.
- photos attach already uploaded ready `MediaAsset` records to the session.

`finishRoute` behavior:

- validates route and premium access.
- requires route chat.
- marks chat `meetupPhase=done`.
- clears `currentStep`.
- stores `meetupEndsAt`.

Current backend gap:

- dedicated `evening.session.updated` fanout is not implemented yet, Evening currently uses `chat.updated`.
- host dashboard does not show Evening requests, the mobile chat UI handles approve/reject for now.

### Media and uploads

- `POST /uploads/media/upload-url`
- `POST /uploads/media/complete`
- `POST /uploads/media/file`
- `POST /uploads/chat-attachment/upload-url`
- `POST /uploads/chat-attachment/complete`
- `POST /uploads/chat-attachment/file`
- `GET /media/:assetId`
- `GET /media/:assetId/download-url`

Use direct upload path first. File fallback exists for profile/media and chat attachments.

### Notifications and push

- `GET /notifications`
- `GET /notifications/unread-count`
- `POST /notifications/:notificationId/read`
- `POST /notifications/read-all`
- `POST /push-tokens`
- `DELETE /push-tokens/device/:deviceId`
- `DELETE /push-tokens/:tokenId`

## Service notes

- `EventsService` owns event feed, detail, join, requests, create, check-in, live, after-party and feedback.
- `EventsService` has optional PostGIS first-page candidate scan behind `ENABLE_POSTGIS_EVENT_FEED=true`.
- `ChatsService` owns chat lists, message pages, read marker and Evening phase mapping.
- `EveningService` owns builder options, route resolve/detail, launch/finish and step actions.
- `UploadsService` owns upload URL/complete/file fallback.
- `MediaService` owns access checks, proxy and download URL.
- `NotificationsService` owns persisted notifications, unread count, push tokens.
- `HostService` owns host dashboard and manual live lifecycle for normal events.

## Shared packages

`@big-break/database`:

- Prisma client.
- JWT helpers.
- Redis pub/sub helpers.
- S3 helpers.
- outbox event type constants.
- chat helper functions.
- Telegram auth helpers.
- hot path DB scripts.

`@big-break/contracts`:

- API error payload.
- cursor page.
- token pair.
- upload responses.
- media DTO.
- chat message DTO.
- evening route, step, action, share, launch DTOs.
- public share DTOs for short share links and landing snapshots.
- meetup phase and launch mode types.
- WebSocket client/server event maps.
- Telegram dispatch contract.

## Tests

- Unit tests: `backend/apps/api/test/unit/`.
- Integration tests: `backend/apps/api/test/integration/`.
- Evening tests: `evening.service.unit.spec.ts`.
- Chat list phase tests: `chats.service.unit.spec.ts`.
- Run targeted:
  - `cd backend && pnpm --filter @big-break/api test:unit -- evening.service.unit.spec.ts chats.service.unit.spec.ts`.
- Build:
  - `cd backend && pnpm --filter @big-break/api build`.
