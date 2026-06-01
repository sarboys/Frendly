# Infra Map

Use this for Docker, deploy, Redis, worker, S3, push, DB rollout and public routing.

For concrete files, run `./scripts/ua-query.mjs "infra <topic>"` first.

## Source of truth

- Compose files define local and production topology.
- `deploy/nginx/frendly.conf` defines public routing.
- Worker code owns async side effects.
- Database package owns Redis, S3, outbox and DB scripts.

## Local stack

Services:

- `postgres`, image `postgres:16-alpine`, port `5432`, DB `big_break`.
- `redis`, image `redis:7-alpine`, port `6379`.
- `migrate`, Prisma deploy plus seed.
- `api`, port `3000`.
- `chat`, port `3001`.
- `worker`, port `3002`.

Startup model:

```text
postgres + redis
  -> migrate
  -> api + chat + worker
```

## Production stack

- Local mode: `postgres` is a persistent container with `pg_stat_statements`, slow query logging and timeouts.
- Local mode: `pgbouncer` is a transaction pooler container on internal port `6432`.
- External DB mode: VPS1 runs app containers and Redis only. PostgreSQL 16, PostGIS and PgBouncer live on the DB host, currently `192.168.0.6`.
- `redis`: persistent volume.
- `migrate`: Prisma deploy, hot-path indexes, optional seed.
- `api`: internal port `3000`, health `/health`.
- `chat`: internal port `3001`, health `/health`.
- `worker`: internal port `3002`, health `/health`.
- Production images build TypeScript during Docker build. Runtime API, chat and worker use `start:prod` and run compiled JS from `dist`, not `ts-node`.
- API, chat and worker expose private `/metrics` endpoints for Prometheus scrapes inside the Docker network.
- `landing`: Vite static build served by nginx.
- `admin_internal`: `admin.frendly.tech`.
- `admin_partner`: `partner.frendly.tech`.
- `nginx`: public port `80`.

Runtime API and worker services use pooled DB URL through PgBouncer. In external DB mode this points to `192.168.0.6:6432`. Migrations and concurrent index scripts use direct DB URL. In external DB mode this points to `192.168.0.6:5432`.
Chat runtime can override the shared pooled URL with `CHAT_DATABASE_POOL_URL`. Current high-load chat evidence uses a direct Postgres URL to `192.168.0.6:5432` with Prisma `connection_limit=10` for each chat container. This avoids PgBouncer becoming the `message.send` write bottleneck while keeping the DB connection budget below Postgres `max_connections=120`.
With 8 chat containers, direct chat can use up to 80 Postgres connections. DB-host PgBouncer still serves API and worker traffic. Testing `connection_limit=12` improved combined chat ACK drain a little but drove DB connections to 117-119, too close to the current limit, so release env should stay at 10 unless DB sizing is changed.
If `ENABLE_POSTGIS_EVENT_FEED=true`, deploy runs `db:verify:postgis:event-geo` through the migrate image before runtime containers start.

Public routing:

- `frendly.tech`, `www.frendly.tech` -> landing.
- `api.frendly.tech`, direct IP, unknown hosts -> API.
- `admin.frendly.tech` -> internal admin.
- `admin.frendly.tech/metrics` -> Grafana when observability is running and Grafana is configured with `GRAFANA_ROOT_URL=https://admin.frendly.tech/metrics/` plus `GRAFANA_SERVE_FROM_SUB_PATH=true`.
- `partner.frendly.tech` -> partner admin.
- `/ws` on API host -> chat WebSocket.
- public `/metrics` on the API host is blocked in nginx and must not be exposed through `api.frendly.tech`.
- Scale nginx uses `worker_connections 65535` with high `worker_rlimit_nofile`. 15000 proxied WebSockets can need more than 30000 nginx connections because each client socket also has an upstream socket.
- Scale nginx keeps normal API and `/events` proxy read/send timeouts at 210 seconds like the base production nginx config. Do not lower these timeouts for RPS tests; the RPS-critical scale settings are upstream keepalive, `least_conn`, disabled access logs, disabled gzip and high worker connection limits.

## Observability

- Compose file: `compose.observability.yml`.
- Prometheus config: `deploy/observability/prometheus.yml`.
- Grafana dashboards: `deploy/observability/grafana/dashboards/`.
- Grafana provisioning: `deploy/observability/grafana/provisioning/`.
- Grafana notes: `deploy/observability/grafana/README.md`.
- Observability stack joins Docker network `frendly-backend_default` through `OBSERVABILITY_NETWORK`.
- Grafana automatically provisions the `Prometheus` datasource with uid `prometheus` and loads Frendly dashboards from the dashboard directory.

Default local bindings:

- Prometheus: `127.0.0.1:9090`.
- Grafana: `127.0.0.1:3009`.

Production admin subpath:

- nginx proxies `admin.frendly.tech/metrics/` to the Grafana container through Docker DNS.
- Grafana must serve from the `/metrics/` subpath with `GRAFANA_ROOT_URL=https://admin.frendly.tech/metrics/` and `GRAFANA_SERVE_FROM_SUB_PATH=true`.
- nginx uses runtime DNS for Grafana so the main app stack can still start when the observability stack is not running.

Scrape targets:

- API `/metrics` on `api:3000`.
- Release scale API `/metrics` on `api_a:3000` through `api_h:3000`.
- Chat `/metrics` on `chat:3001`.
- Scale chat `/metrics` on `chat_a:3001` through `chat_h:3001`.
- Worker `/metrics` on `worker:3002`.
- Scale workers `/metrics` on `worker_realtime:3002`, `worker_content:3002`, `worker_schedules:3002`.
- node exporter.
- postgres exporter.
- redis exporter.
- pgbouncer exporter.

Metrics privacy rules:

- labels may include service, endpoint, method, status class, job type, event type, operation and status.
- labels must not include user id, chat id, message id, token, media URL, object key, phone, email or request payload.
- Chat scale metrics include membership cache hit or miss, sync request status, WebSocket drops, payload warning counts and message write pipeline gauges. Payload labels stay at service, event type and direction only. Worker chat unread fanout uses incremental `ChatMember.unreadCount` updates for new message payloads with `messageCreatedAt`; older payloads fall back to full unread recount. High-load release env uses batch outbox claim with `WORKER_MAX_EVENTS_PER_RUN=1000` and `WORKER_OUTBOX_PROCESSING_CONCURRENCY=16`.

Validation:

```bash
docker compose -f compose.observability.yml config
```

Use real exporter connection strings only through env, never in repo files.

## Load smoke

- Hot path script: `backend/scripts/perf-hotpaths.mjs`.
- Combined smoke runner: `backend/scripts/perf-20k-smoke.mjs`.
- Report template: `docs/audits/scale-20k-readiness-template.md`.

Main scenarios:

- `startup`: `/profile/me`, unread count, Home events, Dating preview, route templates, Affiche preview.
- `dating`: `/dating/discover`.
- `map-viewport`: rounded coordinate event feed.
- `affiche`: `/affiche/events`.
- `routes`: `/evening/route-templates`.
- `chat-history`: `/chats/:chatId/messages`.
- `media-reuse`: repeated public media HEAD and private media download URL.
- `chat-send`: WebSocket send ack.
- `fanout`: WebSocket broadcast fanout.

Example:

```bash
cd backend && node scripts/perf-20k-smoke.mjs --api https://api.frendly.tech --token TOKEN
```

Do not commit real tokens or production smoke output with secrets.

Latest VPS1 scale evidence:

- 1500 RPS mixed for 60 seconds passed with 4 load generators at 375 RPS each. Total was 90000 requests, 90000 ok, 0 errors, 0 timeouts. Per-generator p95 was 204-222 ms and p99 was 600-656 ms. API containers were mostly 58-77% CPU, nginx about 19-25%, DB showed no lock or pool wait bottleneck.
- A single 1500 RPS generator for 60 seconds is not valid evidence for failure. It previously timed out while the load container itself saturated CPU. Use distributed generators for 1500 RPS HTTP checks.
- `/events` isolated at 1500 RPS for 30 seconds passed with 0 errors. Event SQL was cheap in `pg_stat_statements`, while p99 came from API CPU and queueing. The event base feed cache is active because only a small fraction of requests reached event SQL.
- `/profile/me` isolated at 1500 RPS passed only cleanly with 4 load generators after adding the 1 second process-local profile cache. Two 750 RPS generators can become client-limited on the larger JSON response.
- Durable chat `message.send` at a 5000/sec target with 16 generators passed correctness, but not stable 5000/sec rate. The 30 second run after dropping redundant `OutboxEvent` status indexes sent 149760 messages, got 149760 ACKs, had 0 errors and 0 pending, and reached about 4780-4820 actual sends/sec. A 15 second control with 800 sockets sent 74880 messages, got 74880 ACKs, and had 0 pending or errors at about 4.8k/sec. DB evidence points at Postgres WAL writes as the remaining limiter.

## T-Bank payments

- T-Bank secrets live only in env: `TBANK_TERMINAL_KEY`, `TBANK_PASSWORD`.
- Runtime env: `PAYMENTS_TBANK_ENABLED`, `TBANK_API_URL`, `TBANK_NOTIFICATION_URL`, `PUBLIC_API_URL`, `APP_DEEP_LINK_SCHEME`.
- Optional receipt env: `TBANK_RECEIPT_ENABLED`, `TBANK_RECEIPT_TAXATION`, `TBANK_RECEIPT_TAX`.
- API is the only service that calls T-Bank. Flutter receives only `paymentUrl` and order status.
- Keep `PAYMENTS_TBANK_ENABLED=false` until store channel policy and test terminal QA are done.

## Redis

- Env: `REDIS_URL`.
- Production memory knobs: `REDIS_MAXMEMORY`, `REDIS_MAXMEMORY_POLICY`, `REDIS_CONTAINER_MEMORY_LIMIT`.
- On VPS1 with `8 CPU / 12 GB RAM`, start with `REDIS_MAXMEMORY=1536mb`, `REDIS_MAXMEMORY_POLICY=allkeys-lru` and `REDIS_CONTAINER_MEMORY_LIMIT=2g`.
- Channel: `big-break:events`.
- Used by chat server, worker and API feed cache.
- Redis is not primary storage. Current Redis code publishes and subscribes transient events, stores short TTL `events:feed:v1:*` base feed cache entries and keeps `events:feed-version:v1:<city>` counters for coarse event feed invalidation. Durable product data stays in Postgres.
- Main events: chat, notification, unread, attachment ready.
- If future durable Redis keys without TTL appear, use `volatile-lru` instead of `allkeys-lru`.

## Worker and outbox

- Queue table: `OutboxEvent`.
- Worker polls pending records, claims work, retries failures, marks done or failed.
- Default worker path uses batch claim with `FOR UPDATE SKIP LOCKED` when raw SQL is available.
- `WORKER_OUTBOX_BATCH_CLAIM=false` disables batch claim for sequential fallback.
- `WORKER_OUTBOX_PROCESSING_CONCURRENCY` can raise concurrency after testing.
- Hot outbox claiming uses partial indexes `OutboxEvent_pending_available_createdAt_id_idx` and `OutboxEvent_processing_lockedAt_id_idx`. The older full status indexes `OutboxEvent_status_availableAt_createdAt_idx` and `OutboxEvent_status_lockedAt_idx` were removed from Prisma schema and dropped on VPS1 because they added write/WAL cost while the hot worker path used the partial indexes. After large `message.send` tests, stale tuples in these partial indexes made empty worker claim rise to about 74 ms until `VACUUM ANALYZE`; `OutboxEvent` now has lower per-table autovacuum thresholds so claim stays cheap after bursty `pending -> done` updates.
- Worker logs `[worker-outbox-backlog-age]` when claimed outbox age exceeds `WORKER_OUTBOX_BACKLOG_WARN_AGE_MS`, default `300000`.
- `WORKER_PUSH_TOKEN_BATCH_SIZE` caps active push tokens loaded per dispatch, default `20`.
- `WORKER_RETENTION_CLEANUP_ENABLED=true` enables DB retention cleanup.
- Route aggregation runs in the existing worker. `CONTENT_IMPORT_ENABLED=false` and `CONTENT_ROUTE_GENERATION_ENABLED=false` keep scheduled import and generation off locally by default. Production compose enables scheduled import by default.
- Scheduled content import supports a weekly wall-clock mode. Production uses `CONTENT_IMPORT_WEEKLY_DAY=0`, `CONTENT_IMPORT_WEEKLY_AT=20:00` and `CONTENT_IMPORT_TIME_ZONE=Europe/Moscow`, then imports the next Moscow calendar week from Monday `00:00` to the following Monday `00:00`.
- Default scheduled content sources are `kudago,advcake_ticketland`. Default production cities are the 30-city product list from `@big-break/database` `content-city-catalog`: Москва, Санкт-Петербург, Барнаул, Волгоград, Воронеж, Екатеринбург, Ижевск, Казань, Калининград, Кемерово, Краснодар, Красноярск, Махачкала, Набережные Челны, Нижний Новгород, Новосибирск, Омск, Пермь, Ростов-на-Дону, Самара, Саратов, Сочи, Ставрополь, Тольятти, Томск, Тюмень, Ульяновск, Уфа, Челябинск, Ярославль. KudaGo runs only for cities with a KudaGo code.
- Manual admin import creates `ExternalImportRun.status=pending_manual`; worker scans those runs and performs KudaGo, AdvCake Ticketland or explicit Tomesto fetches outside the API request path. Timepad and Overpass are no longer accepted for new manual imports.
- Tomesto is kept as an explicit manual import source and uses per-city slugs from `content-city-catalog`, for example `spb`, `nnovgorod`, `nabchelny`, `mahachkala`, `rostov`. Use `TOMESTO_REF_QUERY=...`, `TOMESTO_REQUEST_DELAY_MS=500`, `TOMESTO_CATALOG_REQUEST_DELAY_MS=150`, `TOMESTO_CATALOG_CONCURRENCY=5`, `TOMESTO_MAX_PAGES=10`, `TOMESTO_CATALOG_BATCH_SIZE=250`, `TOMESTO_CATALOG_FALLBACK_MAX_PAGES=250`, `TOMESTO_WINDOW_DAYS=30`, `TOMESTO_IMPORT_IMAGES=true`, `TOMESTO_PUBLIC_EVENTS_ENABLED=false`. Production compose passes these Tomesto env names and gives content import a 30 minute default timeout. Regular Tomesto import reads places, events and promos from list pages; events and promos stay hidden by default. Admin can also create `importMode=tomesto_places_catalog`, which reads `/<citySlug>/sitemap.xml`, imports only direct place pages in batches with catalog concurrency, updates run counters after each imported batch, and worker queues the next pending run with the next catalog offset until the sitemap is exhausted. If a catalog run is interrupted and becomes stale, worker marks it failed and queues a resume run from the same catalog offset. Manual admin import remains useful for smoke checks. Places refresh without a date period; Tomesto pages marked closed are stored with `raw.status.closed=true` and imported hidden. Events and promos use the Tomesto date window. Promos import hidden until a promo surface exists. Public attach candidates without valid coordinates are hidden during import, but raw rows are still upserted and `missingCoordsCount` still tracks them. Expected logs: INFO for import start with city and cityCode, sitemap discovered counts, catalog slice offsets, created runs, discovered counts and hidden counts, plus list-page 404 as pagination end; WARN for missing ref query, sitemap fallback or stale catalog resume; ERROR for other non-2xx Tomesto pages.
- External content import mirrors imported image URLs to S3 under `external-content/...` and stores the resulting public asset URL back in `ExternalContentItem.imageUrl` when mirroring succeeds. Public Affiche API returns owned mirrored URLs as CDN public asset URLs and uses the `/affiche/images` fallback proxy only for allowed third-party HTTPS image URLs. If image download or S3 write fails, import keeps the source image URL and does not fail the run. Permanent image 404 or 410 clears `ExternalContentItem.imageUrl` so content backfill does not keep retrying dead third-party media.
- Manual admin route generation creates `GeneratedRouteDraftBatch.status=pending_manual`; worker scans those batches and performs OpenRouter generation outside the API request path.
- If OpenRouter returns invalid JSON, an empty route or times out, worker saves a deterministic fallback review draft from a nearby imported candidate cluster instead of leaving the run failed when enough candidates exist. Place-only fallback uses a larger place pool and picks different categories inside one walkable area.
- Source env: `KUDAGO_BASE_URL`, `TIMEPAD_BASE_URL`, `TIMEPAD_API_TOKEN`, `OVERPASS_BASE_URL`, `ADVCAKE_API_PASS`, `ADVCAKE_BASE_URL`, `ADVCAKE_TICKETLAND_OFFER_ID`, `ADVCAKE_TICKETLAND_WEBSITES`, `ADVCAKE_FEED_FORMAT`, `ADVCAKE_FEED_MAX_BYTES`, `TOMESTO_BASE_URL`, `TOMESTO_REF_QUERY`, `TOMESTO_REQUEST_DELAY_MS`, `TOMESTO_CATALOG_REQUEST_DELAY_MS`, `TOMESTO_CATALOG_CONCURRENCY`, `TOMESTO_MAX_PAGES`, `TOMESTO_CATALOG_BATCH_SIZE`, `TOMESTO_CATALOG_FALLBACK_MAX_PAGES`, `TOMESTO_WINDOW_DAYS`, `TOMESTO_IMPORT_IMAGES`, `TOMESTO_PUBLIC_EVENTS_ENABLED`, `NOMINATIM_GEOCODER_ENABLED`, `NOMINATIM_BASE_URL`, `NOMINATIM_USER_AGENT`, `NOMINATIM_RATE_LIMIT_MS`, `YANDEX_GEOCODER_API_KEY`, `CONTENT_GEOCODER_API_KEY`, `YANDEX_GEOCODER_BASE_URL`, `CONTENT_GEOCODER_TIMEOUT_MS`. The real AdvCake pass, Tomesto ref query and geocoder keys must stay only in env and must not be written to logs. `ADVCAKE_TICKETLAND_OFFER_ID=663` is the combined AdvCake offer for `ticketland.ru | live.mts.ru`. Geocoder env is shared by API and worker through `@big-break/database` `VenueGeocoderClient`: API keeps Nominatim disabled by default via `API_NOMINATIM_GEOCODER_ENABLED=false` and uses Yandex for manual `POST /events` address resolution; worker uses Nominatim only for paid Ticketland rows without coordinates. Worker import and daily backfill first try an exact place match in DB, then Nominatim by `city + venueName` for reliable Ticketland venue names, then Yandex for address or fallback queries. Nominatim requires `NOMINATIM_USER_AGENT`, uses `countrycodes=ru`, validates result bbox and place-like categories, caches identical `city + venueName` queries in process and keeps a single worker-wide rate limit from `NOMINATIM_RATE_LIMIT_MS`, default `1200`. The daily worker backfill runs with `CONTENT_GEOCODER_BACKFILL_ENABLED=true`, `CONTENT_GEOCODER_BACKFILL_DAILY_AT=22:00` and `CONTENT_GEOCODER_DAILY_LIMIT=1000`; it scans future paid Ticketland rows without coordinates, prioritizes Москва, then Санкт-Петербург, then other cities, and stops for the day on Nominatim or Yandex 403 or 429.
- External image mirror env: `CONTENT_IMPORT_IMAGE_MAX_BYTES`, `CONTENT_IMPORT_IMAGE_TIMEOUT_MS`, `CONTENT_IMPORT_IMAGE_RETRY_COUNT`, `CONTENT_IMPORT_IMAGE_RETRY_DELAY_MS`, `CONTENT_IMPORT_IMAGE_USER_AGENT`, `CONTENT_IMPORT_IMAGE_BACKFILL_ENABLED`, `CONTENT_IMPORT_IMAGE_BACKFILL_BATCH_SIZE`. Only HTTPS images are mirrored. Ticketland MTS scaling URLs should fetch the nested source image URL from the `Url` query param.
- Affiche image fallback proxy env: `AFFICHE_IMAGE_PROXY_CACHE_SECONDS`, `AFFICHE_IMAGE_PROXY_STALE_SECONDS`, `AFFICHE_IMAGE_PROXY_USER_AGENT`.
- Route aggregation schedule env: `CONTENT_IMPORT_INTERVAL_MS`, `CONTENT_IMPORT_DAILY_AT`, `CONTENT_IMPORT_WEEKLY_DAY`, `CONTENT_IMPORT_WEEKLY_AT`, `CONTENT_IMPORT_TIME_ZONE`, `CONTENT_IMPORT_CITIES`, `CONTENT_IMPORT_SOURCES`, `CONTENT_GEOCODER_BACKFILL_ENABLED`, `CONTENT_GEOCODER_BACKFILL_DAILY_AT`, `CONTENT_GEOCODER_DAILY_LIMIT`, `NOMINATIM_GEOCODER_ENABLED`, `NOMINATIM_BASE_URL`, `NOMINATIM_USER_AGENT`, `NOMINATIM_RATE_LIMIT_MS`, `CONTENT_MANUAL_IMPORT_INTERVAL_MS`, `CONTENT_MANUAL_GENERATION_INTERVAL_MS`, `CONTENT_ROUTE_GENERATION_INTERVAL_MS`, `CONTENT_ROUTE_GENERATION_MAX_DRAFTS_PER_CITY`, `CONTENT_ROUTE_GENERATION_STALE_RUNNING_MS`.

Event types:

- `media.finalize`
- `push.dispatch`
- `unread.fanout`
- `message.notification_fanout`
- `notification.create`
- `realtime.publish`
- `attachment.ready`

Worker owns async side effects. Do not put push, unread fanout or S3 finalize on request hot paths without a direct product reason.

## DB rollout commands

```bash
cd backend && pnpm --filter @big-break/database db:deploy
cd backend && pnpm --filter @big-break/database db:indexes:hot-path
cd backend && pnpm --filter @big-break/database db:backfill:chat-unread
cd backend && pnpm --filter @big-break/database db:backfill:private-media-public-urls
cd backend && pnpm --filter @big-break/database db:verify:chat-unread
cd backend && pnpm --filter @big-break/database db:verify:private-media-public-urls
cd backend && pnpm --filter @big-break/database db:verify:postgis:event-geo
cd backend && pnpm --filter @big-break/database db:cleanup:retention
cd backend && pnpm --filter @big-break/database db:perf:hot-queries
cd backend && pnpm --filter @big-break/database db:postgis:event-geo
```

Concurrent index scripts must not run inside a transaction wrapper.

## S3 compatible storage

- Helper: `backend/packages/database/src/s3.ts`.
- Production endpoint: `https://s3.twcstorage.ru`.
- Region: `ru-1`.
- Bucket: `frendly-backet`.
- Env: `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_PUBLIC_ENDPOINT`, `S3_CDN_ENDPOINT`.
- Production requires explicit `S3_BUCKET`; uploads and `HeadObject` use `getS3Config().bucket`.
- `S3_PUBLIC_ENDPOINT` is the S3-compatible public API endpoint used for presigned upload/download URLs.
- `S3_CDN_ENDPOINT` is optional and only builds public read URLs for assets served through CDN.
- Public asset URLs must be built through `buildPublicAssetUrl`, not by string concatenation. The helper prefers `S3_CDN_ENDPOINT` when set, normalizes trailing slashes on S3/CDN endpoints and URL-encodes object key path segments.
- Presigned PUT responses include every header the client must send to S3. When `cacheControl` is set, `createPresignedUpload` signs `CacheControl` and returns `headers['cache-control']`. Profile avatars and photos use `public, max-age=31536000, immutable`; chat, story and verification media use `private, max-age=300`.
- Private media assets such as chat attachments, voice, story media and verification files keep `publicUrl=null` in DB even when uploaded to S3. Reads go through signed download URLs or authenticated `/media/:assetId`.
- Existing private media with stale `publicUrl` can be checked with `pnpm --filter @big-break/database db:verify:private-media-public-urls` and cleaned with `pnpm --filter @big-break/database db:backfill:private-media-public-urls`.
- Before enabling mobile direct uploads with `cache-control`, verify bucket CORS with `pnpm --filter @big-break/database s3:verify-upload-cors`. CORS must allow `PUT`, `content-type` and `cache-control`.
- `/media/:assetId` redirects public non-inline assets to their stored public URL, normally CDN, and private assets to signed S3 URLs by default. Set `MEDIA_PROXY_STREAMING_ENABLED=true` to force API streaming fallback.

Uses:

- profile avatars and photos
- chat attachments and voice
- story media
- Drop images
- poster covers
- imported external content images

Flow:

1. API creates presigned PUT URL and upload headers.
2. Client uploads directly and sends all returned headers.
3. Client calls complete endpoint.
4. Worker can verify object through `HeadObject`.
5. Reads use public URL, `/media/:assetId`, or signed download URL.

## Push

- Provider code: `backend/apps/worker/src/push.providers.ts`.
- Providers: `fake`, `fcm`, `apns`.
- FCM env: `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`.
- APNS env: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID`.
- Push tokens stored in `PushToken`.
- API: `POST /push-tokens`, `DELETE /push-tokens/:tokenId`, `DELETE /push-tokens/device/:deviceId`.
- DB keeps one non-null `deviceId` token per user with a partial unique index.
- Worker respects settings and block checks before push.

## Telegram relay

- App: `backend/apps/telegram-relay/`.
- Compose: `compose.telegram-relay.yml`.
- Production host: `64.188.61.111`.
- Production path: `/opt/frendly-telegram`.
- Internal port: `3003`.
- State file: `/data/telegram-relay-state.json`.
- Calls API `/internal/telegram/dispatch`.
- Env: `TELEGRAM_AUTH_ENABLED`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_BACKEND_URL`, `TELEGRAM_INTERNAL_SECRET`, `TELEGRAM_RELAY_STATE_PATH`, `TELEGRAM_POLL_INTERVAL_MS`.
- Telegram support reuses the relay. Optional env: `TELEGRAM_SUPPORT_ENABLED`, `TELEGRAM_SUPPORT_BOT_USERNAME`; required for forwarding user messages to operators: `TELEGRAM_SUPPORT_GROUP_CHAT_ID`. Do not commit bot tokens.

## Deploy

- Main workflow: `.github/workflows/deploy.yml`.
- Bootstrap: `scripts/bootstrap-server.sh`.
- Manual deploy: `scripts/deploy.sh`.
- Landing deploy: `scripts/deploy-landing.sh`.
- Landing workflow: `landing/.github/workflows/deploy.yml`.
- Production app path: `/opt/frendly`.
- Deploy workflow and script discard tracked local changes in server checkouts before switching to the target branch, then use `flock` before Docker cleanup and compose recreate.
- `scripts/deploy.sh` waits for `http://127.0.0.1/health` after compose recreate before returning. Defaults: `HEALTHCHECK_RETRIES=60`, `HEALTHCHECK_DELAY_SECONDS=5`, `HEALTHCHECK_TIMEOUT_SECONDS=10`.
- Release scale compose: add `COMPOSE_EXTRA_FILES=compose.scale.yml` and `RUNTIME_SERVICES=api_a api_b api_c api_d api_e api_f api_g api_h chat_a chat_b chat_c chat_d chat_e chat_f chat_g chat_h worker_realtime worker_content worker_schedules landing admin_internal admin_partner`. For the 1500 message/sec chat gate, set `WORKER_REALTIME_SCALE=4`; deploy passes it as `--scale worker_realtime=4`.
- In scale mode, `RUNTIME_SERVICES` must not include base `api`, `chat` or `worker`; `scripts/deploy.sh` rejects that combination.
- External DB mode uses `CORE_SERVICES=redis`. This keeps local `postgres` and local `pgbouncer` stopped while `migrate` runs with `--no-deps` against the direct external DB URL.
- Rollback to local DB mode uses `CORE_SERVICES=postgres redis pgbouncer`, `POSTGRESQL_HOST=postgres`, a local `DATABASE_DIRECT_URL` to `postgres:5432` and a local `DATABASE_POOL_URL` to `pgbouncer:6432`.
- Release scale nginx config: `deploy/nginx/frendly.scale.conf` balances API through `api_a` to `api_h` and chat through `chat_a` to `chat_h`, while the default `deploy/nginx/frendly.conf` stays single-instance.
- `scripts/deploy.sh` and `scripts/deploy-landing.sh` both read `COMPOSE_EXTRA_FILES` and `NGINX_SERVICE` from env or `.env.production`.
- Worker role gates: `WORKER_OUTBOX_ENABLED`, `WORKER_CONTENT_ENABLED`, `WORKER_SCHEDULES_ENABLED`.
- Landing repo syncs from `https://github.com/sarboys/frendly_landing.git`.

## Checks

```bash
cd backend && pnpm --filter @big-break/api build
cd backend && pnpm --filter @big-break/api test:unit
cd backend && pnpm --filter @big-break/chat test
cd backend && pnpm --filter @big-break/worker test
cd backend && pnpm --filter @big-break/database prisma:generate
```

Update this file if compose topology, env names, public routes, worker events, S3 behavior, Redis usage or DB rollout commands change.
