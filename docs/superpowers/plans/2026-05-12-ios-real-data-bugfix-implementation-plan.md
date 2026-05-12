# iOS Real Data Bugfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development, recommended, or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** исправить баги, найденные в iOS real-data QA Stage 0-51, с тестами и real-data проверкой на iPhone 17 Pro simulator.

**Architecture:** работа идет маленькими волнами. Сначала быстрые детерминированные mobile fixes, потом chat media and realtime, потом create meetup flows, потом profile, dating, onboarding. Backend менять только там, где mobile не может корректно выполнить контракт или контракт отсутствует.

**Tech Stack:** Flutter, Riverpod, GoRouter, Dio, WebSocket, NestJS, Prisma, XcodeBuildMCP, real backend `https://api.frendly.tech`.

---

## Prompt For Next Session

Скопируй этот блок в новую сессию:

```text
Продолжай в /Users/sergeypolyakov/MyApp.

Пиши по-русски, коротко, без тире и эмодзи.
Нужно уже не QA, а реализация исправлений.
Не откатывай чужие изменения.
Пиши коммиты на русском.

Дата рабочей QA: 2026-05-11.
Текущая дата среды: 2026-05-12.
Симулятор: iPhone 17 Pro, iOS 26.4, id A195A8F2-DCEB-4B12-9377-8F1D6294F072.
Bundle id: com.sergeypolyakov.frendly.dev.
Backend: https://api.frendly.tech.

Начни строго по AGENTS.md:
1. Открой project_map.md.
2. Открой ai-context/index.md.
3. Запусти ua-query по теме выбранной волны.
4. Используй XcodeBuildMCP для iOS simulator.
5. После любых изменений файлов запусти bash scripts/update-understand-graph.sh.

План реализации:
docs/superpowers/plans/2026-05-12-ios-real-data-bugfix-implementation-plan.md

QA отчет с доказательствами:
docs/audits/2026-05-11-ios-real-data-qa-report.md

Начни с Task 1.
После каждой задачи:
1. Напиши или обнови тест.
2. Запусти точечный тест.
3. Запусти нужную ручную проверку через XcodeBuildMCP, если баг UI or realtime.
4. Обнови план чекбоксами.
5. Обнови QA report строкой Fixed candidate, если симптом ушел.
6. Запусти bash scripts/update-understand-graph.sh.
7. Сделай короткий коммит на русском.

Не пытайся чинить все в одном diff.
Если задача вскрывает backend contract gap, сначала докажи это тестом.
Если правка рискованная, остановись после текущей задачи с точным статусом.
```

---

## Source Of Truth

QA artifacts:

```text
docs/audits/2026-05-11-ios-real-data-qa-report.md
docs/superpowers/plans/2026-05-11-ios-real-data-qa-plan.md
```

Useful accounts:

```text
+70000000000 Host A
+71111111111 Guest B, user-304f0edb-76db-439c-ae10-5b9a52f76da6, Пользователь 1111
+72222222222 Guest C, user-91891ec2-a270-4ff3-b28d-63a5eda246fc
+74444444444 Host E
```

Current latest direct chat:

```text
chatId: cmp1gufto00djpe1zda834izn
viewer: +72222222222 Guest C
peer: +71111111111, Пользователь 1111
latest message: stage50 incoming unread
```

---

## Bug Waves

High priority:

```text
IOS-QA-001 test-login range mismatch.
IOS-QA-002 onboarding local state leaks between accounts.
IOS-QA-007 create meetup time changes after publish.
IOS-QA-010 host event edit save does not persist changes.
IOS-QA-012 public profile header and body can show different users.
```

Chat and realtime:

```text
IOS-QA-011 meetup unread does not clear.
IOS-QA-018 photo attachment broken after reopen.
IOS-QA-019 chat list stale after realtime.
IOS-QA-020 personal unread does not clear.
IOS-QA-021 txt and zip file picker silent no-send.
IOS-QA-022 file attachment download tap no visible result.
IOS-QA-029 direct text stays local until cold relaunch.
IOS-QA-030 incoming direct message profile action no-op.
```

Create meetup and dating:

```text
IOS-QA-009 visibility choice blocked by CTA.
IOS-QA-016 Affiche create prefill shifts time.
IOS-QA-027 date invite send returns to draft.
IOS-QA-028 date invite description covered by CTA.
IOS-QA-013 voice can start while text exists.
IOS-QA-014 dating action row covered by bottom nav.
IOS-QA-023 dating discover can show Plus gate with eligible cards.
IOS-QA-025 direct chat from profile generic title.
IOS-QA-026 personal filter empty while backend has row.
```

Later or environment:

```text
IOS-QA-003, IOS-QA-005, IOS-QA-OBS-001 Yandex key.
IOS-QA-004 city state inconsistency.
IOS-QA-006 own profile social actions.
IOS-QA-008 simulator keyboard layout.
IOS-QA-015 community chat opens before membership.
IOS-QA-017 Home date stale.
IOS-QA-024 weak filter semantics.
IOS-QA-OBS-002 local shortcut flag unset.
```

---

## Files Map

Mobile fast paths:

```text
mobile/lib/features/phone_auth/presentation/phone_auth_screen.dart
mobile/test/features/phone_auth/presentation/phone_auth_screen_test.dart

mobile/lib/features/tonight/presentation/tonight_screen.dart
mobile/test/features/parity/tonight_screen_test.dart

mobile/lib/features/chats/presentation/chat_thread_providers.dart
mobile/lib/features/chats/presentation/chat_thread_screen.dart
mobile/lib/features/personal_chat/presentation/personal_chat_screen.dart
mobile/lib/features/meetup_chat/presentation/meetup_chat_screen.dart
mobile/lib/shared/widgets/bb_chat_bubble.dart
mobile/lib/shared/widgets/bb_chat_attachment_image.dart
mobile/lib/app/core/device/app_attachment_service.dart
mobile/lib/app/core/network/chat_socket_client.dart
mobile/lib/shared/data/app_providers.dart
mobile/test/features/parity/detail_chat_and_user_profile_screen_test.dart
mobile/test/app/core/device/app_attachment_service_test.dart
mobile/test/shared/models/message_test.dart

mobile/lib/features/create_meetup/presentation/create_meetup_screen.dart
mobile/lib/features/create_meetup/presentation/create_meetup_draft.dart
mobile/lib/features/create_meetup/presentation/publish_meetup_screen.dart
mobile/lib/features/create_meetup/presentation/widgets/date_time_sheet.dart
mobile/lib/shared/data/backend_repository.dart

mobile/lib/features/user_profile/presentation/user_profile_screen.dart
mobile/lib/features/dating/presentation/dating_screen.dart
mobile/lib/features/communities/presentation/community_detail_screen.dart
mobile/lib/app/navigation/app_router.dart
```

Backend fast paths:

```text
backend/apps/api/src/controllers/auth.controller.ts
backend/apps/api/src/services/auth.service.ts
backend/apps/api/test/integration/auth.integration.spec.ts

backend/apps/api/src/controllers/chats.controller.ts
backend/apps/api/src/services/chats.service.ts
backend/apps/chat/src/chat-server.service.ts
backend/apps/chat/test/unit/chat-server.service.unit.spec.ts
backend/apps/chat/test/realtime/session.realtime.spec.ts

backend/apps/api/src/controllers/host.controller.ts
backend/apps/api/src/services/host.service.ts
backend/apps/api/src/controllers/events.controller.ts
backend/apps/api/src/services/events.service.ts
backend/apps/api/test/integration/core.integration.spec.ts

backend/apps/api/src/controllers/people.controller.ts
backend/apps/api/src/services/people.service.ts
backend/apps/api/src/services/profile.service.ts
backend/apps/api/src/common/presenters.ts
```

---

## Task 0: Branch And Baseline

**Files:**

```text
Read: project_map.md
Read: ai-context/index.md
Read: docs/audits/2026-05-11-ios-real-data-qa-report.md
Read: this plan file
```

- [x] **Step 0.1: Check worktree**

Run:

```bash
git status --short
```

Expected:

```text
Note unrelated existing changes.
Do not revert them.
```

- [x] **Step 0.2: Create branch**

Run:

```bash
git switch -c ios-real-data-bugfixes-2026-05-12
```

Expected:

```text
New branch is active.
```

- [x] **Step 0.3: Confirm simulator defaults**

Use XcodeBuildMCP:

```text
session_show_defaults
list_sims enabled true
```

Expected:

```text
iPhone 17 Pro A195A8F2-DCEB-4B12-9377-8F1D6294F072 is booted.
Bundle id is com.sergeypolyakov.frendly.dev.
```

---

## Task 1: Fix Deterministic Small Mobile Bugs

**Bugs:**

```text
IOS-QA-001
IOS-QA-017
IOS-QA-030
```

**Files:**

```text
Modify: mobile/lib/features/phone_auth/presentation/phone_auth_screen.dart
Test: mobile/test/features/phone_auth/presentation/phone_auth_screen_test.dart

Modify: mobile/lib/features/tonight/presentation/tonight_screen.dart
Test: mobile/test/features/parity/tonight_screen_test.dart

Modify: mobile/lib/shared/widgets/bb_chat_bubble.dart
Test: mobile/test/features/parity/detail_chat_and_user_profile_screen_test.dart
```

- [x] **Step 1.1: Fix test phone shortcut range**

Implementation target:

```text
Phone auth shortcut numbers must include +70000000000 through +79999999999 repeated-digit seeded accounts.
Do not enable shortcut for arbitrary +7 numbers.
Keep BIG_BREAK_ENABLE_TEST_PHONE_SHORTCUTS guard.
```

Test command:

```bash
cd mobile && flutter test test/features/phone_auth/presentation/phone_auth_screen_test.dart
```

Expected:

```text
Tests cover +70000000000, +71111111111, +79999999999 as shortcut numbers.
Tests cover a non-seeded phone falling back to OTP.
```

- [x] **Step 1.2: Fix Home date label**

Implementation target:

```text
Replace hardcoded _todayHeaderLabel result in tonight_screen.dart.
Use DateTime.now() with Russian weekday and month formatting or a tiny deterministic helper.
The label for 2026-05-12 must not be Среда · 06 мая.
```

Test command:

```bash
cd mobile && flutter test test/features/parity/tonight_screen_test.dart
```

Expected:

```text
Test proves the Home date label is computed from provided current date.
No hardcoded 06 мая remains.
```

- [x] **Step 1.3: Fix incoming message profile tap**

Implementation target:

```text
BbChatBubble must call onAuthorTap or route to public profile when the incoming message exposes Открыть профиль.
Do not make own outgoing messages open own profile unless existing behavior already does this.
```

Test command:

```bash
cd mobile && flutter test test/features/parity/detail_chat_and_user_profile_screen_test.dart
```

Expected:

```text
Widget test taps incoming direct message profile action and verifies /user/<senderId> navigation.
```

- [x] **Step 1.4: Real-data verification**

Use XcodeBuildMCP:

```text
Launch app.
Open frendly:///chats.
Open direct chat cmp1gufto00djpe1zda834izn.
Tap incoming message from Пользователь 1111.
Cold relaunch and inspect Home.
```

Expected:

```text
Message tap opens public profile Пользователь 1111.
Home date matches current real date.
```

- [x] **Step 1.5: Update docs and commit**

Run:

```bash
bash scripts/update-understand-graph.sh
git add mobile/lib/features/phone_auth/presentation/phone_auth_screen.dart mobile/test/features/phone_auth/presentation/phone_auth_screen_test.dart mobile/lib/features/tonight/presentation/tonight_screen.dart mobile/test/features/parity/tonight_screen_test.dart mobile/lib/shared/widgets/bb_chat_bubble.dart mobile/test/features/parity/detail_chat_and_user_profile_screen_test.dart docs/superpowers/plans/2026-05-12-ios-real-data-bugfix-implementation-plan.md .understand-anything
git commit -m "Исправить быстрые iOS QA баги"
```

---

## Task 2: Fix Direct Chat Header And Personal Filter State

**Bugs:**

```text
IOS-QA-025
IOS-QA-026
```

**Files:**

```text
Modify: mobile/lib/features/user_profile/presentation/user_profile_screen.dart
Modify: mobile/lib/features/personal_chat/presentation/personal_chat_screen.dart
Modify: mobile/lib/features/chats/presentation/chats_screen.dart
Modify: mobile/lib/shared/data/app_providers.dart
Test: mobile/test/features/parity/detail_chat_and_user_profile_screen_test.dart
Test: mobile/test/features/parity/people_and_chats_screen_test.dart
```

- [x] **Step 2.1: Preserve peer name after createOrGetDirectChat**

Implementation target:

```text
When profile Write opens a direct chat, pass peer display data or immediately upsert the personal chat summary.
PersonalChatScreen header must use known peer name until provider refresh returns.
Fallback Личный чат is allowed only while no peer name is known.
```

Test command:

```bash
cd mobile && flutter test test/features/parity/detail_chat_and_user_profile_screen_test.dart
```

Expected:

```text
Opening direct chat from Пользователь 1111 profile shows Пользователь 1111, not Личный чат.
```

- [x] **Step 2.2: Fix personal filter empty state**

Implementation target:

```text
Chats Personal filter must render empty state only when the filtered personal chat list is empty.
After createOrGetDirectChat, the in-memory list must include the new row or invalidate and refetch personalChatsProvider.
```

Test command:

```bash
cd mobile && flutter test test/features/parity/people_and_chats_screen_test.dart
```

Expected:

```text
Personal tab with one backend chat shows one row and no empty hint.
```

- [x] **Step 2.3: Real-data verification**

Use XcodeBuildMCP:

```text
Open frendly:///user/user-304f0edb-76db-439c-ae10-5b9a52f76da6.
Tap Написать.
Go back to Chats.
Tap Личные.
```

Expected:

```text
Direct header is Пользователь 1111.
Personal filter shows the row without empty hint.
```

- [x] **Step 2.4: Update graph and commit**

Run:

```bash
bash scripts/update-understand-graph.sh
git add mobile/lib/features/user_profile/presentation/user_profile_screen.dart mobile/lib/features/personal_chat/presentation/personal_chat_screen.dart mobile/lib/features/chats/presentation/chats_screen.dart mobile/lib/shared/data/app_providers.dart mobile/test/features/parity/detail_chat_and_user_profile_screen_test.dart mobile/test/features/parity/people_and_chats_screen_test.dart docs/superpowers/plans/2026-05-12-ios-real-data-bugfix-implementation-plan.md .understand-anything
git commit -m "Исправить состояние личных чатов"
```

---

## Task 3: Fix Chat Delivery, Read State And Realtime Rows

**Bugs:**

```text
IOS-QA-011
IOS-QA-019
IOS-QA-020
IOS-QA-029
```

**Files:**

```text
Modify: mobile/lib/app/core/network/chat_socket_client.dart
Modify: mobile/lib/features/chats/presentation/chat_thread_providers.dart
Modify: mobile/lib/features/personal_chat/presentation/personal_chat_screen.dart
Modify: mobile/lib/features/meetup_chat/presentation/meetup_chat_screen.dart
Modify: mobile/lib/shared/data/app_providers.dart
Test: mobile/test/app/core/network/chat_socket_client_test.dart
Test: mobile/test/features/chats/presentation/chat_thread_providers_test.dart
Test: mobile/test/features/parity/people_and_chats_screen_test.dart
```

- [x] **Step 3.1: Add missing tests for socket outbox flush**

Test target:

```text
sendMessage persists command, connects, then actually sends message.send during the same session.
When message.created with same clientMessageId arrives, persisted command is removed.
```

Run:

```bash
cd mobile && flutter test test/app/core/network/chat_socket_client_test.dart
```

Expected:

```text
Failing test before implementation if current bug still exists.
Passing after fix.
```

- [x] **Step 3.2: Fix direct message immediate delivery**

Implementation target:

```text
After connect/auth completes, pending message.send must flush without requiring app relaunch.
Do not duplicate messages on reconnect.
Keep persisted outbox only until message.created ack removes it.
```

- [x] **Step 3.3: Fix read target for visible latest messages**

Implementation target:

```text
ChatThreadController.markRead must target the latest visible incoming message id, not an old message.
PersonalChatScreen and MeetupChatScreen must call markRead after initial load and after realtime incoming message becomes visible.
If the thread opens away from the latest unread, scroll or mark the latest known unread from REST row.
```

Backend control:

```text
POST /chats/:chatId/read already clears unread when called with latest message id.
```

- [x] **Step 3.4: Fix realtime row previews**

Implementation target:

```text
message.created events must upsert latestMessage, lastTime and unreadCount into meetup and personal chat list state.
Do not wait for cold relaunch.
When active chat marks read, list state must clear unread.
```

- [x] **Step 3.5: Run chat tests**

Run:

```bash
cd mobile && flutter test test/app/core/network/chat_socket_client_test.dart
cd mobile && flutter test test/features/chats/presentation/
cd mobile && flutter test test/features/parity/people_and_chats_screen_test.dart
```

Expected:

```text
Outbox, mark-read, personal rows and meetup rows tests pass.
```

- [x] **Step 3.6: Real-data verification**

Use XcodeBuildMCP plus backend curl:

```text
Direct chat cmp1gufto00djpe1zda834izn.
Send a fresh direct text from Guest C.
Verify backend message count increases within 5 seconds without relaunch.
Send incoming direct message from +71111111111 through WebSocket.
Verify row preview updates and unread clears.
Use a meetup chat with unread to verify latest unread clears.
```

Expected:

```text
IOS-QA-011, 019, 020 and 029 are fixed candidates.
```

Status 2026-05-12:

```text
Verified on iPhone 17 Pro iOS 26.5 E1D49F3C-4690-408C-859C-EAB274D963C7 after installing the new simulator. Built and installed Debug Runner.app with production backend https://api.frendly.tech and placeholder MapKit key for chat-only verification.

Direct send: Guest C sent 444444 in cmp1gufto00djpe1zda834izn. Bubble appeared immediately and backend /chats/personal returned latest 444444 without relaunch.

Realtime row: Host E sent QA realtime unread 2026-05-12T04:15:30Z to cmp10vn8m005npe1z534n9mm6 over production WebSocket. Guest C Chats row updated without relaunch.

Meetup unread: opening the updated meetup row cleared the unread badge in iOS and backend /chats/meetups returned unread 0.

Note: production backend currently does not return lastMessageId yet. The backend contract is implemented locally and pnpm --filter @big-break/api build passes, but deployed backend needs the same change for cold REST rows that have stale history.
```

- [x] **Step 3.7: Update graph and commit**

Run:

```bash
bash scripts/update-understand-graph.sh
git add mobile/lib/app/core/network/chat_socket_client.dart mobile/lib/features/chats/presentation/chat_thread_providers.dart mobile/lib/features/personal_chat/presentation/personal_chat_screen.dart mobile/lib/features/meetup_chat/presentation/meetup_chat_screen.dart mobile/lib/shared/data/app_providers.dart mobile/test/app/core/network/chat_socket_client_test.dart mobile/test/features/chats/presentation mobile/test/features/parity/people_and_chats_screen_test.dart docs/superpowers/plans/2026-05-12-ios-real-data-bugfix-implementation-plan.md .understand-anything
git commit -m "Исправить доставку и прочтение чатов"
```

---

## Task 4: Fix Chat Media And File Attachments

**Bugs:**

```text
IOS-QA-018
IOS-QA-021
IOS-QA-022
```

**Files:**

```text
Modify: mobile/lib/shared/widgets/bb_chat_attachment_image.dart
Modify: mobile/lib/app/core/device/app_attachment_service.dart
Modify: mobile/lib/features/personal_chat/presentation/personal_chat_screen.dart
Modify: mobile/lib/features/meetup_chat/presentation/meetup_chat_screen.dart
Modify: mobile/lib/features/communities/presentation/community_chat_screen.dart
Test: mobile/test/app/core/device/app_attachment_service_test.dart
Test: mobile/test/features/parity/detail_chat_and_user_profile_screen_test.dart
```

- [x] **Step 4.1: Fix private image rendering after reload**

Implementation target:

```text
Image attachments with /media/:id or downloadUrlPath must always resolve through AppAttachmentService.getDownloadUrl before CachedNetworkImage.
If signed URL expires, cache key should stay stable by asset id, but imageUrl must refresh.
Do not rely on raw /media/:id relative URL inside CachedNetworkImage.
```

Test command:

```bash
cd mobile && flutter test test/app/core/device/app_attachment_service_test.dart
```

Expected:

```text
Test proves private image attachment uses /download-url and refreshes expired signed URLs.
```

- [x] **Step 4.2: Fix txt and zip picker silent failures**

Implementation target:

```text
Generic file picker must either upload and send allowed files or show a visible error for disallowed types.
TXT and ZIP should be handled according to backend allow-list.
No silent return to chat.
```

Backend check:

```text
Review backend/apps/api/src/services/uploads.service.ts allowed chat attachment mime types.
If TXT or ZIP are intentionally blocked, mobile must show visible unsupported file message.
If they are intended, update backend validation and tests too.
```

- [x] **Step 4.3: Fix file download tap feedback**

Implementation target:

```text
Download tap must show one of: saved path snackbar, open-file result, or visible error.
Do not leave UI unchanged.
```

- [x] **Step 4.4: Real-data verification**

Use XcodeBuildMCP:

```text
Send a photo in direct chat.
Leave and reopen.
Cold relaunch and reopen.
Try PDF, TXT and ZIP attachments.
Tap download on each allowed file.
```

Expected:

```text
Photo remains visible.
File behavior is either successful or visibly rejected.
Download tap gives visible feedback.
```

Status 2026-05-12:

```text
Verified on iPhone 17 Pro iOS 26.5 E1D49F3C-4690-408C-859C-EAB274D963C7 with production backend https://api.frendly.tech.

Photo reload: opened an existing meetup chat photo after build and relaunch. The image rendered, not the broken placeholder.

TXT and ZIP: backend allow-list already includes text/plain and application/zip. Mobile upload MIME mapping now sends text/plain for .txt and application/zip for .zip, covered by backend_repository_test.dart.

Download feedback: tapping a document body now shows Файл сохранён на устройство, covered by detail_chat_and_user_profile_screen_test.dart.

Manual picker limit: the iOS Files picker opened, but the simulator had no recent files to select. The picker path itself was reachable from the chat plus menu.
```

- [x] **Step 4.5: Update graph and commit**

Run:

```bash
bash scripts/update-understand-graph.sh
git add mobile/lib/shared/widgets/bb_chat_attachment_image.dart mobile/lib/app/core/device/app_attachment_service.dart mobile/lib/features/personal_chat/presentation/personal_chat_screen.dart mobile/lib/features/meetup_chat/presentation/meetup_chat_screen.dart mobile/lib/features/communities/presentation/community_chat_screen.dart mobile/test/app/core/device/app_attachment_service_test.dart mobile/test/features/parity/detail_chat_and_user_profile_screen_test.dart docs/superpowers/plans/2026-05-12-ios-real-data-bugfix-implementation-plan.md .understand-anything
git commit -m "Исправить вложения в чатах"
```

---

## Task 5: Fix Create Meetup, Edit And Date Invite

**Bugs:**

```text
IOS-QA-007
IOS-QA-009
IOS-QA-010
IOS-QA-016
IOS-QA-027
IOS-QA-028
```

**Files:**

```text
Modify: mobile/lib/features/create_meetup/presentation/create_meetup_screen.dart
Modify: mobile/lib/features/create_meetup/presentation/create_meetup_draft.dart
Modify: mobile/lib/features/create_meetup/presentation/publish_meetup_screen.dart
Modify: mobile/lib/features/create_meetup/presentation/widgets/date_time_sheet.dart
Modify: mobile/lib/shared/data/backend_repository.dart
Modify if needed: backend/apps/api/src/controllers/host.controller.ts
Modify if needed: backend/apps/api/src/services/host.service.ts
Test: mobile/test/features/parity/create_meetup_screen_test.dart
Test: mobile/test/shared/data/backend_repository_test.dart
Test if backend changes: backend/apps/api/test/integration/core.integration.spec.ts
```

- [x] **Step 5.1: Fix publish timezone drift**

Implementation target:

```text
Create screen, publish preview, event detail and list must render the same local event time.
Audit startsAt.toUtc().toIso8601String() in BackendRepository.
Confirm backend expects UTC instant or local Moscow time.
Add a test for Moscow 17:00 staying 17:00 in event detail rendering.
```

Status 2026-05-12:

```text
Added RED tests for create event wall-clock serialization, Affiche startsAt prefill from backend timeLabel, and UTC midnight crossing.
Fixed mobile createEvent and evening route session serialization to preserve selected wall-clock time instead of shifting through device timezone.
Fixed AfficheEvent startsAt parsing so create prefill uses backend timeLabel.
Verification:
cd mobile && flutter test test/shared/data/backend_repository_test.dart test/shared/models/affiche_event_test.dart
XcodeBuildMCP on iPhone 17 Pro A195A8F2-DCEB-4B12-9377-8F1D6294F072: create preview showed Сегодня · 13:46, published event detail showed Сегодня · 13:46.
Note: simulator id A195A8F2-DCEB-4B12-9377-8F1D6294F072 is available as iOS 26.4 locally, while iOS 26.5 is booted under E1D49F3C-4690-408C-859C-EAB274D963C7.
```

- [x] **Step 5.2: Implement host edit save**

Implementation target:

```text
Edit mode must call a real repository method.
If backend has no host update endpoint, add one behind host auth check.
Save must persist title, startsAt, place, capacity, description and visibility fields that edit UI exposes.
After save, invalidate eventDetailProvider, hostDashboardProvider, chats if card copies depend on event title.
```

Status 2026-05-12:

```text
Added RED tests for PATCH /host/events/:eventId, BackendRepository.updateHostedEvent and CreateMeetupScreen edit save.
Implemented host-owned meetup update in backend HostController/HostService.
Implemented mobile repository PATCH and edit mode save path with provider invalidation.
Verification:
cd mobile && flutter test test/shared/data/backend_repository_test.dart --name "host event update sends edited fields"
cd mobile && flutter test test/features/create_meetup/presentation/create_meetup_screen_test.dart --name "edit mode saves through repository"
cd backend/apps/api && NODE_OPTIONS=--experimental-vm-modules pnpm exec jest --config jest.config.js --runInBand test/integration/core.integration.spec.ts -t "lets host update owned meetup fields"
Production https://api.frendly.tech still returns Cannot PATCH /host/events/... because the backend change is not deployed yet, so no QA Fixed candidate was added.
```

- [x] **Step 5.3: Fix fixed CTA coverage**

Implementation target:

```text
Create meetup scroll view must have bottom padding at least fixed CTA height plus safe area plus 24.
Fields near bottom must be fully focusable.
Date invite description must accept focus.
Visibility options must be fully tappable.
```

Status 2026-05-12:

```text
Added RED widget coverage for create meetup bottom fields with iPhone 17 Pro safe area.
Moved CreateMeetupScreen fixed bottom CTA out of the Stack overlay and gave the ListView a larger safe-area-aware bottom reserve.
Updated visibility tap test so it verifies По ссылке selection without the CTA stealing the tap.
Verification:
cd mobile && flutter test test/features/create_meetup/presentation/create_meetup_screen_test.dart --name "create meetup (keeps bottom fields above fixed CTA|sends request join mode for invite visibility)"
XcodeBuildMCP on iPhone 17 Pro iOS 26.4 A195A8F2-DCEB-4B12-9377-8F1D6294F072: opened frendly:///create?mode=dating&inviteeUserId=user-304f0edb-76db-439c-ae10-5b9a52f76da6, scrolled to Описание, tapped the text field and type_text inserted abc through the active Russian keyboard layout as фис.
```

- [x] **Step 5.4: Fix date invite send**

Implementation target:

```text
Date invite flow must either create a private dating meetup/invite or show concrete validation errors.
If description is required, show field error and scroll to the field.
If backend endpoint is missing, route through existing POST /events with inviteeUserId and dating mode.
After success, direct chat must get an invite message or navigate to created meetup detail.
```

Status 2026-05-12:

```text
Added RED widget test for dating invite with empty description.
Fixed CreateMeetupScreen dating direct submit to send the same fallback description used by publish drafts instead of an empty string.
Verification:
cd mobile && flutter test test/features/create_meetup/presentation/create_meetup_screen_test.dart --name "date invite uses fallback description"
cd mobile && flutter test test/shared/data/backend_repository_test.dart
XcodeBuildMCP on iPhone 17 Pro iOS 26.4 A195A8F2-DCEB-4B12-9377-8F1D6294F072: opened frendly:///create?mode=dating&inviteeUserId=user-304f0edb-76db-439c-ae10-5b9a52f76da6, tapped Отправить инвайт with empty description, and the app navigated to the created event detail Свидание на двоих.
Note: full create_meetup_screen_test.dart still has older failing cases unrelated to this diff: After Dark segment expectation, hidden geocoding publish call, preset route publish and custom route publish.
```

- [x] **Step 5.5: Run tests**

Run:

```bash
cd mobile && flutter test test/features/parity/create_meetup_screen_test.dart
cd mobile && flutter test test/shared/data/backend_repository_test.dart
cd backend && pnpm --filter @big-break/api test:unit
```

Expected:

```text
Create, publish, edit and date invite tests pass.
```

Status 2026-05-12:

```text
Added RED coverage for edit startsAt wall-clock parsing after XcodeBuildMCP showed a created event detail at Сегодня · 15:23 but edit mode prefilled Сегодня · 22:23.
Fixed CreateMeetupScreen edit prefill to keep backend wall-clock startsAtIso instead of applying device timezone.
Fixed publish submit for manual address and route-backed drafts so it does not wait for fallback device location when no coordinates are known.
Updated After Dark segment expectation to match current V5 Create Meetup UI.
Fixed date-dependent backend unit fixture in partner-offer-code.service.spec.ts by injecting deterministic now.
Verification:
cd mobile && flutter test test/features/create_meetup/presentation/create_meetup_screen_test.dart
cd mobile && flutter test test/shared/data/backend_repository_test.dart
cd backend && pnpm --filter @big-break/api test:unit
```

- [ ] **Step 5.6: Real-data verification**

Use XcodeBuildMCP:

```text
Create meetup with explicit future time.
Publish.
Verify detail and list show same time.
Edit title as host.
Verify backend and detail changed.
Open direct chat date invite.
Send invite or verify visible validation.
Scroll to description and type.
```

Expected:

```text
IOS-QA-007, 009, 010, 016, 027 and 028 are fixed candidates.
```

Status 2026-05-12:

```text
XcodeBuildMCP on iPhone 17 Pro iOS 26.4 A195A8F2-DCEB-4B12-9377-8F1D6294F072.
Build succeeded:
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/build_run_sim_2026-05-12T06-29-25-310Z_pid57191_4712e739.log

Created QA create 1324 from Home FAB with manual address Brix Pokrovka 12.
Create preview showed Сегодня · 15:23.
Publish preview showed Сегодня · 15:23.
Published event detail showed Сегодня · 15:23.

During edit verification, the first build exposed edit prefill shift from 15:23 to 22:23. This was fixed locally and covered by test, but full production edit save was not reverified after rebuild.
Do not mark IOS-QA-010 as fixed candidate from this status alone.

Continuation 2026-05-12:
XcodeBuildMCP initially picked iOS 26.5 because two iPhone 17 Pro simulators were booted. The 26.5 simulator was shut down, session defaults were reset without simulatorName ambiguity, and all later MCP launch, UI snapshot and tap calls used A195A8F2-DCEB-4B12-9377-8F1D6294F072.

Latest build log:
/Users/sergeypolyakov/Library/Developer/XcodeBuildMCP/workspaces/MyApp-b5f9f3b2a498/logs/build_run_sim_2026-05-12T06-36-42-600Z_pid84655_ce9afc59.log

Edit prefill now opens with the same time as event detail. Event detail showed Сегодня · 13:46 and edit mode showed Сегодня · 13:46.

Production backend still returns Cannot PATCH /host/events/ev-9a41831d-a740-4df3-af3c-45dd3079cac8 for Host +72222222222. Local mobile and backend contract tests pass, but production is missing the PATCH endpoint, so IOS-QA-010 stays not fixed candidate.

Verification:
cd mobile && flutter test test/features/create_meetup/presentation/create_meetup_screen_test.dart --name "edit mode saves through repository"
cd mobile && flutter test test/shared/data/backend_repository_test.dart --name "host event update sends edited fields"
cd backend/apps/api && NODE_OPTIONS=--experimental-vm-modules pnpm exec jest --config jest.config.js --runInBand test/integration/core.integration.spec.ts -t "lets host update owned meetup fields"
```

- [ ] **Step 5.7: Update graph and commit**

Run:

```bash
bash scripts/update-understand-graph.sh
git add mobile/lib/features/create_meetup mobile/lib/shared/data/backend_repository.dart mobile/test/features/parity/create_meetup_screen_test.dart mobile/test/shared/data/backend_repository_test.dart backend/apps/api/src/controllers/host.controller.ts backend/apps/api/src/services/host.service.ts backend/apps/api/test/integration/core.integration.spec.ts docs/superpowers/plans/2026-05-12-ios-real-data-bugfix-implementation-plan.md .understand-anything
git commit -m "Исправить создание и редактирование встреч"
```

---

## Task 6: Fix Onboarding And Session State Leakage

**Bugs:**

```text
IOS-QA-002
IOS-QA-003
IOS-QA-004
```

**Files:**

```text
Modify: mobile/lib/features/onboarding/presentation/onboarding_screen.dart
Modify: mobile/lib/app/session/app_session_controller.dart
Modify: mobile/lib/shared/data/app_providers.dart
Modify: mobile/lib/shared/data/location_override_provider.dart
Test: mobile/test/app/session/app_session_controller_test.dart
Test: mobile/test/features/onboarding/presentation/onboarding_screen_test.dart
```

- [ ] **Step 6.1: Clear onboarding local controllers on account switch**

Implementation target:

```text
When currentUserId changes, onboarding screen controllers must rehydrate only from that user's onboarding data.
No previous email, phone, city or area survives logout plus relogin.
Session runtime cleanup must invalidate onboarding providers and local draft state.
```

- [ ] **Step 6.2: Fix city and geolocation state consistency**

Implementation target:

```text
Manual city, area and coordinates should have one source of truth.
If MapKit key is invalid, show a visible fallback and allow manual city save.
Do not block onboarding on failed Yandex map calls.
```

- [ ] **Step 6.3: Run tests and real-data check**

Run:

```bash
cd mobile && flutter test test/app/session/app_session_controller_test.dart
cd mobile && flutter test test/features/onboarding/presentation/onboarding_screen_test.dart
```

Manual:

```text
Login +70000000000, enter email.
Logout.
Login +72222222222.
Verify email field is empty or Guest C only.
Verify manual city can be saved with invalid Yandex key.
```

- [ ] **Step 6.4: Update graph and commit**

Run:

```bash
bash scripts/update-understand-graph.sh
git add mobile/lib/features/onboarding/presentation/onboarding_screen.dart mobile/lib/app/session/app_session_controller.dart mobile/lib/shared/data/app_providers.dart mobile/lib/shared/data/location_override_provider.dart mobile/test/app/session/app_session_controller_test.dart mobile/test/features/onboarding/presentation/onboarding_screen_test.dart docs/superpowers/plans/2026-05-12-ios-real-data-bugfix-implementation-plan.md .understand-anything
git commit -m "Исправить состояние онбординга"
```

---

## Task 7: Fix Profile, Dating And Community Guards

**Bugs:**

```text
IOS-QA-006
IOS-QA-012
IOS-QA-013
IOS-QA-014
IOS-QA-015
IOS-QA-023
IOS-QA-024
```

**Files:**

```text
Modify: mobile/lib/features/profile/presentation/profile_screen.dart
Modify: mobile/lib/features/user_profile/presentation/user_profile_screen.dart
Modify: mobile/lib/features/dating/presentation/dating_screen.dart
Modify: mobile/lib/features/communities/presentation/community_detail_screen.dart
Modify: mobile/lib/shared/widgets/bb_social_actions.dart
Test: mobile/test/features/parity/notifications_and_profile_screen_test.dart
Test: mobile/test/features/parity/detail_chat_and_user_profile_screen_test.dart
Test: mobile/test/features/parity/people_and_chats_screen_test.dart
```

- [ ] **Step 7.1: Own profile must not show self social actions**

Expected behavior:

```text
/profile hides follow, like and super-like actions for current user.
Public /user/:id keeps actions only when id != currentUserId.
```

- [ ] **Step 7.2: Fix public profile stale body**

Expected behavior:

```text
Header, body and social provider must be keyed by the same userId.
Changing /user/:userId route must reset any previous body snapshot before new data is shown.
Follow action must persist through /people/:userId/follow.
```

- [ ] **Step 7.3: Fix dating gate and controls**

Expected behavior:

```text
Discover tab must show available backend cards when subscription allows it.
Plus gate only appears for incoming likes or explicit premium actions.
Bottom action row must clear bottom nav on iPhone 17 Pro.
Filter controls must expose labels and selected states.
Composer voice button in direct chat must not start recording while text exists.
```

- [ ] **Step 7.4: Fix community chat membership guard**

Expected behavior:

```text
Private or member-only community chat cannot open before backend membership is active.
Show join or request state instead of chat.
```

- [ ] **Step 7.5: Run tests and real-data check**

Run:

```bash
cd mobile && flutter test test/features/parity/notifications_and_profile_screen_test.dart
cd mobile && flutter test test/features/parity/detail_chat_and_user_profile_screen_test.dart
cd mobile && flutter test test/features/parity/people_and_chats_screen_test.dart
```

Manual:

```text
Open own profile.
Open public profile for Host A and Пользователь 1111.
Open Dating discover as Guest C.
Open community detail before and after join.
```

- [ ] **Step 7.6: Update graph and commit**

Run:

```bash
bash scripts/update-understand-graph.sh
git add mobile/lib/features/profile/presentation/profile_screen.dart mobile/lib/features/user_profile/presentation/user_profile_screen.dart mobile/lib/features/dating/presentation/dating_screen.dart mobile/lib/features/communities/presentation/community_detail_screen.dart mobile/lib/shared/widgets/bb_social_actions.dart mobile/test/features/parity/notifications_and_profile_screen_test.dart mobile/test/features/parity/detail_chat_and_user_profile_screen_test.dart mobile/test/features/parity/people_and_chats_screen_test.dart docs/superpowers/plans/2026-05-12-ios-real-data-bugfix-implementation-plan.md .understand-anything
git commit -m "Исправить профиль дейтинг и клубы"
```

---

## Task 8: Final Verification Pass

**Files:**

```text
Update: docs/audits/2026-05-11-ios-real-data-qa-report.md
Update: docs/superpowers/plans/2026-05-12-ios-real-data-bugfix-implementation-plan.md
Maybe update: ai-context/frontend-flutter.md
Maybe update: ai-context/realtime-chat.md
Maybe update: ai-context/auth.md
```

- [ ] **Step 8.1: Run automated checks**

Run:

```bash
cd mobile && flutter analyze
cd mobile && flutter test
cd backend && pnpm --filter @big-break/api test:unit
cd backend && pnpm --filter @big-break/api build
bash scripts/update-understand-graph.sh
node scripts/ua-query.test.mjs
```

Expected:

```text
No failures.
If a full suite is too slow, record exact partial commands and why.
```

- [ ] **Step 8.2: Run real-data smoke**

Use XcodeBuildMCP:

```text
Login or keep Guest C.
Home date.
Chats all, meeting, dating, personal filters.
Direct text send.
Direct photo send, reopen, cold relaunch.
Direct incoming read clear.
Profile deep link.
Create meetup publish time.
Host edit save.
Date invite flow.
Logout and relogin.
```

Expected:

```text
Each fixed bug has one fresh screenshot or backend proof.
```

- [ ] **Step 8.3: Update report**

Add a section:

```text
## 2026-05-12 Bugfix Verification
```

For each bug:

```text
IOS-QA-XXX
Status: fixed candidate, not fixed, or deferred.
Evidence: test command plus screenshot or backend check.
Commit: short hash.
```

- [ ] **Step 8.4: Final commit**

Run:

```bash
bash scripts/update-understand-graph.sh
git status --short
git add docs/audits/2026-05-11-ios-real-data-qa-report.md docs/superpowers/plans/2026-05-12-ios-real-data-bugfix-implementation-plan.md ai-context .understand-anything
git commit -m "Обновить отчет по исправлениям iOS QA"
```

Expected:

```text
All implementation commits are present.
Report and plan match actual verification.
```

---

## Stop Conditions

- [ ] Stop if a backend API contract is missing and adding it affects more than one feature.
- [ ] Stop if real backend data conflicts with local assumptions.
- [ ] Stop if XcodeBuildMCP simulator is not `A195A8F2-DCEB-4B12-9377-8F1D6294F072`.
- [ ] Stop if tests fail outside touched areas and the failure is not understood.
- [ ] Stop before large refactor that is not required for the current bug wave.

---

## Self Review Checklist

- [ ] Every high bug has a task.
- [ ] Every chat media or unread bug has a task.
- [ ] Every task has files, tests and real-data verification.
- [ ] Plan avoids broad refactor.
- [ ] Plan includes graph update after file changes.
- [ ] Plan tells the next session to commit in Russian.
