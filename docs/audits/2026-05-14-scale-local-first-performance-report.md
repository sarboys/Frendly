# 20k Readiness Smoke Report

Date: 2026-05-14

Commit: local working tree

Environment: local dev API, local Postgres, local Redis

Data set: existing local dev data

API URL: http://127.0.0.1:3000

WebSocket URL: not measured

## Commands

```bash
cd /Users/sergeypolyakov/MyApp/backend
node scripts/perf-hotpaths.mjs startup --api http://127.0.0.1:3000 --token TOKEN --requests 30 --concurrency 5
node scripts/perf-hotpaths.mjs dating --api http://127.0.0.1:3000 --token TOKEN --requests 50 --concurrency 5
node scripts/perf-hotpaths.mjs map-viewport --api http://127.0.0.1:3000 --token TOKEN --requests 50 --concurrency 5
node scripts/perf-hotpaths.mjs affiche --api http://127.0.0.1:3000 --requests 50 --concurrency 5
node scripts/perf-hotpaths.mjs routes --api http://127.0.0.1:3000 --token TOKEN --requests 50 --concurrency 5
```

Do not paste real tokens into this report.

## Results

| Scenario | Count | p95 ms | p99 ms | DB queries | DB queries/request | Errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| startup-chain | 30 | 51.52 | 73.92 | 1173 | 39.10 | 0 |
| map-viewport | 50 | 19.66 | 45.79 | 650 | 13.00 | 0 |
| route-templates | 50 | 12.78 | 37.83 | 450 | 9.00 | 0 |
| dating-discover | 50 | 10.53 | 37.88 | 350 | 7.00 | 0 |
| affiche-events | 50 | 7.98 | 34.17 | 50 | 1.00 | 0 |

## Runtime Counters

API p95: all measured local scenarios were below 60 ms.

DB query metrics: fixed local `ts-node` runtime resolution so API, chat and worker start scripts prefer current `.ts` sources over ignored stale `.js` artifacts in `packages/database/src`.

Worker counters: not measured locally.

WebSocket drops: not measured locally.

## Rollout Notes

`db:postgis:event-geo` was not run locally because the current local Postgres image does not include PostGIS.

`CHAT_UNREAD_COUNTER_READS`, `ENABLE_POSTGIS_EVENT_FEED` and `WORKER_OUTBOX_BATCH_CLAIM` were not enabled.

`WORKER_OUTBOX_BATCH_CLAIM=true` still needs staging first.

`ENABLE_POSTGIS_EVENT_FEED=true` still needs map and event feed QA after PostGIS rollout.

## Decision

Accepted or failed: local baseline only.

Reason: no staging or production metrics were available in this environment. No endpoint code was changed because the measured local p95 values were low.

Follow-up work: run the same smoke on staging or production-safe accounts, then fix only endpoints that rank high by p95, p99, DB query delta and error rate.
