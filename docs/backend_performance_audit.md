# Backend performance audit

Дата аудита: 2026-05-05.

Scope: `backend/`, deploy configs, Prisma schema, worker, chat server, S3 helpers, Redis pub/sub helper, root project maps. Production secrets не читались. Billing, реальные p95/p99, PgBouncer stats, PostgreSQL EXPLAIN ANALYZE и S3 billing недоступны.

## Executive summary

1. P0 проблем, которые можно честно подтвердить только по коду, не найдено. Есть несколько P1 production risk: тяжёлый runtime Docker image, отключённый batch claim outbox в production example, частый DB auth check на каждом API request, отсутствие метрик по горячим путям.
2. Самые рискованные endpoints: `GET /search`, `GET /chats/meetups`, `POST /uploads/media/file`, `POST /uploads/media/complete`, `GET /profile/me`, `GET /posters`.
3. Самые рискованные Prisma места: `AuthGuard` делает `Session.findUnique` на каждый authenticated request, `ChatsService.listChats` может уходить в тяжёлый unread fallback, `SearchService.groupedSearch` запускает 5 веток поиска, `ProfileService.getProfile` грузит все photos.
4. Самые рискованные Redis/WebSocket места: Redis pub/sub at-most-once без retry/error policy, ws server без метрик backpressure, DB block lookup на broadcast, до правки не было heartbeat cleanup.
5. Самые рискованные worker места: production example отключает `FOR UPDATE SKIP LOCKED` batch claim, push отправляется по токенам без provider batching, нет cleanup invalid push tokens, media finalize job есть, но upload flows часто завершают media синхронно.
6. Наибольшая экономия вероятна от direct-to-S3 как основного mobile flow, включения batch outbox claim после staging проверки, уменьшения repeated DB queries в search/chat, observability по payload size и query count.
7. Flutter быстрее всего выиграет от лёгкого bootstrap/search, меньших chat list payloads, direct media URL/CDN cache, стабильного ws reconnect, cursor pagination без лишних includes.
8. Не удалось проверить production latency, DB query plans, PgBouncer pool usage, Redis message rate, S3 egress и cost. Нет доступа к production metrics.
9. Вручную нужно проверить EXPLAIN для listed SQL, PgBouncer stats, nginx bandwidth, S3 operation count, mobile startup waterfall.

## Main findings

| № | Проблема | Где найдено | Почему это плохо | Риск | Ожидаемый эффект | Сложность | Приоритет | Что исправить | Как проверить |
|---|----------|-------------|------------------|------|------------------|-----------|-----------|----------------|--------------|
| 1 | Docker install был не frozen | `backend/Dockerfile` | Build мог брать другой dependency graph, image трудно повторить | Medium | Стабильнее deploy, меньше drift | Low | P1 | Скопировать lockfile, использовать `pnpm install --frozen-lockfile` | `docker compose -f compose.yaml build api` |
| 2 | Runtime image всё ещё dev-heavy | `backend/Dockerfile` | `ts-node` runtime, dev deps, root user, один слой с исходниками | Medium | Меньше image size, RAM, cold start | Medium | P1 | Multi-stage build, dist runtime, non-root user | `docker history`, `docker images`, smoke start |
| 3 | Нет shutdown hooks | `apps/api/src/main.ts`, `apps/chat/src/main.ts`, `apps/worker/src/main.ts` | SIGTERM может обрывать Prisma/Redis/ws без lifecycle cleanup | Medium | Меньше оборванных jobs и ws leaks при deploy | Low | P1 | `app.enableShutdownHooks()` | Запустить app, отправить SIGTERM, проверить clean exit |
| 4 | Auth DB check на каждый API request | `apps/api/src/auth.guard.ts` | Every authenticated endpoint делает `session.findUnique` | Medium | Меньше DB QPS на mobile flows | Medium | P1 | Короткий session cache 10-30s с revocation review | Security review, request query count |
| 5 | `/search` фан-аутит 5 flows | `apps/api/src/services/search.service.ts` | Один mobile search запускает events, after-dark, routes, posters, affiche | Medium | Меньше DB QPS, быстрее search | Medium | P1 | Request-level cache для blocks/unlock/profile, бюджет query count | Supertest плюс Prisma query logging |
| 6 | Chat unread fallback тяжёлый | `apps/api/src/services/chats.service.ts`, `.env.production.example` | `CHAT_UNREAD_COUNTER_READS=false` ведёт к raw count по messages | Medium | Меньше нагрузка на Message/Notification | Low | P1 | Включать counters после `db:chat-unread:verify` | Сравнить unread counts, EXPLAIN raw query |
| 7 | Production example отключает batch claim | `compose.prod.yml`, `.env.production.example`, `worker.service.ts` | Worker может claim events по одному без `SKIP LOCKED` | High | Меньше polling overhead, выше throughput | Low | P1 | `WORKER_OUTBOX_BATCH_CLAIM=true` после staging run | Worker test, outbox lag, duplicate processing |
| 8 | WS не чистил stale sockets | `apps/chat/src/chat-server.service.ts` | Half-open mobile sockets могли висеть в Maps/Sets | Medium | Меньше memory leak, стабильнее reconnect | Low | P1 | Heartbeat ping/pong cleanup | Unit test, manual ws disconnect |
| 9 | Push logs раскрывали token | `apps/worker/src/push.providers.ts` | Token мог попасть в logs volume и observability | Medium | Меньше sensitive log risk, меньше log noise | Low | P1 | Mask token in provider logs | Unit test |
| 10 | APNS всегда sandbox | `apps/worker/src/push.providers.ts` | `production: false` мог ломать iOS prod delivery | High | Стабильнее push | Low | P1 | Добавлен env `APNS_PRODUCTION`, default остаётся sandbox | Push test на sandbox/prod cert |
| 11 | S3 presign создавал client на каждый call | `packages/database/src/s3.ts`, `StoriesService.mapStory` | Story/media list мог создавать много S3 clients | Medium | Меньше CPU/GC overhead | Low | P1 | Reuse public presign S3 client | Unit/build, story list smoke |
| 12 | Upload proxy гонит bytes через API | `uploads.controller.ts`, `uploads.service.ts`, `profile.service.ts` | API CPU/RAM/bandwidth растут от media upload | Medium | Меньше egress через API, ниже latency | Medium | P1 | Direct upload как основной mobile path, proxy only fallback | Upload metrics, nginx/API bandwidth |
| 13 | Media finalize часто синхронный | `uploads.service.ts`, `profile.service.ts`, `stories.service.ts`, `worker.service.ts` | `HeadObject` и DB finalize в HTTP path | Medium | Быстрее upload complete | Medium | P1 | Outbox finalize для mobile media, idempotent status | API latency, worker lag |
| 14 | Нет базовой metrics plane | API/chat/worker modules | Нельзя доказать p95, DB count, Redis rate, cost per request | High | Быстрее диагностика, меньше blind tuning | Medium | P1 | Prometheus/OpenTelemetry минимум | `/metrics`, dashboards |
| 15 | PgBouncer directUrl не закреплён в schema | `schema.prisma`, compose prod env | Prisma CLI зависит от правильного `DATABASE_URL` при migrations | Medium | Меньше риска миграций через pool | Low | P1 | Добавить `directUrl` только после env review | `prisma validate`, migrate dry run |
| 16 | Dependency audit нашёл high vulnerabilities | `pnpm audit`, mainly `apn@2.2.0` transitive deps | `jsonwebtoken@8.5.1`, `node-forge@0.7.6` и другие transitive packages уязвимы | High | Меньше security/stability risk | Medium | P1 | Review APNS library replacement or override strategy | `pnpm audit`, provider smoke tests |
| 17 | Redis pub/sub payload size был невидим | `packages/database/src/pubsub.ts` | Большие realtime events могли незаметно раздувать Redis/network | Medium | Ранний сигнал по дорогим событиям без смены delivery semantics | Low | P1 | Добавлен warning threshold без логирования payload | Publish synthetic large event in staging |
| 18 | S3 calls были без app-level timeout | `uploads.service.ts`, `profile.service.ts`, `media.service.ts`, `worker.service.ts` | Hanging S3 request мог держать HTTP request или worker job | Medium | Быстрее failure, меньше stuck handles | Low | P1 | Добавлен общий `S3_REQUEST_TIMEOUT_MS` через abort signal | Simulate slow S3 endpoint in staging |
| 19 | After Dark hot paths считали preview count | `after-dark.service.ts` | `assertUnlocked` делал `Event.count` на list/detail/join, хотя count нужен access screen | Medium | Меньше DB count queries в `/search` и After Dark endpoints | Low | P1 | Count оставлен только для `getAccess`/`unlock` response | Prisma query log for `/search` |
| 20 | Prod compose default включает test phone shortcuts | `compose.prod.yml`, api service env | `ENABLE_TEST_PHONE_SHORTCUTS` default is `true` in production compose | High | Security/auth risk, can also pollute auth metrics | Low | P0 review | Do not change automatically, requires auth/security review | Review env policy before deploy |
| 21 | Chat message reads грузили full sender/mediaAsset | `chats.service.ts`, `chat-server.service.ts`, `presenters.ts` | Chat list, messages, ws send path брали целые User и MediaAsset rows | Medium | Меньше DB payload, меньше JSON allocation | Low | P1 | Уже сужено до `select` полей, которые реально нужны presenter'ам | Chat list/message smoke, TypeScript build |
| 22 | Event join/invite flows грузили широкие rows | `events.service.ts` | Join/request/invite paths брали Event/EventJoinRequest шире нужного | Medium | Меньше DB payload на mutation paths | Low | P1 | Уже сужено до host/gender/join/chat/status fields | Join/request/invite smoke |
| 23 | Notifications list брала full Notification row | `notifications.service.ts` | Лишние поля уходили из DB в Node на горячем notification list | Low/medium | Меньше DB payload и memory | Low | P2 | Уже добавлен `select` под response DTO | Notifications smoke |
| 24 | Worker auto advance и push token reads были широкими | `worker.service.ts` | Auto advance грузил full route steps, push dispatch full PushToken rows | Medium | Меньше DB payload в scheduled worker jobs | Low | P1 | Уже сужены route steps и push token fields | Worker staging run |
| 25 | Server-side S3 uploads не задавали cache metadata | `profile.service.ts`, `uploads.service.ts` | CDN/browser не получали явную cache policy от object metadata | Medium | Меньше повторный egress для avatars, безопасный private cache для chat/story | Low | P1 | Avatar uploads получили public immutable, chat/story получили private max-age 300 | Header check on S3 object response |
| 26 | `x-request-id` принимался без лимита | `request-context.middleware.ts` | Длинный или грязный header мог попасть в логи и response | Low/medium | Меньше log noise и риск header abuse | Low | P2 | Ограничить request id до безопасного набора символов и 128 chars | Header smoke |
| 27 | Production compose не закреплял `NODE_ENV=production` | `compose.prod.yml`, `profile.service.ts` | Profile file upload мог включить dev bypass, потому что `NODE_ENV` был не задан явно | High | S3 path для production profile uploads становится явным | Low | P1 | Добавить `NODE_ENV: production` в production services | `docker compose config`, profile upload smoke |
| 28 | Host flows читали лишние поля | `host.service.ts` | Approve/reject/check-in paths брали full Notification/EventParticipant/Attendance rows | Low/medium | Меньше DB payload в host moderation actions | Low | P2 | Сужены notification create и check-in selects | Host approve/reject/check-in smoke |
| 29 | Evening publish/request flows читали лишние поля | `evening.service.ts` | Route publish message и request notifications брали широкие relation rows | Medium | Меньше DB payload в evening flows и меньше allocations для realtime payload | Low | P1 | Сужены message and notification selects | Evening publish/request smoke |
| 30 | Community list/detail читали full Community and relation rows | `communities.service.ts` | Mapper needs fixed Community fields and bounded previews, not every root/relation column | Medium | Меньше DB payload для community list/detail and media pages | Low | P1 | Root and relations переведены на response-shaped `select` | Community list/detail/media smoke |
| 31 | Public share тянул full Event and EveningSession graphs | `shares.service.ts` | Public link endpoint мог читать весь Event/Route/Session record для небольшого preview | Medium | Меньше DB payload and memory на public share traffic | Low | P1 | Public share query переведён на explicit nested `select` | Public event/evening share smoke |
| 32 | Safety actions читали и возвращали full rows после mutations | `safety.service.ts` | Report, block and SOS flows возвращали полные records, хотя ответ использует few fields | Low/medium | Меньше DB payload and lower accidental sensitive field exposure | Low | P2 | Create/upsert queries now select response fields only | Safety report/block/SOS smoke |
| 33 | Live/check-in event reads были широкими | `events.service.ts` | Live, check-in, after-party and feedback read full Event rows | Medium | Меньше DB payload на mobile live screens | Low | P1 | Event queries now select only fields used by response | Live/check-in/after-party smoke |
| 34 | AI route candidate API читал лишние venue/offer fields | `evening-route-ai-candidates.service.ts` | Candidate selection loaded all Venue and Offer columns before prompt filtering | Low/medium | Меньше DB payload для route generation support path | Low | P2 | Venue and offers queries now use explicit select | Route candidate generation smoke |
| 35 | After Dark list/detail читали full Event rows | `after-dark.service.ts` | `/search` After Dark branch and detail path loaded many unused Event columns | Medium | Меньше DB payload в `/search` and After Dark screens | Low | P1 | List/detail queries now select only mapper fields | `/search` and After Dark detail smoke |
| 36 | Host dashboard/detail читали full Event rows | `host.service.ts`, `presenters.ts` | Host mobile/admin dashboard only needs event summary fields, but Prisma returned whole Event row | Medium | Меньше DB payload for hosted event dashboard and detail | Low | P1 | Presenter type narrowed, host event queries use summary select | Host dashboard/detail smoke |
| 37 | Chat list читал full Chat and ChatMember rows | `chats.service.ts` | Preview needs summary Chat fields, relation previews and `userId`, not every Chat/ChatMember column | Medium | Меньше DB payload for `/chats/meetups` and `/chats/personal` | Low | P1 | Chat list query now uses response-shaped `select` | Chat list smoke |
| 38 | Event feed читал full Event rows | `events.service.ts`, `presenters.ts` | `GET /events` maps summary but query loaded full Event rows and full participant rows | High | Меньше DB payload on home/feed/search meetup group | Low | P1 | Event list query now uses summary `select` plus bounded participant preview | Event list/search smoke |
| 39 | Event detail читал full Event row | `events.service.ts` | Detail response uses summary fields, description, partner fields and bounded relations, but query returned all Event columns | Medium | Меньше DB payload on details page | Low | P1 | Detail query now uses summary select plus detail fields | Event detail smoke |
| 40 | Poster list/detail читал full Poster rows | `posters.service.ts` | Poster mapper uses fixed public fields, but query loaded all Poster columns | Medium | Меньше DB payload for `/posters` and `/search` poster group | Low | P1 | Poster queries now use response-shaped `select` | Poster list/detail smoke |
| 41 | Evening session participants читались full rows | `evening.service.ts` | Session mapper uses participant `userId`, `role`, `status` and name only | Medium | Меньше DB payload for evening session list/detail | Low | P1 | Session participant relation now uses `select` | Evening sessions smoke |
| 42 | Evening join request flows читали full request rows | `evening.service.ts` | Request/create/approve paths use request id/status/user only | Low/medium | Меньше DB payload in evening join moderation | Low | P2 | Join request reads and writes now use narrow `select` | Evening request/approve smoke |
| 43 | Evening step action endpoints читали full step/action rows | `evening.service.ts` | Perk, ticket and share endpoints need only step preview/access fields and action state | Medium | Меньше DB payload for evening step actions | Low | P1 | `loadStep` and action upserts now use narrow selects | Perk/ticket/share smoke |
| 44 | Worker manual import polling читал full source rows | `content-import.service.ts` | Manual import loop needs run id/source/city/metadata and source code only | Low/medium | Меньше DB payload in content worker polling | Low | P2 | Pending import query now uses narrow select | Manual import worker smoke |
| 45 | Evening lifecycle session reads тянули full route/steps | `evening.service.ts` | Start, join, finish, after-party, approve, check-in and advance paths use small route/session subsets, but loaded full route rows and step rows | Medium | Меньше DB payload in evening lifecycle screens and chat updates | Low | P1 | Session lifecycle queries now use purpose-shaped selects | Evening start/join/finish/after-party/check-in smoke |
| 46 | Evening route resolve/detail читали full route step rows | `evening.service.ts` | Route resolve/detail/session mapper use fixed route and step fields, but Prisma returned every `EveningRouteStep` column | Medium | Меньше DB payload for `/evening/routes/resolve`, `/evening/routes/:routeId`, `/evening/sessions` | Low | P1 | Shared route and step `select` added for response-shaped reads | Evening route resolve/detail/session smoke |
| 47 | Content import duplicate preload читал full content rows | `content-import.service.ts` | Worker can preload up to 1000 `ExternalContentItem` rows per day/source key, but dedupe uses a fixed field set | Medium | Меньше DB payload and heap use in content import worker | Low | P1 | Duplicate candidate preload now uses explicit `select` | Content import staging smoke |
| 48 | Partner offer code flow читал full partner/venue/offer rows | `partner-offer-code.service.ts` | Mobile offer code issue/status/activation uses ids, status, names and snapshots, but Prisma loaded full relations | Medium | Меньше DB payload in evening offer-code flow | Low | P1 | Offer code queries now use summary `select`, issue context reads only ids | Offer-code issue/status/activation smoke |
| 49 | Route template sessions used ad hoc include | `evening-route-template.service.ts` | `/evening/route-templates/:templateId/sessions` only maps id, startsAt, capacity and joined count | Low/medium | Меньше DB payload and one shared query shape for template sessions | Low | P2 | Reused `templateSessionSelect` in list sessions | Route template sessions smoke |
| 50 | Onboarding startup read returned full preference row | `onboarding.service.ts` | `/onboarding/me` and update response need only profile answers and user contact fields | Low/medium | Меньше DB payload in startup/onboarding path | Low | P2 | Upserts now use `onboardingResponseSelect` | Onboarding get/update smoke |
| 51 | Worker system notification create returned full row | `worker.service.ts` | Scheduled system notifications only need notification id to enqueue push/realtime outbox events | Low/medium | Меньше DB payload in scheduled notification jobs | Low | P2 | Notification create now selects `id` only | Worker scheduled notification smoke |
| 52 | Dating/event notification fanout returned full rows | `dating.service.ts`, `events.service.ts` | Like, invite and reject notification flows only enqueue outbox by notification id | Low/medium | Меньше DB payload in mobile notification fanout mutations | Low | P2 | Notification and invite request creates now select ids only | Dating like and event invite/reject smoke |
| 53 | API nginx did not compress JSON | `deploy/nginx/frendly.conf` | Mobile list/search/feed JSON responses crossed network uncompressed from nginx | Medium | Меньше bandwidth and faster mobile responses on slow networks | Low | P1 | gzip enabled for API server blocks, ws locations unchanged | Check `Content-Encoding: gzip` for API JSON |

## Monorepo Inventory

| Package/App | Назначение | Основные зависимости | Риски производительности | Что проверить |
|------------|------------|----------------------|---------------------------|---------------|
| `@big-break/api` | Основной REST API, port 3000 | NestJS 10, Prisma 6, ioredis, AWS SDK S3, class-validator, google-auth-library | Auth DB call на каждый request, search fanout, media proxy upload, missing metrics | API latency per endpoint, Prisma query count, payload size |
| `@big-break/chat` | WebSocket chat server на `ws`, port 3001 | NestJS, ws, Prisma, ioredis | Redis at-most-once, block lookup per broadcast, backpressure metrics missing | ws active connections, reconnect time, bufferedAmount incidents |
| `@big-break/worker` | Outbox, push, media finalize, realtime publish, content jobs | NestJS, Prisma, ioredis, AWS SDK S3, firebase-admin, apn | Batch claim disabled in prod example, push per-token sends, invalid token cleanup missing | outbox lag, job duration, provider error classes |
| `@big-break/telegram-relay` | Telegram relay app, port 3003 | NestJS, Prisma, Telegraf | External polling/webhook cost, not part of hot mobile path | Timeouts, retry policy, logs |
| `@big-break/database` | Prisma schema/client, Redis/S3/outbox helpers, DB scripts | Prisma 6, ioredis, AWS SDK S3 | Redis helper lacks retry/error metrics, S3 helper was per-call client, schema lacks directUrl | Prisma validate/generate, hot path index scripts |
| `@big-break/contracts` | Shared TypeScript contracts | TypeScript | API contract changes can break Flutter | Contract tests, generated types |

Основной API: `backend/apps/api`. Worker: `backend/apps/worker`. WebSocket chat server: `backend/apps/chat`. Prisma schema: `backend/packages/database/prisma/schema.prisma`.

Scripts found in `backend/package.json`: `build`, `test`, `test:unit`, `test:integration`, `test:realtime`, `db:generate`, `db:migrate`, `db:deploy`, `db:reset:test-users`, `db:seed`.

Useful package scripts:

| Package | Scripts |
|---------|---------|
| `@big-break/api` | `start`, `build`, `test`, `test:unit`, `test:integration` |
| `@big-break/chat` | `start`, `build`, `test`, `test:realtime` |
| `@big-break/worker` | `start`, `build`, `test`, `test:unit` |
| `@big-break/database` | `build`, `test`, `test:unit`, `prisma:generate`, `db:migrate`, `db:deploy`, `db:indexes:hot-path`, `db:perf:hot-queries` |

No repo-level `lint`, `typecheck`, `test:e2e` script found in `backend/package.json`.

## API Endpoint Performance Inventory

| Endpoint | Method | Handler | Что делает | Prisma/DB calls | Redis calls | External calls | Payload risk | Latency risk | Priority |
|----------|--------|---------|------------|-----------------|-------------|----------------|--------------|--------------|----------|
| `/me` | GET | `AuthController.getMe` | Возвращает user/session view | AuthGuard `session.findUnique`, user lookup | None | None | Low | DB per request | P2 |
| `/onboarding/me` | GET/PUT | `OnboardingController.getOnboarding/updateOnboarding` | Startup onboarding state and contact requirement | OnboardingPreferences upsert, session provider lookup | None | None | Low/medium before select narrowing | Low/medium | P2 |
| `/profile/me` | GET | `ProfileController.getProfile` | Профиль, photos, onboarding/settings | User/Profile include, photos all loaded | None | None | Medium if many photos | Medium | P1 |
| `/events` | GET | `EventsController.listEvents` | Feed/list, geo/search filters | Bounded `event.findMany`, participant `groupBy`, viewer membership | None | None | Medium | Search/geo fallback | P1 |
| `/events/:eventId` | GET | `EventsController.getEvent` | Detail page | Event detail, participant count, viewer participant | None | None | Medium | Count and includes | P2 |
| `/search` | GET | `SearchController.groupedSearch` | Grouped mobile search | 5 service calls in parallel | None | None | Medium | High query fanout | P1 |
| `/chats/meetups` | GET | `ChatsController.listMeetupChats` | Chat list with event/session/member preview | `chat.findMany`, unread counts, social previews | None | None | High if evening route steps grow | High if unread fallback | P1 |
| `/chats/personal` | GET | `ChatsController.listPersonalChats` | Direct chats | Same chat list path, bounded messages/members | None | None | Medium | Medium | P1 |
| `/chats/:chatId/messages` | GET | `ChatsController.getMessages` | Message page | Membership, blocked IDs, bounded messages, latest realtime event | None | None | Medium attachments/reply | Medium | P2 |
| `/chats/:chatId/read` | POST | `ChatsController.markRead` | Mark one message read | ChatMember update, Notification updateMany | None | None | Low | Medium in large chat notification set | P2 |
| `/notifications` | GET | `NotificationsController.listNotifications` | Notifications list | Bounded findMany or raw SQL with block filter | None | None | Medium payload | Medium | P2 |
| `/notifications/unread-count` | GET | `NotificationsController.getUnreadCount` | Unread count | Count or raw SQL with block filter | None | None | Low | Medium with blocks | P2 |
| `/push-tokens` | POST | `NotificationsController.registerPushToken` | Register device token | deleteMany old device, upsert token | None | None | Low | Low | P2 |
| `/uploads/media/presign` | POST | `UploadsController.createPresignedUpload` | Direct upload URL | None | None | S3 presign local signing | Low | Low after S3 client reuse | P2 |
| `/uploads/media/complete` | POST | `UploadsController.completeDirectUpload` | Verify object, create MediaAsset | MediaAsset create/upsert | None | S3 `HeadObject` | Low | External call in request | P1 |
| `/uploads/media/file` | POST | `UploadsController.uploadFile` | Proxy upload through API | MediaAsset create | None | S3 `PutObject` with file buffer | High | High | P1 |
| `/media/:assetId` | GET | `MediaController.resolveMedia` | Redirect to public/signed URL or proxy stream | MediaAsset lookup, private auth check | None | S3 signed URL or GetObject if proxy | Low by default | Medium if proxy enabled | P2 |
| `/people` | GET | `PeopleController.listPeople` | People discovery | User findMany, block lookup, social previews | None | None | Medium | Social preview queries | P2 |
| `/dating/discover` | GET | `DatingController.listDiscover` | Premium dating list | Relation filters, dating actions | None | None | Medium | Needs EXPLAIN | P2 |
| `/communities` | GET | `CommunitiesController.listCommunities` | Community list with previews | Community findMany, counters, unread counts | None | None | Medium before select narrowing | Medium | P1 |
| `/communities/:id` | GET | `CommunitiesController.getCommunity` | Community detail | Community relation previews, counters | None | None | Medium before select narrowing | Medium | P1 |
| `/shares` | POST | `SharesController.createShare` | Create public share link | Target visibility check, PublicShare lookup/create | None | None | Low | Low | P2 |
| `/public/shares/:slug` | GET | `SharesController.getPublicShare` | Public preview for event/session | PublicShare with Event or EveningSession preview graph | None | None | Medium before select narrowing | Medium | P1 |
| `/events/:eventId/live` | GET | `EventsController.getLiveMeetup` | Mobile live meetup screen | Participant, attendance, story count, live state | None | None | Medium before select narrowing | Medium | P1 |
| `/events/:eventId/check-in` | GET | `EventsController.getCheckIn` | Check-in screen | Participant and attendance reads | None | None | Medium before select narrowing | Medium | P1 |
| `/safety` | GET | `SafetyController.getSafety` | Safety screen | Settings, contacts, counts | None | None | Low/medium | Multiple counts | P2 |
| `/safety/reports` | POST | `SafetyController.createReport` | Create user report and optional block | Advisory lock, report create, optional block upsert | None | None | Low | Transaction lock per pair | P2 |
| `/affiche/events` | GET | `AfficheController.listEvents` | Public content list | Narrow `ExternalContentItem.select` | None | None | Low | Index dependent | P2 |
| `/posters` | GET | `PostersController.listPosters` | Public poster list | Poster findMany with coverAsset include | None | None | Medium | Search/order index dependent | P2 |
| `/evening/routes/resolve` | POST | `EveningController.resolveRoute` | Pick evening route for mobile scenario | `EveningRoute.findMany`, step list, user action state | None | None | Medium before step select narrowing | Medium | P1 |
| `/evening/routes/:routeId` | GET | `EveningController.getRoute` | Evening route detail | `EveningRoute.findUnique`, step list, user action state | None | None | Medium before step select narrowing | Medium | P1 |
| `/evening/sessions` | GET | `EveningController.listSessions` | Public live/scheduled evening sessions | `EveningSession.findMany`, route steps, participants, requests | None | None | Medium before route select narrowing | Medium | P1 |
| `/evening/route-templates/:templateId/sessions` | GET | `EveningController.listRouteTemplateSessions` | Sessions for one route template | Template existence check, EveningSession list with joined participants | None | None | Low/medium before select reuse | Low/medium | P2 |
| `/evening/sessions/:sessionId/steps/:stepId/offers/:offerId/code` | POST | `EveningController.issuePartnerOfferCode` | Issue partner offer code for evening step | Session membership, route step, PartnerOfferCode upsert | None | None | Medium before relation select narrowing | Medium | P1 |
| `/evening/offer-codes/:codeId` | GET | `EveningController.getPartnerOfferCode` | Offer code status | PartnerOfferCode with offer/venue/partner summary | None | None | Medium before relation select narrowing | Low/medium | P1 |

## Prisma/PostgreSQL Audit

| № | Место | Prisma/SQL pattern | Проблема | Почему это плохо | Предложение | Нужен индекс | Риск | Как проверить |
|---|-------|--------------------|----------|------------------|-------------|--------------|------|---------------|
| 1 | `apps/api/src/auth.guard.ts` | `session.findUnique({ where: { id } })` per request | DB hit на каждый authenticated endpoint | Mobile startup делает много requests, DB QPS растёт линейно | Session cache 10-30s с revocation review | Нет, primary key already | Security semantics | Снять DB query count per request |
| 2 | `schema.prisma`, prod compose | Runtime через PgBouncer, datasource без `directUrl` | Migrations должны всегда идти direct URL | Ошибка env может отправить Prisma CLI через pool | Add `directUrl = env("DATABASE_DIRECT_URL")` после env review | Нет | Env compatibility | `prisma validate`, `prisma migrate status` with direct DB |
| 3 | `worker.service.ts` | fallback `outboxEvent.findFirst` | До правки тянул full row, order only `createdAt` | Лишний payload read, unstable tie ordering | Уже исправлено: `select` + `createdAt,id` | Индекс hot-path already via script | Low | Worker unit test, SQL logs |
| 4 | `compose.prod.yml`, `.env.production.example` | `WORKER_OUTBOX_BATCH_CLAIM=false` | Отключает `FOR UPDATE SKIP LOCKED` batch path | Больше DB roundtrips, хуже throughput | Включить после staging test | Existing partial index via `db:indexes:hot-path` | Duplicate processing if bug | Outbox lag, worker logs, test `claims available outbox events in a batch` |
| 5 | `chats.service.ts` | unread fallback raw count | Prod example может считать unread по Message | Heavy count на горячем chat list | Включить materialized counters после verifier | Existing `ChatMember` indexes | Counter drift | `pnpm --filter @big-break/database db:chat-unread:verify` |
| 6 | `search.service.ts` | 5 parallel service calls | Повторные block/unlock/profile reads | Одна search команда дорогая для DB | Request-level cache для `getBlockedUserIds`, unlock/profile | Нет | Stale within request only low | Prisma query count for `/search` |
| 7 | `chats.service.ts` | include `eveningRoute.steps`, `eveningSession.route.steps` | Route steps в chat list без hard cap | Payload растёт по chats * steps | Denormalize `totalSteps/currentPlace` или ограничить select с count | Возможно нет | Contract risk | Compare payload size for `/chats/meetups` |
| 8 | `profile.service.ts` | `profile.photos` all loaded | Нет явного take в profile read | Профиль может стать тяжёлым | Ввести max photos or separate endpoint | Нет | API contract | Payload size per profile |
| 9 | `s3.ts`, `StoriesService.mapStory` | `createPresignedDownload` per story | До правки S3 client создавался на каждый URL | CPU/GC overhead на story list | Уже исправлено: shared public S3 client | Нет | Low | Story list smoke, heap profile |
| 10 | `uploads.service.ts` | S3 `HeadObject` in complete request | External call в request-response | Latency зависит от S3 | Async finalize через outbox for mobile media | Нет | Contract timing | Measure complete latency, worker lag |
| 11 | `events.service.ts` | `contains` over title/place/description | Search может идти в seq scan без trigram | Search load бьёт PostgreSQL CPU | Verify trigram indexes, or search table | Maybe | Write overhead | `EXPLAIN (ANALYZE, BUFFERS)` list search |
| 12 | `posters.service.ts` | order `isFeatured desc, startsAt, id` with status/city | Existing indexes may not cover full order | Sort cost on public list | Review composite index below | Yes after EXPLAIN | Write overhead | EXPLAIN poster list |
| 13 | `chats.service.ts`, `chat-server.service.ts` | `sender: true`, `mediaAsset: true` in message reads | Full relation rows on chat hot paths | Chat list and ws send are frequent mobile flows | Fixed with narrow message selects | Нет | Low | Compare Prisma query payload and response |
| 14 | `events.service.ts` | broad `include` in join/invite flows | Event and request rows were wider than needed | More DB bytes and object allocation in mutation paths | Fixed with field-level selects | Нет | Low | Join, request, accept, decline smoke |
| 15 | `notifications.service.ts` | `notification.findMany` without select | Full Notification rows for list | More DB bytes on notification screen | Fixed with response-shaped select | Existing list index likely enough | Low | Notifications list smoke |
| 16 | `worker.service.ts` | full `PushToken` and full route step reads | Worker jobs read unused columns repeatedly | More worker DB traffic | Fixed with narrow selects | No new index | Low | Worker staging run |
| 17 | `communities.service.ts` | Community include graph | Community list/detail loaded full root and nested rows | More DB bytes on list/detail pages | Fixed with response-shaped root and relation selects | No new index | Low | Community list/detail smoke |
| 18 | `shares.service.ts` | public share broad include graph | Public share loaded full Event and EveningSession rows | More DB bytes for public traffic | Fixed with explicit nested select | No new index | Low | Public share smoke |
| 19 | `events.service.ts` | live/check-in broad Event includes | Mobile live screens loaded unused event columns | More DB bytes and allocations | Fixed with response-shaped selects | No new index | Low | Live/check-in smoke |
| 20 | `safety.service.ts` | mutation create/upsert without select | Safety flows returned full DB rows after writes | More DB bytes and accidental data exposure surface | Fixed with response-shaped selects | No new index | Low | Safety action smoke |
| 21 | `evening-route-ai-candidates.service.ts` | Venue include offers without field select | Candidate route support path loaded full venue and offer rows | More DB bytes before filtering | Fixed with venue/offer selects | No new index | Low | Candidate generation smoke |
| 22 | `after-dark.service.ts` | Event findMany/findFirst with relation include | After Dark list and detail loaded full Event rows | More DB bytes in `/search` and After Dark UI | Fixed with response-shaped selects | No new index | Low | `/search`, After Dark list/detail smoke |
| 23 | `host.service.ts` | Event findMany/findFirst with include | Host dashboard/detail loaded full Event rows | More DB bytes for hosted event screens | Fixed with shared event summary select | No new index | Low | Host dashboard/detail smoke |
| 24 | `chats.service.ts` | Chat include graph | Chat list loaded full Chat and ChatMember rows | More DB bytes on hot chat list | Fixed with response-shaped Chat select and member relation select | No new index | Low | Chat list smoke |
| 25 | `events.service.ts` | Event feed include graph | Event list loaded full Event and EventParticipant rows | More DB bytes for home/search feed | Fixed with summary Event select and participant preview select | No new index | Low | Event list/search smoke |
| 26 | `events.service.ts` | Event detail include graph | Event detail loaded full Event row | More DB bytes for details screen | Fixed with summary select plus detail-only fields | No new index | Low | Event detail smoke |
| 27 | `posters.service.ts` | Poster include graph | Poster list/detail loaded full Poster row | More DB bytes for poster list/search | Fixed with response-shaped Poster select | No new index | Low | Poster list/detail smoke |
| 28 | `evening.service.ts` | EveningSession participant include | Session list/detail loaded full participant rows | More DB bytes for evening session screens | Fixed with participant relation select | No new index | Low | Evening sessions smoke |
| 29 | `evening.service.ts` | Evening step/action broad reads | Step action endpoints loaded full step and action rows | More DB bytes on step interactions | Fixed with step/access/action-state selects | No new index | Low | Perk/ticket/share smoke |
| 30 | `content-import.service.ts` | Manual import polling include source | Worker loaded full source rows for pending manual runs | More DB bytes during polling | Fixed with run/source code select | No new index | Low | Manual import worker smoke |
| 31 | `evening.service.ts` | Evening lifecycle broad session reads | Start/join/finish/after-party loaded full route/session graphs | More DB bytes in evening lifecycle flows | Fixed with purpose-shaped selects | No new index | Low | Evening lifecycle smoke |
| 32 | `evening.service.ts` | Evening route and step include graph | Resolve/detail/session mapper loaded full `EveningRouteStep` rows | More DB bytes for route cards and mobile evening sessions | Fixed with shared route/step response select | No new index | Low | Evening route resolve/detail/session smoke |
| 33 | `content-import.service.ts` | duplicate preload full rows | Import dedupe preloaded up to 1000 full `ExternalContentItem` rows | More DB bytes and heap during worker import | Fixed with explicit duplicate candidate select | No new index | Low | Content import staging smoke |
| 34 | `partner-offer-code.service.ts` | offer code relation include graph | Issue/status/activation loaded full `PartnerOffer`, `Partner`, `Venue` rows | More DB bytes for evening perk code flow | Fixed with summary code select and id-only issue context | No new index | Low | Offer-code smoke |
| 35 | `evening-route-template.service.ts` | template session include | Template session list used a local include instead of existing response select | More DB bytes and divergent query shape | Fixed by reusing `templateSessionSelect` | No new index | Low | Route template sessions smoke |
| 36 | `onboarding.service.ts` | onboarding upsert returned full row | Startup/update path returned unused onboarding columns | Extra DB bytes in first-run mobile flow | Fixed with response-shaped select | No new index | Low | Onboarding smoke |
| 37 | `worker.service.ts` | notification create without select | Worker system notification create returned full Notification row | Extra DB bytes in scheduled jobs | Fixed with `select: { id: true }` | No new index | Low | Worker scheduled notification smoke |
| 38 | `dating.service.ts`, `events.service.ts` | notification fanout create without select | Like/invite/reject flows returned full rows where only ids were used | Extra DB bytes in mutation paths | Fixed with id-only mutation selects | No new index | Low | Dating like and event invite/reject smoke |

Potential indexes, not auto-applied:

| Table | Fields | Type | Why | Endpoint/job | Example migration | Risk | Verify |
|-------|--------|------|-----|--------------|-------------------|------|--------|
| `Poster` | `status, city, isFeatured DESC, startsAt, id` | btree | Public poster list filters status/city and orders featured/start/id | `GET /posters` | `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Poster_status_city_isFeatured_startsAt_id_idx" ON "Poster"("status","city","isFeatured" DESC,"startsAt","id");` | Extra write/storage cost | `EXPLAIN (ANALYZE, BUFFERS)` with common city/category |
| `ExternalContentItem` | `publicStatus, city, contentKind, priceMode, startsAt, id` | btree, maybe partial | Public affiche uses city/kind/price/start cursor | `GET /affiche/events` | `CREATE INDEX CONCURRENTLY IF NOT EXISTS "ExternalContentItem_public_city_kind_price_startsAt_id_idx" ON "ExternalContentItem"("publicStatus","city","contentKind","priceMode","startsAt","id");` | May duplicate existing broad indexes | Compare plan and index size |
| `Event` | `isAfterDark, canceledAt, startsAt, id` plus trigram search indexes | btree + gin trigram | Event list/search has date/status/search filters | `GET /events` | Use existing migration review first, do not duplicate | High write overhead if duplicated | `EXPLAIN` with search and without search |
| `OutboxEvent` | pending partial index | btree partial | Worker claim by status/availableAt/createdAt/id | worker outbox | Already in `create-hot-path-indexes.ts` | Must exist in prod | `\di`, `EXPLAIN` batch claim |
| `PushToken` | `userId, disabledAt, updatedAt, id` | btree | Worker loads active tokens by user | push dispatch | Already in schema/hot-path scripts | Low | EXPLAIN push token lookup |

## Redis Pub/Sub Audit

| Flow | Publisher | Subscriber | Channel | Payload | Risk | Cost/Latency impact | Recommendation |
|------|-----------|------------|---------|---------|------|---------------------|----------------|
| Chat message created/updated/deleted | `ChatServerService` | all chat servers | `big-break:events` | Message payload with sender/reply/attachments | Redis pub/sub at-most-once, no parse guard on subscriber handler | Missed realtime on reconnect until sync | Keep sync as source of truth, add subscriber error metrics and JSON parse guard |
| Notification created | `WorkerService.handleNotificationCreate` | chat servers | `big-break:events` | Notification payload | Payload may include arbitrary notification payload | Larger Redis messages | Cap realtime payload, move details to API |
| Unread fanout | `WorkerService.publishUnreadCounts` | chat servers | `big-break:events` | one event per user | Fanout can publish many messages | Redis CPU/network under large chats | Batch/coalesce unread updates per chat/user window |
| Attachment ready | `WorkerService.handleMediaFinalize` | chat servers | `big-break:events` | asset id/public URL | media finalize mostly not used by upload complete | Flow drift | Make direct upload finalize path consistent |
| Typing changed | `ChatServerService.publishTyping` | chat servers | `big-break:events` | chatId,userId,isTyping | Throttle is per socket, duplicate user connections still publish | Noise under many devices | Per-user/chat throttle or coalesce |

Redis helper risk in `packages/database/src/pubsub.ts`: clients use `maxRetriesPerRequest: null`, no `retryStrategy`, no `enableOfflineQueue` policy, no lifecycle metrics. Large payload warning is now added, but counters and reconnect metrics are still missing. Do not change retry/offline behavior blindly, because delivery semantics can change.

## WebSocket Chat Performance Audit

| № | Flow | File | Problem | Why it hurts | Expected impact | Safe fix | Risk | How to test |
|---|------|------|---------|--------------|-----------------|----------|------|-------------|
| 1 | Connection lifecycle | `chat-server.service.ts` | No heartbeat cleanup before this audit | Stale sockets stay in Maps/Sets | Lower memory, cleaner reconnect | Fixed with ping/pong heartbeat | Low | Unit test, kill mobile network |
| 2 | Broadcast send | `chat-server.service.ts` | `JSON.stringify` per socket | CPU grows with fanout | Lower CPU in large rooms | Pre-serialize when no per-user sanitizing | Low/medium | Load test room broadcast |
| 3 | Broadcast visibility | `chat-server.service.ts` | Block lookup per broadcast | DB QPS grows with realtime events | Lower DB load | Short TTL block cache or precomputed visibility | Medium | Query count per broadcast |
| 4 | Backpressure | `send()` | Drops if `bufferedAmount` too high, no metric | Silent realtime loss | Easier incident detection | Metric/log counter, close after repeated incidents | Low | Simulate slow socket |
| 5 | Redis subscribe | `attach()` | `JSON.parse` outside try/catch | Bad payload can break handler path | Stability | Try/catch and bad payload metric | Low | Publish invalid JSON |
| 6 | Rate limit | `publishTyping`, commands | Only typing throttle, no per-IP/user command rate limit | Abuse can burn CPU/DB | More stable under abuse | Token bucket per socket/user/IP | Medium | ws flood test |
| 7 | Max payload | `WebSocketServer({ maxPayload })` | Present | Good | Keeps large JSON out | Keep | Low | Oversized message test |

## Worker / Outbox / Push / Media Audit

| Job/Flow | Trigger | DB usage | External calls | Retry/Backoff | Idempotency | Risk | Recommendation |
|----------|---------|----------|----------------|---------------|-------------|------|----------------|
| Outbox claim | interval 1500ms | Batch raw SQL with `SKIP LOCKED` if enabled, fallback find/updateMany | None | failure retries max 5, linear delay | updateMany claim guard | Prod example disables batch | Enable batch after staging, add lag metrics |
| Outbox fallback | same | Before audit full row read, now select needed fields | None | Same | Same | Lower but still sequential | Prefer batch path |
| `push.dispatch` | outbox event | notification, settings, tokens | FCM/APNS | provider errors retry via outbox | dedupe notification key | No invalid token cleanup, no batching | Classify provider errors, disable invalid tokens, batch FCM where safe |
| `notification.create` | outbox event | notification findUnique, block check | Redis publish | outbox retry | dedupe key upstream | Payload can be large | Realtime payload budget |
| `system.notification` | scheduler helper | notification create now returns id only, outbox createMany | None directly | unique dedupe | dedupeKey | Low payload risk after select narrowing | Keep id-only create result |
| `message.notification_fanout` | outbox event | members and createMany notifications | None | outbox retry | dedupe keys | Large chats create many notifications | Chunking metrics, fanout budget |
| `chat.unread_fanout` | outbox event | raw unread count per user, updateMany | Redis publish | outbox retry | per member count | DB and Redis fanout | Coalesce, use materialized counters |
| `media.finalize` | outbox event | MediaAsset find/update | S3 `HeadObject` | outbox retry | asset id | Often bypassed by HTTP complete | Move mobile finalize to worker |
| `evening.auto_advance` | interval | Live sessions and route steps | None | guarded by running flag | session currentStep guard | Before audit route step read was wider than needed | Narrow select applied, add duration metric |
| Content import/generation | intervals | many content tables, duplicate preload now uses narrow select | external APIs/OpenRouter | service-specific fallback | run IDs | Can run costly jobs | Keep disabled unless configured, add job cost metrics |

FCM/APNS notes:

| Provider | File | Finding | Recommendation |
|----------|------|---------|----------------|
| FCM | `push.providers.ts` | Sends one token at a time via `messaging().send` | Review batching with `sendEachForMulticast` or safe chunks |
| APNS | `push.providers.ts` | `production: false` hardcoded | Add env flag, test sandbox/prod separately |
| Fake/skipped providers | `push.providers.ts` | Full token was logged | Fixed, token is masked |

## S3 / Media / CDN Audit

| Flow | File | S3 operation | Problem | Cost impact | Latency impact | Recommendation | Risk |
|------|------|--------------|---------|-------------|----------------|----------------|------|
| Presigned upload | `packages/database/src/s3.ts` | local signing for PutObject | Before audit public S3 client per call | CPU/GC overhead | Small per request | Fixed shared public client | Low |
| Presigned download | `packages/database/src/s3.ts`, `stories.service.ts` | local signing for GetObject | One signed URL per story/media | CPU overhead | Medium on lists | Shared client fixed, consider CDN public URLs for public media | Privacy review |
| Direct upload complete | `uploads.service.ts` | `HeadObject` | External call in HTTP path, now has timeout | S3 request cost | Medium | Async finalize via outbox | Contract timing |
| File proxy upload | `uploads.controller.ts`, `uploads.service.ts` | `PutObject` with API buffer | Backend handles file bytes, now has timeout | API bandwidth/RAM/CPU | High | Make mobile use direct upload, proxy only fallback | Client migration |
| Profile photo upload | `profile.service.ts` | PutObject/direct complete | Similar sync finalize, now has timeout | Medium | Medium | Direct upload plus async finalize | UX review |
| Media redirect | `media.controller.ts`, `media.service.ts` | signed URL/public redirect or optional `GetObject` proxy | Default avoids proxy streaming, proxy stream now has timeout | Good | Good | Keep proxy streaming off by default | None |
| Object metadata | `profile.service.ts`, `uploads.service.ts`, `s3.ts` | PutObject | Server-side uploads did not set object Cache-Control | CDN/browser cache was less predictable | Medium | Applied public immutable for avatar files, private max-age 300 for chat/story file uploads. Presigned upload headers still need client review | Privacy/cache invalidation |
| Variants/thumbnails | Not found as backend pipeline | None | Full-size media may be used where thumbnail needed | Bandwidth | Mobile jank | Add thumbnail/variant pipeline | Medium |
| Orphan cleanup | Not found for S3 objects | LIST/DELETE absent | DB cleanup may leave objects | Storage cost | None | Add orphan audit job first | Destructive risk |

Backend/devops checklist:

| Check | What to collect |
|-------|-----------------|
| CDN cache hit ratio | CDN logs per media path |
| Response headers | `Cache-Control`, `ETag`, content type |
| Image variants | avatar/card/hero/fullscreen sizes |
| Bandwidth | nginx/CDN egress by path |
| Storage usage | bucket size by prefix |
| Orphan files | DB MediaAsset vs bucket inventory |
| S3 operations | HEAD/LIST/GET/PUT count |

## Deploy / Docker / Nginx / PgBouncer Audit

| Component | Config file | Problem | Cost/Performance impact | Safe fix | Risk | How to verify |
|-----------|-------------|---------|-------------------------|----------|------|---------------|
| Docker | `backend/Dockerfile` | Install was non-frozen | Unreproducible image | Fixed lockfile copy and frozen install | Low | Docker build |
| Docker | `backend/Dockerfile` | Single-stage, dev deps, ts-node runtime, root | Larger image, more memory, slower cold start | Multi-stage dist runtime, non-root user | Medium | Image size, start smoke |
| Docker context | `.dockerignore` | AI context, local env and logs were not excluded | Bigger build context, possible secret/log leakage into context transfer | Added ignore rules | Low | `docker build --no-cache` context output |
| Production env | `compose.prod.yml` | `NODE_ENV` was not explicit in services | Runtime could use non-production branches, including profile media bypass | Added `NODE_ENV: production` to production services | Low | `docker compose config`, profile upload smoke |
| Production env | `compose.prod.yml` | `ENABLE_TEST_PHONE_SHORTCUTS` defaults to `true` for API | Security-sensitive production risk, auth flow may differ from real users | Needs explicit auth/security review, likely default should be false | Medium | Config review plus auth smoke |
| Docker compose | `compose.prod.yml` | Chat service has worker env vars | Config noise | Remove unused env after review | Low | `docker compose config` |
| Nginx | `deploy/nginx/frendly.conf` | No upstream keepalive | More TCP churn | Add keepalive upstreams | Low | nginx stub stats |
| Nginx | same | No gzip/brotli for JSON/static | More bandwidth | gzip enabled for API JSON/static, WebSocket unchanged | Low | Response headers, bandwidth |
| Nginx | same | No rate limits on auth/upload | Abuse can increase DB/S3 costs | rate limit zones for auth/upload | Medium | Load/smoke tests |
| Nginx | same | WebSocket read timeout existed, send timeout was not explicit | Long stale sessions can linger | Added `proxy_send_timeout` and disabled buffering for `/ws` | Low | ws reconnect smoke |
| PgBouncer | `compose.prod.yml`, `.env.production.example` | Runtime uses pooled URL, migrate direct URL | Good pattern, but schema lacks directUrl | Add `directUrl` after env review | Low/medium | `prisma validate`, migrate dry run |
| PgBouncer | `.env.production.example` | `connection_limit=3` per service | Good for PgBouncer, may bottleneck if API grows | Tune with pool stats | Medium | `SHOW POOLS`, app latency |

## Observability Plan

| Metric | Why it matters | Where to collect | Suggested implementation | Priority |
|--------|----------------|------------------|--------------------------|----------|
| p50/p95/p99 API latency per endpoint | Shows real slow endpoints | API interceptor | Prometheus histogram or OpenTelemetry | P1 |
| DB query count per request | Finds fanout/N+1 | Prisma middleware/extension plus request context | Count queries by requestId | P1 |
| DB query duration | Finds slow SQL | Prisma query events, PostgreSQL logs | Slow query threshold and histogram | P1 |
| Slow queries | Needed before indexes | PostgreSQL `log_min_duration_statement`, pg_stat_statements | Dashboard top SQL | P1 |
| Prisma query timings | App-side DB latency | Prisma logging/extension | Attach endpoint/requestId | P1 |
| Redis pub/sub message count | Fanout cost | Redis wrapper | Counter by event type | P1 |
| WebSocket active connections | Capacity | ChatServerService | Gauge by instance | P1 |
| WebSocket messages/sec | Realtime load | ChatServerService | Counter by type | P1 |
| ws bufferedAmount incidents | Backpressure | `send()` | Counter and close reason | P1 |
| Outbox pending count | Queue health | Worker/DB | Gauge by status | P1 |
| Outbox processing lag | User-visible delay | Worker | `now - oldest availableAt` | P1 |
| Worker job duration | Slow jobs | Worker wrapper | Histogram by event type | P1 |
| Push success/failure rate | Delivery stability | Push providers | Counter by provider/error class | P1 |
| Invalid push tokens count | Cost cleanup | Push provider error handling | Counter plus disabled tokens | P1 |
| S3 operation count | Storage cost | S3 wrapper | Counter HEAD/PUT/GET/sign | P2 |
| S3/media bandwidth | Egress cost | nginx/CDN/S3 billing | dashboard by path/prefix | P1 |
| Response payload size | Mobile speed | API interceptor/nginx | Histogram per endpoint | P1 |
| Request body size | Upload abuse | API/nginx | Histogram plus limits | P1 |
| Event loop lag | Node saturation | API/chat/worker | `perf_hooks.monitorEventLoopDelay` | P1 |
| Heap usage | Memory leaks | process metrics | Gauge by service | P1 |
| CPU/RAM | Infra cost | Docker host | cAdvisor/node exporter | P1 |
| nginx 4xx/5xx | Proxy health | nginx logs/metrics | counters by route | P1 |
| PgBouncer pool usage | Connection pressure | PgBouncer `SHOW POOLS` | exporter/dashboard | P1 |
| Cost per 1,000 requests | Infra planning | billing plus request counts | derived metric | P2 |

## Cost Optimization Audit

| № | Cost driver | Где найдено | Почему дорого | Как уменьшить | Риск | Expected saving | Priority |
|---|-------------|-------------|----------------|---------------|------|-----------------|----------|
| 1 | Media proxy upload | `uploads.service.ts`, `profile.service.ts` | API handles large buffers and S3 PUT | Direct-to-S3 mobile default | Client flow change | Medium/high, needs metrics | P1 |
| 2 | Search fanout | `search.service.ts` | One call triggers many DB queries | Request cache, result budgets, metrics | Low/medium | Medium | P1 |
| 3 | Auth session DB hit | `auth.guard.ts` | Every request hits PostgreSQL | Short TTL session cache after review | Security review | Medium | P1 |
| 4 | Worker sequential claim | `.env.production.example`, `worker.service.ts` | More DB roundtrips | Enable batch claim | Needs staging | Medium | P1 |
| 5 | Chat unread fallback | `chats.service.ts`, env example | Message count per chat list | Enable materialized counters | Counter drift | Medium | P1 |
| 6 | Push per token | `push.providers.ts` | Provider call per token | Safe batching, invalid cleanup | Delivery semantics | Medium | P1 |
| 7 | Large chat list payload | `chats.service.ts` | includes route steps/members/messages | Slim list DTO after contract review | API contract | Medium | P1 |
| 8 | Missing thumbnails | media flow | Full media can hit mobile/CDN | Generate variants | Pipeline complexity | High bandwidth saving possible | P2 |
| 9 | Logs volume | worker content logs, push logs | Payload/log volume costs | Structured sampling, token masking done | Debug visibility | Low/medium | P2 |
| 10 | Docker image | `Dockerfile` | Dev deps and source in image | Multi-stage production image | Build change | Low/medium | P1 |
| 11 | Wide chat DB reads | `chats.service.ts`, `chat-server.service.ts` | Full sender/media asset rows on hot chat paths | Narrow selects, already applied | Low | Low/medium | P1 |
| 12 | Wide worker DB reads | `worker.service.ts` | Full push token and route step rows in scheduled jobs | Narrow selects, already applied | Low | Low | P2 |
| 13 | Uncompressed API JSON | `deploy/nginx/frendly.conf` | Mobile list/search/feed responses used more bandwidth | gzip enabled for API JSON/static | nginx CPU | Low/medium, needs traffic metrics | P1 |

Billing data needed before savings numbers:

| Area | Needed data |
|------|-------------|
| PostgreSQL | CPU/RAM/IOPS, pg_stat_statements, slow logs |
| PgBouncer | `SHOW POOLS`, wait counts, pool saturation |
| Redis | memory, connections, pub/sub messages/sec |
| nginx | bandwidth by path, 4xx/5xx, upstream time |
| S3 | storage, egress, HEAD/GET/PUT count |
| Docker host | CPU/RAM per service |
| API | request count per endpoint, payload size |
| nginx | gzip ratio, response bytes before/after, CPU |
| Push | push count, provider error classes |
| WebSocket | connection count, messages/sec, reconnect rate |
| Logs | logs GB/day by service |

## Mobile UX Backend Improvements

| Mobile scenario | Backend bottleneck | Current files/endpoints | Proposed backend fix | Expected UX impact | Risk |
|----------------|--------------------|-------------------------|----------------------|--------------------|------|
| Startup | Many authenticated calls each hit session DB | `auth.guard.ts`, `/me`, `/profile/me`, `/notifications/unread-count` | Short session cache after auth review, bootstrap budget metrics | Faster first screen | Security review |
| First-run onboarding | Full preference row before mapping | `onboarding.service.ts`, `/onboarding/me` | Response-shaped select for get/update | Smaller startup JSON and DB row payload | Low |
| First profile screen | All photos loaded | `profile.service.ts`, `/profile/me` | Cap photos in main response, separate full gallery if needed | Smaller JSON | API contract |
| Home/search | Grouped search fans out | `search.service.ts`, `/search` | Request cache, query budgets, lightweight groups | Faster search | Medium |
| Chat list | Unread fallback, route steps | `chats.service.ts`, `/chats/meetups` | Enable unread counters, slim evening route fields | Faster chat tab | Contract/counter verify |
| Evening route screen | Full route step rows before mapping | `evening.service.ts`, `/evening/routes/resolve`, `/evening/routes/:routeId`, `/evening/sessions` | Shared route/step select with only response fields | Faster route cards and session screen | Low |
| Evening offer code | Full partner/venue/offer relations before mapping | `partner-offer-code.service.ts`, `/evening/.../offers/:offerId/code` | Summary select for code DTO and id-only issue context | Faster perk code open/activation | Low |
| Chat realtime | Redis/db block lookup per event, no metrics | `chat-server.service.ts` | Metrics, cache block lookups, heartbeat fixed | Stable reconnect/realtime feel | Medium |
| Media upload | Proxy upload path | `uploads.controller.ts`, `profile.service.ts` | Direct upload default, async finalize | Less UI blocking | Client migration |
| Media view | Missing variants | media services | Thumbnail/card/hero variants and CDN headers | Faster image open | Pipeline work |
| Push delivery | No invalid cleanup/batching | `worker.service.ts`, `push.providers.ts` | Error classification, cleanup tokens | More stable notifications | Provider review |

## Safe P0/P1 changes applied

| Change | Files | Problem | Why safe | Expected impact | Verification |
|--------|-------|---------|----------|-----------------|--------------|
| Frozen Docker install | `backend/Dockerfile` | `pnpm install --no-frozen-lockfile` | Build dependency graph stays lockfile-based | More reproducible deploy | Docker build/config |
| Nest shutdown hooks | API/chat/worker `main.ts` | Lifecycle cleanup not triggered on SIGTERM | Uses Nest standard lifecycle, no API contract change | Cleaner Prisma/Redis/ws shutdown | Build |
| WebSocket heartbeat cleanup | `chat-server.service.ts`, unit test | Stale sockets not terminated | Only closes sockets that miss pong | Lower memory leak risk | Unit test |
| WebSocket Redis message guard | `chat-server.service.ts` | Bad Redis payload or broadcast error could escape subscriber handler | Catches/logs error without payload contents | More stable realtime subscriber | Static review, no tests run after user pause |
| WebSocket shutdown hardening | `chat-server.service.ts` | Redis quit could block socket cleanup, heartbeat timer kept ref | Closes sockets first, timer is unrefed, Redis quit is isolated | Cleaner shutdown | Static review, no tests run after user pause |
| Mask push token logs | `push.providers.ts`, unit test | Full token in fake/skipped logs | Does not affect send payload | Lower sensitive log risk | Unit test |
| APNS production switch | `push.providers.ts`, `backend/.env.example`, `.env.production.example` | APNS provider was hardcoded to sandbox | Default is still false, production needs explicit env | Production APNS can be enabled without code change | Static review, no tests run after user pause |
| Shared public S3 presign client | `packages/database/src/s3.ts` | Client per presigned URL | Same credentials and endpoint, same signed URL behavior | Lower CPU/GC overhead | Build, S3 tests |
| Narrow fallback outbox claim | `worker.service.ts` | Full row read and non-deterministic tie order | Selects only fields used, same claim semantics | Slightly lower DB payload, stable ordering | Worker unit tests |
| Worker timer lifecycle hardening | `worker.service.ts` | Many intervals were refed and cleared manually | Unrefs scheduler timers, centralizes cleanup, catches Redis quit failure | Fewer open-handle/shutdown issues | Static review, no tests run after user pause |
| Push provider shutdown cleanup | `worker.service.ts`, `push.providers.ts` | Worker only closed Redis on shutdown | Adds FCM app delete and APNS provider shutdown | Fewer provider handles after deploy/test shutdown | Static review, no tests run after user pause |
| FCM app reuse | `push.providers.ts` | Fixed Firebase app name can throw on repeated provider creation | Reuses existing named Firebase app | Safer tests/restarts in one process | Static review, no tests run after user pause |
| Shared database push provider hardening | `packages/database/src/push-providers.ts` | Exported provider copy still logged full tokens and had sandbox APNS hardcode | Mirrors token masking, close hooks, FCM reuse, APNS env switch | Safer if another app imports database provider | Static review, no tests run after user pause |
| External timeout unref | `openrouter.ts`, `content-import.service.ts`, `social-identity-verifier.service.ts` | Timeout handles could keep process alive until they fire | Adds `unref` while keeping abort behavior | Fewer open handles during shutdown/tests | Static review, no tests run after user pause |
| Telegram relay lifecycle hardening | `telegram-relay/src/main.ts`, `telegram-relay.service.ts` | Relay app lacked shutdown hooks, polling timer was refed | Adds Nest shutdown hooks and timer `unref` | Cleaner relay shutdown | Static review, no tests run after user pause |
| Redis pub/sub payload warning | `packages/database/src/pubsub.ts`, env examples | Large realtime payloads were invisible | Only logs event type and byte size above threshold, publish behavior is unchanged | Easier to find costly realtime events | Static review, no tests run after user pause |
| S3 request timeout | `packages/database/src/s3.ts`, `uploads.service.ts`, `profile.service.ts`, `media.service.ts`, `worker.service.ts`, env examples | S3 `PutObject`, `HeadObject`, `GetObject` could hang without app-level timeout | Uses `abortSignal`, default 15s, can be disabled with `S3_REQUEST_TIMEOUT_MS=0` | Fewer stuck HTTP requests and worker jobs | Static review, no tests run after user pause |
| Docker build context cleanup | `.dockerignore` | Local AI files, root env files and logs could be sent to Docker daemon | Dockerfile only copies `backend/`, so this does not change runtime files | Smaller safer build context | Static review, no tests run after user pause |
| Track audit report despite ignored docs | `.gitignore`, `docs/backend_performance_audit.md` | `docs/` was ignored, so the requested report would stay local-only | Ignore rule now exposes only this audit file, other docs stay ignored | Report can be reviewed in git | Static review, no tests run after user pause |
| Explicit production Node env | `compose.prod.yml` | Production compose did not force `NODE_ENV=production` | Only production compose changed, dev compose behavior is unchanged | Prevents accidental dev-only media bypass in production | Static review, no tests run after user pause |
| Nginx WebSocket proxy hardening | `deploy/nginx/frendly.conf` | WebSocket locations had read timeout only and default buffering | Adds send timeout and disables proxy buffering only for `/ws` | More predictable realtime proxy behavior | Static review, no tests run after user pause |
| After Dark count removal from hot path | `apps/api/src/services/after-dark.service.ts` | `assertUnlocked` counted all After Dark events on list/detail/join | `previewCount` is only part of access responses, not used by list/detail/join logic | Lower DB load in `/search` and After Dark flows | Static review, no tests run after user pause |
| Narrow worker entity reads | `apps/worker/src/worker.service.ts` | Push dispatch, notification realtime and media finalize loaded full rows | Worker now selects only fields each job uses | Smaller DB payload per worker job | Static review, no tests run after user pause |
| Narrow chat attachment validation | `apps/chat/src/chat-server.service.ts` | Attachment validation loaded full MediaAsset rows | Validation only needs id and chatId, status is in WHERE | Smaller DB payload in ws send path | Static review, no tests run after user pause |
| Narrow upload idempotency lookups | `apps/api/src/services/uploads.service.ts` | Upload complete conflict paths loaded full MediaAsset rows | Complete responses and assertions use a small fixed field set | Smaller DB payload in media complete flows | Static review, no tests run after user pause |
| Align upload interceptor limits | `apps/api/src/controllers/profile.controller.ts`, `apps/api/src/controllers/uploads.controller.ts` | Multer accepted files larger than service-level limits before service rejected them | Interceptor now rejects at the same limit already enforced by service | Less API memory pressure on rejected uploads | Static review, no tests run after user pause |
| Reuse serialized WebSocket payload | `apps/chat/src/chat-server.service.ts` | Broadcast serialized identical events once per socket | Shared payload events now stringify once and send the same string | Lower CPU during realtime fanout | Static review, no tests run after user pause |
| Guard WebSocket send errors | `apps/chat/src/chat-server.service.ts` | `socket.send` could throw after readyState check | Send is wrapped, failed socket is cleaned up | More stable realtime under disconnect races | Static review, no tests run after user pause |
| Narrow profile photo management reads | `apps/api/src/services/profile.service.ts` | Photo delete, primary and reorder loaded full ProfilePhoto rows | Queries now select only ids, order and media asset id where needed | Smaller DB payload in profile photo mutations | Static review, no tests run after user pause |
| Narrow poster cover asset reads | `apps/api/src/services/posters.service.ts` | Poster list/detail included full MediaAsset for cover | Cover relation now selects only fields used by media presenter | Smaller DB payload for `/posters` and `/search` poster group | Static review, no tests run after user pause |
| Narrow event mutation reads | `apps/api/src/services/events.service.ts` | Join, leave and invite flows loaded broad Event/EventJoinRequest rows | These flows now select only host, gender, invite status and chat id fields they use | Smaller DB payload in event mutation paths | Static review, no tests run after user pause |
| Avoid duplicate event message mapping | `apps/api/src/services/events.service.ts` | Decline invite flow mapped the same system message twice | Message is mapped once and reused for realtime/outbox payload | Slightly less CPU and allocation in invite decline path | Static review, no tests run after user pause |
| Document worker concurrency env | `backend/.env.example`, `.env.production.example` | Worker concurrency and batch knobs existed in code but were hidden from env examples | Added defaults matching current code behavior | Easier staging tuning without code change | Static review, no tests run after user pause |
| Narrow people list self preferences | `apps/api/src/services/people.service.ts` | People list loaded full onboarding preferences for current user | It only needs `interests` for common-interest matching | Smaller DB payload for `/people` | Static review, no tests run after user pause |
| Reuse batch social preview helper | `apps/api/src/services/people.service.ts` | Single profile social snapshot ran separate count/find queries | It now uses the existing grouped preview helper | Fewer DB roundtrips for `/people/:userId` and `/people/:userId/social` | Static review, no tests run after user pause |
| Narrow API chat message reads | `apps/api/src/services/chats.service.ts`, `apps/api/src/common/presenters.ts` | Chat list and message list loaded full sender and media asset relations | Presenter input type now accepts only fields it uses, response shape is unchanged | Smaller DB payload for `/chats/*` and `/chats/:chatId/messages` | Static review, no tests run after user pause |
| Narrow WebSocket message reads | `apps/chat/src/chat-server.service.ts` | Existing, created and updated ws messages loaded full sender and media asset rows | `mapMessage` uses a fixed subset, command behavior is unchanged | Smaller DB payload and allocations in ws send/update path | Static review, no tests run after user pause |
| Narrow event join/request reads | `apps/api/src/services/events.service.ts` | Join, create request and cancel request read wider event/request rows | Selects include the fields needed for access checks, notifications and response | Smaller DB payload in event mutations | Static review, no tests run after user pause |
| Narrow invite decline system message read | `apps/api/src/services/events.service.ts` | System message create included broad sender/media relations | Selects only fields required by `mapMessage` | Less allocation in invite decline realtime path | Static review, no tests run after user pause |
| Narrow evening template session route read | `apps/api/src/services/evening-route-template.service.ts` | Session creation loaded full route and full step rows | Flow only uses route title, step id and first step emoji | Smaller DB payload in session creation | Static review, no tests run after user pause |
| Narrow notifications list read | `apps/api/src/services/notifications.service.ts` | Notification list loaded full Notification rows | Response only uses id, kind, title, body, payload, readAt and createdAt | Smaller DB payload for `/notifications` | Static review, no tests run after user pause |
| Narrow push token delete lookup | `apps/api/src/services/notifications.service.ts` | Delete token read full PushToken row to check ownership | Ownership check only needs `userId` | Smaller DB payload in token cleanup endpoint | Static review, no tests run after user pause |
| Narrow worker push token reads | `apps/worker/src/worker.service.ts` | Push dispatch read full PushToken rows | Provider send only uses provider and token | Smaller DB payload in push jobs | Static review, no tests run after user pause |
| Narrow worker auto advance reads | `apps/worker/src/worker.service.ts` | Auto advance loaded full route and step rows | Transition logic only needs step id, time labels and venue | Smaller DB payload in scheduled scan | Static review, no tests run after user pause |
| S3 object cache metadata for server uploads | `apps/api/src/services/profile.service.ts`, `apps/api/src/services/uploads.service.ts` | Server-side PutObject calls had no cache policy | Object keys are UUID-based. Avatar files are public immutable, chat/story are private cache only | Better CDN/browser behavior without changing public API | Static review, no tests run after user pause |
| Sanitize request id header | `apps/api/src/common/request-context.middleware.ts` | `x-request-id` was accepted as an arbitrary string | Valid ids still pass through, invalid or oversized ids get a generated UUID | Lower log/header abuse risk | Static review, no tests run after user pause |
| Narrow host review/check-in reads | `apps/api/src/services/host.service.ts` | Host approve/reject notifications and manual check-in loaded full rows | Notification id and small attendance response fields are enough | Smaller DB payload in host moderation flows | Static review, no tests run after user pause |
| Narrow evening message and notification writes | `apps/api/src/services/evening.service.ts` | Evening chat publish loaded full message relations and notification rows | The realtime message presenter and outbox only need a fixed subset and notification id | Smaller DB payload in evening publish/request flows | Static review, no tests run after user pause |
| Narrow community reads | `apps/api/src/services/communities.service.ts` | Community list/detail loaded full root row and nested news, meetups, media, social links, members and chat message rows | Response uses a small fixed field set, pagination and visibility logic unchanged | Smaller DB payload for community list/detail/media | Static review, no tests run after user pause |
| Narrow public share query | `apps/api/src/services/shares.service.ts` | Public share loaded broad Event and EveningSession graphs | Public response only uses preview fields and public visibility checks | Smaller DB payload and less allocation for public share links | Static review, no tests run after user pause |
| Narrow safety mutation reads | `apps/api/src/services/safety.service.ts` | Safety report, block and SOS create paths returned full records | Responses use only ids, statuses and timestamps, outbox payloads unchanged | Smaller DB payload and less accidental field exposure | Static review, no tests run after user pause |
| Narrow live/check-in event reads | `apps/api/src/services/events.service.ts` | Live, check-in, after-party and feedback endpoints loaded full Event rows | Selected fields match response logic and membership checks are unchanged | Smaller DB payload on mobile live screens | Static review, no tests run after user pause |
| Narrow route AI candidate reads | `apps/api/src/services/evening-route-ai-candidates.service.ts` | Candidate selection loaded full Venue and Offer rows | Planner only needs venue metadata and active offer summary fields | Smaller DB payload for route generation support flow | Static review, no tests run after user pause |
| Narrow After Dark event reads | `apps/api/src/services/after-dark.service.ts` | After Dark list/detail loaded full Event rows | Mapper and unlock checks need a fixed Event field set, response shape is unchanged | Smaller DB payload in `/search` and After Dark screens | Static review, no tests run after user pause |
| Narrow host event summary reads | `apps/api/src/services/host.service.ts`, `apps/api/src/common/presenters.ts` | Host dashboard/detail loaded full Event rows for summary mapping | Presenter now accepts the field subset it uses, response shape is unchanged | Smaller DB payload for hosted event screens | Static review, no tests run after user pause |
| Narrow chat list reads | `apps/api/src/services/chats.service.ts` | Chat list loaded full Chat and ChatMember rows | Chat list only uses summary Chat fields, relation previews, member `userId` and user summary | Smaller DB payload for chat list endpoints | Static review, no tests run after user pause |
| Narrow event feed reads | `apps/api/src/services/events.service.ts`, `apps/api/src/common/presenters.ts` | Event feed loaded full Event and participant rows | Event summary presenter only needs a fixed Event field set and participant display names | Smaller DB payload for home feed and search meetups group | Static review, no tests run after user pause |
| Narrow event detail read | `apps/api/src/services/events.service.ts` | Event detail loaded full Event row | Detail response needs summary fields, description, partner fields and bounded relations | Smaller DB payload for details screen | Static review, no tests run after user pause |
| Narrow poster reads | `apps/api/src/services/posters.service.ts` | Poster list/detail loaded full Poster rows | Poster response uses a fixed public field set plus cover asset fields | Smaller DB payload for poster list and search group | Static review, no tests run after user pause |
| Narrow evening session participants | `apps/api/src/services/evening.service.ts` | Evening session mapper loaded full participant rows | It only needs participant `userId`, `role`, `status` and user display name | Smaller DB payload for evening session list/detail | Static review, no tests run after user pause |
| Narrow evening join request reads | `apps/api/src/services/evening.service.ts` | Evening join request create/approve paths returned full request rows | Response and notifications use only request id, status, user id and display name | Smaller DB payload in join moderation flows | Static review, no tests run after user pause |
| Narrow evening step action reads | `apps/api/src/services/evening.service.ts` | Perk, ticket and share actions loaded full step/action rows | They only need step preview/access fields and action state timestamps | Smaller DB payload for step action endpoints | Static review, no tests run after user pause |
| Narrow worker manual import polling | `apps/worker/src/content/content-import.service.ts` | Pending manual import polling loaded full source rows | Execution only needs run identifiers, city, metadata and source code | Smaller DB payload in worker polling | Static review, no tests run after user pause |
| Narrow evening lifecycle reads | `apps/api/src/services/evening.service.ts` | Evening start, join, finish, after-party, approve, check-in and advance paths loaded full route/session graphs | Each path now selects only the route/session/step fields it uses | Smaller DB payload in evening lifecycle flows | Static review, no tests run after user pause |
| Narrow evening route and step reads | `apps/api/src/services/evening.service.ts` | Route resolve/detail/session mapper loaded full route step rows | Shared Prisma select now matches the fields used by route and step mappers | Smaller DB payload for evening route screens and sessions | Static review, no tests run after user pause |
| Narrow content duplicate preload | `apps/worker/src/content/content-import.service.ts` | Duplicate detection loaded full `ExternalContentItem` rows for the daily preload window | Dedupe and enrichment use a fixed candidate field set, including raw and source metadata | Smaller DB payload and heap use during content import | Static review, no tests run after user pause |
| Narrow partner offer code reads | `apps/api/src/services/partner-offer-code.service.ts` | Offer-code issue/status/activation loaded full partner, venue and offer relations | DTO and analytics use ids, statuses, names and snapshots only | Smaller DB payload in evening perk-code flow | Static review, no tests run after user pause |
| Reuse route template session select | `apps/api/src/services/evening-route-template.service.ts` | Template session list used a local relation include | Existing `templateSessionSelect` already matches `mapTemplateSession` | Smaller DB payload and less query drift | Static review, no tests run after user pause |
| Narrow onboarding response reads | `apps/api/src/services/onboarding.service.ts` | Onboarding get/update upserts returned full preference rows | Mapper uses only answers plus user email and phone | Smaller DB payload in startup/onboarding flow | Static review, no tests run after user pause |
| Narrow worker system notification create | `apps/worker/src/worker.service.ts` | System notification helper returned full Notification row | Outbox fanout only needs notification id | Smaller DB payload in scheduled notification jobs | Static review, no tests run after user pause |
| Narrow dating/event notification fanout writes | `apps/api/src/services/dating.service.ts`, `apps/api/src/services/events.service.ts` | Like, invite and reject notification fanout returned full Notification or join request rows | Follow-up outbox writes only need ids | Smaller DB payload in notification-heavy mutation paths | Static review, no tests run after user pause |
| Enable API gzip in nginx | `deploy/nginx/frendly.conf` | API server blocks had no gzip config | JSON responses over 1 KB can be compressed by nginx while WebSocket stays unbuffered | Lower bandwidth and faster mobile list/search/feed responses | Static review, no tests run after user pause |

## Roadmap

### Phase 1, safe wins in 1-2 days

| Task | Files | Verify |
|------|-------|--------|
| Add API endpoint latency and payload size metrics | API interceptor | `/metrics`, smoke requests |
| Enable worker batch claim in staging | `.env.production.example`, compose env | Outbox lag, duplicate processing tests |
| Verify and enable unread counters | `chats.service.ts`, database scripts | `db:chat-unread:verify` |
| Add Redis publish/subscribe counters and error logs | `pubsub.ts`, chat/worker | Publish invalid JSON, Redis restart |
| Add ws backpressure metric and close policy | `chat-server.service.ts` | Slow socket test |
| Mask or sample noisy worker logs | worker content services | Test logs |
| Add nginx auth/upload rate limits in staging | `frendly.conf` | Smoke auth/upload |
| Add safe public media cache headers per asset class | S3/media services | Header checks |

### Phase 2, medium improvements

| Task | Files | Verify |
|------|-------|--------|
| Request-level cache for blocks/session-derived repeated reads | API guard/services | Prisma query count |
| Cursor pagination and slim DTO review for chat/profile | chat/profile services | Contract tests, mobile QA |
| Index review after EXPLAIN | Prisma migrations | `EXPLAIN (ANALYZE, BUFFERS)` |
| Push batching and invalid token cleanup | worker push providers | Provider sandbox tests |
| Async media finalize outbox flow | upload/profile/story services, worker | Upload complete latency, worker lag |
| CDN image variants | media pipeline | CDN hit ratio, Flutter visual QA |
| PgBouncer tuning | compose/env | PgBouncer pool stats |

### Phase 3, deep optimization

| Task | Files/Area | Verify |
|------|------------|--------|
| Refactor hot endpoints with measured query budgets | API services | load test |
| Materialized/read models for mobile home/search | PostgreSQL/API | stale data rules |
| Read replicas for read-heavy public content | infra/API | read consistency |
| Redis Streams/queue for guaranteed realtime jobs | Redis/worker/chat | delivery semantics |
| Chat fanout optimization | chat server | room fanout load test |
| Media processing pipeline | worker/S3/CDN | variant coverage |
| Autoscaling and cost dashboards | deploy/observability | cost per 1,000 requests |
| Full load tests | k6/autocannon/Artillery | p95/p99 with test data |

## Commands and checks

Commands that were run during this audit:

Note: after the user explicitly said not to test or build, no tests, builds, lint, Prisma commands, Docker commands or graph update were run. After that point only static reads, search, diffs and file edits were performed.

| Command | Status |
|---------|--------|
| `pnpm install --frozen-lockfile` | First run prompted for `node_modules` reinstall, `CI=true pnpm install --frozen-lockfile` passed |
| `pnpm -r build` | First run failed because Prisma Client was missing after reinstall, passed after `pnpm --filter @big-break/database prisma:generate` |
| `pnpm -r test` | Failed because integration/realtime tests need PostgreSQL on `localhost:5432`; unit suites inside that run passed before DB-bound failures |
| `pnpm -r --parallel test:unit` | Passed for packages that have `test:unit`: api 285, worker 74, database 22, telegram-relay 4 |
| `pnpm --filter @big-break/chat test -- test/unit/chat-server.service.unit.spec.ts --runInBand` | Passed, 19 tests |
| `pnpm --filter @big-break/worker test:unit -- push.providers.spec.ts --runInBand` | Passed, worker script ran 74 unit tests |
| `pnpm -r lint` | No selected package has `lint` script |
| `pnpm -r typecheck` | No selected package has `typecheck` script |
| `pnpm -r test:e2e` | No selected package has `test:e2e` script |
| `pnpm exec jest --runInBand` | Failed, root Jest command does not use package ts-jest configs, reads `dist`, 133 suites failed, 18 passed |
| `pnpm exec jest --detectOpenHandles` | Failed for the same root Jest config reason |
| `pnpm exec prisma validate --schema packages/database/prisma/schema.prisma` | Failed, root `pnpm exec` cannot find `prisma` |
| `pnpm exec prisma generate --schema packages/database/prisma/schema.prisma` | Failed, root `pnpm exec` cannot find `prisma` |
| `pnpm --filter @big-break/database prisma:generate` | Passed |
| `pnpm --filter @big-break/database exec prisma validate --schema prisma/schema.prisma` | Failed without env, missing `DATABASE_URL` |
| `DATABASE_URL=postgresql://bigbreak:bigbreak@localhost:5432/bigbreak?schema=public pnpm --filter @big-break/database exec prisma validate --schema prisma/schema.prisma` | Passed |
| `pnpm --filter @big-break/database exec prisma migrate status --schema prisma/schema.prisma` | Failed without env, missing `DATABASE_URL` |
| `DATABASE_URL=postgresql://bigbreak:bigbreak@localhost:5432/bigbreak?schema=public pnpm --filter @big-break/database exec prisma migrate status --schema prisma/schema.prisma` | Failed because local PostgreSQL was not available |
| `pnpm outdated` | Exit 1, outdated dev deps: `@types/jest`, `@types/node`, `jest`, `typescript` |
| `pnpm audit` | Exit 1, found 29 vulnerabilities: 13 high, 12 moderate, 4 low |
| `docker compose -f compose.yaml config` | Passed from project root |
| `docker compose -f compose.prod.yml --env-file .env.production.example config` | Passed from project root with example env only |
| `docker compose -f compose.yaml build api` | Passed, Dockerfile used lockfile and `pnpm install --frozen-lockfile` |
| `docker compose up` | Not run, it starts local services and can seed/mutate local DB |

Benchmark scripts: only database hot query script was found, `pnpm --filter @big-break/database db:perf:hot-queries`. It needs DB and `PERF_CHECK_USER_ID`, so it should run locally/staging with non-production data.

Minimal benchmark plan:

| Tool | Scenario |
|------|----------|
| autocannon | `/search`, `/events`, `/chats/meetups`, `/profile/me` smoke load |
| k6 | Mobile startup waterfall with auth token |
| Artillery | WebSocket connect, subscribe, send, sync, reconnect |
| Supertest smoke benchmark | query count and payload size guard in CI |

## Manual QA checklist

| Area | Scenario |
|------|----------|
| API shutdown | Start API, send SIGTERM, verify clean exit and Prisma disconnect |
| Chat heartbeat | Connect ws, authenticate, subscribe, cut network, verify stale socket cleanup and reconnect |
| Chat send | Send message, verify sender and receiver get realtime event |
| Slow ws client | Simulate high bufferedAmount, verify message is skipped and metric exists after next phase |
| Push logs | Use fake provider, verify token is masked |
| S3 direct upload | Presign, upload object, complete, open media |
| Worker outbox | Run worker with batch claim true in staging, verify no duplicate processing |
| Docker | Build api image from clean checkout |
| Nginx ws | Connect through `/ws`, keep connection idle past heartbeat interval |
