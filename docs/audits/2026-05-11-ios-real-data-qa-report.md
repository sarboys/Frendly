# iOS Real Data QA Report

Date: 2026-05-11
Timezone: Asia/Ho_Chi_Minh
Plan: `docs/superpowers/plans/2026-05-11-ios-real-data-qa-plan.md`

## Current Status

Stage 0, Stage 1, Stage 2, Stage 3, Stage 4 and Stage 5 completed for the first QA part.
Stage 6 is completed, including Stage 6.9 capacity edge. Stage 7 is completed as a QA pass with one blocking edit bug. Stage 8 is completed, including the photo upload follow-up, with one new image reload bug. Stage 9 is completed as a QA pass with one chat unread bug. Stage 10 is completed as a QA pass with profile state and social action bugs. Stage 11 core Guest B dating checks are completed, with one layout bug. Dating F was rechecked after Stage 16 and remains blocked by onboarding setup, now specifically by the ASCII keyboard mapping bug on the email step. Stage 12 is completed as a QA pass with one community chat access bug. Stage 13 is completed with one Affiche time prefill bug. Stage 14 evening flow passed, and a separate Home date mismatch was filed as `IOS-QA-017`. Stage 15 negative and recovery checks are completed. Stage 16 backend checks on vps1 are completed with notes about container-only health ports and quiet chat and worker logs. Stage 17 cleanup scope is recorded, with no backend deletes performed. Stage 19 continuation rechecked `IOS-QA-018` after a full app relaunch and reconfirmed `IOS-QA-017` on Home after the same relaunch. Stage 20 sent a fresh photo in another meetup chat and confirmed the same broken placeholder after reopening. Stage 21 retested fresh unread and added `IOS-QA-019` for stale chat list realtime row. Stage 22 confirmed the stale row survives navigation return, but cold relaunch refreshes it from backend. Stage 23 confirmed opening the refreshed row still lands on older history and does not clear unread. Stage 24 confirmed direct backend mark-read clears unread, while the active iOS Chats session can stay stale until cold relaunch. Stage 25 confirmed `IOS-QA-017` survives tab return, process relaunch and logout plus relogin. Stage 26 confirmed `IOS-QA-018` also reproduces in a personal direct chat. Stage 27 checked direct chat voice reload and found voice still visible after reopen and cold relaunch. Stage 28 confirmed personal direct chat row latest text can stay stale after realtime, and opening a visible latest message does not clear unread. Stage 29 confirmed `IOS-QA-020` still reproduces when opening from a fresh row after cold relaunch. Stage 30 confirmed direct REST mark-read clears backend unread, while active iOS Chats can stay stale until cold relaunch. Stage 31 did not reproduce `IOS-QA-012` on Host A after cold relaunch, and follow state persisted in UI and backend. Stage 32 found that direct chat file picker can return after selecting a txt file without sending or showing an error, while backend-seeded text/plain attachment renders after reopen and cold relaunch. Stage 33 showed PDF file picker send works in the same direct chat, and confirmed file download tap still gives no visible result. Stage 34 confirmed tapping the body of txt and PDF file attachments also gives no visible result. Stage 35 found the same silent picker failure with ZIP, while backend-seeded ZIP renders after cold relaunch. Stage 36 confirmed direct voice survives reopen, cold relaunch and playback. Stage 37 did not reproduce `IOS-QA-012` after relogin as Guest C and cold relaunch. Stage 38 found that Guest C Dating UI shows a Frendly+ gate while backend discover returns an eligible card. Stage 39 confirmed the gate CTA works after scrolling, trial activates backend Plus, and Dating discover unlocks, while the action row remains covered by bottom nav.
Stage 40 confirmed the unlocked Dating action row still has 0x0 action labels, label tap fails, coordinate tap does not change backend state, Likes tab is unlocked and empty, and cold relaunch keeps Dating unlocked but again shows stale Home date first.
Stage 41 confirmed Dating filter opens, applies a non matching interest to a local empty state, and reset restores the card. It also filed `IOS-QA-024` for weak accessibility semantics in filter controls.
Stage 42 confirmed the Dating profile for Пользователь 1111 matches backend after cold relaunch, but opening direct chat from that profile shows a generic `Личный чат` header instead of the backend peer name.
Stage 43 confirmed the new backend personal chat can be missing from the Personal filter until cold relaunch. After cold relaunch the row appears, but the empty-state hint is still rendered in the same row area. Opening that row shows the correct peer header.
Stage 44 confirmed the direct chat date invite card opens a prefilled `Свидание` draft, but `Отправить инвайт` returns to the same draft without visible error, created event, invite message or host dashboard row.
Stage 45 tried to recover the date invite by filling the description. The description field remained partly covered by the fixed CTA, tap by accessibility label did not focus it, and typed text was not accepted.
Stage 46 checked cleanup after the failed date invite draft. Back returned to the direct chat, cold relaunch opened Home instead of restoring the draft, backend stayed empty, and the direct chat row still opened with the correct peer title. The relaunch also reconfirmed stale Home date `Среда · 06 мая`.
Stage 47 checked normal direct text after failed invite flow. ASCII input was keyboard-mapped through Russian layout, the message appeared optimistically in the thread, backend stayed empty after a wait, the Chats row did not update, and the message disappeared after reopening the chat.

The app is built, installed and launched on iOS Simulator. Stage 5 joined, left and rejoined the public meetup as Guest B. Stage 6 created a request-based link-only meetup as Host E, submitted join requests, filled capacity to `8/8`, and verified that host approval beyond capacity is blocked. Stage 7 confirmed host edit UI opens, but `Сохранить` does not persist event changes. Stage 8 verified meetup chat history, text send, voice send, location attachment, photo attachment, cross-account read, reply and recovery after relaunch. Stage 9 verified in-app notifications for Host E, Guest C, Guest D and chat unread behavior. Stage 10 verified own profile, public profile, social actions and direct chat. Stage 11 verified dating discover, likes lock, like action, super-like quota and paywall behavior on Guest B. Stage 12 verified communities empty state, filters, paywall, community creation, detail, join, leave, chat access and owner create-meetup route.

## Environment

- Workspace: `/Users/sergeypolyakov/MyApp`
- Mobile app: `/Users/sergeypolyakov/MyApp/mobile`
- Flutter: `3.41.7`, stable channel
- Dart: `3.11.5`
- Simulator: `iPhone 17 Pro`, iOS `26.4`
- Simulator id: `A195A8F2-DCEB-4B12-9377-8F1D6294F072`
- Xcode workspace: `/Users/sergeypolyakov/MyApp/mobile/ios/Runner.xcworkspace`
- Xcode scheme: `Runner`
- Configuration: `Debug`
- Bundle id: `com.sergeypolyakov.frendly.dev`
- API URL from app config: `https://api.frendly.tech`
- WebSocket URL from app config: `wss://api.frendly.tech/ws`

## Stage 0: Environment Readiness

### Step 0.1: Git State

Command:

```bash
git status --short
```

Result:

```text
 M .understand-anything/domain-graph.json
 M .understand-anything/fingerprints.json
 M .understand-anything/knowledge-graph.json
 M .understand-anything/meta.json
 M .understand-anything/summary.json
 M MIGRATE_V5_DESIGN_PLAN.md
 M ai-context/entry-points.md
 M ai-context/frontend-flutter.md
```

Notes:

- Existing modified files were already present before QA execution.
- I did not revert or edit unrelated changes.

### Step 0.2: Flutter And Devices

Command:

```bash
cd mobile && flutter --version
cd mobile && flutter devices
```

Result:

- Flutter is installed.
- Before simulator boot, Flutter saw macOS and Chrome only.
- After XcodeBuildMCP booted the simulator, Flutter saw `iPhone 17 Pro`.

Final device evidence:

```text
iPhone 17 Pro (mobile) • A195A8F2-DCEB-4B12-9377-8F1D6294F072 • ios • iOS 26.4 simulator
```

### Step 0.3: Backend Config

File:

```text
mobile/lib/app/core/config/backend_config.dart
```

Result:

- `apiBaseUrl` default is `https://api.frendly.tech`.
- `chatWsUrl` default is `wss://api.frendly.tech/ws`.
- `BIG_BREAK_ENABLE_TEST_PHONE_SHORTCUTS` default is `false`.
- Seeded shortcut phones still work from code without that flag for the repeated-digit test accounts.

### Step 0.4: API Health

Command:

```bash
curl -i https://api.frendly.tech/health
```

Result:

```text
HTTP/1.1 200 OK
{"status":"ok","service":"api"}
```

### Step 0.5: vps1 Backend Context

Initial command:

```bash
ssh vps1 'cd /opt/frendly && docker compose ps'
```

Result:

- Command returned only table header, because it used the default compose file.

Follow-up command:

```bash
ssh vps1 'docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"'
```

Result:

- `frendly-backend-api-1`: healthy
- `frendly-backend-chat-1`: healthy
- `frendly-backend-worker-1`: healthy
- `frendly-backend-nginx-1`: healthy
- `frendly-backend-postgres-1`: healthy
- `frendly-backend-redis-1`: healthy
- `frendly-backend-pgbouncer-1`: healthy

Production compose file:

```text
/opt/frendly/compose.prod.yml
```

Note:

- Future backend log commands should use `docker compose -f compose.prod.yml ...` or direct container names.

### Step 0.6: QA Notes File

This file is the QA notes file for the run.

## Stage 1: Build And Launch iOS

### Step 1.1: XcodeBuildMCP Session And Build

Tool flow used:

```text
session_show_defaults
discover_projs
list_sims
list_schemes
session_set_defaults
build_run_sim
snapshot_ui
screenshot
```

Result:

- `build_run_sim` timed out at the tool call boundary after 120 seconds.
- The underlying build log shows `** BUILD SUCCEEDED **`.
- The simulator booted.
- `Runner.app` was installed.
- App launched with bundle id `com.sergeypolyakov.frendly.dev`.

Build log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/build_run_sim_2026-05-11T06-23-58-286Z_pid81871_cad81e0f.log
```

App log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T06-26-31-374Z_helperpid39160_ownerpid81871_74dab991.log
```

Installed app container:

```text
/Users/sergeypolyakov/Library/Developer/CoreSimulator/Devices/A195A8F2-DCEB-4B12-9377-8F1D6294F072/data/Containers/Bundle/Application/3A3FD3B3-6924-4789-ACF4-EFB57BDA4A33/Runner.app
```

### Step 1.2: Simulator Boot

Result:

- No simulator was booted at the start.
- `build_run_sim` booted `iPhone 17 Pro`.
- Simulator is now visible to Flutter.

### Step 1.3: Logs

Result:

- XcodeBuildMCP captured build and app logs.
- App logs are available for the next stages.

### Step 1.4: First Screen

UI hierarchy confirmed:

- App label: `Frendly`
- Main text: `Знакомства через вечера, а не свайпы.`
- Primary button: `Начать`
- SMS button: `Войти по SMS`
- Social buttons: Telegram, Google, Yandex

Screenshot:

```text
docs/audits/2026-05-11-ios-stage1-welcome.jpg
```

## Stage 2: Phone Login And Session Replacement

### Build Setup For Stage 2

Default local debug build did not authenticate `+70000000000` through the in-app shortcut path.

What happened:

- Entered `+70000000000`.
- Tapped `Получить код`.
- App called regular SMS OTP flow.
- Backend warned that SMS delivery provider is not configured.

Backend evidence:

```text
Phone OTP delivery unavailable ... provider=none
```

Direct backend check showed `/auth/phone/test-login` accepts `+70000000000`.

Workaround used for simulator QA:

- Rebuilt iOS with `BIG_BREAK_ENABLE_TEST_PHONE_SHORTCUTS=true`.
- Preserved the existing `DART_DEFINES`, including `BIG_BREAK_MAPKIT_API_KEY`.

Setup note:

- A first rebuild passed only the new test shortcut define and dropped existing `DART_DEFINES`.
- The app crashed on launch because native MapKit bootstrap did not receive `BIG_BREAK_MAPKIT_API_KEY`.
- Rebuilding with the full existing define list plus the shortcut flag fixed the crash.

### Step 2.1: Login As Host A

Account:

```text
+70000000000
```

Result:

- Login succeeded after rebuilding with the test shortcut flag.
- Host A entered onboarding.
- Location permission prompt appeared and was accepted.
- No SMS code was needed.

### Step 2.2: Finish Host A Onboarding

Data used:

```text
Email: qa.ios.70000000000@frendly.test
Birthday: 1995-01-01
Gender: male
Goal: И то и другое
City input: Moscow
Interests: Кофе, Бары
Vibe: Спокойно
```

Result:

- Host A reached Home.
- Home showed `FRENDLY` header, radar, meeting sections and bottom navigation.
- Header location showed `Сан-Франциско - Stockton St`, while Settings later showed city `Москва`.

Note:

- This looks like GPS position overriding manual onboarding city on Home. Needs a focused city consistency check in Stage 3.

### Step 2.3: Logout From Settings

Result:

- Opened `Я`.
- Opened settings.
- Scrolled to `Выйти`.
- Logout returned to `/welcome`.
- No authenticated screen was reachable after logout through visible navigation.

### Step 2.4: Login As Guest B

Account:

```text
+71111111111
```

Data used:

```text
Email: qa.ios.71111111111@frendly.test
Birthday: 1995-01-01
Gender: female
Goal: Друзья
City input: Moscow
Interests: Кофе, Бары
Vibe: Спокойно
```

Result:

- Login succeeded through the seeded repeated-digit shortcut.
- Guest B completed onboarding.
- Home showed a dating card for `Пользователь 0000`, not the current user.
- This confirms basic account separation for the Home dating preview after switching from Host A to Guest B.

### Step 2.5: Rapid Account Switch

Sequence:

```text
Guest B logout
Host A login
Host A logout
Guest C login
```

Results:

- Guest B logout returned to `/welcome`.
- Host A login returned directly to Home because onboarding was complete.
- Host A Home showed a dating card for `Пользователь 1111`, not self.
- Host A logout returned to `/welcome`.
- Guest C `+72222222222` login opened onboarding.

Important issue found:

- Guest C onboarding initially reused contact state from Host A.
- The email step showed `qa.ios.70000000000@frendly.test`.
- Saving then produced `Эта почта уже привязана к другому аккаунту`.
- The backend showed Guest C still had empty email at that point, so the failure came from client state, not actual duplicate DB data for Guest C.

Backend evidence:

```text
phoneNumber  | email
+72222222222 |
```

Temporary data action:

- Set Guest C email in Postgres to `7222222222201@frendly.test` to unblock the account after the stale-state failure.
- This was done only for the test account `+72222222222`.

After full app restart:

- Guest C onboarding restarted cleanly from step 1.
- The email field showed `7222222222201@frendly.test`.
- Guest C completed onboarding and reached Home.
- Home showed a dating card for `Пользователь 1111`, not self.

Screenshot:

```text
docs/audits/2026-05-11-ios-stage2-guest-c-home.jpg
```

### Step 2.6: Cold Start Recovery

Actions:

```text
stop_app_sim
launch_app_sim
snapshot_ui
```

Result:

- App relaunched into Home.
- Phone login was not requested again.
- No auth bootstrap loop was visible.
- Home still showed Guest C session content.

Screenshot:

```text
docs/audits/2026-05-11-ios-stage2-cold-start-home.jpg
```

## Stage 3: Home, Navigation, Search, City

Account:

```text
+72222222222
```

### Step 3.1: Home First Render

Result:

- Home rendered after the previous cold start without login.
- Header, city selector, radar card, meeting section, dating preview and bottom navigation were visible.
- Initial Home header still showed `Сан-Франциско - Stockton St`.
- Gathering rail had a valid empty state: `Пока нет встреч рядом. Открой список или создай свою.`
- Dating preview showed another test profile, not the current user.

Screenshot:

```text
docs/audits/2026-05-11-ios-stage3-home-first-render.jpg
```

### Step 3.2: Bottom Navigation And Entry Points

Result:

- Radar map opened from the Home radar card.
- Clubs opened and showed valid empty state with `Клубы` bottom label.
- Dating opened and showed `Пользователь 1111`.
- Chats opened and showed valid empty state plus AI chat card.
- Own profile opened.
- `Смотреть все` in the Home meeting section opened `/meetups`.
- Home FAB opened create meetup screen in normal mode.

Screenshots:

```text
docs/audits/2026-05-11-ios-stage3-map-radar.jpg
docs/audits/2026-05-11-ios-stage3-clubs.jpg
docs/audits/2026-05-11-ios-stage3-dating.jpg
docs/audits/2026-05-11-ios-stage3-chats.jpg
docs/audits/2026-05-11-ios-stage3-profile.jpg
docs/audits/2026-05-11-ios-stage3-meetups.jpg
docs/audits/2026-05-11-ios-stage3-create-fab.jpg
```

### Step 3.3: Search And Preview Routing

Result:

- Meetups search accepted input and kept a valid empty state.
- `type_text` entered Latin `QA iOS 2026-05-11` through the active Russian keyboard layout, so the field displayed Cyrillic characters. This looks like a simulator input limitation for this run, not an app bug.
- Affiche preview opened the full Affiche screen.
- Affiche card opened Affiche detail with ticket CTA.
- Routes preview opened route detail with `Опубликовать встречу`.

Screenshots:

```text
docs/audits/2026-05-11-ios-stage3-meetups-search.jpg
docs/audits/2026-05-11-ios-stage3-home-affiche-preview.jpg
docs/audits/2026-05-11-ios-stage3-affiche.jpg
docs/audits/2026-05-11-ios-stage3-affiche-detail.jpg
docs/audits/2026-05-11-ios-stage3-home-routes-preview.jpg
docs/audits/2026-05-11-ios-stage3-route-detail.jpg
```

### Step 3.4: City Selector

Result:

- City picker opened from Home header.
- The picker showed Moscow-region suggestions.
- Tapping `Москва` closed the sheet and changed Home header to `Москва`.
- This narrows IOS-QA-004: explicit manual selection works on Home, but initial post-onboarding or cold-start location source can still be inconsistent.

Screenshots:

```text
docs/audits/2026-05-11-ios-stage3-city-picker.jpg
docs/audits/2026-05-11-ios-stage3-city-moscow-selected.jpg
```

## Stage 4: Create Public Meetup

### Step 4.1: Open Create Flow As Host A

Account:

```text
+70000000000
```

Result:

- Logged out Guest C.
- Logged in Host A through phone shortcut with local number `0000000000` under the `+7` country prefix.
- Host A returned directly to Home.
- Home FAB opened create flow.
- Normal meetup mode was active.

### Step 4.2: Fill Minimum Valid Public Meetup

Input intended:

```text
Title: QA iOS 2026-05-11 Public Meetup A
Place: Brix · Покровка 12
Access: public
Price: free
Visibility: visible
```

Actual visible title:

```text
ЙФ шЩЫ 2026-05-11 Згидшс Ьууегз Ф
```

Notes:

- Simulator keyboard stayed in Russian layout. XcodeBuildMCP `type_text` sends ASCII key codes, so the title became keyboard-mapped Cyrillic.
- Place picker opened from create flow and selected the built-in nearby `Brix` suggestion.
- Description was not filled because the fixed CTA and current scroll state made lower fields hard to reach during this pass. The form still allowed preview and publish with required fields.

Screenshot:

```text
docs/audits/2026-05-11-ios-stage4-create-filled-minimum.jpg
```

### Step 4.3: Publish Meetup

Result:

- Publish preview opened.
- Publish action completed.
- Event detail opened after publish.
- Detail showed host block, place, attendance and host panel action.
- Event appeared on Home and `/meetups`.

Screenshots:

```text
docs/audits/2026-05-11-ios-stage4-publish-preview.jpg
docs/audits/2026-05-11-ios-stage4-event-detail-after-publish.jpg
docs/audits/2026-05-11-ios-stage4-meetups-list-after-publish.jpg
```

### Step 4.4: Evidence

Visible event title:

```text
ЙФ шЩЫ 2026-05-11 Згидшс Ьууегз Ф
```

Visible list evidence:

```text
1 встреча
Brix · Покровка 12 · 0.0 км
1/8
Открытое
```

Event id:

- Became visible after Guest B joined in Stage 5: `ev-e16d2f5f-75ad-4ef8-b17a-b418cab9f9ff`.
- App logs available through XcodeBuildMCP mostly contained MapKit warnings and did not expose a clear event id during Stage 4 itself.

## Stage 5: Public Join, Leave, Rejoin

### Step 5.1: Login As Guest B

Account:

```text
+71111111111
```

Result:

- Logged out Host A.
- Logged in Guest B through phone shortcut with local number `1111111111` under the `+7` country prefix.
- Guest B returned directly to Home.
- Home showed the newly created public meetup.

### Step 5.2: Open Event Detail As Guest B

Result:

- `/meetups` showed `1 встреча`.
- Event card showed title, Brix place, `1/8`, `Открытое`.
- Event detail opened.
- CTA showed `Присоединиться`.

Screenshots:

```text
docs/audits/2026-05-11-ios-stage5-guest-b-meetups-before-join.jpg
docs/audits/2026-05-11-ios-stage5-guest-b-event-detail-before-join.jpg
```

### Step 5.3: Join Public Event

Event id:

```text
ev-e16d2f5f-75ad-4ef8-b17a-b418cab9f9ff
```

Result:

- Tapping `Присоединиться` succeeded.
- App routed into evening flow.
- Attendance changed to `2/8`.
- Joined CTA became `Начать чек-ин` in evening flow.

Screenshot:

```text
docs/audits/2026-05-11-ios-stage5-guest-b-after-join-evening-flow.jpg
```

### Step 5.4: Leave Event

Result:

- Back to detail showed joined state with `Выйти из встречи` and `Начать вечер`.
- Tapping `Выйти из встречи` succeeded.
- Detail returned to `1/8`.
- CTA returned to `Присоединиться`.

Screenshot:

```text
docs/audits/2026-05-11-ios-stage5-guest-b-after-leave.jpg
```

### Step 5.5: Rejoin Event

Result:

- Rejoining succeeded.
- App routed into evening flow again.
- Attendance returned to `2/8`.
- No duplicate participant count was visible after rejoin.

Screenshot:

```text
docs/audits/2026-05-11-ios-stage5-guest-b-after-rejoin-evening-flow.jpg
```

## Stage 6: Private Meetup And Join Requests

### Step 6.1: Login As Host E

Account:

```text
+74444444444
```

Result:

- Logged out Guest B.
- Logged in Host E through phone shortcut with local number `4444444444` under the `+7` country prefix.
- Host E had incomplete onboarding.
- First onboarding email step showed stale Guest B email `qa.ios.71111111111@frendly.test`, which repeated IOS-QA-002.
- Host E backend email was set to `qa.ios.74444444444@frendly.test`.
- Full app restart cleared local onboarding state.
- Host E finished onboarding and reached Home.

Evidence:

```text
docs/audits/2026-05-11-ios-stage6-host-e-home-after-onboarding.jpg
```

### Step 6.2: Create Private Request-Based Meetup

Intended title:

```text
QA iOS 2026-05-11 Private Meetup E
```

Actual visible title:

```text
ЙФ шЩЫ 2026-05-11 Зкшмфеу Ьууегз У
```

Result:

- Opened create flow from Home FAB.
- Entered title.
- Saved manual place as `Икс Зщлкщмлф 12 · Свой адрес`.
- Set access to `По заявке`.
- Set visibility to `По ссылке`.
- Publish preview showed `по ссылке`.
- Publish succeeded.
- Event detail showed `Идут 1/8` and `По заявке`.

Screenshots:

```text
docs/audits/2026-05-11-ios-stage6-create-request-access.jpg
docs/audits/2026-05-11-ios-stage6-private-preview.jpg
docs/audits/2026-05-11-ios-stage6-private-detail-after-publish.jpg
```

### Step 6.3: Login As Guest C And Check Visibility

Account:

```text
+72222222222
```

Result:

- Logged out Host E.
- Logged in Guest C through phone shortcut with local number `2222222222`.
- Guest C returned directly to Home.
- Home showed only the public meetup.
- `/meetups` showed `1 ВСТРЕЧ`, only the public meetup.
- The Host E link-only meetup was hidden from discovery, as expected for `По ссылке`.

Screenshots:

```text
docs/audits/2026-05-11-ios-stage6-guest-c-home-private-hidden.jpg
docs/audits/2026-05-11-ios-stage6-guest-c-meetups-private-hidden.jpg
```

Blocked next step:

- Join request was not submitted yet because the test needs an invite link, exact event route, or host dashboard path for the link-only meetup.

### Step 6.4: Guest C Submit Join Request

Exact route:

```text
/event/ev-e82bb1fb-028a-4a85-b8f6-980306f9469e
```

Deep link used on simulator:

```text
frendly:///event/ev-e82bb1fb-028a-4a85-b8f6-980306f9469e
```

Result:

- Guest C opened the link-only meetup by exact route.
- Guest C tapped `Отправить заявку`, then submitted the request screen.
- Event detail CTA changed to `Заявка отправлена`.
- Repeated tap did not create a duplicate pending request.
- Backend showed one pending request from `Пользователь 2222`.

Backend evidence:

```text
requestId: cmp118677005zpe1zonkuz56i
eventId: ev-e82bb1fb-028a-4a85-b8f6-980306f9469e
status: pending
requestCount: 1
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage6-guest-c-request-sent.jpg
```

### Step 6.5: Guest D Submit Join Request

Account:

```text
+73333333333
```

Setup note:

- Guest D still needed onboarding.
- Onboarding was completed through `PUT /onboarding/me` with email `qa.ios.73333333333@frendly.test` to unblock the request flow.

Result:

- Guest D opened the same exact route.
- Guest D submitted a join request.
- Backend showed two pending requests for Host E.

Backend evidence:

```text
Guest C requestId: cmp118677005zpe1zonkuz56i
Guest D requestId: cmp11ij5b0067pe1zbgj9bijm
pending requestCount: 2
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage6-guest-d-request-sent.jpg
```

### Step 6.6: Host E Dashboard With Two Requests

Account:

```text
+74444444444
```

Result:

- Host E opened `/host`.
- Dashboard showed `Новые заявки · 2`.
- Request cards were visible for `Пользователь 2222` and `Пользователь 3333`.
- Approve and reject controls were visible on both cards.

Screenshot:

```text
docs/audits/2026-05-11-ios-stage6-host-dashboard-two-requests.jpg
```

### Step 6.7: Approve Guest C

Result:

- UI coordinate taps on the dashboard `Принять` button did not trigger review.
- The approval was completed through the same backend endpoint used by the dashboard: `POST /host/requests/:requestId/approve`.
- Host dashboard then showed `Новых заявок нет`.
- Event card showed `2/8`.
- Fill rate changed to `25%`.

Backend evidence:

```text
requestId: cmp118677005zpe1zonkuz56i
userName: Пользователь 2222
status: approved
reviewedAt: 2026-05-11T10:14:16.679Z
```

Guest C state:

```text
joined: true
joinRequestStatus: approved
chatId: cmp10vn8m005npe1z534n9mm6
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage6-host-dashboard-after-review.jpg
docs/audits/2026-05-11-ios-stage6-guest-c-approved-detail.jpg
```

### Step 6.8: Reject Guest D

Result:

- The rejection was completed through `POST /host/requests/:requestId/reject`.
- Guest D is not a participant.
- Guest D has no chat access.
- iOS detail shows requestable state with CTA `Отправить заявку`.

Backend evidence:

```text
requestId: cmp11ij5b0067pe1zbgj9bijm
userName: Пользователь 3333
status: rejected
reviewedAt: 2026-05-11T10:14:17.556Z
```

Guest D state:

```text
joined: false
joinRequestStatus: rejected
chatId: null
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage6-guest-d-rejected-detail.jpg
```

### Step 6.9: Capacity Edge

Event:

```text
ev-e82bb1fb-028a-4a85-b8f6-980306f9469e
```

Result:

- Started from `going=2`, `capacity=8`.
- Added Capacity H `+77777777777` by `POST /events/:eventId/join-request`, then approved through `POST /host/requests/:requestId/approve`.
- Filled the remaining five places with `+75555555555`, `+76666666666`, `+78888888888`, `+79999999999` and `+70000000000`.
- Backend detail then showed `going=8`, `capacity=8`, and seven non-host attendees plus Host E.
- iOS detail for Guest D showed `Идут 8/8` and `Кто идёт · 8`.

Approved fill request ids:

```text
+77777777777: cmp11zv35006xpe1zbstmjtxp
+75555555555: cmp120w7p007dpe1zmn7iluxx
+76666666666: cmp120ybg007tpe1zionyh1mb
+78888888888: cmp12107q0089pe1z6jth7hvu
+79999999999: cmp1212fm008ppe1zlz654xcn
+70000000000: cmp1214do0095pe1zz2ytout5
```

Over-capacity checks:

```text
+71111111111 requestId: cmp121m7y009lpe1zk2r6h5ym
+73333333333 requestId: cmp11ij5b0067pe1zbgj9bijm
POST /host/requests/cmp121m7y009lpe1zk2r6h5ym/approve -> 409 event_full, "Event capacity is full"
POST /host/requests/cmp11ij5b0067pe1zbgj9bijm/approve -> 409 event_full, "Event capacity is full"
POST /events/:eventId/join as +73333333333 -> 409 join_request_required
```

Viewer state after over-capacity request:

```text
Guest D joined: false
Guest D joinRequestStatus: pending
Guest D chatId: null
Event going: 8
Event capacity: 8
```

Notes:

- iOS still allows a new join request on a full request-based meetup.
- The request screen shows `8 из 8`, then after submit the CTA becomes `Заявка отправлена`.
- Backend keeps this user out of the meetup and blocks host approval, so capacity is not exceeded.
- This looks like a waitlist-style behavior. I did not file it as a bug without a product rule that full private meetups must block new requests.

Screenshots:

```text
docs/audits/2026-05-11-ios-stage6-9-before-capacity-fill-guest-d.jpg
docs/audits/2026-05-11-ios-stage6-9-full-capacity-guest-d.jpg
docs/audits/2026-05-11-ios-stage6-9-full-capacity-request-sent-guest-d.jpg
```

## Stage 7: Host Edit And Event Lifecycle

### Step 7.1: Open Host Event As Host E

Account:

```text
+74444444444
```

Routes:

```text
/host/event/ev-e82bb1fb-028a-4a85-b8f6-980306f9469e
/event/ev-e82bb1fb-028a-4a85-b8f6-980306f9469e
```

Result:

- Logged out Guest D through Settings.
- Logged in Host E through phone shortcut.
- Opened the host event route.
- Host dashboard showed `Новые заявки · 2`, fill rate `100%`, and the selected event card `8/8`.
- Opened the same event detail as Host E.
- Host-only edit control was visible in the detail header.

Screenshots:

```text
docs/audits/2026-05-11-ios-stage7-host-e-host-event-route.jpg
docs/audits/2026-05-11-ios-stage7-host-e-detail-edit-control.jpg
```

### Step 7.2: Edit Core Fields

Backend state before edit:

```text
title: ЙФ шЩЫ 2026-05-11 Зкшмфеу Ьууегз У
going: 8
capacity: 8
description: Встречаемся: Икс Зщлкщмлф 12 · Свой адрес
time: Сегодня · 11:48
startsAtIso: 2026-05-11T11:48:28.883Z
```

Result:

- Tapped host edit control.
- Edit screen opened with prefilled title, place, date, capacity and description.
- Local title change appeared in edit preview as `... Зкшмфеу 777 Ьууегз У`.
- Tapped `Сохранить`.
- App returned to detail.
- Detail still showed the old title.
- Backend state after save was unchanged.

Backend state after save:

```text
title: ЙФ шЩЫ 2026-05-11 Зкшмфеу Ьууегз У
going: 8
capacity: 8
description: Встречаемся: Икс Зщлкщмлф 12 · Свой адрес
time: Сегодня · 11:48
startsAtIso: 2026-05-11T11:48:28.883Z
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage7-edit-title-local-change.jpg
docs/audits/2026-05-11-ios-stage7-after-save-detail-unchanged.jpg
```

### Step 7.3: Cancel Edit

Result:

- Reopened edit.
- Added another local title marker.
- Tapped back without saving.
- Backend detail remained unchanged.
- No partial backend write was observed.

### Step 7.4: Delete Or Cancel Meetup

Result:

- No host delete or cancel event control was visible in event detail, edit screen, or host dashboard.
- Code context only showed join request cancellation and participant leave, not host event delete or cancel.
- Treated as unsupported in the current build, not filed as a bug.

## Stage 8: Meetup Chat And Realtime

Chat:

```text
chatId: cmp10vn8m005npe1z534n9mm6
eventId: ev-e82bb1fb-028a-4a85-b8f6-980306f9469e
Host E: +74444444444
Guest C: +72222222222
```

### Step 8.1: Open Meetup Chat

Result:

- Opened `/meetup/cmp10vn8m005npe1z534n9mm6` as Host E.
- Chat header showed the private meetup and `8 участников`.
- Pinned meetup card was visible with place, date, distance and `8/8`.
- Composer was visible as `Сообщение…`.
- Backend REST history initially returned zero messages.

Screenshot:

```text
docs/audits/2026-05-11-ios-stage8-host-e-chat-open-empty.jpg
```

### Step 8.2: Send Host Text And Voice

Result:

- Typed `20260511 801 4444` as Host E.
- First tap hit the microphone control instead of send.
- iOS requested microphone permission.
- Permission was granted.
- A 4 second voice message was recorded and sent.
- Then the text message was sent.
- iOS showed both messages in the thread.

Backend evidence:

```text
voice message id: cmp12hcpj0001pg1z4yebzjok
voice attachments: 1
text message id: cmp12hie60005pg1zzwz3jkaw
text: 20260511 801 4444
lastEventId: 42
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage8-host-e-text-and-voice-sent.jpg
```

### Step 8.3: Read As Guest C

Result:

- Logged out Host E.
- Logged in Guest C.
- Opened the same meetup chat.
- Guest C saw the Host E voice message and text message.
- Backend REST for Guest C returned the same two messages.
- Meetup chat list exposed `lastMessage`, but `unreadCount` was `null` in this API payload, so there was no numeric unread count to verify.

Screenshot:

```text
docs/audits/2026-05-11-ios-stage8-guest-c-sees-host-messages.jpg
```

### Step 8.4: Send Guest C Reply

Result:

- Guest C sent `20260511 802 2222` through iOS UI.
- iOS showed the reply in the thread.
- Backend REST returned the new message with a server id.

Backend evidence:

```text
message id: cmp12k6wl0008pg1zrs9w24ap
text: 20260511 802 2222
lastEventId: 43
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage8-guest-c-reply-sent.jpg
```

### Step 8.5: Offline-Like Recovery

Result:

- Closed the app while Guest C was current account.
- Sent `20260511 803 4444` as Host E through the same WebSocket protocol.
- Relaunched the app.
- Opened the chat as Guest C.
- Missed message loaded in iOS.
- Backend REST returned four unique message ids, no duplicate.

Backend evidence:

```text
offline message id: cmp12lbye000bpg1zwe8hk13o
texts:
- ""
- 20260511 801 4444
- 20260511 802 2222
- 20260511 803 4444
lastEventId: 44
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage8-guest-c-offline-recovery.jpg
```

### Step 8.6: Attachment

Result:

- Attachment sheet opened from the composer.
- Sheet showed `Камера`, `Фото`, `Файл`, `Геолокация`.
- Added a QA screenshot to simulator Photos through `xcrun simctl addmedia`.
- Follow-up after Stage 16 used a local simulator app reset because Dating F was stuck in onboarding and no visible logout path existed.
- Reinstalled the same existing simulator build from `mobile/build/ios/iphonesimulator/Runner.app`.
- Logged in as Guest C and reopened chat `cmp10vn8m005npe1z534n9mm6`.
- Photo picker opened and asked for photo library permission.
- Full photo library access was granted.
- Selected the QA screenshot from Photos.
- Image upload completed.
- The image appeared in chat immediately after upload.
- Backend REST returned a ready `image/jpeg` attachment.
- After reopening the chat, the same image bubble showed a broken image placeholder instead of the image.
- This is filed as `IOS-QA-018`.
- A geolocation attachment was sent successfully.
- Backend REST returned the location payload as the fifth message.
- iOS rendered the location card with `Ты здесь`, coordinates and `Открыть карту`.

Backend evidence:

```text
text: __bb_location__:{"latitude":37.785834,"longitude":-122.406417,"title":"Ты здесь","subtitle":"37.785834, -122.406417"}
lastEventId: 45

photo messageId: cmp178xfw000rpg1znkcva3n2
mediaAssetId: cmp178x8400chpe1zj43nrv1v
mimeType: image/jpeg
byteSize: 26370
status: ready
url: /media/cmp178x8400chpe1zj43nrv1v
downloadUrlPath: /media/cmp178x8400chpe1zj43nrv1v/download-url
direct media GET: 307 redirect to signed S3 URL
download-url endpoint: 200 with signed image URL
curl -L media download: 200 image/jpeg 26370
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage8-attachment-sheet.jpg
docs/audits/2026-05-11-ios-stage8-location-attachment-sent.jpg
docs/audits/2026-05-11-ios-stage8-6-photo-picker-sheet-repeat.jpg
docs/audits/2026-05-11-ios-stage8-6-photo-attachment-sent.jpg
docs/audits/2026-05-11-ios-stage8-6-photo-attachment-reopen-broken.jpg
```

### Step 8.7: Voice

Result:

- Covered during Step 8.2.
- Microphone permission prompt appeared and was accepted.
- Voice message sent.
- Backend REST returned the message with one attachment.
- Guest C saw the voice message after switching accounts.

## Stage 9: Notifications

Accounts and entities:

```text
Host E: +74444444444
Guest C: +72222222222
Guest D: +73333333333
chatId: cmp10vn8m005npe1z534n9mm6
eventId: ev-e82bb1fb-028a-4a85-b8f6-980306f9469e
```

### Step 9.1: Host E Notifications After Requests

Result:

- Logged in as Host E.
- Notifications screen showed join request notifications for the private meetup.
- Tapping a join request notification routed to event detail.
- The notifications list did not show inline `Принять` or `Отклонить` actions for host requests.
- Host dashboard showed the actionable review state with `Новые заявки · 2`, `Отклонить` and `Принять`.

Backend evidence:

```text
+74444444444 /notifications/unread-count: 10
+74444444444 /notifications: top items kind=event_joined, title=Новая заявка
Host dashboard pending requests: Guest D and Guest B
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage9-host-e-join-request-notifications.jpg
docs/audits/2026-05-11-ios-stage9-host-e-dashboard-request-actions.jpg
```

### Step 9.2: Guest C Approval Notification

Result:

- Logged in as Guest C.
- Notifications screen showed approval notification: `Тебя приняли на встречу`.
- Tapping it routed to the event detail for `ev-e82bb1fb-028a-4a85-b8f6-980306f9469e`.
- Backend showed the notification as `event_joined` with `status=approved`.

Backend evidence:

```text
+72222222222 /notifications/unread-count before tap: 1
notification id: cmp11ohhd006lpe1zz1bkhmvl
payload status: approved
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage9-guest-c-approval-notification.jpg
```

### Step 9.3: Guest D Rejection Notification

Result:

- Logged in as Guest D.
- Notifications screen showed rejection notification: `Заявку на встречу ... отклонили`.
- This matches the backend notification payload with `status=rejected`.
- Host dashboard still had a pending row for Guest D after a later reopened request, so the old rejection notification remains visible while the current request can be pending again.

Backend evidence:

```text
+73333333333 /notifications/unread-count: 1
notification id: cmp11oi57006ppe1zg9608kv4
payload status: rejected
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage9-guest-d-rejection-notification.jpg
```

### Step 9.4: Chat Unread Notification

Result:

- Sent `20260511 901 4444` as Host E through WebSocket while Guest C was not in the chat.
- Backend meetup chat unread for Guest C increased from `3` to `4`.
- iOS Home bottom nav showed `4` on `Чаты`.
- iOS chat row showed the latest message and unread `4`.
- Opening the meetup chat did not clear unread on backend.
- The chat opened on older messages, while `20260511 901 4444` existed in the accessibility tree offscreen.

Backend evidence:

```text
before guest C chat unread: 3
sent message id: cmp130w38000hpg1zbnfs0irf
sent text: 20260511 901 4444
after send guest C chat unread: 4
after opening chat guest C chat unread: 4
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage9-guest-c-chat-unread-4.jpg
```

## Stage 10: Profiles, Social, Direct Chat

Accounts:

```text
Host A: +70000000000, user-2132494b-d607-4e21-9982-3e939f72a572
Guest B: +71111111111, user-304f0edb-76db-439c-ae10-5b9a52f76da6
Guest C: +72222222222, user-91891ec2-a270-4ff3-b28d-63a5eda246fc
```

### Step 10.1: Own Profile

Result:

- Opened own profile as Guest C.
- Header and profile shell opened.
- SOS entry opened the `Кнопка SOS` screen.
- Settings entry opened `Настройки аккаунта`.
- Profile body showed stale data again: avatar initials `П3` while backend `/me` for Guest C returned `Пользователь 2222`.
- Own profile still showed public social actions like `Подписаться`, already covered by `IOS-QA-006`.

Backend evidence:

```text
+72222222222 /me displayName: Пользователь 2222
+72222222222 /profile/me city: 37.78583
iOS own profile visible initials: П3
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage10-guest-c-own-profile-stale-p3.jpg
docs/audits/2026-05-11-ios-stage10-guest-c-sos-screen.jpg
docs/audits/2026-05-11-ios-stage10-settings-open.jpg
```

### Step 10.2: Host A Public Profile As Guest B

Result:

- Logged in as Guest B.
- Opened Host A public profile through `frendly:///user/user-2132494b-d607-4e21-9982-3e939f72a572`.
- Header showed `Пользователь 0000`.
- Profile body showed stale initials `П3` and generic `Пользователь, 31`.
- Backend `/people/:userId` returned Host A as `Пользователь 0000`.
- `Подписаться` was visible.
- Tapping `Подписаться` twice did not persist follow state. Backend stayed `iFollow=false`.

Backend evidence:

```text
/people/user-2132494b-d607-4e21-9982-3e939f72a572 displayName: Пользователь 0000
/people/user-2132494b-d607-4e21-9982-3e939f72a572/social before tap: iFollow=false
/people/user-2132494b-d607-4e21-9982-3e939f72a572/social after tap: iFollow=false
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage10-guest-b-host-a-public-profile-stale-body.jpg
```

### Step 10.3: Direct Chat From Public Profile

Result:

- Tapped `Написать` from Host A public profile as Guest B.
- Direct chat opened.
- Backend created or reused direct chat `cmp13baks00aepe1zvvuegmnl`.
- First send attempt hit the microphone control and created a voice message.
- Tapping the inline send control sent the text marker `20260511 1003 1111`.
- Host A backend personal chat list showed unread `2` with last message `20260511 1003 1111`.

Backend evidence:

```text
direct chat id: cmp13baks00aepe1zvvuegmnl
voice message id: cmp13cmj0000kpg1zc9ckroxz
text message id: cmp13cq24000opg1zcot9ya2o
text: 20260511 1003 1111
Host A personal unread: 2
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage10-guest-b-direct-chat-opened.jpg
docs/audits/2026-05-11-ios-stage10-direct-chat-message-sent.jpg
```

### Step 10.4: Self Social Action

Result:

- Backend safely rejected self follow and self like as Guest B.
- This proves backend guard works.
- iOS own profile still exposes self social actions, already covered by `IOS-QA-006`.

Backend evidence:

```text
PUT /people/user-304f0edb-76db-439c-ae10-5b9a52f76da6/follow -> 400 self_social_action_not_allowed
PUT /people/user-304f0edb-76db-439c-ae10-5b9a52f76da6/reactions/like -> 400 self_social_action_not_allowed
```

## Stage 11: Dating

Accounts:

```text
71111111111: Guest B, user-304f0edb-76db-439c-ae10-5b9a52f76da6
+75555555555: Dating F, user-ec911a12-748e-4fa6-accd-0a66c51e6a69
```

### Step 11.1: Dating F Setup Check

Result:

- Switched from Guest B to Dating F.
- The app opened onboarding `Шаг 1 из 7`, email step.
- Backend `/me` returned `Пользователь 5555`.
- Backend `/dating/discover?limit=5` returned `0`.
- I did not complete onboarding through backend shortcuts. Main Stage 11 UI checks continued on Guest B.

Repeat check after Stage 16:

- Logged out from Guest C through UI.
- Logged in as Dating F `+75555555555` through SMS shortcut.
- App again opened onboarding `Шаг 1 из 7`, email step.
- Backend `/me` returned `onboardingCompleted=null`, `city=null`.
- Backend `/onboarding/me` returned `requiredContact=email`.
- Backend `/dating/discover?limit=5` still returned `0`.
- Tried to enter `dating.f.20260511@example.com` in the email field.
- UI mapped ASCII input through Russian layout into `вфештпюаю20260511»учфьздуюсщь`.
- `Дальше` stayed disabled, so Dating F setup could not continue through UI.
- This is another impact of existing `IOS-QA-008`.

Backend evidence:

```text
Dating F user id: user-ec911a12-748e-4fa6-accd-0a66c51e6a69
Dating F displayName: Пользователь 5555
Dating F discover count: 0
Dating F onboarding requiredContact: email
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage11-dating-f-onboarding-blocked-repeat.jpg
docs/audits/2026-05-11-ios-stage11-dating-f-email-keyboard-blocked.jpg
```

### Step 11.2: Guest B Dating Discover

Result:

- Opened `/dating` as Guest B.
- Header showed back, title and filter.
- Discover showed real backend card `Пользователь 0000, 31`.
- Card did not show public profile follow or social like controls.
- Backend `/dating/discover?limit=10` returned 4 cards.
- The three dating action buttons were visible only partly, because the local bottom nav covered the action row.

Backend evidence:

```text
Guest B discover before actions: 4
1. user-2132494b-d607-4e21-9982-3e939f72a572, Пользователь 0000
2. user-54b74d92-1f3f-4c2a-8d61-deeb63a74f7c, Пользователь 4444
3. user-91891ec2-a270-4ff3-b28d-63a5eda246fc, Пользователь 2222
4. user-b09ef3c6-1272-48b7-b8e6-dce0bdbacb76, Пользователь 3333
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage11-guest-b-dating-discover.jpg
```

### Step 11.3: Like Action

Result:

- Tapped `Лайк` on `Пользователь 0000`.
- UI advanced to `Пользователь 4444`.
- Backend discover decreased from 4 to 3.
- `/matches?limit=10` still returned 0, so the like was not reciprocal.

Backend evidence:

```text
Guest B discover after like: 3
Remaining first card: Пользователь 4444
Matches after like: 0
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage11-guest-b-after-like-advanced.jpg
```

### Step 11.4: Super-like Quota

Result:

- Tapped `Супер` on `Пользователь 4444`.
- UI advanced to `Пользователь 2222`.
- UI showed `Суперлайков осталось: 0`.
- Backend discover decreased to 2.
- Tapping `Супер` again on `Пользователь 2222` opened paywall.
- Backend direct check for the same target returned `402 super_like_limit_reached`.
- After returning from paywall, UI still showed `Пользователь 2222`, so the failed action rolled back.

Backend evidence:

```text
Guest B discover after super-like limit: 2
Remaining cards: Пользователь 2222, Пользователь 3333
POST /dating/actions super_like -> 402 super_like_limit_reached
requestId: 8a57e9a3-d178-476f-8c0f-6fc372ce670b
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage11-guest-b-superlike-remaining.jpg
docs/audits/2026-05-11-ios-stage11-guest-b-superlike-limit-paywall.jpg
```

### Step 11.5: Incoming Likes Locked State

Result:

- Opened `Лайки` tab as Guest B.
- UI showed locked state: `Лайки доступны с Frendly+`.
- Tapping `Открыть Frendly+` opened paywall.
- Backend `/dating/likes?limit=5` for Guest B returned `403 frendly_plus_required`.

Backend evidence:

```text
GET /dating/likes?limit=5 -> 403 frendly_plus_required
requestId: ad2a564e-8ec4-446d-8fe5-ac41e5096db5
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage11-guest-b-dating-likes-locked.jpg
docs/audits/2026-05-11-ios-stage11-guest-b-dating-paywall.jpg
```

## Stage 12: Communities

Accounts:

```text
+71111111111: Guest B, user-304f0edb-76db-439c-ae10-5b9a52f76da6
+72222222222: Guest C, user-91891ec2-a270-4ff3-b28d-63a5eda246fc
```

Created community:

```text
id: cmp14125v00b2pe1z2eqs2ado
chatId: cmp14125n00b0pe1zqny6x5ze
name: клуб тест 20260511
owner: Guest B
privacy: public
```

### Step 12.1: Communities Empty State And Filters

Result:

- Guest B opened `Клубы`.
- Backend `GET /communities?limit=20` returned `count=0`.
- UI showed empty state, search, filters and bottom nav label `Клубы`.
- Filter sheet opened with access, area and interest filters.
- Search input repeated `IOS-QA-008`: typing `coffee` rendered as Russian-layout text.

Screenshots:

```text
docs/audits/2026-05-11-ios-stage12-guest-b-communities-empty.jpg
docs/audits/2026-05-11-ios-stage12-guest-b-communities-filter.jpg
```

### Step 12.2: Community Creation And Detail

Result:

- Guest B as non-plus tapped create community.
- UI opened Frendly+ paywall.
- Backend direct create returned `403 community_plus_required`.
- Guest B started trial from the paywall.
- Backend subscription changed to `status=trial`, `plan=year`.
- Guest B created public community `клуб тест 20260511`.
- Detail opened and showed owner actions `Создать встречу` and `Открыть чат`.

Backend evidence:

```text
POST /communities as non-plus -> 403 community_plus_required
community id: cmp14125v00b2pe1z2eqs2ado
chat id: cmp14125n00b0pe1zqny6x5ze
joined: true
isOwner: true
members: 1
unread: 0
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage12-guest-b-create-community-paywall.jpg
docs/audits/2026-05-11-ios-stage12-guest-b-create-community-filled.jpg
docs/audits/2026-05-11-ios-stage12-guest-b-community-detail-owner.jpg
```

### Step 12.3: Owner Create Meetup Route

Result:

- Guest B tapped `Создать встречу` on community detail.
- App opened create meetup from the community route.
- A meetup was not published in this step, because publish flow was already covered in Stage 4.

Screenshot:

```text
docs/audits/2026-05-11-ios-stage12-guest-b-community-create-meetup-route.jpg
```

### Step 12.4: Guest C Join And Leave

Result:

- Guest C opened communities list and saw `клуб тест 20260511`.
- Detail showed `Вступить` with members count `1`.
- Guest C joined the public community.
- UI changed to `Выйти`, members count became `2`.
- Backend showed `joined=true`, `isOwner=false`.
- Guest C left the community.
- UI changed back to `Вступить`, members count became `1`.
- Backend showed `joined=false`, `isOwner=false`.

Backend evidence after leave:

```text
id: cmp14125v00b2pe1z2eqs2ado
name: клуб тест 20260511
joined: false
isOwner: false
unread: 0
chatId: cmp14125n00b0pe1zqny6x5ze
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage12-guest-c-communities-list.jpg
docs/audits/2026-05-11-ios-stage12-guest-c-community-after-join.jpg
docs/audits/2026-05-11-ios-stage12-guest-c-community-after-leave.jpg
```

### Step 12.5: Chat Access Before Join

Result:

- Before joining, Guest C detail had `joined=false` on backend.
- UI still showed `Открыть чат`.
- Tapping it opened community chat `Чат сообщества клуб тест 20260511` with composer visible.
- This is filed as `IOS-QA-015`.

Screenshot:

```text
docs/audits/2026-05-11-ios-stage12-guest-c-community-chat-before-join.jpg
```

## Stage 13: Affiche, Routes, AI Create

Account:

```text
+72222222222
```

### Step 13.1: Affiche

Result:

- Opened `/affiche` through `frendly:///affiche`.
- UI loaded `18 событий`.
- Backend `GET /affiche/events?city=Москва&limit=3` returned matching first cards.
- Opened detail `cmowwapbe00dfp50j2ieqmuzw`.
- Detail matched backend title, city, free price, date and time.

Backend evidence:

```text
id: cmowwapbe00dfp50j2ieqmuzw
title: показ фильма «Собачье сердце»
city: Москва
priceMode: free
priceFrom: 0
startsAt: 2026-05-11T12:00:00.000Z
timeLabel: 15:00
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage13-affiche-list.jpg
docs/audits/2026-05-11-ios-stage13-affiche-detail-free.jpg
```

### Step 13.2: Affiche Create Prefill

Result:

- `Собрать компанию` opened create meetup prefill.
- Title, place and free price were prefilled.
- Affiche detail showed `15:00`.
- Create preview and publish preview showed `19:00`.
- Publish was not executed because the time was already wrong.
- This is filed as `IOS-QA-016`.

Screenshots:

```text
docs/audits/2026-05-11-ios-stage13-affiche-create-prefill-time-mismatch.jpg
docs/audits/2026-05-11-ios-stage13-affiche-publish-preview-time-mismatch.jpg
```

### Step 13.3: Routes Catalog And Detail

Result:

- Opened `/routes`.
- Current app city was San Francisco, and UI showed a valid empty state.
- Authenticated backend check for `city=Сан-Франциско` returned 0 templates.
- Authenticated backend check for `city=Москва` returned 10 templates.
- Opened route detail directly for `cmp0r3ckj002vpe1zppk92kvf`.
- Detail showed title, Moscow city, steps and `Опубликовать встречу`.
- Publish preview opened from the route detail.
- Publish was not executed to avoid creating extra QA event data.

Backend evidence:

```text
route id: cmp0r3ckj002vpe1zppk92kvf
title: На природе: пространство «Харизма»
city: Москва
stepsCount: 2
first step ticketUrl: https://kudago.com/msk/place/klub-harizma/
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage13-routes-empty.jpg
docs/audits/2026-05-11-ios-stage13-route-detail.jpg
docs/audits/2026-05-11-ios-stage13-route-publish-preview.jpg
```

### Step 13.5: AI Create

Result:

- Opened `/ai-create`.
- XcodeBuildMCP `type_text` could not type the planned Cyrillic prompt. It failed on the first Cyrillic character.
- Pasteboard fallback inserted unrelated text, so the UI check used built-in prompt `Свидание · уютный ужин и долгая прогулка`.
- UI resolve returned a visible plan with `2 шага · вечером`.
- The exact planned prompt was checked through backend as Guest C.
- Backend returned `201 Created`, route `route_508d996a514a5fc119a5fb77`, 3 steps.

Backend evidence:

```text
POST /evening/routes/resolve
prompt: QA iOS 2026-05-11 вечер на двоих в центре с бюджетом до 3000
status: 201 Created
route id: route_508d996a514a5fc119a5fb77
title: Вечер для двоих: Кафе-библиотека в «Доме Книги»
steps: 3
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage13-ai-create-result.jpg
```

## Stage 14: Evening Flow, Check In, After Party

Accounts:

```text
72222222222: Guest C, user-91891ec2-a270-4ff3-b28d-63a5eda246fc
+74444444444: Host E
+73333333333: Guest D, non-member check
```

Event:

```text
eventId: ev-e82bb1fb-028a-4a85-b8f6-980306f9469e
chatId: cmp10vn8m005npe1z534n9mm6
title: ЙФ шЩЫ 2026-05-11 Зкшмфеу Ьууегз У
place: Икс Зщлкщмлф 12 · Свой адрес
```

### Step 14.1: Open Evening Flow

Result:

- Guest C backend detail showed `joined=true`, `joinRequestStatus=approved`, `chatId=cmp10vn8m005npe1z534n9mm6`, `going=8`, `capacity=8`.
- Opened `/evening/ev-e82bb1fb-028a-4a85-b8f6-980306f9469e` through `frendly:///evening/ev-e82bb1fb-028a-4a85-b8f6-980306f9469e`.
- UI opened the route stage with the same title, place, time, capacity and `Начать чек-ин`.
- Guest D backend check for `/events/:eventId/check-in` returned `403 event_forbidden`.

Screenshot:

```text
docs/audits/2026-05-11-ios-stage14-guest-c-evening-route-open.jpg
```

### Step 14.2: Check In

Result:

- Guest C opened `Чек-ин`.
- UI showed `0/8` on site and code `59f060fc82b13129b95ac95e`.
- Tapping `Подтвердить чек-ин` succeeded and routed to Live.
- Backend detail changed `attendanceStatus` from `not_checked_in` to `checked_in`.
- Backend check-in summary changed to `checkedInCount=1`, `attendeesCount=8`.

Backend evidence after confirm:

```text
attendanceStatus: checked_in
check-in status: checked_in
checkedInCount: 1
attendeesCount: 8
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage14-guest-c-check-in-before.jpg
docs/audits/2026-05-11-ios-stage14-guest-c-live-after-check-in.jpg
```

### Step 14.3: Live State And Chat

Result:

- Before host start, Guest C backend live returned `status=idle`, `startedAt=null`, `checkedInCount=1`.
- Host E started live through `POST /host/events/:eventId/live/start`.
- Backend returned `status=live`, `startedAt=2026-05-11T12:08:10.244Z`, `finishedAt=null`.
- Guest C backend live then returned `status=live`, `elapsedMinutes=2`, `chatId=cmp10vn8m005npe1z534n9mm6`, `attendeesCount=8`, `checkedInCount=1`, `storiesCount=0`.
- Guest C opened meetup chat from the Live screen.
- Current backend host live start implementation only updates `EventLiveState`; no system chat message is written there.

Screenshots:

```text
docs/audits/2026-05-11-ios-stage14-guest-c-live-after-check-in.jpg
docs/audits/2026-05-11-ios-stage14-guest-c-live-chat-open.jpg
```

### Step 14.4: After Party And Feedback

Result:

- Guest C opened `After`.
- Backend after-party returned `saved=false`, `favoriteUserIds=[]`, `attendeesCount=7`.
- UI showed the backend-backed fallback copy about missing vote options, participant list and no fake venues.
- Share summary showed `1` place, `8` people and `0` moments.
- Guest C opened final feedback and tapped `Готово`.
- Backend after-party then returned `saved=true`, `vibe=cozy`, `hostRating=5`, `favoriteUserIds=[]`, `attendeesCount=7`.

Backend evidence:

```text
saved: true
vibe: cozy
hostRating: 5
favoriteUserIds: []
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage14-guest-c-after-party.jpg
docs/audits/2026-05-11-ios-stage14-guest-c-share-summary.jpg
docs/audits/2026-05-11-ios-stage14-guest-c-final-feedback.jpg
```

## Stage 15: Negative And Recovery Cases

Account:

```text
+72222222222: Guest C, user-91891ec2-a270-4ff3-b28d-63a5eda246fc
```

### Step 15.1: Missing Title

Result:

- Started a fresh regular meetup draft.
- Added a custom place while leaving title empty.
- Tapped `Дальше · превью`.
- UI stayed on create and showed `Добавь название встречи.`
- Backend `/events?date=2026-05-11` did not show a new event from the missing title draft.

Screenshots:

```text
docs/audits/2026-05-11-ios-stage15-missing-title-validation.jpg
```

Backend evidence:

```text
matching Stage 15 events after missing title validation: 1
existing event: ev-b8d21592-e4c6-46ec-9cb2-caf227aba0b1
```

### Step 15.2: Past Date

Result:

- Opened date picker from create meetup.
- Dates before 2026-05-11 were visible but disabled.
- Previous month navigation was disabled.
- No crash or invalid publish path was reachable from UI.

Screenshot:

```text
docs/audits/2026-05-11-ios-stage15-past-date-disabled.jpg
```

### Step 15.3: Double Publish Tap

Result:

- Created a valid draft as Guest C.
- Before publish, backend showed no Guest C host upcoming events in `/host/dashboard`.
- Tapped `Опубликовать`, then immediately tapped it again.
- Second tap could not hit the button because the UI had already moved away from publish state.
- Backend event list showed exactly one created matching event, not a duplicate pair.

Created event:

```text
eventId: ev-b8d21592-e4c6-46ec-9cb2-caf227aba0b1
chatId: cmp1660vn00bzpe1z80cwy523
title: Ыефпу 15 Зфые Вфеу
startsAtIso: 2026-05-11T14:15:00.000Z
time: Сегодня · 14:15
place: Ыефпу 15 Кусщмукн Здфсу · Свой адрес
going: 1
capacity: 8
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage15-double-publish-result.jpg
```

Note:

- The same time shift already filed as `IOS-QA-007` repeated here. Create and publish preview showed `21:15`, but detail and backend showed `14:15`.

### Step 15.4: Back During Request

Result:

- Reopened the publish flow from the draft.
- Tapped `Опубликовать`, then tapped back at the top left while the UI was still transitioning.
- App did not crash.
- Create screen remained usable after returning.
- Returning to Home showed no stuck spinner.
- Backend still showed only one matching Stage 15 event, so the interrupted attempt did not create a second meetup.

Screenshot:

```text
docs/audits/2026-05-11-ios-stage15-recovery-after-back-home.jpg
```

Backend evidence:

```text
matching Stage 15 events after back-during-request: 1
eventId: ev-b8d21592-e4c6-46ec-9cb2-caf227aba0b1
```

### Step 15.5: Backend 401 Recovery

Result:

- Started on Home as Guest C.
- Home still showed stale date label `Среда · 06 мая`.
- Logged out through Settings without editing secure storage.
- App returned to Welcome.
- Logged in again as `+72222222222` through the SMS shortcut path.
- App returned to Home.
- Stopped and relaunched the app through XcodeBuildMCP.
- App restored the session and stayed on Home.
- No endless retry loop or forced Welcome redirect was visible.

Screenshots:

```text
docs/audits/2026-05-11-ios-stage15-5-home-before-logout.jpg
docs/audits/2026-05-11-ios-stage15-5-home-after-relogin-coldstart.jpg
```

Backend evidence:

```text
12:29:03 AuthService Logout session revoke, user Guest C session revoked=1
12:30:24 AuthService Issued test phone shortcut session for Guest C
Earlier tail showed access token rejection followed by one refresh rotation:
12:21:27 AuthGuard Rejected access token reason=invalid_payload
12:21:27 AuthService Rotated refresh token for Guest C session 196e1be6-e7b0-4e31-9cd3-694d39c97b41
```

App log evidence:

```text
No 401, refresh, logout or token error lines after cold relaunch.
Repeated MapKit host errors were present.
```

Notes:

- This pass did not manually corrupt secure storage.
- Refresh failure clearing was not force-triggered.
- The observed backend 401 recovery path rotated refresh once and did not loop.

## Stage 16: Backend Checks On vps1

### Step 16.1: Service Health

Result:

- `docker compose -f compose.prod.yml ps` showed api, chat, worker, nginx, postgres, redis, pgbouncer and admin services healthy.
- Direct `curl http://127.0.0.1:3000/health` from the vps1 host failed because service ports are not exposed on the host loopback.
- Health from inside containers passed.

Evidence:

```text
api: 200 {"status":"ok","service":"api"}
chat: 200 {"status":"ok","service":"chat"}
worker: 200 {"status":"ok","service":"worker"}
```

### Step 16.2: API Logs

Result:

- API logs showed Stage 15.5 logout and relogin for Guest C.
- API logs also showed prior 401 recovery evidence, with one rejected access token and one refresh rotation.
- Recent tail did not include per-request create or join route lines for the Stage 15 event.

Evidence:

```text
12:29:03 Logout session revoke, requestId=1ec9dcca-5e44-40a7-8c64-07a362763acb
12:30:24 Issued test phone shortcut session for Guest C
12:21:27 Rejected access token, requestId=7800afd0-46c1-4aaa-a910-7cbfd5000196, reason=invalid_payload
12:21:27 Rotated refresh token, requestId=a01e96f9-4153-4cb6-82b8-5ca7aa6ee733
```

### Step 16.3: Chat Logs

Result:

- Chat service is healthy.
- Recent chat log tail was quiet for runtime messaging.
- Startup log only showed Nest app start and `/health` route mapping.
- DB confirms Stage 14 chat messages and unread state.

DB evidence:

```text
chatId: cmp10vn8m005npe1z534n9mm6
messages: 6
latest: 2026-05-11 10:51:55.124
Guest C unreadCount: 4
```

### Step 16.4: Worker Logs

Result:

- Worker service is healthy.
- Recent worker log tail was quiet.
- Startup log only showed Nest app start and `/health` route mapping.
- Outbox backlog check below showed no pending or failed queue.

### Step 16.5: DB Records For QA Data

Result:

- Stage 15 event exists once.
- Stage 14 event remains live.
- Stage 14 participant, attendance and feedback rows match the UI and API notes.

DB evidence:

```text
Stage 15 event:
id=ev-b8d21592-e4c6-46ec-9cb2-caf227aba0b1
title=Ыефпу 15 Зфые Вфеу
startsAt=2026-05-11 14:15:00
hostId=user-91891ec2-a270-4ff3-b28d-63a5eda246fc
chatId=cmp1660vn00bzpe1z80cwy523
capacity=8
title count=1

Stage 14 event:
id=ev-e82bb1fb-028a-4a85-b8f6-980306f9469e
chatId=cmp10vn8m005npe1z534n9mm6
capacity=8
participants=8
live status=live
startedAt=2026-05-11 12:08:10.244
Guest C attendance=checked_in
Guest C checkedInAt=2026-05-11 12:06:43.021
Guest C feedback vibe=cozy
Guest C feedback hostRating=5
```

### Step 16.6: Outbox Backlog

Result:

- No pending backlog was visible.
- No failed rows were visible in the grouped status query.

DB evidence:

```text
status=done count=165
```

## Stage 17: Cleanup

### Step 17.1: Keep Reproduction Data

Result:

- No backend records were deleted.
- Reproduction data was kept for open bugs and follow-up triage.
- Cleanup was read-only, using API and DB checks.

Keep list:

```text
ev-e82bb1fb-028a-4a85-b8f6-980306f9469e
reason: Stage 14 live event, Stage 8 chat, Stage 8.6 photo attachment, IOS-QA-011, IOS-QA-018 evidence.
host: +74444444444
chatId: cmp10vn8m005npe1z534n9mm6

cmp178x8400chpe1zj43nrv1v
reason: IOS-QA-018 media reload evidence.
messageId: cmp178xfw000rpg1znkcva3n2
chatId: cmp10vn8m005npe1z534n9mm6

ev-b8d21592-e4c6-46ec-9cb2-caf227aba0b1
reason: Stage 15 negative and duplicate publish evidence, plus repeated IOS-QA-007 time mismatch evidence.
host: +72222222222
chatId: cmp1660vn00bzpe1z80cwy523

cmp14125v00b2pe1z2eqs2ado
reason: IOS-QA-015 community chat access repro.
owner: +71111111111
chatId: cmp14125n00b0pe1zqny6x5ze

cmowwapbe00dfp50j2ieqmuzw
reason: IOS-QA-016 Affiche prefill time repro.
```

### Step 17.2: Delete Throwaway QA Events Through UI

Result:

- No deletion was performed.
- Stage 17 did not find a safe throwaway record that could be removed without losing repro evidence.
- The current UI was Guest C inside `cmp10vn8m005npe1z534n9mm6`, where the latest image attachment still showed the broken placeholder.

### Step 17.3: Record Data For Later Cleanup

Result:

- One older public QA event can be considered for later cleanup if it is not needed by the team.
- It was not deleted during this pass because cleanup policy was not approved.

Candidate:

```text
title: ЙФ шЩЫ 2026-05-11 Згидшс Ьууегз Ф
eventId: ev-e16d2f5f-75ad-4ef8-b17a-b418cab9f9ff
chatId: cmp0x4e8b004mpe1ztyql479d
host phone: +70000000000
hostId: user-2132494b-d607-4e21-9982-3e939f72a572
createdAt: 2026-05-11 08:06:40.898
startsAt: 2026-05-11 10:00:00
current API state for Guest C: joined=false, liveStatus=idle, chatId=null
reason to remove later: older public QA event, not currently tied to a listed open bug.
```

## Observations

### IOS-QA-001: Test shortcut range is inconsistent between backend and client

Severity: high for QA speed and test account range.

Account:

```text
+70000000000
```

Expected:

- Any account in the declared range `+70000000000` to `+79999999999` can login immediately for testing.

Actual:

- Backend `/auth/phone/test-login` accepts `+70000000000`.
- Client default seeded shortcut list does not include `+70000000000`.
- Without `BIG_BREAK_ENABLE_TEST_PHONE_SHORTCUTS=true`, the app tries real OTP request.

Evidence:

```text
Phone OTP delivery unavailable ... provider=none
```

Impact:

- QA runs can accidentally hit the SMS flow for valid test accounts.
- Stage 2 needed a rebuild with the test shortcut define.

Fixed candidate 2026-05-12:

- Added mobile tests for `+70000000000`, `+71111111111`, `+79999999999`, plus OTP fallback for `+71234567890`.
- Updated the client seeded shortcut list to include repeated-digit `+7` test phones from `+70000000000` through `+79999999999`.
- Verification: `cd mobile && flutter test test/features/phone_auth/presentation/phone_auth_screen_test.dart` passed.

### IOS-QA-002: Onboarding local state can leak between switched accounts

Severity: high.

Accounts:

```text
+70000000000
+72222222222
```

Steps:

1. Complete or partially complete onboarding as Host A.
2. Logout.
3. Login as Guest C.
4. Go through onboarding to the email step.

Expected:

- Guest C onboarding uses Guest C backend data only.
- Email field is empty or contains Guest C email.

Actual:

- Guest C email step displayed Host A email: `qa.ios.70000000000@frendly.test`.
- Save showed `Эта почта уже привязана к другому аккаунту`.
- Backend DB showed Guest C email was still empty before manual correction.

Evidence:

```text
phoneNumber  | email
+72222222222 |
```

Impact:

- Fast account switching can put stale contact data into onboarding.
- A real tester can accidentally submit another user's email or phone.
- Error text can blame email while the underlying duplicate may be another stale contact field.

Workaround observed:

- Full app restart cleared the stale client state.
- After restart, Guest C onboarding used the expected email.

### IOS-QA-003: Onboarding geolocation can get stuck with invalid MapKit key

Severity: medium.

Screen:

```text
Onboarding step 2, Где ты?
```

Steps:

1. Tap `Определить по гео`.
2. Wait.

Expected:

- Location resolves or a clear error appears.
- User can continue by manual entry.

Actual:

- Button changed to `Определяем локацию`.
- It stayed in that state during the test.
- Manual typing into the field still allowed progress.

Evidence:

```text
Unexpected server response: Forbidden. Body :Invalid api key
Could not fetch [https://proxy.mob.maps.yandex.net:443/mapkit2/init/2.x/random]
```

Impact:

- Onboarding location and later place search flows may be unreliable until MapKit key is fixed.

### IOS-QA-004: Manual city and Home header location are inconsistent

Severity: medium.

Expected:

- After manual onboarding city `Moscow`, Home and Settings should have a consistent city source or show a clear GPS override.

Actual:

- Settings showed `Город Москва`.
- Home header showed `Сан-Франциско - Stockton St` for Host A before later permission state changed.
- After Guest C cold start, Home header showed `Геолокация недоступна`.

Impact:

- User may not understand which location source drives feed and radar.

### IOS-QA-OBS-001: Yandex MapKit starts with invalid API key

Severity: medium until map and place flows are tested.

Evidence from app log:

```text
Unexpected server response: Forbidden. Body :Invalid api key
Could not fetch [https://proxy.mob.maps.yandex.net:443/mapkit2/init/2.x/random]
The request cannot be processed by any of the hosts.
```

Likely cause:

- Local environment variable `BIG_BREAK_MAPKIT_API_KEY` is unset.
- The app passes `BIG_BREAK_MAPKIT_API_KEY` to native iOS MapKit bootstrap through `String.fromEnvironment`.

Impact to verify later:

- Radar map.
- City geolocation.
- Place picker in Create Meetup.
- Onboarding city and area search.

### IOS-QA-OBS-002: Test phone shortcut flag is unset locally

Severity: low for the seeded repeated-digit accounts.

Evidence:

```text
BIG_BREAK_ENABLE_TEST_PHONE_SHORTCUTS=unset
```

Notes:

- Code still enables shortcut login for seeded repeated-digit accounts.
- The primary QA account matrix uses those accounts first.
- Full range testing from `+70000000000` to `+79999999999` may need `BIG_BREAK_ENABLE_TEST_PHONE_SHORTCUTS=true` at build time.

### IOS-QA-005: Radar map opens but native map is visually blank

Severity: medium.

Account:

```text
+72222222222
```

Screen:

```text
Radar map
```

Expected:

- Native map shows readable streets, POIs or at least usable map details.

Actual:

- Radar opened, controls rendered, but the map content was an empty Yandex grid with no useful map detail.
- This is likely the same root cause as IOS-QA-OBS-001, invalid local Yandex MapKit key.

Evidence:

```text
docs/audits/2026-05-11-ios-stage3-map-radar.jpg
```

Impact:

- Radar is not useful for QA of map markers, place context or nearby discovery until MapKit key is fixed.

### IOS-QA-006: Own profile exposes self social actions

Severity: medium.

Account:

```text
+72222222222
```

Screen:

```text
Own profile, bottom nav `Я`
```

Expected:

- Own profile hides invalid public social actions against the current user.

Actual:

- Own profile showed `Подписаться`, like and share controls.

Evidence:

```text
docs/audits/2026-05-11-ios-stage3-profile.jpg
```

Impact:

- The current user can see actions that belong to public profile viewing, not own profile.

### IOS-QA-007: Create meetup time changes after publish

Severity: high.

Account:

```text
+70000000000
+74444444444
```

Screen:

```text
Create meetup, publish preview, event detail, meetups list
```

Steps:

1. Open create meetup from Home FAB.
2. Keep date as `Сегодня · 17:00`.
3. Select `Brix · Покровка 12`.
4. Open publish preview.
5. Publish the event.

Expected:

- The published event keeps `17:00`.
- Detail and list show the same time as create and publish preview.

Actual:

- Create screen and publish preview showed `17:00`.
- Event detail after publish showed `Сегодня 10:00`.
- `/meetups` card also showed `Сегодня · 10:00`.
- Detail also showed duration as `≈2 часа до 23:00`, which conflicts with `10:00`.
- The same issue repeated in Stage 6. Create and publish preview showed `18:48`, but event detail showed `11:48`.

Evidence:

```text
docs/audits/2026-05-11-ios-stage4-publish-preview.jpg
docs/audits/2026-05-11-ios-stage4-event-detail-after-publish.jpg
docs/audits/2026-05-11-ios-stage4-meetups-list-after-publish.jpg
docs/audits/2026-05-11-ios-stage6-private-preview.jpg
docs/audits/2026-05-11-ios-stage6-private-detail-after-publish.jpg
```

Impact:

- Published meetup time is wrong or rendered from the wrong timezone/source.
- This can break join tests, reminders and host expectations.

### IOS-QA-008: ASCII text input is keyboard-mapped through Russian layout in simulator

Severity: low for product, medium for QA automation.

Screen:

```text
Create meetup title, Meetups search
```

Expected:

- Test automation can enter ASCII QA markers like `QA iOS 2026-05-11`.

Actual:

- XcodeBuildMCP `type_text` entered ASCII key codes through the active Russian layout.
- `QA iOS 2026-05-11 Public Meetup A` became `ЙФ шЩЫ 2026-05-11 Згидшс Ьууегз Ф`.

Impact:

- QA data is harder to search by the planned ASCII prefix.
- This is likely an environment issue, not a product bug.

### IOS-QA-009: Create meetup visibility choice is partly blocked by fixed CTA

Severity: medium.

Account:

```text
+74444444444
```

Screen:

```text
Create meetup, lower section `Кто увидит`
```

Expected:

- `Все рядом` and `По ссылке` are fully visible and tappable without fighting the fixed bottom CTA.

Actual:

- The `Кто увидит` options appeared under the fixed `Дальше · превью` button near the bottom of the screen.
- Selecting `По ссылке` required tapping the small visible top edge of the card.
- Normal preset scroll gestures did not expose the whole option. A coordinate swipe was needed.

Evidence:

```text
docs/audits/2026-05-11-ios-stage6-private-preview.jpg
```

Fixed candidate 2026-05-12:

- Mobile moved `CreateMeetupScreen` fixed bottom CTA out of the Stack overlay and added safe-area-aware bottom reserve for the scroll view.
- Test passed: `cd mobile && flutter test test/features/create_meetup/presentation/create_meetup_screen_test.dart --name "create meetup (keeps bottom fields above fixed CTA|sends request join mode for invite visibility)"`.

Impact:

- Hosts can miss the private visibility setting.
- This can cause accidental public visibility or a stuck create flow on smaller screens.

### IOS-QA-010: Host event edit save does not persist changes

Severity: high.

Account:

```text
+74444444444
```

Screen:

```text
/event/ev-e82bb1fb-028a-4a85-b8f6-980306f9469e -> edit
```

Expected:

- Host edits title, capacity, date, place or description.
- Tapping `Сохранить` writes the change to backend.
- Detail, host dashboard and related meetup cards refresh with the new value.

Actual:

- Edit screen opened and local preview updated after changing the title.
- Tapping `Сохранить` returned to detail.
- Detail still showed the old title.
- Backend `GET /events/:eventId` returned the old title and unchanged fields.

Evidence:

```text
docs/audits/2026-05-11-ios-stage7-edit-title-local-change.jpg
docs/audits/2026-05-11-ios-stage7-after-save-detail-unchanged.jpg
```

Backend evidence:

```text
Before save title: ЙФ шЩЫ 2026-05-11 Зкшмфеу Ьууегз У
After save title: ЙФ шЩЫ 2026-05-11 Зкшмфеу Ьууегз У
```

Code note:

- `CreateMeetupScreen` edit mode validates local fields, invalidates `eventDetailProvider`, then pops the route.
- I did not find a mobile repository call or backend host event update endpoint for this save path.

Impact:

- Hosts cannot edit published meetups from iOS.
- Stage 7.2 checks for list and chat card refresh are blocked because the save never persists.

### IOS-QA-011: Opening meetup chat does not clear unread when the latest message is offscreen

Severity: medium.

Account:

```text
+72222222222
```

Screen:

```text
Chats -> meetup chat cmp10vn8m005npe1z534n9mm6
```

Expected:

- A new meetup chat message increments unread.
- Opening the chat clears unread for the latest seen message.
- The chat opens near the newest unread message or at the latest message.

Actual:

- Host E sent `20260511 901 4444`.
- Backend unread for Guest C increased from `3` to `4`.
- iOS Chats tab and chat row showed unread `4`.
- Opening the meetup chat did not clear unread on backend.
- The thread opened around older Stage 8 messages, while the new message existed offscreen.

Evidence:

```text
docs/audits/2026-05-11-ios-stage9-guest-c-chat-unread-4.jpg
```

Backend evidence:

```text
message id: cmp130w38000hpg1zbnfs0irf
text: 20260511 901 4444
after opening chat unread: 4
```

Follow-up evidence from Stage 21:

```text
baseline unread: 4
fresh message id: cmp1bkzfs000zpg1zfh06sznl
fresh text: QA unread fresh 2026-05-11T14:51:19.598Z
after send unread: 5
after opening chat unread: 5
after scrolling until fresh message visible unread: 5
screenshots:
docs/audits/2026-05-11-ios-stage21-unread-open-chat-latest-offscreen.jpg
docs/audits/2026-05-11-ios-stage21-unread-latest-visible-still-unread.jpg
```

Follow-up evidence from Stage 23:

```text
Cold relaunch refreshed the Chats row to the Host E latest message and unread 5.
Opening that fresh row still landed on older history around 17:36 to 17:41.
Backend unread remained 5 after open.
screenshot:
docs/audits/2026-05-11-ios-stage23-open-fresh-row-old-history.jpg
```

Follow-up evidence from Stage 24:

```text
Direct POST /chats/cmp10vn8m005npe1z534n9mm6/read with latest message cmp1bkzfs000zpg1zfh06sznl returned ok true.
Backend unread changed to 0.
The active iOS Chats session still showed badge 5 until cold relaunch.
After cold relaunch, the Stage 14 row showed the latest Host E message with no unread badge.
screenshot:
docs/audits/2026-05-11-ios-stage24-api-read-cold-relaunch-updated.jpg
```

Impact:

- Users can open a chat and still keep a stale unread badge.
- The newest unread message can be easy to miss.
- In the Stage 21 retest, unread stayed stale even after the newest message became visible.
- In the Stage 23 retest, even a fresh row after relaunch did not open near the latest unread message.
- Stage 24 shows the backend read path works; the remaining risk is iOS read command, read target, or runtime list state.

Fixed candidate 2026-05-12:

- Added chat list `lastMessageId` to the backend response so mobile can mark the latest unread summary message even when the thread opens on older history.
- Mobile now uses the unread row summary message id before falling back to the latest loaded incoming message.
- Verification: XcodeBuildMCP on iPhone 17 Pro iOS 26.5, Guest C, fresh realtime meetup message `QA realtime unread 2026-05-12T04:15:30Z` from Host E. The Chats row updated, opening the meetup cleared the unread badge, backend `/chats/meetups` returned unread `0`.

### IOS-QA-012: Public profile header and body can show different users

Severity: high.

Account:

```text
+71111111111
```

Screen:

```text
/user/user-2132494b-d607-4e21-9982-3e939f72a572
```

Expected:

- Public profile header and body show the same target user.
- Social actions operate on that target user.
- Backend and UI state match after follow or like.

Actual:

- Header showed Host A as `Пользователь 0000`.
- Body showed stale initials `П3` and generic `Пользователь, 31`.
- Backend `/people/:userId` returned `Пользователь 0000`.
- Tapping `Подписаться` did not persist. Backend stayed `iFollow=false`.

Evidence:

```text
docs/audits/2026-05-11-ios-stage10-guest-b-host-a-public-profile-stale-body.jpg
```

Backend evidence:

```text
target user id: user-2132494b-d607-4e21-9982-3e939f72a572
target displayName: Пользователь 0000
after follow tap: iFollow=false
```

Impact:

- A user can see mixed identity data on a public profile.
- Social actions can appear available but do nothing.

Follow-up from Stage 31:

```text
Stage 31 did not reproduce this bug on the same Host A public profile after cold relaunch.
UI showed the same target across header and body:
П0 / Пользователь 0000 / Пользователь 0000, 31 / Moscow.
Backend /people/:userId returned displayName Пользователь 0000, age 31, city Moscow.
After tapping follow, UI changed to Вы подписаны and backend /people/:userId/social returned followers 1, iFollow true.
After cold relaunch and reopening the same profile, UI and backend still matched.
Keep this issue open because Stage 10 has direct mismatch evidence, but the Stage 31 path is currently clean.
```

Follow-up screenshots:

```text
docs/audits/2026-05-11-ios-stage31-host-a-profile-consistent.jpg
docs/audits/2026-05-11-ios-stage31-host-a-profile-follow-persisted.jpg
docs/audits/2026-05-11-ios-stage31-host-a-profile-after-relaunch-follow-persisted.jpg
```

### IOS-QA-013: Direct chat composer can trigger voice recording while text is present

Severity: medium.

Account:

```text
+71111111111
```

Screen:

```text
Direct chat cmp13baks00aepe1zvvuegmnl
```

Expected:

- After text is entered, the primary action sends the text.
- Tapping the right composer action should not start voice recording while text is present.

Actual:

- Entered `20260511 1003 1111`.
- Tapping the right composer control started and sent a voice message first.
- The text stayed in the field and only sent after tapping the inline send control near the text field.

Evidence:

```text
docs/audits/2026-05-11-ios-stage10-direct-chat-message-sent.jpg
```

Backend evidence:

```text
voice message id: cmp13cmj0000kpg1zc9ckroxz
text message id: cmp13cq24000opg1zcot9ya2o
text: 20260511 1003 1111
```

Impact:

- Users can accidentally record and send voice while trying to send typed text.

### IOS-QA-014: Dating action row is covered by the bottom navigation

Severity: medium.

Account:

```text
+71111111111
```

Screen:

```text
/dating
```

Expected:

- `Пропустить`, `Супер` and `Лайк` are fully visible and easy to tap.
- Snackbars appear above the local bottom nav and do not hide nav labels or action controls.

Actual:

- The dating card and action row extend under the local bottom nav.
- `Пропустить`, `Супер` and `Лайк` are clipped at the bottom of the screen.
- The super-like quota snackbar appears over the bottom nav area.
- Coordinate taps still triggered actions during QA, but the visible controls are hard to read and use.

Evidence:

```text
docs/audits/2026-05-11-ios-stage11-guest-b-dating-discover.jpg
docs/audits/2026-05-11-ios-stage11-guest-b-superlike-remaining.jpg
docs/audits/2026-05-11-ios-stage39-dating-unlocked-after-trial-action-row-covered.jpg
docs/audits/2026-05-12-ios-stage40-dating-action-row-baseline.jpg
docs/audits/2026-05-12-ios-stage40-dating-coordinate-like-no-action.jpg
docs/audits/2026-05-12-ios-stage40-dating-scroll-up-action-row-still-hidden.jpg
docs/audits/2026-05-12-ios-stage40-dating-after-cold-relaunch-unlocked-action-row-covered.jpg
```

Stage 39 follow-up:

```text
After Guest C activated Frendly+ trial, Dating discover unlocked and showed the card for Пользователь 1111.
The action labels Пропустить, Супер, Лайк and 01 / 01 still had 0x0 frames.
The visible subscription/social row started around y=854 while the bottom nav started at y=806.
```

Stage 40 follow-up:

```text
On 2026-05-12 after trial, Лайк existed in accessibility with a 0x0 frame.
Tapping Лайк by label failed with invalid frame size.
A coordinate tap at x=322 y=764 did not change UI, discover count or matches.
Scroll-up did not reveal the action row.
After cold relaunch and opening Dating again, the same card was visible and the action labels still had 0x0 frames.
```

Impact:

- Main dating actions look broken on iPhone 17 Pro.
- Users may miss the actions or tap bottom navigation by accident.

### IOS-QA-015: Community chat can open before membership

Severity: medium.

Account:

```text
+72222222222
```

Screen:

```text
/communities/cmp14125v00b2pe1z2eqs2ado
```

Expected:

- A non-member should not be able to open the community chat composer before joining.
- The chat button should be hidden, disabled or should require join first.
- Backend and UI access state should match.

Actual:

- Backend returned `joined=false` for Guest C.
- UI still showed `Открыть чат`.
- Tapping it opened `Чат сообщества клуб тест 20260511` with composer visible.
- After leaving the community, UI again returned to `Вступить`, but `Открыть чат` stayed visible.

Evidence:

```text
docs/audits/2026-05-11-ios-stage12-guest-c-community-chat-before-join.jpg
docs/audits/2026-05-11-ios-stage12-guest-c-community-after-leave.jpg
```

Backend evidence:

```text
id: cmp14125v00b2pe1z2eqs2ado
joined: false
isOwner: false
chatId: cmp14125n00b0pe1zqny6x5ze
```

Impact:

- A public club chat is reachable before membership.
- Users can bypass the intended join gate.

### IOS-QA-016: Affiche create prefill shifts event time to device timezone

Severity: medium.

Account:

```text
+72222222222
```

Screen:

```text
/affiche/cmowwapbe00dfp50j2ieqmuzw -> create meetup -> publish preview
```

Expected:

- Create meetup from an Affiche event keeps the event local time shown in Affiche detail.
- Detail, create preview and publish preview show the same event time.

Actual:

- Affiche detail showed `11 мая · 15:00`.
- Backend returned `startsAt=2026-05-11T12:00:00.000Z` and `timeLabel=15:00`.
- Create meetup prefill showed `сегодня · 19:00`.
- Publish preview also showed `Сегодня · 19:00`.

Evidence:

```text
docs/audits/2026-05-11-ios-stage13-affiche-detail-free.jpg
docs/audits/2026-05-11-ios-stage13-affiche-create-prefill-time-mismatch.jpg
docs/audits/2026-05-11-ios-stage13-affiche-publish-preview-time-mismatch.jpg
```

Backend evidence:

```text
id: cmowwapbe00dfp50j2ieqmuzw
title: показ фильма «Собачье сердце»
startsAt: 2026-05-11T12:00:00.000Z
timeLabel: 15:00
city: Москва
```

Impact:

- A meetup created from Affiche can be published at the wrong visible time.
- This is likely device timezone leakage, because the simulator timezone is Asia Ho Chi Minh.

### IOS-QA-017: Home header date is stale after returning from evening flow

Severity: medium.

Account:

```text
+72222222222
```

Screen:

```text
/tonight
```

Expected:

- On 2026-05-11, the Home date label should match the current app date.
- After completing evening feedback and returning to Home, the date should not show an older day.

Actual:

- After Guest C saved Stage 14 final feedback, app returned to Home.
- Home showed `Среда · 06 мая`.
- The QA run date is 2026-05-11.

Evidence:

```text
docs/audits/2026-05-11-ios-stage14-home-date-mismatch.jpg
```

Follow-up evidence from Stage 25:

```text
Home before relogin: Среда · 06 мая.
Home after stop and launch: Среда · 06 мая.
Home after logout and Guest C relogin: Среда · 06 мая.
screenshots:
docs/audits/2026-05-11-ios-stage25-home-stale-date-before-relogin.jpg
docs/audits/2026-05-11-ios-stage25-home-stale-date-after-relaunch.jpg
docs/audits/2026-05-11-ios-stage25-home-stale-date-after-relogin.jpg
```

Follow-up evidence from Stage 40:

```text
On 2026-05-12 after stop_app_sim and launch_app_sim, Home opened with Среда · 06 мая.
Runtime log only showed the known Yandex MapKit invalid API key errors.
screenshot:
docs/audits/2026-05-12-ios-stage40-home-after-cold-relaunch-stale-date.jpg
```

Impact:

- Home can show stale date context after returning from another flow.
- This can confuse users about whether nearby cards are for today.
- Stage 25 shows the stale date survives a fresh login session for Guest C.

Fixed candidate 2026-05-12:

- Replaced the hardcoded Home date label with `DateTime.now()` based Russian weekday and month formatting.
- Added a deterministic test for `DateTime(2026, 5, 12)` expecting `Вторник · 12 мая`.
- Verification: `cd mobile && flutter test test/features/parity/tonight_screen_test.dart` passed.
- Real-data verification: XcodeBuildMCP `build_run_sim` launched `com.sergeypolyakov.frendly.dev` on iPhone 17 Pro, Home showed `Вторник · 12 мая`.

### IOS-QA-018: Chat photo attachment shows broken placeholder after reopening chat

Severity: medium.

Account:

```text
+72222222222: Guest C
```

Screen:

```text
Meetup chat cmp10vn8m005npe1z534n9mm6
```

Expected:

- A sent photo attachment should remain visible after leaving and reopening the chat.
- If the media URL is refreshed through `/media/:assetId` or `/download-url`, the image should render without a broken placeholder.

Actual:

- Selected a simulator Photos image through the chat attachment sheet.
- The image appeared in chat immediately after upload.
- Backend returned a ready private `image/jpeg` media asset.
- After leaving the chat and opening it again, the same message showed a broken image placeholder.
- Direct authenticated media download worked outside the app.

Evidence:

```text
messageId: cmp178xfw000rpg1znkcva3n2
mediaAssetId: cmp178x8400chpe1zj43nrv1v
mimeType: image/jpeg
byteSize: 26370
status: ready
url: /media/cmp178x8400chpe1zj43nrv1v
downloadUrlPath: /media/cmp178x8400chpe1zj43nrv1v/download-url
direct media GET: 307 redirect to signed S3 URL
download-url endpoint: 200 with signed image URL
curl -L media download: 200 image/jpeg 26370
screenshots:
docs/audits/2026-05-11-ios-stage8-6-photo-attachment-sent.jpg
docs/audits/2026-05-11-ios-stage8-6-photo-attachment-reopen-broken.jpg
```

Follow-up evidence from Stage 20:

```text
chatId: cmp1660vn00bzpe1z80cwy523
messageId: cmp1bc5qv000vpg1zj7n04gcx
mediaAssetId: cmp1bc5jx00cnpe1zu4ng7bu9
mimeType: image/jpeg
byteSize: 881799
status: ready
curl -L media download: 200 image/jpeg 881799
screenshots:
docs/audits/2026-05-11-ios-stage20-other-chat-photo-sent.jpg
docs/audits/2026-05-11-ios-stage20-other-chat-photo-reopen-broken.jpg
```

Follow-up evidence from Stage 26:

```text
chatId: cmp13baks00aepe1zvvuegmnl
messageId: cmp1cvsrd0012pg1zqen6ff50
mediaAssetId: cmp1cvsi300cvpe1zllh3qhlm
mimeType: image/jpeg
byteSize: 26370
status: ready
curl -L media download: 200 image/jpeg 26370
The photo appeared immediately after sending in direct chat.
After leaving and reopening the direct chat, the attachment area no longer exposed an image, only the timestamp 22:27.
After cold relaunch and reopening the direct chat, the same broken state remained.
screenshots:
docs/audits/2026-05-11-ios-stage26-direct-chat-photo-sent.jpg
docs/audits/2026-05-11-ios-stage26-direct-chat-photo-reopen-broken.jpg
docs/audits/2026-05-11-ios-stage26-direct-chat-photo-cold-relaunch-broken.jpg
```

Impact:

- Users can send a photo and see it once, but the chat history can show the media as broken on revisit.
- Since backend media download works, the risk is likely in the iOS reload/render path or how private media URLs are reused.
- Stage 20 confirms the issue is not limited to one asset or one meetup chat.
- Stage 26 confirms the issue also affects personal direct chats.

### IOS-QA-019: Chats list row can stay stale after realtime message in another meetup chat

Severity: medium.

Account:

```text
+72222222222: Guest C
```

Screen:

```text
Chats tab
```

Expected:

- When another member sends a message to a meetup chat, the row preview and unread badge update.
- Backend unread and iOS row state stay aligned.

Actual:

- Guest C was in another meetup chat.
- Host E sent a fresh message to `cmp10vn8m005npe1z534n9mm6` through the production WebSocket.
- Backend `/chats/meetups` for Guest C moved from unread `4` to unread `5`.
- Backend latest message changed to `QA unread fresh 2026-05-11T14:51:19.598Z`.
- iOS Chats row still showed the previous photo filename and unread `4`.

Evidence:

```text
messageId: cmp1bkzfs000zpg1zfh06sznl
chatId: cmp10vn8m005npe1z534n9mm6
backend unread after send: 5
iOS row unread after send: 4
screenshot:
docs/audits/2026-05-11-ios-stage21-unread-list-stale-after-ws-message.jpg
```

Follow-up evidence from Stage 22:

```text
Returning from the chat to Chats did not refresh the row.
Cold relaunch did refresh the row to backend latest message and unread 5.
screenshots:
docs/audits/2026-05-11-ios-stage22-chat-list-return-still-stale.jpg
docs/audits/2026-05-11-ios-stage22-chat-list-cold-relaunch-updated.jpg
```

Impact:

- Users can miss new messages while already inside the Chats surface.
- The row preview and unread badge can disagree with backend state.
- Relaunch recovers the row, so this looks runtime state or realtime sync related.

Follow-up evidence from Stage 28:

```text
The same stale latest preview pattern reproduced in a personal direct chat.
Backend latest message changed to 20260511 personal unread 1538 host and unread became 1.
Open iOS Chats list showed unread badge 1, but row preview still showed the old photo filename.
Cold relaunch refreshed the row preview to the backend latest text.
screenshot:
docs/audits/2026-05-11-ios-stage28-personal-unread-row-stale.jpg
docs/audits/2026-05-11-ios-stage28-personal-unread-cold-relaunch-row-fresh-unread.jpg
```

Fixed candidate 2026-05-12:

- App-level realtime now patches meetup and personal row preview from `message.created` and preserves fresh unread state from `unread.updated`.
- Verification: XcodeBuildMCP showed the meetup row update to `QA realtime unread 2026-05-12T04:15:30Z` without relaunch. Direct row updated to `444444` after send and return to Chats.

### IOS-QA-020: Personal direct chat opening visible latest message does not clear unread

Severity: medium.

Account:

```text
+71111111111: Guest B
```

Screen:

```text
Personal direct chat cmp13baks00aepe1zvvuegmnl
```

Expected:

- Opening a personal chat with an unread message clears unread after the latest message is visible.
- Backend unread and iOS chat badge return to `0`.

Actual:

- Host A sent `20260511 personal unread 1538 host` through production WebSocket.
- Backend row for Guest B became latest message `20260511 personal unread 1538 host` and unread `1`.
- Guest B opened the direct chat from Chats.
- The latest unread message was visible in the thread at `22:38`.
- Backend unread stayed `1` after opening and after an extra 5 second wait.
- Returning to Chats still showed badge `1`.
- Cold relaunch kept badge `1`, matching backend.

Evidence:

```text
chatId: cmp13baks00aepe1zvvuegmnl
messageId: cmp1da0yt0016pg1z1zje2u1r
clientMessageId: qa-personal-unread-1778513934490
backend unread after send: 1
backend unread after opening visible latest message: 1
runtime log:
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T15-40-28-982Z_helperpid40855_ownerpid26902_8e7068fb.log
screenshots:
docs/audits/2026-05-11-ios-stage28-personal-unread-baseline.jpg
docs/audits/2026-05-11-ios-stage28-personal-unread-row-stale.jpg
docs/audits/2026-05-11-ios-stage28-personal-unread-opened-latest.jpg
docs/audits/2026-05-11-ios-stage28-personal-unread-after-open-still-badge.jpg
docs/audits/2026-05-11-ios-stage28-personal-unread-cold-relaunch-row-fresh-unread.jpg
```

Follow-up evidence from Stage 29:

```text
After cold relaunch, the direct row showed fresh latest text 20260511 personal unread 1538 host and unread 1.
Opening the direct chat from this fresh row showed the same latest message.
Backend unread stayed 1 after opening and after an extra 5 second wait.
Returning to Chats still showed row badge 1 and bottom tab badge 1.
screenshots:
docs/audits/2026-05-11-ios-stage29-personal-unread-fresh-row-baseline.jpg
docs/audits/2026-05-11-ios-stage29-personal-unread-fresh-row-opened.jpg
docs/audits/2026-05-11-ios-stage29-personal-unread-fresh-row-after-open-still-badge.jpg
```

Control evidence from Stage 30:

```text
REST POST /chats/cmp13baks00aepe1zvvuegmnl/read with messageId cmp1da0yt0016pg1z1zje2u1r returned 201 ok true.
Backend unread changed from 1 to 0.
Active iOS Chats list still showed row badge 1 and bottom tab badge 1 after the backend read.
Cold relaunch refreshed the list and removed the direct unread badges.
screenshots:
docs/audits/2026-05-11-ios-stage30-direct-backend-read-baseline.jpg
docs/audits/2026-05-11-ios-stage30-direct-backend-read-ui-still-stale.jpg
docs/audits/2026-05-11-ios-stage30-direct-backend-read-cold-relaunch-cleared.jpg
```

Log note:

```text
No explicit chat, unread, WebSocket, Dio or exception error was visible in the checked launch log.
Only the already known Yandex MapKit host errors appeared.
```

Impact:

- A user can open and see the newest personal message, but the unread count stays active.
- This can keep bottom tab and chat row badges stale.
- It is broader than IOS-QA-011 because the latest direct message was visible.

Fixed candidate 2026-05-12:

- Chat thread now marks the latest known unread summary message id, or the latest loaded incoming message when summary id is unavailable.
- Verification: `flutter test test/features/chats/presentation/` passed, including the stale history unread case. XcodeBuildMCP direct chat send and open flow kept backend unread at `0` and row preview updated to `444444`.

### IOS-QA-021: Direct chat file picker can return without sending selected txt and zip files

Severity: medium.

Account:

```text
+71111111111: Guest B
```

Screen:

```text
Personal direct chat cmp13baks00aepe1zvvuegmnl
```

Expected:

- Selecting a valid `text/plain` file sends a file attachment.
- Selecting a valid `application/zip` file sends a file attachment.
- If the file cannot be sent, the user sees a visible error.

Actual:

- The native file picker initially had no recent files.
- A small `frendly-stage32-file.txt` was placed into the simulator local Files storage for QA.
- The picker showed it under `На iPhone`.
- Tapping the file returned to the chat.
- No new message appeared.
- Backend latest messages did not include a new file message from this picker action.
- No visible error appeared.
- The same silent picker return also reproduced with `frendly-stage35-file.zip`.

Evidence:

```text
fileName: frendly-stage32-file.txt
mimeType: text/plain
byteSize: 69
screenshots:
docs/audits/2026-05-11-ios-stage32-direct-file-picker-return-no-file.jpg
docs/audits/2026-05-11-ios-stage35-direct-zip-picker-visible.jpg
docs/audits/2026-05-11-ios-stage35-direct-zip-picker-return-no-file.jpg
```

Backend control:

```text
The same file was uploaded through POST /uploads/chat-attachment/file and sent through production WebSocket message.send.
uploadStatus: 201
messageId: cmp1e9w580019pg1zk0o9otbs
mediaAssetId: cmp1e9utq00d3pe1z8872cxbq
mimeType: text/plain
byteSize: 69
status: ready
url: /media/cmp1e9utq00d3pe1z8872cxbq
GET /media/cmp1e9utq00d3pe1z8872cxbq returned 200 text/plain 69 bytes.
```

Control UI:

```text
Active chat did not show the backend-seeded file immediately.
After reopening the direct chat, the file was visible with Скачать на телефон.
After cold relaunch, Chats list preview showed frendly-stage32-file.txt.
Opening the row again showed the same file attachment.
screenshots:
docs/audits/2026-05-11-ios-stage32-direct-file-backend-sent-active-ui-stale.jpg
docs/audits/2026-05-11-ios-stage32-direct-file-reopen-visible.jpg
docs/audits/2026-05-11-ios-stage32-direct-file-download-tap-no-visible-change.jpg
docs/audits/2026-05-11-ios-stage32-direct-file-cold-relaunch-chat-list-preview.jpg
docs/audits/2026-05-11-ios-stage32-direct-file-cold-relaunch-visible.jpg
```

Follow-up from Stage 33:

```text
The same picker path worked for frendly-stage33-file.pdf.
The PDF message appeared immediately in the active chat.
Backend stored it as ready application/pdf, 386 bytes.
GET /media/cmp1eih6y00d5pe1zoyx2f1wp returned 200 application/pdf 386 bytes.
This narrows IOS-QA-021 to at least text/plain file picker handling, not all generic file attachments.
screenshots:
docs/audits/2026-05-11-ios-stage33-direct-pdf-picker-sent.jpg
docs/audits/2026-05-11-ios-stage33-direct-pdf-cold-relaunch-visible.jpg
```

Follow-up from Stage 35:

```text
The same silent picker failure reproduced for frendly-stage35-file.zip.
Picker showed the ZIP under На iPhone.
Selecting it returned to chat without a new message or visible error.
Backend latest messages still ended at frendly-stage33-file.pdf after the picker action.
Backend control upload and WebSocket send created ready application/zip media.
After cold relaunch, Chats preview and direct thread rendered frendly-stage35-file.zip.
GET /media/cmp1eu9ur00d9pe1zm3fzk91d returned 200 application/zip 238 bytes.
screenshots:
docs/audits/2026-05-11-ios-stage35-direct-zip-picker-visible.jpg
docs/audits/2026-05-11-ios-stage35-direct-zip-picker-return-no-file.jpg
docs/audits/2026-05-11-ios-stage35-direct-zip-cold-relaunch-chat-list-preview.jpg
docs/audits/2026-05-11-ios-stage35-direct-zip-cold-relaunch-visible.jpg
```

Impact:

- Users can select a generic file and think it was sent, while nothing appears in chat.
- Backend can store and serve txt and zip attachments, so the failing path is likely iOS picker or upload flow.

### IOS-QA-022: Direct chat file attachment download tap gives no visible result

Severity: medium.

Account:

```text
+71111111111: Guest B
```

Screen:

```text
Personal direct chat cmp13baks00aepe1zvvuegmnl
```

Expected:

- Tapping a file attachment download action shows progress, a saved state, open state, toast, share sheet or error.

Actual:

- Tapping the txt file attachment download area produced no visible change.
- Tapping the PDF file attachment download area produced no visible change.
- Tapping the body of the txt file attachment produced no visible change.
- Tapping the body of the PDF file attachment produced no visible change.
- Both attachments still showed `Скачать на телефон`.
- Backend media endpoints returned 200 for both files.

Evidence:

```text
txt mediaAssetId: cmp1e9utq00d3pe1z8872cxbq
txt mimeType: text/plain
txt byteSize: 69
pdf mediaAssetId: cmp1eih6y00d5pe1zoyx2f1wp
pdf mimeType: application/pdf
pdf byteSize: 386
screenshots:
docs/audits/2026-05-11-ios-stage32-direct-file-download-tap-no-visible-change.jpg
docs/audits/2026-05-11-ios-stage33-direct-pdf-download-tap-no-visible-change.jpg
docs/audits/2026-05-11-ios-stage34-direct-file-card-tap-no-visible-change.jpg
runtime log:
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T16-14-24-361Z_helperpid92584_ownerpid26902_1073dc03.log
log note:
No related download, file open, media, Dio or exception line was visible around the taps.
Only the already known Yandex MapKit host errors appeared.
```

Impact:

- Users may not know whether a file was saved, opened or failed.
- This affects generic file attachments even when the backend media is ready and downloadable.

### IOS-QA-023: Dating discover can show Plus gate while backend has eligible cards

Severity: medium.

Account:

```text
+72222222222: Guest C
```

Screen:

```text
/dating
```

Expected:

- Dating discover shows available cards when `/dating/discover` returns items.
- Incoming likes can remain Frendly+ locked for non Plus users.

Actual:

- `/dating/discover?limit=10` returned one eligible card, `Пользователь 1111`.
- `/dating/likes?limit=5` returned `403 frendly_plus_required`, which matches the locked likes expectation.
- The iOS Dating screen showed a Frendly+ gate instead of the discover card.
- Opening through deep link, bottom navigation and after cold relaunch all showed the same gate.
- Stage 39 showed that after backend trial activation the same screen unlocks discover, so the gate is tied to the non Plus state.

Evidence:

```text
viewer: user-91891ec2-a270-4ff3-b28d-63a5eda246fc
GET /dating/discover?limit=10: 200, 1 item
first card: user-304f0edb-76db-439c-ae10-5b9a52f76da6, Пользователь 1111
GET /dating/likes?limit=5: 403 frendly_plus_required
screenshots:
docs/audits/2026-05-11-ios-stage38-guest-c-dating-plus-gate-despite-discover.jpg
docs/audits/2026-05-11-ios-stage38-guest-c-dating-plus-gate-bottom-nav.jpg
docs/audits/2026-05-11-ios-stage38-guest-c-dating-plus-gate-cold-relaunch.jpg
stage39 trial state: plan year, status trial, trialEndsAt 2026-05-18T16:55:46.135Z
stage39 post-trial discover: 200, 1 item, Пользователь 1111
stage39 post-trial likes: 200, 0 items
docs/audits/2026-05-11-ios-stage39-dating-unlocked-after-trial-action-row-covered.jpg
```

Impact:

- Non Plus users may be blocked from the whole dating discover flow even when backend has discover cards.
- This conflicts with the earlier Stage 11 Guest B behavior where discover worked and only incoming likes were locked.

### IOS-QA-024: Dating filter controls have weak accessibility semantics

Severity: low.

Account:

```text
+72222222222: Guest C
```

Screen:

```text
/dating
```

Expected:

- Icon-only filter and close buttons have clear accessibility labels.
- Filter chips expose button roles and selected state.

Actual:

- The Dating header filter control opened the sheet, but its accessibility label was null.
- The sheet close control also had a null label.
- Filter chips such as `#кино` were exposed as `StaticText`, not buttons.
- After tapping `#кино`, the UI hierarchy did not expose selected state.

Evidence:

```text
filter button frame: {{338, 94}, {44, 44}}, AXLabel null
sheet close button frame: {{326, 214.5}, {36, 36}}, AXLabel null
#кино role: StaticText
screenshots:
docs/audits/2026-05-12-ios-stage41-dating-filter-sheet-open.jpg
docs/audits/2026-05-12-ios-stage41-dating-filter-kinotap-no-visible-state.jpg
docs/audits/2026-05-12-ios-stage41-dating-filter-reopen-after-kino.jpg
```

Impact:

- Screen reader and automation users cannot clearly identify filter controls or selected filter state.

### IOS-QA-025: Direct chat opened from dating profile shows generic title instead of peer name

Severity: medium.

Account:

```text
+72222222222: Guest C
```

Screen:

```text
/user/user-304f0edb-76db-439c-ae10-5b9a52f76da6
direct chat cmp1gufto00djpe1zda834izn
```

Expected:

- Tapping `Написать` on `Пользователь 1111` opens a direct chat whose header identifies `Пользователь 1111`.
- Backend personal chat row and UI title match.

Actual:

- The public profile showed `Пользователь 1111`, matching backend.
- Tapping `Написать` opened a direct chat.
- Backend `/chats/personal` returned the new chat with `name: Пользователь 1111`.
- UI header showed `Личный чат` instead of the peer name.

Evidence:

```text
peerUserId: user-304f0edb-76db-439c-ae10-5b9a52f76da6
chatId: cmp1gufto00djpe1zda834izn
backend name: Пользователь 1111
UI header: Личный чат
screenshots:
docs/audits/2026-05-12-ios-stage42-dating-profile-user1111-opened.jpg
docs/audits/2026-05-12-ios-stage42-dating-profile-write-opened-direct-chat.jpg
docs/audits/2026-05-12-ios-stage43-direct-chat-generic-header-baseline.jpg
docs/audits/2026-05-12-ios-stage43-direct-chat-opened-from-personal-filter-peer-header.jpg
```

Impact:

- Users can lose context after opening a new direct chat from a profile.
- This is inconsistent with earlier direct chat headers that showed the peer name.
- Opening the same chat from the Personal filter after cold relaunch showed `Пользователь 1111`, so the bug is tied to the profile-created entry state.

Fixed candidate 2026-05-12:

- Profile `Написать` now stores a temporary known personal chat summary with peer id and display name before opening the direct chat.
- `PersonalChatScreen` uses the known summary until the backend personal chat provider returns the row.
- Verification: `cd mobile && flutter test test/features/parity/detail_chat_and_user_profile_screen_test.dart --name "opening direct chat from profile keeps peer title"` passed.
- Real-data verification: XcodeBuildMCP opened `frendly:///user/user-304f0edb-76db-439c-ae10-5b9a52f76da6`, tapping `Написать` opened direct chat header `Пользователь 1111`.

### IOS-QA-026: Personal chat filter can show empty state while backend has a personal chat

Severity: medium.

Account:

```text
+72222222222: Guest C
```

Screen:

```text
/chats
Personal filter
direct chat cmp1gufto00djpe1zda834izn
```

Expected:

- When backend `/chats/personal` returns a personal chat, the Personal filter shows that row.
- Empty-state copy is hidden when at least one row exists.

Actual:

- Before cold relaunch, the Personal filter showed only `Личные чаты появляются после встреч.`
- Backend `/chats/personal` returned one row for `cmp1gufto00djpe1zda834izn`, named `Пользователь 1111`.
- After cold relaunch, the row appeared, but the UI hierarchy still combined `Пользователь 1111` with `Личные чаты появляются после встреч.`
- Opening the row from the Personal filter opened the correct peer header `Пользователь 1111`.

Evidence:

```text
backend count: 1
chatId: cmp1gufto00djpe1zda834izn
backend name: Пользователь 1111
message count: 0
before cold relaunch UI: Личные чаты появляются после встреч.
after cold relaunch UI: П1, Пользователь 1111, Личные чаты появляются после встреч.
screenshots:
docs/audits/2026-05-12-ios-stage43-chats-personal-filter-empty-despite-backend-row.jpg
docs/audits/2026-05-12-ios-stage43-chats-personal-filter-after-cold-relaunch-row-with-empty-hint.jpg
docs/audits/2026-05-12-ios-stage43-direct-chat-opened-from-personal-filter-peer-header.jpg
```

Impact:

- Users may think no personal chats exist after creating a direct chat from a profile.
- After relaunch, the row is visible, but the mixed empty hint makes the list state unclear.

Fixed candidate 2026-05-12:

- Chats merges known newly created personal chat summaries into the visible personal chat list for the current session.
- Personal chat list now renders empty-state copy only when the list is empty.
- Verification: `cd mobile && flutter test test/features/parity/people_and_chats_screen_test.dart --name "personal tab with one chat hides empty hint"` passed.
- Real-data verification: XcodeBuildMCP opened Chats, tapped `Личные`, and showed `Пользователь 1111` with no `Личные чаты появляются после встреч.` empty hint.

### IOS-QA-027: Direct chat date invite send returns to draft without visible result

Severity: medium.

Account:

```text
+72222222222: Guest C
```

Screen:

```text
direct chat cmp1gufto00djpe1zda834izn
Create meetup date invite draft
```

Expected:

- Tapping `Позвать на свидание` opens a usable date invite flow.
- Tapping `Отправить инвайт` either creates the invite or shows a visible validation error.

Actual:

- The direct chat card opened a prefilled `Свидание` draft.
- The draft showed title `Свидание на двоих`, place `Tilda Bistro`, time `Сегодня · 02:34`, capacity 2 and CTA `Отправить инвайт`.
- Tapping `Отправить инвайт` removed the CTA briefly, then the same CTA returned.
- No visible success, validation error, toast or navigation was shown.
- Repeating the tap produced the same result.
- Backend still showed zero messages in the direct chat.
- Guest C host dashboard still had no upcoming events and no drafts.

Evidence:

```text
chatId: cmp1gufto00djpe1zda834izn
backend direct messages before: 0
backend direct messages after: 0
host dashboard upcoming: 0
host dashboard drafts: 0
screenshots:
docs/audits/2026-05-12-ios-stage44-direct-chat-date-invite-baseline.jpg
docs/audits/2026-05-12-ios-stage44-date-invite-create-prefill.jpg
docs/audits/2026-05-12-ios-stage44-date-invite-after-send-stuck-draft.jpg
```

Runtime notes:

```text
The active XcodeBuildMCP log only showed the known repeated MapKit host processing error.
No clear invite specific runtime error was visible.
```

Impact:

- A user can try to invite a direct chat peer to a date and receive no explanation when nothing is created.
- This blocks the empty-chat conversion path from direct chat to real meetup.

Fixed candidate 2026-05-12:

- Mobile dating invite submit now sends a fallback description when the user leaves the description field empty.
- Test passed: `cd mobile && flutter test test/features/create_meetup/presentation/create_meetup_screen_test.dart --name "date invite uses fallback description"`.
- Real-data verification: XcodeBuildMCP on iPhone 17 Pro iOS 26.4 `A195A8F2-DCEB-4B12-9377-8F1D6294F072` opened `frendly:///create?mode=dating&inviteeUserId=user-304f0edb-76db-439c-ae10-5b9a52f76da6`, tapped `Отправить инвайт` with an empty description, and the app navigated to the created event detail `Свидание на двоих`.

### IOS-QA-028: Date invite description field is partly covered by fixed CTA and does not accept focus

Severity: medium.

Account:

```text
+72222222222: Guest C
```

Screen:

```text
Create meetup
mode Свидание
direct chat date invite draft
```

Expected:

- After a failed invite send, the user can scroll to description, focus the field and add missing text.
- The fixed bottom CTA does not cover the editable field.

Actual:

- The description field was only partially visible at the bottom of the viewport.
- The fixed `Отправить инвайт` CTA covered the same vertical area.
- Tapping the description field by accessibility label returned success from the UI tool, but the field did not receive text.
- `type_text` with Cyrillic failed because no keycode existed for the Cyrillic character.
- `type_text` with ASCII returned success, but the field value stayed empty.
- No keyboard or visible focus state appeared.

Evidence:

```text
description AXValue before: empty
description AXValue after ASCII type_text: empty
screenshot:
docs/audits/2026-05-12-ios-stage45-date-invite-description-covered-by-cta.jpg
```

Fixed candidate 2026-05-12:

- Mobile moved the fixed invite CTA out of the Stack overlay and added larger bottom reserve for lower fields.
- Test passed: `cd mobile && flutter test test/features/create_meetup/presentation/create_meetup_screen_test.dart --name "create meetup (keeps bottom fields above fixed CTA|sends request join mode for invite visibility)"`.
- XcodeBuildMCP proof on iPhone 17 Pro iOS 26.4 `A195A8F2-DCEB-4B12-9377-8F1D6294F072`: opened `frendly:///create?mode=dating&inviteeUserId=user-304f0edb-76db-439c-ae10-5b9a52f76da6`, scrolled to `Описание`, tapped the field and `type_text` inserted `abc` through the active Russian keyboard layout as `фис`.

Impact:

- Users cannot easily recover from IOS-QA-027 by filling a possibly required field.
- The fixed CTA blocks interaction with a lower form field in the date invite draft.

### IOS-QA-029: Direct chat text can stay local until cold relaunch

Severity: medium.

Account:

```text
+72222222222: Guest C
```

Screen:

```text
direct chat cmp1gufto00djpe1zda834izn
```

Expected:

- Sending a text message from the direct chat composer persists it in backend.
- Chat list row shows the latest message.
- Reopening the chat still shows the sent message.

Actual:

- Backend messages were count 0 before send.
- Typing `stage47 direct text` entered `ыефпу47 вкусе еуче` due to the known simulator keyboard mapping issue.
- After tapping send, the UI showed a local bubble `ыефпу47 вкусе куче` with timestamp `00:47`.
- Backend `/chats/:chatId/messages` stayed count 0 after a wait.
- Backend `/chats/personal` still returned empty `lastMessage` and `lastTime`.
- Returning to Chats showed the direct row without the sent text.
- Reopening the same row showed an empty thread again.
- After cold relaunch on 2026-05-12, the same local message appeared in the chat row and thread.
- Backend then showed the message persisted as `cmp1i3nee001ppg1ziszjgldr`, created at `2026-05-11T17:53:58.070Z`.
- A fresh follow-up message in the same relaunched session persisted immediately.

Evidence:

```text
chatId: cmp1gufto00djpe1zda834izn
backend messages before: 0
backend messages after send and wait: 0
backend personal lastMessage after send: empty
backend messages after cold relaunch: 1
backend first persisted message id: cmp1i3nee001ppg1ziszjgldr
backend messages after stage48 retry send: 2
backend latest message id: cmp1i4xfg001spg1zdyw0lgzp
screenshots:
docs/audits/2026-05-12-ios-stage47-direct-chat-text-baseline.jpg
docs/audits/2026-05-12-ios-stage47-direct-chat-text-keyboard-mapped.jpg
docs/audits/2026-05-12-ios-stage47-direct-chat-text-sent.jpg
docs/audits/2026-05-12-ios-stage47-chats-row-not-updated-after-text.jpg
docs/audits/2026-05-12-ios-stage47-direct-chat-reopen-message-gone.jpg
docs/audits/2026-05-12-ios-stage48-chats-after-cold-relaunch-stale-local-text.jpg
docs/audits/2026-05-12-ios-stage48-direct-chat-after-cold-relaunch-stale-local-text.jpg
docs/audits/2026-05-12-ios-stage48-direct-chat-retry-text-keyboard-mapped.jpg
docs/audits/2026-05-12-ios-stage48-direct-chat-retry-text-sent.jpg
docs/audits/2026-05-12-ios-stage48-chats-row-after-retry-text-persisted.jpg
```

Runtime notes:

```text
Runtime log only showed the known repeated MapKit host processing error.
No clear direct-message send error was visible.
```

Impact:

- The sender can believe a direct message was sent while backend still has no record.
- The message can disappear after reopening, then reappear and persist only after app restart.
- Delivery state is misleading while the local queue is pending.

Fixed candidate 2026-05-12:

- `ChatSocketClient.sendMessage` now persists and flushes the outgoing command during the same session after connect and clears it on the matching realtime echo.
- Verification: `flutter test test/app/core/network/chat_socket_client_test.dart` passed. XcodeBuildMCP direct chat sent `444444`, the bubble appeared immediately, backend `/chats/personal` returned latest message `444444` without relaunch.

### IOS-QA-030: Direct chat incoming message profile action does not open profile

Severity: low.

Account:

```text
+72222222222: Guest C
```

Screen:

```text
direct chat cmp1gufto00djpe1zda834izn
incoming message from Пользователь 1111
```

Expected:

- Tapping the message accessibility button `Открыть профиль Пользователь 1111` opens that user's public profile.

Actual:

- XcodeBuildMCP snapshot exposed the incoming message as a `Button` with label `Открыть профиль Пользователь 1111`.
- Tapping that label returned success, but the app stayed on the direct chat.
- Tapping the avatar area of the same incoming bubble also left the app on the direct chat.
- Opening `frendly:///user/user-304f0edb-76db-439c-ae10-5b9a52f76da6` did open the correct public profile.

Evidence:

```text
message label:
Открыть профиль Пользователь 1111
П1
Пользователь 1111
stage50 incoming unread
01:03

screenshots:
docs/audits/2026-05-12-ios-stage50-direct-chat-incoming-visible.jpg
docs/audits/2026-05-12-ios-stage51-public-profile-peer-deeplink.jpg
```

Impact:

- The UI advertises a profile-opening action on incoming direct messages, but the action does not navigate.
- Users can still reach the profile through other entry points.

Fixed candidate 2026-05-12:

- Made incoming chat author names tappable when `authorId` and author profile handler are present.
- Added a widget test that taps the incoming direct message author action and verifies navigation to `/user/user-304f0edb-76db-439c-ae10-5b9a52f76da6`.
- Verification: `cd mobile && flutter test test/features/parity/detail_chat_and_user_profile_screen_test.dart --name "incoming direct message author action opens public profile"` passed.
- Real-data verification: XcodeBuildMCP opened direct chat `cmp1gufto00djpe1zda834izn`; tapping `Открыть профиль Пользователь 1111` opened the public profile for `Пользователь 1111`.

## Stage 18: Final Report

### Step 18.1: Coverage Summary

Result:

```text
Simulator: iPhone 17 Pro, iOS 26.4, A195A8F2-DCEB-4B12-9377-8F1D6294F072
Build: Debug, bundle id com.sergeypolyakov.frendly.dev
Backend: https://api.frendly.tech
Main API health: ok
Chat health: ok
Worker health: ok
Outbox: done=165, no pending or failed rows in grouped check
```

Accounts used:

```text
+70000000000 Host A
+71111111111 Guest B
+72222222222 Guest C
+73333333333 Guest D
+74444444444 Host E
+75555555555 Dating F
Extra seeded range accounts were used for capacity fill.
```

Completed:

```text
Stage 0 environment
Stage 1 build and launch
Stage 2 login and session replacement
Stage 3 onboarding and permissions
Stage 4 home, discovery and city state
Stage 5 public meetup join, leave and rejoin
Stage 6 private meetup requests, host approval and capacity
Stage 7 host edit pass with blocking save bug
Stage 8 meetup chat, realtime, text, voice, location and photo attachment
Stage 9 notifications and unread behavior
Stage 10 profiles, social actions and direct chat
Stage 11 dating on Guest B, Dating F blocked by setup
Stage 12 communities
Stage 13 Affiche create prefill
Stage 14 evening flow
Stage 15 negative and recovery cases
Stage 16 backend checks on vps1
Stage 17 cleanup scope
```

Skipped or limited:

```text
Dating F full dating pass: blocked by onboarding email step and IOS-QA-008.
Real SMS: out of scope.
Real payments: out of scope.
Physical push delivery: out of scope.
Cleanup deletes: not performed because repro data must stay or deletion policy was not approved.
```

### Step 18.2: Defects By Severity

High:

```text
IOS-QA-001 Test shortcut range is inconsistent between backend and client.
IOS-QA-002 Onboarding local state can leak between switched accounts.
IOS-QA-007 Create meetup time changes after publish.
IOS-QA-010 Host event edit save does not persist changes.
IOS-QA-012 Public profile header and body can show different users.
```

Medium:

```text
IOS-QA-003 Onboarding geolocation can get stuck with invalid MapKit key.
IOS-QA-004 Manual city and Home header location are inconsistent.
IOS-QA-005 Radar map opens but native map is visually blank.
IOS-QA-006 Own profile exposes self social actions.
IOS-QA-008 ASCII text input is keyboard-mapped through Russian layout in simulator.
IOS-QA-009 Create meetup visibility choice is partly blocked by fixed CTA.
IOS-QA-011 Opening meetup chat does not clear unread when latest message is offscreen.
IOS-QA-013 Direct chat composer can trigger voice recording while text is present.
IOS-QA-014 Dating action row is covered by bottom navigation.
IOS-QA-015 Community chat can open before membership.
IOS-QA-016 Affiche create prefill shifts event time to device timezone.
IOS-QA-017 Home header date is stale after returning from evening flow.
IOS-QA-018 Chat photo attachment shows broken placeholder after reopening chat.
IOS-QA-019 Chats list row can stay stale after realtime message in another meetup chat.
IOS-QA-020 Personal direct chat opening visible latest message does not clear unread.
IOS-QA-021 Direct chat file picker can return without sending selected txt and zip files.
IOS-QA-022 Direct chat file attachment download tap gives no visible result.
IOS-QA-023 Dating discover can show Plus gate while backend has eligible cards.
IOS-QA-025 Direct chat opened from dating profile shows generic title instead of peer name.
IOS-QA-026 Personal chat filter can show empty state while backend has a personal chat.
IOS-QA-027 Direct chat date invite send returns to draft without visible result.
IOS-QA-028 Date invite description field is partly covered by fixed CTA and does not accept focus.
IOS-QA-029 Direct chat text can stay local until cold relaunch.
IOS-QA-OBS-001 Yandex MapKit starts with invalid API key.
```

Low:

```text
IOS-QA-024 Dating filter controls have weak accessibility semantics.
IOS-QA-030 Direct chat incoming message profile action does not open profile.
IOS-QA-OBS-002 Test phone shortcut flag is unset locally.
```

### Step 18.3: Defect Reproduction References

Result:

- Every `IOS-QA-*` item above has its own section in `## Observations`.
- Each section includes account, screen, steps, expected behavior, actual behavior, evidence and backend clues where available.
- Newest evidence added in this continuation:

```text
IOS-QA-008: Dating F email setup blocked by Russian-layout mapped email input.
IOS-QA-018: Chat photo media is ready in backend and downloadable, but iOS shows broken placeholder after reopening chat.
IOS-QA-019: Chats list row stayed stale after a fresh realtime message while backend unread increased.
IOS-QA-020: Personal direct chat showed the latest unread message, but backend unread stayed 1.
IOS-QA-020 follow-up: After cold relaunch and fresh row, opening the same visible latest message still left unread at 1.
IOS-QA-020 control: Direct REST mark-read cleared backend unread to 0, active iOS list stayed stale until cold relaunch.
IOS-QA-021: Direct chat file picker selected a txt file from On My iPhone, then returned to chat without a new message or visible error.
IOS-QA-021 follow-up: PDF file picker send worked in the same chat, but ZIP reproduced the same silent failure as TXT.
IOS-QA-022: Tapping download on txt and PDF file attachments left the visible state unchanged.
IOS-QA-023: Guest C backend discover returned one dating card, but iOS showed the Frendly+ dating gate through deep link, bottom nav and cold relaunch.
IOS-QA-024: Dating filter icon buttons had null labels, and filter chips were exposed as StaticText without selected state in the UI hierarchy.
IOS-QA-025: Direct chat opened from Пользователь 1111 profile, backend personal row name was Пользователь 1111, but chat header showed Личный чат.
IOS-QA-026: Personal filter showed an empty state while backend /chats/personal had one row, then after cold relaunch showed the row together with the empty hint.
IOS-QA-027: Direct chat date invite draft accepted two Отправить инвайт taps with no visible result, while backend messages and host dashboard stayed empty.
IOS-QA-028: Date invite description field stayed partly covered by fixed CTA, and tap plus type_text did not put text into the field.
IOS-QA-017 follow-up: Cold relaunch after leaving the date invite draft opened Home with stale date Среда · 06 мая again.
IOS-QA-008 follow-up: Direct chat composer also mapped ASCII `stage47 direct text` through Russian layout.
IOS-QA-029: Direct chat showed an optimistic text bubble, but backend messages stayed count 0 and the bubble disappeared after reopening.
IOS-QA-029 follow-up: After cold relaunch, the same local text appeared in the row and thread, then backend persisted it from the local queue.
Voice control: Direct chat voice attachment persisted in backend, survived reopen and cold relaunch, and media downloaded as 126019 byte audio/x-m4a.
Unread control: Incoming direct message from Пользователь 1111 was visible in the active Guest C thread, backend personal unreadCount stayed null, and the Chats row showed the latest text.
IOS-QA-030: Incoming direct message exposed an `Открыть профиль Пользователь 1111` button, but tapping it did not navigate; deep link to the same user profile worked.
```

### Step 18.4: Backend Anomalies

Result:

```text
API health: ok.
Chat health: ok.
Worker health: ok.
Outbox grouped status: done=165, no pending or failed rows in the check.
API logs showed expected test-login and logout lines.
API logs showed 401 invalid_payload followed by single refresh rotation, no retry loop observed.
Host localhost health checks on vps1 ports 3000, 3001 and 3002 failed because those ports are not exposed on host loopback. Container-internal health checks passed.
Chat runtime logs were quiet during recent tail. DB confirmed message and unread state instead.
Worker runtime logs were quiet during recent tail. Outbox state did not show backlog.
Data mismatch evidence remains in UI and API behavior, mainly IOS-QA-007, IOS-QA-016, IOS-QA-018, IOS-QA-019, IOS-QA-020, IOS-QA-021, IOS-QA-022 and IOS-QA-023.
```

### Step 18.5: Confidence

Result:

```text
yellow
```

Reason:

- Core auth, create meetup, join, request approval, chat text, voice, location, photo upload, evening flow and backend health were exercised on real data.
- Product is usable for core happy paths.
- There are high severity blockers in edit persistence, profile consistency, onboarding state and create time handling.
- Secondary flows still have visible issues, including Dating F setup, photo reload, community chat access before membership and stale Home date.

### Completion Criteria Check

Result:

```text
Built and launched in Simulator: yes.
At least 5 accounts used: yes.
At least 2 meetings created: yes.
At least 1 public join tested: yes.
At least 1 private request approve flow tested: yes.
At least 1 private request reject flow tested: yes.
At least 1 meetup chat sent messages from 2 accounts: yes.
Logout and relogin tested: yes.
Backend logs checked on vps1: yes.
QA report file created under docs/audits: yes.
Skipped stages have concrete reasons: yes.
```

## Next Stage

Next planned stage:

- No next active stage in this plan.

Current account on simulator:

```text
+72222222222
```

Current visible state:

```text
Guest C is in meetup chat cmp10vn8m005npe1z534n9mm6 after local simulator app reset and relogin.
The latest photo attachment is visible as a broken placeholder after reopening chat.
Dating F remains blocked on onboarding Step 1 email.
Guest C completed Stage 15.1 to Stage 15.5.
Stage 16 backend checks are completed.
Stage 17 cleanup scope is recorded. No backend deletes were performed.
Stage 18 final report summary is recorded.
Backend has one Stage 15 created event: ev-b8d21592-e4c6-46ec-9cb2-caf227aba0b1.
Stage 14 event remains live: ev-e82bb1fb-028a-4a85-b8f6-980306f9469e.
```

### Final Sanity Check

Checked at:

```text
2026-05-11 21:37 +07
```

Result:

```text
XcodeBuildMCP snapshot_ui shows Guest C in meetup chat cmp10vn8m005npe1z534n9mm6.
The visible chat title is ЙФ шЩЫ 2026-05-11 Зкшмфеу Ьууегз У.
The visible chat card shows 8 participants and Сегодня · 11:48 · 8/8 идут.
The latest image area is still visible as a broken placeholder after reopening chat.
Backend authenticated messages API still returns attachment cmp178x8400chpe1zj43nrv1v as ready image/jpeg with byteSize 26370.
Backend event API still returns Stage 15 event ev-b8d21592-e4c6-46ec-9cb2-caf227aba0b1 with startsAtIso 2026-05-11T14:15:00.000Z and chatId cmp1660vn00bzpe1z80cwy523.
Backend event API still returns Stage 14 event ev-e82bb1fb-028a-4a85-b8f6-980306f9469e with joinRequestStatus approved and chatId cmp10vn8m005npe1z534n9mm6 for Guest C.
Backend live API still returns status live and startedAt 2026-05-11T12:08:10.244Z for Stage 14.
vps1 compose check with .env.production shows api, chat, worker, nginx, postgres, redis, pgbouncer and admin services running healthy.
```

Recommended first checks:

- Keep `cmp178x8400chpe1zj43nrv1v` until `IOS-QA-018` is triaged.
- Keep Affiche event `cmowwapbe00dfp50j2ieqmuzw` for `IOS-QA-016` reproduction.
- Keep community `cmp14125v00b2pe1z2eqs2ado` for `IOS-QA-015` reproduction.

## Stage 19: Follow-up QA Continuation

Checked at:

```text
2026-05-11 21:40 +07
```

### Step 19.1: Current UI And Simulator

Result:

```text
XcodeBuildMCP list_sims shows iPhone 17 Pro booted.
Simulator id: A195A8F2-DCEB-4B12-9377-8F1D6294F072.
iOS runtime: 26.4.
Bundle id: com.sergeypolyakov.frendly.dev.
Initial snapshot showed Guest C still in meetup chat cmp10vn8m005npe1z534n9mm6.
Visible title: ЙФ шЩЫ 2026-05-11 Зкшмфеу Ьууегз У.
Visible meetup card: Сегодня · 11:48 · 8/8 идут.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage19-photo-relaunch-still-broken.jpg
```

### Step 19.2: IOS-QA-018 Retest After Cold App Relaunch

Steps:

```text
1. Ran stop_app_sim for com.sergeypolyakov.frendly.dev.
2. Ran launch_app_sim for the same bundle id.
3. App opened Home first.
4. Opened Chats tab.
5. Opened meetup chat cmp10vn8m005npe1z534n9mm6.
6. Scrolled to the latest photo message.
```

Expected:

```text
Ready image/jpeg attachment renders after app relaunch.
```

Actual:

```text
Photo attachment still renders as a broken placeholder.
The chat list preview still shows the image file name as the latest message.
```

Evidence:

```text
messageId: cmp178xfw000rpg1znkcva3n2
mediaAssetId: cmp178x8400chpe1zj43nrv1v
screenshot: docs/audits/2026-05-11-ios-stage19-photo-cold-relaunch-broken.jpg
```

### Step 19.3: Backend Recheck For IOS-QA-018

Account:

```text
+72222222222 Guest C
```

Result:

```text
GET /chats/cmp10vn8m005npe1z534n9mm6/messages?limit=20 returns message cmp178xfw000rpg1znkcva3n2.
Attachment cmp178x8400chpe1zj43nrv1v is status ready.
mimeType: image/jpeg.
byteSize: 26370.
url: /media/cmp178x8400chpe1zj43nrv1v.
downloadUrlPath: /media/cmp178x8400chpe1zj43nrv1v/download-url.
GET /media/cmp178x8400chpe1zj43nrv1v/download-url returns 200 with a signed URL.
curl -L /media/cmp178x8400chpe1zj43nrv1v returns HTTP 200 image/jpeg 26370.
Downloaded file is valid JPEG, 368x800.
```

Conclusion:

```text
IOS-QA-018 remains reproducible after cold app relaunch.
Backend still looks healthy for the affected media.
The issue remains on the iOS media reload or render path.
```

### Step 19.4: IOS-QA-017 Relaunch Recheck

Steps:

```text
1. Relaunched the app with XcodeBuildMCP.
2. Waited for Home after splash.
3. Read Home header from snapshot_ui.
```

Expected:

```text
Home header date matches 2026-05-11.
```

Actual:

```text
Home header showed Среда · 06 мая.
Current QA date is Monday, 2026-05-11.
```

Conclusion:

```text
IOS-QA-017 also reproduces after cold app relaunch, not only after returning from evening flow.
```

## Stage 19 Final State

Current visible state:

```text
Guest C is in meetup chat cmp10vn8m005npe1z534n9mm6.
The latest photo attachment remains visible as a broken placeholder.
```

Confidence remains:

```text
yellow
```

## Stage 20: Media Attachment In Another Meetup Chat

Checked at:

```text
2026-05-11 21:45 +07
```

### Step 20.1: Open Another Meetup Chat

Account:

```text
+72222222222 Guest C
```

Result:

```text
Opened Chats from meetup chat cmp10vn8m005npe1z534n9mm6. Then opened second meetup chat from the list.
Actual opened chat id by backend evidence: cmp1660vn00bzpe1z80cwy523.
Visible title: Ыефпу 15 Зфые Вфеу.
Visible card: Сегодня · 14:15 · 1/8.
```

### Step 20.2: Send Fresh Photo Attachment

Steps:

```text
1. Tapped composer plus button.
2. Chose Фото.
3. Selected a different simulator photo, flower image.
4. Waited for upload and render.
```

Expected:

```text
The selected photo sends and renders in the chat.
```

Actual:

```text
The selected photo rendered immediately after send.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage20-other-chat-photo-sent.jpg
```

### Step 20.3: Reopen Same Chat

Steps:

```text
1. Tapped back to Chats.
2. Opened the same meetup chat again.
3. Checked the latest photo bubble.
```

Expected:

```text
The fresh image attachment still renders after leaving and reopening the chat.
```

Actual:

```text
The same fresh image bubble changed to a broken placeholder after reopening the chat.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage20-other-chat-photo-reopen-broken.jpg
```

### Step 20.4: Backend Check For New Attachment

Result:

```text
chatId: cmp1660vn00bzpe1z80cwy523
messageId: cmp1bc5qv000vpg1zj7n04gcx
mediaAssetId: cmp1bc5jx00cnpe1zu4ng7bu9
fileName: image_picker_651E7D95-6AC3-45E1-989E-549A58C112C7-49536-0000017CC5932238.jpg
mimeType: image/jpeg
byteSize: 881799
status: ready
url: /media/cmp1bc5jx00cnpe1zu4ng7bu9
downloadUrlPath: /media/cmp1bc5jx00cnpe1zu4ng7bu9/download-url
download-url endpoint: 200 with signed URL
curl -L media download: 200 image/jpeg 881799
downloaded file: valid JPEG, 1600x1200
```

Conclusion:

```text
IOS-QA-018 is not limited to the original image or original meetup chat.
It reproduces with a new photo upload in another meetup chat after simple leave and reopen.
Backend still returns ready media and a valid image download.
```

### Step 20.5: Runtime Log Check

Runtime log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T14-39-42-169Z_helperpid49532_ownerpid47207_0b154f62.log
```

Result:

```text
No explicit media download, CachedNetworkImage, Dio or HTTP image error was visible around the Stage 20 reopen.
Log did show image_picker note at 21:44:33:
image_picker: compressing is not supported for type (null). Returning the image with original quality.
Repeated unrelated Yandex MapKit invalid API key errors continued once per minute.
```

## Stage 20 Final State

Current visible state:

```text
Guest C is in meetup chat cmp1660vn00bzpe1z80cwy523.
The latest fresh photo attachment is visible as a broken placeholder.
```

## Stage 21: Fresh Unread Retest

Checked at:

```text
2026-05-11 21:53 +07
```

### Step 21.1: Guest C Unread Baseline

Account:

```text
+72222222222 Guest C
```

Chat:

```text
cmp10vn8m005npe1z534n9mm6
```

Backend baseline:

```text
unread: 4
lastMessage: image_picker_109AB6E7-C6DE-48D0-B564-38C35D9A9A5A-6114-00000156646F5479.jpg
lastAuthor: Пользователь 2222
```

### Step 21.2: Fresh Message From Host E

Account:

```text
+74444444444 Host E
```

Method:

```text
Production WebSocket wss://api.frendly.tech/ws.
session.authenticate, chat.subscribe, message.send.
```

Sent message:

```text
messageId: cmp1bkzfs000zpg1zfh06sznl
clientMessageId: qa-unread-1778511079599
text: QA unread fresh 2026-05-11T14:51:19.598Z
createdAt: 2026-05-11T14:51:29.512Z
```

Backend after send for Guest C:

```text
unread: 5
lastMessage: QA unread fresh 2026-05-11T14:51:19.598Z
lastAuthor: Пользователь 4444
lastTime: сейчас
```

### Step 21.3: iOS Chats Row After Fresh Message

Expected:

```text
Chats row updates to latest Host E message and unread 5.
```

Actual:

```text
iOS row still showed the older photo filename from Guest C.
Unread badge still showed 4.
Backend had already moved to unread 5 and the Host E message.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage21-unread-list-stale-after-ws-message.jpg
```

### Step 21.4: Open Chat And Read Clear

Steps:

```text
1. Opened meetup chat cmp10vn8m005npe1z534n9mm6 from the stale iOS row.
2. Chat opened around older messages, latest Host E message was offscreen.
3. Backend unread remained 5 after opening.
4. Scrolled until the Host E message became visible.
5. Backend unread still remained 5.
```

Expected:

```text
Opening the chat or viewing the latest message clears unread.
```

Actual:

```text
Unread stayed 5 after opening the chat.
Unread also stayed 5 after the fresh Host E message was visible.
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage21-unread-open-chat-latest-offscreen.jpg
docs/audits/2026-05-11-ios-stage21-unread-latest-visible-still-unread.jpg
```

Conclusion:

```text
IOS-QA-011 remains reproducible on a fresh message.
The Stage 21 pass also shows a separate chat list realtime stale-row issue, filed as IOS-QA-019.
```

## Stage 21 Final State

Current visible state:

```text
Guest C is in meetup chat cmp10vn8m005npe1z534n9mm6.
Fresh Host E message is visible.
Backend still reports unread 5 for Guest C on the same chat.
```

## Stage 22: Stale Chat Row Recovery Check

Checked at:

```text
2026-05-11 21:59 +07
```

### Step 22.1: Return To Chats Without Relaunch

Steps:

```text
1. Started in meetup chat cmp10vn8m005npe1z534n9mm6.
2. Tapped back to Chats.
3. Checked the Stage 14 row.
```

Expected:

```text
Chats row updates to latest Host E message and unread 5.
```

Actual:

```text
Chats row still showed the old Guest C image filename.
Unread badge still showed 4.
Backend at the same time reported latest Host E message and unread 5.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage22-chat-list-return-still-stale.jpg
```

### Step 22.2: Cold Relaunch Recovery

Steps:

```text
1. Ran stop_app_sim.
2. Ran launch_app_sim.
3. Waited through splash to Home.
4. Opened Chats.
```

Expected:

```text
Cold relaunch reads fresh chat list state.
```

Actual:

```text
After cold relaunch, the Stage 14 row showed the Host E message.
Unread badge showed 5.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage22-chat-list-cold-relaunch-updated.jpg
```

### Step 22.3: Backend Recheck

Result:

```text
chatId: cmp10vn8m005npe1z534n9mm6
unread: 5
lastMessage: QA unread fresh 2026-05-11T14:51:19.598Z
lastAuthor: Пользователь 4444
lastTime: 7 мин
```

Conclusion:

```text
IOS-QA-019 looks like a runtime realtime or cache refresh issue.
The REST-backed cold relaunch view catches up.
IOS-QA-011 still remains because unread stays 5.
```

## Stage 22 Final State

Current visible state:

```text
Guest C is on Chats.
Stage 14 row now shows latest Host E message after cold relaunch.
Unread badge shows 5.
Home still showed stale date Среда · 06 мая during relaunch path.
```

## Stage 23: Open Fresh Row After Relaunch

Checked at:

```text
2026-05-11 22:05 +07
```

### Step 23.1: Backend And UI Baseline

Account:

```text
+72222222222 Guest C
```

Backend:

```text
chatId: cmp10vn8m005npe1z534n9mm6
unread: 5
lastMessage: QA unread fresh 2026-05-11T14:51:19.598Z
lastAuthor: Пользователь 4444
lastTime: 13 мин
```

UI baseline:

```text
Chats row showed the same Host E message after cold relaunch.
Unread badge showed 5.
```

### Step 23.2: Open Fresh Row

Steps:

```text
1. Tapped the Stage 14 chat row that showed Host E latest message and unread 5.
2. Checked first visible messages after navigation.
3. Rechecked backend unread.
```

Expected:

```text
Chat opens near latest unread message.
Opening the fresh row clears unread.
```

Actual:

```text
Chat opened around older history near 17:36 to 17:41.
Fresh Host E message was not visible.
Backend unread stayed 5 after opening.
```

Evidence:

```text
screenshot: docs/audits/2026-05-11-ios-stage23-open-fresh-row-old-history.jpg
backend unread after open: 5
```

### Step 23.3: Runtime Log Check

Runtime log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T14-57-38-574Z_helperpid77652_ownerpid47207_a2431c05.log
```

Result:

```text
No explicit read, WebSocket, or Dio error was visible around the Stage 23 open.
The log continued to show unrelated Yandex MapKit invalid API key errors.
```

Conclusion:

```text
IOS-QA-011 is stronger than the original offscreen case.
Even when the Chats row is fresh after cold relaunch, opening it does not jump to latest unread and does not clear unread.
```

## Stage 23 Final State

Current visible state:

```text
Guest C is in meetup chat cmp10vn8m005npe1z534n9mm6.
Visible history is still older than the latest Host E message.
Backend unread remains 5.
```

## Stage 24: Backend Mark Read Control Check

Checked at:

```text
2026-05-11 22:18 +07
```

### Step 24.1: Direct Backend Mark Read

Account:

```text
+72222222222 Guest C
```

Action:

```text
POST /chats/cmp10vn8m005npe1z534n9mm6/read
messageId: cmp1bkzfs000zpg1zfh06sznl
```

Expected:

```text
Backend clears unread for Guest C.
```

Actual:

```text
Response: ok true.
Backend /chats/meetups then returned unread 0.
```

Backend result:

```text
id: cmp10vn8m005npe1z534n9mm6
unread: 0
lastMessage: QA unread fresh 2026-05-11T14:51:19.598Z
lastAuthor: Пользователь 4444
lastTime: 27 мин
```

### Step 24.2: Active iOS Session After Backend Read

Expected:

```text
The active Chats session refreshes to backend unread 0.
```

Actual:

```text
The active iOS Chats session still showed unread badge 5 after backend unread was already 0.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage24-api-read-ui-still-stale.jpg
```

### Step 24.3: Cold Relaunch Recovery

Steps:

```text
1. Cold relaunched the app.
2. Opened Chats as Guest C.
3. Checked the Stage 14 row through XcodeBuildMCP snapshot_ui.
4. Rechecked backend /chats/meetups.
```

Expected:

```text
Chats list refreshes from backend and removes unread badge.
```

Actual:

```text
Stage 14 row showed the latest Host E message.
Unread badge 5 was gone.
Backend still returned unread 0.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage24-api-read-cold-relaunch-updated.jpg
```

Conclusion:

```text
Direct backend mark-read works for the latest message.
IOS-QA-011 is not a backend read endpoint failure.
The iOS app either does not send the read command in this path, sends it for the wrong target, or keeps stale list state in the active session.
```

## Stage 24 Final State

Current visible state:

```text
Guest C is on Chats.
Stage 14 row shows latest Host E message.
Unread badge is not visible for the Stage 14 row.
Backend unread for cmp10vn8m005npe1z534n9mm6 is 0.
```

## Stage 25: Home Date Relaunch And Relogin Check

Checked at:

```text
2026-05-11 22:21 +07
```

### Step 25.1: Current Session Home Date

Account:

```text
+72222222222 Guest C
```

Steps:

```text
1. Started from Chats after Stage 24.
2. Opened Home through the bottom Radar tab.
3. Checked the Home header through XcodeBuildMCP snapshot_ui.
```

Expected:

```text
Home date matches 2026-05-11.
```

Actual:

```text
Home showed Среда · 06 мая.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage25-home-stale-date-before-relogin.jpg
```

### Step 25.2: Stop And Launch

Steps:

```text
1. Ran stop_app_sim.
2. Ran launch_app_sim.
3. Checked Home again after launch.
```

Expected:

```text
Home date matches 2026-05-11 after process restart.
```

Actual:

```text
Home still showed Среда · 06 мая.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage25-home-stale-date-after-relaunch.jpg
```

### Step 25.3: Logout And Guest C Relogin

Steps:

```text
1. Opened profile tab.
2. Opened settings.
3. Tapped Выйти.
4. Logged in again through SMS shortcut with 2222222222.
5. Checked Home after login.
```

Expected:

```text
Home date matches 2026-05-11 after relogin.
```

Actual:

```text
Relogin returned to Home.
Home still showed Среда · 06 мая.
```

Backend identity check:

```text
userId: user-91891ec2-a270-4ff3-b28d-63a5eda246fc
displayName: Пользователь 2222
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage25-home-stale-date-after-relogin.jpg
```

Conclusion:

```text
IOS-QA-017 is not only a stale return-from-evening state.
It reproduces after process relaunch and after logout plus relogin.
```

## Stage 25 Final State

Current visible state:

```text
Guest C is on Home.
Home header date is Среда · 06 мая.
Expected current QA date is 2026-05-11.
```

## Stage 26: Direct Chat Photo Reload Check

Checked at:

```text
2026-05-11 22:27 +07
```

### Step 26.1: Open Existing Direct Chat

Account:

```text
+71111111111 Guest B
```

Steps:

```text
1. Logged out from Guest C.
2. Logged in as Guest B through SMS shortcut with 1111111111.
3. Opened Chats.
4. Opened the Личные filter.
5. Opened the existing direct chat with Host A.
```

Backend baseline:

```text
chatId: cmp13baks00aepe1zvvuegmnl
personal chat count for Guest B: 1
lastMessage before test: 20260511 1003 1111
```

### Step 26.2: Send Direct Chat Photo

Steps:

```text
1. Tapped the attachment button in the direct chat composer.
2. Picked Фото.
3. Selected a simulator Photos image by coordinates because the native picker accessibility tree was empty.
```

Expected:

```text
Photo appears in direct chat.
Backend stores a ready image asset.
Direct media download returns a valid JPEG.
```

Actual:

```text
Photo appeared immediately in the direct chat.
Backend stored a ready private image/jpeg asset.
curl -L media download returned a 26370 byte JPEG.
```

Backend evidence:

```text
messageId: cmp1cvsrd0012pg1zqen6ff50
mediaAssetId: cmp1cvsi300cvpe1zllh3qhlm
fileName: image_picker_4024E3CB-5734-4079-93B7-F4D7E94C421D-10639-0000018B483CD0D1.jpg
mimeType: image/jpeg
byteSize: 26370
status: ready
url: /media/cmp1cvsi300cvpe1zllh3qhlm
downloadUrlPath: /media/cmp1cvsi300cvpe1zllh3qhlm/download-url
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage26-direct-chat-photo-sent.jpg
```

### Step 26.3: Reopen Direct Chat

Steps:

```text
1. Went back to the Chats list.
2. Opened the same personal direct chat again.
```

Expected:

```text
The sent photo still renders.
```

Actual:

```text
The attachment no longer exposed an image in XcodeBuildMCP snapshot_ui.
Only the timestamp 22:27 remained visible in the attachment area.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage26-direct-chat-photo-reopen-broken.jpg
```

### Step 26.4: Cold Relaunch Reopen

Steps:

```text
1. Ran stop_app_sim.
2. Ran launch_app_sim.
3. Opened Chats.
4. Opened Личные.
5. Opened the same direct chat.
```

Expected:

```text
The sent photo still renders after cold relaunch.
```

Actual:

```text
The same broken state remained.
The attachment area still only exposed the timestamp 22:27.
```

Runtime log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T15-29-04-510Z_helperpid22324_ownerpid47207_543971b8.log
```

Log note:

```text
No explicit image, media, Dio, or attachment error was visible in the checked tail.
The checked lines only showed the already known Yandex MapKit request errors.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage26-direct-chat-photo-cold-relaunch-broken.jpg
```

Conclusion:

```text
IOS-QA-018 is not limited to meetup chat.
It also reproduces in a personal direct chat with a ready backend image and valid media download.
```

## Stage 26 Final State

Current visible state:

```text
Guest B is in direct chat cmp13baks00aepe1zvvuegmnl with Host A.
Latest direct chat photo attachment is broken after cold relaunch.
Backend asset cmp1cvsi300cvpe1zllh3qhlm is ready and downloadable.
```

## Stage 27: Direct Chat Voice Reload Check

Checked at:

```text
2026-05-11 22:35 +07
```

### Step 27.1: Confirm Current UI And Backend

Account:

```text
+71111111111 Guest B
```

UI evidence:

```text
Guest B was in direct chat cmp13baks00aepe1zvvuegmnl with Host A.
Header showed Пользователь 0000.
Visible history included voice 0:18, text 20260511 1003 1111, and the broken photo area with timestamp 22:27.
```

Backend evidence:

```text
chatId: cmp13baks00aepe1zvvuegmnl
voice message id: cmp13cmj0000kpg1zc9ckroxz
mediaAssetId: cmp13cma700aipe1znqi2ry4j
mimeType: audio/mp4
byteSize: 193730
status: ready
media GET: 200 audio/mp4 193730
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage27-direct-chat-voice-cold-baseline.jpg
```

### Step 27.2: Reopen Direct Chat

Steps:

```text
1. Went back to Chats.
2. Opened the same personal direct chat again.
```

Expected:

```text
Voice message still renders after reopen.
```

Actual:

```text
Voice message still rendered as 0:18.
The photo attachment remained broken in the same view.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage27-direct-chat-voice-reopen-visible.jpg
```

### Step 27.3: Cold Relaunch Reopen

Steps:

```text
1. Ran stop_app_sim.
2. Ran launch_app_sim.
3. Opened Chats.
4. Opened the same personal direct chat again.
```

Expected:

```text
Voice message still renders after cold relaunch.
```

Actual:

```text
Voice message still rendered as 0:18 after cold relaunch.
The latest photo attachment still exposed only timestamp 22:27.
```

Runtime log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T15-34-28-861Z_helperpid31234_ownerpid26902_9376d989.log
```

Log note:

```text
No voice, audio, media, attachment, Dio or exception error was visible.
Only the already known Yandex MapKit host errors appeared in the checked lines.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage27-direct-chat-voice-cold-relaunch-visible.jpg
```

Conclusion:

```text
Direct chat voice reload works in this check.
This does not reproduce IOS-QA-018, which remains specific to photo image rendering in the checked media cases.
```

## Stage 27 Final State

Current visible state:

```text
Guest B is in direct chat cmp13baks00aepe1zvvuegmnl with Host A.
Voice attachment 0:18 is visible after cold relaunch.
Latest direct chat photo attachment is still broken after cold relaunch.
```

## Stage 28: Personal Chat Unread Realtime Check

Checked at:

```text
2026-05-11 22:38 to 22:41 +07
```

### Step 28.1: Baseline On Chats List

Account:

```text
+71111111111 Guest B
```

UI baseline:

```text
Guest B was on Chats list.
Direct row for Пользователь 0000 showed old photo filename as latest preview.
No unread badge was visible on that row.
```

Backend baseline:

```text
chatId: cmp13baks00aepe1zvvuegmnl
lastMessage: image_picker_4024E3CB-5734-4079-93B7-F4D7E94C421D-10639-0000018B483CD0D1.jpg
unread: 0
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage28-personal-unread-baseline.jpg
```

### Step 28.2: Send Host A Message

Sender:

```text
+70000000000 Host A
```

Action:

```text
Sent a message through production WebSocket to direct chat cmp13baks00aepe1zvvuegmnl.
```

Backend send result:

```text
messageId: cmp1da0yt0016pg1z1zje2u1r
clientMessageId: qa-personal-unread-1778513934490
text: 20260511 personal unread 1538 host
senderName: Пользователь 0000
```

Backend Guest B row after send:

```text
lastMessage: 20260511 personal unread 1538 host
lastTime: сейчас
unread: 1
```

Expected:

```text
iOS Chats row shows the new latest text and unread badge 1.
```

Actual:

```text
iOS Chats row showed unread badge 1.
The same row still showed old photo filename as latest preview.
Bottom tab badge also showed 1.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage28-personal-unread-row-stale.jpg
```

### Step 28.3: Open Personal Chat

Steps:

```text
1. Opened the direct chat from the unread row.
2. Checked the visible messages.
3. Waited and rechecked backend unread.
```

Expected:

```text
Opening the personal chat clears unread when the latest message is visible.
```

Actual:

```text
The new message 20260511 personal unread 1538 host was visible at 22:38.
Backend unread stayed 1 after opening.
Backend unread stayed 1 after an extra 5 second wait.
Returning to Chats still showed unread badge 1.
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage28-personal-unread-opened-latest.jpg
docs/audits/2026-05-11-ios-stage28-personal-unread-after-open-still-badge.jpg
```

### Step 28.4: Cold Relaunch Recovery

Steps:

```text
1. Ran stop_app_sim.
2. Ran launch_app_sim.
3. Opened Chats.
```

Expected:

```text
Chats row reloads from backend.
Unread state matches backend.
```

Actual:

```text
Chats row refreshed latest preview to 20260511 personal unread 1538 host.
Unread badge stayed 1 because backend unread was still 1.
```

Runtime log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T15-40-28-982Z_helperpid40855_ownerpid26902_8e7068fb.log
```

Log note:

```text
No explicit chat, unread, WebSocket, Dio or exception error was visible in the checked launch log.
Only the already known Yandex MapKit host errors appeared.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage28-personal-unread-cold-relaunch-row-fresh-unread.jpg
```

Conclusion:

```text
IOS-QA-019 also affects personal direct chat row preview during realtime.
IOS-QA-020 filed because opening a personal direct chat did not clear unread even when the latest message was visible.
```

## Stage 28 Final State

Current visible state:

```text
Guest B is on Chats list.
Direct chat cmp13baks00aepe1zvvuegmnl shows latest text 20260511 personal unread 1538 host.
Unread badge is still 1.
Backend unread is still 1.
```

## Stage 29: Personal Chat Unread Fresh Row Reopen Check

Checked at:

```text
2026-05-11 22:49 +07
```

### Step 29.1: Fresh Row Baseline

Account:

```text
+71111111111 Guest B
```

UI baseline:

```text
Guest B was on Chats list after cold relaunch.
Direct row showed latest text 20260511 personal unread 1538 host.
Row unread badge showed 1.
Bottom tab badge showed 1.
```

Backend baseline:

```text
chatId: cmp13baks00aepe1zvvuegmnl
lastMessage: 20260511 personal unread 1538 host
unread: 1
lastTime: 10 мин
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage29-personal-unread-fresh-row-baseline.jpg
```

### Step 29.2: Open Fresh Row

Steps:

```text
1. Opened the direct row from Chats.
2. Confirmed the latest message was visible.
3. Rechecked backend unread after 2 seconds.
```

Expected:

```text
Opening from a fresh row clears unread because the latest unread message is visible.
```

Actual:

```text
The latest message 20260511 personal unread 1538 host was visible at 22:38.
Backend unread stayed 1 after opening.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage29-personal-unread-fresh-row-opened.jpg
```

### Step 29.3: Wait And Return To Chats

Steps:

```text
1. Waited 5 more seconds.
2. Rechecked backend unread.
3. Returned to Chats.
```

Expected:

```text
Unread clears after a short delay, and the row badge disappears.
```

Actual:

```text
Backend unread stayed 1 after the extra wait.
Chats row still showed unread badge 1.
Bottom tab still showed unread badge 1.
```

Runtime log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T15-40-28-982Z_helperpid40855_ownerpid26902_8e7068fb.log
```

Log note:

```text
No explicit chat, unread, WebSocket, Dio or exception error was visible in the checked launch log.
Only the already known Yandex MapKit host errors appeared.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage29-personal-unread-fresh-row-after-open-still-badge.jpg
```

Conclusion:

```text
IOS-QA-020 is not only a stale-row open issue.
It still reproduces when opening a fresh row after cold relaunch.
```

## Stage 29 Final State

Current visible state:

```text
Guest B is on Chats list.
Direct chat cmp13baks00aepe1zvvuegmnl still shows unread badge 1.
Backend unread is still 1.
```

## Stage 30: Direct Chat Backend Mark Read Control Check

Checked at:

```text
2026-05-11 22:53 +07
```

### Step 30.1: Baseline

Account:

```text
+71111111111 Guest B
```

UI baseline:

```text
Guest B was on Chats list.
Direct row showed latest text 20260511 personal unread 1538 host.
Row unread badge showed 1.
Bottom tab badge showed 1.
```

Backend baseline:

```text
chatId: cmp13baks00aepe1zvvuegmnl
messageId: cmp1da0yt0016pg1z1zje2u1r
lastMessage: 20260511 personal unread 1538 host
unread: 1
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage30-direct-backend-read-baseline.jpg
```

### Step 30.2: REST Mark Read

Action:

```text
Called POST /chats/cmp13baks00aepe1zvvuegmnl/read as Guest B with messageId cmp1da0yt0016pg1z1zje2u1r.
```

Expected:

```text
Backend read path clears unread.
```

Actual:

```text
REST returned 201 with ok true.
Backend row unread became 0.
```

Backend evidence:

```text
readStatus: 201
readBody: {"ok":true}
backend unread after read: 0
```

### Step 30.3: Active iOS State

Expected:

```text
Active iOS Chats list removes the unread badge after backend read.
```

Actual:

```text
Active iOS Chats list still showed row badge 1.
Bottom tab still showed badge 1.
Backend already reported unread 0.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage30-direct-backend-read-ui-still-stale.jpg
```

### Step 30.4: Cold Relaunch

Steps:

```text
1. Ran stop_app_sim.
2. Ran launch_app_sim.
3. Opened Chats.
4. Rechecked backend row.
```

Expected:

```text
Cold relaunch reloads backend unread 0 and removes badges.
```

Actual:

```text
Chats row showed no direct unread badge.
Bottom tab showed no chat unread badge.
Backend row stayed unread 0.
```

Runtime log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T15-53-30-289Z_helperpid59765_ownerpid26902_978bf374.log
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage30-direct-backend-read-cold-relaunch-cleared.jpg
```

Conclusion:

```text
Backend direct read path works.
IOS-QA-020 appears to be an iOS read trigger or runtime sync issue, not a backend inability to clear direct unread.
Active iOS list can remain stale after external read until cold relaunch.
```

## Stage 30 Final State

Current visible state:

```text
Guest B is on Chats list.
Direct chat cmp13baks00aepe1zvvuegmnl has no unread badge.
Backend unread is 0.
```

## Stage 31: Public Profile Cold Relaunch Recheck

Checked at:

```text
2026-05-11 22:58 +07
```

Account:

```text
+71111111111 Guest B
```

Target:

```text
+70000000000 Host A
user-2132494b-d607-4e21-9982-3e939f72a572
```

Note:

```text
UI tap from direct chat did not open the profile, although the AX label said "Открыть профиль пользователя Пользователь 0000".
Used simctl openurl because XcodeBuildMCP has no open-url tool, then verified UI through XcodeBuildMCP.
```

### Step 31.1: Open Host A Public Profile

Expected:

```text
Header and body both show Host A.
Backend /people/:userId matches the visible profile.
```

Actual:

```text
UI showed П0, Пользователь 0000, Пользователь 0000, 31, Moscow.
Backend returned displayName Пользователь 0000, age 31, city Moscow.
Social backend returned followers 0 and iFollow false.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage31-host-a-profile-consistent.jpg
```

### Step 31.2: Follow And Compare Backend

Expected:

```text
UI follow state changes.
Backend social state changes to iFollow true.
```

Actual:

```text
UI changed to Вы подписаны.
Follower count became 1.
Backend /people/:userId/social returned followers 1 and iFollow true.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage31-host-a-profile-follow-persisted.jpg
```

### Step 31.3: Cold Relaunch And Reopen Profile

Steps:

```text
1. Ran stop_app_sim.
2. Ran launch_app_sim.
3. Reopened frendly:///user/user-2132494b-d607-4e21-9982-3e939f72a572.
4. Rechecked UI and backend.
```

Expected:

```text
Header and body still match Host A.
Follow state stays persisted.
```

Actual:

```text
UI still showed Host A as Пользователь 0000.
UI still showed Вы подписаны and followers 1.
Backend profile still matched Host A.
Backend social still returned followers 1 and iFollow true.
```

Runtime log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T15-58-12-709Z_helperpid67368_ownerpid26902_a1aefe32.log
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage31-host-a-profile-after-relaunch-follow-persisted.jpg
```

Conclusion:

```text
IOS-QA-012 was not reproduced in this Stage 31 path.
The original high bug stays open because Stage 10 has mismatch evidence.
Current Host A profile state is consistent across UI and backend.
```

## Stage 31 Final State

Current visible state:

```text
Guest B is on Host A public profile.
UI shows Пользователь 0000 with follow state Вы подписаны and followers 1.
Backend /people/:userId/social shows iFollow true and followers 1.
```

## Stage 32: Direct Chat Generic File Attachment Recheck

Checked at:

```text
2026-05-11 23:09 +07
```

Account:

```text
+71111111111 Guest B
```

Chat:

```text
cmp13baks00aepe1zvvuegmnl
Direct chat with Host A
```

### Step 32.1: iOS File Picker Send

Setup:

```text
Created frendly-stage32-file.txt in the simulator local Files storage.
File picker showed it under На iPhone.
```

Expected:

```text
Selecting the txt file sends a file attachment or shows a visible error.
```

Actual:

```text
Selecting the file returned to the direct chat.
No file message appeared.
Backend latest messages did not include a new picker-sent file message.
No visible error appeared.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage32-direct-file-picker-return-no-file.jpg
```

Conclusion:

```text
Filed IOS-QA-021.
```

### Step 32.2: Backend Control Send

Action:

```text
Uploaded the same file through POST /uploads/chat-attachment/file.
Sent it through production WebSocket message.send as Guest B.
```

Backend evidence:

```text
uploadStatus: 201
messageId: cmp1e9w580019pg1zk0o9otbs
clientMessageId: qa-file-stage32-1778515607267
mediaAssetId: cmp1e9utq00d3pe1z8872cxbq
mimeType: text/plain
byteSize: 69
status: ready
url: /media/cmp1e9utq00d3pe1z8872cxbq
GET /media/cmp1e9utq00d3pe1z8872cxbq: 200 text/plain 69 bytes
```

Expected:

```text
Active direct chat receives the message or renders it after reload.
```

Actual:

```text
Active direct chat did not show the file immediately.
After reopening the direct chat from Host A profile, the file was visible with Скачать на телефон.
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage32-direct-file-backend-sent-active-ui-stale.jpg
docs/audits/2026-05-11-ios-stage32-direct-file-reopen-visible.jpg
```

### Step 32.3: Download Tap And Cold Relaunch

Steps:

```text
1. Tapped the file attachment download area.
2. Cold relaunched the app.
3. Opened Chats.
4. Opened the same direct row.
```

Expected:

```text
File remains visible after cold relaunch.
Chats row preview shows the file.
Download tap gives visible progress, local state, save result, or open result.
```

Actual:

```text
Download tap produced no visible change in the checked UI.
After cold relaunch, Chats row preview showed frendly-stage32-file.txt.
Opening the direct row showed the same file attachment with Скачать на телефон.
```

Runtime log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T16-08-18-379Z_helperpid83011_ownerpid26902_2221fb22.log
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage32-direct-file-download-tap-no-visible-change.jpg
docs/audits/2026-05-11-ios-stage32-direct-file-cold-relaunch-chat-list-preview.jpg
docs/audits/2026-05-11-ios-stage32-direct-file-cold-relaunch-visible.jpg
```

Conclusion:

```text
Backend generic file attachment path works for text/plain.
iOS can render the backend-seeded file after reopening and after cold relaunch.
iOS picker send path failed silently for the same file.
```

## Stage 32 Final State

Current visible state:

```text
Guest B is in direct chat cmp13baks00aepe1zvvuegmnl with Host A.
The latest visible message is frendly-stage32-file.txt.
The older direct photo attachment still shows a broken placeholder.
```

## Stage 33: Direct Chat PDF Attachment Recheck

Checked at:

```text
2026-05-11 23:14 +07
```

Account:

```text
+71111111111 Guest B
```

Chat:

```text
cmp13baks00aepe1zvvuegmnl
Direct chat with Host A
```

### Step 33.1: Send PDF Through iOS File Picker

Setup:

```text
Created frendly-stage33-file.pdf in the simulator local Files storage.
File picker showed both frendly-stage32-file.txt and frendly-stage33-file.pdf under На iPhone.
```

Expected:

```text
PDF is sent and appears in the active direct chat.
```

Actual:

```text
The PDF message appeared immediately in the active direct chat.
UI showed frendly-stage33-file.pdf with Скачать на телефон.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage33-direct-pdf-picker-sent.jpg
```

### Step 33.2: Backend And Media Check

Backend evidence:

```text
messageId: cmp1eihgr001dpg1zuh450q3u
clientMessageId: mobile-file-1778516008535713
mediaAssetId: cmp1eih6y00d5pe1zoyx2f1wp
mimeType: application/pdf
byteSize: 386
status: ready
url: /media/cmp1eih6y00d5pe1zoyx2f1wp
GET /media/cmp1eih6y00d5pe1zoyx2f1wp: 200 application/pdf 386 bytes
```

Conclusion:

```text
PDF picker path works.
IOS-QA-021 is not a generic failure for all file types.
```

### Step 33.3: Download Tap And Cold Relaunch

Steps:

```text
1. Tapped the PDF file attachment download icon.
2. Cold relaunched the app.
3. Opened Chats.
4. Opened the same direct row.
```

Expected:

```text
Download action gives visible progress, result, open state or error.
PDF remains visible after cold relaunch.
Chats list preview shows the PDF filename.
```

Actual:

```text
Download tap produced no visible change.
The attachment still showed Скачать на телефон.
After cold relaunch, Chats row preview showed frendly-stage33-file.pdf.
Opening the direct row showed the same PDF attachment.
```

Runtime log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T16-14-24-361Z_helperpid92584_ownerpid26902_1073dc03.log
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage33-direct-pdf-download-tap-no-visible-change.jpg
docs/audits/2026-05-11-ios-stage33-direct-pdf-cold-relaunch-chat-list-preview.jpg
docs/audits/2026-05-11-ios-stage33-direct-pdf-cold-relaunch-visible.jpg
```

Conclusion:

```text
PDF attachment send, backend storage, chat render, Chats preview and cold relaunch persistence pass.
Download action has no visible result and is tracked as IOS-QA-022.
```

## Stage 33 Final State

Current visible state:

```text
Guest B is in direct chat cmp13baks00aepe1zvvuegmnl with Host A.
The latest visible message is frendly-stage33-file.pdf.
The older direct photo attachment still shows a broken placeholder.
```

## Stage 34: Direct Chat File Attachment Open Surface Recheck

Checked at:

```text
2026-05-11 23:18 +07
```

Account:

```text
+71111111111 Guest B
```

Chat:

```text
cmp13baks00aepe1zvvuegmnl
Direct chat with Host A
```

### Step 34.1: Tap PDF Attachment Body

Expected:

```text
PDF opens, downloads, shows progress, share sheet, saved state or visible error.
```

Actual:

```text
Tapping the PDF attachment body produced no visible change.
The attachment still showed Скачать на телефон.
```

### Step 34.2: Tap Text Attachment Body

Expected:

```text
Text file opens, downloads, shows progress, share sheet, saved state or visible error.
```

Actual:

```text
Tapping the txt attachment body produced no visible change.
The attachment still showed Скачать на телефон.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage34-direct-file-card-tap-no-visible-change.jpg
```

### Step 34.3: Runtime Log Check

Log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T16-14-24-361Z_helperpid92584_ownerpid26902_1073dc03.log
```

Result:

```text
No related download, file open, media, Dio or exception line was visible around the taps.
Only the already known Yandex MapKit host errors appeared.
```

Conclusion:

```text
This extends IOS-QA-022.
Both the download icon and attachment body can be tapped without any visible result.
```

## Stage 34 Final State

Current visible state:

```text
Guest B is in direct chat cmp13baks00aepe1zvvuegmnl with Host A.
Visible file attachments are frendly-stage32-file.txt and frendly-stage33-file.pdf.
Both still show Скачать на телефон.
The older direct photo attachment still shows a broken placeholder.
```

## Stage 35: Direct Chat ZIP Attachment Recheck

Checked at:

```text
2026-05-11 23:23 +07
```

Account:

```text
+71111111111 Guest B
```

Chat:

```text
cmp13baks00aepe1zvvuegmnl
Direct chat with Host A
```

### Step 35.1: Select ZIP Through iOS File Picker

Setup:

```text
Created frendly-stage35-file.zip in the simulator local Files storage.
File picker showed txt, PDF and ZIP under На iPhone.
```

Expected:

```text
ZIP is sent and appears in the active direct chat, or a visible error appears.
```

Actual:

```text
Selecting the ZIP returned to the direct chat.
No ZIP message appeared.
Backend latest messages still ended at frendly-stage33-file.pdf.
No visible error appeared.
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage35-direct-zip-picker-visible.jpg
docs/audits/2026-05-11-ios-stage35-direct-zip-picker-return-no-file.jpg
```

Conclusion:

```text
This extends IOS-QA-021.
The silent picker failure now covers txt and zip, while PDF works.
```

### Step 35.2: Backend ZIP Control

Action:

```text
Uploaded the same ZIP through POST /uploads/chat-attachment/file.
Sent it through production WebSocket message.send as Guest B.
```

Backend evidence:

```text
uploadStatus: 201
messageId: cmp1eub7a001hpg1z14tht4if
clientMessageId: qa-zip-stage35-1778516560182
mediaAssetId: cmp1eu9ur00d9pe1zm3fzk91d
mimeType: application/zip
byteSize: 238
status: ready
url: /media/cmp1eu9ur00d9pe1zm3fzk91d
GET /media/cmp1eu9ur00d9pe1zm3fzk91d: 200 application/zip 238 bytes
```

Expected:

```text
Active direct chat receives the message or renders it after reload.
```

Actual:

```text
Active direct chat did not show the backend-seeded ZIP immediately.
```

### Step 35.3: Cold Relaunch And Reopen

Steps:

```text
1. Ran stop_app_sim.
2. Ran launch_app_sim.
3. Opened Chats.
4. Opened the same direct row.
```

Expected:

```text
Chats row preview shows the ZIP filename.
Direct thread renders the ZIP attachment.
```

Actual:

```text
Chats row preview showed frendly-stage35-file.zip.
Opening the direct row showed frendly-stage35-file.zip with Скачать на телефон.
```

Runtime log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T16-22-59-853Z_helperpid6446_ownerpid26902_624e05b3.log
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage35-direct-zip-cold-relaunch-chat-list-preview.jpg
docs/audits/2026-05-11-ios-stage35-direct-zip-cold-relaunch-visible.jpg
```

Conclusion:

```text
Backend ZIP attachment path works.
iOS can render a backend-seeded ZIP after cold relaunch.
iOS picker send path failed silently for ZIP, matching the TXT result and unlike PDF.
```

## Stage 35 Final State

Current visible state:

```text
Guest B is in direct chat cmp13baks00aepe1zvvuegmnl with Host A.
Visible file attachments include frendly-stage32-file.txt, frendly-stage33-file.pdf and frendly-stage35-file.zip.
All visible file attachments still show Скачать на телефон.
The older direct photo attachment still shows a broken placeholder.
```

## Stage 36: Direct Chat Voice Attachment Reload Recheck

Checked at:

```text
2026-05-11 23:28 to 23:31 +07
```

Account:

```text
+71111111111 Guest B
```

Chat:

```text
cmp13baks00aepe1zvvuegmnl
Direct chat with Host A
```

### Step 36.1: Record Voice Message

Setup:

```text
Started from the existing direct chat screen.
The first voice attempt opened the iOS microphone permission alert.
Tapped Разрешить and repeated the voice action.
```

Expected:

```text
Voice message appears in the active direct chat.
Backend stores ready chat_voice media.
```

Actual:

```text
The active direct chat showed a new voice bubble with 0:11 and time 23:28.
Backend latest message was the same voice message.
```

Backend evidence:

```text
messageId: cmp1f23wl001lpg1zppcufsvq
clientMessageId: mobile-voice-1778516923077409
mediaAssetId: cmp1f23nq00dbpe1zefncuhcb
kind: chat_voice
mimeType: audio/mp4
byteSize: 137966
durationMs: 11789
status: ready
url: /media/cmp1f23nq00dbpe1zefncuhcb
GET /media/cmp1f23nq00dbpe1zefncuhcb: 200 audio/mp4 137966 bytes
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage36-direct-voice-baseline.jpg
docs/audits/2026-05-11-ios-stage36-direct-voice-microphone-permission.jpg
docs/audits/2026-05-11-ios-stage36-direct-voice-recording-state.jpg
docs/audits/2026-05-11-ios-stage36-direct-voice-sent.jpg
```

### Step 36.2: Reopen Direct Chat

Expected:

```text
Chats row preview shows the voice message.
Direct thread still renders the voice bubble.
```

Actual:

```text
Chats row preview showed Голосовое сообщение at 23:28.
Opening the direct row showed the same 0:11 voice bubble.
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage36-direct-voice-chat-list-preview.jpg
docs/audits/2026-05-11-ios-stage36-direct-voice-reopen-visible.jpg
```

### Step 36.3: Cold Relaunch And Playback

Steps:

```text
1. Ran stop_app_sim.
2. Ran launch_app_sim.
3. Opened Chats.
4. Opened the same direct row.
5. Tapped the voice bubble.
```

Expected:

```text
Chats row preview survives relaunch.
Direct thread still renders the voice bubble.
Playback starts after tapping the voice bubble.
```

Actual:

```text
Chats row preview showed Голосовое сообщение after cold relaunch.
Opening the direct row showed the same voice bubble.
Tapping the voice bubble changed the timer from 0:11 to 0:09, which indicates playback started.
```

Runtime log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T16-30-17-097Z_helperpid17746_ownerpid26902_0dc8bb5b.log
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage36-direct-voice-cold-relaunch-chat-list-preview.jpg
docs/audits/2026-05-11-ios-stage36-direct-voice-cold-relaunch-visible.jpg
docs/audits/2026-05-11-ios-stage36-direct-voice-playback-after-relaunch.jpg
```

Conclusion:

```text
Direct chat voice attachment path works in this run.
It survives reopen and cold relaunch.
Playback starts after cold relaunch.
No new voice attachment bug was filed.
```

## Stage 36 Final State

Current visible state:

```text
Guest B is in direct chat cmp13baks00aepe1zvvuegmnl with Host A.
The latest visible direct message is a voice bubble from 23:28.
Visible older file attachments still include txt, PDF and ZIP with Скачать на телефон.
The older direct photo attachment still shows a broken placeholder.
```

## Stage 37: Profile Stale After Relogin Recheck

Checked at:

```text
2026-05-11 23:34 to 23:37 +07
```

Goal:

```text
Recheck IOS-QA-012 after logout, relogin on another account and cold relaunch.
```

### Step 37.1: Guest B Own Profile Baseline And Logout

Start state:

```text
Guest B was in the direct chat with Host A after Stage 36.
Opened the own profile tab.
```

Expected:

```text
Current account profile is visible.
Logout returns to Welcome.
```

Actual:

```text
Own profile still exposed self social actions, matching the existing IOS-QA-006.
Logout from Settings returned to Welcome.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage37-profile-before-relogin-guest-b.jpg
```

### Step 37.2: Login As Guest C And Inspect Own Profile

Action:

```text
Logged in through SMS shortcut as +72222222222.
```

Backend evidence:

```text
+72222222222 /me:
userId: user-91891ec2-a270-4ff3-b28d-63a5eda246fc
displayName: Пользователь 2222
city: 37.78583

+72222222222 /profile/me:
displayName: Пользователь 2222
age: 31
city: 37.78583
```

Expected:

```text
UI state belongs to Guest C and does not show stale Guest B data.
```

Actual:

```text
Home opened for Guest C after login.
Own profile showed city 37.78583 and Guest C profile sections.
The visible name remained generic as Пользователь, 31 instead of showing the backend suffix 2222.
No stale Guest B city or intent was visible on this pass.
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage37-login-guest-c-phone.jpg
docs/audits/2026-05-11-ios-stage37-own-profile-after-relogin-guest-c.jpg
```

Conclusion:

```text
No new stale cross-account own-profile leak was found.
Existing IOS-QA-006 remains visible.
```

### Step 37.3: Host A Public Profile Before And After Cold Relaunch

Action:

```text
Opened Host A public profile through frendly:///user/user-2132494b-d607-4e21-9982-3e939f72a572.
Then ran stop_app_sim and launch_app_sim.
Opened the same deep link again.
```

Backend evidence as Guest C:

```text
viewer: user-91891ec2-a270-4ff3-b28d-63a5eda246fc
target: user-2132494b-d607-4e21-9982-3e939f72a572
displayName: Пользователь 0000
age: 31
city: Moscow
followers: 1
iFollow: false
```

Expected:

```text
Public profile header and body both show Host A.
Backend profile matches visible UI.
```

Actual:

```text
Before cold relaunch, UI showed П0, Пользователь 0000, Пользователь 0000, 31, Moscow.
After cold relaunch, UI showed the same Host A identity.
The follow button state was Подписаться, matching backend iFollow false for Guest C.
```

Runtime log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T16-36-20-216Z_helperpid27599_ownerpid26902_6e595ead.log
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage37-host-a-profile-after-relogin-guest-c.jpg
docs/audits/2026-05-11-ios-stage37-host-a-profile-after-relogin-cold-relaunch.jpg
```

Conclusion:

```text
IOS-QA-012 did not reproduce in Stage 37.
The public Host A profile stayed consistent after relogin as Guest C and after cold relaunch.
Keep IOS-QA-012 open because Stage 10 still has direct mismatch evidence.
```

## Stage 37 Final State

Current visible state:

```text
Guest C +72222222222 is logged in.
The app is on Host A public profile.
UI shows Пользователь 0000 consistently.
```

## Stage 38: Dating Guest C Gate Recheck

Checked at:

```text
2026-05-11 23:45 to 23:47 +07
```

Account:

```text
+72222222222 Guest C
```

### Step 38.1: Backend Dating State

Expected:

```text
Discover returns available cards or a real empty state.
Incoming likes can be locked for non Plus users.
```

Actual:

```text
/dating/discover?limit=10 returned 200 with 1 item.
First card was Пользователь 1111.
/dating/likes?limit=5 returned 403 frendly_plus_required.
/matches returned 200 with 0 items.
```

Backend evidence:

```text
viewer: user-91891ec2-a270-4ff3-b28d-63a5eda246fc
discover first card: user-304f0edb-76db-439c-ae10-5b9a52f76da6, Пользователь 1111, age 31
likes: 403 frendly_plus_required
```

### Step 38.2: Open Dating Through Deep Link And Bottom Nav

Expected:

```text
Discover card appears because backend has one eligible item.
Only incoming likes are Plus locked.
```

Actual:

```text
Opening frendly:///dating showed a Frendly+ gate.
The visible screen said Свидания внутри Frendly+.
Returning through bottom navigation showed the same gate.
No discover card or action row appeared.
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage38-guest-c-dating-plus-gate-despite-discover.jpg
docs/audits/2026-05-11-ios-stage38-guest-c-dating-plus-gate-bottom-nav.jpg
```

### Step 38.3: Cold Relaunch

Steps:

```text
1. Ran stop_app_sim.
2. Ran launch_app_sim.
3. Opened frendly:///dating again.
```

Expected:

```text
Dating UI remains consistent with backend discover.
```

Actual:

```text
After cold relaunch, Dating still showed the Frendly+ gate.
Backend still returned the discover card during the same stage.
```

Runtime log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T16-46-03-500Z_helperpid41337_ownerpid26902_f1aa14e1.log
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage38-guest-c-dating-plus-gate-cold-relaunch.jpg
```

Conclusion:

```text
Filed IOS-QA-023.
Guest C cannot reach dating discover UI even though backend discover has an eligible card.
```

## Stage 38 Final State

Current visible state:

```text
Guest C +72222222222 is logged in.
The app is on Dating Frendly+ gate.
```

## Stage 39: Dating Gate CTA And Trial Unlock Recheck

Checked at:

```text
2026-05-11 23:54 to 23:59 +07
```

Account:

```text
+72222222222 Guest C
```

### Step 39.1: Gate CTA Visibility

Expected:

```text
The Dating gate CTA is visible and tappable.
```

Actual:

```text
Before scrolling, Открыть Frendly+ existed in the accessibility tree with a 0x0 frame.
Tapping by label failed because the element had an invalid frame.
After a vertical scroll, the CTA became visible and tappable.
```

Screenshots:

```text
docs/audits/2026-05-11-ios-stage39-dating-gate-cta-baseline-hidden.jpg
docs/audits/2026-05-11-ios-stage39-dating-gate-cta-visible-after-scroll.jpg
```

### Step 39.2: Trial Activation

Expected:

```text
Paywall opens from the gate CTA.
Trial activation updates backend subscription.
```

Actual:

```text
Paywall opened.
Tapping Попробовать 7 дней бесплатно showed Frendly+ активирован.
Backend subscription changed to trial.
```

Backend evidence:

```text
GET /subscription/me:
plan: year
status: trial
startedAt: 2026-05-11T16:55:46.135Z
renewsAt: 2027-05-11T16:55:46.135Z
trialEndsAt: 2026-05-18T16:55:46.135Z
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage39-dating-gate-paywall-opened.jpg
```

### Step 39.3: Dating After Trial

Expected:

```text
Dating discover unlocks.
Action row stays usable.
```

Actual:

```text
After reopening Dating, discover showed Пользователь 1111.
/dating/discover?limit=10 returned 200 with 1 item.
/dating/likes?limit=5 returned 200 with 0 items.
The action row still stayed under the bottom nav.
```

UI evidence:

```text
Header: Frendly+ · свидания.
Card: Пользователь 1111, 31.
Visible social row: Подписаться · 0 at y=854.
Bottom nav starts at y=806.
Action labels Пропустить, Супер, Лайк and 01 / 01 have 0x0 frames.
```

Screenshot:

```text
docs/audits/2026-05-11-ios-stage39-dating-unlocked-after-trial-action-row-covered.jpg
```

Conclusion:

```text
The gate CTA works only after scroll.
Trial activation works and unlocks Dating discover.
IOS-QA-014 remains reproduced after the unlock.
IOS-QA-023 remains open for the non Plus discover gate mismatch.
Guest C subscription state is now trial on backend.
```

## Stage 39 Final State

Current visible state:

```text
Guest C +72222222222 is logged in.
The app is on Dating discover.
Backend subscription is trial.
The visible card is Пользователь 1111.
```

## Stage 40: Dating Trial Actions And Cold Relaunch Recheck

Checked at:

```text
2026-05-12 00:05 to 00:11 +07
```

Account:

```text
+72222222222 Guest C
```

### Step 40.1: Baseline After Trial

Expected:

```text
Dating remains unlocked after trial.
The discover card and action row are usable.
```

Actual:

```text
Dating showed Пользователь 1111.
Backend subscription stayed trial.
/dating/discover?limit=10 returned 1 item.
/matches returned 0 items.
Action labels Пропустить, Супер, Лайк and 01 / 01 still had 0x0 frames.
```

Screenshot:

```text
docs/audits/2026-05-12-ios-stage40-dating-action-row-baseline.jpg
```

### Step 40.2: Like Action Attempts

Expected:

```text
Tapping Лайк sends a dating action and advances the card.
```

Actual:

```text
Tap by label Лайк failed with invalid frame size.
Coordinate tap at x=322 y=764 succeeded at simulator level but did not change the UI.
Backend still returned 1 discover item and 0 matches.
Scroll-up did not reveal the action row.
```

Screenshots:

```text
docs/audits/2026-05-12-ios-stage40-dating-coordinate-like-no-action.jpg
docs/audits/2026-05-12-ios-stage40-dating-scroll-up-action-row-still-hidden.jpg
```

### Step 40.3: Likes Tab After Trial

Expected:

```text
Likes tab opens without Frendly+ gate.
UI matches backend empty likes.
```

Actual:

```text
Likes tab opened.
UI showed Пока нет входящих лайков.
/dating/likes?limit=5 returned 200 with 0 items and nextCursor null.
```

Screenshot:

```text
docs/audits/2026-05-12-ios-stage40-dating-likes-empty-after-trial.jpg
```

### Step 40.4: Cold Relaunch

Steps:

```text
1. Ran stop_app_sim.
2. Ran launch_app_sim.
3. App opened Home.
4. Tapped bottom nav Дейт.
```

Expected:

```text
Trial state persists.
Dating remains unlocked.
Home date matches 2026-05-12.
```

Actual:

```text
Home opened first and showed Среда · 06 мая.
Backend still returned subscription trial, discover 1 item and likes 0 items.
Opening Dating from bottom nav showed Пользователь 1111.
Action row stayed covered and labels stayed 0x0.
Runtime log only showed known Yandex MapKit invalid API key errors.
```

Runtime log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T17-09-01-449Z_helperpid73917_ownerpid26902_d7ac69b5.log
```

Screenshots:

```text
docs/audits/2026-05-12-ios-stage40-home-after-cold-relaunch-stale-date.jpg
docs/audits/2026-05-12-ios-stage40-dating-after-cold-relaunch-unlocked-action-row-covered.jpg
```

Conclusion:

```text
No new bug filed.
Stage 40 extends IOS-QA-014 with accessibility and no-action evidence.
Stage 40 also reconfirms IOS-QA-017 on 2026-05-12 after cold relaunch.
Dating trial unlock persists after cold relaunch.
Likes tab is unlocked and empty, matching backend.
```

## Stage 40 Final State

Current visible state:

```text
Guest C +72222222222 is logged in.
The app is on Dating discover.
Backend subscription is trial.
The visible card is Пользователь 1111.
```

## Stage 41: Dating Filter After Trial

Checked at:

```text
2026-05-12 00:16 to 00:21 +07
```

Account:

```text
+72222222222 Guest C
```

### Step 41.1: Open Filter

Expected:

```text
Filter opens from the header and controls are accessible.
```

Actual:

```text
The right header control opened the filter sheet.
The header filter control had AXLabel null.
The sheet close icon also had AXLabel null.
Chips such as #кино were exposed as StaticText.
```

Screenshots:

```text
docs/audits/2026-05-12-ios-stage41-dating-filter-baseline.jpg
docs/audits/2026-05-12-ios-stage41-dating-filter-sheet-open.jpg
```

### Step 41.2: Apply Non Matching Interest

Expected:

```text
Applying #кино should hide the current #Кофе card or clearly show no local matches.
```

Actual:

```text
Tapped #кино, then Показать.
UI showed Никого под фильтр.
Backend still returned one discover card, Пользователь 1111, with tags Кофе and Бары.
This matches local filtering behavior.
The selected state was not exposed in the accessibility hierarchy.
```

Backend evidence:

```text
/dating/discover?limit=10 returned 1 item.
first card: Пользователь 1111
tags: Кофе, Бары
```

Screenshots:

```text
docs/audits/2026-05-12-ios-stage41-dating-filter-kinotap-no-visible-state.jpg
docs/audits/2026-05-12-ios-stage41-dating-filter-kino-empty-state.jpg
docs/audits/2026-05-12-ios-stage41-dating-filter-reopen-after-kino.jpg
```

### Step 41.3: Reset Filter

Expected:

```text
Reset clears filters and restores the discover card.
```

Actual:

```text
Tapped Сбросить, then Показать.
The card Пользователь 1111 returned.
Backend still returned the same one card.
Action row remained covered, same as IOS-QA-014.
```

Screenshot:

```text
docs/audits/2026-05-12-ios-stage41-dating-filter-reset-card-restored.jpg
```

Conclusion:

```text
Filed IOS-QA-024.
The filter behavior itself works for local empty and reset.
Accessibility semantics are weak for icon buttons, chips and selected state.
```

## Stage 41 Final State

Current visible state:

```text
Guest C +72222222222 is logged in.
The app is on Dating discover.
Backend subscription is trial.
The visible card is Пользователь 1111.
```

## Stage 42: Dating Profile And Direct Chat Entry

Checked at:

```text
2026-05-12 00:23 to 00:30 +07
```

Account:

```text
+72222222222 Guest C
```

Target:

```text
user-304f0edb-76db-439c-ae10-5b9a52f76da6
Пользователь 1111
```

### Step 42.1: Card And Backend Profile

Expected:

```text
Dating card identity matches backend profile.
```

Actual:

```text
Dating card showed Пользователь 1111, 31, Москва · 4.3 км, tags Кофе and Бары.
Backend /people profile returned displayName Пользователь 1111, age 31, city Moscow, interests Кофе and Бары.
Social state was followers 0, likes 0, superLikes 0, iFollow false, iLike false, iSuper false.
```

Screenshot:

```text
docs/audits/2026-05-12-ios-stage42-dating-profile-baseline.jpg
```

### Step 42.2: Card Body Tap

Expected:

```text
Card body either opens profile or behaves as a clearly non tappable area.
```

Actual:

```text
Coordinate tap on the card body did not navigate.
UI stayed on Dating discover.
```

Screenshot:

```text
docs/audits/2026-05-12-ios-stage42-dating-card-body-tap-no-navigation.jpg
```

### Step 42.3: Public Profile And Cold Relaunch

Expected:

```text
Public profile header and body stay consistent with backend.
```

Actual:

```text
Opened frendly:///user/user-304f0edb-76db-439c-ae10-5b9a52f76da6.
UI showed П1, Пользователь 1111, Пользователь 1111, 31, Moscow.
After stop_app_sim, launch_app_sim and reopening the deep link, UI still showed the same identity.
Backend profile stayed the same.
IOS-QA-012 did not reproduce on this target.
```

Runtime log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T17-18-15-485Z_helperpid89544_ownerpid26902_470b1b77.log
```

Screenshots:

```text
docs/audits/2026-05-12-ios-stage42-dating-profile-user1111-opened.jpg
docs/audits/2026-05-12-ios-stage42-dating-profile-user1111-after-cold-relaunch.jpg
```

### Step 42.4: Write From Profile

Expected:

```text
Написать opens a direct chat with the peer name.
Backend personal chat row matches the peer.
```

Actual:

```text
Tapping Написать opened direct chat cmp1gufto00djpe1zda834izn.
UI header showed Личный чат.
Backend /chats/personal returned peerUserId user-304f0edb-76db-439c-ae10-5b9a52f76da6 and name Пользователь 1111.
No messages were sent.
```

Screenshot:

```text
docs/audits/2026-05-12-ios-stage42-dating-profile-write-opened-direct-chat.jpg
```

Conclusion:

```text
Filed IOS-QA-025.
Public profile stayed consistent with backend before and after cold relaunch.
Direct chat creation worked, but the new chat header lost the peer name.
```

## Stage 42 Final State

Current visible state:

```text
Guest C +72222222222 is logged in.
The app is on direct chat cmp1gufto00djpe1zda834izn.
Backend peer is Пользователь 1111.
UI header is Личный чат.
```

## Stage 43: Personal Chat List After Dating Direct Chat

Checked at:

```text
2026-05-12 00:32 to 00:42 +07
```

Account:

```text
+72222222222 Guest C
```

Target:

```text
chatId cmp1gufto00djpe1zda834izn
peer user-304f0edb-76db-439c-ae10-5b9a52f76da6
Пользователь 1111
```

### Step 43.1: Current Direct Chat And Backend

Expected:

```text
UI chat identity matches backend personal chat row.
```

Actual:

```text
Current direct chat header still showed Личный чат.
Backend /chats/personal returned one row named Пользователь 1111.
Backend messages returned count 0.
This extends IOS-QA-025.
```

Screenshot:

```text
docs/audits/2026-05-12-ios-stage43-direct-chat-generic-header-baseline.jpg
```

### Step 43.2: Back Navigation And Chats Personal Filter

Expected:

```text
Back returns to the chat list or Personal filter shows the new direct chat.
```

Actual:

```text
Back returned to the public profile, not the chat list.
Opening frendly:///chats and tapping Личные showed only Личные чаты появляются после встреч.
Backend /chats/personal still returned one row named Пользователь 1111.
```

Screenshots:

```text
docs/audits/2026-05-12-ios-stage43-direct-chat-back-returned-profile.jpg
docs/audits/2026-05-12-ios-stage43-chats-all-after-direct-chat.jpg
docs/audits/2026-05-12-ios-stage43-chats-personal-filter-empty-despite-backend-row.jpg
```

### Step 43.3: Cold Relaunch Personal Filter

Expected:

```text
Personal filter shows the row and hides empty-state copy.
```

Actual:

```text
After stop_app_sim, launch_app_sim, reopening frendly:///chats and tapping Личные, the row appeared.
The UI hierarchy still rendered П1, Пользователь 1111, Личные чаты появляются после встреч in the same row area.
Backend /chats/personal still returned count 1.
```

Runtime log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T17-28-35-585Z_helperpid4981_ownerpid26902_b42200fa.log
```

Screenshot:

```text
docs/audits/2026-05-12-ios-stage43-chats-personal-filter-after-cold-relaunch-row-with-empty-hint.jpg
```

### Step 43.4: Open Personal Row

Expected:

```text
Opening the row shows the peer name in the chat header.
```

Actual:

```text
Tapped the row.
Direct chat opened with header П1, Пользователь 1111, был недавно.
This path does not reproduce IOS-QA-025.
```

Screenshot:

```text
docs/audits/2026-05-12-ios-stage43-direct-chat-opened-from-personal-filter-peer-header.jpg
```

Conclusion:

```text
Filed IOS-QA-026.
IOS-QA-025 is still valid for profile-created direct chat entry.
Opening the same chat from the Personal filter after cold relaunch uses the correct peer title.
```

## Stage 43 Final State

Current visible state:

```text
Guest C +72222222222 is logged in.
The app is on direct chat cmp1gufto00djpe1zda834izn.
Backend peer is Пользователь 1111.
UI header is Пользователь 1111.
Backend message count is 0.
```

## Stage 44: Direct Chat Date Invite Entry

Checked at:

```text
2026-05-12 00:48 to 00:57 +07
```

Account:

```text
+72222222222 Guest C
```

Target:

```text
chatId cmp1gufto00djpe1zda834izn
peer user-304f0edb-76db-439c-ae10-5b9a52f76da6
Пользователь 1111
```

### Step 44.1: Open Date Invite Card

Expected:

```text
The direct chat date invite card opens a prefilled date meetup draft.
```

Actual:

```text
Tapped Позвать на свидание.
The app opened Create meetup in Свидание mode.
The draft was prefilled as Свидание на двоих, Tilda Bistro, today 02:34, 2 people, личное, я плачу.
```

Screenshots:

```text
docs/audits/2026-05-12-ios-stage44-direct-chat-date-invite-baseline.jpg
docs/audits/2026-05-12-ios-stage44-date-invite-create-prefill.jpg
```

### Step 44.2: Send Invite

Expected:

```text
Отправить инвайт creates the invite or shows a visible validation error.
```

Actual:

```text
Tapped Отправить инвайт.
The CTA disappeared briefly, then returned.
The app stayed on the same draft.
No visible success, validation error, toast or navigation appeared.
Backend direct messages stayed at count 0.
Guest C host dashboard returned no upcoming events and no drafts.
```

Screenshot:

```text
docs/audits/2026-05-12-ios-stage44-date-invite-after-send-stuck-draft.jpg
```

### Step 44.3: Retry

Expected:

```text
A second tap either succeeds or shows a visible error.
```

Actual:

```text
Tapped Отправить инвайт again after the button returned.
The behavior repeated.
Backend messages stayed at count 0.
Guest C host dashboard still returned no upcoming events and no drafts.
Runtime log did not show a clear invite-specific error.
```

Conclusion:

```text
Filed IOS-QA-027.
The date invite entrypoint opens, but the default send flow silently fails.
```

## Stage 44 Final State

Current visible state:

```text
Guest C +72222222222 is logged in.
The app is on Create meetup, mode Свидание.
Draft title is Свидание на двоих.
Backend direct message count is 0.
Guest C host dashboard has no upcoming events and no drafts.
```

## Stage 45: Date Invite Description Recovery

Checked at:

```text
2026-05-12 01:03 to 01:10 +07
```

Account:

```text
+72222222222 Guest C
```

Target:

```text
Create meetup
mode Свидание
draft title Свидание на двоих
```

### Step 45.1: Scroll To Description

Expected:

```text
Description field can be reached above the fixed CTA.
```

Actual:

```text
Several scroll-up gestures moved the form down to the description section.
The description field stayed at the bottom of the viewport and was partly covered by the fixed Отправить инвайт CTA.
Lower sections stayed offscreen.
```

Screenshot:

```text
docs/audits/2026-05-12-ios-stage45-date-invite-description-covered-by-cta.jpg
```

### Step 45.2: Focus And Type

Expected:

```text
The description field receives focus and accepts text.
```

Actual:

```text
Tapping the description field by accessibility label returned success from XcodeBuildMCP.
The field value stayed empty.
type_text with Cyrillic failed because no keycode existed for the first Cyrillic character.
type_text with ASCII returned success, but the field value still stayed empty.
No keyboard or visible focus state appeared.
```

### Step 45.3: Backend Control

Expected:

```text
No event or message is created unless the invite actually sends.
```

Actual:

```text
No extra send was completed.
Backend stayed unchanged.
Direct chat message count stayed 0.
Guest C host dashboard stayed at upcoming 0 and drafts 0.
```

Conclusion:

```text
Filed IOS-QA-028.
This blocks recovery from IOS-QA-027 because the user cannot reliably fill the lower description field.
```

## Stage 45 Final State

Current visible state:

```text
Guest C +72222222222 is logged in.
The app is on Create meetup, mode Свидание.
The description field is partly covered by the fixed Отправить инвайт CTA.
Backend direct message count is 0.
Guest C host dashboard has no upcoming events and no drafts.
```

## Stage 46: Date Invite Exit And Relaunch Cleanup

Checked at:

```text
2026-05-12 01:16 to 01:22 +07
```

Account:

```text
+72222222222 Guest C
```

Target:

```text
direct chat cmp1gufto00djpe1zda834izn
date invite draft Свидание на двоих
```

### Step 46.1: Back From Draft

Expected:

```text
Back returns to the source chat or asks for discard confirmation.
```

Actual:

```text
Tapped the top-left back button from the date invite draft.
The app returned directly to direct chat cmp1gufto00djpe1zda834izn.
No discard confirmation was shown.
Header showed Пользователь 1111.
```

Screenshots:

```text
docs/audits/2026-05-12-ios-stage46-date-invite-draft-before-back.jpg
docs/audits/2026-05-12-ios-stage46-date-invite-back-returned-direct-chat.jpg
```

### Step 46.2: Backend And Cold Relaunch

Expected:

```text
Failed draft leaves no backend side effects.
Cold relaunch does not restore a stale failed draft.
```

Actual:

```text
Backend direct messages stayed at count 0.
Guest C host dashboard stayed at upcoming 0 and drafts 0.
After stop_app_sim and launch_app_sim, the app opened Home, not the failed draft.
Home again showed stale date Среда · 06 мая, same as IOS-QA-017.
```

Runtime log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T17-43-30-459Z_helperpid28710_ownerpid26902_12e963f8.log
```

Screenshot:

```text
docs/audits/2026-05-12-ios-stage46-after-cold-relaunch-home-stale-date.jpg
```

### Step 46.3: Reopen Direct Chat

Expected:

```text
Chats still contains the direct chat row and opens the peer chat.
```

Actual:

```text
Opened frendly:///chats.
All chats showed row П1, Пользователь 1111, дейтинг.
Opening the row showed header П1, Пользователь 1111, был недавно.
```

Screenshots:

```text
docs/audits/2026-05-12-ios-stage46-chats-after-cold-relaunch-direct-row.jpg
docs/audits/2026-05-12-ios-stage46-direct-chat-after-relaunch-row-open.jpg
```

Conclusion:

```text
No new bug filed in Stage 46.
The failed draft did not create backend side effects and did not restore after relaunch.
IOS-QA-017 was reconfirmed.
```

## Stage 46 Final State

Current visible state:

```text
Guest C +72222222222 is logged in.
The app is on direct chat cmp1gufto00djpe1zda834izn.
UI header is Пользователь 1111.
Backend direct message count is 0.
Guest C host dashboard has no upcoming events and no drafts.
```

## Stage 47: Direct Chat Text Send After Failed Invite

Checked at:

```text
2026-05-12 01:46 to 01:52 +07
```

Account:

```text
+72222222222 Guest C
```

Target:

```text
direct chat cmp1gufto00djpe1zda834izn
peer Пользователь 1111
```

### Step 47.1: Baseline

Expected:

```text
UI and backend show the same empty direct chat state before send.
```

Actual:

```text
UI showed direct chat with Пользователь 1111.
Backend /chats/cmp1gufto00djpe1zda834izn/messages returned count 0.
Backend /chats/personal returned one row with empty lastMessage and lastTime.
```

Screenshot:

```text
docs/audits/2026-05-12-ios-stage47-direct-chat-text-baseline.jpg
```

### Step 47.2: Type And Send Text

Expected:

```text
Composer sends the typed message and backend persists it.
```

Actual:

```text
Tapped the composer and typed stage47 direct text.
The field received ыефпу47 вкусе еуче because ASCII input was mapped through Russian layout.
Tapped the send control.
UI showed a local bubble ыефпу47 вкусе куче with timestamp 00:47.
Backend messages stayed count 0 immediately after send and after a short wait.
Backend personal row still had empty lastMessage and lastTime.
```

Screenshots:

```text
docs/audits/2026-05-12-ios-stage47-direct-chat-text-keyboard-mapped.jpg
docs/audits/2026-05-12-ios-stage47-direct-chat-text-sent.jpg
```

### Step 47.3: Chat List And Reopen

Expected:

```text
Chat row shows the latest message and reopening keeps the sent message.
```

Actual:

```text
Tapped back to Chats.
The direct row still showed only П1, Пользователь 1111, дейтинг.
It did not show the sent text.
Opening the same row showed an empty direct chat again.
The optimistic bubble disappeared.
Runtime log had only the known MapKit host processing error, no clear message send error.
```

Screenshots:

```text
docs/audits/2026-05-12-ios-stage47-chats-row-not-updated-after-text.jpg
docs/audits/2026-05-12-ios-stage47-direct-chat-reopen-message-gone.jpg
```

Conclusion:

```text
Filed IOS-QA-029.
IOS-QA-008 also reproduces in the direct chat composer.
```

## Stage 47 Final State

Current visible state:

```text
Guest C +72222222222 is logged in.
The app is on direct chat cmp1gufto00djpe1zda834izn.
UI header is Пользователь 1111.
Backend direct message count is 0.
Backend personal row lastMessage is empty.
```

## Stage 48: Direct Chat Text Send Cold Relaunch Recovery

Checked at:

```text
2026-05-12 00:53 to 00:56 UTC
2026-05-12 07:53 to 07:56 +07
```

Account:

```text
+72222222222 Guest C
```

Target:

```text
direct chat cmp1gufto00djpe1zda834izn
peer Пользователь 1111
```

### Step 48.1: Cold Relaunch And Backend Baseline

Expected:

```text
Chat row state matches backend after cold relaunch.
```

Actual:

```text
Before relaunch, backend messages count was 0 and personal lastMessage was empty.
After stop_app_sim and launch_app_sim, the app opened Home.
Home again showed stale date Среда · 06 мая.
Opened frendly:///chats.
The direct row already showed the old local text ыефпу47 вкусе куче with time 00:53.
Backend then showed messages count 1.
Persisted message id was cmp1i3nee001ppg1ziszjgldr.
```

Runtime log:

```text
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T17-53-54-685Z_helperpid44960_ownerpid26902_c6c55bba.log
```

Screenshot:

```text
docs/audits/2026-05-12-ios-stage48-chats-after-cold-relaunch-stale-local-text.jpg
```

### Step 48.2: Open Direct Chat

Expected:

```text
Thread message history matches backend.
```

Actual:

```text
Opened the direct row.
Header showed П1, Пользователь 1111, был недавно.
Thread showed the old local text ыефпу47 вкусе куче with time 00:53.
Backend /chats/cmp1gufto00djpe1zda834izn/messages returned count 1 with the same text.
```

Screenshot:

```text
docs/audits/2026-05-12-ios-stage48-direct-chat-after-cold-relaunch-stale-local-text.jpg
```

### Step 48.3: Fresh Retry Text

Expected:

```text
Fresh direct text persists without another cold relaunch.
Chat list row updates to the latest message.
```

Actual:

```text
Typed stage48 retry text.
The composer received ыефпу48 кузен еуче because ASCII input was mapped through Russian layout.
After send, UI showed ыефпу48 кузен куче with time 00:54.
After 5 seconds, backend messages count was 2.
Latest backend message id was cmp1i4xfg001spg1zdyw0lgzp.
Backend personal row lastMessage was ыефпу48 кузен куче.
Back on Chats, the direct row also showed ыефпу48 кузен куче.
```

Screenshots:

```text
docs/audits/2026-05-12-ios-stage48-direct-chat-retry-text-keyboard-mapped.jpg
docs/audits/2026-05-12-ios-stage48-direct-chat-retry-text-sent.jpg
docs/audits/2026-05-12-ios-stage48-chats-row-after-retry-text-persisted.jpg
```

Conclusion:

```text
IOS-QA-029 is refined.
The Stage 47 message was not permanently lost.
It stayed local and was delivered from the queue only after cold relaunch.
A fresh Stage 48 message persisted immediately in the same relaunched session.
IOS-QA-008 was reconfirmed in the direct chat composer.
IOS-QA-017 was reconfirmed on Home after cold relaunch.
```

## Stage 48 Final State

Current visible state:

```text
Guest C +72222222222 is logged in.
The app is on Chats.
Direct row Пользователь 1111 shows ыефпу48 кузен куче.
Backend direct message count is 2.
Backend personal row lastMessage is ыефпу48 кузен куче.
```

## Stage 49: Direct Chat Voice Attachment Reload

Checked at:

```text
2026-05-12 00:57 to 01:04 UTC
2026-05-12 07:57 to 08:04 +07
```

Account:

```text
+72222222222 Guest C
```

Target:

```text
direct chat cmp1gufto00djpe1zda834izn
peer Пользователь 1111
```

### Step 49.1: Record And Send Voice

Expected:

```text
Voice send creates a visible voice bubble and a ready backend attachment.
```

Actual:

```text
Opened direct chat from Chats.
Long-pressed the right composer control.
UI entered recording state and showed 0:01, запись.
Tapped the same control to finish.
UI showed a voice bubble with duration 0:10 and timestamp 00:58.
Backend messages count became 3.
New message id was cmp1i9zvu001vpg1z0cdb6bei.
Voice asset id was cmp1i9zim00drpe1zyrgjq3sn.
Attachment was ready, kind chat_voice, mimeType audio/mp4, byteSize 126019, durationMs 10151.
```

Screenshots:

```text
docs/audits/2026-05-12-ios-stage49-direct-chat-voice-baseline.jpg
docs/audits/2026-05-12-ios-stage49-direct-chat-voice-recording.jpg
docs/audits/2026-05-12-ios-stage49-direct-chat-voice-sent.jpg
```

### Step 49.2: Reopen Direct Chat

Expected:

```text
Chat row and reopened thread keep the voice message.
```

Actual:

```text
Tapped back to Chats.
Direct row showed Пользователь 1111, Голосовое сообщение, дейтинг.
Reopened the direct row.
Thread still showed the voice bubble with duration 0:10 and timestamp 00:58.
```

Screenshots:

```text
docs/audits/2026-05-12-ios-stage49-chats-row-after-voice.jpg
docs/audits/2026-05-12-ios-stage49-direct-chat-voice-reopen-ok.jpg
```

### Step 49.3: Cold Relaunch

Expected:

```text
Voice row and voice bubble survive cold relaunch.
Backend media remains downloadable.
```

Actual:

```text
Stopped and launched the app.
Runtime log path:
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T17-59-49-478Z_helperpid55099_ownerpid26902_0ce63ab6.log

App opened Home and again showed stale date Среда · 06 мая.
Opened frendly:///chats.
Direct row showed Пользователь 1111, Голосовое сообщение.
Opened the direct row.
Thread still showed the voice bubble with duration 0:10 and timestamp 00:58.
Backend messages count stayed 3.
Backend personal lastMessage was Голосовое сообщение.
curl -L /media/cmp1i9zim00drpe1zyrgjq3sn returned final HTTP 200, audio/x-m4a, 126019 bytes.
```

Screenshots:

```text
docs/audits/2026-05-12-ios-stage49-chats-row-after-voice-cold-relaunch.jpg
docs/audits/2026-05-12-ios-stage49-direct-chat-voice-cold-relaunch-ok.jpg
```

Conclusion:

```text
No new bug filed in Stage 49.
Direct chat voice attachment survived reopen and cold relaunch.
This did not reproduce the broken placeholder issue seen with photo attachments in IOS-QA-018.
IOS-QA-017 was reconfirmed on Home after cold relaunch.
```

## Stage 49 Final State

Current visible state:

```text
Guest C +72222222222 is logged in.
The app is on direct chat cmp1gufto00djpe1zda834izn.
UI header is Пользователь 1111.
Thread shows two text messages and one voice message.
Backend direct message count is 3.
Backend latest attachment is ready chat_voice cmp1i9zim00drpe1zyrgjq3sn.
Backend personal row lastMessage is Голосовое сообщение.
```

## Stage 50: Direct Chat Incoming Read Control

Checked at:

```text
2026-05-12 01:02 to 01:07 UTC
2026-05-12 08:02 to 08:07 +07
```

Viewer account:

```text
+72222222222 Guest C
```

Sender account:

```text
+71111111111
user-304f0edb-76db-439c-ae10-5b9a52f76da6
Пользователь 1111
```

Target:

```text
direct chat cmp1gufto00djpe1zda834izn
```

### Step 50.1: Baseline

Expected:

```text
Guest C is inside the direct chat and has no unread count before incoming send.
```

Actual:

```text
UI was already on direct chat cmp1gufto00djpe1zda834izn.
Header showed П1, Пользователь 1111, был недавно.
Thread showed two text messages and one voice message.
Backend messages count was 3.
Backend personal row lastMessage was Голосовое сообщение.
Backend personal row unreadCount was null.
```

Screenshot:

```text
docs/audits/2026-05-12-ios-stage50-direct-chat-unread-baseline.jpg
```

### Step 50.2: Incoming Message From Peer

Expected:

```text
Active thread receives the incoming realtime message.
```

Actual:

```text
Used real WebSocket as +71111111111.
Authenticated as user-304f0edb-76db-439c-ae10-5b9a52f76da6.
Sent message.send with text stage50 incoming unread.
Server emitted message.created for cmp1ig586001zpg1z6p66femh.
Active iOS direct chat showed the incoming message from Пользователь 1111 with timestamp 01:03.
```

Screenshot:

```text
docs/audits/2026-05-12-ios-stage50-direct-chat-incoming-visible.jpg
```

### Step 50.3: Unread And Chat Row

Expected:

```text
Visible latest incoming message does not leave unread on the active personal chat.
Chat row shows the latest incoming message.
```

Actual:

```text
After a 5 second wait, backend messages count was 4.
Latest backend message was cmp1ig586001zpg1z6p66femh, text stage50 incoming unread, senderName Пользователь 1111.
Backend personal row lastMessage was stage50 incoming unread.
Backend personal row unreadCount was null.
Tapped back to Chats.
Direct row showed Пользователь 1111, 01:03, stage50 incoming unread, дейтинг.
No unread badge was visible on that row.
```

Screenshot:

```text
docs/audits/2026-05-12-ios-stage50-chats-row-after-incoming.jpg
```

Conclusion:

```text
No new bug filed in Stage 50.
This direct personal chat path did not reproduce IOS-QA-020.
The active visible incoming message stayed in sync with backend and did not leave unread for Guest C.
```

## Stage 50 Final State

Current visible state:

```text
Guest C +72222222222 is logged in.
The app is on Chats.
Direct row Пользователь 1111 shows stage50 incoming unread.
Backend direct message count is 4.
Backend personal row lastMessage is stage50 incoming unread.
Backend personal row unreadCount is null.
```

## Stage 51: Public Profile From Direct Chat

Checked at:

```text
2026-05-12 01:06 to 01:10 UTC
2026-05-12 08:06 to 08:10 +07
```

Account:

```text
+72222222222 Guest C
```

Target user:

```text
user-304f0edb-76db-439c-ae10-5b9a52f76da6
Пользователь 1111
```

### Step 51.1: Message Profile Action

Expected:

```text
Incoming message profile action opens the sender's public profile.
```

Actual:

```text
Opened direct chat cmp1gufto00djpe1zda834izn.
The incoming message from Пользователь 1111 had AX role Button.
AX label was Открыть профиль Пользователь 1111 plus the message text.
Tapped that accessibility label.
The app stayed on the direct chat.
Tapped the avatar area of the same message.
The app stayed on the direct chat.
Filed IOS-QA-030.
```

Evidence:

```text
docs/audits/2026-05-12-ios-stage50-direct-chat-incoming-visible.jpg
```

### Step 51.2: Public Profile Deep Link

Expected:

```text
Public profile header and body show the same user.
UI matches backend /people/:userId summary.
```

Actual:

```text
Opened frendly:///user/user-304f0edb-76db-439c-ae10-5b9a52f76da6.
UI showed П1, Пользователь 1111.
Body showed Пользователь 1111, 31, Moscow.
Social counters were all 0.
Interests were Кофе and Бары.
Backend /people/user-304f0edb-76db-439c-ae10-5b9a52f76da6 returned age 31, city Moscow, intent friendship, interests Кофе and Бары, followers 0, likes 0, superLikes 0.
No header or body mismatch was visible.
```

Screenshot:

```text
docs/audits/2026-05-12-ios-stage51-public-profile-peer-deeplink.jpg
```

### Step 51.3: Cold Relaunch

Expected:

```text
After cold relaunch, the same deep link opens the same consistent public profile.
```

Actual:

```text
Stopped and launched the app.
Runtime log path:
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/com.sergeypolyakov.frendly.dev_2026-05-11T18-07-16-856Z_helperpid67448_ownerpid26902_fcbaa1bb.log

App opened Home and again showed stale date Среда · 06 мая.
Opened the same /user deep link.
UI again showed one consistent public profile for Пользователь 1111.
No IOS-QA-012 mismatch reproduced in this path.
```

Screenshot:

```text
docs/audits/2026-05-12-ios-stage51-public-profile-peer-after-cold-relaunch.jpg
```

Conclusion:

```text
IOS-QA-012 was not reproduced through direct chat peer public profile deep link.
IOS-QA-030 was filed for the no-op incoming message profile action.
IOS-QA-017 was reconfirmed on Home after cold relaunch.
```

## Stage 51 Final State

Current visible state:

```text
Guest C +72222222222 is logged in.
The app is on public profile user-304f0edb-76db-439c-ae10-5b9a52f76da6.
UI shows Пользователь 1111 consistently in header and body.
Backend /people for that user matches the visible age, city, interests and social counters.
```

## 2026-05-12 Task 4 Bugfix Verification

Environment:

```text
iPhone 17 Pro iOS 26.5 E1D49F3C-4690-408C-859C-EAB274D963C7
Bundle id com.sergeypolyakov.frendly.dev
Backend https://api.frendly.tech
Build log /Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/build_run_sim_2026-05-12T04-32-06-874Z_pid18453_4b9ed2ca.log
```

IOS-QA-018
Status: Fixed candidate.
Evidence: opened an existing meetup chat photo after build and relaunch. The image rendered instead of the broken placeholder.
Screenshot: `/var/folders/t6/5k6qxdzs0g9092xrvgt020n80000gn/T/screenshot_optimized_82b6e2a7-cc2c-49e4-bc83-e9d71e10df48.jpg`
Tests: `flutter test test/app/core/device/app_attachment_service_test.dart`, `flutter test test/shared/widgets/bb_chat_attachment_image_test.dart`, `flutter test test/shared/widgets/bb_chat_bubble_test.dart`.

IOS-QA-021
Status: Fixed candidate.
Evidence: backend allow-list already includes `text/plain` and `application/zip`; mobile now maps `.txt` to `text/plain` and `.zip` to `application/zip`.
Tests: `flutter test test/shared/data/backend_repository_test.dart`.
Manual note: iOS Files picker opened from chat, but the simulator had no recent files to select.

IOS-QA-022
Status: Fixed candidate.
Evidence: document body tap now shows `Файл сохранён на устройство` after save.
Tests: `flutter test test/features/parity/detail_chat_and_user_profile_screen_test.dart --name "personal chat tap on document saves it to device"`.

Known test note:

```text
flutter test test/features/parity/detail_chat_and_user_profile_screen_test.dart
```

Still fails in pre-existing meetup and composer cases unrelated to Task 4. The new document tap case passes.

## 2026-05-12 Task 5 Bugfix Verification

Environment:

```text
iPhone 17 Pro iOS 26.4 A195A8F2-DCEB-4B12-9377-8F1D6294F072
Bundle id com.sergeypolyakov.frendly.dev
Backend https://api.frendly.tech
Build log /Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/build_run_sim_2026-05-12T06-29-25-310Z_pid57191_4712e739.log
```

IOS-QA-007
Status: Fixed candidate.
Evidence: created `QA create 1324` from Home FAB with manual address `Brix Pokrovka 12`. Create preview, publish preview and event detail all showed `Сегодня · 15:23`.
Tests: `flutter test test/features/create_meetup/presentation/create_meetup_screen_test.dart`, `flutter test test/shared/data/backend_repository_test.dart`.

IOS-QA-010
Status: Not fixed candidate yet.
Evidence: XcodeBuildMCP exposed an edit prefill shift from `15:23` on event detail to `22:23` in edit mode. Local edit parser was fixed and covered by `edit startsAt parser keeps backend wall clock time`, but production edit save was not reverified after rebuild.
Tests: `flutter test test/features/create_meetup/presentation/create_meetup_screen_test.dart`, `cd backend && pnpm --filter @big-break/api test:unit`.

IOS-QA-009, IOS-QA-016, IOS-QA-027, IOS-QA-028
Status: Existing fixed candidates from earlier Task 5 checks remain in this report. No new conflicting evidence in this run.
