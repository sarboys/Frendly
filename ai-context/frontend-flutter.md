# Frontend Flutter Map

## Быстрый выбор файла

- Новый экран или route: `mobile/lib/app/navigation/app_routes.dart`, `mobile/lib/app/navigation/app_router.dart`, потом `mobile/lib/features/<feature>/presentation/`.
- Данные из API: `mobile/lib/shared/data/backend_repository.dart`, потом `mobile/lib/shared/data/app_providers.dart`.
- Чаты: `features/chats/presentation/`, `features/meetup_chat/presentation/`, `features/personal_chat/presentation/`.
- Frendly Evening: `features/evening_plan/presentation/`, `shared/models/meetup_chat.dart`.
- Создание встречи: `features/create_meetup/presentation/create_meetup_screen.dart`.
- Карта: `features/map/presentation/map_screen.dart`, `app/core/device/app_location_service.dart`, `app/core/maps/yandex_map_service.dart`.
- Медиа и картинки: shared widgets, `app/core/device/app_attachment_service.dart`, не локальные raw image пути.
- Дизайн: `app/theme/`, `shared/widgets/`, и React эталон в `front/src/components/bigbreak/`.

## Root

- App path: `mobile/`.
- Entry point: `mobile/lib/main.dart`.
- Root widget: `mobile/lib/app/app.dart`.
- Router: `mobile/lib/app/navigation/app_router.dart`.
- Route enum and helpers: `mobile/lib/app/navigation/app_routes.dart`.
- Shell: `mobile/lib/app/navigation/app_shell.dart`.
- Theme: `mobile/lib/app/theme/`.
- Core providers: `mobile/lib/app/core/providers/core_providers.dart`.
- Backend repository: `mobile/lib/shared/data/backend_repository.dart`.
- Shared providers: `mobile/lib/shared/data/app_providers.dart`.

## Dependencies

- Flutter SDK, Dart `>=3.5.0 <4.0.0`.
- State: `flutter_riverpod`.
- Navigation: `go_router`.
- HTTP: `dio`.
- WebSocket: `web_socket_channel`.
- Auth storage: `flutter_secure_storage`, `shared_preferences`.
- Images: `cached_network_image`, `flutter_cache_manager`.
- Voice: `record`, `just_audio`.
- Files: `file_picker`, `image_picker`, `file_saver`, `open_filex`.
- Location and maps: `geolocator`, `yandex_mapkit`.
- Permissions: `permission_handler`.
- Icons: `flutter_lucide`.
- Social auth: `google_sign_in` plus native Yandex LoginSDK bridge through MethodChannel.

## Structure

```text
mobile/lib/
  main.dart
  app/
    app.dart
    core/
      config/
      device/
      maps/
      network/
      providers/
    navigation/
    session/
    theme/
  features/
    <feature>/
      presentation/
      data/
      domain/
  shared/
    data/
    models/
    utils/
    widgets/
```

Большая часть features сейчас presentation-first. Не добавлять domain/application слой без реальной бизнес-логики.

## Routes

First run:

- `/splash`
- `/welcome`
- `/phone-auth`
- `/telegram-auth`
- `/permissions`
- `/add-photo`
- `/onboarding`

Shell tabs:

- `/tonight`
- `/chats`
- `/communities`
- `/dating`
- `/profile`

Discovery and events:

- `/search`
  - optional query `preset=evenings|nearby` opens Search with ready filters, preset header and immediate results.
- `/map`
- `/posters`
- `/poster/:posterId`
- `/event/:eventId`
- `/create`
- `/join-request/:eventId`
- `/check-in/:eventId`
- `/live/:eventId`
- `/after-party/:eventId`
- `/stories/:eventId`
- `/share/:eventId`
  - builds a production public share link through `POST /shares`;
  - opens Telegram share URL or Instagram Stories through native `app.social.share`;
  - Instagram Stories uses Facebook App ID from `BIG_BREAK_FACEBOOK_APP_ID`, default `955838486813478`.
- `/evening-share/:sessionId`
  - builds a public share link through `POST /shares` with `targetType=evening_session`;
  - opens Telegram share URL or Instagram Stories through native `app.social.share`.

Chat:

- `/meetup/:chatId`
- `/personal/:chatId`
- `/community/:communityId/chat`
- `/chat-location`

Profile, people, settings:

- `/user/:userId`
- `/edit-profile`
- `/settings`
- `/verification`
- `/safety`
- `/report/:userId`

Premium, dating, after dark:

- `/paywall`
- `/match/:userId`
- `/after-dark`
- `/after-dark/paywall`
- `/after-dark/event/:eventId`
- `/after-dark/verify`

Frendly Evening:

- `/routes`
- `/routes/:templateId`
- `/routes/:templateId/create`
- `/evening-builder`
- `/evening-plan/:routeId`
- `/evening-edit/:routeId`
- `/evening-preview/:sessionId`
- `/evening-share/:sessionId`
- `/evening-live/:routeId`
- `/evening-after-party/:routeId`

Communities:

- `/community/create`
- `/community/:communityId`
- `/community/:communityId/post/create`
- `/community/:communityId/media`

Host:

- `/host`
- `/host/event/:eventId`

## Router behavior

- Router builder: `buildAppRouter`.
- `initialLocation`: `/splash`.
- Guest outside public routes goes to `/welcome`.
- Authenticated user on public route goes to `/tonight`.
- Authenticated user with incomplete onboarding goes to `/onboarding`.
- Bottom shell uses `ShellRoute` and `AppShell`.
- Push screens use custom slide page plus edge back swipe.

## Feature index

- First run:
  - `splash`, `welcome`, `phone_auth`, `telegram_auth`, `permissions`, `add_photo`, `onboarding`.
  - Auth state in `app/core/providers/core_providers.dart`.
  - Welcome uses equal icon buttons for Google, Yandex and Telegram.
  - Google/Yandex logic lives in `features/welcome/application/social_auth_controller.dart`.
  - Google gets `idToken` through `google_sign_in` and exchanges it at `/auth/google/verify`.
  - Yandex calls native LoginSDK through `app.yandex.auth`, receives OAuth token, and exchanges it at `/auth/yandex/verify`.
  - Android Yandex bridge lives in `android/app/src/main/kotlin/com/example/big_break_mobile/MainActivity.kt`.
  - iOS Yandex bridge lives in `ios/Runner/AppDelegate.swift` and `ios/Runner/SceneDelegate.swift`.
  - Shared phone input lives in `shared/widgets/bb_phone_number_field.dart` and is reused by phone auth plus onboarding phone contact step.
  - Onboarding can insert a first contact step from backend `requiredContact`: email for phone/Telegram sessions, phone for Google/Yandex sessions.
- Tonight:
  - `features/tonight/presentation/tonight_screen.dart`.
  - Entry for Evening hero, limited discovery sections and published Evening sessions.
  - Search and filters live on `SearchScreen`; Tonight opens `/search` or `/search?preset=...` from section headers.
  - Nearby event cards read `eventsProvider('nearby')`; that provider sends current user coordinates to `/events` when location is available, so `event.distance` is calculated from the user.
- Discovery:
  - `search`, `map`, `posters`, `event_detail`.
  - Providers mostly in `shared/data/app_providers.dart` plus search-specific providers.
  - Search includes published Evening sessions as a separate results block and supports `evenings` and `nearby` presets.
- Create meetup:
  - `features/create_meetup/presentation/create_meetup_screen.dart`.
  - Sheets: `date_time_sheet.dart`, `place_sheet.dart`, `poster_picker_sheet.dart`, `partner_picker_sheet.dart`.
  - Modes: meetup, dating, afterdark.
- Event lifecycle:
  - `join_request`, `check_in`, `live_meetup`, `after_party`, `stories`, `share_card`.
  - Backend repository calls: join, leave, check-in, live, feedback, stories, public share link creation.
  - Share card files: `features/share_card/presentation/share_card_screen.dart`, `shared/models/public_share.dart`, `app/core/device/social_share_service.dart`.
- Chats:
  - Chat hub: `features/chats/presentation/chats_screen.dart`.
  - Meetup list groups by `MeetupPhase`: live cards first, soon cards with launch CTA, upcoming section always visible when non-empty, done chats under archive.
  - Thread state: `features/chats/presentation/chat_thread_providers.dart`.
  - Generic thread UI: `features/chats/presentation/chat_thread_screen.dart`.
  - Meetup chat wrapper: `features/meetup_chat/presentation/meetup_chat_screen.dart`.
  - Personal chat wrapper: `features/personal_chat/presentation/personal_chat_screen.dart`.
- Communities:
  - `features/communities/domain/community.dart`.
  - `features/communities/presentation/community_providers.dart`.
  - Screens for list, detail, chat, media, create, create post.
- Dating:
  - `features/dating/presentation/dating_screen.dart`.
  - `features/dating/presentation/dating_providers.dart`.
  - Model: `shared/models/dating_profile.dart`.
- After Dark:
  - `features/after_dark/presentation/`.
  - Style helper: `after_dark_style.dart`.
- Profile and settings:
  - `profile`, `edit_profile`, `settings`, `verification`.
- Safety:
  - `safety_hub`, `report`.

## State management

- Global state uses Riverpod.
- API services:
  - `apiClientProvider`.
  - `backendRepositoryProvider`.
  - `chatSocketClientProvider`.
- Auth:
  - `authTokensProvider`.
  - `AuthTokensController`.
  - `currentUserIdProvider`.
  - `authBootstrapProvider`.
- Main data providers:
  - profile, onboarding, events, posters, settings, safety, subscription.
  - meetup chats, personal chats, notifications, unread badges.
  - evening sessions and evening session detail.
- Local optimistic state:
  - `meetupChatsLocalStateProvider`.
  - `personalChatsLocalStateProvider`.
  - `notificationsLocalStateProvider`.
  - profile photo draft providers.

## Network layer

- `ApiClient` wraps Dio.
- Base URL from `BackendConfig.apiBaseUrl`.
- Access token is added before requests.
- On 401, client calls refresh once, then retries.
- `BackendRepository` maps REST endpoints to typed models.

Important repository areas:

- auth: dev login, phone, Telegram, logout.
- profile and onboarding.
- events, posters, people, dating.
- matches: `BackendRepository.fetchMatches` reads the paginated backend shape from `/matches` and maps `items` to `MatchData`.
- chats: meetup list, personal list, messages, read.
- evening: publish route, list sessions, session detail, join/request, approve/reject request, start/finish session, check-in, advance/skip step, after-party feedback/photo, legacy route finish.
- media: uploads, chat attachments, voice.
- safety, settings, subscription, after dark.

## Realtime layer

- Client: `mobile/lib/app/core/network/chat_socket_client.dart`.
- URL from `BackendConfig.chatWsUrl`.
- Thread controller: `features/chats/presentation/chat_thread_providers.dart`.
- App-level sync coordinator: `chatRealtimeSyncProvider` in `shared/data/app_providers.dart`.
- It subscribes to all known meetup and personal chat ids.
- It patches local chat summaries on:
  - `message.created`
  - `typing.changed`
  - `unread.updated`
  - `notification.created`
- It handles `chat.updated` for Evening phase changes:
  - patches local meetup chat phase, current step, total steps, current place and end time when fields are present.
  - invalidates Evening session list and concrete session detail when `sessionId` is present.
- If realtime or an open chat thread receives a message or phase event for a chat missing from the local cached lists, Flutter clears stale local chat-list overrides before invalidating providers, so the next fetch can include the new meetup chat.
- Full thread loads recent messages through REST first, then subscribes and requests sync.
- Chat message payload can include `kind: system`; Flutter maps it to `Message.isSystem` and renders it as a centered muted pill instead of a user bubble.
- For Evening late-join system messages, `Message.fromJson` rewrites only the joining user's own `:join:` message to “Ты присоединился · шаг N/M”; other users keep the backend text with the participant name.

## Chat UI details

- `ChatsScreen` has two segments: meetings and personal.
- Meetup chats support `MeetupPhase`:
  - `live`
  - `soon`
  - `upcoming`
  - `done`
- Live meetup cards show pulse dot, step badge and current place.
- Soon cards show countdown and a host-only `Поехали` CTA only when `hostUserId` matches the current user and `sessionId` is present; tapping it calls `BackendRepository.startEveningSession` and opens `/evening-live/:routeId?sessionId=...`.
- Done cards use lowered opacity and “Завершено”.
- `hasLiveMeetupChatProvider` drives pulse dot on the bottom chats tab.
- `MeetupChatScreen` renders:
  - live status in header.
  - pinned current-step card for Frendly Evening live chats.
  - start-live banner for route/session chats in `soon` or `upcoming`, only when `hostUserId` matches the current user.
  - pending Evening join requests panel for the session host, with approve/reject actions.
  - invite link panel for invite-only sessions when session detail exposes `inviteToken`; copy action writes a `bigbreak://evening-preview/:sessionId?inviteToken=...` link.
  - ordinary event pinned card for event-backed chats.
  - voice, attachments, location, message actions.

## Frendly Evening

Files:

- Route catalog: `features/evening_routes/presentation/evening_routes_screen.dart`.
- Route card: `features/evening_routes/presentation/evening_route_card.dart`.
- Route detail: `features/evening_routes/presentation/evening_route_detail_screen.dart`.
- Route detail pieces: `features/evening_routes/presentation/evening_route_step_list.dart`, `features/evening_routes/presentation/evening_nearest_sessions.dart`.
- Template meeting create flow: `features/evening_routes/presentation/create_evening_session_screen.dart`.
- Builder: `features/evening_plan/presentation/evening_builder_screen.dart`.
- Local front-parity route data and API DTO mapping fallback: `evening_plan_data.dart`.
- Local editable route overrides and edit diff rules: `evening_edit_state.dart`.
- Plan screen: `evening_plan_screen.dart`.
- Plan editor: `evening_edit_screen.dart`.
- External preview: `evening_preview_screen.dart`.
- Live timeline: `evening_live_meetup_screen.dart`.
- After party: `evening_after_party_screen.dart`.
- Chat phase model: `shared/models/meetup_chat.dart`.
- Session models: `shared/models/evening_session.dart`.

Flow:

```text
Tonight Evening hero
  -> EveningBuilder
  -> EveningPlan
  -> LaunchEveningSheet publishes session
  -> MeetupChat for gathering
  -> Start live from chat
  -> EveningLiveMeetup
  -> EveningAfterParty
```

Curated team route flow:

```text
Tonight Routes entry
  -> Routes catalog
  -> Route detail
  -> Create template meeting
  -> EveningPreview
```

External discovery flow:

```text
Tonight Frendly Evenings section or Map live pin
  -> EveningPreview
  -> Join/request/invite CTA
  -> MeetupChat, or no-op for invite-only without token
```

Builder steps:

1. `goal`
2. `mood`
3. `budget`
4. `format`
5. `area`

Backend route data:

- `EveningBuilderScreen` loads `/evening/options` in the background and keeps local option lists as immediate fallback.
- Builder final resolve calls `BackendRepository.resolveEveningRoute`, which maps `/evening/routes/resolve` JSON to `EveningRouteData`.
- `EveningPlanScreen` renders local route data immediately, then hydrates `/evening/routes/:routeId` over it when backend responds.
- `EveningPlanScreen` and `EveningLiveMeetupScreen` read local `routeOverrides` first through `evening_edit_state.dart`, then fall back to backend or bundled route data.
- `evening_plan_data.dart` owns the conversion from backend route JSON to the existing `EveningRouteData` / `EveningRouteStep` UI model.
- Premium route lock in `EveningPlanScreen` reads `subscriptionStateProvider`; `trial` and `active` unlock Frendly+ routes without passing a manual screen flag.

EveningEdit:

- Route: `/evening-edit/:routeId`, optional query `chatId`.
- Entry points: pencil button in `EveningPlanScreen` hero and host-only pencil in `MeetupChatScreen` header for Frendly Evening chats that are not done.
- Before start it edits meta, privacy, capacity and all route steps.
- During live it freezes meta and privacy, shows a warning and allows only future steps.
- After done it is read-only.
- Save writes a local route override, patches meetup chat summary fields and adds a local system diff message to the chat thread.

Launch:

- `EveningPlanScreen` can auto-open launch sheet with query `launch=1`.
- Launch sheet chooses privacy:
  - `open`
  - `request`
  - `invite`
- Flutter calls `BackendRepository.publishEveningRoute`.
- After successful publish Flutter seeds `meetupChatsLocalStateProvider` with the new session chat summary before opening `/meetup/:chatId`, so `MeetupChatScreen` has title, host-only start controls and list presence immediately even when `/chats/meetups` was already cached.
- Then navigates to `/meetup/:chatId` for gathering.
- Live starts later from `MeetupChatScreen` through `BackendRepository.startEveningSession`.
- Before publish the launch participant block shows only the host state (`Пока только ты`); guests appear through preview and backend session data after publish.

EveningPreview:

- Route: `/evening-preview/:sessionId`.
- Data provider: `eveningSessionProvider`.
- Shows hero privacy badge, optional live badge, host, capacity, route timeline and sticky CTA.
- Header share button opens `/evening-share/:sessionId`.
- Uses `isJoined` and `isRequested` from backend session detail, so joined users can reopen chat/live and request-mode users see persisted “Заявка отправлена”.
- CTA behavior:
  - open: join session and immediately open meetup chat, including late live join with pinned live card.
  - request: send join request.
  - invite: disabled without invite token.
  - invite link: if opened with `?inviteToken=...`, CTA changes to `Вписаться по инвайту` and joins with that token.
- Already joined users and successful join responses seed the meetup chat summary before navigation, so the common `MeetupChatScreen` does not fall back to the generic `Чат встречи` header.

Tonight and Map:

- `eveningSessionsProvider` feeds Tonight horizontal section.
- `eveningSessionsProvider` also feeds Search local results.
- Tonight Frendly Evenings and nearby sections render at most five cards and open Search presets for the full list.
- Cards show live or gathering state, current step, privacy and capacity.
- Tonight live Evening cards render a pulsing live dot inside the status badge.
- `EveningSessionSummary` carries `lat` and `lng` from the current live step or first route step.
- `MapScreen` uses those coordinates for native live evening placemarks; fallback map still uses bounded pulsing overlay pins and opens preview on tap.
- Tonight gathering cards format `startsAt` into a compact countdown label such as `через 45 мин`.
- `SearchScreen` shows a `Frendly Evenings` result block and opens EveningPreview.

Live timeline:

- Uses route data from `evening_plan_data.dart` as fallback.
- When opened with `sessionId`, hydrates title, chat id, steps, participants, step status and current user's check-in state from `eveningSessionProvider`.
- Step states: done, current, upcoming, skipped.
- Check-in is optimistic locally, then syncs through the session check-in endpoint.
- Manual and hybrid show “Дальше” only to the session host; guests keep chat, route detail and check-in, but do not see host-only advance or skip controls.
- Auto hides manual advance and relies on backend worker plus `chat.updated` for step changes.
- Advance, skip and finish use session endpoints when `sessionId` is present, then invalidate Evening sessions and meetup chats.
- Legacy fallback still calls `BackendRepository.finishEveningRoute`, then opens AfterParty.

Backend contract:

- `GET /evening/route-templates`
- `GET /evening/route-templates/:templateId`
- `GET /evening/route-templates/:templateId/sessions`
- `POST /evening/route-templates/:templateId/sessions`
- `POST /evening/routes/:routeId/launch` publishes a session.
- `GET /evening/options`.
- `POST /evening/routes/resolve`.
- `GET /evening/routes/:routeId`.
- `GET /evening/sessions`.
- `GET /evening/sessions/:sessionId`.
- `POST /evening/sessions/:sessionId/join`.
- `POST /evening/sessions/:sessionId/join-request`.
- `POST /evening/sessions/:sessionId/join-requests/:requestId/approve`.
- `POST /evening/sessions/:sessionId/join-requests/:requestId/reject`.
- `POST /evening/sessions/:sessionId/start`.
- `POST /evening/sessions/:sessionId/finish`.
- `POST /evening/sessions/:sessionId/steps/:stepId/check-in`.
- `POST /evening/sessions/:sessionId/steps/:stepId/advance`.
- `POST /evening/sessions/:sessionId/steps/:stepId/skip`.
- `GET /evening/sessions/:sessionId/after-party`.
- `POST /evening/sessions/:sessionId/after-party/feedback`.
- `POST /evening/sessions/:sessionId/after-party/photos`.
- `POST /evening/routes/:routeId/finish` remains legacy.
- Chat list receives phase fields from `/chats/meetups`.

Current gaps to remember:

- Flutter route detail data uses backend hydrate with local front-parity fallback.
- AfterParty reaction saves feedback when opened with `sessionId`; failed saves roll back the selected reaction and show an error.
- AfterParty photo button uses shared media picker, uploads through existing chat attachment upload path and attaches the asset to the session photo endpoint.
- AfterParty loads `/evening/sessions/:sessionId/after-party` when `sessionId` is present and uses backend participants count, average rating and photo count in the summary cards.
- Auto mode has no local timer engine; backend worker advances sessions and frontend refreshes through `chat.updated`.
- Invite-token links are supported through `EveningPreviewScreen` query params and can be copied by the host from `MeetupChatScreen`.
- Realtime phase refresh uses `chat.updated`; there is no separate `evening.session.updated` event yet.
- Evening system messages from publish, start, join, check-in, step change and finish use `kind: system`, so chat REST reload and realtime payloads keep the front-parity pill layout.

## Create meetup

- Main screen: `CreateMeetupScreen`.
- Query params:
  - `inviteeUserId`.
  - `posterId`.
  - `communityId`.
  - `mode=dating`.
  - `mode=afterdark`.
- Partner picker:
  - file: `widgets/partner_picker_sheet.dart`.
  - local data copied from front parity data.
  - applying a partner fills place, emoji, title and description.
- Poster picker and partner picker are separate. Selecting a poster clears partner venue.
- Create submits through `BackendRepository.createEvent`.

## Media and image rules

- Use shared image/media widgets.
- Profiles: `BbProfilePhotoImage`, `BbProfilePhotoGallery`.
- Chat images: `BbChatAttachmentImage`.
- Voice: `BbVoiceMessage`, `ChatVoicePlaybackController`.
- Upload heavy bytes through presigned upload when possible.
- Do not add direct `Image.network` in hot screens unless there is no shared path.

## Visual parity

- Source of truth: `front/`.
- Flutter theme mirrors tokens:
  - `AppColors`
  - `AppTextStyles`
  - `AppSpacing`
  - `AppRadii`
  - `AppShadows`
  - `AppTheme`
- Fonts:
  - `Sora`
  - `Manrope`
- Parity tests live in `mobile/test/features/parity/`.

## Performance notes

- Lists should be bounded and lazy.
- Chat thread initial REST load is 20 messages.
- Chat state is scoped by `chatId`.
- Chat summary updates patch local providers instead of full app refresh.
- Media uploads avoid REST body bytes when presigned upload works.
- Voice upload emits `voice_upload_ms`.
- Map initial radius is 25 km; camera fit is one-shot for initial load, current-location refresh and filter changes.

## Test navigation

- Router: `mobile/test/navigation/`.
- Evening: `mobile/test/features/evening_plan/`, `mobile/test/shared/models/meetup_chat_phase_test.dart`.
- Chat: `mobile/test/features/parity/detail_chat_and_user_profile_screen_test.dart`, `mobile/test/features/chats/presentation/`.
- Create meetup and posters: `mobile/test/features/parity/create_meetup_posters_test.dart`.
- Shared widgets: `mobile/test/shared/widgets/`.
- Performance: `mobile/test/performance/`.
