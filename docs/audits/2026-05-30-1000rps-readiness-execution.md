# 1000 RPS Readiness Execution

Date: 2026-05-30

## Scope

This report covers the first execution block:

- Task 1 baseline.
- Task 2 scale runtime guard.
- Task 3 external DB host preparation.
- Task 4 nginx scale tuning.
- Task 5A Redis memory limit.
- Task 6 Redis cache service.
- Task 7 event feed cache keys.
- Task 8 `/events` base feed cache.
- Task 9 PostGIS rollout on current VPS1 DB.
- Task 10 event feed cache invalidation.
- Task 13 mixed fixed-rate load tool.
- PostGIS rollout guard.

No secrets, full database URLs, passwords or auth headers are stored here.

## DB Host Access

DB host reached through:

```bash
ssh -J vps1 root@192.168.0.6
```

Observed host:

- Hostname: `msk-1-vm-4kql`.
- CPU: 4.
- RAM: 7.8 GiB total.
- Root disk: 77G, about 75G free before install.
- Private IP: `192.168.0.6/24` on `eth1`.

## DB Host Setup

Installed on `192.168.0.6`:

- PostgreSQL 16.
- PostgreSQL client 16.
- PostGIS 3.
- PostgreSQL contrib.
- PgBouncer.

Configured PostgreSQL:

- `listen_addresses = '127.0.0.1,192.168.0.6'`.
- `shared_preload_libraries = 'pg_stat_statements'`.
- `shared_buffers = 2GB`.
- `effective_cache_size = 6GB`.
- `work_mem = 16MB`.
- `maintenance_work_mem = 512MB`.
- `max_connections = 120`.
- `statement_timeout = '5s'`.
- `idle_in_transaction_session_timeout = '15s'`.

Configured PgBouncer:

- Listen address: `192.168.0.6`.
- Listen port: `6432`.
- Pool mode: `transaction`.
- `max_client_conn = 1500`.
- `default_pool_size = 30`.
- `reserve_pool_size = 10`.

Created the production DB role and database from VPS1 production env values without printing the password.

Enabled extensions:

- `pg_stat_statements`.
- `postgis`.

Firewall:

- SSH remains open.
- `5432/tcp` allowed from `192.168.0.5`.
- `6432/tcp` allowed from `192.168.0.5`.

Verification:

- `postgresql` active.
- `pgbouncer` active.
- DB host listens on `192.168.0.6:5432` and `192.168.0.6:6432`.
- VPS1 can connect to both ports.
- `SHOW POOLS` works through DB-host PgBouncer.

## Not Cut Over Yet

Production env was not switched to external DB mode in this block.

Data was not dumped or restored yet. Do this only in a short maintenance window.

Current local `postgres_data` on VPS1 must be kept until external DB is verified under load and backed up.

## Rollback

To rollback to local Postgres and local PgBouncer:

- Restore `CORE_SERVICES=postgres redis pgbouncer`.
- Set `POSTGRESQL_HOST=postgres`.
- Point `DATABASE_DIRECT_URL` to local `postgres:5432`.
- Point `DATABASE_POOL_URL` to local `pgbouncer:6432`.
- Do not delete the VPS1 `postgres_data` volume until the external DB is verified and backed up.

## Redis

Redis remains on VPS1.

Configured repository defaults for production:

- `REDIS_MAXMEMORY=1536mb`.
- `REDIS_MAXMEMORY_POLICY=allkeys-lru`.
- `REDIS_CONTAINER_MEMORY_LIMIT=2g`.

Current Redis usage is:

- Pub/sub for chat, notification, unread and attachment-ready events.
- Short TTL `events:feed:v1:*` base feed cache entries for `GET /events`.
- `events:feed-version:v1:<city>` cache version counters for coarse city invalidation.

Durable product data stays in Postgres.

## Nginx Scale Routing

Updated the scale nginx config for API and chat upstreams:

- `api_a` and `api_b` behind `frendly_api_scale` with keepalive.
- `chat_a` and `chat_b` behind `frendly_chat_scale` with keepalive.
- Exact `/events` route has its own rate limit zone and keeps API proxy timeouts bounded.
- WebSocket routing remains separate.

## Events Feed Cache

Added API-side Redis cache primitives:

- `RedisCacheService` for JSON get/set/delete/increment with fail-open behavior.
- Event feed cache key helper with normalized geo, filters and short TTLs.
- `GET /events` caches only base public feed rows. It does not cache text search.
- City feed version is included in the cache key when Redis has a version counter.

Viewer state remains live from Postgres after cache hit:

- Participant counts.
- Participant previews.
- Current user's joined state.
- Join request status.
- Attendance status.
- Live state.

Cache safety notes:

- Cache key is viewer scoped because the existing event feed predicate depends on viewer visibility.
- Cache hits revalidate cached event ids through the current feed visibility filter before returning them.
- Cached page writes are skipped if the page contains non-public events.
- Participant previews are bounded to `6 * pageEventCount`.
- Event create, direct join, leave and accepted invite increment the city feed version.
- Broad key scans are not used in production.

## PostGIS Guard

Added a deploy guard for `ENABLE_POSTGIS_EVENT_FEED=true`.

Before runtime containers start, deploy now verifies:

- `postgis` extension exists.
- `Event.geo` geography generated column exists.
- `Event_geo_gist_idx` exists and is ready and valid.

This guard does not enable PostGIS by itself. Run `db:postgis:event-geo` with direct DB URL before turning the runtime flag on.

## PostGIS Rollout On Current VPS1 DB

Observed production env on VPS1 before rollout:

- `ENABLE_POSTGIS_EVENT_FEED=true`.
- Runtime DB host still points to local `pgbouncer:6432`.
- Direct DB host still points to local `postgres:5432`.

So this rollout affected the current local VPS1 Postgres database, not the future external DB server.

Executed through the migrate container:

```bash
docker compose --env-file .env.production -f compose.prod.yml -f compose.scale.yml run --rm --no-deps migrate pnpm --filter @big-break/database db:postgis:event-geo
```

Result:

- `postgis` extension exists.
- `Event.geo` geography generated column exists.
- `Event_geo_gist_idx` exists and is valid.
- `api_a` and `api_b` were recreated after the schema rollout.
- API health returned `{"status":"ok","service":"api"}` after startup.

Nginx returned temporary `502` during the recreate window because both API containers were recreated at once and nginx briefly had no live upstreams. It recovered after the new API containers became healthy. For later deploys, prefer rolling recreate one API container at a time.

Hot query check:

- `db:perf:hot-queries` ran with a DB-selected user id that was not printed in this report.
- The normal PostGIS feed plan chose a sequential scan on the current small `Event` table.
- After `ANALYZE "Event"` and `SET enable_seqscan=off`, PostgreSQL used `Bitmap Index Scan on "Event_geo_gist_idx"`, so the GiST path is available.

## Mobile Task Status

Task 11 was not changed in this branch because `mobile2/` is not present in the current `1000rps-readiness` worktree HEAD. The main checkout has `mobile2/`, but editing it separately would mix branches.

## Mixed Load Tool

Added `backend/scripts/load-mixed-rps.mjs`.

It supports:

- `--api`.
- `--token`.
- `--rps`.
- `--duration`.
- `--timeout-ms`.
- `--connections`.
- Optional `--city`, default Moscow.

Default traffic mix:

- 40% `/events`.
- 15% `/dating/discover`.
- 15% `/affiche/events`.
- 10% `/evening/route-templates`.
- 10% `/profile/me`.
- 10% `/notifications/unread-count`.

The script prints only JSON summary output and does not print the token.

## Load Gate Status

See `docs/audits/2026-05-30-1000rps-readiness-load-report.md`.

Short result:

- 10 RPS cold smoke failed p95 gate.
- 10 RPS warm smoke passed overall p95.
- 50 RPS warm stage had 0 errors and 0 timeouts, but failed p95 gate at 857 ms.
- Staged 100 RPS and above were not run because 50 RPS already failed the latency gate.
