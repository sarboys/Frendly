# Infra Map

Use this for Docker, deploy, Redis, worker, S3, push, DB rollout and public routing.

## Fast paths

- Local stack: `compose.yaml`.
- Production stack: `compose.prod.yml`.
- Telegram relay stack: `compose.telegram-relay.yml`.
- Backend image: `backend/Dockerfile`.
- Landing image: `landing/Dockerfile`.
- Nginx routing: `deploy/nginx/frendly.conf`.
- Worker loop: `backend/apps/worker/src/worker.service.ts`.
- Push providers: `backend/apps/worker/src/push.providers.ts`.
- S3 helpers: `backend/packages/database/src/s3.ts`.
- Redis helpers: `backend/packages/database/src/pubsub.ts`.
- Outbox constants: `backend/packages/database/src/outbox.ts`.
- DB scripts: `backend/packages/database/src/concurrent-indexes.ts`, `hot-query-explain.ts`.

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
- Default worker path claims one event with lock.
- `WORKER_OUTBOX_BATCH_CLAIM=true` enables batch claim with `FOR UPDATE SKIP LOCKED`.
- `WORKER_OUTBOX_PROCESSING_CONCURRENCY` can raise concurrency after testing.
- `WORKER_RETENTION_CLEANUP_ENABLED=true` enables DB retention cleanup.

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
- Env: `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_PUBLIC_ENDPOINT`.

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

