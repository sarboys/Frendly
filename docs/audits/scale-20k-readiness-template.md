# 20k Readiness Smoke Report

Date:

Commit:

Environment:

Data set:

API URL:

WebSocket URL:

## Commands

```bash
cd /Users/sergeypolyakov/MyApp/backend
node scripts/perf-20k-smoke.mjs --api https://api.frendly.tech --token TOKEN
node scripts/load-mixed-rps.mjs --api https://api.frendly.tech --token TOKEN --rps 100 --duration 60 --timeout-ms 3000
```

Do not paste real tokens into this report.

## Results

| Scenario | Count | p50 ms | p95 ms | p99 ms | Errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| startup-chain | | | | | |
| dating-discover | | | | | |
| map-viewport | | | | | |
| affiche-events | | | | | |
| route-templates | | | | | |
| chat-history | | | | | |
| media-reuse | | | | | |
| chat-send-ack | | | | | |
| chat-broadcast-fanout | | | | | |

## Mixed Load Gates

Use `backend/scripts/load-mixed-rps.mjs` for fixed-rate mixed traffic:

```bash
cd /Users/sergeypolyakov/MyApp/backend
node scripts/load-mixed-rps.mjs --api https://api.frendly.tech --token TOKEN --rps 100 --duration 60 --timeout-ms 3000 --connections 1000
```

Default mix:

| Endpoint | Weight |
| --- | ---: |
| `/events` | 40% |
| `/dating/discover` | 15% |
| `/affiche/events` | 15% |
| `/evening/route-templates` | 10% |
| `/profile/me` | 10% |
| `/notifications/unread-count` | 10% |

| Stage RPS | Duration s | p50 ms | p95 ms | p99 ms | 5xx/Error % | Timeout % | API CPU | DB CPU | PgBouncer waiting | Pass |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 100 | 60 | | | | | | | | | |
| 200 | 60 | | | | | | | | | |
| 300 | 60 | | | | | | | | | |
| 500 | 60 | | | | | | | | | |
| 750 | 60 | | | | | | | | | |
| 1000 | 60 | | | | | | | | | |

## Runtime Counters

API p95:

Chat ack p95:

Outbox lag before:

Outbox lag after:

DB pool notes:

Redis notes:

S3 notes:

Worker failed count:

WebSocket drops:

## Decision

Accepted or failed:

Reason:

Follow-up work:
