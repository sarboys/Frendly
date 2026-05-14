# Scale Local First Acceptance QA Report

Date: 2026-05-15

Scope: Task 24 acceptance QA continuation.

Backend: `https://api.frendly.tech`.

Device: iOS simulator `iPhone 17 Pro`, iOS 26.5, simulator id `E1D49F3C-4690-408C-859C-EAB274D963C7`.

Build: XcodeBuildMCP `build_run_sim` succeeded for `Runner`, `Debug`, bundle `com.sergeypolyakov.frendly.dev`.

## Result

- PASS: cold launch, Home first frame, map open and pan, chats open, direct text send, relaunch, chat list after relaunch.
- FAIL: none in checked scope.
- BLOCKED: clean login was not checked because simulator already had a saved session; dating swipe like was blocked because the feed had no profiles; private runtime metrics were not available in this environment.
- NOT CHECKED: meetup text, photo send/reopen, voice playback, meetup create/join, airplane mode, offline send and account switch.

## Checks

| Check | Status | Account | Proof | Next |
| --- | --- | --- | --- | --- |
| Launch cold on iOS simulator | pass | saved simulator session | XcodeBuildMCP build/run succeeded, screenshot `docs/audits/2026-05-15-scale-local-first-qa-home.jpg` | Clean login still needs separate run |
| Login with test account | blocked | saved simulator session | App opened directly into existing authenticated session | Reset/logout before clean login check |
| Open Home first frame | pass | saved simulator session | Home showed `Радар вечера`, screenshot `docs/audits/2026-05-15-scale-local-first-qa-home.jpg` | Continue full flow |
| Open map and pan map | pass | saved simulator session | Map opened and pan changed visible count from `Все · 5` to `Все · 1`, screenshot `docs/audits/2026-05-15-scale-local-first-qa-map-pan.jpg` | Map QA still needed before PostGIS flag |
| Open dating and swipe like | blocked | saved simulator session | Dating opened with `Пока нет новых профилей`, screenshot `docs/audits/2026-05-15-scale-local-first-qa-dating-empty.jpg` | Seed or switch account with available profiles |
| Open chats | pass | saved simulator session | Chat list opened, screenshot `docs/audits/2026-05-15-scale-local-first-qa-relaunch-chat-list.jpg` | Continue meetup chat checks |
| Send direct text | pass | saved simulator session | Sent `as-scale-local-first-2026-05-15`, screenshot `docs/audits/2026-05-15-scale-local-first-qa-direct-message-sent.jpg` | Verify peer receipt in a two-account run |
| Send meetup text | pending | saved QA account | pending | Confirm message appears |
| Send photo | pending | saved QA account | pending | Confirm photo appears |
| Relaunch app | pass | saved simulator session | Stop plus launch succeeded; app returned to Home and chat list showed latest direct message, screenshot `docs/audits/2026-05-15-scale-local-first-qa-relaunch-chat-list.jpg` | Continue offline cache checks |
| Reopen photo | pending | saved QA account | pending | Confirm cached media |
| Play voice | pending | saved QA account | pending | Confirm playback state |
| Create meetup | pending | saved QA account | pending | Confirm created meetup |
| Join meetup from second account | pending | saved QA account | pending | Confirm join state |
| Airplane mode after data cached | pending | saved QA account | pending | Confirm offline mode |
| Read cached chats and hot screens | pending | saved QA account | pending | Confirm local data |
| Send chat message offline, then reconnect | pending | saved QA account | pending | Confirm outbox flush |
| Logout and login as another user | pending | saved QA account | pending | Confirm account switch |
| Confirm old user's cached data is not visible | pending | saved QA account | pending | Inspect screens |
| Runtime metrics | blocked | n/a | Private Prometheus/Grafana endpoint was not configured in this environment | Use staging or VPS private metrics |

## Notes

- Do not include real tokens, OTP values, auth headers or secret keys in this report.
