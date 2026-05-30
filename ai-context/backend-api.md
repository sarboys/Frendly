# Backend API Map

Use this for REST endpoints, DTOs, service behavior and API tests.

For concrete controllers and services, run `./scripts/ua-query.mjs "<endpoint or flow>"` first.

## Runtime rules

- NestJS app, default port `3000`.
- Global `ValidationPipe` with whitelist and transform.
- Global `AuthGuard`; public routes use `@Public()`.
- Current user comes from `@CurrentUser()`.
- Request context carries `requestId`, `userId`, `sessionId`.
- Partner portal uses `PartnerAuthGuard` and partner request context.
- Admin routes use `@Admin()`, `AdminTokenGuard` and admin request context.
- Admin actions are written to `AdminAuditEvent` by `AdminAuditInterceptor`.
- Errors use `ApiError` and `ApiExceptionFilter`.
- CORS only when `CORS_ORIGIN` is set.

## Endpoint groups

Auth:

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

Support:

- `POST /support/telegram/start` is authenticated and returns `{ botUrl }` with a short `support_<token>` Telegram deep link. The token is stored hashed and expires quickly; never expose `userId` in the link.
- Telegram support messages are handled through `/internal/telegram/dispatch` with `support_start`, `support_message` and `support_reply`. User messages go to the configured support group, and operator replies are sent back to the user's Telegram chat.

App overlays:

- `GET /app/overlay?platform=ios|android&buildNumber=<number>` is an authenticated mobile startup check. It returns `{ overlay, checkAfterSeconds }`. `overlay=null` means nothing should be shown. Version policy wins over campaigns.
- Version policy overlays use `source=version_policy`, `kind=force_update`, `dismissible=false` and CTA `action=store_update`. They are shown when the user's build is lower than `minSupportedBuild` for the platform.
- Campaign overlays use `source=campaign`, `kind=announcement`, admin text fields, optional CTA and `dismissible` from the campaign.
- Campaign matching filters by selected user ids, platform, min/max build, Frendly+ access, verification and profile city. Highest `priority` wins.
- `POST /app/overlay/events` accepts `{ overlayId, source, event }`, where event is `impression`, `cta_click` or `dismiss`. Campaign events increment aggregate stats. Version policy events are accepted but do not create stats.

Events:

- `GET /events/public/active` is public and returns active public non-After-Dark meetups for the landing page. Query params: `city`, `limit`. It defaults to Moscow and 5 items, caps at 10, filters canceled/private/After-Dark events out, keeps recently started meetings eligible, and returns no participant names or private viewer state.
- `GET /events`
- `GET /events/:eventId`
- `POST /events`
- `POST /events/:eventId/join`
- `DELETE /events/:eventId/join`
- `POST /events/:eventId/join-request`
- `POST /events/:eventId/invites`
- `POST /events/:eventId/invites/:requestId/accept`
- `POST /events/:eventId/invites/:requestId/decline`
- check-in, live, after-party, feedback endpoints live under `/events/:eventId/*`.
- `GET /events/:eventId` includes `community: { id, name, avatar } | null` when the meetup was created from a community. Mobile uses it as the link back to the community from the meeting detail screen.
- `GET /events` accepts `city`, `requiresVerification=true` and `requiresFrendlyPlus=true`; these filters can be combined with date, text, access and geo filters. City filtering uses stored `Event.city` in both Prisma and PostGIS list paths, so legacy events without city are excluded from city-scoped discovery.
- `GET /events` may cache only the base public feed page in Redis for short TTLs. Text search bypasses this cache. Cache hits revalidate cached ids against current visibility and still load participant counts, participant previews, current join state, join requests, attendance and live state from Postgres, so viewer overlay stays live. Event create, direct join, leave and accepted invite increment `events:feed-version:v1:<city>` and that version is part of the cache key when present. No Redis key scan is used.
- `POST /events` and `PATCH /host/events/:eventId` accept `joinMode` and `accessMode`. `open` joins directly, `request` requires `POST /events/:eventId/join-request` and host approval through `/host/requests/:requestId/approve|reject`.
- `POST /events/:eventId/join-request` and `DELETE /events/:eventId/join-request` return the refreshed event detail/summary payload, not the raw request row, so mobile list and detail state keep the event id, image and viewer request status.
- Event summaries expose `city`, `genderMode`, `requiresVerification`, `requiresFrendlyPlus`, `joinMode`, `accessMode`, cover-first `imageUrl`, `imageVariants` and lightweight `memberProfiles` with participant avatar URLs. Gender-specific events stay visible in feeds; direct join/request returns `403 event_gender_restricted` when the viewer gender does not match.
- Route-backed event detail exposes `routePoints` for every valid route step with coordinates plus `time`, `venue`, `address`, `kind`, `ticketUrl`, `ticketSourceCode`, `ticketProvider` and `ticketPrice`. Mobile renders these as the meeting evening plan and uses Tomesto ticket links as table booking actions.
- Event cover uploads use media scope/kind `event_cover`. `POST /events` and `PATCH /host/events/:eventId` accept `coverAssetId`, which must be a ready `event_cover` asset owned by the host. Event covers are public media and get image variants through the worker.
- `POST /events` accepts optional `address`, `city`, `latitude` and `longitude`. Existing route sources use the first valid route step point and reject `0,0`. Tomesto place sources require stored source coordinates. Affiche sources prefer stored source coordinates, can use explicit client coordinates when the source has none, and can temporarily create the meetup with null coordinates while client geo enrichment saves the source point. Manual place creation uses explicit body coordinates first, then high-confidence Yandex geocoding of `address/place + city`. Missing manual coordinates return `400 event_coordinates_required`; selected route/place sources without valid coordinates return `409 event_source_coordinates_missing`.

Host:

- `GET /host/dashboard`
- `GET /host/events/:eventId`
- `PATCH /host/events/:eventId`
- `POST /host/requests/:requestId/approve`
- `POST /host/requests/:requestId/reject`
- `POST /host/events/:eventId/check-in`
- `POST /host/events/:eventId/live/start`
- `POST /host/events/:eventId/live/finish` accepts `{ attendedUserIds: string[] }`. Backend marks only those current event participants as `checked_in`, resets the other current participants to `not_checked_in`, and sets the event live state to `finished`. Missing `attendedUserIds` is treated as an empty list.
- `GET /host/events/:eventId` returns a host-only wrapper with `event`, `chatId`, `requests` and `attendees`. The nested `event` includes editable fields such as `description`, `vibe`, place, startsAt, capacity, access/join mode, visibility and entry requirements, so mobile edit can prefill the current meetup instead of opening an empty create form.

Search:

- `GET /search` returns `{ meetups, evenings, routes, affiche, nextCursors }`.
- Query params include `q`, `date`, `city`, `lifestyle`, `price`, `priceMode`, `gender`, `access`, plus per-block limits: `meetupsLimit`, `eveningsLimit`, `routesLimit`, `afficheLimit`.
- `date` is `yyyy-mm-dd` or `any`. Events, after-dark events and affiche apply it as a one-day UTC range.

Admin route review:

- `POST /admin/evening/route-review/import-runs` creates pending manual content imports for the worker. Body accepts one `city` or `cities: string[]`, `sources`, `from`, `to` and optional `importMode`. Valid new manual sources are `kudago`, `advcake_ticketland` and `tomesto`; Timepad and Overpass are rejected. When `cities` is sent, backend creates one `ExternalImportRun` per city and source. The worker picks them up through the pending manual import scan.
- `GET /admin/evening/route-review/import-runs` accepts `city`, `status`, `limit` and `cursor`. It returns `{ items, nextCursor }`, ordered by newest `startedAt` first, so admin can page through all-city import batches.

Affiche:

- `GET /affiche/events`
- `GET /affiche/events/:eventId`
- `POST /affiche/events/:eventId/client-geo` is authenticated. Mobile uses it only for lazy user-triggered Ticketland geo enrichment after Yandex MapKit finds a venue for a single affiche event. It accepts `{ lat, lng, provider: "yandex_mapkit_client", query, displayName?, venueName? }`, validates Ticketland source, city bbox, event freshness, moderation, venue-name similarity and per-session rate limit, then saves missing `ExternalContentItem.lat/lng`, optional address and `raw.enrichment`. It never overwrites existing backend coordinates.
- Public affiche returns only imported `ExternalContentItem` rows with `contentKind=event`, `publicStatus=published`, `priceMode in (free, paid)` and excludes KudaGo movie showings with `raw.kind=movie_showing`.
- Public affiche list/detail use narrow `select` and must not read `ExternalContentItem.raw` in the public request path.
- Query params include `city`, `date`, `dateFrom`, `dateTo`, `priceMode`, `source`, `category`, `featured`, `q`, `cursor`, `limit`.
- Without `category` and text search, public Affiche lists sort standups first, concerts second, then other events by date. Category and search filters keep their focused date ordering.
- Paid public ticket events come from `advcake_ticketland` and use external `actionUrl`. Unknown price is not exposed as free.
- Affiche `imageUrl` should normally point to a mirrored S3 object created by the worker during import. Public API responses keep owned mirrored `external-content/...` objects on their public CDN URL. If mirroring fails, the worker keeps the source image URL as fallback and API can expose it through `/affiche/images?url=...` only for allowed HTTPS hosts.
- `GET /affiche/images` remains the public image proxy for allowed third-party fallbacks and legacy key reads. Mirrored images use immutable one-year cache headers, while third-party fallback proxy reads use `max-age` plus `stale-while-revalidate` from env.
- KudaGo places stay outside affiche and should continue through places/search/route flows. KudaGo movies stay hidden as catalog rows. KudaGo movie showings are stored as `cinema` events for AI movie roles, but are not exposed by public affiche list/detail.

Chats:

- `GET /chats/meetups`
- `GET /chats/personal`
- `GET /chats/communities`
- `GET /chats/:chatId/messages`
- `POST /chats/:chatId/read`
- `POST /chats/:chatId/pin` with `{ isPinned }` toggles the current user's pinned state for that chat.
- `DELETE /chats/:chatId` deletes the chat only for the current user. Event meetup delete makes a non-host leave the event, marks attendance as `left` and removes `ChatMember`; host delete hides only the host's `ChatMember` so the hosted event stays intact. Evening-session meetup delete marks non-host participants `left`; host delete hides only the host's `ChatMember`. Community chat delete makes a non-owner leave the club by removing both `CommunityMember` and `ChatMember`; owner delete hides only the owner's `ChatMember` so the club stays intact. Direct chat delete removes only the current `ChatMember`.
- After chat delete, backend starts best-effort background cleanup. If the chat has no remaining members, it removes messages, chat media assets, notifications and realtime events; direct chats are then removed too.
- Chat list items expose `lastMessageId` and `isPinned`; pinned items are returned before normal recency ordering. Community chat list items expose `kind=community`, `communityId`, community image, member count and member previews.
- Chat list endpoints set a weak `ETag` on the response body, `Cache-Control: private, max-age=0, must-revalidate` and `Vary: Authorization`. Fresh `If-None-Match` requests return `304` with an empty body. Clients are not required to send the header.
- Chat messages can include `location: { latitude, longitude, label, expiresAt } | null`. WebSocket `message.send` accepts `location: { latitude, longitude, label? }`; backend stores it with a 15 minute expiration.
- If a community chat is missing `ChatMember` for a current community owner or member, opening REST history restores that chat membership so the unified chat and chat lists can see the same community chat.
- Event meetups are treated as finished 24 hours after `startsAt` in effective live status and meetup chat phase, even if the host never pressed finish.
- Meetup chat list items keep `members` as display-name previews and also expose `memberProfiles` with `{ userId, name, avatarUrl, online, isCurrentUser }` for profile and direct-chat actions.
- Meetup chat list items expose `imageUrl`/`eventImageUrl` from linked public Affiche event sources when available, plus paid ticket summary from `sourceExternalContentItem.actionUrl`, `priceFrom`, `priceMode`, `sourceProvider` and `venueName`. Clients render the ticket block only when URL exists and price is paid.

Communities:

- `GET /communities` accepts `q`, `topics`, `privacy`, `sort`, `cursor`, `limit`.
- `GET /communities/:communityId`
- `POST /communities/:communityId/join`
- `DELETE /communities/:communityId/join`
- `POST /communities/:communityId/join-request`
- `DELETE /communities/:communityId/join-request`
- `GET /communities/:communityId/media`
- `POST /communities/:communityId/news`
- `POST /communities`
- Host-safe admin routes live under `/communities/:communityId/admin/*`: overview, settings, members, news, meetups, join-requests, archive and transfer-owner. These are for community owners and moderators. Mobile must not use global `/admin/communities` for host admin.
- Public community join writes both `CommunityMember` and `ChatMember` in one transaction and returns a fresh community detail payload. Leaving removes both memberships for non-owner members. Private communities reject direct join with `community_join_request_required`.
- Private community requests use `CommunityJoinRequest`. Approve writes both `CommunityMember` and `ChatMember`; reject stores the reviewed status without adding membership.
- `POST /communities` requires Frendly+ access and a ready `imageAssetId` owned by the user. Non-plus users get `403 community_plus_required`; missing or invalid image gets `400 community_image_required`.
- Community list and detail payloads expose `imageUrl` from the linked community image asset. Mobile uses it for community cards and "Мои сообщества" rows.

People:

- `GET /people/following`
- `GET /people/:userId`
- `GET /people/:userId/social`
- `PUT /people/:userId/follow`
- `DELETE /people/:userId/follow`
- `PUT /people/:userId/reactions/:kind`
- `DELETE /people/:userId/reactions/:kind`
- `POST /people/:userId/direct-chat`
- Public profile responses include `social` with follower, like, super-like counts and viewer flags. Profile social actions are independent from dating actions. Backend rejects follow, like and super-like on yourself.
- New profile `like` and `super_like` reactions create deduped central `like` notifications with `payload.source=profile`, `payload.action`, `payload.userId` and `payload.userName`. Mobile opens `/u/:userId` from that payload.
- Own profile and public profile payloads expose `frendlyPlus`, derived from the latest subscription. Active access means a live trial, active, or paid-through canceled subscription; expired or inactive subscriptions return `false`.
- `GET /people/following` accepts `eventId`, `q`, `cursor`, `limit` and returns only users followed by the current user, with social preview and `inviteState` for event invite UI.

Verification:

- `GET /verification/me` returns `{ status, selfieDone, documentDone, submittedAt, reviewedAt, reviewNote }`.
- `POST /verification/submit` accepts `{ step, assetId }`, where `step` is `selfie` or `document`. Selfie requires a ready `verification_selfie` media asset owned by the user and moves the request to `selfie_submitted`. Document requires an existing selfie asset, accepts a ready `verification_document` asset and moves the request to `under_review`.
- Verification uploads use `/uploads/media/*` scopes `verification_selfie` and `verification_document`. Selfies and document photos allow JPEG, PNG, WEBP, HEIC and HEIF. PDF is rejected for verification uploads.
- Admin verification endpoints live under `/admin/verification`: list, detail by user id, approve and return with `{ reason }`. Detail returns signed URLs for selfie and document assets.
- Approve sets `User.verified=true`, marks `UserVerification.status=verified`, sends a `verification` notification with `payload.source=verification`, deletes verification assets and adds one 3-day Frendly+ trial or extension. Repeated approve does not add another 3 days.
- Return requires a reason, resets the request to `not_started`, clears uploaded verification assets, stores `reviewNote` and sends a `verification` notification. User must start the verification flow again.
- `/admin/users/:id/verify` delegates to the same approve flow, so manual admin verification also sends the notification and grants the 3-day benefit only once.

Profile season:

- `GET /profile/me/frendly-season` returns the current calendar month season from checked-in events only: `checkedInCount`, `calendarDays`, `currentStatus`, `nextReward`, `stats` and reward steps for 1, 5, 10, 15 and 25 check-ins.
- `POST /profile/me/frendly-season/rewards/:rewardKey/claim` idempotently claims an unlocked season reward. Token rewards credit `TokenWallet` with `TokenLedgerReason.reward_grant`; subscription rewards extend active Frendly+ by 30 or 180 days.
- `GET /profile/me/frendly-history` returns checked-in past meetups with place, date, coordinates, chat id and bounded visible participant previews.
- `GET /profile/me/frendly-people` returns users the viewer met at checked-in meetups, excluding blocked users and the viewer.

Drops:

- `GET /drops/home` returns `mainDrop`, visible `drops`, monthly `ticketProgress`, MVP `tasks`, ticket `history`, `pastWinners`, user `eligibility`, `pendingRewards` and `updatedAt`.
- `GET /drops/:dropId`, `GET /drops/tasks`, `GET /drops/tickets/history?month=YYYY-MM`, `POST /drops/tasks/verify/claim`, `POST /drops/tasks/daily-login/claim`, `POST /drops/:dropId/tickets/apply`, `POST /drops/referral-link/meetings/new` and `POST /drops/referral-link/bind` are private user endpoints.
- `GET /drops/:dropId` returns `winners` after the Drop is finished. It exposes `secretSeed` only for finished Drops and keeps `seedHash` public before and after draw.
- Drop payloads include optional `imageUrl` for the public/admin card image.
- Admin Drop image uploads write public S3 objects with immutable one-year cache control and return the CDN URL.
- MVP reward sources are verification, daily login, host meeting, visit meeting, referral, Frendly+ subscription and event boost. Partner purchases, bookings, rating and repost rewards are not returned in tasks.
- Tickets are granted only through `DropsRewardService`. It enforces idempotency keys, the 30 ticket monthly limit, task limits and the `Europe/Moscow` calendar month. Pending tickets reserve monthly capacity, and cancelled tickets release it.
- `DropsRewardService.confirmReward` promotes a pending reward and its pending tickets to active after the external action is confirmed.
- Tickets are applied manually to one Drop with `POST /drops/:dropId/tickets/apply { ticketCount }`. One ticket can belong to only one Drop. Cancelling an active Drop returns active assigned tickets to the free pool.
- Meeting rewards are evaluated after `POST /host/events/:eventId/live/finish`. Host reward requires a finished meetup created at least 6 hours before start, at least 3 guest participants and at least 2 checked-in guests. Visit rewards require checked-in non-host participants who joined before start.
- Frendly+ token subscription, event promotion and admin user verification call Drops rewards as best-effort side effects. Drops reward failures must not fail the core subscription, boost or verification flow.
- Draws use `DropsDrawService`: activation creates a secret seed and public seed hash, draw snapshots active tickets, sorts tickets by deterministic hash and reveals the seed after finish.
- Admin Drops endpoints live under `/admin/drops`: list with `status`, `type`, `q`, `limit`, `cursor`, detail by `GET /admin/drops/:dropId`, create, update before start, upload image with `POST /admin/drops/images/file`, activate, cancel, draw, list tickets, list participants, list user tickets, list reward events, manual grant, cancel ticket, freeze user, winner status actions and reserve winner promotion. Admin detail/list never expose `secretSeed` until the Drop is `finished`.

Evening:

- `GET /evening/route-templates`
- `GET /evening/route-templates/:templateId`
- `GET /evening/route-templates/:templateId/sessions`
- `POST /evening/route-templates/:templateId/sessions`
- `POST /evening/routes/ai-drafts`
- `GET /evening/routes/ai-drafts/:draftId`
- `POST /evening/routes/ai-drafts/:draftId/steps/:stepIndex/accept`
- `POST /evening/routes/ai-drafts/:draftId/steps/:stepIndex/regenerate`
- `POST /evening/routes/ai-drafts/:draftId/regenerate`
- `POST /evening/routes/ai-drafts/:draftId/confirm`
- `GET /evening/routes/:routeId`
- `POST /evening/routes/:routeId/launch`
- `POST /evening/routes/:routeId/finish`
- `GET /evening/sessions`
- `GET /evening/sessions/:sessionId`
- `POST /evening/sessions/:sessionId/join`
- `POST /evening/sessions/:sessionId/join-request`
- `POST /evening/sessions/:sessionId/join-requests/:requestId/approve`
- `POST /evening/sessions/:sessionId/join-requests/:requestId/reject`
- `POST /evening/sessions/:sessionId/start`
- `POST /evening/sessions/:sessionId/finish`
- step check-in, advance, skip and offer code endpoints live under `/evening/sessions/:sessionId/steps/*`.
- `POST /evening/routes/ai-drafts` accepts optional structured `goal`, `mood`, `budget`, `format`, `area`, optional `stepCount`, optional `city` and free text `prompt`, then returns `{ draftId, route, acceptedStepIndexes, currentStepIndex, canConfirm, expiresAt, warnings }`. Free users can create up to 3 AI drafts per Moscow calendar week. AI draft creation also remains inside the shared weekly meetup quota with `POST /events`: free users default to 7 total created meetups plus AI drafts per week, Plus users are unlimited unless admin sets `plusMeetupMonthlyLimit`. When quota is exhausted, API returns `429 event_weekly_limit_reached` before calling OpenRouter. AI route steps include `imageUrl`, `imageVariants` and compact `tagLabel` when the selected candidate has enough metadata. It creates `EveningAiRouteDraft` with a 24 hour TTL. For AI drafts, backend ignores request `latitude`/`longitude`, so candidate ranking and Ticketland fallback points are city/area based, not tied to the user's current geolocation. The caller should pass the user's selected/current city; if `city` is missing, backend falls back to `Москва`. If request `stepCount` is absent, backend sends the raw prompt, neutral config and real Tomesto tag taxonomy to intent, then intent chooses the smallest coherent 1-5 step route and must put exact tags like `cuisine:gruzinskaya`, `set:cocktails`, `feature:quiet`, `area:center` or `budget:cheap` into per-step `taxonomyTags`; `preferredTerms` stay as natural text hints only. On the normal path backend does not pre-parse prompt counts, participants, budget, date, area or dish names before intent. Explicit structured `stepCount`, `budget` and `area` from the request are still respected. `EVENING_AI_MODEL` is used for both intent and route calls, default `openrouter/owl-alpha`; output caps default to `EVENING_AI_INTENT_MAX_TOKENS=4096` and `EVENING_AI_ROUTE_MAX_TOKENS=32768`; request timeouts default to 90000 ms and can be overridden by `EVENING_AI_INTENT_TIMEOUT_MS` and `EVENING_AI_ROUTE_TIMEOUT_MS`. Intent returns ordered roles, per-step hints, per-step `taxonomyTags`, per-step `location`, `routeStepCount`, `participantsCount`, `dateMode`, `localDate`, `dateReason`, `area` and `budget`. Step location supports `none`, `explicit` and `same_as_previous`, with kinds `area`, `metro`, `district` and `near_place`. Metro codes are normalized to `metro:<slug>` and matched by tag prefix or fallback coordinates. Intent must keep people counts such as `4 человека`, `4-6 человек`, `на двоих` or `вчетвером` separate from route steps. Backend no longer constrains intent through prompt keyword parsing; it validates schema, source-role matches, ids, duplicates, dates, budget, role hints, taxonomy tags and step location. AI Builder treats distance between selected steps as a soft ranking signal, not a hard validation error. Hard geo validation comes from intent location constraints such as explicit area, metro, district, near-place, or same_as_previous. If intent returns `dateMode=date`, backend builds a full local-day window in the selected city timezone from `localDate`. If intent returns `dateMode=none`, backend uses today in the selected city timezone. If the intent call fails or returns invalid JSON, fallback extracts safe prompt hints for explicit place count, obvious ordered roles, area and budget, then uses generic roles only for missing slots. Ticketland/MTS Live candidates are loaded for the intent date window before scoring. Tomesto candidate load is narrow-first: strong intent tags and step location are tried first with a capped query, and broad city scan remains the recall fallback when narrow results are too small. When the city already has at least one imported Tomesto `imageUrl`, Tomesto AI candidates also require `imageUrl`. Structured `taxonomyTags` are the primary scoring and validation signal; if a step has a strong tag such as `cuisine:*`, `set:*`, `feature:*` or `category:*`, broad tags such as `place:restaurant` do not make every restaurant a match. Candidate packs now apply intent `avoidTerms` across Tomesto, KudaGo and Ticketland; standup intent also rejects non-standup Ticketland shows before the route model sees them. If prompt says `стендап или бар`, backend treats bar as a valid final role when intent picked standup. AI route candidate pack is capped per route step after backend ranking: Tomesto up to 20 candidates, KudaGo up to 10 and Ticketland/MTS Live up to 10. Tomesto place steps keep the parsed `actionUrl` or `sourceUrl` in `ticketUrl` with `ticketSourceCode=tomesto`, so clients can render it as table booking. `GET /evening/routes/:routeId` also backfills missing Tomesto step links from parsed `ExternalContentItem` rows for older AI routes that saved `ticketSourceCode=tomesto` without `ticketUrl`. If intent requested a role such as `show` and there are no candidates for the city/date, API returns `404 evening_ai_candidates_not_found` instead of silently replacing it or using another date. Intent `area` goes into draft storage as the internal code and is returned in public route payload as a readable label such as `Центр`; for Tomesto it participates in narrow-first candidate load and scoring, while broad city scan stays as fallback. Intent `budget` or structured request budget goes into draft storage and scoring. Users accept steps one by one or regenerate one step against the same saved candidate pack. Step or full regeneration returns `409 evening_ai_regenerate_candidates_exhausted` when the saved pack has no suitable replacement. Full draft regenerate uses `POST /evening/routes/ai-drafts/:draftId/regenerate`, keeps the same candidate pack and intent, rejects the current route step ids, resets accepted indexes and returns a new review draft. `confirm` requires every step to be accepted and then creates a normal `EveningRoute` with `source=ai_openrouter`, `status=draft` and `badgeLabel=AI маршрут`.

Uploads and media:

- `POST /uploads/media/upload-url`
- `POST /uploads/media/complete`
- `POST /uploads/media/file`
- `POST /uploads/chat-attachment/upload-url`
- `POST /uploads/chat-attachment/complete`
- `POST /uploads/chat-attachment/file`
- `GET /media/:assetId`
- `GET /media/:assetId/download-url`
- Upload-url responses include the S3 upload headers the client must send. Public profile avatar, profile photo and community image uploads return immutable public cache control. Chat, story and verification uploads return private five-minute cache control.
- Community image uploads use `/uploads/media/*` with scope `community_image`, accept image MIME types only, create a public ready `MediaAsset` with kind `avatar`, and return `{ assetId, status, url }`.
- Event cover uploads use `/uploads/media/*` with scope `event_cover`, accept image MIME types only, create a public ready `MediaAsset` with kind `event_cover`, and return `{ assetId, status, url }`.
- Chat, story and verification media assets store `publicUrl=null`; clients must use `/media/:assetId/download-url` or private `/media/:assetId` access, not CDN URLs.
- Story list payloads must not embed signed S3 URLs. Story media returns private media shape with `url=/media/:assetId`, `downloadUrl=null` and `downloadUrlPath=/media/:assetId/download-url`.
- Public non-inline `GET /media/:assetId` redirects to the asset's stored public URL, normally CDN. Private media keeps signed download URLs after membership checks.
- Image media can expose `variants` keyed by `avatar`, `thumb`, `card`, `hero` and `fullscreen`. Variant DTOs may include `width`, `height` and `downloadUrlPath`. Public variants use CDN URLs. Private chat and story image variants use `/media/:assetId/variants/:variantKey` and `/media/:assetId/variants/:variantKey/download-url` after the same access checks as the original asset.

Public sharing:

- `POST /shares`
- `GET /public/shares/:slug`
- `POST /public/offer-codes/:code/activate`

Payments and tokens:

- `GET /payments/catalog` returns backend-owned Frendly+ plans, active admin-managed token packs, promo options and `tbankEnabled`.
- Frendly+ plans and Plus benefit copy are admin-managed. Public catalog responses include dynamic subscription `id`, token costs, monthly token cost, duration days, optional badge and benefit text.
- Token packs in `GET /payments/catalog` are viewer-aware and come from `TokenCatalogPack`. Active Frendly+ users receive discounted token pack `priceRub` plus `originalPriceRub` and `discountPercent`; `POST /payments/init` uses the same discounted amount for the real T-Bank order and stores `PaymentOrder.productSnapshot` so later admin edits do not change pending payment fulfillment.
- `POST /payments/init` accepts token packs only. `productKind=subscription` is rejected with `subscription_paid_with_tokens`; Frendly+ is paid from the token wallet.
- Payment order responses include `productKind` and `productId`, so clients can return token payments to wallet screens.
- `POST /payments/:orderId/check` verifies order ownership, calls T-Bank `GetState`, checks amount and fulfills only confirmed payments.
- `POST /payments/tbank/webhook` is public, validates T-Bank token and terminal, then uses the same idempotent confirm path as manual check.
- `POST /subscription/subscribe` spends tokens server-side and activates or extends Frendly+; it does not create a T-Bank payment order.
- Admin subscription settings live under `/admin/subscription-settings`: `GET` returns all Plus plans, token packs, global benefits and Plus benefit rules, `PUT` upserts plans, token packs, benefit text and rules. Removing a plan or token pack in admin disables it for future purchases instead of deleting user subscription or payment history.
- Plus benefit rules drive free and Plus dating swipe limits, daily free super-like limits, paid super-like token cost, weekly meetup and AI draft creation limits, community creation gating, incoming-like visibility gating and token purchase discount percent. Defaults are 100 free swipes per hour, unlimited Plus swipes, 1 free super-like per day, 10 Plus super-likes per day, 7 free meetups or AI drafts per Moscow week, unlimited Plus meetups and 15% token discount for Plus.
- `GET /tokens/wallet` returns server balance, history and active promoted targets. `POST /tokens/promotions` and `POST /subscription/subscribe` spend tokens server-side. Season reward grants appear in wallet history as `Подарок сезона`.
- Public event boost options are `boost-6` for 20 FT and 6 hours, `boost-24` for 50 FT and 24 hours, and `boost-72` for 120 FT and 72 hours. `GET /events` sorts active boosted events before normal events before applying the page limit, and `GET /events` plus `GET /events/:eventId` expose active boost as `{ promoted, boost }`, with tier metadata for mobile badges and map pins.

Admin auth:

- `POST /admin/auth/login`
- `POST /admin/auth/refresh`
- `POST /admin/auth/logout`
- `GET /admin/auth/me`

Admin dashboard and users:

- `GET /admin/dashboard` returns real admin dashboard data. KPI analytics come from `AdminDashboardSnapshot` with a 5 minute TTL. Nearby lists for upcoming meetups and new users are still live bounded queries.
- Dashboard activity is composed from current tables: user registration and suspension, meetups, reports, confirmed payments and verification changes. API DTO keys stay English, while the React admin maps visible labels to Russian.
- User management endpoints include `POST /admin/users/:id/frendly-plus`, `POST /admin/users/:id/frendly-plus/revoke` and `GET /admin/users/:id/activity`.
- Granting Frendly+ creates or extends `UserSubscription`. Revoking Frendly+ marks active access inactive. Suspending a user revokes active sessions so the user cannot keep using an existing login.
- `GET /admin/users/:id/activity` is user history from product tables: registration, hosted and joined meetups, reports, payments, Frendly+, tokens, verification, suspension and recent messages without long message text. Admin audit stays separate under `/admin/users/:id/audit`.

Admin app overlays:

- `GET /admin/app-overlays/campaigns`, `POST /admin/app-overlays/campaigns`, `PATCH /admin/app-overlays/campaigns/:campaignId`.
- `POST /admin/app-overlays/campaigns/:campaignId/activate`, `pause`, `archive`.
- `GET /admin/app-overlays/version-policies` and `PATCH /admin/app-overlays/version-policies/:platform`.
- Admin responses include Russian labels for status, platform, Frendly+, verification, audience and button action, so the React admin can show Russian values without duplicating mapping logic.

Admin Evening route review:

- `GET /admin/evening/route-review/drafts`
- `GET /admin/evening/route-review/drafts/:draftId`
- `POST /admin/evening/route-review/drafts/:draftId/approve`
- `POST /admin/evening/route-review/drafts/:draftId/reject`
- `POST /admin/evening/route-review/drafts/:draftId/convert`
- `POST /admin/evening/route-review/drafts/:draftId/publish`
- `POST /admin/evening/route-review/import-runs`
- `GET /admin/evening/route-review/import-runs`
- `GET /admin/evening/route-review/content-items`
- `POST /admin/evening/route-review/content-items/:itemId/:action`
- `POST /admin/evening/route-review/generation-runs`
- `GET /admin/evening/route-review/generation-runs`
- `GET /admin/evening/route-review/sources`
- Admin content filters include `city`, `source`, `contentKind`, `priceMode`, `category`, `publicStatus`, `hasCoords`, `dateFrom`, `dateTo`.
- Admin import runs expose `publishedCount`, `paidCount`, `freeCount`, `unknownPriceCount`, `missingCoordsCount`.
- Worker fails stale `running` external import runs before processing the manual import queue, so interrupted imports do not stay stuck in admin forever.
- Admin content rows expose source, content kind, venue, image, action url, action kind, price mode, affiliate flag, public status and coordinates presence.
- Admin content actions support publish, hide, reject, stale, force-free and force-paid. Rows also expose route planner blocked reason and a compact raw summary.

## Important behavior

- Event joins are idempotent for existing participants.
- Requestable private meetup detail can be opened by exact event id for a non-member, with `chatId=null`, so Flutter app can render the join-request form. Private meetups still stay out of public lists unless the viewer is host, participant, attended before, or otherwise has viewer-specific access.
- `POST /events` accepts route selection for meetup creation. Existing routes use `routeId`; custom routes use a route payload with at least two titled steps and are saved as private `EveningRoute` records only when the creation request can resolve a valid event coordinate. It also accepts `afficheEventId` for creating a meetup from a published affiche event; `afficheEventId` and route selection are mutually exclusive.
- Event list and detail summaries expose `imageUrl` from linked public Affiche content, so meetups created from `afficheEventId` can reuse the same external event image.
- Event list and detail summaries expose paid ticket summary from linked public Affiche event sources: `ticketUrl`, `ticketSourceKind`, `ticketSourceId`, `ticketPriceFrom`, `ticketProvider`, `ticketVenue`. Free Affiche sources keep these fields null.
- Event list summaries expose radar category fields: `routeId` from `eveningRouteId`, `routePointCount` from route steps count, `routePoints` with valid route step coordinates, and `isAfficheBacked` for events created from public Affiche content. Flutter app uses them with ticket source fields to calculate Radar counts and draw meetings, routes and affiche without extra requests.
- Event list and detail summaries expose entry flags: `requiresVerification` and `requiresFrendlyPlus`. `POST /events` and `PATCH /host/events/:eventId` accept both booleans. A host can enable verified-only only when verified, and Plus-only only with `trial` or `active` Frendly+.
- `GET /events` accepts `date=yyyy-mm-dd` for one-day filtering.
- `GET /events` keeps recently started meetups visible in discovery for 3 hours, including nearby, calm, newcomers and date feeds. This prevents a just-started meetup from disappearing while users switch accounts or open the feed.
- After Dark no longer has `POST /after-dark/unlock`; Frendly+ access is activated only through token subscription flows. `GET /after-dark/events` accepts `q` and `date`; `GET /evening/route-templates` accepts `q`.
- `GET /evening/route-templates` list uses summary payload only: route summary fields, first 4 steps and bounded partner offer preview. Template detail loads full steps separately.
- Direct joins lock the event row and check capacity inside the transaction.
- Event detail includes `entryRequirements: { canJoin, missing }`, where `missing` uses `verification` and `frendly_plus`. New entry is blocked on direct join, join request, invite create, invite accept and host approve. Blocked paths return `403 event_entry_requirements_not_met` with `details.missing`. Existing participants are not removed, and pending requests are rechecked on approve.
- `POST /events/:eventId/join-request` keeps duplicate pending requests idempotent. If the previous request was `canceled` or `rejected`, the same request row is reopened as `pending`, review fields are cleared and the host gets a fresh notification.
- `POST /events/:eventId/invites` is allowed for the host or any participant. It requires the inviter to follow the target user, checks blocks, visibility, self-invite, canceled event and capacity, then creates or reopens a pre-approved `EventJoinRequest` and sends an `event_invite` notification with the real inviter as actor.
- Accepting an event invite checks capacity again in the transaction and adds `EventParticipant`, `EventAttendance` and `ChatMember`, then touches the chat summary so Flutter app lists refresh participant counts.
- Existing direct chats can be reopened after one user deleted the chat. `createOrGetDirectChat` restores missing `ChatMember` rows for both sides instead of leaving the old direct chat hidden.
- Concurrent join request review must not reset an approved request back to pending.
- Duplicate pending event join requests are idempotent: the note can refresh, the request stays pending and host notifications stay deduped by event and user.
- Event detail uses bounded previews and separate counts. `attendees` preview excludes the host because the host is exposed in the separate `host` block.
- `GET /places/search` is an authenticated Create Meetup lookup over imported Tomesto places. It searches only `ExternalContentItem` rows with `source.code=tomesto`, `contentKind=place`, `publicStatus=published` and non-null coordinates, returns booking URL, average check, rating, provider and up to 3 nested active promos. It never exposes `raw`.
- `GET /places/promos` is an authenticated Tomesto promo surface for Flutter app. Query params include `city`, optional `latitude`/`longitude`, optional `category` and `limit`. It returns active Tomesto promo rows only when they match a published Tomesto place with valid coordinates, with place category, address, booking URL and distance. It never exposes `raw`.
- `POST /events` accepts optional `externalPlaceId` for a selected Tomesto place. It must point to a published Tomesto place, cannot be combined with `afficheEventId`, and returns `404 external_place_not_found` when missing or hidden. The event reuses `sourceExternalContentItemId` for this place link.
- Event ticket fields are only for `contentKind=event` sources. Tomesto place links expose separate booking fields: `bookingUrl`, `bookingProvider`, `bookingPlaceId`, `bookingAverageCheck`, `bookingCurrency`, `bookingPromos`. Table booking CTAs must not be rendered as ticket CTAs.
- Nearby event list without PostGIS uses two-phase loading: light candidate rows with ids and coordinates first, then full list includes only for the selected page ids. Geo bounds are strict for events that have coordinates, including viewer-owned, joined and attended events; those viewer-specific exceptions only bypass bounds when the event has no coordinates. Optional PostGIS candidate scan stays behind `ENABLE_POSTGIS_EVENT_FEED=true`; it must apply the same key public feed filters before returning candidate ids, including canceled state, visibility, gender visibility, date window, route flags, text query, lifestyle, gender, access and price.
- Flutter app remote search keeps grouped search limits bounded instead of requesting 20 items per group.
- Chat list member previews are bounded and block-aware. Meetup previews include `memberProfiles` so clients do not use display names as ids.
- Profile social snapshots are local to a profile request or explicit `/people/:userId/social` request. Do not hydrate profile social for every list row unless the endpoint explicitly returns a bounded preview.
- Meetup ticket summary is part of chat summary. Flutter app must not fetch affiche detail just to render the chat buy-ticket block.
- Chat history hides blocked `replyTo` previews.
- Cursors carry sort keys plus id when possible.
- Dating discover remains available to all authenticated users. Do not gate dating profiles or `POST /events` with `mode=dating` behind Frendly+.
- `GET /dating/discover` accepts backend filters: `ageMin`, `ageMax`, `radiusKm` and comma-separated or repeated `interests`. Age is applied in the Prisma query. Interests are matched case-insensitively from onboarding JSON. Radius is approximate, based on known city/area coordinates for the viewer and candidate profiles. Discover ranks fresh profiles before old passes. Inside each cycle, candidates with more shared interests go first, then score by incoming likes, distance, verified and online state. Old `pass` rows enter a second cycle only after fresh profiles are exhausted. Previous `like` and `super_like` rows never return to the feed.
- First-page `GET /dating/discover` is backed by a short per-user Redis cache, default 5 seconds through `DATING_DISCOVER_CACHE_SECONDS`. Cursor pages bypass this cache. `POST /dating/actions` invalidates the actor and target discover versions; `POST /dating/rewind` invalidates the actor version.
- Dating discover profile payloads include `city`, `area`, `latitude`, `longitude`, `commonInterests` and `matchPercent`. `matchPercent` is high for shared interests and lower-capped when interests do not overlap. Coordinates are approximate from known city/area labels, with city-level fallback when area is unknown.
- `POST /events` with `mode=dating` requires `inviteeUserId` and `sourceChatId` for an existing direct chat between host and invitee. Dating events stay private: the invitee cannot open event detail until the invite is accepted and they become a participant.
- Declining a pending dating invite cancels the private dating event with `cancelReason=dating_invite_declined` and removes its meetup chat from user chat lists.
- `GET /dating/likes` returns real incoming dating likes for authenticated users. Frendly+ gating is applied by clients: Plus users show open profiles, non-plus users show the same real entries as locked/blurred previews and send upgrade actions to `/paywall`.
- `GET /dating/limits` returns `premium`, hourly swipe limits, super-like quota and rewind quota. Daily free quota resets use the Moscow calendar day.
- `POST /dating/actions` remains available to all authenticated users. Free users have 50 swipe actions per rolling hour, 1 free super-like per Moscow day, then paid super-likes spend 50 tokens with `TokenLedgerReason.dating_spend`. Frendly+ users have no hourly swipe limit, get 10 free super-likes per Moscow day, then paid super-likes also cost 50 tokens. Rate limit errors return `429 dating_swipe_rate_limited`; insufficient wallet returns `402 tokens_insufficient`. Match responses include `matched=true` and `chatId`.
- `POST /dating/rewind` removes only the latest `pass` action and returns the restored `peer`. Free users pay 25 tokens from the first rewind. Frendly+ users get 5 free rewinds per Moscow day, then pay 25 tokens. If the latest action is not a pass, the endpoint returns `409 dating_rewind_unavailable`.
- Dating positive actions create central `like` notifications on the first positive action. Plain `like` and `super_like` include `payload.source=dating`, `payload.action`, `payload.userId` and `payload.userName` so Flutter app can open the liker profile from the notification.
- Direct upload complete is idempotent by object key, owner, kind and target.
- Private media download checks chat membership, event participation and blocks.
- Profile photo and avatar payloads expose `mediaAsset.publicUrl` CDN URLs when available. `/media/:assetId` stays as a fallback for legacy assets without `publicUrl` and for private media flows.
- `GET /onboarding/me` includes uploaded profile `photos` in profile-photo DTO shape and profile `bio` so mobile onboarding can restore the photo and description steps after app restart.
- `PUT /onboarding/me` accepts `bio` and writes it to `Profile.bio` in the same transaction as onboarding preferences.
- `GET /media/:assetId` sets `ETag` and `Last-Modified`. Fresh `If-None-Match` or `If-Modified-Since` requests return `304` before S3 streaming or signed URL generation. Private media keeps `Cache-Control: private, max-age=300` and adds `Vary: Authorization`.
- Dating, people, host, notifications and safety services use narrow selects on hot paths.
- `getBlockedUserIds` from `@big-break/database` is the shared hidden-user helper.
- Evening lifecycle writes system chat messages with `kind=system`.
- Evening phase refresh uses `chat.updated`.
- Dedicated `evening.session.updated` is not implemented yet.
- Public offer code activation has a per-IP in-process limit before DB lookup.
- Admin auth uses httpOnly cookies and can bootstrap the first admin from `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD`.
- Legacy `x-admin-token` still works when `ADMIN_API_TOKEN` is configured, but browser admin should use `/admin/auth/*`.
- Generated route review drafts are never public by default. Admin must approve, convert to `EveningRouteTemplate`, then publish through existing Evening route publishing.
- Manual route review import requests create `pending_manual` import runs. External fetch stays in worker, not in the API request path. Admin can request `kudago`, `advcake_ticketland` or opt-in `tomesto`.
- Tomesto places can become imported place candidates only when they have valid stored coordinates. Tomesto place pages marked closed, for example `Место закрыто навсегда`, are imported hidden via `raw.status.closed=true`. Tomesto events and promos stay out of public Affiche by default because worker imports them hidden unless `TOMESTO_PUBLIC_EVENTS_ENABLED=true`; attachable public source candidates without valid coordinates are hidden while raw rows and `missingCoordsCount` remain. Tomesto promo pages for birthdays, banquets or weddings are skipped by the worker adapter before upsert, while normal gifts and discounts stay importable.
- Manual route review generation requests create `GeneratedRouteDraftBatch.status=pending_manual`. Worker picks them up and calls OpenRouter outside the API request path. Drafts stay in admin review until approve, convert and publish.
- Route review generation uses a deterministic worker planner before OpenRouter. Candidate selection is balanced: worker fetches timed events and flexible places as separate pools so upcoming events do not push cafes, bars, parks and restaurants out of the prompt. Planner builds route skeletons with one timed event anchor, real imported event times, nearby flexible places before or after, walking limits, duplicate venue-cluster checks and no-route movement checks. Invalid OpenRouter drafts are rejected before saving; if all model drafts are invalid, worker uses deterministic fallback or fails the batch without creating invalid review cards. Planner rejects repeated event themes, for example two quests in one route. Planner also rejects bad flow: adjacent restaurant/cafe/bar steps, and a bar before another event, walk or culture stop. When social or culture routes have a nearby walk and bar after the event, planner prefers event -> walk -> final bar. If places are missing, planner may create a warning-level two-event route only when the events differ by category, do not overlap and leave travel time. Planner has scenario recipes for calm, social, date, culture, active and outdoor moods; category taxonomy covers cafe, food, bar, quest, theatre, concert, comedy, quiz, lecture, workshop, market, festival, cinema, sport, bike, adventure, outdoor, spa, walk and culture. Budget policy filters free/low/mid/high/premium candidates and validation rejects drafts over budget. Unknown-price events do not satisfy free budget. Public event route candidates require `priceMode` free or paid and coordinates. OpenRouter writes copy over those skeletons. Converted route steps preserve ticket URL metadata from affiliate imported events, so public route DTOs can expose `ticketUrl`, `ticketSourceCode` and `ticketProvider`. KudaGo importers paginate through all pages for the selected period, with a safety page guard from `CONTENT_IMPORT_MAX_PAGES_PER_ENDPOINT`; KudaGo sends route-worthy event and place category whitelists to its API so business, kids, stock, airports, car washes, metro, shelters and similar noise do not enter the imported pool. Scheduled import runs KudaGo and Ticketland for the next Moscow calendar week. Ticketland keeps offers whose feed region matches a supported city.
- AI route builder can use Tomesto place taxonomy from `ExternalContentItem.tags`, not raw copied page text. Important tags are `area:center`, `occasion:food`, `budget:cheap`, `metro:*`, `feature:*` and `set:*`.
- User-facing AI drafts use `EveningAiDraftService`, separate from admin route review drafts. Flow has two OpenRouter calls through `EVENING_AI_MODEL`, default `openrouter/owl-alpha`: first `evening_ai_route_intent`, then `evening_ai_route`. Intent is the only semantic parser for free text. It receives real Tomesto taxonomy from current city place tags, grouped as `cuisine:*`, `place:*`, `set:*`, `feature:*`, `category:*`, `area:*` and `budget:*`; the model should infer matching tags from the whole prompt and put them into per-step `taxonomyTags`. `preferredTerms` are natural text hints only. It turns arbitrary prompt text into ordered roles, per-step hints, per-step `taxonomyTags`, per-step `location`, `routeStepCount`, `participantsCount`, `dateMode`, `localDate`, `dateReason`, `area` and `budget`. Per-step location supports explicit area, metro, district, near-place and `same_as_previous`; Tomesto can match metro/location tags, while Ticketland and KudaGo can fall back to coordinates for known anchors. On the normal path backend no longer extracts prompt count, people count, date, area, budget or dish aliases from keywords before intent. Structured request fields are still passed in config, so explicit button filters can constrain intent. If no explicit `stepCount` is passed, intent can return 1-5 steps, so a simple place request can become one `place_bar` or one `place_food`. People counts such as `на 4 человека` and `4-6 человек` are expected from intent as `participantsCount`, not route steps. Date intent controls timed candidates: `dateMode=date` creates a full local-day window in the selected city timezone, `dateMode=none` uses today in the selected city timezone. Fallback intent is prompt-aware when the intent call fails or is invalid: it can extract explicit place count, obvious ordered roles, area and budget, then fills missing slots with generic roles. The route call sends compact candidate cards and asks for real `externalContentItemId` values plus short copy only. Establishments come from Tomesto, concerts/theatre/standup/show steps from `advcake_ticketland` Ticketland/MTS Live, and walks/parks/free activities from KudaGo. These event candidates are imported `ExternalContentItem` rows that also power affiche surfaces, but the builder does not query the public `/affiche` endpoint directly. Tomesto candidate SQL loads published city place rows with coordinates and does not apply role terms, area terms, OR or `take`; if the city has imported Tomesto images, Tomesto candidates without `imageUrl` are excluded. Within one draft request, Tomesto and Ticketland source scans plus the Tomesto image check are reused across repeated steps before ranking. Role hints, step location, intent area, intent budget and taxonomy affect scoring. Structured taxonomy tags also affect validation: when any candidate in the role pack matches the requested strong tag, a selected candidate without that tag is rejected before retry. Ticketland SQL loads all published city event rows for the intent date window. Intent `avoidTerms` are applied before the route model for all sources, and a standup hint filters out non-standup Ticketland shows. For prompt alternatives like `стендап или бар`, backend can convert a show step to `place_bar` before candidate loading. Before the route AI call each route step group is ranked on backend and capped separately: Tomesto up to 20 candidates, KudaGo up to 10 and Ticketland/MTS Live up to 10. New drafts get a fresh candidate seed, stored indirectly through the saved `candidatePackJson`; regeneration reuses that saved pack. Route AI output defaults to 32768 tokens and intent output defaults to 4096 tokens. Intent and route timeouts default to 90000 ms and can be changed through `EVENING_AI_INTENT_TIMEOUT_MS` and `EVENING_AI_ROUTE_TIMEOUT_MS`. AI draft steps expose compact `tagLabel`, for example walk, bar, standup or cuisine label from Tomesto tags. Role order and repeated roles come from the LLM intent, for example food -> show -> food; a simple craft beer request should normally be one `place_bar` unless the user asks for multiple places. Step regeneration checks replacements for that exact role and returns `409 evening_ai_regenerate_candidates_exhausted` if none remain. Full draft regenerate keeps the saved candidate pack and intent, adds all current route step ids to rejected ids, resets accepted indexes, and asks the same model for a new route from the remaining candidates. Intent `area` is stored internally as a code for scoring and fallback points, while public route responses expose a readable label such as `Центр`. Intent `budget` or structured request budget is stored in the draft and affects scoring. Tomesto candidates and KudaGo candidates require stored coordinates, but KudaGo walk can use both event and place rows, so parks can enter the AI pack. Walk candidates also pass a strict backend filter that keeps parks, embankments, boulevards and walking routes, but rejects skating rinks, sport and active entertainment, museums, exhibitions, theatres, cinemas, restaurants, bars and clubs even when their text contains `парк`. Ticketland/MTS Live show candidates can enter the AI pack without coordinates; for those steps the API skips walking distance validation and uses a start, intent area or city fallback point when saving the current non-null `EveningRouteStep` coordinates. Worker import enriches KudaGo events from expanded `place` data or existing KudaGo place rows, and enriches Ticketland only from exact imported venue place matches or high-confidence geocoder results. The API validates unknown ids, duplicate ids, source-role mismatch, expired events, requested date mismatch, budget mismatch, role intent mismatch, taxonomy mismatch, location mismatch, missing ticket metadata and long walking legs when both adjacent steps have coordinates. Bad route LLM output gets one retry; if it still fails, the service saves a deterministic fallback draft with a warning. Initial draft creation records phase timings in `frendly_evening_ai_draft_phase_duration_seconds` for quota checks, intent taxonomy, intent LLM, candidate load, candidate rank, route LLM, draft save and total; slow logs include only city, role count and source candidate counts.
- Route generation scopes commercial place steps to Tomesto candidates: restaurant, cafe, bar, wine bar, dancing bar, karaoke, lounge and food. Walks, parks, museums, culture and outdoor steps can still prefer KudaGo or Overpass. If an explicit commercial venue request cannot be backed by Tomesto, return a warning rather than silently replacing it with a generic place.
- User-facing AI draft step regeneration picks a same-role replacement locally from the saved `candidatePackJson`, preserves the rest of the route, and does not call the route LLM. It still returns `409 evening_ai_regenerate_candidates_exhausted` when no replacement remains.
- Tomesto promos stay hidden from public Affiche. They appear in the Flutter app promo surface through `/places/promos` only after matching a published place with coordinates, plus nested under selected Tomesto places in place lookup and meetup detail. Promo to place matching prefers Tomesto `raw.placeSourceItemId`, then falls back to `raw.placeSlug` and title or address matching.

## Shared packages

`@big-break/database` owns Prisma, JWT helpers, Redis pub/sub, S3 helpers, outbox constants and DB scripts.

`@big-break/contracts` owns API DTOs, cursor pages, token pair, upload/media DTOs, chat DTOs, Evening DTOs, public share DTOs and WebSocket event maps.

## Checks

```bash
cd backend && pnpm --filter @big-break/api test:unit
cd backend && pnpm --filter @big-break/api build
```

Targeted Evening and chat tests:

```bash
cd backend && pnpm --filter @big-break/api test:unit -- evening.service.unit.spec.ts chats.service.unit.spec.ts
```
