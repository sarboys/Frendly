# Scale Local First Acceptance QA Report

Date: 2026-05-15

Scope: Task 24 acceptance QA continuation.

Backend: `https://api.frendly.tech`.

Device: iOS simulator `iPhone 17 Pro`, iOS 26.5, simulator id `E1D49F3C-4690-408C-859C-EAB274D963C7`.

Build: XcodeBuildMCP `build_run_sim` succeeded for `Runner`, `Debug`, bundle `com.sergeypolyakov.frendly.dev`.

## Result

- PASS: cold launch, login with test account, Home first frame, map open and pan, chats open, direct text send, meetup text send, relaunch, chat list after relaunch, existing photo reopen, logout/login another user, old profile cache not visible after account switch.
- FAIL: none in checked scope.
- BLOCKED: dating swipe like was blocked because the feed had no profiles on both checked accounts; photo send was blocked by a blank iOS photo picker after permission; voice playback had no visible playback state after tap; private runtime metrics were not available in this environment.
- NOT CHECKED: new photo send, voice playback proof, meetup create/join, airplane mode and offline send.

## Checks

| Check | Status | Account | Proof | Next |
| --- | --- | --- | --- | --- |
| Launch cold on iOS simulator | pass | saved simulator session | XcodeBuildMCP build/run succeeded, screenshot `docs/audits/2026-05-15-scale-local-first-qa-home.jpg` | Clean install login still needs separate run |
| Login with test account | pass | saved QA account | Logged out from the saved session, opened SMS login, entered a saved test account and landed on Home. Screenshots `docs/audits/2026-05-15-scale-local-first-qa-logout-button.jpg`, `docs/audits/2026-05-15-scale-local-first-qa-login-screen.jpg` and `docs/audits/2026-05-15-scale-local-first-qa-second-user-profile.jpg` | Repeat from clean install if needed |
| Open Home first frame | pass | saved simulator session | Home showed `Радар вечера`, screenshot `docs/audits/2026-05-15-scale-local-first-qa-home.jpg` | Continue full flow |
| Open map and pan map | pass | saved simulator session | Map opened and pan changed visible count from `Все · 5` to `Все · 1`, screenshot `docs/audits/2026-05-15-scale-local-first-qa-map-pan.jpg` | Map QA still needed before PostGIS flag |
| Open dating and swipe like | blocked | saved simulator session and saved QA account | Dating opened with `Пока нет новых профилей` before and after account switch. Screenshots `docs/audits/2026-05-15-scale-local-first-qa-dating-empty.jpg` and `docs/audits/2026-05-15-scale-local-first-qa-second-user-dating-empty.jpg` | Seed or switch account with available profiles |
| Open chats | pass | saved simulator session | Chat list opened, screenshot `docs/audits/2026-05-15-scale-local-first-qa-relaunch-chat-list.jpg` | Continue meetup chat checks |
| Send direct text | pass | saved simulator session | Sent `as-scale-local-first-2026-05-15`, screenshot `docs/audits/2026-05-15-scale-local-first-qa-direct-message-sent.jpg` | Verify peer receipt in a two-account run |
| Send meetup text | pass | saved simulator session | Sent `as-meet-up-local-first-2026-05-15`, screenshot `docs/audits/2026-05-15-scale-local-first-qa-meetup-message-sent.jpg` | Verify peer receipt in a two-account run |
| Send photo | blocked | saved simulator session and saved QA account | Attachment sheet opened and Photos permission was granted, then picker rendered blank and app had to be relaunched. Retried after adding a test image to simulator Photos; picker still rendered blank. Screenshots `docs/audits/2026-05-15-scale-local-first-qa-photo-permission.jpg`, `docs/audits/2026-05-15-scale-local-first-qa-photo-picker-blank.jpg` and `docs/audits/2026-05-15-scale-local-first-qa-photo-picker-blank-after-seed.jpg` | Debug iOS photo picker integration or use file attachment path |
| Relaunch app | pass | saved simulator session | Stop plus launch succeeded; app returned to Home and chat list showed latest direct message, screenshot `docs/audits/2026-05-15-scale-local-first-qa-relaunch-chat-list.jpg` | Continue offline cache checks |
| Reopen photo | pass | saved simulator session | Existing meetup photo opened in media preview, screenshot `docs/audits/2026-05-15-scale-local-first-qa-photo-reopened.jpg` | Recheck after relaunch or offline mode |
| Play voice | blocked | saved simulator session | Voice row was visible, but tapping it produced no visible playback state in screenshot or accessibility snapshot. Screenshot `docs/audits/2026-05-15-scale-local-first-qa-voice-no-visible-state.jpg` | Retest with logs or audio/player state instrumentation |
| Create meetup | pending | saved QA account | pending | Confirm created meetup |
| Join meetup from second account | pending | saved QA account | pending | Confirm join state |
| Airplane mode after data cached | pending | saved QA account | pending | Confirm offline mode |
| Read cached chats and hot screens | pending | saved QA account | pending | Confirm local data |
| Send chat message offline, then reconnect | pending | saved QA account | pending | Confirm outbox flush |
| Logout and login as another user | pass | saved QA account | Previous profile was visible before logout, login screen opened, second user profile loaded after SMS shortcut. Screenshots `docs/audits/2026-05-15-scale-local-first-qa-logout-button.jpg`, `docs/audits/2026-05-15-scale-local-first-qa-login-screen.jpg` and `docs/audits/2026-05-15-scale-local-first-qa-second-user-profile.jpg` | Repeat on clean install if needed |
| Confirm old user's cached data is not visible | pass | saved QA account | After account switch, profile showed the second user's profile and chats opened under the second user. Screenshots `docs/audits/2026-05-15-scale-local-first-qa-second-user-profile.jpg` and `docs/audits/2026-05-15-scale-local-first-qa-second-user-chats.jpg` | Offline account switch cache isolation still needs a separate airplane mode run |
| Runtime metrics | blocked | n/a | Private Prometheus/Grafana endpoint was not configured in this environment | Use staging or VPS private metrics |

## Notes

- Do not include real tokens, OTP values, auth headers or secret keys in this report.
