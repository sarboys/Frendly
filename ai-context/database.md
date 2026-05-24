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
- Admin auth and analytics: `AdminUser`, `AdminSession`, `AdminAuditEvent`, `AdminDashboardSnapshot`.

Discovery and events:

- `Event`, `EventParticipant`, `EventJoinRequest`, `EventAttendance`, `EventLiveState`, `EventFeedback`, `EventFavorite`, `EventStory`.
- Partner-owned content uses optional `partnerId` where supported.
- `Event.sourceExternalContentItemId` links a user-created meetup back to an imported source. For `afficheEventId` it points to a public imported event. For `externalPlaceId` it points to a published Tomesto place selected in Create Meetup.

Frendly Evening:

- `Partner`, `Venue`, `PartnerOffer`.
- `EveningRouteTemplate`, `EveningRoute`, `EveningRouteStep`.
- `EveningSession`, `EveningSessionParticipant`, `EveningSessionJoinRequest`, `EveningSessionStepState`, `EveningStepCheckIn`.
- `EveningAfterPartyFeedback`, `EveningAfterPartyPhoto`.
- `PartnerOfferCode`, `UserEveningStepAction`.
- AI studio: `AiEveningBrief`, `AiEveningGenerationRun`, `AiEveningDraft`, `AiEveningDraftStep`.
- User AI route drafts: `EveningAiRouteDraft` stores `userId`, status, prompt/config, `candidatePackJson`, `routeSnapshotJson`, accepted step indexes, rejected external item ids, model, latency, validation issues, optional `routeId` and `expiresAt`.
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

- `MediaAsset` covers avatars, profile photos, chat attachments, voice, stories and private verification uploads.
- Verification files use `MediaAssetKind.verification_selfie` and `MediaAssetKind.verification_document`. They are private assets linked from `UserVerification.selfieAssetId` and `UserVerification.documentAssetId`.
- Private media kinds `chat_attachment`, `chat_voice`, `story_media`, `verification_selfie` and `verification_document` must keep `publicUrl=null`. Use `db:verify:private-media-public-urls` to check historical rows and `db:backfill:private-media-public-urls` to clean them.

Communities:

- `Community`, `CommunityMember`, `CommunityNewsItem`, `CommunityMeetupItem`, `CommunityMediaItem`, `CommunitySocialLink`.

Safety and monetization:

- `DatingAction`, `DatingUsageEvent`, `UserFollow`, `ProfileReaction`, `TrustedContact`, `SafetySosAlert`, `UserReport`, `UserBlock`, `UserSubscription`.
- Frendly+ plan catalog uses `SubscriptionCatalogPlan` and `SubscriptionCatalogSettings`. `UserSubscription.plan` is a string plan id, not a Prisma enum, so admin can add new durations such as 3 or 6 months without another schema migration.
- One-time T-Bank payments use `PaymentOrder` with provider `tbank`, product kind `tokens`, unique `orderId`, optional unique provider payment id, amount in kopecks, status, raw status and raw notification. Legacy subscription orders may exist, but new Frendly+ purchases spend tokens instead of creating payment orders.
- Token balances use `TokenWallet`, `TokenLedgerEntry` and `TokenPromotion`. Purchase idempotency is enforced by unique `TokenLedgerEntry.paymentOrderId`; Frendly+ token purchases use `TokenLedgerReason.subscription_spend`. Frendly season gifts use `TokenLedgerReason.reward_grant`. Paid dating super-likes and rewinds use `TokenLedgerReason.dating_spend`.
- `DatingUsageEvent` is the server source for dating swipe hour limits, daily free super-like quota, daily rewind quota and paid dating spend history. Kinds are `swipe`, `super_like_free`, `super_like_paid`, `rewind_free` and `rewind_paid`.
- `UserSeasonRewardClaim` stores one claimed Frendly season reward per `userId + seasonKey + rewardKey`, so reward claim endpoints stay idempotent.
- `UserFollow` stores normal profile subscriptions. `ProfileReaction` stores normal profile likes and super-likes through `ProfileReactionKind`, separate from dating likes.

Drops:

- `Drop` stores each giveaway with type, status, optional `imageUrl`, prize JSON, public seed hash, secret seed after draw, eligibility flags and optional ticket limits.
- `DropRewardEvent` is the idempotent reward event log. `idempotencyKey` is unique and all ticket grants must go through this event.
- `DropTicket` stores public ticket codes, source, month key, status and optional assigned `dropId`. A ticket can be assigned to only one Drop at a time.
- `DropDrawSnapshot` stores fixed ticket and participant JSON before the draw.
- `DropWinner` stores main and reserve winners with verification and prize delivery statuses. Reserve winners can be promoted when a main winner is rejected or expired.
- `DropReferral` stores referral link codes, invited user binding and reward state. The invited user is rewarded only after verification.
- `DropUserRestriction` freezes a user from Drops without changing the global user status.

Notifications and async:

- `Notification`, `PushToken`, `OutboxEvent`, `TelegramBotState`.
- `NotificationKind.verification` is used for verification approve and return notifications. Payloads use `source=verification` so mobile can refresh profile, verification and subscription state.

Admin analytics:

- `AdminDashboardSnapshot` stores cached dashboard KPI payloads with `computedAt` and `expiresAt`. The admin dashboard uses a 5 minute TTL for aggregate analytics, while recent activity, upcoming meetups and new users stay live bounded queries.

Admin app overlays:

- `AppVersionPolicy` stores forced update policy per platform: enabled flag, minimum supported build, latest build note, store URL and popup copy.
- `AppPopupCampaign` stores admin-managed popup campaigns with Russian-facing admin fields mapped in API: status, title/body, dismissible flag, priority, optional button action, platform/build filters, Frendly+/verified tri-state filters and city JSON list.
- `AppPopupTargetUser` stores selected user ids for campaigns where audience is not all users.
- `AppPopupCampaignStats` stores aggregate impression, CTA click and dismiss counters per campaign.

Public:

- `PublicShare` stores stable public slug for event and Evening session sharing.

## Important relations

- `User` owns profile, settings, sessions, messages, media, notifications, push tokens and safety records.
- `User` can be targeted by admin popup campaigns through `AppPopupTargetUser`.
- `UserVerification` stores the current verification state, step completion flags, selfie/document asset links, `submittedAt`, `reviewedAt` and the latest `reviewNote`. Queue reads use the `status + submittedAt` index.
- `Event` owns primary chat, participants, requests, attendance, feedback, stories and public shares. It can optionally point to `EveningRoute` via `eveningRouteId` when a meetup is created from a ready or custom route.
- `Event.requiresVerification` and `Event.requiresFrendlyPlus` gate new entry into a meetup. Both default to `false`; existing participants stay participants when the flags change.
- `Event` can optionally point to `ExternalContentItem` through `sourceExternalContentItemId` when created from public affiche or a selected Tomesto place. Presenters must branch by `contentKind`: event sources produce ticket fields, place sources produce booking fields.
- `EveningRouteTemplate` owns immutable route revisions and current route pointer.
- `EveningRoute` owns steps, sessions and optional route chat.
- `EveningAiRouteDraft` is a user-facing draft, not an admin review draft. It keeps the candidate pack for stable step regeneration and turns into a normal `EveningRoute` only after all steps are accepted.
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
- Dating matches read `DatingAction.actorUserId + action + updatedAt + targetUserId` and reciprocal `targetUserId + action + actorUserId` indexes.
- Dating usage limits read `DatingUsageEvent.userId + kind + createdAt`, `userId + createdAt` and optional `targetUserId + kind + createdAt`. Super-like and rewind daily quotas use the Moscow calendar day; free hourly swipe limit uses a rolling hour.
- Dating discover interest ranking uses a GIN index on `OnboardingPreferences.interests`.
- Payment lookup uses `PaymentOrder.orderId` and `PaymentOrder.userId + createdAt`; pending expiry scans use `PaymentOrder.status + expiresAt`.
- Subscription catalog reads use `SubscriptionCatalogPlan.active + sortOrder`; inactive rows stay for admin history and are hidden from public purchase endpoints.
- Admin dashboard snapshot reads use `AdminDashboardSnapshot.expiresAt` to avoid recalculating KPI aggregates on every dashboard open.
- Active promotions use `TokenPromotion.eventId + expiresAt`, `chatId + expiresAt` and `userId + expiresAt`.
- Drops reward idempotency uses unique `DropRewardEvent.idempotencyKey`. Monthly progress reads use `DropTicket.userId + monthKey + status`. Manual apply reads free active tickets by `userId + dropId + status`.
- Draw participant snapshots read `DropTicket.dropId + status + assignedAt`; winner lookups use `DropWinner.dropId + reserve + position`.
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
cd backend && pnpm --filter @big-break/database db:backfill:private-media-public-urls
cd backend && pnpm --filter @big-break/database db:verify:chat-unread
cd backend && pnpm --filter @big-break/database db:verify:private-media-public-urls
cd backend && pnpm --filter @big-break/database db:cleanup:retention
cd backend && pnpm --filter @big-break/database db:perf:hot-queries
cd backend && pnpm --filter @big-break/database db:seed:test-accounts
cd backend && pnpm --filter @big-break/database db:delete:test-accounts
cd backend && pnpm --filter @big-break/database db:delete:app-users
cd backend && pnpm --filter @big-break/database db:delete:external-imports
```

## Seed

Seed file: `backend/packages/database/prisma/seed.ts`.

Seed no longer inserts demo data. It only cleans legacy deterministic demo rows from the old seed by known IDs, including demo users, events, communities, chats, Evening routes, test partner, venues and offer. Running `db:seed` must not create mock users, mock events or mock routes.

Test account data is separate from `db:seed`: `backend/packages/database/prisma/seed-test-accounts.ts` creates or deletes the 10 repeated-digit phone accounts, their profiles, photos, Frendly Plus subscriptions, hosted Moscow meetups and test clubs.

Release cleanup for a tester launch is separate from test account cleanup: `backend/packages/database/prisma/delete-app-users.ts` deletes all app `User` rows and related user data, including profiles, chats, messages, likes, follows, meetups, communities, media, auth sessions, verification, push tokens, token/payment/subscription rows, Drops user rows and user Evening session rows. It intentionally leaves admin users/sessions, partner accounts, venues, partner offers, subscription catalog, imported external content, app version policies and popup campaigns.

External import cleanup is separate from user cleanup: `backend/packages/database/prisma/delete-external-imports.ts` deletes imported affiche/place rows, import runs, source definitions and generated route review drafts. It first clears `Event.sourceExternalContentItemId` links, so user or partner meetups are preserved. It does not delete S3 objects mirrored under `external-content/...`.

## When changing schema

1. Update `schema.prisma`.
2. Add migration.
3. Update seed only if legacy demo cleanup identifiers change.
4. Run Prisma generate.
5. Update services, contracts and tests if API shape changed.
6. For string status fields, prefer DB check constraints when the field stays a Prisma `String`.
7. Update this map if model, relation, hot path or flow changed.
