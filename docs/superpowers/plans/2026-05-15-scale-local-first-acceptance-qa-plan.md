# Scale Local First Acceptance QA Plan

Date: 2026-05-15

Scope: continue Task 24 acceptance QA for scale-local-first-performance.

Backend: production API `https://api.frendly.tech`.

Device: iOS simulator `iPhone 17 Pro`, iOS 26.5.

Accounts: saved repeated-digit QA accounts from local QA data. Do not write phone tokens or auth headers into reports.

## Checks

- [x] Launch cold on iOS simulator.
- [x] Login with test account.
- [x] Open Home first frame.
- [x] Open map and pan map.
- [ ] Open dating and swipe like.
- [x] Open chats.
- [x] Send direct text.
- [x] Send meetup text.
- [ ] Send photo.
- [x] Relaunch app.
- [x] Reopen photo.
- [ ] Play voice.
- [x] Create meetup.
- [ ] Join meetup from second account.
- [ ] Switch to airplane mode after data is cached.
- [ ] Read cached chats and hot screens.
- [ ] Send chat message offline, then reconnect.
- [x] Logout and login as another user.
- [x] Confirm old user's cached data is not visible.
- [ ] Record API p95, chat ack p95, outbox lag, WS connection count, Redis pubsub rate, DB pool wait and S3 errors if private metrics are available.

## Notes

- App launched into an existing saved simulator session, so login from a clean auth screen was not checked.
- Dating opened, but there were no profiles in the current feed, so swipe like was blocked.
- Direct chat text sent: `as-scale-local-first-2026-05-15`.
- Meetup chat text sent: `as-meet-up-local-first-2026-05-15`.
- Existing meetup photo reopened in media preview.
- Voice row was visible, but tapping it did not produce a visible playback state in screenshot or accessibility snapshot.
- Photo send is blocked in this run: after allowing Photos full access, the picker rendered blank and required app relaunch. Retried after adding a test image to simulator Photos; picker still rendered blank.
- Logged out from the saved `2222` session and logged in with the saved `1111` test account through SMS shortcut.
- After account switch, profile showed the second user's profile instead of the previous `2222` profile.
- Chat list opened under the second user; old profile data was not visible on profile or hot navigation screens.
- Dating was rechecked after account switch and still showed `Пока нет новых профилей`, so swipe like remains blocked.
- Created meetup `as-local-first-2026-05-15` with address `QA test place`; published detail showed host state and `Идут 1/8`.
- Join from the second account is blocked in this run: after login as another saved QA account, Home and the full nearby meetup list showed `0 встреч`, including after a cold app relaunch.
- Airplane/offline checks are blocked in this run: `simctl` has no real per-simulator network-off command, the Control Center UI path was not stable through XcodeBuildMCP, and disabling macOS network would affect the whole environment.
- Private runtime metrics were checked through `vps1`: production `api`, `chat` and `worker` containers returned `404` for internal `/metrics`, and no Prometheus/Grafana/exporter containers were running.

## Stop Conditions

- Stop if the simulator cannot build or launch.
- Stop if saved QA account login cannot proceed.
- Stop before changing production rollout flags.
- Stop before using or printing secrets in repo files.
