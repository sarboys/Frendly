# Scale Local First Acceptance QA Plan

Date: 2026-05-15

Scope: continue Task 24 acceptance QA for scale-local-first-performance.

Backend: production API `https://api.frendly.tech`.

Device: iOS simulator `iPhone 17 Pro`, iOS 26.5.

Accounts: saved repeated-digit QA accounts from local QA data. Do not write phone tokens or auth headers into reports.

## Checks

- [x] Launch cold on iOS simulator.
- [ ] Login with test account.
- [x] Open Home first frame.
- [x] Open map and pan map.
- [ ] Open dating and swipe like.
- [x] Open chats.
- [x] Send direct text.
- [ ] Send meetup text.
- [ ] Send photo.
- [x] Relaunch app.
- [ ] Reopen photo.
- [ ] Play voice.
- [ ] Create meetup.
- [ ] Join meetup from second account.
- [ ] Switch to airplane mode after data is cached.
- [ ] Read cached chats and hot screens.
- [ ] Send chat message offline, then reconnect.
- [ ] Logout and login as another user.
- [ ] Confirm old user's cached data is not visible.
- [ ] Record API p95, chat ack p95, outbox lag, WS connection count, Redis pubsub rate, DB pool wait and S3 errors if private metrics are available.

## Notes

- App launched into an existing saved simulator session, so login from a clean auth screen was not checked.
- Dating opened, but there were no profiles in the current feed, so swipe like was blocked.
- Direct chat text sent: `as-scale-local-first-2026-05-15`.

## Stop Conditions

- Stop if the simulator cannot build or launch.
- Stop if saved QA account login cannot proceed.
- Stop before changing production rollout flags.
- Stop before using or printing secrets in repo files.
