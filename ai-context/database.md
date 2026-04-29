# Database Map

## Быстрый выбор файла

- Schema source: `backend/packages/database/prisma/schema.prisma`.
- Migrations: `backend/packages/database/prisma/migrations/`.
- Seed: `backend/packages/database/prisma/seed.ts`.
- Shared Prisma client: `backend/packages/database/src/client.ts`.
- Shared user block helper: `backend/packages/database/src/user-blocks.ts`.
- API Prisma wrapper: `backend/apps/api/src/services/prisma.service.ts`.
- Chat Prisma wrapper: `backend/apps/chat/src/prisma.service.ts`.
- Worker Prisma wrapper: `backend/apps/worker/src/prisma.service.ts`.
- Hot path scripts:
  - `backend/packages/database/src/concurrent-indexes.ts`
  - `backend/packages/database/src/chat-unread-backfill.ts`
  - `backend/packages/database/src/chat-unread-verifier.ts`
  - `backend/packages/database/src/hot-query-explain.ts`
  - `backend/packages/database/src/retention-cleanup.ts`

## Stack

- Database: PostgreSQL.
- ORM: Prisma.
- Local container: `postgres:16-alpine`.
- Local DB name: `big_break`.
- Production can use PgBouncer for app runtime.
- Direct DB connection is used for migrations and concurrent index scripts.

## Model clusters

### Auth and user

- `User`: root account.
  - stores optional unique `phoneNumber` and optional unique `email`.
- `Profile`: display profile, city, area, bio, vibe, avatar relation.
- `ProfilePhoto`: ordered profile gallery.
- `OnboardingPreferences`: onboarding state.
- `UserSettings`: push, visibility, after dark flags, privacy.
- `UserVerification`: verification state.
- `Session`: refresh token id and revocation.
  - stores `provider` for the login source used by onboarding contact requirements.
- `PhoneOtpChallenge`: phone code flow.
- `TelegramAccount`: linked Telegram account.
- `TelegramLoginSession`: Telegram login start/code flow.
- `ExternalAuthAccount`: linked Google/Yandex OAuth account.
  - unique by `provider + providerUserId`.
  - stores optional provider email, display name and avatar URL.
- `AuthAuditEvent`: auth audit trail.
  - `AuthProvider` includes `session` for refresh/logout lifecycle audit.
  - `PhoneOtpChallenge` stores OTP `codeHash`/`codeSalt`, `requestKeyHash`, `attemptCount`, `lastAttemptAt`, `lastIssuedAt`; raw phone OTP code is not stored.

### Public shares

- `PublicShare`: stable short public link for social sharing.
  - stores unique `slug`, `targetType`, `targetId`, creator and optional links to `Event` or `EveningSession`.
  - unique by `targetType + targetId`, so repeated sharing reuses the same URL.
  - used by API `POST /shares` and public landing fetch `GET /public/shares/:slug`.

### Discovery and events

- `Event`: meetup/event root, host, time, place, coordinates, access, after dark flags.
- `Poster`: curated or external event card source.
- `EventParticipant`: joined user.
- `EventJoinRequest`: request/invite review state.
- `EventAttendance`: check-in state.
- `EventLiveState`: idle/live/finished.
- `EventFeedback`: after-party feedback.
- `EventFavorite`: favorite relation inside event.
- `EventStory`: story media for event.

### Frendly Evening

- `Partner`: партнерская организация для вечерних маршрутов.
  - stores city, status, contact and notes.
  - owns `Venue`, `PartnerOffer` and `PartnerOfferCode`.
- `Venue`: проверенная площадка для командных маршрутов.
  - stores source/external id, moderation status, trust level, city, timezone, area, coordinates, category, tags, average check and opening hours.
  - can belong to `Partner`; route steps keep optional `venueId` plus immutable venue snapshots.
- `PartnerOffer`: оффер партнера на площадке.
  - stores title, description, terms, short label, validity windows and status.
  - route steps keep optional `partnerOfferId` plus immutable offer snapshots.
- `EveningRouteTemplate`: публичный шаблон маршрута в экране `Маршруты`.
  - groups immutable `EveningRoute` revisions.
  - `currentRouteId` points to the latest public revision.
  - indexed by city, status, publish time and scheduled publish time.
- `EveningRoute`:
  - immutable route revision for builder, plan and team route templates.
  - fields: title, vibe, price, savings, duration, area, goal, mood, budget, format, premium, recommendedFor.
  - curated route fields include template id, version, source, status, city, timezone, center coordinates, radius, curated flag, badge, cover, admin ids and publish/archive timestamps.
  - optional unique `chatId` links to route meetup `Chat`.
  - indexes include `goal, mood, budget, id`, `templateId, version`, city feed fields and publish time.
- `EveningRouteStep`:
  - ordered route stop.
  - fields: time labels, kind, title, venue, address, emoji, distance, perk, ticket, map coords.
  - curated route fields include optional `venueId`, `partnerOfferId`, offer snapshots and venue snapshots.
  - index: `routeId, sortOrder, id`.
- `PartnerOfferCode`:
  - personal QR code record for one user, meeting, route, step and partner offer.
  - stores only `codeHash`, status, issue/activation/expiration times and activation audit fields.
  - unique by `userId, sessionId, partnerId, stepId, offerId`.
- `UserEveningStepAction`:
  - per-user action state.
  - stores `perkUsedAt`, `ticketBoughtAt`, `sentToChatAt`, optional `chatMessageId`.
  - unique by user plus step.
- `EveningSession`:
  - published evening instance created from a route.
  - fields: `routeId`, optional `routeTemplateId`, `hostUserId`, unique `chatId`, `phase`, `privacy`, `mode`, `capacity`, `startsAt`, `startedAt`, `endedAt`, `currentStep`, `inviteToken`.
  - phase values used by API: `scheduled`, `live`, `done`, `canceled`.
  - privacy values used by API: `open`, `request`, `invite`.
  - indexes: `phase, startsAt, id`, `hostUserId, phase, id`, `routeId, createdAt, id`, `routeTemplateId, phase, startsAt, id`, `chatId`.
- `EveningSessionParticipant`:
  - users joined to a session.
  - fields: `role`, `status`, `joinedAt`, `leftAt`.
  - unique by session plus user.
- `EveningSessionJoinRequest`:
  - request-mode join records.
  - fields: `status`, `note`, reviewer and review time.
  - unique by session plus user.
- `EveningSessionStepState`:
  - per-session route step state.
  - fields: `status`, `startedAt`, `finishedAt`, `skippedAt`.
  - unique by session plus route step.
- `EveningStepCheckIn`:
  - per-user check-in for a route step inside a published session.
  - unique by session plus step plus user.
- `EveningAfterPartyFeedback`:
  - per-user rating, reaction and comment after finished session.
  - unique by session plus user.
- `EveningAfterPartyPhoto`:
  - photo media attached to finished session after-party.
  - links `EveningSession`, `User` and `MediaAsset`.
  - unique by session plus media asset.
- `AiEveningBrief`, `AiEveningGenerationRun`, `AiEveningDraft`, `AiEveningDraftStep`:
  - admin-only AI Route Studio storage.
  - keeps prompt inputs, model/provider/prompt version, raw request/response JSON, validation status and generated draft steps outside public route tables.
- `EveningAnalyticsEvent`:
  - focused event log for route views, session creation and offer activation metrics.
  - stores event name, optional user/session/route/template/partner/venue/offer ids, city, metadata and created time.

Evening chat summary state is also denormalized on `Chat` for fast lists:

- `meetupPhase`: `upcoming`, `soon`, `live`, `done`.
- `meetupMode`: `auto`, `manual`, `hybrid`.
- `currentStep`: 1-based active step.
- `meetupStartsAt`.
- `meetupEndsAt`.
- index: `kind, meetupPhase, updatedAt, id`.

Current Evening notes:

- Flutter live timeline syncs check-in, advance, skip and finish through session endpoints when opened with `sessionId`.
- Worker auto mode advances and finishes live `mode=auto` sessions from step time labels.

### Chat and realtime

- `Chat`:
  - kind: meetup, direct, community.
  - optional event, source event, direct key, community, evening route.
  - owns messages, members, realtime events.
- `ChatMember`:
  - user membership.
  - read marker and materialized `unreadCount`.
  - unique by chat plus user.
- `Message`:
  - sender, text, client message id, reply relation.
  - unique by chat plus client message id.
  - Chat server checks retries by current sender before write and maps cross-sender client id collisions to `client_message_id_conflict`.
- `MessageAttachment`:
  - message to media asset join.
- `RealtimeEvent`:
  - append-only per-chat event log.

### Media

- `MediaAsset`:
  - owner, kind, status, object key, public URL, chat id, duration, waveform.
  - kinds include avatar, chat attachment, chat voice, story media, poster cover.
  - used by profile avatar/photos, stories, posters, message attachments.

### Communities

- `Community`: community root and unique chat relation.
- `CommunityMember`: user membership plus role.
- `CommunityNewsItem`: news.
- `CommunityMeetupItem`: lightweight meetup item inside community.
- `CommunityMediaItem`: community media metadata.
- `CommunitySocialLink`: external link.

### Dating, safety, payments

- `DatingAction`: actor and target action.
- `TrustedContact`: safety contact.
  - stores delivery `channel` and `value`; `phoneNumber` is kept for legacy phone clients.
  - unique by user plus channel plus value.
- `SafetySosAlert`: persisted SOS send attempt with event link, recipient snapshot, count and status.
- `UserReport`: report state.
- `UserBlock`: block relation.

Shared helpers:

- `getBlockedUserIds(client, userId)` in `backend/packages/database/src/user-blocks.ts` returns the symmetric hidden-user set for both directions of `UserBlock`.
- API and chat server use this helper for discovery, chat, notifications, media access and blocked-user filtering.
- `UserSubscription`: plan and status.

### Notifications, push, async

- `Notification`: user notification with optional chat, message, event, request, actor.
  - Frendly Evening join request, approve and reject notifications reuse existing `event_joined` / `event_invite` kinds and put `sessionId` in `payload`.
- `PushToken`: device push token.
- `OutboxEvent`: async work queue.
- `TelegramBotState`: polling state.

## Main enums

- Chat: `ChatKind`, `ChatOrigin`.
- Event: `EventTone`, `EventJoinMode`, `EventLifestyle`, `EventPriceMode`, `EventAccessMode`, `EventGenderMode`, `EventVisibilityMode`, `EventJoinRequestStatus`, `AttendanceStatus`, `AttendanceCheckInMethod`, `EventLiveStatus`.
- Media: `MediaAssetKind`, `MediaAssetStatus`.
- Notification and push: `NotificationKind`, `PushProvider`, `OutboxStatus`.
- Community: `CommunityPrivacy`, `CommunityMemberRole`, `CommunityMediaKind`.
- User and auth: `UserGender`, `VerificationStatus`, `TelegramLoginSessionStatus`, `AuthProvider`, `AuthAuditKind`, `AuthAuditResult`.
- Safety and payment: `TrustedContactMode`, `TrustedContactChannel`, `ReportStatus`, `SubscriptionPlan`, `SubscriptionStatus`.
- Dating: `DatingActionKind`.

## Key relationships

- `User` one-to-one:
  - `Profile`
  - `OnboardingPreferences`
  - `UserSettings`
  - `UserVerification`
  - `TelegramAccount`
- `User` one-to-many:
  - `Session`
  - `ExternalAuthAccount`
  - hosted `Event`
  - `ChatMember`
  - `Message`
  - `MediaAsset`
  - `Notification`
  - `PushToken`
  - safety records.
- `Event` one-to-one:
  - primary `Chat`
  - `EventLiveState`
- `Event` one-to-many:
  - participants
  - join requests
  - attendance
  - feedback
  - stories.
  - public shares.
- `EveningRoute` one-to-many:
  - `EveningRouteStep`
  - `UserEveningStepAction`
  - `EveningSession`
  - `PartnerOfferCode`
- `EveningRouteTemplate` one-to-many:
  - route revisions through `EveningRoute.templateId`
  - `EveningSession`
- `EveningRouteTemplate` optional one-to-one:
  - current route revision through `currentRouteId`.
- `Partner` one-to-many:
  - `Venue`
  - `PartnerOffer`
  - `PartnerOfferCode`.
- `Venue` one-to-many:
  - `PartnerOffer`
  - `EveningRouteStep`
  - `PartnerOfferCode`.
- `PartnerOffer` one-to-many:
  - `EveningRouteStep`
  - `PartnerOfferCode`.
- `EveningRoute` optional one-to-one:
  - route meetup `Chat`.
- `EveningSession` one-to-one:
  - session meetup `Chat`.
- `EveningSession` one-to-many:
  - participants
  - join requests
  - step states
  - check-ins.
  - after-party feedbacks
  - after-party photos.
  - public shares.
- `Chat` one-to-many:
  - members
  - messages
  - realtime events.
- `Message` one-to-many:
  - attachments
  - replies.
- `Community` one-to-one:
  - unique chat.

## Recent important migrations

- `20260426090000_db_hot_path_indexes`: chat unread counter and hot path support.
- `20260426120000_evening_plan`: EveningRoute, EveningRouteStep, UserEveningStepAction.
- `20260426150000_evening_chat_phase`: Chat meetup phase, mode, current step, start/end times.
- `20260426180000_evening_sessions`: published Evening sessions, participants, join requests, step states, step check-ins, after-party feedback/photos.
- `20260427120000_phone_otp_hardening`: phone OTP hash/salt storage, request context index, attempt counters, `session` auth audit provider.
- `20260428120000_auth_contact_requirements`: adds `User.email`, `Session.provider`, and `google`/`yandex` auth providers.
- `20260429110000_curated_evening_routes`: curated route templates, route revisions, partners, venues, partner offers, personal offer codes, AI route drafts and focused Evening analytics.
- `20260428133000_external_auth_accounts`: adds `ExternalAuthAccount` for Google/Yandex provider links.
- `20260428143000_backend_hot_path_indexes`: adds indexes for host Evening pending join requests and incoming Dating likes.
- `20260429090001_public_share_links`: adds `PublicShare` for stable short social share URLs.

## Hot path operations

- Chat unread:
  - `ChatMember.unreadCount` stores materialized unread count.
  - Reads use old COUNT path unless `CHAT_UNREAD_COUNTER_READS=true`.
  - If blocked senders exist, API keeps COUNT path to preserve filtered semantics.
- Dating likes:
  - Incoming likes use `DatingAction.targetUserId + action + actorUserId` for paged scans.
- Evening pending requests:
  - Host session detail uses `EveningSessionJoinRequest.sessionId + status + createdAt + id` for ordered pending request scans.
- Backfill:
  - `pnpm --filter @big-break/database db:backfill:chat-unread`.
  - batches by `ChatMember.id`.
- Verify:
  - `pnpm --filter @big-break/database db:verify:chat-unread`.
- Concurrent indexes:
  - `pnpm --filter @big-break/database db:indexes:hot-path`.
  - not inside Prisma migrations because Prisma wraps migrations in a transaction.
- Retention cleanup:
  - `pnpm --filter @big-break/database db:cleanup:retention`.
  - worker can run it when `WORKER_RETENTION_CLEANUP_ENABLED=true`.
- Hot query explain:
  - `pnpm --filter @big-break/database db:perf:hot-queries`.

## Geo and search

- Event feed has composite indexes for after dark, start time, filters and coordinates.
- Optional PostGIS:
  - setup command: `pnpm --filter @big-break/database db:postgis:event-geo`.
  - read flag: `ENABLE_POSTGIS_EVENT_FEED=true`.
  - first-page candidate ids use `ST_DWithin` plus `ST_Distance`.
- Search indexes include trigram support for text search.

## Seed data

- Seed file: `backend/packages/database/prisma/seed.ts`.
- Seeds users, events, chats, posters, communities, after dark and evening routes.
- Seeds local curated route data for MVP checks:
  - partner `Frendly Test Partner`;
  - two Moscow venues;
  - one active partner offer;
  - one published `EveningRouteTemplate`;
  - one current curated `EveningRoute` revision with two steps and an offer snapshot.
- Evening demo chats include live, soon, upcoming and done phases.
- When adding new AI context-visible demo behavior, update seed only if local/dev UI needs it.

## When changing schema

1. Update `schema.prisma`.
2. Add migration under `backend/packages/database/prisma/migrations/`.
3. Update seed if demo data changes.
4. Run Prisma generate.
5. Update contracts/services/tests if API shape changed.
6. Update this AI context file if a model, relation, hot path or flow changed.
