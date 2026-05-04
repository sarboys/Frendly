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
- Scheduled content import interval defaults to four hours, `CONTENT_IMPORT_INTERVAL_MS=14400000`.
- Default scheduled content sources are `kudago,timepad,advcake_ticketland`. Overpass code remains available for explicit/manual import, but it is not in the default scheduled source list.
- Manual admin import creates `ExternalImportRun.status=pending_manual`; worker scans those runs and performs KudaGo, Timepad, AdvCake Ticketland or explicit Overpass fetches outside the API request path.
- Manual admin route generation creates `GeneratedRouteDraftBatch.status=pending_manual`; worker scans those batches and performs OpenRouter generation outside the API request path.
- If OpenRouter returns invalid JSON, an empty route or times out, worker saves a deterministic fallback review draft from a nearby imported candidate cluster instead of leaving the run failed when enough candidates exist. Place-only fallback uses a larger place pool and picks different categories inside one walkable area.
- Source env: `KUDAGO_BASE_URL`, `TIMEPAD_BASE_URL`, `TIMEPAD_API_TOKEN`, `OVERPASS_BASE_URL`, `ADVCAKE_API_PASS`, `ADVCAKE_BASE_URL`, `ADVCAKE_TICKETLAND_OFFER_ID`, `ADVCAKE_TICKETLAND_WEBSITES`, `ADVCAKE_FEED_FORMAT`, `ADVCAKE_FEED_MAX_BYTES`. The real AdvCake pass must stay only in env and must not be written to code, docs, tests or logs. `ADVCAKE_TICKETLAND_OFFER_ID=663` is the combined AdvCake offer for `ticketland.ru | live.mts.ru`.
- Route aggregation schedule env: `CONTENT_IMPORT_INTERVAL_MS`, `CONTENT_IMPORT_CITIES`, `CONTENT_IMPORT_SOURCES`, `CONTENT_MANUAL_IMPORT_INTERVAL_MS`, `CONTENT_MANUAL_GENERATION_INTERVAL_MS`, `CONTENT_ROUTE_GENERATION_INTERVAL_MS`, `CONTENT_ROUTE_GENERATION_MAX_DRAFTS_PER_CITY`, `CONTENT_ROUTE_GENERATION_STALE_RUNNING_MS`.

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
- Deploy script uses `flock` lock before Docker cleanup and compose recreate.
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

