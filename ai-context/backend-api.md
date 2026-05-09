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
- `POST /events/:eventId/invites/:requestId/accept`
- `POST /events/:eventId/invites/:requestId/decline`
- check-in, live, after-party, feedback endpoints live under `/events/:eventId/*`.

Search:

- `GET /search` returns `{ meetups, evenings, routes, posters, affiche, nextCursors }`.
- Query params include `q`, `date`, `city`, `lifestyle`, `price`, `priceMode`, `gender`, `access`, plus per-block limits: `meetupsLimit`, `eveningsLimit`, `routesLimit`, `postersLimit`, `afficheLimit`.
- `date` is `yyyy-mm-dd` or `any`. Events, after-dark events, posters and affiche apply it as a one-day UTC range.

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
- Chat list items expose `isPinned`; pinned items are returned before normal recency ordering.
- Meetup chat list items keep `members` as display-name previews and also expose `memberProfiles` with `{ userId, name, online, isCurrentUser }` for profile and direct-chat actions.
- Meetup chat list items expose paid ticket summary from the linked source. Legacy `Poster` uses `sourcePoster.ticketUrl`, `priceFrom`, `provider` and `venue`; public Affiche uses `sourceExternalContentItem.actionUrl`, `priceFrom`, `priceMode`, `sourceProvider` and `venueName`. Clients render the ticket block only when URL exists and price is paid.

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

- `GET /people/:userId`
- `GET /people/:userId/social`
- `PUT /people/:userId/follow`
- `DELETE /people/:userId/follow`
- `PUT /people/:userId/reactions/:kind`
- `DELETE /people/:userId/reactions/:kind`
- `POST /people/:userId/direct-chat`
- Public profile responses include `social` with follower, like, super-like counts and viewer flags. Profile social actions are independent from dating actions. Backend rejects follow, like and super-like on yourself.

Evening:

- `GET /evening/options`
- `GET /evening/route-templates`
- `GET /evening/route-templates/:templateId`
- `GET /evening/route-templates/:templateId/sessions`
- `POST /evening/route-templates/:templateId/sessions`
- `POST /evening/routes/resolve`
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
- `POST /evening/routes/resolve` accepts structured `goal`, `mood`, `budget`, `format`, `area` and optional free text `prompt`. Prompt is parsed on the API side into the same option keys and only fills missing structured fields. Legacy AI clients may send `format=friends`, `format=friend`, `format=newfriends` or `format=social`; API treats them as `format=mixed`.

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
- `POST /events` accepts route selection for meetup creation. Existing routes use `routeId`; custom routes use a route payload with at least two titled steps and are saved as private `EveningRoute` records, not published templates. It also accepts `afficheEventId` for creating a meetup from a published affiche event; `posterId`, `afficheEventId` and route selection are mutually exclusive.
- Event list and detail summaries expose `imageUrl` from linked public Affiche content, so meetups created from `afficheEventId` can reuse the same external event image.
- `GET /events` and `GET /posters` accept `date=yyyy-mm-dd` for one-day filtering.
- `GET /after-dark/events` accepts `q` and `date`; `GET /evening/route-templates` accepts `q`.
- `GET /evening/route-templates` list uses summary payload only: route summary fields, first 4 steps and bounded partner offer preview. Template detail loads full steps separately.
- Direct joins lock the event row and check capacity inside the transaction.
- Join request review must not reset a reviewed request back to pending.
- Duplicate pending event join requests are idempotent: the note can refresh, the request stays pending and host notifications stay deduped by event and user.
- Event detail uses bounded previews and separate counts.
- Nearby event list without PostGIS uses two-phase loading: light candidate rows with ids and coordinates first, then full list includes only for the selected page ids. Geo bounds are strict for events that have coordinates, including viewer-owned, joined and attended events; those viewer-specific exceptions only bypass bounds when the event has no coordinates. Optional PostGIS candidate scan stays behind `ENABLE_POSTGIS_EVENT_FEED=true`; it must apply the same key public feed filters before returning candidate ids, including canceled state, visibility, gender visibility, date window, route flags, text query, lifestyle, gender, access and price.
- Mobile remote search keeps grouped search limits bounded instead of requesting 20 items per group.
- Chat list member previews are bounded and block-aware. Meetup previews include `memberProfiles` so clients do not use display names as ids.
- Profile social snapshots are local to a profile request or explicit `/people/:userId/social` request. Do not hydrate profile social for every list row unless the endpoint explicitly returns a bounded preview.
- Meetup ticket summary is part of chat summary. Mobile must not fetch poster or affiche detail just to render the chat buy-ticket block.
- Chat history hides blocked `replyTo` previews.
- Cursors carry sort keys plus id when possible.
- Dating discover remains available to all authenticated users. Do not gate dating profiles or `POST /events` with `mode=dating` behind Frendly+.
- `GET /dating/likes` requires Frendly+ access. Non-plus users get `403 frendly_plus_required`.
- `POST /dating/actions` remains available to all authenticated users, but `super_like` has a daily UTC quota: free users get 1 per day, Frendly+ users get 15 per day. Limit errors return `402 super_like_limit_reached`. Successful super-like responses can include `superLikeQuota` with `limit`, `remaining`, `premium` and `resetAt`.
- Direct upload complete is idempotent by object key, owner, kind and target.
- Private media download checks chat membership, event participation and blocks.
- Profile photo and avatar payloads expose stable `/media/:assetId` URLs, not stored CDN URLs. The media endpoint can redirect S3 assets to a fresh signed URL, so profile screens are not coupled to a stale CDN URL in DB.
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
- Tomesto places can become imported place candidates. Tomesto events and promos stay out of public Affiche by default because worker imports them hidden unless `TOMESTO_PUBLIC_EVENTS_ENABLED=true`; promos still stay hidden until a promo surface exists.
- Manual route review generation requests create `GeneratedRouteDraftBatch.status=pending_manual`. Worker picks them up and calls OpenRouter outside the API request path. Drafts stay in admin review until approve, convert and publish.
- Route review generation uses a deterministic worker planner before OpenRouter. Candidate selection is balanced: worker fetches timed events and flexible places as separate pools so upcoming events do not push cafes, bars, parks and restaurants out of the prompt. Planner builds route skeletons with one timed event anchor, real imported event times, nearby flexible places before or after, walking limits, duplicate venue-cluster checks and no-route movement checks. Invalid OpenRouter drafts are rejected before saving; if all model drafts are invalid, worker uses deterministic fallback or fails the batch without creating invalid review cards. Planner rejects repeated event themes, for example two quests in one route. Planner also rejects bad flow: adjacent restaurant/cafe/bar steps, and a bar before another event, walk or culture stop. When social or culture routes have a nearby walk and bar after the event, planner prefers event -> walk -> final bar. If places are missing, planner may create a warning-level two-event route only when the events differ by category, do not overlap and leave travel time. Planner has scenario recipes for calm, social, date, culture, active and outdoor moods; category taxonomy covers cafe, food, bar, quest, theatre, concert, comedy, quiz, lecture, workshop, market, festival, cinema, sport, bike, adventure, outdoor, spa, walk and culture. Budget policy filters free/low/mid/high/premium candidates and validation rejects drafts over budget. Unknown-price events do not satisfy free budget. Public event route candidates require `priceMode` free or paid and coordinates. OpenRouter writes copy over those skeletons. Converted route steps preserve ticket URL metadata from affiliate imported events, so public route DTOs can expose `ticketUrl`, `ticketSourceCode` and `ticketProvider`. KudaGo and Timepad importers paginate through all pages for the selected period, with a safety page guard from `CONTENT_IMPORT_MAX_PAGES_PER_ENDPOINT`; KudaGo sends route-worthy event and place category whitelists to its API so business, kids, stock, airports, car washes, metro, shelters and similar noise do not enter the imported pool. Route review import and scheduled route generation default to RF million-plus cities. KudaGo only runs for million-plus cities it supports by location code, Timepad and Overpass use the selected city, and Ticketland keeps offers whose feed region matches a supported city. Overpass code remains available for explicit imports, but it is no longer part of default scheduled sources.
- AI route builder can use Tomesto place taxonomy from `ExternalContentItem.tags`, not raw copied page text. Important tags are `area:center`, `occasion:food`, `budget:cheap`, `metro:*`, `feature:*` and `set:*`.

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
