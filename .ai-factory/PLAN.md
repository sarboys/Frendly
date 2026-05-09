# Implementation Plan: Tomesto Moscow Import

Branch: perf-modules-acceleration
Created: 2026-05-09

## Settings
- Testing: yes
- Logging: verbose
- Docs: yes

## Goal

Добавить импорт ТоМесто только для Москвы: заведения, события, акции, скидки, ссылки на бронь через нашу реферальную ссылку.

Публичный запуск полного импорта зависит от разрешения ТоМесто или партнерской интеграции. До этого импорт должен работать только как технический прототип или admin-only источник.

## Context

- У нас уже есть контур внешнего контента: `ExternalContentSource`, `ExternalImportRun`, `ExternalContentItem`.
- Worker уже импортирует KudaGo, Timepad, Overpass, AdvCake Ticketland.
- Админка уже умеет создавать manual import runs через `/admin/evening/route-review/import-runs`.
- Публичная афиша читает только `ExternalContentItem` с `contentKind=event`, `publicStatus=published`, `priceMode in (free, paid)`.
- Москва у ТоМесто большая: около 4 386 заведений, 183 страницы мест, 16 страниц акций, 3 страницы событий.
- Sitemap Москвы около 44.6 MB, там много SEO URL. Его нельзя делать главным ежедневным источником.
- Страницы ТоМесто для событий и акций используют окно примерно 30 дней, например с 9 мая по 8 июня 2026.
- Заведения периода не имеют, их надо обновлять отдельно от событий и акций.

## Source Policy

- Не копировать отзывы.
- Не копировать меню как текст.
- Фото не зеркалить по умолчанию.
- Не трогать форму брони и персональные данные.
- Не создавать фейковые брони.
- Не запускать production schedule без разрешения или API от ТоМесто.
- Для MVP хранить минимум: название, адрес, координаты, категория, чек, рейтинг, краткое описание, даты события или акции, `sourceUrl`, `actionUrl`.

## Commit Plan

- Commit 1, after tasks 1-3: `feat: add tomesto source registration`
- Commit 2, after tasks 4-6: `feat: import tomesto moscow content`
- Commit 3, after tasks 7-10: `test: cover tomesto import flow`
- Commit 4, after tasks 11-13: `docs: document tomesto import rollout`

## Tasks

### Phase 1: Source Gate And Wiring

- [x] Task 1: Add legal and rollout gate for the source.
  - Deliverable: document in code comments and docs that `tomesto` is off by default and Moscow-only.
  - Files:
    - Modify: `backend/apps/worker/src/content/external-source.registry.ts`
    - Modify: `backend/apps/worker/src/worker.service.ts`
    - Modify: `ai-context/backend-api.md`, only if public source behavior changes.
  - Rules:
    - `tomesto` must not be added to the default `CONTENT_IMPORT_SOURCES`.
    - It can run only when `CONTENT_IMPORT_SOURCES=tomesto` or an admin manual import asks for `tomesto`.
    - The adapter must return no items for any city except `Москва`.
  - Logging:
    - INFO when Tomesto import starts for Moscow.
    - WARN when the source is requested for another city.
    - WARN when ref link config is missing.

- [x] Task 2: Register `tomesto` as an external source code.
  - Deliverable: backend accepts `tomesto` in source lists and worker can resolve it.
  - Files:
    - Modify: `backend/apps/worker/src/content/content-source.types.ts`
    - Modify: `backend/apps/worker/src/content/external-source.registry.ts`
    - Modify: `backend/apps/worker/src/content/supported-cities.ts`
    - Modify: `backend/apps/worker/src/worker.service.ts`
    - Modify: `backend/apps/api/src/services/admin-route-review.service.ts`
  - Exact behavior:
    - Extend `ExternalSourceCode` with `tomesto`.
    - Add source info:
      - `code`: `tomesto`
      - `name`: `ТоМесто`
      - `kind`: `affiliate_places_events_promos`
      - `baseUrl`: `https://tomesto.ru`
    - Add city code mapping `{ "Москва": "moskva" }`.
    - Add `tomesto` to admin `VALID_SOURCES`.
    - Add `tomesto` to worker `resolveContentSources`.
  - Logging:
    - DEBUG for resolved source list.
    - INFO for created import run source code.
    - ERROR for invalid source handling stays as current `ApiError`.

- [x] Task 3: Add worker HTML parser dependency.
  - Deliverable: worker can parse ТоМесто HTML with a structured parser.
  - Files:
    - Modify: `backend/apps/worker/package.json`
    - Modify: `backend/pnpm-lock.yaml`
  - Command:
    - `cd backend && pnpm --filter @big-break/worker add cheerio`
  - Rule:
    - Do not parse important fields with broad regex when DOM selectors are available.
  - Logging:
    - No runtime logs needed for dependency install.

### Phase 2: Tomesto Adapter

- [x] Task 4: Create the adapter skeleton.
  - Deliverable: `TomestoAdapter` implements `ExternalSourceAdapter`.
  - Files:
    - Create: `backend/apps/worker/src/content/tomesto.adapter.ts`
    - Modify: `backend/apps/worker/src/content/external-source.registry.ts`
  - Exact behavior:
    - `readonly code = 'tomesto' as const`.
    - `baseUrl` comes from `TOMESTO_BASE_URL`, fallback `https://tomesto.ru`.
    - `refQuery` comes from `TOMESTO_REF_QUERY`, fallback empty.
    - `maxPages` comes from `TOMESTO_MAX_PAGES`, fallback `200`.
    - `requestDelayMs` comes from `TOMESTO_REQUEST_DELAY_MS`, fallback `1000`.
    - `windowDays` comes from `TOMESTO_WINDOW_DAYS`, fallback `30`.
    - `fetchBatches(input)` loads only Moscow.
    - Batch order:
      - places
      - events
      - promos
  - Logging:
    - INFO at adapter start with city, from, to, max pages.
    - DEBUG for each fetched list page.
    - WARN for skipped city.
    - ERROR for non-2xx response with status and path.

- [x] Task 5: Implement list pagination discovery.
  - Deliverable: adapter discovers detail URLs without crawling the whole sitemap.
  - Files:
    - Modify: `backend/apps/worker/src/content/tomesto.adapter.ts`
  - Pages:
    - Places: `/moskva/places`, then `/moskva/places/page/2` and later pages until no new place URLs.
    - Events: `/moskva/events` with ToMesto 30-day window, then `/moskva/events/page/2` and later pages until no new event URLs.
    - Promos: `/moskva/promos` with ToMesto 30-day window, then `/moskva/promos/page/2` and later pages until no new promo URLs.
  - Rules:
    - Skip URLs containing `/reservations/`, `/favorite`, `/occurrences/`.
    - Deduplicate URLs with `Set`.
    - Stop at `TOMESTO_MAX_PAGES`.
    - Do not fetch arbitrary URLs with query strings, except the explicit ToMesto event and promo date window params.
    - Use the requested import `from` and `to` for manual runs.
    - For scheduled Tomesto runs, use `TOMESTO_WINDOW_DAYS=30` instead of the generic worker 14-day window.
  - Logging:
    - DEBUG with page path and discovered count.
    - INFO with total discovered counts per content type.
    - WARN when max page guard stops pagination.

- [x] Task 6: Parse place detail pages.
  - Deliverable: place pages become `ExternalRawItem` rows with `contentKind=place`.
  - Files:
    - Modify: `backend/apps/worker/src/content/tomesto.adapter.ts`
  - Mapping:
    - `sourceItemId`: `place:<slug>`
    - `sourceUrl`: canonical detail URL.
    - `contentKind`: `place`
    - `city`: `Москва`
    - `timezone`: `Europe/Moscow`
    - `title`: page H1.
    - `category`: first visible category, fallback `restaurant`.
    - `tags`: features and category labels.
    - `address`: postal address text.
    - `lat`, `lng`: schema.org geo or meta tags.
    - `priceFrom`: average check if available.
    - `currency`: `RUB`.
    - `imageUrl`: null by default unless `TOMESTO_IMPORT_IMAGES=true`.
    - `actionUrl`: source URL plus `TOMESTO_REF_QUERY`.
    - `actionKind`: `affiliate_booking`.
    - `priceMode`: `unknown`.
    - `isAffiliate`: true only when ref query exists.
    - `sourceProvider`: `ТоМесто`.
    - `placeKind`: category slug or normalized category.
    - `raw`: compact source snapshot with slug, rating, metro, features, source updated text.
  - Rules:
    - Do not store review text.
    - Do not store full menu text.
    - Store only compact raw fields needed for audit and dedupe.
  - Logging:
    - DEBUG for parsed slug and required field presence.
    - WARN when a place has no title or address.
    - WARN when coordinates are missing.

- [x] Task 7: Parse events and promos.
  - Deliverable: event and promo pages become `ExternalRawItem` rows, hidden by default until moderation.
  - Files:
    - Modify: `backend/apps/worker/src/content/tomesto.adapter.ts`
    - Modify: `backend/apps/worker/src/content/content-import.service.ts`
  - Event mapping:
    - `sourceItemId`: `event:<category-slug>:<slug>`.
    - `contentKind`: `event`.
    - `category`: normalized event category.
    - `venueName`: linked venue name.
    - `description`: short description, max 500 chars before normalizer.
    - `startsAt`, `endsAt`: first date in requested import window if parseable.
    - `priceFrom`: parsed price when visible.
    - `priceMode`: `paid` when price is greater than 0, `free` only for exact free, otherwise `unknown`.
    - `actionUrl`: booking URL with `TOMESTO_REF_QUERY`.
    - `actionKind`: `affiliate_booking`.
    - `isAffiliate`: true only when ref query exists.
  - Promo mapping:
    - `sourceItemId`: `promo:<category-slug>:<slug>`.
    - `contentKind`: `event`.
    - `category`: `promo`.
    - `tags`: include original promo category, for example `birthday`, `business_lunch`, `alcohol`.
    - `startsAt`, `endsAt`: nearest active occurrence if parseable, otherwise null.
    - `priceMode`: `unknown` unless text gives exact free or paid price.
    - `raw.kind`: `promo`.
  - Visibility:
    - Places can be `published`.
    - Tomesto events and promos stay `hidden` unless `TOMESTO_PUBLIC_EVENTS_ENABLED=true`.
    - Promos stay `hidden` until the product has a separate promo surface.
  - Logging:
    - DEBUG for parsed event or promo fields.
    - WARN for unknown date or missing venue.
    - INFO for hidden counts by reason.

- [x] Task 8: Extract taxonomy for AI builder filters.
  - Deliverable: imported places carry enough structured tags for route builder filtering.
  - Files:
    - Modify: `backend/apps/worker/src/content/tomesto.adapter.ts`
    - Modify: `backend/apps/worker/src/content/content-normalizer.service.ts`, only if new category aliases are needed.
    - Modify: `backend/apps/worker/src/content/route-draft-generation.service.ts`, only if Tomesto place candidates need source-specific filtering.
    - Modify: `backend/apps/worker/src/content/route-planner.ts`, only if budget or flow rules need Tomesto tags.
  - Source taxonomy to collect:
    - `occasion`: for example `poest`, `svidanie`, `s-druzyami`.
    - `area`: for example `tsentr`, `sadovoe-koltso`, `tverskoy-rayon`.
    - `metro`: station names from detail and list pages.
    - `placeCategory`: restaurant, cafe, bar, pub, bistro, gastropub, karaoke.
    - `cuisine`: european, italian, russian, georgian, japanese and others.
    - `features`: летняя веранда, открытая кухня, панорамный вид, камин, живая музыка, бизнес-ланч, завтрак.
    - `sets`: for example `nedorogie-restorany`, `nedorogie-restorany-v-tsentre`, `gde-vkusno-poest`.
  - Normalized tags:
    - `occasion:food`
    - `area:center`
    - `budget:cheap`
    - `place:restaurant`
    - `place:cafe`
    - `feature:summer_terrace`
    - `feature:business_lunch`
    - `metro:teatralnaya`
    - `set:nedorogie-restorany-v-tsentre`
  - AI builder behavior:
    - "прогуляться в центре" uses existing KudaGo or Overpass walk, culture, park candidates first.
    - "потом покушать" uses Tomesto candidates with `occasion:food` or food categories.
    - "в центре" filters by `area:center`, central metro, or distance from the walk stop.
    - "недорого" filters by `budget:cheap`, `sets` containing cheap selections, and average check threshold.
    - final ranking prefers nearby, open, has coordinates, has ref booking URL, lower average check, good rating.
  - Rules:
    - Store taxonomy in `ExternalContentItem.tags` and compact `raw.taxonomy`.
    - Do not add schema fields unless tags and raw are not enough after testing.
    - Do not rely only on text search for budget or area.
  - Logging:
    - DEBUG for extracted taxonomy per detail page.
    - INFO for counts by area, budget and occasion after import.
    - WARN when an item has price but no usable budget bucket.

### Phase 3: Tests

- [x] Task 9: Add adapter unit tests.
  - Deliverable: tests cover parsing and pagination without network.
  - Files:
    - Modify: `backend/apps/worker/test/unit/content-adapters.spec.ts`
  - Cases:
    - Loads Moscow place pages and stops when the next page has no new detail links.
    - Skips reservations, favorite links, occurrence booking links.
    - Parses place title, address, coordinates, category, average check, action URL.
    - Parses event title, venue, date, price, action URL.
    - Parses promo title, category, venue, nearest date, action URL.
    - Extracts taxonomy tags for food, center, cheap, metro and features.
    - Returns empty list for `Санкт-Петербург`.
    - Appends `TOMESTO_REF_QUERY` without breaking existing URL params.
  - Command:
    - `cd backend && pnpm --filter @big-break/worker exec jest --config jest.config.js --runInBand test/unit/content-adapters.spec.ts`
  - Logging:
    - Use spies only where logs are part of expected behavior.
    - Assert WARN for unsupported city.

- [x] Task 10: Add import service unit tests for Tomesto visibility.
  - Deliverable: Tomesto rows follow visibility and safety rules.
  - Files:
    - Modify: `backend/apps/worker/test/unit/content-import.service.spec.ts`
  - Cases:
    - Tomesto place imports as `publicStatus=published`.
    - Tomesto event imports as `hidden` by default.
    - Tomesto event imports as `published` only with `TOMESTO_PUBLIC_EVENTS_ENABLED=true` and known price.
    - Tomesto promo imports as `hidden`.
    - Tomesto place keeps taxonomy tags and compact `raw.taxonomy`.
    - Import counters include missing coords, paid, free, unknown price.
  - Command:
    - `cd backend && pnpm --filter @big-break/worker exec jest --config jest.config.js --runInBand test/unit/content-import.service.spec.ts`
  - Logging:
    - Assert import run error logs do not include ref query secrets.

- [x] Task 11: Add admin service test for source acceptance.
  - Deliverable: admin manual import can create a pending run for `tomesto`.
  - Files:
    - Modify: `backend/apps/api/test/unit/admin-route-review.service.unit.spec.ts`
  - Cases:
    - `sources: ["tomesto"]` creates `pending_manual` run.
    - invalid source still returns `content_import_source_invalid`.
  - Command:
    - `cd backend && pnpm --filter @big-break/api test:unit -- admin-route-review.service.unit.spec.ts`
  - Logging:
    - No extra logs required unless service already logs manual run creation.

### Phase 4: Docs And Rollout

- [x] Task 12: Document environment and rollout.
  - Deliverable: operators know how to run Moscow-only Tomesto import safely.
  - Files:
    - Modify: `ai-context/backend-api.md`
    - Modify: `ai-context/database.md`
    - Modify: `ai-context/infra.md`, only if new env vars need deploy notes.
  - Env vars:
    - `CONTENT_IMPORT_SOURCES=tomesto`
    - `CONTENT_IMPORT_CITIES=Москва`
    - `TOMESTO_REF_QUERY=...`
    - `TOMESTO_REQUEST_DELAY_MS=1000`
    - `TOMESTO_MAX_PAGES=200`
    - `TOMESTO_WINDOW_DAYS=30`
    - `TOMESTO_IMPORT_IMAGES=false`
    - `TOMESTO_PUBLIC_EVENTS_ENABLED=false`
  - Notes:
    - Production schedule stays off until permission or API is confirmed.
    - Manual import through admin review is the first safe path.
    - Places are full Moscow refreshes with no date period.
    - Events and promos use a date window, default 30 days for Tomesto.
    - Promos are imported hidden until a promo surface exists.
    - AI builder filtering uses taxonomy tags, not raw page text.
  - Logging:
    - Docs must mention expected INFO, WARN and ERROR events.

- [x] Task 13: Verify build and graph.
  - Deliverable: implementation passes focused tests, worker build, API build, graph refresh.
  - Commands:
    - `cd backend && pnpm --filter @big-break/worker exec jest --config jest.config.js --runInBand test/unit/content-adapters.spec.ts test/unit/content-import.service.spec.ts`
    - `cd backend && pnpm --filter @big-break/api test:unit -- admin-route-review.service.unit.spec.ts`
    - `cd backend && pnpm --filter @big-break/worker build`
    - `cd backend && pnpm --filter @big-break/api build`
    - `bash scripts/update-understand-graph.sh`
  - Expected result:
    - All commands exit with code 0.
  - Logging:
    - Capture failing command name and first actionable error.

## Open Questions Before Coding

- Какая точная реферальная ссылка или query string у нас есть от ТоМесто.
- Есть ли письменное разрешение на импорт каталога, событий и акций.
- Нужно ли показывать акции в отдельной поверхности приложения или пока только хранить для админки.
- Можно ли использовать фото заведений, или MVP должен быть без изображений.

## Done Criteria

- Manual import run for `tomesto` and city `Москва` creates external items.
- Places have coordinates, address, source URL and affiliate booking action URL when ref query is set.
- Events and promos do not leak into public feeds by default.
- Reviews and personal data are not stored.
- Tests cover parser, visibility and admin source acceptance.
- Worker and API build pass.
- Understand graph updated.
