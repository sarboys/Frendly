# Content Aggregation Map

Use this for external content import, paid affiliate events, free affiche, KudaGo places, route candidates and admin moderation.

For concrete files and links, run:

```bash
./scripts/ua-query.mjs "content import affiche advcake kudago timepad places route planner admin"
```

## Layer purpose

Content aggregation is a separate product layer between external sources and public product surfaces.

It decides:

- what comes from each external source
- whether an item is an event or a place
- whether price is free, paid or unknown
- whether the item can be public
- whether the item can be used by route planner
- which URL opens external ticket checkout

This layer must not add in-app payment.

## Runtime

```text
External sources
  -> worker import adapters
  -> normalize
  -> dedupe and enrichment
  -> ExternalContentItem
  -> public affiche API
  -> search
  -> mobile Tonight/Search/Affiche
  -> route planner candidates
  -> admin review
```

The API request path does not fetch external sources.

Admin manual import creates `ExternalImportRun.status=pending_manual`. Worker scans pending runs and performs the external fetch.

Worker import adapters may expose `fetchBatches()` for page streaming. KudaGo, Timepad and AdvCake use this path, so import does not need one full `rawItems` array. Import logs include RSS, duration, throughput and skipped count.

Import duplicate lookup is preloaded per city, day, content kind and source. The worker should match duplicates in memory for that group instead of running one DB query per event.

## Sources

Scheduled import default sources:

```text
kudago,timepad,advcake_ticketland
```

Overpass code remains available for explicit manual import, but it is not part of default scheduled import.

Source roles:

- `advcake_ticketland`: paid affiliate ticket events from Ticketland and MTS Live.
- `kudago`: free events and places.
- `timepad`: free events.
- `overpass`: explicit places import only when requested.

## AdvCake Ticketland and MTS Live

Source code:

```text
advcake_ticketland
```

AdvCake offer:

```text
offer_id=663
ticketland.ru | live.mts.ru
```

Adapter flow:

```text
ADVCAKE_API_PASS
  -> GET /common-feeds?pass=***&offer_id=663
  -> choose yml feed
  -> download feed from feeds.advcake.ru
  -> parse YML
  -> filter city and date window
  -> save as external event
```

Secret rules:

- Real AdvCake pass lives only in `ADVCAKE_API_PASS`.
- Do not write the real pass in code, plan, docs, tests or logs.
- Logs and import errors must mask `pass` and AdvCake feed/action URLs.

Affiliate URL rules:

- Feed URL must be HTTPS and hosted by `feeds.advcake.ru`.
- Action URL must be HTTPS and hosted by `go.avred.online`, `ticketland.ru` or `live.mts.ru`.
- Mobile opens paid ticket action through external browser or external app.
- Payment is external only.

## Content kind

`contentKind=event` means the item can go to affiche if public policy allows it.

`contentKind=place` means the item stays in places/search/route planner flows.

Places are not affiche. Bars, restaurants, cafes, museums and similar places must not be rendered as event cards.

Public affiche endpoints must always filter:

```text
contentKind=event
```

## Price policy

Price mode is strict:

```text
exact 0       -> free
greater than 0 -> paid
unknown/null -> unknown
```

Product rules:

- Free events can be public only when the external price is exactly `0`.
- Unknown price must not be shown as free.
- Public affiche exposes only `priceMode=free` and `priceMode=paid`.
- `priceMode=unknown` stays visible in admin only.
- Free budget in route planner must not accept unknown-price events or places.
- Free route candidates must have `priceMode=free` or `priceFrom=0`; `null` price is unknown, not free.

Default public policy:

```text
AdvCake paid event + actionUrl
  -> published

KudaGo free event
  -> published

Timepad free event
  -> published

KudaGo or Timepad paid event
  -> hidden by default

Unknown-price event
  -> hidden

KudaGo place
  -> published as place, not as affiche event
```

Paid KudaGo or Timepad fallback exists only behind:

```text
CONTENT_IMPORT_INCLUDE_UNMONETIZED_PAID=true
```

## Storage

Main models:

- `ExternalContentSource`
- `ExternalImportRun`
- `ExternalContentItem`
- `GeneratedRouteDraftBatch`
- `GeneratedRouteReviewDraft`
- `GeneratedRouteDraftStep`

Important `ExternalContentItem` fields:

- `sourceId`, `sourceItemId`, `sourceUrl`
- `contentKind`
- `city`, `timezone`, `area`
- `title`, `shortSummary`, `category`, `tags`
- `address`, `lat`, `lng`
- `startsAt`, `endsAt`
- `priceFrom`, `currency`, `priceMode`
- `venueName`, `imageUrl`
- `actionUrl`, `actionKind`, `isAffiliate`
- `sourceProvider`, `placeKind`
- `publicStatus`, `moderationStatus`
- `lastSeenAt`, `importedAt`, `expiresAt`
- `raw`

Import run health counters:

- `fetchedCount`
- `normalizedCount`
- `skippedCount`
- `publishedCount`
- `paidCount`
- `freeCount`
- `unknownPriceCount`
- `missingCoordsCount`

Import logs also include:

- `rssBefore`
- `rssAfter`
- `durationMs`
- `itemsPerSecond`

## Dedupe and enrichment

Event duplicate key uses:

```text
city + contentKind + normalized title + UTC day + venue
```

Events and places must not be deduped into each other.

When AdvCake matches KudaGo or Timepad:

```text
AdvCake item stays primary
  -> keeps paid price and affiliate actionUrl
  -> copies missing address, lat, lng, venueName from duplicate
  -> duplicate source item becomes hidden
  -> raw.enrichment records match details
```

This lets paid affiliate events appear in affiche even without coordinates. User-facing AI show drafts may also use Ticketland rows without coordinates, while enrichment still improves walking distance and map quality when coordinates are found. User-facing AI walk drafts can use KudaGo event rows and KudaGo place rows, so parks and walking places are not lost when there is no timed event. Walk candidate filtering is stricter than the broad search query: parks, embankments, boulevards and walking routes pass, while skating rinks, quests, museums, exhibitions, theatres, cinemas, restaurants, bars, clubs and sport or active entertainment rows are rejected even if their text mentions a park.

KudaGo event import requests `expand=place`, so event rows can store `venueName`, `address`, `lat` and `lng` from the linked place. If an older or partial KudaGo event only has `raw.place.id`, worker can copy the missing venue fields from the already imported `kudago` place row. The enrichment is recorded in `raw.enrichment` with `method=kudago_place_id` and `geoConfidence=high`.

AdvCake Ticketland rows can also be enriched before upsert:

```text
exact venueName match against KudaGo or Tomesto place
  -> copy address, lat, lng, venueName
  -> raw.enrichment.method=exact_venue_place_match

optional Yandex geocoder high-confidence result
  -> copy address, lat, lng
  -> raw.enrichment.method=geocoder_high_confidence
```

Generic venue names such as `Клуб`, `Театр`, `Пешеходные экскурсии` are not geocoded by name. Geocoder enrichment is optional and only runs when a backend geocoder key is configured. Low-confidence geocoder results must leave coordinates empty. KudaGo and Tomesto route candidates still require coordinates; Ticketland show candidates can enter the user-facing AI pack without them. KudaGo place candidates are allowed only for walk/free activity style AI route steps, not as restaurants or bars. Tomesto place pages that contain a closed status such as `Место закрыто навсегда` are stored with `raw.status.closed=true` and imported as `publicStatus=hidden`, so they stay out of place search and AI candidate packs.

## Public API

Endpoints:

```text
GET /affiche/events
GET /affiche/events/:eventId
```

List filters:

- `city`
- `date`
- `dateFrom`
- `dateTo`
- `priceMode`
- `source`
- `category`
- `featured`
- `q`
- `cursor`
- `limit`

Public query must require:

```text
contentKind=event
publicStatus=published
moderationStatus != rejected
priceMode in free,paid
```

`GET /search` returns an `affiche` block. Search must not mix places into affiche.

## Admin

Admin route review includes content aggregation controls:

- sources
- import runs
- content table
- route generation runs
- route review drafts

Admin content table should show:

- source
- content kind
- title
- city
- category
- venue and address
- `paid/free/unknown`
- source URL and action URL
- affiliate flag
- `hasCoords`
- public status
- moderation status
- route planner blocked reason
- compact raw summary

Content filters:

- `city`
- `source`
- `contentKind`
- `priceMode`
- `category`
- `publicStatus`
- `moderationStatus`
- `hasCoords`
- `dateFrom`
- `dateTo`

Content actions:

- `publish`
- `hide`
- `reject`
- `stale`
- `force-free`
- `force-paid`

## Route planner

Route planner can use imported content only when it is route-worthy.

Event candidate requirements:

```text
contentKind=event
publicStatus=published
moderationStatus != rejected
priceMode in free,paid
lat and lng present
```

Place candidate requirements:

```text
contentKind=place
publicStatus=published
moderationStatus != rejected
lat and lng present
```

Free budget place requirements:

```text
priceMode=free or priceFrom=0
```

For `mood=outdoor` and `budget=free`, route generation should prefer outdoor categories only:

```text
walk,outdoor,bike,sport,adventure
```

Food, cafe and bar must not fill a free outdoor route unless the place is explicitly free.

Route generation keeps the place pool bounded before planner prompt building: DB query is capped, then places are balanced by requested area, category quota and geo bucket. Batch logs include RSS and duration.

User-facing AI drafts run a fast Qwen intent pass before building the candidate pack. That intent pass returns ordered roles, inferred step count and per-step search hints, so arbitrary prompts and repeated role types are supported without adding one-off rules. Prompt-only drafts infer 2-5 steps and default to 5 when the count is unclear. Source mapping stays backend-owned: Tomesto for food, bars, clubs and restaurants; Ticketland/MTS Live for theatre, shows, concerts and standup; KudaGo for walks, parks, free activities and city events. Budget words in prompt are parsed before selection, so `не дорого`, `недорого`, `бюджетно` and `до 1500` prefer low-budget candidates. Walk roles use an extra semantic filter after DB search, so `Каток у парка` is not treated as a walk just because it mentions a park.

AdvCake events without coordinates stay in public affiche only. They must not be selected for generated routes.

Converted route steps preserve external ticket metadata:

- `ticketUrl`
- `ticketSourceCode`
- `ticketProvider`

## Mobile

Mobile has a separate `AfficheEvent` model.

Surfaces:

- Tonight rail for week tickets and events.
- Search block for tickets and events.
- Affiche detail screen.
- Create Meetup prefill from `afficheEventId`.
- Evening route ticket button when route step has `ticketUrl`.

Paid CTA:

```text
Купить билет
  -> actionUrl
  -> url_launcher external mode
```

Free CTA:

```text
Подробнее
```

Mobile affiche reads public affiche events only. KudaGo places stay in their own product flows.

## Worker schedule

Default scheduled import interval:

```text
CONTENT_IMPORT_INTERVAL_MS=14400000
```

That is 4 hours.

Production can switch scheduled import to a wall-clock daily run:

```text
CONTENT_IMPORT_DAILY_AT=00:00
CONTENT_IMPORT_TIME_ZONE=Europe/Moscow
```

When `CONTENT_IMPORT_DAILY_AT` is set, worker does not run scheduled import immediately on boot. It waits for the next configured wall-clock time.

Manual import scan:

```text
CONTENT_MANUAL_IMPORT_INTERVAL_MS=30000
```

Manual generation scan:

```text
CONTENT_MANUAL_GENERATION_INTERVAL_MS=30000
```

The worker has an in-process guard so scheduled content import runs do not overlap inside one worker process.

## Failure behavior

If one source fails:

- the import run becomes `failed`
- counters and masked error are saved
- the API request path is not affected
- other worker tasks keep running

If a source returns no items:

- worker logs a warning
- run can still finish completed with zero fetched items

Items missing from later imports are marked `publicStatus=stale` after the grace period. They are not deleted.

## Rollout

Production rollout order:

1. Deploy migrations and code.
2. Add production secret `ADVCAKE_API_PASS` outside git.
3. Check `ADVCAKE_TICKETLAND_OFFER_ID=663`.
4. Keep default sources `kudago,timepad,advcake_ticketland`.
5. Run manual import for Moscow and Saint Petersburg.
6. Check admin import runs and content table.
7. Check public `/affiche/events`.
8. Check mobile paid detail and external buy button.
9. Enable or keep scheduled import every 4 hours.

Manual smoke is not complete until a real paid AdvCake card opens an external Ticketland or MTS Live checkout.

## Source files

Core worker:

- `backend/apps/worker/src/content/advcake-ticketland.adapter.ts`
- `backend/apps/worker/src/content/content-import.service.ts`
- `backend/apps/worker/src/content/content-normalizer.service.ts`
- `backend/apps/worker/src/content/content-deduplication.service.ts`
- `backend/apps/worker/src/content/route-draft-generation.service.ts`
- `backend/apps/worker/src/worker.service.ts`

Core API:

- `backend/apps/api/src/controllers/affiche.controller.ts`
- `backend/apps/api/src/services/affiche.service.ts`
- `backend/apps/api/src/services/search.service.ts`
- `backend/apps/api/src/services/admin-route-review.service.ts`
- `backend/apps/api/src/services/events.service.ts`

Data and contracts:

- `backend/packages/database/prisma/schema.prisma`
- `backend/packages/contracts/src/index.ts`

Admin:

- `admin/src/admin/pages/RouteReviewQueue.tsx`
- `admin/src/admin/evening/routeReviewApi.ts`
- `admin/src/admin/evening/routeReviewTypes.ts`

Mobile:

- `mobile/lib/shared/models/affiche_event.dart`
- `mobile/lib/shared/data/backend_repository.dart`
- `mobile/lib/shared/data/app_providers.dart`
- `mobile/lib/features/affiche/`
- `mobile/lib/features/tonight/presentation/tonight_screen.dart`
