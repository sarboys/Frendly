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

Events:

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

Host:

- `GET /host/dashboard`
- `GET /host/events/:eventId`
- `PATCH /host/events/:eventId`
- `POST /host/requests/:requestId/approve`
- `POST /host/requests/:requestId/reject`
- `POST /host/events/:eventId/check-in`
- `POST /host/events/:eventId/live/start`
- `POST /host/events/:eventId/live/finish` accepts `{ attendedUserIds: string[] }`. Backend marks only those current event participants as `checked_in`, resets the other current participants to `not_checked_in`, and sets the event live state to `finished`. Missing `attendedUserIds` is treated as an empty list.

Search:

- `GET /search` returns `{ meetups, evenings, routes, affiche, nextCursors }`.
- Query params include `q`, `date`, `city`, `lifestyle`, `price`, `priceMode`, `gender`, `access`, plus per-block limits: `meetupsLimit`, `eveningsLimit`, `routesLimit`, `afficheLimit`.
- `date` is `yyyy-mm-dd` or `any`. Events, after-dark events and affiche apply it as a one-day UTC range.

Affiche:

- `GET /affiche/events`
- `GET /affiche/events/:eventId`
- Public affiche returns only imported `ExternalContentItem` rows with `contentKind=event`, `publicStatus=published` and `priceMode in (free, paid)`.
- Public affiche list/detail use narrow `select` and must not read `ExternalContentItem.raw` in the public request path.
- Query params include `city`, `date`, `dateFrom`, `dateTo`, `priceMode`, `source`, `category`, `featured`, `q`, `cursor`, `limit`.
- Paid public ticket events come from `advcake_ticketland` and use external `actionUrl`. Unknown price is not exposed as free.
- Affiche `imageUrl` should normally point to a mirrored S3 object created by the worker during import. Public API responses expose owned mirrored `external-content/...` objects through `/affiche/images?key=...`, so Flutter Web gets API CORS while clients still receive immutable image cache headers. If mirroring fails, the worker keeps the source image URL as fallback and API can expose it through `/affiche/images?url=...` only for allowed HTTPS hosts.
- `GET /affiche/images` is the public image proxy for owned mirrored images, allowed third-party fallbacks and legacy key reads. Mirrored images use immutable one-year cache headers, while third-party fallback proxy reads use `max-age` plus `stale-while-revalidate` from env.
- KudaGo places stay outside affiche and should continue through places/search/route flows.

Chats:

- `GET /chats/meetups`
- `GET /chats/personal`
- `GET /chats/:chatId/messages`
- `POST /chats/:chatId/read`
- `POST /chats/:chatId/pin` with `{ isPinned }` toggles the current user's pinned state for that chat.
- `DELETE /chats/:chatId` deletes the chat only for the current user. Event meetup delete makes a non-host leave the event, marks attendance as `left` and removes `ChatMember`; host delete hides only the host's `ChatMember` so the hosted event stays intact. Evening-session meetup delete marks non-host participants `left`; host delete hides only the host's `ChatMember`. Community chat delete makes a non-owner leave the club by removing both `CommunityMember` and `ChatMember`; owner delete hides only the owner's `ChatMember` so the club stays intact. Direct chat delete removes only the current `ChatMember`.
- After chat delete, backend starts best-effort background cleanup. If the chat has no remaining members, it removes messages, chat media assets, notifications and realtime events; direct chats are then removed too.
- Chat list items expose `lastMessageId` and `isPinned`; pinned items are returned before normal recency ordering.
- Chat list endpoints set a weak `ETag` on the response body, `Cache-Control: private, max-age=0, must-revalidate` and `Vary: Authorization`. Fresh `If-None-Match` requests return `304` with an empty body. Clients are not required to send the header.
- Meetup chat list items keep `members` as display-name previews and also expose `memberProfiles` with `{ userId, name, online, isCurrentUser }` for profile and direct-chat actions.
- Meetup chat list items expose paid ticket summary from linked public Affiche event sources. It uses `sourceExternalContentItem.actionUrl`, `priceFrom`, `priceMode`, `sourceProvider` and `venueName`. Clients render the ticket block only when URL exists and price is paid.

Communities:

- `GET /communities`
- `GET /communities/:communityId`
- `POST /communities/:communityId/join`
- `DELETE /communities/:communityId/join`
- `GET /communities/:communityId/media`
- `POST /communities/:communityId/news`
- `POST /communities`
- Public community join writes both `CommunityMember` and `ChatMember` in one transaction and returns a fresh community detail payload. Leaving removes both memberships for non-owner members. Private communities reject direct join with `community_join_request_required`.
- `POST /communities` requires Frendly+ access. Non-plus users get `403 community_plus_required`.

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
- `GET /people/following` accepts `eventId`, `q`, `cursor`, `limit` and returns only users followed by the current user, with social preview and `inviteState` for event invite UI.

Profile season:

- `GET /profile/me/frendly-season` returns the current calendar month season from checked-in events only: `checkedInCount`, `calendarDays`, `currentStatus`, `nextReward`, `stats` and reward steps for 1, 5, 10, 15 and 25 check-ins.
- `POST /profile/me/frendly-season/rewards/:rewardKey/claim` idempotently claims an unlocked season reward. Token rewards credit `TokenWallet` with `TokenLedgerReason.reward_grant`; subscription rewards extend active Frendly+ by 30 or 180 days.
- `GET /profile/me/frendly-history` returns checked-in past meetups with place, date, coordinates, chat id and bounded visible participant previews.
- `GET /profile/me/frendly-people` returns users the viewer met at checked-in meetups, excluding blocked users and the viewer.

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
- `POST /evening/routes/ai-drafts` accepts optional structured `goal`, `mood`, `budget`, `format`, `area`, optional `stepCount`, optional `city` and free text `prompt`, then returns `{ draftId, route, acceptedStepIndexes, currentStepIndex, canConfirm, expiresAt, warnings }`. It creates `EveningAiRouteDraft` with a 24 hour TTL. For AI drafts, backend ignores request `latitude`/`longitude`, so candidate ranking and Ticketland fallback points are city/area based, not tied to the user's current geolocation. The caller should pass the user's selected/current city; if `city` is missing, backend falls back to `Москва`. If `prompt` is sent without `stepCount`, backend first extracts explicit counts such as `3 точки`, `три места` or `4 шага` and treats them as exact. If the prompt does not contain a count, Qwen intent infers 2-5 steps and falls back to 5 when the count is unclear. Counts near people words such as `4 человека`, `на двоих` or `вчетвером` are parsed as participant count and must not become route steps. Prompt dates such as `сегодня`, `завтра`, `послезавтра`, weekday names and exact dates like `24.05` or `24 мая` become a strict date window for timed events from Ticketland/MTS Live and KudaGo. Place candidates from Tomesto and KudaGo places are not date-filtered. If a user explicitly requested a role such as `стендап` and there are no candidates for the city/date, API returns `404 evening_ai_candidates_not_found` instead of silently replacing it or using another date. Prompt budget words such as `не дорого`, `недорого`, `дешево`, `бюджетно`, `до 1500` map to `budget=low`; `средний` or `до 3500` maps to `budget=mid` before candidate ranking. Prompt area words are parsed before LLM: center and common districts, city sides such as north/south/east/west, plus explicit phrases like `в районе ...`, `метро ...`, `рядом с ...`. Parsed area goes into draft `area`, adds area terms to candidate loading and boosts matches in `area`, `metro:*`, `tags` and `set:*`. Users accept steps one by one or regenerate one step against the same saved candidate pack. Full draft regenerate uses `POST /evening/routes/ai-drafts/:draftId/regenerate`, keeps the same candidate pack and intent, rejects the current route step ids, resets accepted indexes and returns a new review draft. `confirm` requires every step to be accepted and then creates a normal `EveningRoute` with `source=ai_openrouter`, `status=draft` and `badgeLabel=AI маршрут`.

Uploads and media:

- `POST /uploads/media/upload-url`
- `POST /uploads/media/complete`
- `POST /uploads/media/file`
- `POST /uploads/chat-attachment/upload-url`
- `POST /uploads/chat-attachment/complete`
- `POST /uploads/chat-attachment/file`
- `GET /media/:assetId`
- `GET /media/:assetId/download-url`

Public sharing:

- `POST /shares`
- `GET /public/shares/:slug`
- `POST /public/offer-codes/:code/activate`

Payments and tokens:

- `GET /payments/catalog` returns backend-owned Frendly+ plans, token packs, promo options and `tbankEnabled`.
- `POST /payments/init` accepts token packs only. `productKind=subscription` is rejected with `subscription_paid_with_tokens`; Frendly+ is paid from the token wallet.
- Payment order responses include `productKind` and `productId`, so clients can return token payments to wallet screens.
- `POST /payments/:orderId/check` verifies order ownership, calls T-Bank `GetState`, checks amount and fulfills only confirmed payments.
- `POST /payments/tbank/webhook` is public, validates T-Bank token and terminal, then uses the same idempotent confirm path as manual check.
- `POST /subscription/subscribe` spends tokens server-side and activates or extends Frendly+; it does not create a T-Bank payment order.
- `GET /tokens/wallet` returns server balance, history and active promoted targets. `POST /tokens/promotions` and `POST /subscription/subscribe` spend tokens server-side. Season reward grants appear in wallet history as `Подарок сезона`.

Admin auth:

- `POST /admin/auth/login`
- `POST /admin/auth/refresh`
- `POST /admin/auth/logout`
- `GET /admin/auth/me`

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
- Requestable private meetup detail can be opened by exact event id for a non-member, with `chatId=null`, so mobile can render the join-request form. Private meetups still stay out of public lists unless the viewer is host, participant, attended before, or otherwise has viewer-specific access.
- `POST /events` accepts route selection for meetup creation. Existing routes use `routeId`; custom routes use a route payload with at least two titled steps and are saved as private `EveningRoute` records, not published templates. It also accepts `afficheEventId` for creating a meetup from a published affiche event; `afficheEventId` and route selection are mutually exclusive.
- Event list and detail summaries expose `imageUrl` from linked public Affiche content, so meetups created from `afficheEventId` can reuse the same external event image.
- Event list and detail summaries expose paid ticket summary from linked public Affiche event sources: `ticketUrl`, `ticketSourceKind`, `ticketSourceId`, `ticketPriceFrom`, `ticketProvider`, `ticketVenue`. Free Affiche sources keep these fields null.
- Event list and detail summaries expose radar category fields: `isDate` and `routeId` from `eveningRouteId`. Mobile uses them with ticket source fields to calculate Radar counts for bars, routes, dating and affiche.
- Event list and detail summaries expose entry flags: `requiresVerification` and `requiresFrendlyPlus`. `POST /events` and `PATCH /host/events/:eventId` accept both booleans. A host can enable verified-only only when verified, and Plus-only only with `trial` or `active` Frendly+.
- `GET /events` accepts `date=yyyy-mm-dd` for one-day filtering.
- `GET /events` keeps recently started meetups visible in discovery for 3 hours, including nearby, calm, newcomers and date feeds. This prevents a just-started meetup from disappearing while users switch accounts or open the feed.
- `GET /after-dark/events` accepts `q` and `date`; `GET /evening/route-templates` accepts `q`.
- `GET /evening/route-templates` list uses summary payload only: route summary fields, first 4 steps and bounded partner offer preview. Template detail loads full steps separately.
- Direct joins lock the event row and check capacity inside the transaction.
- Event detail includes `entryRequirements: { canJoin, missing }`, where `missing` uses `verification` and `frendly_plus`. New entry is blocked on direct join, join request, invite create, invite accept and host approve. Blocked paths return `403 event_entry_requirements_not_met` with `details.missing`. Existing participants are not removed, and pending requests are rechecked on approve.
- `POST /events/:eventId/join-request` keeps duplicate pending requests idempotent. If the previous request was `canceled` or `rejected`, the same request row is reopened as `pending`, review fields are cleared and the host gets a fresh notification.
- `POST /events/:eventId/invites` is allowed for the host or any participant. It requires the inviter to follow the target user, checks blocks, visibility, self-invite, canceled event and capacity, then creates or reopens a pre-approved `EventJoinRequest` and sends an `event_invite` notification with the real inviter as actor.
- Accepting an event invite checks capacity again in the transaction and adds `EventParticipant`, `EventAttendance` and `ChatMember`, then touches the chat summary so mobile lists refresh participant counts.
- Existing direct chats can be reopened after one user deleted the chat. `createOrGetDirectChat` restores missing `ChatMember` rows for both sides instead of leaving the old direct chat hidden.
- Concurrent join request review must not reset an approved request back to pending.
- Duplicate pending event join requests are idempotent: the note can refresh, the request stays pending and host notifications stay deduped by event and user.
- Event detail uses bounded previews and separate counts. `attendees` preview excludes the host because the host is exposed in the separate `host` block.
- `GET /places/search` is an authenticated Create Meetup lookup over imported Tomesto places. It searches only `ExternalContentItem` rows with `source.code=tomesto`, `contentKind=place` and `publicStatus=published`, returns booking URL, average check, rating, provider and up to 3 nested active promos. It never exposes `raw`.
- `GET /places/promos` is an authenticated Tomesto promo surface for mobile. Query params include `city`, optional `latitude`/`longitude`, optional `category` and `limit`. It returns active Tomesto promo rows for the requested city, matched to published Tomesto places when possible, with place category, address, booking URL and distance. It never exposes `raw`.
- `POST /events` accepts optional `externalPlaceId` for a selected Tomesto place. It must point to a published Tomesto place, cannot be combined with `afficheEventId`, and returns `404 external_place_not_found` when missing or hidden. The event reuses `sourceExternalContentItemId` for this place link.
- Event ticket fields are only for `contentKind=event` sources. Tomesto place links expose separate booking fields: `bookingUrl`, `bookingProvider`, `bookingPlaceId`, `bookingAverageCheck`, `bookingCurrency`, `bookingPromos`. Table booking CTAs must not be rendered as ticket CTAs.
- Nearby event list without PostGIS uses two-phase loading: light candidate rows with ids and coordinates first, then full list includes only for the selected page ids. Geo bounds are strict for events that have coordinates, including viewer-owned, joined and attended events; those viewer-specific exceptions only bypass bounds when the event has no coordinates. Optional PostGIS candidate scan stays behind `ENABLE_POSTGIS_EVENT_FEED=true`; it must apply the same key public feed filters before returning candidate ids, including canceled state, visibility, gender visibility, date window, route flags, text query, lifestyle, gender, access and price.
- Mobile remote search keeps grouped search limits bounded instead of requesting 20 items per group.
- Chat list member previews are bounded and block-aware. Meetup previews include `memberProfiles` so clients do not use display names as ids.
- Profile social snapshots are local to a profile request or explicit `/people/:userId/social` request. Do not hydrate profile social for every list row unless the endpoint explicitly returns a bounded preview.
- Meetup ticket summary is part of chat summary. Mobile must not fetch affiche detail just to render the chat buy-ticket block.
- Chat history hides blocked `replyTo` previews.
- Cursors carry sort keys plus id when possible.
- Dating discover remains available to all authenticated users. Do not gate dating profiles or `POST /events` with `mode=dating` behind Frendly+.
- `GET /dating/discover` accepts backend filters: `ageMin`, `ageMax`, `radiusKm` and comma-separated or repeated `interests`. Age is applied in the Prisma query. Interests are matched case-insensitively from onboarding JSON. Radius is approximate, based on known city/area coordinates for the viewer and candidate profiles.
- Dating discover profile payloads include `city`, `area`, `latitude` and `longitude` for Radar. Coordinates are approximate from known city/area labels, with city-level fallback when area is unknown.
- `POST /events` with `mode=dating` requires `inviteeUserId` and `sourceChatId` for an existing direct chat between host and invitee. Dating events stay private: the invitee cannot open event detail until the invite is accepted and they become a participant.
- Declining a pending dating invite cancels the private dating event with `cancelReason=dating_invite_declined` and removes its meetup chat from user chat lists.
- `GET /dating/likes` requires Frendly+ access. Non-plus users get `403 frendly_plus_required`.
- `POST /dating/actions` remains available to all authenticated users, but `super_like` has a daily UTC quota: free users get 1 per day, Frendly+ users get 15 per day. Limit errors return `402 super_like_limit_reached`. Successful super-like responses can include `superLikeQuota` with `limit`, `remaining`, `premium` and `resetAt`.
- Dating positive actions create central `like` notifications on the first positive action. Plain `like` uses a plain dating payload without actor navigation. `super_like` includes `payload.source=dating`, `payload.action=super_like`, `payload.userId` and `payload.userName` so mobile can open dating on that profile.
- Direct upload complete is idempotent by object key, owner, kind and target.
- Private media download checks chat membership, event participation and blocks.
- Profile photo and avatar payloads expose stable `/media/:assetId` URLs, not stored CDN URLs. Profile, people and dating payloads must keep photo entries even when `mediaAsset.publicUrl` is null, because `/media/:assetId` is the public proxy source of truth. The media endpoint can redirect S3 assets to a fresh signed URL, so profile screens are not coupled to a stale CDN URL in DB.
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
- Manual route review import requests create `pending_manual` import runs. External fetch stays in worker, not in the API request path. Admin can request `tomesto`, but it is an opt-in Moscow-only source.
- Tomesto places can become imported place candidates. Tomesto place pages marked closed, for example `Место закрыто навсегда`, are imported hidden via `raw.status.closed=true`. Tomesto events and promos stay out of public Affiche by default because worker imports them hidden unless `TOMESTO_PUBLIC_EVENTS_ENABLED=true`; promos still stay hidden until a promo surface exists. Tomesto promo pages for birthdays, banquets or weddings are skipped by the worker adapter before upsert, while normal gifts and discounts stay importable.
- Manual route review generation requests create `GeneratedRouteDraftBatch.status=pending_manual`. Worker picks them up and calls OpenRouter outside the API request path. Drafts stay in admin review until approve, convert and publish.
- Route review generation uses a deterministic worker planner before OpenRouter. Candidate selection is balanced: worker fetches timed events and flexible places as separate pools so upcoming events do not push cafes, bars, parks and restaurants out of the prompt. Planner builds route skeletons with one timed event anchor, real imported event times, nearby flexible places before or after, walking limits, duplicate venue-cluster checks and no-route movement checks. Invalid OpenRouter drafts are rejected before saving; if all model drafts are invalid, worker uses deterministic fallback or fails the batch without creating invalid review cards. Planner rejects repeated event themes, for example two quests in one route. Planner also rejects bad flow: adjacent restaurant/cafe/bar steps, and a bar before another event, walk or culture stop. When social or culture routes have a nearby walk and bar after the event, planner prefers event -> walk -> final bar. If places are missing, planner may create a warning-level two-event route only when the events differ by category, do not overlap and leave travel time. Planner has scenario recipes for calm, social, date, culture, active and outdoor moods; category taxonomy covers cafe, food, bar, quest, theatre, concert, comedy, quiz, lecture, workshop, market, festival, cinema, sport, bike, adventure, outdoor, spa, walk and culture. Budget policy filters free/low/mid/high/premium candidates and validation rejects drafts over budget. Unknown-price events do not satisfy free budget. Public event route candidates require `priceMode` free or paid and coordinates. OpenRouter writes copy over those skeletons. Converted route steps preserve ticket URL metadata from affiliate imported events, so public route DTOs can expose `ticketUrl`, `ticketSourceCode` and `ticketProvider`. KudaGo and Timepad importers paginate through all pages for the selected period, with a safety page guard from `CONTENT_IMPORT_MAX_PAGES_PER_ENDPOINT`; KudaGo sends route-worthy event and place category whitelists to its API so business, kids, stock, airports, car washes, metro, shelters and similar noise do not enter the imported pool. Route review import and scheduled route generation default to RF million-plus cities. KudaGo only runs for million-plus cities it supports by location code, Timepad and Overpass use the selected city, and Ticketland keeps offers whose feed region matches a supported city. Overpass code remains available for explicit imports, but it is no longer part of default scheduled sources.
- AI route builder can use Tomesto place taxonomy from `ExternalContentItem.tags`, not raw copied page text. Important tags are `area:center`, `occasion:food`, `budget:cheap`, `metro:*`, `feature:*` and `set:*`.
- User-facing AI drafts use `EveningAiDraftService`, separate from admin route review drafts. First it parses prompt count, participant count, event date window, budget and area, then makes a fast OpenRouter Qwen intent call (`evening_ai_route_intent`) that turns arbitrary prompt text into ordered roles, per-step hints, `routeStepCount` and `participantsCount`. Local rules are only fallback. Prompt-only drafts do not need structured filters; explicit route count words in the prompt are enforced before the LLM call, while people counts such as `на 4 человека` are kept separate and ignored for step count. If the prompt lists activities like `прогуляться` and `потом в бар`, backend uses that list as the fallback step count; if the prompt does not imply a count, backend uses 5 steps by default. Date words are parsed before candidate selection. `сегодня` starts at current time and ends at the end of the Moscow day; `завтра`, `послезавтра`, weekdays and exact dates use full local-day windows. The route call then sends compact cards to Qwen (`qwen/qwen3-next-80b-a3b-instruct:free`) and asks for ids plus short copy only. Establishments come from Tomesto, concerts/theatre/standup/show steps from `advcake_ticketland` Ticketland/MTS Live, and walks/parks/free activities from KudaGo. Role order and repeated roles can come from the LLM intent, for example food -> show -> food. Full draft regenerate keeps the saved candidate pack and intent, adds all current route step ids to rejected ids, resets accepted indexes, and asks Qwen for a new route from the remaining candidates. Role hints preserve details such as pasta/Italian, sushi, burgers, Georgian food, theatre, standup, concert, beer bar, infusions, wine bar and cocktails. Budget words in prompt are parsed before candidate selection; low budget prefers cheap Tomesto taxonomy and lower `priceFrom`, while medium budget is stored as `mid`. Area words are also parsed before candidate selection. Known aliases include `центр`, `ЦАО`, `садовое`, `патрики`, `арбат`, `китай-город`, `тверская`, common districts and city sides such as `на севере`. Explicit phrases like `в районе ...`, `метро ...` and `рядом с ...` are kept as normalized area terms. Area terms are added to candidate loading and give a strong scoring boost, but they are not a hard filter. Tomesto candidates and KudaGo candidates require stored coordinates, but KudaGo walk can use both event and place rows, so parks can enter the AI pack. Walk candidates also pass a strict backend filter that keeps parks, embankments, boulevards and walking routes, but rejects skating rinks, sport and active entertainment, museums, exhibitions, theatres, cinemas, restaurants, bars and clubs even when their text contains `парк`. Ticketland/MTS Live show candidates can enter the AI pack without coordinates; for those steps the API skips walking distance validation and uses a start, parsed area or city fallback point when saving the current non-null `EveningRouteStep` coordinates. Worker import enriches KudaGo events from expanded `place` data or existing KudaGo place rows, and enriches Ticketland only from exact imported venue place matches or high-confidence geocoder results. The API validates unknown ids, duplicate ids, source-role mismatch, expired events, requested date mismatch, budget mismatch, role intent mismatch, missing ticket metadata and long walking legs when both adjacent steps have coordinates. Bad LLM output gets one retry; if it still fails, the service saves a deterministic fallback draft with a warning.
- Route generation scopes commercial place steps to Tomesto candidates: restaurant, cafe, bar, wine bar, dancing bar, karaoke, lounge and food. Walks, parks, museums, culture and outdoor steps can still prefer KudaGo or Overpass. If an explicit commercial venue request cannot be backed by Tomesto, return a warning rather than silently replacing it with a generic place.
- Tomesto promos stay hidden from public Affiche. They appear in the mobile promo surface through `/places/promos`, plus nested under selected Tomesto places in place lookup and meetup detail.

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
