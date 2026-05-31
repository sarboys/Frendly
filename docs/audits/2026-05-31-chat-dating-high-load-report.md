# Chat And Dating High Load Report

Date: 2026-05-31

Topology:
- VPS1: app node, private IP `192.168.0.5`, 8 CPU, 11 GiB RAM, Docker memory 12540772352 bytes.
- DB host: separate server, private IP `192.168.0.6`.
- API containers for release 1500 RPS target: `api_a` through `api_h`.
- Chat containers: `chat_a` through `chat_d`, all healthy after WebSocket and message-write follow-up.
- Workers: `worker_realtime`, `worker_content`, `worker_schedules`, all healthy.
- Redis: `frendly-backend-redis-1`, healthy on VPS1.
- PgBouncer: expected on DB host, not present on VPS1.

Docker limits:
- API: no NanoCpus, CpuQuota, CpusetCpus or Memory limit was found on tested scale containers.
- Chat: no NanoCpus, CpuQuota, CpusetCpus or Memory limit on `chat_a` through `chat_d`.
- nginx: no NanoCpus, CpuQuota, CpusetCpus or Memory limit.
- Redis: memory limit 2147483648 bytes. No CPU quota.

Task 1 runtime evidence:
- `date -u`: Sun May 31 05:52:04 UTC 2026.
- `nproc`: 8.
- `free -h`: 11 GiB total, 2.4 GiB used, 9.3 GiB available, no swap.
- Docker CPU: 8.
- Docker memory bytes: 12540772352.
- Running app containers: `api_a`, `api_b`, `chat_a`, `chat_b`, `worker_realtime`, `worker_content`, `worker_schedules`, `nginx`, `redis`, `landing`, `admin_internal`, `admin_partner`.
- Local Postgres on VPS1: not present in matched container output.
- Local PgBouncer on VPS1: not present in matched container output.

Task 1 nginx evidence:
- `worker_processes auto`.
- `worker_connections 16384`.
- `keepalive_timeout 65`.
- `keepalive_requests 10000`.
- `api_backend`: `api_a`, `api_b`, `least_conn`, `keepalive 768`.
- `chat_backend`: `chat_a`, `chat_b`, `least_conn`, `keepalive 64`.
- `limit_req_zone`: `api_ip` 50 r/s, `events_ip` 2000 r/s.

Task 1 questions:
- Are all API containers present in both Docker and nginx upstreams: yes.
- Are chat containers free from unexpected CPU or memory limits: yes.
- Are local Postgres and local PgBouncer absent on VPS1: yes.

Task 1 status:
- PASS. VPS1 matches the required 2 API scale topology.

Task 2 data counts:
- `ua-query`: chat realtime flow points to `backend/apps/api/src/services/chats.service.ts`, `backend/apps/chat/src/chat-server.service.ts` and `mobile/lib/app/core/network/chat_socket_client.dart`.
- `testUserCount`: 10.
- `meetupChatCount`: 44.
- `directChatCount`: 0.
- `communityChatCount`: 3.
- `messageCount`: 2.
- `datingCandidateCount`: 10 profile-backed candidates excluding `test-user-0000000000`.
- `datingActionCount`: 0.
- `datingUsageEventCount`: 0.

Task 2 data gap:
- Direct chats are missing for `/chats/personal`.
- Message volume is too low for `/chats/:chatId/messages`.
- Before load tests, create safe test data for seeded test accounts only.

Task 2 route matrix:

| Area | Route/Event | Read/Write | Expected status | Data needed | Notes |
| --- | --- | --- | --- | --- | --- |
| chat-rest | GET /chats/meetups | read | 200 or 304 | user token | includeSocial=false for hot list |
| chat-rest | GET /chats/personal | read | 200 or 304 | user token | direct chats required |
| chat-rest | GET /chats/communities | read | 200 or 304 | user token | community membership required |
| chat-rest | GET /chats/:chatId/messages | read | 200 | chat member token | limit=30 |
| chat-rest | POST /chats/:chatId/read | write | 200 | latest message id | low weight |
| chat-ws | session.authenticate | read | session.authenticated | user token | websocket |
| chat-ws | chat.subscribe | read | no error | chat id | websocket |
| chat-ws | sync.request | read | sync.snapshot | chat id and cursor | websocket |
| chat-ws | message.send | write | message.created | chat id and clientMessageId | websocket |
| dating | GET /dating/discover | read | 200 | user token | limit=20 |
| dating | GET /dating/likes | read | 200 | user token | limit=20 |
| dating | GET /dating/limits | read | 200 | user token | quota state |
| dating | GET /matches | read | 200 | user token | reciprocal actions |
| dating | POST /dating/actions | write | 200 | target user id | pass/like/super_like |

Task 2 status-code accounting:
- 2xx counts as success.
- 304 counts as success for chat list ETag checks.
- 401/403 is a test-data/auth bug unless intentionally tested.
- 404 is a test-data bug for chat ids and dating target ids.
- 409/429 must be counted separately.
- 5xx is backend failure.
- Timeouts are backend or network failure until proven otherwise.

Task 3 idle container stats:
- nginx: cpu 0.00%, mem 59.76 MiB, pids 9.
- api_a: cpu 0.88%, mem 175 MiB, pids 31.
- api_b: cpu 0.57%, mem 174.5 MiB, pids 31.
- chat_a: cpu 0.73%, mem 141.8 MiB, pids 31.
- chat_b: cpu 0.79%, mem 140.9 MiB, pids 31.
- worker_realtime: cpu 1.02%, mem 163 MiB, pids 32.
- worker_content: cpu 2.09%, mem 157.6 MiB, pids 32.
- worker_schedules: cpu 1.34%, mem 164.1 MiB, pids 32.
- redis: cpu 3.57%, mem 3.477 MiB of 2 GiB, pids 6.

Task 3 PgBouncer baseline:
- DB host runs `pgbouncer.service` and `postgresql@16-main.service` directly through systemd, not Docker.
- PgBouncer listens on `192.168.0.6:6432`.
- Pool `frendly/frendly`: `cl_active=6`, `cl_waiting=0`, `sv_active=0`, `sv_idle=2`, pool mode `transaction`.
- Pool `pgbouncer/pgbouncer`: `cl_active=1`, `cl_waiting=0`.

Task 3 Postgres activity baseline:
- Active non-idle wait groups: `none|none|1`.
- No lock wait evidence at idle.

Task 3 Redis baseline:
- `used_memory_human`: 1.19M.
- `maxmemory_human`: 1.50G.
- `mem_fragmentation_ratio`: 7.36.
- `evicted_keys`: 0.

Task 3 status:
- PASS. Idle baseline is clean. PgBouncer has no waiting clients.

Task 4 tool:
- Created `backend/scripts/load-chat-rest-rps.mjs`.
- The script logs in seeded test users without printing tokens.
- The script prepares direct chats and warm messages for test users.
- 2xx counts as success.
- 304 counts as success and is reported as 3xx.

Task 4 first 50 RPS result before the 304 fix:
- Profile: mixed chat REST.
- Started: 3000.
- Completed: 3000.
- Dominant status: 502.
- API containers restarted during the run.
- Nginx showed `no live upstreams`.
- API process error: `Cannot set headers after they are sent to the client`.
- Repro: repeat chat list request with `If-None-Match` returned 304 and restarted an API container.

Task 4 root cause fixed:
- `ChatsController.respondWithChatListCache` used `response.status(304).end()` with passthrough `@Res`.
- Nest tried to continue response handling after Express had already ended the response.
- `ApiExceptionFilter` then tried to write an error response to already sent headers.
- Fix: set 304 status and return without calling `end`.
- Guard added: exception filter returns immediately when `response.headersSent` is true.

Task 4 tests after the 304 fix:
- `pnpm --filter @big-break/api test:unit -- test/unit/chats.controller.unit.spec.ts test/unit/api-exception.filter.unit.spec.ts`: PASS.
- `pnpm --filter @big-break/api build`: PASS.
- Repro on VPS1 after hot patch: first chat list request returned 200 with ETag, second returned 304, API restart count stayed 0.

Task 4 50 RPS mixed result after the 304 fix:
- Profile: mixed chat REST, public API URL, 60 seconds.
- Started: 3000.
- Completed: 3000.
- Success: 3000.
- Timeouts: 0.
- Status: 200 = 980, 201 = 300, 304 = 1720.
- p50: 320 ms.
- p95: 517 ms.
- p99: 699 ms.
- API CPU samples: about 50 percent to 92 percent per container.

Task 4 endpoint isolation at 50 RPS after the 304 fix:
- `messages`: 1500 success, 0 timeouts, p50 470 ms, p95 1721 ms, p99 2038 ms from local load source.
- `messages`: 1500 success, 0 timeouts, p50 283 ms, p95 2017 ms, p99 2206 ms from VPS1 before compiled runtime.
- `read`: 1500 success, 0 timeouts, p50 358 ms, p95 581 ms, p99 864 ms.
- `meetup-list`: 1500 success, 0 timeouts, p50 229 ms, p95 329 ms, p99 696 ms, mostly 304.
- `personal-list`: 1500 success, 0 timeouts, p50 238 ms, p95 365 ms, p99 762 ms, mostly 304.
- `community-list`: 1500 success, 0 timeouts, p50 228 ms, p95 297 ms, p99 707 ms, mostly 304.

Task 4 runtime bottleneck found:
- Production containers were running `pnpm --filter @big-break/api start`.
- That script uses `ts-node --transpile-only` at runtime.
- API, chat and worker now have `start:prod` scripts that run compiled JS from `dist`.
- `backend/Dockerfile` now builds contracts, database, API, chat and worker during image build.
- `compose.prod.yml` now uses `start:prod` for API, chat and worker.
- `@big-break/database` package main and types now point to `dist/src/index`.

Task 4 compiled runtime verification:
- `pnpm --filter @big-break/contracts build && pnpm --filter @big-break/database build && pnpm --filter @big-break/api build`: PASS.
- `pnpm --filter @big-break/chat build && pnpm --filter @big-break/worker build`: PASS.
- `cd backend/apps/api && node -e "require('./dist/apps/api/src/common/auth.guard.js')"`: PASS.
- API containers on VPS1 rebuilt and recreated with `start:prod`.
- Health: API containers healthy, restart count 0.
- 304 repro after compiled runtime: PASS, no restart.

Task 4 message route improvement after compiled runtime:
- Route: `GET /chats/:chatId/messages?limit=30`.
- RPS: 50.
- Duration: 60 seconds.
- Started: 1500.
- Success: 1500.
- Timeouts: 0.
- p50: 151 ms.
- p95: 434 ms.
- p99: 574 ms.
- Previous VPS1 p95 before compiled runtime was about 2017 ms.
- API CPU still reached about 74 percent to 94 percent per container.

Task 4 150 RPS mixed result after compiled runtime:
- Profile: mixed chat REST, public API URL, 60 seconds.
- Started: 9000.
- Completed: 5032.
- Success: 5027.
- Timeouts: 3968.
- Status: 200 = 802, 201 = 155, 304 = 4070, 500 = 5.
- p50: 8666 ms.
- p95: 10000 ms.
- p99: 10000 ms.
- Endpoint timeouts: messages = 2087, read = 740, meetup-list = 591, personal-list = 538, community-list = 12.
- API CPU samples during the run reached about 100 percent to 160 percent per API container.
- Nginx CPU reached about 57 percent in samples.
- API containers stayed healthy after the run and restart count stayed 0.

Task 4 route isolation at 300 RPS after compiled runtime:
- `meetup-list`: 18000 started, 18000 success, 0 timeouts, 200 = 6, 304 = 17994, p50 5 ms, p95 81 ms, p99 333 ms.
- `personal-list`: 18000 started, 18000 success, 0 timeouts, 200 = 81, 304 = 17919, p50 6 ms, p95 100 ms, p99 547 ms.
- `community-list`: 18000 started, 18000 success, 0 timeouts, 200 = 6, 304 = 17994, p50 4 ms, p95 24 ms, p99 84 ms.
- `messages`: 18000 started, 1712 completed, 256 success, 16288 timeouts, 1456 responses with 500, p50 10000 ms, p95 10000 ms, p99 10000 ms.
- `read`: 6000 started, 1018 completed, 965 success, 4982 timeouts, 53 responses with 500, p50 10000 ms, p95 10000 ms, p99 10000 ms.

Task 4 local nginx isolation:
- Route: `messages`.
- Base URL: `http://127.0.0.1` on VPS1.
- RPS: 150.
- Duration: 60 seconds.
- Started: 9000.
- Completed: 470.
- Success: 417.
- Timeouts: 8530.
- Status: 200 = 417, 500 = 53.
- p50: 10000 ms.
- p95: 10000 ms.
- p99: 10000 ms.
- CPU sample during the run: `api_a` about 98 percent, `api_b` about 99 percent, nginx about 12 percent, Redis about 7 percent.
- This makes the external hosting balancer unlikely as the primary bottleneck for the message route.

Task 4 DB evidence:
- PgBouncer waiting clients stayed at 0 in previous post-load checks.
- Postgres activity after failed route tests showed mainly clients waiting in `ClientRead`, not lock or IO waits.
- `pg_stat_statements` showed small average SQL time for the hot chat queries:
  - Message history select: about 0.04 ms mean.
  - Message attachment select: about 0.02 ms mean.
  - ChatMember membership select: about 0.04 ms mean.
  - ChatMember read update: about 1.43 ms mean after read load.
  - Notification read update: about 0.03 ms mean.

Task 4 suspect:
- First suspect is `api-cpu-cost`.
- Route-specific suspect is `message-history-query-cost`, but evidence points to API CPU and response work, not raw Postgres query time.
- `chat-list-etag-not-hit` is not supported by evidence. Chat list 300 RPS isolation is mostly 304 and passes cleanly.
- `pgbouncer-wait` and `postgres-query-cost` are not supported by current evidence.

Task 4 status:
- PARTIAL PASS. 50 RPS mixed now passes.
- BLOCKED for higher gates. 150 RPS mixed and `messages` route isolation fail.
- Do not run 750 or 1500 RPS for chat REST until the message/read hot path is fixed or concurrency is changed with fresh evidence.

Current release gate:
- Release allowed: no.
- Blocking gate: chat REST mixed 150 RPS and message route isolation.

## WebSocket and durable message-write follow-up

Date: 2026-05-31.

Live topology after this follow-up:

- VPS1 app node owns nginx, Redis, landing, admin apps, 8 API containers, 4 chat containers and 3 worker role containers for the release scale target.
- Chat containers: `chat_a`, `chat_b`, `chat_c`, `chat_d`.
- DB and PgBouncer stay on `192.168.0.6`.
- Runtime DB traffic uses PgBouncer on `192.168.0.6:6432`.
- Local Postgres and local PgBouncer on VPS1 are still not part of runtime.

Runtime changes applied on VPS1:

- Scale nginx now has `chat_a` through `chat_d` in `chat_backend`.
- Scale nginx chat upstream keepalive is `128`.
- nginx `worker_connections` was raised to `65535`, because 15000 proxied WebSockets need one client socket plus one upstream socket per connection.
- Chat runtime uses `CHAT_DATABASE_POOL_URL` with Prisma `connection_limit=30` and `pool_timeout=20`.
- Chat auth recheck is `CHAT_AUTH_RECHECK_MS=300000`.
- Chat membership cache TTL is `CHAT_MEMBERSHIP_CACHE_TTL_MS=60000`.
- Chat message transaction options are `CHAT_MESSAGE_TRANSACTION_MAX_WAIT_MS=10000` and `CHAT_MESSAGE_TRANSACTION_TIMEOUT_MS=10000`.
- Chat list touch throttle is `CHAT_MESSAGE_CHAT_TOUCH_INTERVAL_MS=1000`.
- DB-host PgBouncer now uses `default_pool_size=100`, `reserve_pool_size=10`, `max_client_conn=1500`, `pool_mode=transaction`.
- PgBouncer backup before manual change: `/etc/pgbouncer/pgbouncer.ini.bak-20260531-chat-write`.

Code changes applied:

- Active session DB loads are cached briefly and in-flight loads are coalesced.
- Membership misses are coalesced.
- Blocked-user set loads are cached briefly and coalesced.
- Text-only `message.send` skips the duplicate preflight message lookup.
- Text-only `message.send` skips media asset lookup when there are no attachments.
- Plain text create uses a smaller select without attachment and reply joins.
- Empty attachment `createMany` is omitted.
- Duplicate retries still resolve through the unique constraint path.
- `Chat.updatedAt` is touched at most once per chat per process per configured interval.
- `backend/scripts/load-chat-ws.mjs` now supports `--event-type message` and `--event-drain-seconds`.

Verification commands that passed:

- `cd backend && pnpm --filter @big-break/chat test -- test/unit/chat-server.service.unit.spec.ts --runInBand`
- `cd backend && pnpm --filter @big-break/chat build`
- `node --check backend/scripts/load-chat-ws.mjs`
- `docker compose --env-file .env.production.example -f compose.prod.yml -f compose.scale.yml config --services`

Load results:

| Scenario | Result |
| --- | --- |
| 15000 authenticated WebSocket connections | PASS, 15000 connected, 0 failed |
| 15000 WebSockets plus 5000 typing events/sec for 30 sec | PASS, 150000 events sent, 0 send errors, 0 server errors |
| 15000 WebSockets plus 200 `message.send`/sec for 30 sec | PASS, 6000 sent, 6000 received, 0 errors |
| 15000 WebSockets plus 225 `message.send`/sec for 30 sec | FAIL, 6750 sent, 6504 received, 195 transaction start errors |
| 15000 WebSockets plus 250 `message.send`/sec for 30 sec | FAIL, transaction start errors remained after 4 chat containers and PgBouncer pool tuning |

CPU and pool evidence:

- During the 225 `message.send`/sec run, chat containers were roughly around one CPU core each: `chat_a` about 98 percent, `chat_b` about 111 percent, `chat_c` about 93 percent, `chat_d` about 103 percent in the sampled `docker stats`.
- Earlier 250 `message.send`/sec runs showed PgBouncer server pool saturation. With PgBouncer pool 100, a sample showed `sv_active=100` and waiting clients.
- Raising PgBouncer to 110 server connections made the 250/sec result worse, then it was reverted to 100.

Current conclusion:

- 15000 active WebSockets with lightweight realtime ingress is solved on this VPS1 topology.
- 5000 typing events/sec is solved.
- Durable `message.send` is not solved for high event rates.
- Current stable durable write ceiling is 200 message sends/sec with 15000 connected WebSockets.
- 225/sec already fails through Prisma transaction start wait.
- The bottleneck is not nginx and not the hosting balancer. Evidence points to the write transaction path plus PgBouncer/Postgres capacity.
- 5000 durable chat messages/sec needs an architecture change, not more container or pool tuning on the same single Postgres shape.

Next first fix plan:

- `chat-message-write-pipeline-fix`.
- Move non-critical side effects out of the synchronous message transaction where possible.
- Re-check whether `RealtimeEvent` and unread outbox writes need to be in the same transaction for every message under burst.
- Consider a dedicated writer or queue with backpressure before trying 5000 durable messages/sec.
- Keep PgBouncer at 100/10 unless DB sizing evidence supports a larger Postgres connection budget.

Release gate:

- Release to normal tester traffic can proceed only if the product gate is normal app usage.
- Release to the stated 1500 RPS or 5000 durable chat events/sec target is blocked.
- Evidence: API CPU saturation, massive timeouts on `messages` and `read`, clean chat list cache, no DB wait evidence.
- `mixed-concurrency-fix` is selected for release 1500 REST RPS, so API release runtime uses 8 scale containers. The remaining high-load blocker is durable chat writes, tracked under `chat-message-write-pipeline-fix`.

## Task 5 mixed concurrency and chat hot-path fixes

Permission:
- Mixed concurrency fix was allowed after CPU evidence.
- Mixed concurrency testing used 8 API containers: `api_a` through `api_h`.
- Release scale deploy uses `api_a` through `api_h` because 1500 REST RPS passed on that topology.
- `RUNTIME_SERVICES` on VPS1 includes only scale services plus nginx, Redis, landing and admin services. Base `api`, `chat`, `worker`, local Postgres and local PgBouncer are not part of the runtime.

Code fixes:
- `GET /chats/:chatId/messages` now has short local L1 cache, Redis L2 cache and in-flight request coalescing.
- Chat list cache now also uses local L1 cache before Redis.
- `POST /chats/:chatId/read` now skips DB writes for repeated already-read markers and keeps a short local idempotency cache.
- API HTTP keep-alive timeout is 75 seconds, headers timeout is 80 seconds, matching nginx upstream keepalive better.
- `AuthGuard` now keeps active session snapshots in a 5 second local L1 cache before Redis and DB. This keeps the existing 5 second session TTL behavior while removing a Redis hit from every hot REST request.

Verification:
- `docker compose --env-file .env.production.example -f compose.prod.yml -f compose.scale.yml config --services`: PASS.
- `docker compose -f compose.observability.yml config --services`: PASS.
- `pnpm --filter @big-break/api test:unit -- test/unit/chats.service.unit.spec.ts`: PASS.
- `pnpm --filter @big-break/api test:unit -- test/unit/admin-security.unit.spec.ts`: PASS.
- `pnpm --filter @big-break/api build`: PASS.
- VPS1 deploy during the 8 API test: all `api_a` through `api_h` healthy, restart count 0, OOM false after load tests.

Key load results:
- `messages` 150 RPS after message cache: 9000 started, 9000 success, 0 timeouts, p50 6 ms, p95 134 ms, p99 198 ms.
- `read` 100 RPS after idempotent read skip: 6000 started, 6000 success, 0 timeouts, p50 236 ms, p95 884 ms, p99 982 ms.
- Mixed 300 RPS after read skip: 18000 started, 18000 success, 0 timeouts, p50 7 ms, p95 219 ms, p99 449 ms.
- Mixed 750 RPS: 45000 started, 45000 success, 0 timeouts, p50 7 ms, p95 346 ms, p99 786 ms.
- Mixed 1500 RPS, one load process, 60 seconds after auth L1 cache: 90000 started, 90000 success, 0 timeouts, p50 30 ms, p95 676 ms, p99 1526 ms.
- Mixed 1500 RPS, one load process, 300 seconds after auth L1 cache: 450000 started, 450000 success, 0 timeouts, p50 29 ms, p95 2013 ms, p99 4427 ms. All endpoints rose together, including 304 chat list responses.
- Mixed 1500 RPS split into two load processes at 750 RPS each, 60 seconds: both processes completed 45000 of 45000 with 0 errors. p95 was 185 ms and 199 ms.
- Mixed 1500 RPS split into two load processes at 750 RPS each, 300 seconds: both processes completed 225000 of 225000 with 0 errors. p95 was 210 ms and 227 ms. No timeouts, no network errors, no 5xx.

Runtime evidence during 1500 RPS:
- After auth L1 cache, Redis CPU dropped from about 16 percent to about 3 to 7 percent during 1500 RPS.
- API CPU during split 1500 RPS was about 63 to 83 percent per container in sampled docker stats.
- Nginx CPU was about 42 percent.
- Postgres activity during load was mostly `Client|ClientRead`, with 1 to 2 active CPU sessions. No lock or IO wait evidence.
- PgBouncer config on DB host: listens on `192.168.0.6:6432`, transaction mode, `max_client_conn=1500`, `default_pool_size=30`, `admin_users=frendly`, `stats_users=frendly`.
- During split 1500 RPS, VPS1 top showed no IO wait, but steal CPU reached about 20 percent in one sample. This means the VPS sometimes receives less CPU time from the host.

Load-generator evidence:
- A single Node load process at 1500 RPS becomes part of the bottleneck on 5 minute runs. Its event loop and fetch response handling inflate measured p95 over time.
- Splitting the same 1500 RPS into two 750 RPS processes removes that artifact and keeps both processes below p95 227 ms for 5 minutes.

Current bottleneck:
- The backend hot paths no longer fail the 1500 RPS mixed chat REST gate under split load generation.
- Remaining risk is CPU headroom and VPS steal time, not Postgres or PgBouncer.
- The one-process 5 minute test is not a valid backend bottleneck signal after the split-load control test.

Current release gate:
- Chat REST mixed 1500 RPS gate: PASS when generated by two 750 RPS clients.
- Error gate: PASS, 450000 of 450000 success, 0 timeouts, 0 network errors, 0 5xx.
- Latency gate: PASS on split generator, p95 210 ms and 227 ms per client.
- Operational risk: monitor VPS steal CPU. If it stays high under real traffic, move load generation off VPS1 for future tests or use a larger dedicated CPU tier.

## Task 6 WebSocket high-load gate

Target:
- 15000 active authenticated WebSocket connections with margin.
- 5000 inbound chat events per second.

Tool:
- Created `backend/scripts/load-chat-ws.mjs`.
- The script logs in seeded test users without printing tokens.
- It opens authenticated WebSockets through `/ws`, optionally subscribes to chats, holds connections, can send typing events at a fixed RPS, and reports connection failures, server error codes and server error messages.
- On VPS1 it runs inside the built chat image, because the host Node environment does not have the `ws` package installed.

First 15000 WebSocket result before nginx fix:
- 15000 attempted.
- 11100 connected.
- 3900 failed.
- Nginx error evidence: `16384 worker_connections are not enough while connecting to upstream`.
- Root cause: every proxied WebSocket consumes a client-side nginx connection and an upstream nginx connection. 15000 active WebSockets can need more than 30000 nginx worker connections.

Nginx fix:
- `deploy/nginx/nginx.scale.conf` changed `worker_connections` from `16384` to `65535`.
- VPS1 nginx was recreated with the scale config.
- Active config still keeps `worker_rlimit_nofile 200000`.

15000 authenticated subscribed WebSocket result after nginx fix:
- 15000 attempted.
- 15000 connected.
- 0 failed.
- Connect ramp latency: p50 2963 ms, p95 13161 ms, p99 14055 ms.
- No new nginx worker connection, upstream, 502 or 504 errors during the run.
- Sample resource use: nginx about 27 percent CPU, chat containers about 90 to 114 percent CPU each, Redis under 1 percent CPU.
- DB activity was mostly `ClientRead`; no DB bottleneck evidence.

First 15000 active plus 5000 events per second result:
- Test used `subscribe=false` to measure inbound event processing. Subscribing all duplicate test sockets to the same small chat set would create an artificial fanout test, not a realistic 5000 event per second ingress test.
- 15000 connected.
- 150000 typing events sent over 30 seconds.
- 0 send errors.
- Server errors appeared as `invalid_message`.
- Error evidence showed Prisma pool timeouts in chat runtime, first with `connection_limit=3`, later only on session recheck after raising the chat pool.

Chat fixes:
- Chat runtime can use `CHAT_DATABASE_POOL_URL` so chat has a larger Prisma client pool through PgBouncer without changing API pool settings.
- VPS1 chat runtime was set to `connection_limit=20` and `pool_timeout=20` through `CHAT_DATABASE_POOL_URL`.
- `CHAT_MEMBERSHIP_CACHE_TTL_MS=60000` was set on VPS1 for the high-load chat runtime.
- `CHAT_AUTH_RECHECK_MS=300000` was set on VPS1 for the high-load chat runtime.
- WebSocket session DB lookups now have a 5 second active-session local cache plus in-flight request coalescing.
- Membership cache misses are coalesced by user and chat.
- Blocked-user id lookups now have a 5 second local cache plus in-flight request coalescing.

Final 15000 active plus 5000 events per second result:
- 15000 attempted.
- 15000 connected.
- 0 failed.
- Connection ramp latency: p50 10 ms, p95 2697 ms, p99 6195 ms.
- 150000 events sent over 30 seconds.
- 0 send errors.
- 0 server errors.
- Resource sample during the run: chat containers about 213 to 227 percent CPU each, nginx about 28 percent CPU, Redis about 16 percent CPU.
- DB activity sample: about 30 client sessions in `ClientRead` and 1 active CPU session.

Important limit:
- This passed inbound typing events without fanout.
- This does not prove 5000 `message.send` events per second with database writes, unread fanout, notifications and large subscriber fanout.
- A real fanout matrix is still needed with room sizes like 2, 20 and 200 subscribers per chat.
- Memory is the main new risk. During the 15000 active plus events run, each chat container used about 4 GiB. On a 12 GiB VPS this passes, but leaves limited headroom for API, workers, nginx and Redis.

Current WebSocket gate:
- 15000 active authenticated WebSocket gate: PASS.
- 15000 active plus 5000 inbound typing events per second gate: PASS.
- 5000 message writes per second gate: FAIL on current write path.
- Large-room fanout gate: NOT TESTED.

Message write path follow-up:
- Extended `backend/scripts/load-chat-ws.mjs` with `--event-type message`.
- This mode sends `message.send` with unique `clientMessageId` and counts `message.created` acks and server errors.
- Sanity: 2 active WS, 1 message per second for 2 seconds, 2 sent, 2 received, 0 errors.
- Baseline 15000 active WS plus 500 `message.send` per second for 30 seconds: 15000 sent, 0 send errors, 10962 server errors. Error message: `Transaction API error: Unable to start a transaction in the given time.`
- Baseline 15000 active WS plus 100 `message.send` per second for 30 seconds: 3000 sent, 3000 received, 0 errors.
- Baseline 15000 active WS plus 150 `message.send` per second for 30 seconds: 4500 sent, 2217 received, 1624 server errors.
- First message hot-path fix removed two reads from text-only new message sends: no preflight `Message.findFirst`, and no `MediaAsset.findMany` when `attachmentIds` is empty. Retry correctness is preserved by loading the existing message only after a unique conflict.
- After the fix, 15000 active WS plus 150 `message.send` per second improved but still failed: 4500 sent, 4293 received, 206 server errors.
- After the fix, 15000 active WS plus 125 `message.send` per second passed: 3750 sent, 3750 received, 0 errors.
- DB evidence during 125 message/s: mostly `ClientRead`, with one sample showing `IO|WALSync|1` and `cpu|active|1`.
- DB evidence during 150 message/s: mostly `ClientRead`. No Postgres CPU saturation was captured.
- Runtime evidence after the final 125 message/s pass: chat containers, nginx, Redis and workers stayed running, restart count 0 and OOM false.

Message write bottleneck:
- Current bottleneck is the chat `message.send` write path under Prisma interactive transaction pressure, not nginx and not WebSocket connection count.
- 5000 inbound typing events per second is a realtime ingress pass.
- 5000 durable message writes per second is a different target and is far above the current two-chat-container write path.
- Next first fix should be `chat-message-send-write-path-fix`: reduce transaction cost and duration, then retest 150, 250 and 500 message/s before considering 5000 message/s.
