# 1000 RPS Readiness Load Report

Date: 2026-05-30

Environment:

- API: `https://api.frendly.tech`.
- App node: VPS1.
- Current DB runtime still points to local VPS1 Postgres through local PgBouncer.
- External DB server is prepared, but production env is not cut over to it yet.
- Auth used a seeded QA account. Token and auth headers are not stored here.

## Prechecks

- API health after PostGIS rollout: `{"status":"ok","service":"api"}`.
- `postgis` extension: present.
- `Event.geo`: present.
- `Event_geo_gist_idx`: present and valid.
- PgBouncer after 50 RPS smoke: `cl_waiting=0`.

## Results

| Stage | Requests | OK | Errors | Timeouts | p50 ms | p95 ms | p99 ms | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 10 RPS cold smoke, 10s | 100 | 100 | 0 | 0 | 300 | 1179 | 1410 | fail, p95 above 800 |
| 10 RPS warm smoke, 10s | 100 | 100 | 0 | 0 | 274 | 734 | 814 | pass overall |
| 50 RPS warm stage, 30s | 1500 | 1500 | 0 | 0 | 290 | 857 | 1269 | fail, p95 above 800 |

## 50 RPS Endpoint Breakdown

| Endpoint | Requests | OK | p50 ms | p95 ms | p99 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/events` | 600 | 600 | 307 | 857 | 1333 |
| `/dating/discover` | 225 | 225 | 288 | 1008 | 1389 |
| `/affiche/events` | 225 | 225 | 301 | 844 | 1362 |
| `/evening/route-templates` | 150 | 150 | 281 | 749 | 861 |
| `/profile/me` | 150 | 150 | 262 | 691 | 901 |
| `/notifications/unread-count` | 150 | 150 | 254 | 777 | 843 |

## Runtime Notes

- During 50 RPS, `api_a` and `api_b` each reached roughly 90-125% CPU in `docker stats` samples.
- Nginx peaked around 21% CPU in sampled output.
- Redis memory stayed about 15 MiB.
- Postgres and PgBouncer were low after the run. PgBouncer had no waiting clients.

## Decision

Stop staged load at 50 RPS for now.

Reason:

- Gate requires p95 under 800 ms.
- 50 RPS p95 was 857 ms, with `/events`, `/dating/discover` and `/affiche/events` above target.
- Current production runtime still uses local VPS1 Postgres and local PgBouncer, not the prepared external DB server.
- Mobile map throttling is not implemented in this branch because `mobile2/` is absent from this worktree HEAD.

Next checks:

- Cut over to DB server only after dump/restore and rollback window are ready.
- Deploy the Redis `/events` cache code from this branch before repeating load gates.
- Re-run warm 50 RPS after deploy. Continue to 100 RPS only if p95 is below 800 ms and API CPU is not sustained above 70%.
