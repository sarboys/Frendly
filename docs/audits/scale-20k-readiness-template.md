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
