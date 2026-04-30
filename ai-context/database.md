# Database Map

Use this for Prisma schema, migrations, seed, indexes and model relations.

## Fast paths

- Schema: `backend/packages/database/prisma/schema.prisma`.
- Migrations: `backend/packages/database/prisma/migrations/`.
- Seed: `backend/packages/database/prisma/seed.ts`.
- Shared client: `backend/packages/database/src/client.ts`.
- Shared block helper: `backend/packages/database/src/user-blocks.ts`.
- API Prisma wrapper: `backend/apps/api/src/services/prisma.service.ts`.
- Chat Prisma wrapper: `backend/apps/chat/src/prisma.service.ts`.
- Worker Prisma wrapper: `backend/apps/worker/src/prisma.service.ts`.
- DB scripts: `backend/packages/database/src/concurrent-indexes.ts`, `chat-unread-backfill.ts`, `chat-unread-verifier.ts`, `hot-query-explain.ts`, `retention-cleanup.ts`.

## Stack

- PostgreSQL.
- Prisma.
- Local container: `postgres:16-alpine`.
- Local DB: `big_break`.
- Production runtime can use PgBouncer.
- Migrations and concurrent indexes use direct DB URL.

## Model clusters

Auth and user:

- `User`, `Profile`, `ProfilePhoto`, `OnboardingPreferences`, `UserSettings`, `UserVerification`.
- `Session`, `PhoneOtpChallenge`, `TelegramAccount`, `TelegramLoginSession`, `ExternalAuthAccount`, `AuthAuditEvent`.
- Partner auth: `PartnerAccount`, `PartnerSession`.
- Admin auth: `AdminUser`, `AdminSession`, `AdminAuditEvent`.

Discovery and events:

- `Event`, `Poster`, `EventParticipant`, `EventJoinRequest`, `EventAttendance`, `EventLiveState`, `EventFeedback`, `EventFavorite`, `EventStory`.
- Partner-owned content uses optional `partnerId` where supported.

Frendly Evening:

- `Partner`, `Venue`, `PartnerOffer`.
- `EveningRouteTemplate`, `EveningRoute`, `EveningRouteStep`.
- `EveningSession`, `EveningSessionParticipant`, `EveningSessionJoinRequest`, `EveningSessionStepState`, `EveningStepCheckIn`.
- `EveningAfterPartyFeedback`, `EveningAfterPartyPhoto`.
- `PartnerOfferCode`, `UserEveningStepAction`.
- AI studio: `AiEveningBrief`, `AiEveningGenerationRun`, `AiEveningDraft`, `AiEveningDraftStep`.
- Analytics: `EveningAnalyticsEvent`.
- Partner featuring: `PartnerFeaturedRequest`.

Chat and realtime:

- `Chat`, `ChatMember`, `Message`, `MessageAttachment`, `RealtimeEvent`.
- `ChatMember.unreadCount` stores materialized unread count.
- Evening chat summary is denormalized on `Chat`: `meetupPhase`, `meetupMode`, `currentStep`, `meetupStartsAt`, `meetupEndsAt`.

Media:

- `MediaAsset` covers avatars, profile photos, chat attachments, voice, stories and poster covers.

Communities:

- `Community`, `CommunityMember`, `CommunityNewsItem`, `CommunityMeetupItem`, `CommunityMediaItem`, `CommunitySocialLink`.

Safety and monetization:

- `DatingAction`, `TrustedContact`, `SafetySosAlert`, `UserReport`, `UserBlock`, `UserSubscription`.

Notifications and async:

- `Notification`, `PushToken`, `OutboxEvent`, `TelegramBotState`.

Public:

- `PublicShare` stores stable public slug for event and Evening session sharing.

## Important relations

- `User` owns profile, settings, sessions, messages, media, notifications, push tokens and safety records.
- `Event` owns primary chat, participants, requests, attendance, feedback, stories and public shares. It can optionally point to `EveningRoute` via `eveningRouteId` when a meetup is created from a ready or custom route.
- `EveningRouteTemplate` owns immutable route revisions and current route pointer.
- `EveningRoute` owns steps, sessions and optional route chat.
- `EveningSession` owns session chat, participants, join requests, step states, check-ins, feedback, photos and public shares.
- `Chat` owns members, messages and realtime events.
- `Community` owns a unique chat.
- `Partner` owns venues, offers, offer codes and partner-created content.

## Recent important migrations

- `20260426090000_db_hot_path_indexes`.
- `20260426120000_evening_plan`.
- `20260426150000_evening_chat_phase`.
- `20260426180000_evening_sessions`.
- `20260427120000_phone_otp_hardening`.
- `20260428120000_auth_contact_requirements`.
- `20260428133000_external_auth_accounts`.
- `20260428143000_backend_hot_path_indexes`.
- `20260429090001_public_share_links`.
- `20260429110000_curated_evening_routes`.
- `20260430120000_event_route_selection`.
- `20260430170000_admin_auth_audit_and_checks`.

## Hot paths

- Chat unread can read `ChatMember.unreadCount` when `CHAT_UNREAD_COUNTER_READS=true`.
- Blocked senders keep filtered COUNT path where needed.
- Incoming dating likes use `DatingAction.targetUserId + action + actorUserId`.
- Host Evening pending requests use `EveningSessionJoinRequest.sessionId + status + createdAt + id`.
- Event geo can use optional PostGIS with `ENABLE_POSTGIS_EVENT_FEED=true`.
- Evening analytics admin filters use `EveningAnalyticsEvent.venueId + name + createdAt + id`.

## Commands

```bash
cd backend && pnpm --filter @big-break/database prisma:generate
cd backend && pnpm --filter @big-break/database db:deploy
cd backend && pnpm --filter @big-break/database db:indexes:hot-path
cd backend && pnpm --filter @big-break/database db:backfill:chat-unread
cd backend && pnpm --filter @big-break/database db:verify:chat-unread
cd backend && pnpm --filter @big-break/database db:cleanup:retention
cd backend && pnpm --filter @big-break/database db:perf:hot-queries
```

## Seed

Seed file: `backend/packages/database/prisma/seed.ts`.

It seeds users, events, chats, posters, communities, After Dark and Evening demo data. Curated Evening seed includes a test partner, Moscow venues, active offer, published route template and route revision.

## When changing schema

1. Update `schema.prisma`.
2. Add migration.
3. Update seed if demo data changes.
4. Run Prisma generate.
5. Update services, contracts and tests if API shape changed.
6. For string status fields, prefer DB check constraints when the field stays a Prisma `String`.
7. Update this map if model, relation, hot path or flow changed.
