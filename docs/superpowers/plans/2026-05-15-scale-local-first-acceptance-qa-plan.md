# Scale Local First Acceptance QA Plan

Date: 2026-05-15

Scope: Task 24 acceptance QA for scale-local-first-performance on production.

Backend: production API `https://api.frendly.tech`.

Device: iOS simulator `iPhone 17 Pro`, iOS 26.5.

Accounts: saved repeated-digit QA accounts from local QA data. Do not write phone tokens or auth headers into reports.

## Checks

- [x] Backend health.
- [x] Launch cold on iOS simulator.
- [x] Login with test account.
- [x] Open Home first frame.
- [x] Open map and pan map.
- [x] Open dating.
- [ ] Swipe like. Blocked because the feed had no profiles.
- [x] Open chats.
- [x] Send direct text.
- [x] Send meetup text.
- [x] Send photo.
- [x] Relaunch app.
- [x] Reopen photo.
- [ ] Play voice. Blocked because tap did not give visible playback proof.
- [x] Create meetup.
- [ ] Join meetup from second account. Blocked because the second account did not see the created meetup.
- [ ] Switch to airplane mode after data is cached. Blocked because this simulator run had no safe scoped network-off control.
- [x] Read chats and hot screens after relaunch with network available.
- [ ] Send chat message offline, then reconnect. Blocked by the same network-off limitation.
- [x] Logout and login as another user.
- [x] Confirm old user's cached data is not visible.
- [x] Record API p95, outbox lag, WS connection count, Redis pubsub rate, DB pool wait and S3 status. Chat ack p95 is not exposed as a duration metric.

## Notes

- Backend health passed through `https://api.frendly.tech/health`.
- App built and launched with XcodeBuildMCP on the configured simulator.
- Login was checked by logging out from the saved `2222` session and logging in with the saved `1111` test account through SMS shortcut.
- Dating opened on both checked accounts, but both feeds showed `Пока нет новых профилей`, so swipe like remains blocked.
- Direct chat text sent: `as-direct-scale-2026-05-15-1058`.
- Meetup chat text sent: `йф-ьууегз-ысфду-2026-05-15-1059`.
- Photo send passed in meetup chat. A new attachment row was found in prod DB for the sent photo.
- Existing and newly sent photo could be reopened in media preview.
- Voice row was visible, but tapping it did not produce a visible playback state in screenshot or accessibility snapshot.
- Created meetup `as-create-scale-2026-05-15`; the prod DB contains event `ev-ddce64a8-2440-48cf-8cac-a99550c0ec69`.
- Join from the second account was not proven in this run.
- Airplane and offline chat checks are blocked in this run: `simctl` has no real per-simulator network-off command, Control Center UI was not stable through XcodeBuildMCP, and disabling macOS network was not used because it would affect the whole environment.
- Prometheus metrics are available on `vps1`. Public `/metrics` remains closed with `404`.

## Stop Conditions

- Stop if the simulator cannot build or launch.
- Stop if saved QA account login cannot proceed.
- Stop before changing production rollout flags.
- Stop before using or printing secrets in repo files.
