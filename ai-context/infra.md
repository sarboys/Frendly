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

- `postgres`: persistent volume, `pg_stat_statements`, slow query logging, timeouts.
- `pgbouncer`: transaction pooling, internal port `6432`.
- `redis`: persistent volume.
- `migrate`: Prisma deploy, hot-path indexes, optional seed.
- `api`: internal port `3000`, health `/health`.
- `chat`: internal port `3001`, health `/health`.
- `worker`: internal port `3002`, health `/health`.
- API, chat and worker expose private `/metrics` endpoints for Prometheus scrapes inside the Docker network.
- `landing`: Vite static build served by nginx.
- `admin_internal`: `admin.frendly.tech`.
- `admin_partner`: `partner.frendly.tech`.
- `nginx`: public port `80`.

Runtime services use pooled DB URL through PgBouncer. Migrations and concurrent index scripts use direct DB URL.

Public routing:

- `frendly.tech`, `www.frendly.tech` -> landing.
- `api.frendly.tech`, direct IP, unknown hosts -> API.
- `admin.frendly.tech` -> internal admin.
- `partner.frendly.tech` -> partner admin.
- `/ws` on API host -> chat WebSocket.
- public `/metrics` on the API host is blocked in nginx and must not be exposed through `api.frendly.tech`.

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

Scrape targets:

- API `/metrics` on `api:3000`.
- Scale API `/metrics` on `api_a:3000` and `api_b:3000`.
- Chat `/metrics` on `chat:3001`.
- Scale chat `/metrics` on `chat_a:3001` and `chat_b:3001`.
- Worker `/metrics` on `worker:3002`.
- Scale workers `/metrics` on `worker_realtime:3002`, `worker_content:3002`, `worker_schedules:3002`.
- node exporter.
- postgres exporter.
- redis exporter.
- pgbouncer exporter.

Metrics privacy rules:

- labels may include service, endpoint, method, status class, job type, event type, operation and status.
- labels must not include user id, chat id, message id, token, media URL, object key, phone, email or request payload.
- Chat scale metrics include membership cache hit or miss, sync request status, WebSocket drops and payload warning counts. Payload labels stay at service, event type and direction only.

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

## T-Bank payments

- T-Bank secrets live only in env: `TBANK_TERMINAL_KEY`, `TBANK_PASSWORD`.
- Runtime env: `PAYMENTS_TBANK_ENABLED`, `TBANK_API_URL`, `TBANK_NOTIFICATION_URL`, `PUBLIC_API_URL`, `APP_DEEP_LINK_SCHEME`.
- Optional receipt env: `TBANK_RECEIPT_ENABLED`, `TBANK_RECEIPT_TAXATION`, `TBANK_RECEIPT_TAX`.
- API is the only service that calls T-Bank. Flutter receives only `paymentUrl` and order status.
- Keep `PAYMENTS_TBANK_ENABLED=false` until store channel policy and test terminal QA are done.

## Redis

- Env: `REDIS_URL`.
- Channel: `big-break:events`.
- Used by chat server and worker.
- Bus only, not primary storage.
- Main events: chat, notification, unread, attachment ready.

## Worker and outbox

- Queue table: `OutboxEvent`.
- Worker polls pending records, claims work, retries failures, marks done or failed.
- Default worker path uses batch claim with `FOR UPDATE SKIP LOCKED` when raw SQL is available.
- `WORKER_OUTBOX_BATCH_CLAIM=false` disables batch claim for sequential fallback.
- `WORKER_OUTBOX_PROCESSING_CONCURRENCY` can raise concurrency after testing.
- Worker logs `[worker-outbox-backlog-age]` when claimed outbox age exceeds `WORKER_OUTBOX_BACKLOG_WARN_AGE_MS`, default `300000`.
- `WORKER_PUSH_TOKEN_BATCH_SIZE` caps active push tokens loaded per dispatch, default `20`.
- `WORKER_RETENTION_CLEANUP_ENABLED=true` enables DB retention cleanup.
- Route aggregation runs in the existing worker. `CONTENT_IMPORT_ENABLED=false` and `CONTENT_ROUTE_GENERATION_ENABLED=false` keep scheduled import and generation off locally by default. Production compose enables scheduled import by default.
- Scheduled content import interval defaults to four hours, `CONTENT_IMPORT_INTERVAL_MS=14400000`. Set `CONTENT_IMPORT_DAILY_AT=HH:mm` to use a wall-clock daily import instead; production uses `00:00` with `CONTENT_IMPORT_TIME_ZONE=Europe/Moscow`.
- Default scheduled content sources are `kudago,timepad,advcake_ticketland`. Default production cities are `Москва,Санкт-Петербург,Екатеринбург,Нижний Новгород`. Overpass and Tomesto code remain available for explicit/manual import, but they are not in the default scheduled source list.
- Manual admin import creates `ExternalImportRun.status=pending_manual`; worker scans those runs and performs KudaGo, Timepad, AdvCake Ticketland, explicit Overpass or explicit Tomesto fetches outside the API request path.
- Tomesto rollout is opt-in and Moscow-only. Use `CONTENT_IMPORT_SOURCES=tomesto`, `CONTENT_IMPORT_CITIES=Москва`, `TOMESTO_REF_QUERY=...`, `TOMESTO_REQUEST_DELAY_MS=500`, `TOMESTO_CATALOG_REQUEST_DELAY_MS=150`, `TOMESTO_CATALOG_CONCURRENCY=5`, `TOMESTO_MAX_PAGES=10`, `TOMESTO_CATALOG_BATCH_SIZE=250`, `TOMESTO_CATALOG_FALLBACK_MAX_PAGES=250`, `TOMESTO_WINDOW_DAYS=30`, `TOMESTO_IMPORT_IMAGES=false`, `TOMESTO_PUBLIC_EVENTS_ENABLED=false`. Production compose passes these Tomesto env names and gives content import a 30 minute default timeout. Regular Tomesto import reads places, events and promos from list pages; events and promos stay hidden by default. Admin can also create `importMode=tomesto_places_catalog`, which reads `/moskva/sitemap.xml`, imports only direct place pages in batches with catalog concurrency, updates run counters after each imported batch, and worker queues the next pending run with the next catalog offset until the sitemap is exhausted. If a catalog run is interrupted and becomes stale, worker marks it failed and queues a resume run from the same catalog offset. Manual admin import is the safe first path. Places refresh without a date period; events and promos use the Tomesto date window. Promos import hidden until a promo surface exists. Expected logs: INFO for Moscow import start, sitemap discovered counts, catalog slice offsets, created runs, discovered counts and hidden counts, plus list-page 404 as pagination end; WARN for unsupported city, missing ref query, sitemap fallback or stale catalog resume; ERROR for other non-2xx Tomesto pages.
- External content import mirrors imported image URLs to S3 under `external-content/...` and stores the resulting public asset URL back in `ExternalContentItem.imageUrl` when mirroring succeeds. Public Affiche API returns owned mirrored URLs as CDN public asset URLs and uses the `/affiche/images` fallback proxy only for allowed third-party HTTPS image URLs. If image download or S3 write fails, import keeps the source image URL and does not fail the run.
- Manual admin route generation creates `GeneratedRouteDraftBatch.status=pending_manual`; worker scans those batches and performs OpenRouter generation outside the API request path.
- If OpenRouter returns invalid JSON, an empty route or times out, worker saves a deterministic fallback review draft from a nearby imported candidate cluster instead of leaving the run failed when enough candidates exist. Place-only fallback uses a larger place pool and picks different categories inside one walkable area.
- Source env: `KUDAGO_BASE_URL`, `TIMEPAD_BASE_URL`, `TIMEPAD_API_TOKEN`, `OVERPASS_BASE_URL`, `ADVCAKE_API_PASS`, `ADVCAKE_BASE_URL`, `ADVCAKE_TICKETLAND_OFFER_ID`, `ADVCAKE_TICKETLAND_WEBSITES`, `ADVCAKE_FEED_FORMAT`, `ADVCAKE_FEED_MAX_BYTES`, `TOMESTO_BASE_URL`, `TOMESTO_REF_QUERY`, `TOMESTO_REQUEST_DELAY_MS`, `TOMESTO_CATALOG_REQUEST_DELAY_MS`, `TOMESTO_CATALOG_CONCURRENCY`, `TOMESTO_MAX_PAGES`, `TOMESTO_CATALOG_BATCH_SIZE`, `TOMESTO_CATALOG_FALLBACK_MAX_PAGES`, `TOMESTO_WINDOW_DAYS`, `TOMESTO_IMPORT_IMAGES`, `TOMESTO_PUBLIC_EVENTS_ENABLED`. The real AdvCake pass and Tomesto ref query must stay only in env and must not be written to logs. `ADVCAKE_TICKETLAND_OFFER_ID=663` is the combined AdvCake offer for `ticketland.ru | live.mts.ru`.
- External image mirror env: `CONTENT_IMPORT_IMAGE_MAX_BYTES`, `CONTENT_IMPORT_IMAGE_TIMEOUT_MS`, `CONTENT_IMPORT_IMAGE_RETRY_COUNT`, `CONTENT_IMPORT_IMAGE_RETRY_DELAY_MS`, `CONTENT_IMPORT_IMAGE_USER_AGENT`, `CONTENT_IMPORT_IMAGE_BACKFILL_ENABLED`, `CONTENT_IMPORT_IMAGE_BACKFILL_BATCH_SIZE`. Only HTTPS images are mirrored. Ticketland MTS scaling URLs should fetch the nested source image URL from the `Url` query param.
- Affiche image fallback proxy env: `AFFICHE_IMAGE_PROXY_CACHE_SECONDS`, `AFFICHE_IMAGE_PROXY_STALE_SECONDS`, `AFFICHE_IMAGE_PROXY_USER_AGENT`.
- Route aggregation schedule env: `CONTENT_IMPORT_INTERVAL_MS`, `CONTENT_IMPORT_DAILY_AT`, `CONTENT_IMPORT_TIME_ZONE`, `CONTENT_IMPORT_CITIES`, `CONTENT_IMPORT_SOURCES`, `CONTENT_MANUAL_IMPORT_INTERVAL_MS`, `CONTENT_MANUAL_GENERATION_INTERVAL_MS`, `CONTENT_ROUTE_GENERATION_INTERVAL_MS`, `CONTENT_ROUTE_GENERATION_MAX_DRAFTS_PER_CITY`, `CONTENT_ROUTE_GENERATION_STALE_RUNNING_MS`.

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
cd backend && pnpm --filter @big-break/database db:verify:chat-unread
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
- `/media/:assetId` redirects non-inline assets to public or signed S3 URLs by default. Set `MEDIA_PROXY_STREAMING_ENABLED=true` to force API streaming fallback.

Uses:

- profile avatars and photos
- chat attachments and voice
- story media
- poster covers
- imported external content images

Flow:

1. API creates presigned PUT URL.
2. Client uploads directly.
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
- Env: `TELEGRAM_AUTH_ENABLED`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BACKEND_URL`, `TELEGRAM_INTERNAL_SECRET`, `TELEGRAM_RELAY_STATE_PATH`, `TELEGRAM_POLL_INTERVAL_MS`.

## Deploy

- Main workflow: `.github/workflows/deploy.yml`.
- Bootstrap: `scripts/bootstrap-server.sh`.
- Manual deploy: `scripts/deploy.sh`.
- Landing deploy: `scripts/deploy-landing.sh`.
- Landing workflow: `landing/.github/workflows/deploy.yml`.
- Production app path: `/opt/frendly`.
- Deploy workflow and script discard tracked local changes in server checkouts before switching to the target branch, then use `flock` before Docker cleanup and compose recreate.
- Scale compose: add `COMPOSE_EXTRA_FILES=/opt/frendly/compose.scale.yml` and `RUNTIME_SERVICES=api_a api_b chat_a chat_b worker_realtime worker_content worker_schedules landing admin_internal admin_partner`.
- Scale nginx config: `deploy/nginx/frendly.scale.conf` balances API and chat through `api_a/api_b` and `chat_a/chat_b`, while the default `deploy/nginx/frendly.conf` stays single-instance.
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

