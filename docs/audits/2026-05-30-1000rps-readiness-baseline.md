# 1000 RPS Readiness Baseline

Date: 2026-05-30

## Server

- Captured at: Sat May 30 07:02:43 UTC 2026
- CPU: 8 cores from `nproc`
- RAM: 11 GiB total, 9.0 GiB available
- Docker CPU: 8
- Docker memory: 12,540,772,352 bytes

Command:

```bash
ssh vps1 'date -u; nproc; free -h; docker info --format "docker_cpu={{.NCPU}} docker_mem_bytes={{.MemTotal}}"'
```

Status: passed.

## Current topology

Running services captured from Docker:

- API: `frendly-backend-api_a-1`, `frendly-backend-api_b-1`
- Chat: `frendly-backend-chat_a-1`, `frendly-backend-chat_b-1`
- Workers: `frendly-backend-worker_realtime-1`, `frendly-backend-worker_content-1`, `frendly-backend-worker_schedules-1`
- Nginx: `frendly-backend-nginx-1`
- Postgres: `frendly-backend-postgres-1`
- PgBouncer: `frendly-backend-pgbouncer-1`
- Redis: `frendly-backend-redis-1`

Cleanup candidates also running:

- `frendly-backend-api-1`
- `frendly-backend-chat-1`

All listed containers reported `Up 17 hours (healthy)`.

Command:

```bash
ssh vps1 'docker ps --format "{{.Names}} {{.Status}}" | egrep "frendly-backend-(api|api_a|api_b|chat|chat_a|chat_b|worker|worker_realtime|worker_content|worker_schedules|nginx|postgres|pgbouncer|redis)-1"'
```

Status: passed.

## Known issue

Base `api` and `chat` are present in the compose scale config unless deploy excludes them through `RUNTIME_SERVICES`.

They are currently running and should be treated as cleanup candidates before the 1000 RPS move.

## Load baseline

Existing 500 RPS upgraded report:

- `docs/audits/2026-05-29-vps1-upgraded-500rps-events-qa-report.md`

Note: this file was not present in the current worktree during this audit.

## PgBouncer

Pool state captured before the move:

| database | user | cl_active | cl_waiting | sv_active | sv_idle | pool_mode |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| frendly | frendly | 16 | 0 | 0 | 2 | transaction |
| pgbouncer | pgbouncer | 2 | 0 | 0 | 0 | statement |

Idle wait state is clean: `cl_waiting=0` for both rows.

Requested command:

```bash
ssh vps1 'cd /opt/frendly && docker exec frendly-backend-pgbouncer-1 psql -p 6432 -U "$POSTGRES_USER" pgbouncer -c "SHOW POOLS;"'
```

Status: failed.

Failure:

```text
psql: error: local user with ID 1001 does not exist
```

Fallback command used to capture the same PgBouncer pool state without printing connection strings:

```bash
ssh vps1 'cd /opt/frendly && docker exec frendly-backend-postgres-1 sh -lc '\''PGPASSWORD="$POSTGRES_PASSWORD" psql -h pgbouncer -p 6432 -U "$POSTGRES_USER" pgbouncer -c "SHOW POOLS;"'\'''
```

Status: passed.

## Hot query notes

Requested command:

```bash
ssh vps1 'cd /opt/frendly/backend && pnpm --filter @big-break/database db:perf:hot-queries'
```

Status: failed.

Failure:

```text
bash: line 1: pnpm: command not found
```

Safe fallback attempts:

```bash
ssh vps1 'docker exec frendly-backend-api_a-1 sh -lc '\''cd /app && pnpm --filter @big-break/database db:perf:hot-queries'\'''
```

Status: failed. Corepack selected `pnpm@11.5.0`, which requires Node 22.13 or newer, while the container has Node 20.20.2.

```bash
ssh vps1 'docker exec frendly-backend-api_a-1 sh -lc '\''cd /app && COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm@9.15.2 --filter @big-break/database db:perf:hot-queries'\'''
```

Status: failed. The script started, but `ts-node` was not installed in the runtime container.

Captured notes:

- `/events`: query plan not captured in this task because the hot-query command could not run on VPS1.
- Map viewport: query plan not captured in this task because the hot-query command could not run on VPS1.
- PostGIS: query plan not captured in this task because the hot-query command could not run on VPS1.

Concern: to lock query plans, run the same script from a host or container that has the repository dev tooling available, including the pinned `pnpm@9.15.2` and `ts-node`.
