# MIGRATION V5 UI PLAN

Источник дизайна: `front/src/pages/v5`.

Связанный экран вне указанной папки: `front/src/pages/HomeV5.tsx`. Он найден через `front/src/pages/V5Gallery.tsx` и влияет на первый таб, но не входит в обязательный список экранов из `/front/src/pages/v5`.

Общие правила переноса:

- Сохраняем существующие Flutter routes, providers, API calls, submit handlers, realtime, auth, settings, media, navigation.
- TSX local mock state переносим только как визуальную форму. Данные берём из текущих Riverpod providers и `BackendRepository`.
- Общий v5 стиль выносим в shared Flutter widgets, чтобы не дублировать карточки, pill buttons, chips, top bars, warm background.
- Новые production dependencies не добавляем.

Общие файлы дизайна:

- [x] Tokens and UI atoms — `front/src/pages/v5/_tokens.ts`, `front/src/pages/v5/_ui.tsx` -> `mobile/lib/app/theme/*`, `mobile/lib/shared/widgets/bb_v5_ui.dart`
  Комментарий: перенесены v5 палитра `paper`, `paperHi`, `ink`, `terra`, `sage`, радиусы 14/20/28, card/pill/nav shadows, warm background wash, Kicker, HeroTitle, TopBar, Pill, Chip, SearchPill, glass bottom container. Тему не ломал, токены добавлены отдельным shared-слоем.
  Изменённые файлы: `mobile/lib/shared/widgets/bb_v5_ui.dart`.
  Подключённый функционал: пока только визуальный shared layer, backend логики нет.
  Проверка: `dart format lib/shared/widgets/bb_v5_ui.dart`.

- [x] BottomNavV5 — `front/src/pages/v5/_BottomNav.tsx` -> `mobile/lib/shared/widgets/bb_bottom_nav.dart`, `mobile/lib/app/navigation/app_shell.dart`
  Комментарий: перенесены glass pill nav, active ink-tab, labels `Радар`, `Клубы`, `Дейт.`, `Чаты`, `Я`. Текущие `AppRoute`, unread badge, live-dot и shell FAB сохранены.
  Изменённые файлы: `mobile/lib/shared/widgets/bb_bottom_nav.dart`, `mobile/lib/app/navigation/app_shell.dart`, `mobile/lib/shared/widgets/bb_v5_ui.dart`.
  Подключённый функционал: `chatUnreadBadgeProvider`, `hasLiveMeetupChatProvider`, `context.goRoute(tab.route)`, shell create/evening shortcuts.
  Проверка: `dart format lib/app/navigation/app_shell.dart lib/shared/widgets/bb_bottom_nav.dart`, `flutter analyze`. Ручная проверка нужна для safe area и overlap с FAB.

Экраны:

- [x] SplashV5 — `front/src/pages/v5/Splash.tsx` -> `mobile/lib/features/splash/presentation/splash_screen.dart`
  Комментарий: перенесены warm wash, pulse rings, `Fr` tile, staged `Frendly` reveal, tagline switch, progress dots. Текущий auth bootstrap, onboarding redirect, guest redirect, haptic и таймеры сохранены.
  Изменённые файлы: `mobile/lib/features/splash/presentation/splash_screen.dart`, `mobile/lib/shared/widgets/bb_v5_ui.dart`.
  Подключённый функционал: `authTokensProvider`, `authBootstrapProvider`, `onboardingProvider`, `resolvePendingSetupRoute`, `AppRoute.welcome`, `AppRoute.tonight`.
  Проверка: `dart format lib/features/splash/presentation/splash_screen.dart`, `flutter analyze`. Ручная проверка нужна для фактического redirect на guest/auth/setup.

- [x] WelcomeV5 — `front/src/pages/v5/Welcome.tsx` -> `mobile/lib/features/welcome/presentation/welcome_screen.dart`
  Комментарий: перенесены warm welcome layout, `Fr` brand tile, kicker, serif-like accent через italic Sora, pill CTA, divider, Telegram/Google/Yandex auth buttons в v5 card style.
  Изменённые файлы: `mobile/lib/features/welcome/presentation/welcome_screen.dart`, `mobile/lib/shared/widgets/bb_v5_ui.dart`.
  Подключённый функционал: `AppRoute.phoneAuth`, `AppRoute.telegramAuth`, `socialAuthServiceProvider`, `appSessionControllerProvider.replaceAuthenticatedSession`, pending/loading states, auth error snackbar.
  Проверка: `dart format lib/features/welcome/presentation/welcome_screen.dart`, `flutter analyze`. Ручная проверка нужна для Telegram route, Google/Yandex login на устройстве.

- [x] OnboardingV5 — `front/src/pages/v5/Onboarding.tsx` -> `mobile/lib/features/onboarding/presentation/onboarding_screen.dart`
  Комментарий: перенесены warm background, progress bars, step kicker/title/accent, v5 cards, chips, sticky pill CTA, birthday card. Реальные Flutter-only поля contact, gender, birth date, geolocation search сохранены, потому что backend onboarding требует их.
  Изменённые файлы: `mobile/lib/features/onboarding/presentation/onboarding_screen.dart`, `mobile/lib/shared/widgets/bb_v5_ui.dart`.
  Подключённый функционал: `onboardingProvider`, `onboardingLocalStateProvider`, `saveOnboarding`, contact availability check, Yandex place search, device geolocation, `AppRoute.tonight`.
  Проверка: `dart format lib/features/onboarding/presentation/onboarding_screen.dart`, `flutter analyze`. Ручная проверка нужна для phone/email validation, birth date sheet, geo suggestions, финального save.

- [x] RadarV5 — `front/src/pages/v5/Radar.tsx` -> `mobile/lib/features/map/presentation/map_screen.dart`
  Комментарий: перенесены v5 top search/filter bar, chips, layers/locate controls, create pill FAB, bottom sheet `Рядом сегодня` с горизонтальными карточками. Реальную Yandex map surface и fallback map не заменял, чтобы сохранить текущую карту, viewport refresh, map pins и event opens.
  Изменённые файлы: `mobile/lib/features/map/presentation/map_screen.dart`, `mobile/lib/shared/widgets/bb_v5_ui.dart`.
  Подключённый функционал: `mapEventsProvider`, `eveningSessionsProvider`, current location, native/fallback map pins, viewport query, event detail navigation, create meetup navigation.
  Проверка: `dart format lib/features/map/presentation/map_screen.dart`, `flutter analyze`. Ручная проверка нужна для native map, locate, layers/filter, bottom sheet tap.

- [x] CreateMeetupV5 — `front/src/pages/v5/CreateMeetup.tsx` -> `mobile/lib/features/create_meetup/presentation/create_meetup_screen.dart`
  Комментарий: перенесены sticky v5 header, mode tabs с After Dark, live preview, title/icon card, горизонтальный выбор иконки, where/when rows, attach poster/partner/route grid, attach preview, capacity slider, lifestyle, price, access, gender, dating ideas, vibe chips, description card, AI helper, visibility tiles, sticky CTA. Dating-only сценарии оставлены как текущий функциональный блок и встроены в v5 layout.
  Изменённые файлы: `mobile/lib/features/create_meetup/presentation/create_meetup_screen.dart`, `mobile/lib/shared/widgets/bb_v5_ui.dart`.
  Подключённый функционал: `eventDetailProvider`, `subscriptionStateProvider`, `afterDarkAccessProvider`, `showDateTimeSheet`, `showPlaceSheet`, `showAfficheEventPickerSheet`, `showPartnerPickerSheet`, `showRoutePickerSheet`, `_fillPlaceFromLocation`, `_submitCreate`, poster/affiche/community prefill, route attach, create/edit validation, create event API, invalidate providers, navigation to detail/paywall.
  Проверка: `dart format lib/features/create_meetup/presentation/create_meetup_screen.dart`, `flutter analyze`, `flutter test test/features/parity/create_meetup_posters_test.dart`. Ручная проверка нужна для create/edit, dating invite, afterdark gate, poster/affiche prefill, route attach, partner picker, location resolve, validation snackbar, sticky CTA overlap.

- [x] ChatsV5 — `front/src/pages/v5/Chats.tsx` -> `mobile/lib/features/chats/presentation/chats_screen.dart`
  Комментарий: перенесены editorial header `Что обсуждаем сегодня?`, v5 search pill, active rail `Сейчас идут`, warm filter chips, rounded chat list, initials avatars, unread pills, empty/loading/error states и AI compass card. Старые live/soon/upcoming секции оставлены в новом визуальном слое, потому что они привязаны к evening session функционалу.
  Изменённые файлы: `mobile/lib/features/chats/presentation/chats_screen.dart`, `mobile/lib/shared/widgets/bb_v5_ui.dart`.
  Подключённый функционал: `meetupChatsProvider`, `personalChatsProvider`, `chatSegmentProvider`, `chatUnreadBadgeProvider` через bottom nav, meetup chat navigation, personal chat navigation, search route, create meetup route, start evening session handler, provider invalidation.
  Проверка: `dart format lib/features/chats/presentation/chats_screen.dart`, `flutter analyze`, `flutter test test/features/parity/people_and_chats_screen_test.dart`. Ручная проверка нужна для long chat names, active rail scroll, personal segment, empty/error states, bottom nav overlap.

- [x] ChatRoomV5 — `front/src/pages/v5/ChatRoom.tsx` -> `mobile/lib/features/meetup_chat/presentation/meetup_chat_screen.dart`, `mobile/lib/features/personal_chat/presentation/personal_chat_screen.dart`, shared chat widgets
  Комментарий: перенесены warm chat background, day divider, system pills, v5 message bubbles, composer capsule, attachment sheet entrypoints, voice/send buttons и pinned meetup card. Meetup и personal screens оставлены на текущих handlers, чтобы сохранить REST history, realtime, send/edit/delete/reply, photo/file/location/voice attachments, member direct chat, ticket CTA и evening session actions. Dark/After Dark палитры сохранены условно, чтобы не сломать 18+ режим.
  Изменённые файлы: `mobile/lib/features/chats/presentation/chat_thread_screen.dart`, `mobile/lib/shared/widgets/bb_chat_bubble.dart`, `mobile/lib/shared/widgets/bb_composer.dart`, `mobile/lib/shared/widgets/bb_pinned_meetup_card.dart`, `mobile/lib/shared/widgets/bb_v5_ui.dart`.
  Подключённый функционал: `chatThreadProvider`, `markRead`, send/edit/delete/reply handlers, attachment services, media picker, file picker, location share, voice recorder, member profile/direct chat actions, ticket external launch, evening live/edit/invite/request panels.
  Проверка: `dart format lib/features/chats/presentation/chat_thread_screen.dart lib/shared/widgets/bb_chat_bubble.dart lib/shared/widgets/bb_composer.dart lib/shared/widgets/bb_pinned_meetup_card.dart`, `flutter analyze`, `flutter test test/features/parity/detail_chat_and_user_profile_screen_test.dart test/shared/widgets/bb_composer_test.dart test/shared/widgets/bb_chat_bubble_test.dart test/shared/widgets/bb_pinned_meetup_card_test.dart`. Ручная проверка нужна для sticky header visual parity, attachment bottom sheet visual, keyboard safe area, voice recording on device, realtime updates.

- [x] DatingV5 — `front/src/pages/v5/Dating.tsx` -> `mobile/lib/features/dating/presentation/dating_screen.dart`
  Комментарий: перенесены warm v5 shell, header `Свидания рядом`, discover/likes segmented tabs, premium photo card с overlay, bookmark, prompt, tags, action buttons, date CTA, likes list, locked state, empty/loading/error states и filter sheet. TSX social follow/like row не подключал как мок: в текущем Flutter нет backend-источника для этих counters/actions, вместо этого сохранён реальный переход в профиль.
  Изменённые файлы: `mobile/lib/features/dating/presentation/dating_screen.dart`, `mobile/lib/shared/widgets/bb_v5_ui.dart`.
  Подключённый функционал: `subscriptionStateProvider`, `hasPremiumDatingAccess`, `datingDiscoverProvider`, `datingLikesProvider`, `BackendRepository.sendDatingAction`, match route через `AppRoute.personalChat`, paywall route, create dating meetup route, user profile route, photo switch, swipe handlers, saved local state. Фильтры работают локально по age/tags/area из текущих `DatingProfileData`; фильтр `Когда` оставлен визуальным состоянием, потому что отдельного backend-поля времени нет.
  Проверка: `dart format lib/features/dating/presentation/dating_screen.dart`, `flutter analyze lib/features/dating/presentation/dating_screen.dart`, `flutter test test/features/dating/presentation/dating_screen_test.dart`. Ручная проверка нужна для filter sheet на устройстве, match chat при реальном reciprocal like, premium gate, wide viewport hit-area, pixel-perfect photo/card proportions.

- [x] ClubsV5 — `front/src/pages/v5/Clubs.tsx` -> `mobile/lib/features/communities/presentation/communities_screen.dart`
  Комментарий: перенесены v5 header `Сообщества`, search pill, filter button с active dot, hero stats, club cards, privacy/premium badges, unread badge, meta row, next meetup row, empty/loading/error states и filters sheet. Search, privacy и tags фильтруют текущий `Community`; район оставлен визуальным состоянием, потому что в `Community` нет отдельного поля area.
  Изменённые файлы: `mobile/lib/features/communities/presentation/communities_screen.dart`, `mobile/lib/shared/widgets/bb_v5_ui.dart`.
  Подключённый функционал: `communitiesFeedProvider`, lazy `ListView.builder`, `loadNextPage`, `subscriptionStateProvider`, `hasFrendlyPlusAccess`, create community/paywall route, community detail route, next meetup `AppRoute.eventDetail`.
  Проверка: `dart format lib/features/communities/presentation/communities_screen.dart`, `flutter analyze lib/features/communities/presentation/communities_screen.dart`, `flutter test test/features/communities/presentation/communities_screen_test.dart --plain-name "communities list renders front content"`, `flutter test test/features/communities/presentation/communities_screen_test.dart --plain-name "create community opens"`. Полный `communities_screen_test.dart` сейчас падает на detail/chat/post tests через `CommunityDetailScreen`, `CreateCommunityPostScreen`, `CommunityChatScreen`; это относится к следующим блокам `ClubDetailV5` и shared chat проверке. Ручная проверка нужна для filters sheet, pagination footer, open club, next meetup tap, bottom nav overlap.

- [x] ClubDetailV5 — `front/src/pages/v5/ClubDetail.tsx` -> `mobile/lib/features/communities/presentation/community_detail_screen.dart`
  Комментарий: перенесены warm v5 detail shell, top bar, hero club card, privacy/premium badges, stats, social tiles, join/request status, segmented tabs overview/meetups/members, news cards, meetup list и members rows. Chat button оставлен только для owner, потому что текущие тесты и логика скрывают chat у joined non-owner. `communityProvider` расширен fallback-логикой: сначала `fetchCommunity`, при ошибке поиск в уже загруженном `communitiesProvider`.
  Изменённые файлы: `mobile/lib/features/communities/presentation/community_detail_screen.dart`, `mobile/lib/features/communities/presentation/community_providers.dart`, `mobile/lib/shared/widgets/bb_v5_ui.dart`.
  Подключённый функционал: `communityProvider`, `communitiesProvider` fallback, owner community chat route, create meetup with `communityId`, media route, create post route, event detail route, public join local state, private request-only state.
  Проверка: `dart format lib/features/communities/presentation/community_detail_screen.dart lib/features/communities/presentation/community_providers.dart`, `flutter analyze lib/features/communities/presentation/community_detail_screen.dart lib/features/communities/presentation/community_providers.dart`, `flutter test test/features/communities/presentation/communities_screen_test.dart`. Ручная проверка нужна для owner/non-owner states, private club, media tile, create meetup, members tab и visual parity social tiles.

- [x] RoutesV5 — `front/src/pages/v5/Routes.tsx` -> `mobile/lib/features/evening_routes/presentation/evening_routes_screen.dart`
  Комментарий: перенесены warm v5 shell, header `Маршруты вечера`, AI sparkles button, city/count row, search pill, horizontal mood chips, v5 empty/loading states и v5 route cards. Старый `EveningRouteCard` удалён: карточка теперь повторяет RoutesV5 с kicker, title, blurb, savings pill, meta row, emoji steps и actions `Подробнее` / `Запустить`.
  Изменённые файлы: `mobile/lib/features/evening_routes/presentation/evening_routes_screen.dart`, `mobile/lib/features/evening_routes/presentation/evening_route_card.dart`, `mobile/lib/shared/widgets/bb_v5_ui.dart`.
  Подключённый функционал: `profileProvider`, `onboardingProvider`, `eveningRouteTemplatesProvider(city)`, search/mood filters, `AppRoute.eveningPlan`, `launch=1`, `AppRoute.eveningBuilder`, lazy route rendering.
  Проверка: `dart format lib/features/evening_routes/presentation/evening_routes_screen.dart lib/features/evening_routes/presentation/evening_route_card.dart test/features/evening_routes/evening_routes_screen_test.dart`, `flutter analyze lib/features/evening_routes/presentation/evening_routes_screen.dart lib/features/evening_routes/presentation/evening_route_card.dart`, `flutter test test/features/evening_routes/evening_routes_screen_test.dart`. Ручная проверка нужна для card visual parity, horizontal chips, AI builder button, bottom nav overlap.

- [x] RouteDetailV5 — `front/src/pages/v5/RouteDetail.tsx` -> `mobile/lib/features/evening_plan/presentation/evening_plan_screen.dart`, `mobile/lib/features/evening_routes/presentation/evening_route_detail_screen.dart`
  Комментарий: перенесены warm v5 shell, header `Маршрут вечера`, share/edit pills, hero/detail card с kicker, title, blurb, metric tiles, budget row и savings pill. Старый gradient hero `Frendly Plan` удалён. Timeline, sticky CTA, premium lock и launch sheet сохранены как рабочая функциональная часть publish flow, ticket/perk actions и legacy template route.
  Изменённые файлы: `mobile/lib/features/evening_plan/presentation/evening_plan_screen.dart`, `mobile/test/features/evening_plan/evening_plan_screen_test.dart`, `mobile/test/features/evening_routes/evening_route_entrypoints_test.dart`, `mobile/lib/shared/widgets/bb_v5_ui.dart`.
  Подключённый функционал: backend route hydrate over local fallback, premium subscription state, ticket/perk local states, meetup chat cache, publish sheet, privacy controls, launch sheet, edit route, generated route path, template route path.
  Проверка: `dart format lib/features/evening_plan/presentation/evening_plan_screen.dart`, `flutter analyze lib/features/evening_plan/presentation/evening_plan_screen.dart`, `flutter test test/features/evening_plan/evening_plan_screen_test.dart`. Ручная проверка нужна для exact TSX parity timeline step cards, sticky CTA spacing и launch sheet visual.

- [x] PostersV5 — `front/src/pages/v5/Posters.tsx` -> `mobile/lib/features/posters/presentation/posters_screen.dart`
  Комментарий: перенесены warm v5 shell, header `Афиша города`, title `Куда пойти сегодня`, search pill, category chips, event counter, two-column poster grid cards, loading/error/empty states. Featured posters сохранены без отдельной секции: при пустом поиске и категории `Все` они поднимаются в начало grid, чтобы не ломать текущий backend-блок.
  Изменённые файлы: `mobile/lib/features/posters/presentation/posters_screen.dart`, `mobile/lib/shared/widgets/bb_v5_ui.dart`.
  Подключённый функционал: `featuredPostersProvider`, `posterFeedProvider(PostersQuery)`, debounce search, category filter, poster detail route через `AppRoute.poster`.
  Проверка: `dart format lib/features/posters/presentation/posters_screen.dart`, `flutter analyze lib/features/posters/presentation/posters_screen.dart`, `flutter test test/features/posters/presentation/posters_screen_test.dart`. Ручная проверка нужна для category taps, open detail, grid proportions, long venue/title, bottom safe area. `AfficheEventsScreen` не трогал: это отдельная live ticket feed route `/affiche`, прямого TSX-экрана под неё в `/front/src/pages/v5` нет.

- [x] PosterDetailV5 — `front/src/pages/v5/PosterDetail.tsx` -> `mobile/lib/features/posters/presentation/poster_detail_screen.dart`
  Комментарий: перенесены warm v5 shell, provider/date header, share pill, ticket hero с emoji, perforation, 2x2 info tiles, tags, about block, company CTA и sticky buttons. Loading/error states переведены в v5 card style. `AfficheEventDetailScreen` не трогал: это отдельная live ticket detail route `/affiche/event/:eventId`, прямого TSX-экрана под неё в `/front/src/pages/v5` нет.
  Изменённые файлы: `mobile/lib/features/posters/presentation/poster_detail_screen.dart`, `mobile/lib/shared/widgets/bb_v5_ui.dart`.
  Подключённый функционал: `posterDetailProvider(posterId)`, external ticket launch через `launchUrl`, fallback snackbar при ошибке launch, create meetup route с `posterId`, share snackbar, free/paid labels из `Poster.priceLabel`.
  Проверка: `dart format lib/features/posters/presentation/poster_detail_screen.dart`, `flutter analyze lib/features/posters/presentation/poster_detail_screen.dart`, `flutter test test/features/parity/create_meetup_posters_test.dart`. Ручная проверка нужна для ticket hero proportions, sticky actions over scroll, external ticket open на устройстве и share behavior.

- [x] ProfileV5 — `front/src/pages/v5/Profile.tsx` -> `mobile/lib/features/profile/presentation/profile_screen.dart`
  Комментарий: перенесены warm v5 shell, header `Аккаунт`, hero profile card, avatar/camera, stats grid, follow/like/share visual row, Frendly+ card, intent/vibe/interests/about/history sections и v5 loading/error states. Safety, verification, matches, settings и After Dark оставлены отдельным v5-блоком, потому что это текущие рабочие действия профиля. Follow/like на собственном профиле не отправляют backend social action, показывают локальный snackbar.
  Изменённые файлы: `mobile/lib/features/profile/presentation/profile_screen.dart`, `mobile/test/features/parity/notifications_and_profile_screen_test.dart`.
  Подключённый функционал: `profileProvider`, `profilePhotoPreviewProvider`, `AppRoute.editProfile`, `AppRoute.settings`, `AppRoute.paywall`, `AppRoute.safetyHub`, `AppRoute.verification`, `AppRoute.match`, `matchesProvider`, `afterDarkAccessProvider`, `openAfterDarkEntry`, copy profile path через Clipboard.
  Проверка: `dart format lib/features/profile/presentation/profile_screen.dart test/features/parity/notifications_and_profile_screen_test.dart`, `flutter analyze lib/features/profile/presentation/profile_screen.dart test/features/parity/notifications_and_profile_screen_test.dart`, `flutter test test/features/parity/notifications_and_profile_screen_test.dart`. Ручная проверка нужна для photo preview, edit/settings/paywall routes, After Dark gate, share snackbar и bottom nav overlap.

- [x] PaywallV5 — `front/src/pages/v5/Paywall.tsx` -> `mobile/lib/features/paywall/presentation/paywall_screen.dart`
  Комментарий: перенесены warm v5 shell, top restore action, FRENDLY+ hero, features list, plan cards, active subscription badge, loading/error states и sticky subscribe CTA. Restore и subscribe оставлены на текущих backend handlers.
  Изменённые файлы: `mobile/lib/features/paywall/presentation/paywall_screen.dart`, `mobile/test/features/remaining_rollout/remaining_rollout_screen_test.dart`, `mobile/test/features/after_dark/after_dark_widgets_test.dart`.
  Подключённый функционал: `subscriptionPlansProvider`, `subscriptionStateProvider`, `BackendRepository.subscribe`, `BackendRepository.restoreSubscription`, invalidation `subscriptionStateProvider` и `afterDarkAccessProvider`, back navigation через `context.pop`.
  Проверка: `dart format lib/features/paywall/presentation/paywall_screen.dart test/features/remaining_rollout/remaining_rollout_screen_test.dart test/features/after_dark/after_dark_widgets_test.dart`, `flutter analyze lib/features/paywall/presentation/paywall_screen.dart test/features/remaining_rollout/remaining_rollout_screen_test.dart test/features/after_dark/after_dark_widgets_test.dart`, `flutter test test/features/remaining_rollout/remaining_rollout_screen_test.dart --plain-name "paywall screen renders subscription CTA"`, `flutter test test/features/after_dark/after_dark_widgets_test.dart --plain-name "regular paywall enables subscribe CTA and restore action"`. Ручная проверка нужна для restore snackbar, subscribe loading, real store response и sticky CTA safe area.

- [x] SettingsV5 — `front/src/pages/v5/Settings.tsx` -> `mobile/lib/features/settings/presentation/settings_screen.dart`
  Комментарий: перенесены warm v5 shell, header `Управление`, grouped settings cards, rows, custom toggles, logout pill и version footer. Текущие рабочие блоки safety/verification/paywall/test access сохранены в v5 card style, чтобы не потерять существующие entrypoints.
  Изменённые файлы: `mobile/lib/features/settings/presentation/settings_screen.dart`, `mobile/test/features/parity/settings_screen_test.dart`.
  Подключённый функционал: `settingsProvider`, optimistic update queue через `_saveSettings` и `_flushQueuedSettings`, push permission/register flow, language/city sheets, `AppRoute.safetyHub`, `AppRoute.verification`, `AppRoute.paywall`, testing access update, logout cleanup через `appSessionControllerProvider`.
  Проверка: `dart format lib/features/settings/presentation/settings_screen.dart test/features/parity/settings_screen_test.dart`, `flutter analyze lib/features/settings/presentation/settings_screen.dart test/features/parity/settings_screen_test.dart`, `flutter test test/features/parity/settings_screen_test.dart`. Ручная проверка нужна для push permission на устройстве, logout redirect, account/help/privacy sheets и v5 toggle hit areas.

Связанный экран вне обязательной папки:

- [x] HomeV5 linked screen — `front/src/pages/HomeV5.tsx` -> `mobile/lib/features/tonight/presentation/tonight_screen.dart`
  Комментарий: главный таб больше не гибрид. Перенесена структура HomeV5: brand header, hero `Город дышит`, radar card, `Сейчас собираются`, dating rail, `Афиша города`, `Маршруты вечера`, pulse rows, metrics и AI compass CTA. Старые Tonight sections удалены: feed switch, Frendly Evening hero, old routes entry, evening sessions, active meetup chats, poster fallback, nearby feed list и avatar people rail.
  Изменённые файлы: `mobile/lib/features/tonight/presentation/tonight_screen.dart`, `mobile/test/features/parity/tonight_screen_test.dart`, `mobile/lib/features/splash/presentation/splash_screen.dart`.
  Подключённый функционал: `eventsProvider('nearby')`, `afficheEventsProvider`, `peopleProvider`, `evening_plan_data.eveningRoutes`, `AppRoute.map`, `AppRoute.search`, `AppRoute.eventDetail`, `AppRoute.affiche`, `AppRoute.afficheEvent`, `AppRoute.dating`, `AppRoute.userProfile`, `AppRoute.eveningPlan`, city-limit checks для AI evening builder/routes.
  Проверка: `dart format lib/features/tonight/presentation/tonight_screen.dart test/features/parity/tonight_screen_test.dart`, `flutter analyze lib/features/tonight/presentation/tonight_screen.dart test/features/parity/tonight_screen_test.dart`, `flutter test test/features/parity/tonight_screen_test.dart`. Ручная проверка нужна для pixel parity на 390x820, bottom nav overlap, scroll rhythm, map/search/event/affiche/dating/AI taps и loading/empty states.

Изменённые Flutter-файлы:

- `mobile/lib/shared/widgets/bb_v5_ui.dart`
- `mobile/lib/features/splash/presentation/splash_screen.dart`
- `mobile/lib/features/welcome/presentation/welcome_screen.dart`
- `mobile/lib/features/onboarding/presentation/onboarding_screen.dart`
- `mobile/lib/shared/widgets/bb_bottom_nav.dart`
- `mobile/lib/app/navigation/app_shell.dart`
- `mobile/lib/features/map/presentation/map_screen.dart`
- `mobile/lib/features/create_meetup/presentation/create_meetup_screen.dart`
- `mobile/lib/features/chats/presentation/chats_screen.dart`
- `mobile/lib/features/chats/presentation/chat_thread_screen.dart`
- `mobile/lib/shared/widgets/bb_chat_bubble.dart`
- `mobile/lib/shared/widgets/bb_composer.dart`
- `mobile/lib/shared/widgets/bb_pinned_meetup_card.dart`
- `mobile/lib/features/dating/presentation/dating_screen.dart`
- `mobile/lib/features/communities/presentation/communities_screen.dart`
- `mobile/lib/features/communities/presentation/community_detail_screen.dart`
- `mobile/lib/features/communities/presentation/community_providers.dart`
- `mobile/lib/features/evening_routes/presentation/evening_routes_screen.dart`
- `mobile/lib/features/evening_plan/presentation/evening_plan_screen.dart`
- `mobile/lib/features/posters/presentation/posters_screen.dart`
- `mobile/lib/features/posters/presentation/poster_detail_screen.dart`
- `mobile/lib/features/profile/presentation/profile_screen.dart`
- `mobile/test/features/parity/notifications_and_profile_screen_test.dart`
- `mobile/lib/features/paywall/presentation/paywall_screen.dart`
- `mobile/test/features/remaining_rollout/remaining_rollout_screen_test.dart`
- `mobile/test/features/after_dark/after_dark_widgets_test.dart`
- `mobile/lib/features/settings/presentation/settings_screen.dart`
- `mobile/test/features/parity/settings_screen_test.dart`
- `mobile/lib/features/tonight/presentation/tonight_screen.dart`
- `mobile/test/features/parity/tonight_screen_test.dart`

Финальная проверка:

- `cd mobile && flutter analyze` — прошёл.
- `cd mobile && flutter test` — прошёл.
- Целевые parity tests для Profile, Paywall, Settings, Tonight, Routes и RouteDetail прошли.
- Ручная pixel-perfect сверка всё ещё нужна на 390x820 для Splash, Welcome, Onboarding, BottomNav, Radar/Map, CreateMeetup, Chats, ChatRoom, Dating, Clubs, Routes, Posters, PosterDetail, Profile, Paywall, Settings, HomeV5/Tonight.
- После изменений: `bash scripts/update-understand-graph.sh`.
