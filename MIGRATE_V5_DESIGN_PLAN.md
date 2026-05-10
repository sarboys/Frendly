# V5 Design Migration Plan

Источник дизайна: `front/src/pages/v5`.

Цель: перенести UI во Flutter близко к TSX, сохранить текущие API, модели и рабочие сценарии.

## Правила

- Backend API не меняем.
- Бизнес-логику не переписываем без нужды.
- Production экраны не получают моковые данные.
- Общие стили держим в `mobile/lib/shared/widgets/bb_v5_ui.dart` и `mobile/lib/app/theme/*`.
- Новые экраны читают существующие Riverpod providers и `BackendRepository`.

## Screen Mapping

- [x] `Notifications.tsx` -> `mobile/lib/features/notifications/presentation/notifications_screen.dart`
  - Flutter route: `AppRoute.notifications`, path `/notifications`.
  - Data/state: `notificationsProvider`, `notificationsLocalStateProvider`, `notificationUnreadCountProvider`, `notificationUnreadCountOverrideProvider`.
  - API: `fetchNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `acceptInvite`, `declineInvite`.
  - UI mapping: V5 top bar, tabs `Все / Приглашения / Чаты`, groups `Сегодня / Раньше`, unread dot, inline invite actions.
  - Comment: done. Экран переведён на V5 scaffold, добавлены tabs, группы, unread dot и inline actions на реальных notification providers.

- [x] `Verification.tsx` -> `mobile/lib/features/verification/presentation/verification_screen.dart`
  - Flutter route: `AppRoute.verification`, path `/verification`.
  - Data/state: `verificationProvider`, local `_submitting`.
  - API: `fetchVerification`, `submitVerificationStep`.
  - UI mapping: trust hero, 3 steps, privacy card, premium-check card, fixed bottom CTA.
  - Comment: done. UI перенесён на V5 cards и fixed CTA, отправка шагов осталась через `submitVerificationStep`.

- [x] `Sos.tsx` -> `mobile/lib/features/safety/presentation/safety_hub_screen.dart`
  - Flutter routes: keep `AppRoute.safetyHub`, add V5 entry path `/sos`.
  - Data/state: `safetyHubProvider`, `settingsProvider`, local hold progress and `_saving`.
  - API: `fetchSafetyHub`, `createSos`, `createTrustedContact`, `deleteTrustedContact`, `updateSafety`, `fetchBlocks`, `fetchReports`.
  - UI mapping: hold-to-trigger SOS, quick actions, trusted contacts, hotlines, privacy note, existing safety settings lower on page.
  - Comment: done. Добавлен hold-to-trigger, quick actions, hotlines и V5 trusted contacts, старые safety settings и API сохранены.

- [x] `PublishMeetup.tsx` -> `mobile/lib/features/create_meetup/presentation/publish_meetup_screen.dart`
  - Flutter route: add `AppRoute.publishMeetup`, path `/publish`.
  - Data/state: new create meetup draft provider, `tokenWalletProvider`.
  - API: final publish still calls `BackendRepository.createEvent`.
  - UI mapping: preview card, visibility choice, promo choice `0 / 50 / 150`, wallet balance, terms checkbox, fixed publish CTA.
  - Comment: done. Добавлен draft provider, preview screen, visibility, promo за токены и финальный вызов существующего `createEvent`.

- [x] `RouteForm.tsx` -> `mobile/lib/features/evening_routes/presentation/route_form_screen.dart`
  - Flutter route: add `AppRoute.newEveningRoute`, path `/routes/new`.
  - Data/state: local form state, local created route storage if backend has no route-create endpoint.
  - API: no backend API change.
  - UI mapping: title, mood chips, duration chips, 2-6 route steps, icon cycling, save CTA.
  - Comment: done. Добавлен экран `/routes/new` с 2-6 шагами и локальным сохранением пользовательских маршрутов без нового backend API.

- [x] `HomeV5.tsx` header entry points -> `mobile/lib/features/tonight/presentation/tonight_screen.dart`
  - Flutter source: `_TonightHeader`.
  - Data/state: `notificationUnreadCountProvider`, existing location providers.
  - UI mapping: Bell with unread dot opens notifications, red SOS pill opens `/sos`, search and AI stay as is.
  - Comment: done. Header получил Bell с unread dot и красный SOS entry point.

- [x] `Profile.tsx` quick actions -> `mobile/lib/features/profile/presentation/profile_screen.dart`
  - Flutter source: `_ProfileContent`.
  - Data/state: `profileProvider`, `notificationUnreadCountProvider`.
  - UI mapping: `Верификация`, `Кнопка SOS`, `Уведомления` row with unread badge.
  - Comment: done. Добавлены V5 cards для верификации, SOS и строка уведомлений с реальным unread count.

- [x] `CreateMeetup.tsx` entry points -> `mobile/lib/features/create_meetup/presentation/create_meetup_screen.dart`
  - Flutter source: `_buildV5BottomCta`, route picker.
  - Data/state: current create meetup state, new draft provider.
  - UI mapping: normal meetup CTA becomes `Дальше · превью`; route picker gets `Создать свой маршрут`.
  - Comment: done. Normal meetup CTA ведёт на preview publish, route picker получил CTA `Создать свой маршрут`.

## Component Mapping

- [x] `C` tokens from `_tokens.ts` -> `BbV5Colors` and `AppColors`.
  - Comment: done. `BbV5Colors` уже совпадал с TSX, `AppColors.lightTheme` выровнен под V5 paper palette.

- [x] `BG_WASH` -> `BbV5WarmBackground`.
  - Comment: done. Новые экраны используют `BbV5Scaffold`.

- [x] `cardBase` -> `BbV5Card`.
  - Comment: done. Preview, notification groups, SOS, profile actions и route form используют shared card.

- [x] `pillIcon`, `pillIconDark`, `Pill` -> `BbV5IconButton`, `BbV5PillButton`.
  - Comment: done. CTA и header actions вынесены в shared V5 buttons.

- [x] `Chip` -> `BbV5Chip`.
  - Comment: done. Route form mood and duration controls use V5 chips.

- [x] `Kicker`, `HeroTitle`, `TopBar` -> `BbV5Kicker`, `BbV5HeroTitle`, `BbV5TopBar`.
  - Comment: done. New screens use shared V5 typography and top bar.

- [x] Fixed bottom CTA gradient -> new shared V5 fixed bottom bar helper.
  - Comment: done. Added `BbV5FixedBottomBar`.

- [x] Bottom sheet shell in TSX picker -> new shared V5 bottom sheet helper.
  - Comment: done. Added `BbV5BottomSheet` for shared V5 bottom sheet styling.

## Props And State Mapping

- [x] Notification `kind`, `unread`, `to`, `actions` -> `NotificationItem.kind`, `readAt`, `payload`, invite API actions.
  - Comment: done. Filtering and navigation derive from real payload.

- [x] Verification `done` local flags -> `VerificationStateData.selfieDone`, `documentDone`, `status`.
  - Comment: done. CTA picks next step from backend state.

- [x] SOS `hold`, `active`, trusted contacts -> local hold progress, `SafetyHubData.trustedContacts`, `createSos`.
  - Comment: done. Hold completion calls existing SOS endpoint.

- [x] Publish `vis`, `promo`, `terms`, `balance` -> create meetup draft visibility, local selected promo, local terms, `tokenWalletProvider`.
  - Comment: done. Promo spends local tokens after event creation.

- [x] Route form `title`, `mood`, `duration`, `steps` -> local route form state and reusable create route payload.
  - Comment: done. Saved locally through `customEveningRoutesProvider`.

## Verification

- [x] Add or update focused Flutter tests for notifications, safety, create meetup publish flow, route picker and route form.
- [x] Run targeted Flutter tests.
- [x] Run `cd mobile && flutter analyze`.
- [x] Run `bash scripts/update-understand-graph.sh`.
  - Comment: done. Graph updated successfully, 606 files analyzed, 0 warnings.
