# Scale Local First Acceptance QA Report

Date: 2026-05-15

Scope: Task 24 acceptance QA on production.

Backend: `https://api.frendly.tech`.

Device: iOS simulator `iPhone 17 Pro`, iOS 26.5, simulator id `E1D49F3C-4690-408C-859C-EAB274D963C7`.

Build: XcodeBuildMCP `build_run_sim` succeeded for `Runner`, `Debug`, bundle `com.sergeypolyakov.frendly.dev`.

## Result

- PASS: backend health, cold launch, login, Home first frame, map open and pan, dating open, chats open, direct text send, meetup text send, photo send, photo reopen, relaunch, chat list after relaunch, create meetup, logout/login another user, old cache isolation on hot screens, prod runtime metrics.
- FAIL: none in checked scope.
- BLOCKED: dating swipe like had no profiles, voice playback had no visible proof, second account did not join created meetup, airplane/offline checks had no safe scoped network-off control.

## Checks

| Check | Status | Proof | Next |
| --- | --- | --- | --- |
| Backend health | pass | `https://api.frendly.tech/health` returned `200`; public `/metrics` returned `404` | Keep public metrics closed |
| Launch cold on iOS simulator | pass | XcodeBuildMCP build/run succeeded, screenshot `docs/audits/2026-05-15-scale-local-first-qa-home.jpg` | Repeat on clean install if needed |
| Login with test account | pass | Logged out from saved `2222` session, logged in as saved `1111` account, landed on Home | Do not write tokens or auth headers |
| Open Home first frame | pass | Home showed `Радар вечера`, screenshot `docs/audits/2026-05-15-scale-local-first-qa-home.jpg` | None |
| Open map and pan map | pass | Map opened and pan changed visible area, screenshot `docs/audits/2026-05-15-scale-local-first-qa-map-pan.jpg` | None |
| Open dating | pass | Dating screen opened on both checked accounts | None |
| Swipe like | blocked | Both checked accounts showed `Пока нет новых профилей` | Seed or choose an account with available profiles |
| Open chats | pass | Chat list opened after login and after relaunch, screenshot `docs/audits/2026-05-15-scale-local-first-qa-relaunch-chat-list.jpg` | None |
| Send direct text | pass | Prod DB row `cmp6e07kt0001p82b8ijoz87s`, text `as-direct-scale-2026-05-15-1058`, created `2026-05-15 03:58:10` | Peer receipt still needs a two-account run |
| Send meetup text | pass | Prod DB row `cmp6e0v0j0004p82bzwvshz4t`, text `йф-ьууегз-ысфду-2026-05-15-1059`, created `2026-05-15 03:58:40` | Peer receipt still needs a two-account run |
| Send photo | pass | Prod DB attachment row `cmp6e1p2c0007p82b5plr4zfx` for message `cmp6e1otg0005oc2b7pbkyqbz`, created `2026-05-15 03:59:19` | None |
| Reopen photo | pass | Sent photo opened in media preview | Recheck offline after network-off setup |
| Play voice | blocked | Existing voice row was visible, but tapping did not give visible playback state | Retest with audio logs or player state proof |
| Create meetup | pass | Prod DB event `ev-ddce64a8-2440-48cf-8cac-a99550c0ec69`, title `as-create-scale-2026-05-15`, created `2026-05-15 04:06:38` | Retest attendee flow |
| Join meetup from second account | blocked | Second account did not see the created meetup during this run | Check event visibility or seed attendee data |
| Relaunch app | pass | Stop plus launch returned to Home, chat list opened after relaunch | None |
| Airplane mode after data cached | blocked | No safe per-simulator network-off control was available | Retest on device or scoped network conditioner |
| Cached chats and hot screens | partial pass | Chats and hot screens opened after relaunch with network available | Offline cache proof still blocked |
| Offline chat message then reconnect | blocked | Blocked by the same network-off limitation | Retest after safe network-off setup |
| Logout and login as another user | pass | Second saved account reached profile and hot screens | None |
| Confirm old cache not visible | pass | After account switch, old direct chat and old profile were not visible on checked screens | Offline account switch still needs separate run |

## Runtime Metrics

Source: Prometheus on `vps1`, last 24h after QA traffic.

| Signal | Value |
| --- | --- |
| `/events` | `4` requests, `0` errors, p95 `235.6 ms`, p99 `247.7 ms` |
| `/dating/discover` | `2` requests, `0` errors, p95 `950.0 ms`, p99 `990.0 ms` |
| `/affiche/events` | `1` request, `0` errors, p95 `975.0 ms`, p99 `995.0 ms` |
| `/evening/route-templates` | `1` request, `0` errors, p95 `24.8 ms`, p99 `856.1 ms` |
| `/chats/meetups` | `2` requests, `0` errors, p95 `97.5 ms`, p99 `99.5 ms` |
| `/chats/:chatId/messages` | `2` requests, `0` errors, p95 `95.1 ms`, p99 `99.0 ms` |
| API DB query duration | p95 `8.0 ms`, p99 `145.0 ms` |
| Worker job duration | p95 `24.2 ms` |
| Worker outbox | max lag `0.76 s`, max pending `1` |
| WebSocket | max active `1`, max authenticated `1`, sync requests about `6.15` |
| Redis publish | about `20.32` publishes, rate `0.000235/s` |
| PgBouncer | max waiting `1`, max wait `0 s` |
| S3 | about `4.05` operations, no `status != ok` series |

`/chats/personal`, `/search`, `/media/:assetId` and `/uploads/media/complete` had no samples in this window. Chat ack p95 is not exposed as a duration metric.

## Notes

- Do not include real tokens, OTP values, auth headers or secret keys in this report.
