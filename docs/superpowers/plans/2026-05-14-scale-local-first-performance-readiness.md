# Frendly 20k DAU And Local First Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** подготовить Frendly к 20k DAU с запасом по backend, realtime, media и worker, а на телефоне дать быстрый warm UX через local-first кеш, как в привычных быстрых мессенджерах.

**Architecture:** backend остается источником истины, Flutter получает persistent local-first слой для быстрых повторных открытий. Сначала добавляем метрики и нагрузочные проверки, затем включаем локальный кеш, media reuse, realtime sync, worker роли и scale compose. Все рискованные изменения идут через флаги, staging smoke и измерения.

**Tech Stack:** Flutter, Riverpod, Dio, Drift, SQLite, cached_network_image, flutter_cache_manager, NestJS, Prisma, PostgreSQL, PgBouncer, Redis, S3-compatible storage, CDN, Nginx, Prometheus, Grafana, k6 or Artillery, Jest, Flutter Test.

---

## Why This Plan Exists

Этот файл объединяет два старых направления:

- `docs/superpowers/plans/2026-05-14-scale-ux-performance-readiness.md`
- `docs/superpowers/plans/2026-05-14-local-first-app-cache.md`

Первый план отвечает на вопрос: как выдержать до 20k DAU без просадки backend, realtime, базы, media и worker.

Второй план отвечает на вопрос: как сделать app быстрым при повторном открытии, чтобы знакомые экраны, чаты, аватарки и фото появлялись сразу.

Их нельзя делать как две независимые ветки. Local-first кеш снижает давление на API. Метрики scale-плана показывают, где кеш реально помог, а где нужен backend fix. Media cache, chat sync, ETag, worker lag и rollout флаги относятся сразу к обоим направлениям.

---

## Main Problems

### 1. Warm UX

Проблема:

- пользователь уже открывал экран, но при новом входе снова видит fullscreen loader.
- чаты, Home, Dating, Affiche, Map и профили повторно ждут сеть.
- provider state и image cache помогают только частично, потому что нет persistent app data cache.

Решение:

- добавить Drift SQLite слой.
- хранить горячие query payloads по `userId`, namespace и stable cache key.
- для чатов хранить структурированные summaries, messages, cursors и pending commands.
- сеть обновляет данные фоном.
- UI не сбрасывает скролл и не показывает fullscreen loader, если есть кеш.

### 2. Backend Pressure

Проблема:

- 20k DAU создают пики на `/events`, `/dating/discover`, `/chats/*`, `/media/*`, `/affiche/events`, `/evening/route-templates`.
- без метрик нельзя честно сказать, какой endpoint узкий.
- один compose stack трудно масштабировать по ролям.

Решение:

- добавить Prometheus metrics в API, chat и worker.
- instrument API, Prisma, Redis, WebSocket, worker, S3.
- добавить load smoke на hot paths.
- подготовить `compose.scale.yml`.
- разделить worker роли.
- включать fast DB paths только после verify.

### 3. Realtime And Chat

Проблема:

- быстрый chat UX зависит не только от WebSocket.
- pending sends должны жить после restart.
- reconnect должен догонять пропущенные события.
- unread, attachments и media ready идут через worker и Redis.

Решение:

- перенести chat outbox из `SharedPreferences` в Drift.
- хранить recent chat messages локально.
- оставить REST latest page и WebSocket sync source of truth.
- добавить WebSocket metrics, backpressure counters, reconnect sync metrics.
- scale chat instances через Redis pubsub, reconnect плюс sync остаются главным механизмом надежности.

### 4. Media Speed

Проблема:

- аватарки, фото профилей, chat attachments и Affiche images должны открываться повторно без лишних запросов.
- private media нельзя просто сделать публичной ради CDN hit ratio.

Решение:

- использовать shared media widgets.
- держать usage profiles: `avatar`, `card`, `hero`, `fullscreen`.
- кешировать signed download URL на короткое время через `AppAttachmentService`.
- prewarm делать только для видимых или ближайших карточек.
- instrument S3 и media endpoints.
- не ослаблять private media checks.

---

## Shared Principles

- Backend остается источником истины.
- Local cache нужен для быстрого первого кадра, не для полной offline-версии продукта.
- Offline scope: читать уже открытые данные и отправлять queued chat messages.
- Полный offline join, payments, upload, moderation и admin flows не входят.
- Не добавлять broad global prefetch.
- Не запускать chat realtime, chat lists, people lists, map feeds или settings reads на root startup.
- Не грузить media полными списками.
- Не чинить все backend endpoints сразу.
- Любой флаг по умолчанию держит текущий безопасный путь, пока staging не доказал новый.
- Приватные chat и story media остаются приватными.
- Каждый hot path меняется с тестом, метрикой или QA smoke.

---

## Success Targets

### Mobile

- Warm app start после auth restore: первый полезный экран до `200 ms` после router ready.
- Warm Chats list: до `150 ms`.
- Warm Chat thread: последние сообщения до `150 ms`.
- Warm Tonight first viewport: до `250 ms`.
- Warm Dating home preview: до `200 ms`.
- Local DB hot read p95: до `30 ms`.
- Local DB size: до `200 MB` без image cache.
- Network refresh не блокирует первый frame.
- Refresh не дергает scroll position.

### Backend And Realtime

- API p95 для indexed или cached hot reads: ниже `300 ms` на 20k DAU smoke.
- Chat message ack p95: ниже `500 ms` в обычных комнатах.
- Worker outbox lag для realtime, unread, push, media ready: ниже `5 seconds` на expected peak.
- WebSocket reconnect плюс sync не теряет сообщения.
- PgBouncer pool не уходит в saturation на load smoke.
- Redis reconnect storm отсутствует.
- S3 operation errors не растут после media prewarm.

### Product Flows

Не должно быть регресса:

- login
- onboarding
- Home
- map
- dating swipe
- dating match
- meetup create
- meetup join
- chat send
- chat unread clear
- photo attachment reopen
- voice playback
- profile
- safety
- wallet
- payments
- logout and login as another user

---

## File Map

### Planning

- Create: `docs/superpowers/plans/2026-05-14-scale-local-first-performance-readiness.md`
- Keep as historical drafts:
  - `docs/superpowers/plans/2026-05-14-scale-ux-performance-readiness.md`
  - `docs/superpowers/plans/2026-05-14-local-first-app-cache.md`

### Mobile Foundation

- Modify: `mobile/pubspec.yaml`
- Modify: `mobile/lib/main.dart`
- Modify: `mobile/lib/app/app.dart`
- Modify: `mobile/lib/app/core/providers/core_providers.dart`
- Modify: `mobile/lib/app/session/app_session_controller.dart`
- Create: `mobile/lib/app/core/local_cache/app_local_database.dart`
- Create: `mobile/lib/app/core/local_cache/app_local_cache_store.dart`
- Create: `mobile/lib/app/core/local_cache/app_cache_key.dart`
- Create: `mobile/lib/app/core/local_cache/app_cache_policy.dart`
- Create: `mobile/lib/app/core/local_cache/chat_local_store.dart`
- Create: `mobile/lib/app/core/local_cache/local_first_repository.dart`
- Create: `mobile/lib/app/core/local_cache/local_cache_metrics.dart`

### Mobile Hot Paths

- Modify: `mobile/lib/app/core/network/chat_socket_client.dart`
- Modify: `mobile/lib/shared/data/backend_repository.dart`
- Modify: `mobile/lib/shared/data/app_providers.dart`
- Modify: `mobile/lib/features/chats/presentation/chat_thread_providers.dart`
- Modify: `mobile/lib/features/chats/presentation/chats_screen.dart`
- Modify: `mobile/lib/features/tonight/presentation/tonight_screen.dart`
- Modify: `mobile/lib/features/affiche/presentation/affiche_events_screen.dart`
- Modify: `mobile/lib/features/dating/presentation/dating_providers.dart`
- Modify: `mobile/lib/features/dating/presentation/dating_screen.dart`
- Modify: `mobile/lib/features/meetups/presentation/meetups_screen.dart`
- Modify: `mobile/lib/shared/widgets/bb_avatar.dart`
- Modify: `mobile/lib/shared/widgets/bb_external_event_image.dart`
- Modify: `mobile/lib/shared/widgets/bb_profile_photo_image.dart`
- Modify: `mobile/lib/app/core/device/app_media_prewarm_service.dart`
- Modify: `mobile/lib/app/core/device/app_attachment_service.dart`

### Backend And Infra

- Modify: `backend/apps/api/src/app.module.ts`
- Modify: `backend/apps/api/src/main.ts`
- Create: `backend/apps/api/src/controllers/metrics.controller.ts`
- Modify: `backend/apps/api/src/controllers/chats.controller.ts`
- Modify: `backend/apps/api/src/services/chats.service.ts`
- Modify: `backend/apps/api/src/controllers/media.controller.ts`
- Modify: `backend/apps/api/src/services/media.service.ts`
- Modify: `backend/apps/chat/src/app.module.ts`
- Modify: `backend/apps/chat/src/chat-server.service.ts`
- Create: `backend/apps/chat/src/metrics.controller.ts`
- Modify: `backend/apps/worker/src/app.module.ts`
- Modify: `backend/apps/worker/src/worker.service.ts`
- Create: `backend/apps/worker/src/metrics.controller.ts`
- Create: `backend/packages/database/src/metrics.ts`
- Modify: `backend/packages/database/src/pubsub.ts`
- Modify: `backend/packages/database/src/s3.ts`
- Modify: `backend/apps/api/src/services/prisma.service.ts`
- Modify: `backend/apps/chat/src/prisma.service.ts`
- Modify: `backend/apps/worker/src/prisma.service.ts`
- Modify: `backend/scripts/perf-hotpaths.mjs`
- Create: `backend/scripts/perf-20k-smoke.mjs`
- Create: `compose.scale.yml`
- Create: `compose.observability.yml`
- Modify: `compose.prod.yml`
- Modify: `.env.production.example`
- Modify: `deploy/nginx/frendly.conf`
- Modify: `scripts/deploy.sh`
- Create: `deploy/observability/prometheus.yml`
- Create: `deploy/observability/grafana/README.md`
- Create: `deploy/observability/grafana/dashboards/frendly-runtime.json`
- Create: `deploy/observability/grafana/dashboards/frendly-mobile-hot-paths.json`

### Tests And Docs

- Create: `mobile/test/app/core/local_cache/app_local_database_test.dart`
- Create: `mobile/test/app/core/local_cache/app_local_cache_store_test.dart`
- Create: `mobile/test/app/core/local_cache/chat_local_store_test.dart`
- Create: `mobile/test/app/core/local_cache/local_first_repository_test.dart`
- Modify: `mobile/test/app/core/network/chat_socket_client_test.dart`
- Modify: `mobile/test/shared/data/app_providers_test.dart`
- Modify: `mobile/test/features/chats/presentation/chat_thread_providers_test.dart`
- Modify: `mobile/test/shared/widgets/bb_profile_photo_image_test.dart`
- Modify: `mobile/test/shared/widgets/bb_chat_attachment_image_test.dart`
- Modify: `backend/apps/api/test/unit/chats.service.unit.spec.ts`
- Modify: `backend/apps/api/test/unit/media.service.unit.spec.ts`
- Modify: `backend/apps/worker/test/unit/worker.service.spec.ts`
- Create: `docs/audits/scale-20k-readiness-template.md`
- Create: `docs/audits/2026-05-14-scale-local-first-performance-report.md`
- Modify if contracts or architecture changed: `ai-context/frontend-flutter.md`
- Modify if contracts or architecture changed: `ai-context/realtime-chat.md`
- Modify if contracts or architecture changed: `ai-context/backend-api.md`
- Modify if topology changed: `ai-context/infra.md`
- Modify if database rollout changed: `ai-context/database.md`

---

## Phase 0: Baseline And Decisions

### Task 1: Capture Current State

**Goal:** зафиксировать, что есть сейчас, чтобы не спорить на ощущениях.

**Files:**

- Read: `docs/backend_performance_audit.md`
- Read: `ai-context/frontend-flutter.md`
- Read: `ai-context/realtime-chat.md`
- Read: `ai-context/backend-api.md`
- Read: `ai-context/infra.md`
- Read: `compose.prod.yml`
- Read: `deploy/nginx/frendly.conf`

- [ ] Run `cd /Users/sergeypolyakov/MyApp && git status --short`.
- [ ] Record current production services, ports, env flags and nginx `/ws` behavior.
- [ ] Record current mobile startup behavior: root startup, Home, Chats, Dating, Affiche, Map, Profile.
- [ ] Record current chat lifecycle: REST latest page, socket auth, subscribe, sync, outbox, read state.
- [ ] Record current media lifecycle: upload, complete, private download URL, image widgets, prewarm.
- [ ] Keep the old behavior unchanged in this phase.

### Task 2: Lock Scope

**Goal:** убрать лишние идеи до начала реализации.

**Files:**

- Modify only this plan if scope changes.

- [ ] Confirm target: `20k DAU`, `1k concurrent app sessions smoke`, `500 concurrent WebSocket connections smoke`.
- [ ] Confirm first release local-first scope: app cache, chat cache, queued chat sends.
- [ ] Confirm excluded scope: full offline join, payments, upload, moderation, admin operations.
- [ ] Confirm private media rule: no public CDN URL for private chat or story media.
- [ ] Confirm rollout rule: no risky production flag before staging smoke.

---

## Phase 1: Metrics And Load Harness

### Task 3: Add Metrics Foundation

**Goal:** видеть latency, DB pressure, Redis events, WS load, worker lag, S3 cost.

**Files:**

- Create: `backend/packages/database/src/metrics.ts`
- Modify: `backend/packages/database/src/index.ts`
- Modify: `backend/packages/database/package.json`
- Create: `backend/apps/api/src/controllers/metrics.controller.ts`
- Create: `backend/apps/chat/src/metrics.controller.ts`
- Create: `backend/apps/worker/src/metrics.controller.ts`
- Modify: `backend/apps/api/src/app.module.ts`
- Modify: `backend/apps/chat/src/app.module.ts`
- Modify: `backend/apps/worker/src/app.module.ts`
- Modify: `deploy/nginx/frendly.conf`

- [x] Add `prom-client` to `@big-break/database`.
- [x] Create one shared metrics registry.
- [x] Add process metrics.
- [x] Add HTTP request latency histogram.
- [x] Add DB query count and duration metrics.
- [x] Add Redis publish and subscribe counters.
- [x] Add WebSocket connection, send, drop and inbound counters.
- [x] Add worker outbox lag and job duration metrics.
- [x] Add S3 operation count, duration and error metrics.
- [x] Add `/metrics` endpoints for API, chat and worker.
- [x] Block public `/metrics` through nginx.
- [x] Run backend focused tests for API, chat, worker and database packages.
- [x] Commit with message `добавить базовые метрики сервисов`.

### Task 4: Instrument Hot Paths

**Goal:** измерять реальные узкие места до правок.

**Files:**

- Modify: `backend/apps/api/src/main.ts`
- Modify: `backend/apps/api/src/services/prisma.service.ts`
- Modify: `backend/apps/chat/src/prisma.service.ts`
- Modify: `backend/apps/worker/src/prisma.service.ts`
- Modify: `backend/apps/chat/src/chat-server.service.ts`
- Modify: `backend/apps/worker/src/worker.service.ts`
- Modify: `backend/packages/database/src/pubsub.ts`
- Modify: `backend/packages/database/src/s3.ts`

- [x] Record API duration by normalized route, method and status class.
- [x] Record Prisma query count and duration without raw SQL as label.
- [x] Count Redis publish attempts, failures, parse failures and reconnect events.
- [x] Count WebSocket active sockets, authenticated sockets, subscribed rooms, drops and sync requests.
- [x] Record worker pending count, oldest pending age, job duration and permanent failures.
- [x] Record S3 presign, HeadObject, PutObject, GetObject, timeout and error counts.
- [x] Run focused backend tests.
- [x] Commit with message `измерять горячие backend пути`.

### Task 5: Add Observability Stack

**Goal:** собирать метрики вне app containers, не открывая их наружу.

**Files:**

- Create: `deploy/observability/prometheus.yml`
- Create: `deploy/observability/grafana/README.md`
- Create: `deploy/observability/grafana/dashboards/frendly-runtime.json`
- Create: `deploy/observability/grafana/dashboards/frendly-mobile-hot-paths.json`
- Create: `compose.observability.yml`
- Modify: `ai-context/infra.md`

- [x] Scrape API, chat, worker, node, postgres, redis and pgbouncer exporters.
- [x] Add dashboard panels for API p95, DB duration, PgBouncer pool, Redis pubsub, WS drops, worker lag, S3 errors, CPU and heap.
- [x] Document private access rules.
- [x] Run `cd /Users/sergeypolyakov/MyApp && docker compose -f compose.observability.yml config`.
- [x] Commit with message `добавить observability stack`.

### Task 6: Add 20k Smoke Scripts

**Goal:** сделать проверку 20k readiness повторяемой.

**Files:**

- Modify: `backend/scripts/perf-hotpaths.mjs`
- Create: `backend/scripts/perf-20k-smoke.mjs`
- Create: `docs/audits/scale-20k-readiness-template.md`

- [x] Keep existing scenarios: dating, affiche, routes, chat-history, media-head, chat-send, fanout.
- [x] Add startup scenario: `/profile/me`, unread count, Home feed, dating preview, route templates, affiche preview.
- [x] Add map viewport scenario with rounded coordinates.
- [x] Add media scenario with public HEAD, private download-url and repeated same asset request.
- [x] Add report template with p50, p95, p99, error count, outbox lag, DB pool notes, Redis notes, S3 notes.
- [ ] Run a safe local or staging smoke without real tokens committed.
- [x] Commit with message `добавить 20k smoke проверки`.

---

## Phase 2: Local First Foundation

### Task 7: Add Drift Database

**Goal:** дать Flutter persistent store для hot data.

**Files:**

- Modify: `mobile/pubspec.yaml`
- Create: `mobile/lib/app/core/local_cache/app_local_database.dart`
- Create: `mobile/lib/app/core/local_cache/app_cache_policy.dart`
- Create: `mobile/lib/app/core/local_cache/app_cache_key.dart`
- Modify: `mobile/lib/app/core/providers/core_providers.dart`
- Create: `mobile/test/app/core/local_cache/app_local_database_test.dart`

- [ ] Add dependencies: `drift`, `drift_flutter`, `sqlite3_flutter_libs`, `path_provider`, `path`, `build_runner`, `drift_dev`.
- [ ] Create tables: `cache_entries`, `chat_summaries`, `chat_messages`, `sync_cursors`, `pending_commands`.
- [ ] Enable WAL.
- [ ] Open DB on a background executor.
- [ ] Expose `appLocalDatabaseProvider`.
- [ ] Add `appCacheUserScopeProvider` based on current user id.
- [ ] Add cache policies for chat, profile, public profiles, notifications, Tonight, Meetups, Map, Affiche, Dating, route templates, settings.
- [ ] Add stable cache key helpers with sorted query params.
- [ ] Test schema, unique keys, user scoping and key stability.
- [ ] Run `cd /Users/sergeypolyakov/MyApp/mobile && dart run build_runner build --delete-conflicting-outputs`.
- [ ] Run `cd /Users/sergeypolyakov/MyApp/mobile && flutter test test/app/core/local_cache/app_local_database_test.dart`.
- [ ] Commit with message `добавить локальную базу кеша приложения`.

### Task 8: Build Generic Cache Store

**Goal:** покрыть hot screens без большой миграции моделей.

**Files:**

- Create: `mobile/lib/app/core/local_cache/app_local_cache_store.dart`
- Create: `mobile/lib/app/core/local_cache/local_cache_metrics.dart`
- Create: `mobile/test/app/core/local_cache/app_local_cache_store_test.dart`

- [ ] Implement `readFresh`, `readAny`, `write`, `deleteKey`, `deleteNamespace`, `deleteUser`, `pruneExpired`.
- [ ] Store payload as JSON string in current API DTO shape.
- [ ] Return metadata: `fetchedAt`, `staleAt`, `expiresAt`, `isStale`.
- [ ] Coalesce writes by `userId + namespace + cacheKey`.
- [ ] Add metrics hooks: `cache_hit`, `cache_miss`, `cache_stale_hit`, `cache_write_ms`, `cache_read_ms`.
- [ ] Test fresh hit, stale hit, miss, expiration, user isolation and pruning.
- [ ] Run `cd /Users/sergeypolyakov/MyApp/mobile && flutter test test/app/core/local_cache/app_local_cache_store_test.dart`.
- [ ] Commit with message `добавить общий store локального кеша`.

### Task 9: Add LocalFirstRepository

**Goal:** дать providers единый способ вернуть кеш сразу и обновить сетью фоном.

**Files:**

- Create: `mobile/lib/app/core/local_cache/local_first_repository.dart`
- Modify: `mobile/lib/shared/data/backend_repository.dart`
- Modify: `mobile/lib/app/core/providers/core_providers.dart`
- Create: `mobile/test/app/core/local_cache/local_first_repository_test.dart`

- [ ] Add wrapper with `namespace`, `cacheKey`, `policy`, `networkFetch`, `fromJsonList` or typed mapper.
- [ ] Return cached data immediately when present.
- [ ] Start background refresh after cached response.
- [ ] Write fresh network response to DB.
- [ ] Keep cached data on network failure when cache exists.
- [ ] Preserve current error behavior when cache is empty.
- [ ] Add `forceRefresh` for pull to refresh.
- [ ] Keep Dio GET dedupe in place.
- [ ] Test cache first, refresh success, refresh failure, empty cache error and force refresh.
- [ ] Run `cd /Users/sergeypolyakov/MyApp/mobile && flutter test test/app/core/local_cache/local_first_repository_test.dart`.
- [ ] Commit with message `добавить local first repository`.

### Task 10: Add Flags, Cleanup And Kill Switch

**Goal:** local-first можно быстро выключить без удаления кода.

**Files:**

- Modify: `mobile/lib/app/core/config/backend_config.dart`
- Modify: `mobile/lib/app/core/providers/core_providers.dart`
- Modify: `mobile/lib/app/session/app_session_controller.dart`
- Modify: `mobile/lib/app/core/local_cache/app_local_cache_store.dart`
- Modify: `mobile/lib/app/core/local_cache/chat_local_store.dart`
- Modify: `mobile/lib/app/core/device/app_attachment_service.dart`
- Modify: `mobile/test/shared/data/app_providers_test.dart`
- Modify: `mobile/test/app/core/local_cache/app_local_cache_store_test.dart`

- [ ] Add `BIG_BREAK_LOCAL_FIRST_CACHE` dart define.
- [ ] Enable local-first by default in debug and profile.
- [ ] Make release configurable.
- [ ] Add DB open failure kill switch that falls back to current network-first behavior.
- [ ] Run cache cleanup after auth restore.
- [ ] Run user-scoped cleanup on logout.
- [ ] Clear private attachment cache and signed URL cache on logout.
- [ ] Track cache hit rate, stale hit rate, refresh failures, DB read p95 and DB size estimate.
- [ ] Test enabled path, disabled path and DB failure fallback.
- [ ] Commit with message `добавить флаг и очистку local first кеша`.

---

## Phase 3: Chat Local First And Realtime

### Task 11: Move Chat Outbox To DB

**Goal:** pending chat commands survive restart and reconnect.

**Files:**

- Modify: `mobile/lib/app/core/network/chat_socket_client.dart`
- Modify: `mobile/lib/app/core/providers/core_providers.dart`
- Modify: `mobile/lib/app/session/app_session_controller.dart`
- Modify: `mobile/test/app/core/network/chat_socket_client_test.dart`

- [ ] Add `DriftChatOutboxStorage` implementing current `ChatOutboxStorage`.
- [ ] Migrate existing `chat.outbox.commands` from `SharedPreferences` to `pending_commands`.
- [ ] Preserve current dedupe behavior.
- [ ] Clear DB outbox on logout.
- [ ] Test pending `message.send` survives client recreation.
- [ ] Test duplicate dedupe keys do not create duplicate commands.
- [ ] Run `cd /Users/sergeypolyakov/MyApp/mobile && flutter test test/app/core/network/chat_socket_client_test.dart`.
- [ ] Commit with message `перенести очередь чата в локальную базу`.

### Task 12: Add Structured Chat Store

**Goal:** открыть chat list и thread из локальных данных, затем догнать сетью.

**Files:**

- Create: `mobile/lib/app/core/local_cache/chat_local_store.dart`
- Modify: `mobile/lib/features/chats/presentation/chat_thread_providers.dart`
- Modify: `mobile/lib/shared/data/app_providers.dart`
- Create: `mobile/test/app/core/local_cache/chat_local_store_test.dart`
- Modify: `mobile/test/features/chats/presentation/chat_thread_providers_test.dart`

- [ ] Store meetup, personal and community chat summaries in `chat_summaries`.
- [ ] Store recent messages in `chat_messages`.
- [ ] Merge messages by `messageId` and `clientMessageId`.
- [ ] Preserve pending messages across restart.
- [ ] Patch summaries on `message.created`, `unread.updated`, `typing.changed`, `chat.updated`.
- [ ] On thread open, render local messages first.
- [ ] Then fetch REST latest page.
- [ ] Then request socket sync from stored cursor.
- [ ] On `sync.snapshot reset=true`, reload REST latest page and replace recent window for that chat.
- [ ] Test local-first load, pending ack, delete event, read event and reset snapshot.
- [ ] Run chat local store tests and chat thread provider tests.
- [ ] Commit with message `добавить локальный store для чатов`.

### Task 13: Keep Realtime Scalable

**Goal:** chat stays reliable when there are multiple chat instances.

**Files:**

- Modify: `backend/apps/chat/src/chat-server.service.ts`
- Modify: `backend/packages/database/src/pubsub.ts`
- Modify: `ai-context/realtime-chat.md`

- [x] Keep Redis channel `big-break:events` as pubsub bus.
- [x] Keep reconnect plus `sync.request` as source of truth.
- [x] Add metrics for membership cache hit and miss.
- [x] Add metrics for payload over warning threshold.
- [x] Add metrics for dropped send due to `bufferedAmount`.
- [x] Verify `sync.snapshot reset=true` remains handled by mobile.
- [x] Run chat unit and realtime tests.
- [ ] Commit with message `укрепить realtime sync для scale`.

---

## Phase 4: Local First Hot Screens

### Task 14: Wire Core Providers

**Goal:** основные экраны открываются из кеша без ожидания сети.

**Files:**

- Modify: `mobile/lib/shared/data/app_providers.dart`
- Modify: `mobile/lib/features/dating/presentation/dating_providers.dart`
- Modify: `mobile/test/shared/data/app_providers_test.dart`

- [x] Convert `eventsProvider` to local-first with location-scoped cache keys.
- [x] Convert `mapEventsProvider` to local-first with rounded bounds in cache key.
- [x] Convert `afficheEventsProvider` and first page to local-first.
- [x] Convert `eveningRouteTemplatesProvider` to local-first by city.
- [x] Convert `notificationsProvider` and unread count to local-first.
- [x] Convert `profileProvider`, public profile providers, onboarding and settings to local-first.
- [x] Convert `datingDiscoverProvider`, `datingHomePreviewProvider` and `datingLikesProvider` to local-first.
- [x] Add dating tombstones for like, skip, super-like and match open.
- [x] Keep Dating full screen fallback to People only where it already exists.
- [x] Do not bring People fallback into Home dating preview.
- [x] Test warm providers return cache without waiting for network.
- [x] Test network errors keep cached values.
- [x] Run `cd /Users/sergeypolyakov/MyApp/mobile && flutter test test/shared/data/app_providers_test.dart`.
- [ ] Commit with message `подключить local first кеш к горячим экранам`.

### Task 15: Preserve UI During Background Refresh

**Goal:** refresh не ломает экран, когда кеш уже есть.

**Files:**

- Modify: `mobile/lib/features/chats/presentation/chats_screen.dart`
- Modify: `mobile/lib/features/tonight/presentation/tonight_screen.dart`
- Modify: `mobile/lib/features/affiche/presentation/affiche_events_screen.dart`
- Modify: `mobile/lib/features/dating/presentation/dating_screen.dart`
- Modify: `mobile/lib/features/meetups/presentation/meetups_screen.dart`
- Test: `mobile/test/features/parity/`

- [x] Keep current loaders when cache is empty.
- [x] Suppress fullscreen loader when cached data exists.
- [x] Keep scroll position after background refresh.
- [x] Use stable keys for rows.
- [x] Keep pull to refresh as explicit force refresh.
- [x] Show compact error only after direct user action.
- [x] Verify chat swipe delete, long press, pin, unread and segment filters.
- [x] Verify dating actions advance locally and roll back on API error.
- [x] Run parity tests for people, chats, detail chat and profile.
- [ ] Commit with message `сохранить UX при фоновом обновлении кеша`.

---

## Phase 5: Media Speed

### Task 16: Improve Media Variants And Prewarm

**Goal:** повторно открытые аватарки, фото, chat images и Affiche cards появляются быстро.

**Files:**

- Modify: `mobile/lib/shared/widgets/bb_avatar.dart`
- Modify: `mobile/lib/shared/widgets/bb_external_event_image.dart`
- Modify: `mobile/lib/shared/widgets/bb_profile_photo_image.dart`
- Modify: `mobile/lib/app/core/device/app_media_prewarm_service.dart`
- Modify: `mobile/lib/features/tonight/presentation/tonight_screen.dart`
- Modify: `mobile/lib/features/dating/presentation/dating_screen.dart`
- Modify: `mobile/lib/features/chats/presentation/chats_screen.dart`
- Modify: `mobile/test/shared/widgets/bb_profile_photo_image_test.dart`
- Modify: `mobile/test/shared/widgets/bb_chat_attachment_image_test.dart`

- [x] Use profile `bestUrlFor` wherever profile photo is rendered.
- [x] Use Affiche `imageUrlFor` wherever external event image is rendered.
- [x] Keep avatar cache keys size-scoped.
- [x] Prewarm only first 10 chat avatars.
- [x] Prewarm only first 6 Tonight cards.
- [x] Prewarm only next 3 Dating cards.
- [x] Prewarm only first 8 Affiche images.
- [x] Cap prewarm concurrency at `2` for cellular-like behavior and `3` for Wi-Fi-like behavior when network type is available.
- [x] Never prewarm full lists.
- [x] Run image widget tests.
- [ ] Commit with message `ускорить media variants и prewarm`.

### Task 17: Keep Private Media Fast And Safe

**Goal:** private media stays protected, while repeat opens avoid duplicate signed URL calls.

**Files:**

- Modify: `mobile/lib/app/core/device/app_attachment_service.dart`
- Modify: `backend/apps/api/src/controllers/media.controller.ts`
- Modify: `backend/apps/api/src/services/media.service.ts`
- Modify: `backend/apps/api/test/unit/media.service.unit.spec.ts`

- [x] Keep signed download URL coalescing in `AppAttachmentService`.
- [x] Keep four minute local TTL by `downloadUrlPath` or media asset id.
- [x] Clear signed URL cache on logout.
- [x] Reuse existing `ETag` and `Last-Modified` behavior for `GET /media/:assetId`.
- [x] Ensure private media checks still run before private access.
- [x] Test normal response, `304`, stale `200` and private authorization.
- [ ] Commit with message `ускорить приватные media повторы без ослабления доступа`.

---

## Phase 6: Backend Scale And Data Flags

### Task 18: Add Scale Compose

**Goal:** подготовить несколько API, chat и worker instances без удаления текущего production compose.

**Files:**

- Create: `compose.scale.yml`
- Create: `deploy/nginx/frendly.scale.conf`
- Modify: `.env.production.example`
- Modify: `scripts/deploy.sh`
- Modify: `ai-context/infra.md`

- [x] Keep `compose.prod.yml` stable.
- [x] Add `api_a` and `api_b`.
- [x] Add `chat_a` and `chat_b`.
- [x] Add worker roles: `worker_realtime`, `worker_content`, `worker_schedules`.
- [x] Route scale nginx `api_backend` to both API services.
- [x] Route scale nginx `chat_backend` to both chat services.
- [x] Keep `/ws` unbuffered with long timeouts.
- [x] Add optional deploy env `COMPOSE_EXTRA_FILES`.
- [x] Run `cd /Users/sergeypolyakov/MyApp && docker compose --env-file .env.production.example -f compose.prod.yml -f compose.scale.yml config`.
- [x] Commit with message `подготовить scale compose`.

### Task 19: Add Worker Role Gates

**Goal:** split workers without duplicate content import, schedules or outbox loops.

**Files:**

- Modify: `backend/apps/worker/src/worker.service.ts`
- Modify: `backend/apps/worker/test/unit/worker.service.spec.ts`
- Modify: `ai-context/infra.md`

- [x] Add `WORKER_OUTBOX_ENABLED`, `WORKER_CONTENT_ENABLED`, `WORKER_SCHEDULES_ENABLED`.
- [x] Default all three to `true`.
- [x] Skip outbox timer when outbox flag is false.
- [x] Skip content import, manual import, route generation and image backfill when content flag is false.
- [x] Skip system notifications, evening auto advance and retention cleanup when schedules flag is false.
- [x] Test defaults and each disabled role.
- [x] Run `cd /Users/sergeypolyakov/MyApp/backend && pnpm --filter @big-break/worker test`.
- [x] Commit with message `разделить роли worker`.

### Task 20: Roll Out DB And Worker Fast Paths

**Goal:** включить уже подготовленные быстрые пути только после проверки данных.

**Files:**

- Modify: `.env.production.example`
- Modify: `compose.prod.yml`
- Modify: `ai-context/database.md`
- Modify: `ai-context/infra.md`

- [x] Run `cd /Users/sergeypolyakov/MyApp/backend && pnpm --filter @big-break/database db:indexes:hot-path`.
- [x] Run `cd /Users/sergeypolyakov/MyApp/backend && pnpm --filter @big-break/database db:verify:chat-unread`.
- [x] If needed, run chat unread backfill and verify again.
- [ ] Enable `CHAT_UNREAD_COUNTER_READS=true` only after clean verify.
- [ ] Run `cd /Users/sergeypolyakov/MyApp/backend && pnpm --filter @big-break/database db:postgis:event-geo`.
- [ ] Enable `ENABLE_POSTGIS_EVENT_FEED=true` only after map and event feed QA.
- [ ] Enable `WORKER_OUTBOX_BATCH_CLAIM=true` in staging first.
- [ ] Watch duplicate processing, failed jobs, oldest pending age, unread correctness and push delivery failures.
- [ ] Tune PgBouncer only after `SHOW POOLS` and `SHOW STATS`.
- [ ] Commit env examples only after behavior is proven.

---

## Phase 7: Backend Hot Path Fixes After Metrics

### Task 21: Review Measured Slow Endpoints

**Goal:** править только то, что реально видно в метриках.

**Files:**

- Modify only measured slow files, usually:
  - `backend/apps/api/src/services/events.service.ts`
  - `backend/apps/api/src/services/dating.service.ts`
  - `backend/apps/api/src/services/chats.service.ts`
  - `backend/apps/api/src/services/search.service.ts`
  - `backend/apps/api/src/services/media.service.ts`
  - `backend/apps/chat/src/chat-server.service.ts`
  - `backend/apps/worker/src/worker.service.ts`

- [ ] Rank endpoints by p95, p99, query count and error rate.
- [ ] Start with `/events`, `/dating/discover`, `/chats/meetups`, `/chats/personal`, `/chats/:chatId/messages`, `/search`, `/media/:assetId`, `/uploads/media/complete`, `/affiche/events`, `/evening/route-templates`.
- [ ] Inspect where clauses, orderBy, cursor, selected fields and nested includes.
- [ ] Check that list endpoints do not do hidden social preview fanout.
- [ ] Work one hot path per PR or commit.
- [ ] Add a failing test or measured baseline before the change.
- [ ] Keep API response shape unless the contract update is explicit.
- [ ] Run focused service tests and `pnpm --filter @big-break/api build`.
- [ ] Commit each endpoint fix with a specific Russian message.

### Task 22: Add Conditional GET Where It Pays

**Goal:** уменьшить повторные backend reads для горячих ответов.

**Files:**

- Modify: `backend/apps/api/src/controllers/chats.controller.ts`
- Modify: `backend/apps/api/src/services/chats.service.ts`
- Modify: `backend/apps/api/src/controllers/media.controller.ts`
- Modify: `backend/apps/api/src/services/media.service.ts`
- Modify: `backend/apps/api/test/unit/chats.service.unit.spec.ts`
- Modify: `backend/apps/api/test/unit/media.service.unit.spec.ts`

- [x] Keep response bodies compatible.
- [x] Add optional `ETag` and `If-None-Match` handling for chat list endpoints.
- [x] Reuse existing media `ETag` behavior.
- [x] Return `304` with empty body when the tag matches.
- [x] Do not require new client headers in this phase.
- [x] Test normal response, matching `304`, stale `200` and private media authorization.
- [x] Run `cd /Users/sergeypolyakov/MyApp/backend && pnpm --filter @big-break/api test:unit -- chats.service.unit.spec.ts media.service.unit.spec.ts`.
- [x] Commit with message `добавить условное обновление горячих ответов`.

---

## Phase 8: Rollout And QA

### Task 23: Staging Rollout

**Goal:** включать части системы в порядке риска.

**Files:**

- Modify deployment env outside repo.
- Modify repo env examples only after behavior is proven.

- [ ] Deploy metrics endpoints and private scrape config.
- [ ] Watch one real QA session or 24 hours.
- [ ] Enable local-first cache in debug and profile QA.
- [ ] QA warm restart, airplane mode after cached data, logout and second user login.
- [ ] Enable worker batch claim in staging.
- [ ] Enable unread counters after verify.
- [ ] Enable PostGIS event feed after map QA.
- [ ] Enable scale compose with 2 API, 2 chat and split workers.
- [ ] Run load smoke against staging or production-safe accounts.
- [ ] Record results in `docs/audits/2026-05-14-scale-local-first-performance-report.md`.

### Task 24: Acceptance QA

**Goal:** доказать, что скорость выросла, а поведение не сломалось.

**Files:**

- Create: `docs/audits/2026-05-14-scale-local-first-performance-report.md`

- [x] Check backend health through `curl -i https://api.frendly.tech/health`.
- [ ] Launch cold on iOS simulator or QA device.
- [ ] Login with test account.
- [ ] Open Home first frame.
- [ ] Open map and pan map.
- [ ] Open dating and swipe like.
- [ ] Open chats.
- [ ] Send direct text.
- [ ] Send meetup text.
- [ ] Send photo.
- [ ] Relaunch app.
- [ ] Reopen photo.
- [ ] Play voice.
- [ ] Create meetup.
- [ ] Join meetup from second account.
- [ ] Switch to airplane mode after data is cached.
- [ ] Read cached chats and hot screens.
- [ ] Send chat message offline, then reconnect.
- [ ] Logout and login as another user.
- [ ] Confirm old user's cached data is not visible.
- [ ] Record API p95, chat ack p95, outbox lag, WS connection count, Redis pubsub rate, DB pool wait and S3 errors.

### Task 25: Documentation And Graph

**Goal:** будущий агент должен понимать новую архитектуру без угадываний.

**Files:**

- Modify: `ai-context/frontend-flutter.md`
- Modify: `ai-context/realtime-chat.md`
- Modify: `ai-context/backend-api.md`
- Modify: `ai-context/infra.md`
- Modify: `ai-context/database.md`
- Modify: `project_map.md` only if new top-level files need mention.

- [ ] Update Flutter context when local-first behavior is implemented.
- [ ] Update realtime context when chat scale behavior is implemented.
- [ ] Update backend context when conditional GET or endpoint contracts change.
- [ ] Update infra context when compose, observability, worker roles or rollout flags change.
- [ ] Update database context when DB rollout commands or indexes change.
- [x] Run `cd /Users/sergeypolyakov/MyApp && bash scripts/update-understand-graph.sh`.
- [ ] Commit with message `обновить контекст после scale local first работ`.

---

## Rollout Order

1. Metrics foundation and hot path instrumentation.
2. Observability stack and 20k smoke scripts.
3. Drift DB, generic cache store and feature flag.
4. Chat outbox and structured chat local store.
5. Core hot providers: profile, notifications, Home, Tonight, Meetups, Affiche, Map, Dating, route templates.
6. UI refresh behavior without fullscreen loader when cache exists.
7. Media variants, prewarm and private signed URL reuse.
8. Conditional GET for hot backend responses.
9. Scale compose and worker role gates.
10. DB fast path flags: unread counters, PostGIS feed, worker batch claim.
11. Measured backend hot path fixes.
12. Staging rollout, load smoke, acceptance QA.
13. `ai-context` updates and graph update.

---

## Risk Checklist

- Cached data from another user: blocked by user-scoped rows and logout cleanup.
- Fullscreen loader on warm screen: blocked by local-first provider behavior.
- Scroll jump after refresh: blocked by stable row keys and diff-style updates.
- Duplicate messages: blocked by `messageId` plus `clientMessageId` merge.
- Pending message lost after restart: blocked by DB outbox.
- Dating shows already handled profile: blocked by dating tombstones.
- Wrong city shown as fresh: blocked by city, radius, rounded coordinates or map bounds in cache key.
- Local DB grows forever: blocked by expiration, pruning and 500 recent messages per chat.
- Weak device slows on JSON: blocked by background DB executor and bounded first pages.
- Private media leaks: blocked by existing membership checks and signed URL path.
- CDN invalidation breaks photos: blocked by stable media asset ids and versioned cache keys.
- Metrics leak personal data: blocked by low-cardinality labels without user id, chat id, message id, token, media URL, object key, phone, email or payload.
- Worker duplicates jobs after role split: blocked by role gates and outbox claim tests.
- Multiple chat instances lose events: blocked by Redis pubsub plus reconnect sync.
- Production flag breaks users: blocked by staging smoke and release kill switches.

---

## Do Not Do

- Do not migrate to Kubernetes in this plan.
- Do not replace Redis pubsub with Streams unless measured incidents prove the need.
- Do not remove WebSocket sync fallback.
- Do not make private media public for CDN hit ratio.
- Do not move push, unread fanout or S3 finalize back into request hot paths.
- Do not add one social or profile request per visible list item.
- Do not turn on broad media prefetch.
- Do not start hidden root providers for chats, people, settings or map feeds.
- Do not ship scale flags directly to production before staging smoke.
- Do not rewrite API DTOs just to fit the cache.

---

## Final Verification Commands

Run after implementation:

```bash
cd /Users/sergeypolyakov/MyApp/backend && pnpm --filter @big-break/api test:unit
cd /Users/sergeypolyakov/MyApp/backend && pnpm --filter @big-break/api build
cd /Users/sergeypolyakov/MyApp/backend && pnpm --filter @big-break/chat test
cd /Users/sergeypolyakov/MyApp/backend && pnpm --filter @big-break/worker test
cd /Users/sergeypolyakov/MyApp/backend && pnpm --filter @big-break/database test:unit
cd /Users/sergeypolyakov/MyApp/mobile && flutter analyze
cd /Users/sergeypolyakov/MyApp/mobile && flutter test
cd /Users/sergeypolyakov/MyApp && docker compose --env-file .env.production.example -f compose.prod.yml config
cd /Users/sergeypolyakov/MyApp && docker compose --env-file .env.production.example -f compose.prod.yml -f compose.scale.yml config
cd /Users/sergeypolyakov/MyApp && docker compose -f compose.observability.yml config
cd /Users/sergeypolyakov/MyApp && bash scripts/update-understand-graph.sh
```
