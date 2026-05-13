# Database Map

Use this for Prisma schema, migrations, seed, indexes and model relations.

For concrete files and impacted services, run `./scripts/ua-query.mjs "<model or flow>"` first.

## Source of truth

- Schema: `backend/packages/database/prisma/schema.prisma`.
- Migrations: `backend/packages/database/prisma/migrations/`.
- Seed: `backend/packages/database/prisma/seed.ts`.

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
- `Event.sourceExternalContentItemId` links a user-created meetup back to an imported source. For `afficheEventId` it points to a public imported event. For `externalPlaceId` it points to a published Tomesto place selected in Create Meetup.

Frendly Evening:

- `Partner`, `Venue`, `PartnerOffer`.
- `EveningRouteTemplate`, `EveningRoute`, `EveningRouteStep`.
- `EveningSession`, `EveningSessionParticipant`, `EveningSessionJoinRequest`, `EveningSessionStepState`, `EveningStepCheckIn`.
- `EveningAfterPartyFeedback`, `EveningAfterPartyPhoto`.
- `PartnerOfferCode`, `UserEveningStepAction`.
- AI studio: `AiEveningBrief`, `AiEveningGenerationRun`, `AiEveningDraft`, `AiEveningDraftStep`.
- Route aggregation: `ExternalContentSource`, `ExternalImportRun`, `ExternalContentItem`, `GeneratedRouteDraftBatch`, `GeneratedRouteReviewDraft`, `GeneratedRouteDraftStep`. Manual imports and route generations use `pending_manual` statuses that worker scans outside the API request path.
- `ExternalImportRun` stores import counters for admin health: `publishedCount`, `paidCount`, `freeCount`, `unknownPriceCount`, `missingCoordsCount`.
- `ExternalContentItem` separates imported events and places through `contentKind`. Public affiche fields include `venueName`, `imageUrl`, `actionUrl`, `actionKind`, `priceMode`, `isAffiliate`, `sourceProvider`, `placeKind`, `lastSeenAt`, `publicStatus`.
- Tomesto uses the same `ExternalContentSource`, `ExternalImportRun` and `ExternalContentItem` models. Places store route-builder taxonomy in `tags`, for example `area:center`, `occasion:food`, `budget:cheap`, `metro:*`, `feature:*`, `set:*`, and a compact `raw.taxonomy`. Promos store compact place linkage in `raw.placeSlug`, `raw.venueName` and address when available. Reviews and menu text are not stored.
- `priceMode=free` means exact external price `0`; `unknown` must not be treated as free. `publicStatus` gates public affiche and route candidate visibility.
- Dedupe enrichment can be stored in `ExternalContentItem.raw.enrichment`, including source code, source item id, duplicate key, confidence and fields copied from the matched item.
- `EveningRouteStep` can store external ticket metadata as `ticketUrl`, `ticketSourceCode` and `ticketProvider`. This is for external affiliate checkout only, not in-app payment.
- Analytics: `EveningAnalyticsEvent`.
- Partner featuring: `PartnerFeaturedRequest`.

Chat and realtime:

- `Chat`, `ChatMember`, `Message`, `MessageAttachment`, `RealtimeEvent`.
- `ChatMember.unreadCount` stores materialized unread count.
- `ChatMember.isPinned` and `pinnedAt` store per-user chat pin state for meetup and direct chat lists.
- Evening chat summary is denormalized on `Chat`: `meetupPhase`, `meetupMode`, `currentStep`, `meetupStartsAt`, `meetupEndsAt`.

Media:

- `MediaAsset` covers avatars, profile photos, chat attachments, voice, stories and poster covers.

Communities:

- `Community`, `CommunityMember`, `CommunityNewsItem`, `CommunityMeetupItem`, `CommunityMediaItem`, `CommunitySocialLink`.

Safety and monetization:

- `DatingAction`, `UserFollow`, `ProfileReaction`, `TrustedContact`, `SafetySosAlert`, `UserReport`, `UserBlock`, `UserSubscription`.
- One-time T-Bank payments use `PaymentOrder` with provider `tbank`, product kind `subscription` or `tokens`, unique `orderId`, optional unique provider payment id, amount in kopecks, status, raw status and raw notification.
- Token balances use `TokenWallet`, `TokenLedgerEntry` and `TokenPromotion`. Purchase idempotency is enforced by unique `TokenLedgerEntry.paymentOrderId`.
- `UserFollow` stores normal profile subscriptions. `ProfileReaction` stores normal profile likes and super-likes through `ProfileReactionKind`, separate from dating likes.

Notifications and async:

- `Notification`, `PushToken`, `OutboxEvent`, `TelegramBotState`.

Public:

- `PublicShare` stores stable public slug for event and Evening session sharing.

## Important relations

- `User` owns profile, settings, sessions, messages, media, notifications, push tokens and safety records.
- `Event` owns primary chat, participants, requests, attendance, feedback, stories and public shares. It can optionally point to `EveningRoute` via `eveningRouteId` when a meetup is created from a ready or custom route.
- `Event` can optionally point to `ExternalContentItem` through `sourceExternalContentItemId` when created from public affiche or a selected Tomesto place. Presenters must branch by `contentKind`: event sources produce ticket fields, place sources produce booking fields.
- `EveningRouteTemplate` owns immutable route revisions and current route pointer.
- `EveningRoute` owns steps, sessions and optional route chat.
- Generated route review drafts link to imported external items through draft steps. They publish only after admin convert and publish creates an `EveningRouteTemplate` plus current `EveningRoute`.
- `EveningSession` owns session chat, participants, join requests, step states, check-ins, feedback, photos and public shares.
- `Chat` owns members, messages and realtime events.
- `Community` owns a unique chat.
- `Partner` owns venues, offers, offer codes and partner-created content.

## Hot paths

- Chat unread reads `ChatMember.unreadCount` by default. Set `CHAT_UNREAD_COUNTER_READS=false` for the filtered COUNT fallback.
- Chat list pin reads use `ChatMember.userId + isPinned + pinnedAt` and sort pinned rows above normal recency in the API response.
- Community unread fallback keeps the DB `UserBlock` visibility filter in SQL.
- Incoming dating likes use `DatingAction.targetUserId + action + actorUserId`.
- `/matches` reads reciprocal positive `DatingAction` rows, not event favorites.
- Dating matches and daily super-like quota reads need `DatingAction.actorUserId + action + updatedAt + targetUserId` and reciprocal `targetUserId + action + actorUserId` indexes. Super-like quota counts rows for the current UTC day.
- Payment lookup uses `PaymentOrder.orderId` and `PaymentOrder.userId + createdAt`; pending expiry scans use `PaymentOrder.status + expiresAt`.
- Active promotions use `TokenPromotion.eventId + expiresAt`, `chatId + expiresAt` and `userId + expiresAt`.
- Profile social counts use `UserFollow.targetUserId`, `ProfileReaction.targetUserId + kind` and viewer state uses actor plus target. `ProfileReaction` is unique by `actorUserId + targetUserId + kind`, so like and super-like can both exist for one viewer.
- `db:perf:hot-queries` covers reciprocal dating matches, bounded push token dispatch reads, public Affiche list/search/price filters, and route generation ExternalContentItem event/place scans.
- Host Evening pending requests use `EveningSessionJoinRequest.sessionId + status + createdAt + id`.
- Event geo can use optional PostGIS with `ENABLE_POSTGIS_EVENT_FEED=true`. The generated `Event.geo` column and GiST index are enabled by `db:postgis:event-geo`, not by normal Prisma deploy, so do not make it the production default unless that rollout step is guaranteed. Geo cursors must use the same effective distance that sorted the page.
- Evening analytics admin filters use `EveningAnalyticsEvent.venueId + name + createdAt + id`.
- Public affiche reads use partial `ExternalContentItem` indexes on `city + startsAt + id`, plus category, price and featured variants, filtered by `contentKind=event`, `publicStatus=published`, non-rejected moderation and `priceMode in (free, paid)`.
- Public affiche search uses trigram indexes on `title`, `venueName` and `address`; keep `pg_trgm` available in migrations and hot-path index scripts.
- Admin content review uses `ExternalContentItem.city + startsAt + priceMode + contentKind + moderationStatus + sourceId` plus `sourceId + priceMode + importedAt + id`.

## Commands

```bash
cd backend && pnpm --filter @big-break/database prisma:generate
cd backend && pnpm --filter @big-break/database db:deploy
cd backend && pnpm --filter @big-break/database db:indexes:hot-path
cd backend && pnpm --filter @big-break/database db:backfill:chat-unread
cd backend && pnpm --filter @big-break/database db:verify:chat-unread
cd backend && pnpm --filter @big-break/database db:cleanup:retention
cd backend && pnpm --filter @big-break/database db:perf:hot-queries
cd backend && pnpm --filter @big-break/database db:seed:test-accounts
cd backend && pnpm --filter @big-break/database db:delete:test-accounts
```

## Seed

Seed file: `backend/packages/database/prisma/seed.ts`.

Seed no longer inserts demo data. It only cleans legacy deterministic demo rows from the old seed by known IDs, including demo users, events, posters, communities, chats, Evening routes, test partner, venues and offer. Running `db:seed` must not create mock users, mock events or mock routes.

Test account data is separate from `db:seed`: `backend/packages/database/prisma/seed-test-accounts.ts` creates or deletes the 10 repeated-digit phone accounts, their profiles, photos, Frendly Plus subscriptions, hosted Moscow meetups and test clubs.

## When changing schema

1. Update `schema.prisma`.
2. Add migration.
3. Update seed only if legacy demo cleanup identifiers change.
4. Run Prisma generate.
5. Update services, contracts and tests if API shape changed.
6. For string status fields, prefer DB check constraints when the field stays a Prisma `String`.
7. Update this map if model, relation, hot path or flow changed.
