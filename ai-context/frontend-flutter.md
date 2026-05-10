# Frontend Flutter Map

Use this for Flutter screens, navigation, state, UI parity and performance.

For concrete files, run `./scripts/ua-query.mjs "<feature keywords>"` first.

## Stack

- State: `flutter_riverpod`.
- Navigation: `go_router`.
- HTTP: `dio`.
- WebSocket: `web_socket_channel`.
- Storage: `flutter_secure_storage`, `shared_preferences`.
- Images: `cached_network_image`, `flutter_cache_manager`.
- Voice: `record`, `just_audio`.
- Media picker/files: `image_picker`, `file_picker`, `file_saver`, `open_filex`.
- Maps/location: `geolocator`, `yandex_mapkit`.
- Icons: `flutter_lucide`.
- Social auth: `google_sign_in`, native Yandex LoginSDK bridge.

## Structure

```text
mobile/lib/
  app/
    core/
    navigation/
    session/
    theme/
  features/
    <feature>/presentation/
    <feature>/data/
    <feature>/domain/
  shared/
    data/
    models/
    utils/
    widgets/
```

Most features are presentation-first. Add `application` or `domain` only when real business logic needs it.

## Routes

Route groups and query params live in `ai-context/entry-points.md`.
Use this file for Flutter behavior, state and performance rules.

## Router behavior

- `buildAppRouter` creates `GoRouter`.
- Initial route: `/splash`.
- Guest outside public routes goes to `/welcome`.
- Authenticated user on public route goes to `/tonight`.
- Incomplete onboarding goes to `/onboarding`.
- Shell tabs use `ShellRoute` and `AppShell`.

## Feature notes

- Splash mirrors `front/src/pages/v5/Splash.tsx`: liquid orange drop, blob reveal, Frendly wordmark and final compact `Fr` mark before auth routing.
- Welcome mirrors `front/src/pages/v5/Welcome.tsx`: orange Fr logo tile, centered editorial title/subtitle, bottom primary CTA, SMS login button, social auth row and terms copy.
- Onboarding is a 7-step v5 flow: intent/profile, city and area, interests, vibe, birthday, contact, permissions. If auth requires a missing contact, keep that contact step first so backend completion rules still pass.
- Paywall mirrors `front/src/pages/v5/Paywall.tsx`: terracotta FRENDLY+ pill, feature list, yearly/monthly cards and fixed subscribe CTA.
- Mobile no longer has a full screen `/search` route. Header search entry points use reusable `showV5SearchModal(BuildContext context)` from `features/tonight/presentation/v5_search_modal.dart`.
- V5 search modal keeps recent queries in `SharedPreferences` and routes static result types to `/tonight`, `/communities`, `/dating`, `/routes` and `/affiche`.
- Mobile grouped remote search ignores backend `posters` payloads.
- `BackendRepository` is the shared REST mapping boundary.
- Affiche uses a separate `AfficheEvent` model under `shared/models`, because imported paid events may have no address or coordinates. `BackendRepository` owns `fetchAfficheEvents` and `fetchAfficheEventDetail`.
- Chat local state is scoped by chat id.
- Tonight location can be overridden manually through `manualLocationProvider`. Nearby event feed and city-limited Tonight entries must prefer manual coordinates/city before device GPS.
- Home, Meetups and Radar share nearby event radius through `nearbyEventsRadiusKmProvider`. Default is `50 км`, max is `150 км`, and Radar radius changes are persisted through `SharedPreferences`.
- Debounced Yandex place search in onboarding, Tonight manual location and Create Meetup place picker must capture map/location services before async waits, guard `mounted`, catch search errors, and clear loading only for the current query.
- Map viewport events use an `autoDispose` family provider because query keys change with camera center/bounds.
- Tonight first tab mirrors linked `front/src/pages/HomeV5.tsx`, not the old Tonight feed. It renders brand header, hero, radar, gathering, dating, affiche, routes, pulse, metrics, `Твоё в Frendly` links and AI voice CTA. The gathering rail is a snapping V5 carousel backed by `GET /events`; `Смотреть все` opens `/meetups`. Dating preview cards open `/dating`, not the public user profile route. Home route preview cards are backed by `eveningRouteTemplatesProvider` and open `/routes/:templateId`; do not hardcode route previews here.
- Tonight city pulse is derived from the already loaded Home events feed. It sorts non-full events by `going` descending and shows at most 5 rows; do not start chat/session providers or an extra broad event load for this widget.
- Meetups list at `/meetups` mirrors `front/src/pages/v5/Meetups.tsx`: V5 warm page, search, quick `Когда` chips, sort controls, filter sheet for categories, time of day, atmosphere, radius and access, and event cards backed by `GET /events`.
- Locally promoted meetups from `tokenWalletProvider` stay above regular meetups on Meetups and Tonight gathering surfaces, while keeping the selected sort inside each group. Promoted cards use the terracotta `ТОП` badge.
- Host dashboard at `/host` mirrors `front/src/pages/v5/Host.tsx`: V5 hero metric, stat cards, create CTA, real join requests with approve/reject actions, and tabs for upcoming, past and draft meetups backed by `/host/dashboard`.
- V5 dark actions use the terracotta accent `#D08A63`: CTA buttons, active bottom nav, active chips, chat mine bubbles, FAB and snackbars. Home header uses the orange Fr logo asset and opens V5 city picker/search/AI create from the header controls. City picker uses a warm blurred modal with region/city rows, live geolocation detection, Yandex suggestions and manual save. Shared V5 bottom nav always uses the `Клубы` label for the communities tab and a 56px create FAB at `right: 20`, `bottom: 96` on Home.
- V5 Home, Chats and Map search controls open the shared V5 search modal, not a full Search screen. It keeps the blurred dimmed surface underneath, starts on `Всё`, autofocuses the search field, keeps recent queries in `SharedPreferences`, and routes results by type.
- V5 map screen mirrors `front/src/pages/v5/Radar.tsx` while keeping real `YandexMap`: native map must stay readable with vector map details and visible POIs, while warm paper/topography decoration is fallback-only. Keep V5 top controls, black active map chips, right map controls, bottom nearby sheet and local V5 bottom nav. Back falls through to `/tonight` when the map was opened as a root route. Event points are backend-driven through `GET /events`; do not show fake radar pins/cards when backend data is empty.
- Map performance: Android Yandex Map uses Hybrid Composition by default; set `--dart-define=BIG_BREAK_ANDROID_YANDEX_USE_VIRTUAL_DISPLAY=true` only as a fallback. Radar caches unchanged native `mapObjects`, and viewport query coordinates are rounded coarser than marker coordinates to avoid duplicate requests from tiny camera jitter.
- AI Create lives at `AppRoute.aiCreate` (`/ai-create`) and mirrors `front/src/pages/v5/AICreate.tsx`: prompt, templates, vibes, time, budget, group size and a mic entry into the voice flow. Text generation calls `POST /evening/routes/resolve`, displays backend route steps, cancels stale resolve requests, and opens the route preview or launch flow from the result.
- AI Voice lives at `AppRoute.aiVoice` (`/ai-voice`) and mirrors `front/src/pages/v5/AIVoice.tsx`: pulsing mic, dictated prompt and route preview. Presets and completed dictation call the same `POST /evening/routes/resolve` flow as AI Create, cancel stale requests on reset/dispose, and open the generated route launch flow when ready.
- Create Meetup mirrors `front/src/pages/v5/CreateMeetup.tsx`: sticky V5 header, terracotta mode tabs, live preview with `Brix · Покровка 12`, title/icon, when/where, attach, vibe, capacity including fixed dating capacity, lifestyle, price chips with v5 range separators, access, gender, description, AI helper, visibility and fixed bottom CTA.
- Normal Create Meetup publishes through `/publish`: `CreateMeetupScreen` stores a `CreateMeetupDraft`, `PublishMeetupScreen` renders the v5 preview, visibility, token promo and terms, then calls the existing `POST /events` flow. Dating and edit keep their guarded direct paths.
- `/routes/new` is a V5 custom route constructor backed by local `customEveningRoutesProvider` storage because there is no backend route-create endpoint. It must not add a new backend API.
- Tonight affiche preview uses `afficheEventsProvider` for the current manual city and opens `/affiche`. Do not fall back to posters on this HomeV5 surface.
- Full Affiche screen at `/affiche` mirrors `front/src/pages/v5/Posters.tsx` but uses real `AfficheEvent` data: V5 warm page, back header, search pill, category chips, 2-column event grid and V5 card styling. The filter sheet has date range chips, time of day, multi-category choice, 0-30 km radius and price, with active count on the filter button and empty state. Affiche detail mirrors `front/src/pages/v5/PosterDetail.tsx`: V5 ticket card, perforation, info tiles, together callout and fixed bottom CTAs.
- Tonight dating preview uses `datingHomePreviewProvider`, backed by `GET /dating/discover?limit=4`. It must not fall back to `/people`; do not watch `peopleProvider` from Home and do not bring back the old avatar tile rail.
- Dating screen mirrors `front/src/pages/v5/Dating.tsx`: header has only back, title and filter; no `Date` header button. Discover cards use prompt, tags and the three V5 actions, without public follow/like social controls. Tabs, like actions and match/chat flow use the terracotta V5 accent. Discover actions advance the card locally before the backend response and roll back on errors. Incoming likes are Frendly+ only: non-plus users see a locked state that opens `/paywall`, and Plus users lazy-load likes then send a dating `like` action for one-tap match/chat. Reciprocal likes show a local `MATCH · ОТКРЫТЬ ЧАТ` pill before opening chat. Super-like limit errors from `/dating/actions` open `/paywall`; successful super-like responses can show the remaining quota.
- Communities tab is the V5 clubs surface and mirrors `front/src/pages/v5/Clubs.tsx`: search and filter pill, Frendly+ hero, stats, initials tiles, private/premium/unread badges, media and online meta, next meetup strip and filter sheet count.
- Community detail mirrors `front/src/pages/v5/ClubDetail.tsx`: V5 back/share header, owner-only management action, hero with initials, privacy/premium badges, stats, backend join/exit plus open-chat actions, terracotta tabs, separate news/social sections, V5 meetup cards and member rows. Owners see a create-meetup CTA that opens `/create?communityId=<id>` and publish news through a V5 post composer.
- Chats tab mirrors `front/src/pages/v5/Chats.tsx`: editorial header with only search action, search launcher, active rail, `Все / Встречи / Дейтинг / Личные` chips, mixed all-chat list, terracotta unread counters, v5 fallback rows when backend chats are empty, and terracotta AI launch CTA.
- Chats active rail highlights promoted meetup bubbles with the `ТОП` badge and keeps promoted meetups first inside their phase group.
- Affiche UI lives under `features/affiche/presentation`. Prices are rendered from the backend label semantics as rubles, without `k` abbreviations. Event images must go through shared `BbExternalEventImage` with `rail`, `card` or `hero` usage profiles, stable URL plus profile cache keys and fixed cache buckets. `AfficheEvent.fromJson` resolves relative backend image proxy paths before they reach image widgets. The detail screen opens paid ticket `actionUrl` through `url_launcher` with `LaunchMode.externalApplication`; free events use a non-buy CTA.
- Meetup event summaries can include `imageUrl` from linked Affiche content. `Event.fromJson` resolves relative backend image proxy paths, and Tonight gathering cards render that URL through `BbExternalEventImage` before falling back to emoji gradients.
- Affiche detail address tiles open a bottom sheet with external map choices. Keep Google Maps and Yandex Maps as URL launches, not embedded maps.
- Affiche detail can open Create Meetup through `/create?afficheEventId=<id>`. `CreateMeetupScreen` loads the event detail, prefills title, description, date, place, price and coordinates, then sends `afficheEventId` to `POST /events`. It must not combine affiche source with route source.
- Evening route steps can include `ticketUrl`, `ticketSourceCode` and `ticketProvider`. `EveningPlanScreen` opens HTTPS ticket URLs with `url_launcher` external mode before marking the ticket as bought.
- Meetup chat participants use `memberProfiles.userId` for profile and direct-chat actions. Do not route by display name from `members`.
- Own profile at `/profile` mirrors `front/src/pages/v5/Profile.tsx`: V5 header, hero, social counters, Frendly+ card, intent, vibe, interests, about and history. Do not add the old lower action cards back to this screen.
- Own profile includes V5 quick entries for verification, SOS and notifications. The notifications row uses `notificationUnreadCountProvider`; do not hardcode the badge.
- Settings mirrors `front/src/pages/v5/Settings.tsx`: management header with italic account accent, account, notifications, privacy, appearance and support groups, V5 switches, logout pill and version footer. Do not show internal testing access toggles on this user-facing screen.
- Public user profiles at `/user/:userId` use the same `ProfileV5Content` layout as the main own profile, with public actions layered on top: shared V5 cards, `BbProfilePhotoGallery`, fixed invite/direct-chat actions, social actions and V5 moderation sheet.
- User profiles render `BbSocialActions.full` from `shared/widgets/bb_social_actions.dart`. It uses `ProfileData.social` for the first frame and `profileSocialProvider(userId)` for scoped optimistic follow, like and super-like actions.
- Per-user profile and social providers are auto-disposed by user id after profile/report screens stop listening.
- Reuse `BbSocialActions.compact` or `BbSocialActions.row` only when a list already has bounded social data for that user. Do not start one social request per visible list item.
- Meetup detail at `AppRoute.eventDetail` (`/event/:eventId`) mirrors `front/src/pages/v5/MeetupDetail.tsx`: hero card, when/where/going/duration tiles, verified host with rating, host quote, 3-step program, attendee rail, mini map, conditions, partner perk, Safe Walk and sticky bottom CTA. Join, request, leave and chat navigation still use existing backend flows. Pending join requests disable the primary CTA as `Заявка отправлена` and keep cancel available.
- Meetup detail shows a sticky `Купить билет` action when the event summary has paid Poster or Affiche ticket fields. The button opens `ticketUrl` through `url_launcher` with `LaunchMode.externalApplication`.
- Meetup chat paid ticket CTA is rendered from `MeetupChat` ticket summary fields under the pinned meetup card. It supports legacy Poster and public Affiche sources and opens `ticketUrl` through `url_launcher` external mode.
- Meetup chat can show a compact sticky meetup capsule under the header after scrolling. Keep the main pinned card and all REST/WebSocket chat behavior intact.
- Streak, memory map and perks live at `/streak`, `/memory-map` and `/perks`; they are v5 visual surfaces linked from Home under `Твоё в Frendly`.
- Evening route catalog mirrors `front/src/pages/v5/Routes.tsx`.
- Global system overlays live in `shared/widgets/bb_system_overlays.dart`: admin-ready announcement banner state, city-limit toast, and chat members sheet. Announcement banners use a card surface, left severity stripe, soft icon tile and CTA with arrow.
- Dating discover and likes providers are auto-disposed. Discover does not watch `datingLikesProvider`; likes are loaded only when the likes tab is active and the current subscription is trial or active.
- Stories progress ticker stops after the last story completes and must not restart from build unless the user moves to another story.

## State and network

- `apiClientProvider` creates `ApiClient`.
- `backendRepositoryProvider` maps REST to typed models.
- `chatSocketClientProvider` owns WebSocket client.
- `authTokensProvider` stores token state and refresh flow.
- `chatRealtimeSyncProvider` subscribes to known chat ids. `ChatsScreen` starts it when the chat tab is opened; root must not start chat realtime on authenticated startup.
- Chat local state lives in local providers scoped by chat id.
- Chat attachment and location sends capture permission, picker, map and chat controller references before native picker, GPS and reverse-geocode awaits, then guard `mounted` before UI changes.
- Chat thread and voice playback auto-dispose controllers guard async state writes after network/audio awaits. Chat thread reply scrolling also guards `mounted` and `ScrollController.hasClients` after frame waits.
- Main lists and badges are in `shared/data/app_providers.dart`.
- Notification list and unread count providers return empty state when there is no auth token.
- Notifications screen mirrors `front/src/pages/v5/Notifications.tsx`: V5 warm page, `Все / Приглашения / Чаты` tabs, `Сегодня / Раньше` groups, unread dots and inline invite accept/decline actions. It remains backed by `notificationsProvider` and payload-driven navigation.
- `profileProvider` uses `onboardingProvider` for onboarding-derived interests and intent, so profile screens do not trigger a second `/onboarding/me` request while root routing already watches onboarding.
- `authBootstrapProvider` stores its `/profile/me` result in a one-use `authBootstrapProfileProvider`. `profileProvider` consumes and clears it to avoid a second startup profile request without keeping stale profile data around.
- `authBootstrapProvider` skips `/profile/me` when `replaceAuthenticatedSession` already set `currentUserIdProvider` after a fresh login. Cold app start still validates saved tokens through `/profile/me`.

`ApiClient` adds bearer token, refreshes once on 401 and clears tokens on refresh failure.
It deduplicates concurrent identical GET requests without cancel tokens. The dedupe key includes method, URL, query and auth scope, so same URL requests from different sessions are not coalesced. Use `extra['skipRequestDeduplication'] = true` only when a GET must bypass coalescing.
Auto-disposed feed and detail providers should pass `CancelToken` to repository methods when the repository supports it. Event detail, Affiche detail, Dating discover/likes, evening session/template detail, community feed/detail/media, person profile/social, check-in/live/after-party, host, verification, safety, stories and matches cancel stale requests on provider dispose.
Auth retry preserves per-request Dio options and timeout values.
Release mobile builds should use HTTPS-only backend traffic. Android cleartext is allowed only in debug/profile manifests, and iOS keeps arbitrary ATS loads disabled while local networking stays allowed.

Affiche provider notes:

- `afficheEventsProvider` is keyed by `AfficheEventsQuery` with city, date/date range, price mode, source, category and featured.
- `afficheEventsProvider` is auto-disposed by filter/query key, because picker/search filters can create many short-lived keys.
- Public Affiche feed/detail providers do not wait for `authBootstrapProvider`; they are public reads and should open before private session validation finishes.
- Full Affiche screen uses `afficheEventsPagedProvider`, first page around one viewport and next pages by scroll threshold. Keep previous page visible during filter refresh.
- Full Affiche screen keeps only a compact filter summary above the list. Date, price and category controls open in a modal bottom sheet with a fixed apply button.
- Affiche pagination must be triggered from the screen `ScrollController` listener, not from `ListView.itemBuilder`, so Riverpod state is not changed during build.
- Unknown-price events are not shown as free. Address and coordinates are optional in UI.

## Realtime

- Full thread loads REST history first, then subscribes and syncs.
- Chat thread dispose registration happens when the controller is created, so timers, subscriptions and socket unsubscribe are attached even if initial load is still running.
- App-level sync handles `message.created`, `typing.changed`, `unread.updated`, `notification.created`, `chat.updated`.
- `chat.updated` patches Evening phase fields and invalidates Evening session providers.
- `kind=system` messages render as centered muted pills.

## Evening flow

```text
Tonight Evening hero
  -> EveningBuilder
  -> EveningPlan
  -> LaunchEveningSheet
  -> MeetupChat
  -> EveningLiveMeetup
  -> EveningAfterParty
```

Curated route flow:

```text
Routes catalog
  -> RouteDetail
  -> CreateEveningSession
  -> PublishMeetupScreen
  -> EventDetail after publish
```

Important notes:

- Route catalog mirrors `front/src/pages/v5/Routes.tsx`: V5 header, search pill, mood chips, count line, lazy cards, AppShell V5 bottom nav, no extra city strip, no featured/rest split, and no AI builder prompt at the bottom.
- Published route templates come from backend only. Runtime must not replace empty API responses or request errors with local demo routes.
- Route catalog cards open `/routes/:templateId`; `Запустить` opens `/routes/:templateId?launch=1`, so the v5 detail can switch the CTA copy before launch.
- Route detail mirrors `front/src/pages/v5/RouteDetail.tsx`: warm background, `Маршрут вечера` header with share, v5 hero card, metric tiles, budget row, savings pill, `Шаги вечера` emoji timeline with v5 time separators, one sticky launch CTA above the local V5 bottom nav. Its CTA opens `/routes/:templateId/create`, which resolves the template and opens `PublishMeetupScreen` with a route-backed `CreateMeetupDraft`. Do not bring back the old gradient `Frendly Plan` header, dense action timeline or old launch sheet for this curated route publish path.
- Route catalog builds the main list lazily. Do not replace it with `ListView(children:)` when adding route cards.
- `/routes/:templateId/create` resolves the template to `routeId` and renders the common `PublishMeetupScreen` directly. Keep this path on the common meetup publish UI, not on `EveningPlanScreen` with `autoOpenLaunch`.
- Create meetup mirrors `front/src/pages/v5/CreateMeetup.tsx`: mode tabs, live preview with `Brix · Покровка 12`, title plus lucide icon, icon rail, where/when, attach actions, vibe, price range separators and settings. Active V5 controls and publish CTA use terracotta `#D08A63`. Route selection lives in `features/create_meetup/presentation/widgets/route_picker_sheet.dart` and sends either `routeId` or a custom route payload.
- Event host edit opens `CreateMeetupScreen` through `/create?editEventId=<eventId>`, reusing event detail data to prefill title, place, date, capacity, description, and chips.
- Meetup chat mirrors `front/src/pages/v5/ChatRoom.tsx`: V5 top bar, pinned plan card, ticket strip, external bubble timestamps, voice bubble styling and plus/input/send/mic composer with `Сообщение…`. Host edit opens a V5 modal with title/place/date/capacity fields, save action and a full-window link to `/create?editEventId=<eventId>`.
- Launch seeds local meetup chat summary before opening chat.
- Invite links use `/evening-preview/:sessionId?inviteToken=...`.
- QR issue happens only on tap and polling runs only inside `PartnerOfferQrScreen`. The QR screen cancels the in-flight offer status GET on dispose.
- Auto mode advances from backend worker and refreshes through `chat.updated`.
- EveningBuilder mirrors the React AI chat UI with editable step pills, quick prompts, free text composer and typing state. Quick prompts and free text are sent to `POST /evening/routes/resolve` as `prompt` together with the selected structured answers. The builder cancels backend options and route resolve requests on dispose, and reset cancels an in-flight route resolve.

## Media rules

- Use shared image/media widgets, not raw `Image.network` on hot screens.
- Current static check found network images centralized in shared widgets.
- Profiles: `BbProfilePhotoImage`, `BbProfilePhotoGallery`. They set bounded memory and disk cache dimensions. Keep usage profiles and scoped cache keys when adding profile images.
- Profile photo and avatar URLs from backend are stable `/media/:assetId` paths resolved through `resolveBackendUrl`, not direct CDN URLs.
- Avatars: `BbAvatar` uses size scoped cache keys and avatar-sized decode/cache buckets. Use it for list/chat/profile avatars instead of raw cached images.
- Chat images: `BbChatAttachmentImage`. It resolves local files before remote URLs and uses displayed-size decode/cache buckets for memory, file and network sources.
- `AppMediaPrewarmService` warms a small bounded set of external event and profile images with the same cache keys as the widgets. Use it for first-screen Affiche cards, Tonight rail images and the next Dating cards. Keep concurrency low and limits explicit.
- Private chat media signed download URLs are coalesced in-flight and cached for four minutes in `AppAttachmentService`, keyed by `downloadUrlPath` or media asset id. Keep this path for chat image and voice reuse so repeated widgets do not issue duplicate `/media/:id/download-url` calls.
- Chat thread warmup covers recent ready voice attachments and recent ready image attachments through `AppAttachmentService.warmCache`, not by direct network image reads.
- Brand marks: use `BbBrandIcon`. It points to the compact JPEG brand asset and sets bounded decode dimensions by widget size and device pixel ratio.
- Local profile photo previews in add/edit profile flows must keep bounded decode hints for both width and height.
- Add/edit profile photo upload, primary-photo and delete flows keep busy-state cleanup and show a short failure message instead of letting upload errors escape.
- Voice: `BbVoiceMessage`, `ChatVoicePlaybackController`.
- Voice uploads use the shared presigned upload helper so local files can stream from disk instead of loading the whole recording into memory.
- Chat text, edit, delete, location, attachment and voice sends capture socket/repository/notifiers before awaits, then only rollback or mutate local thread state if the controller is still mounted. Do not cancel user-started uploads on screen dispose without a product decision.
- Chat message actions and microphone permission prompts capture chat controllers or permission services before awaits and avoid local cleanup after the screen is unmounted.
- Meetup chat direct-chat open, live start and join-request actions guard `mounted` after backend awaits before navigation, invalidation or local UI cleanup.
- Chat pending attachments should prefer local file path over local bytes. Keep `localBytes` only for in-memory files without a path so image/file previews do not duplicate upload bytes in heap.
- Native image picking limits camera/gallery images to 1600 px on the longest side with quality 90 and no full metadata request. Keep this for profile, chat and after-party uploads so full-resolution photos do not hit upload, storage and CDN paths.
- Chat composer photo/file/location actions capture `replyTo` before native picker or GPS awaits and clear the reply only after a mounted guard, only if it is still the same reply. Do not let a late attachment/location send clear a new reply selected by the user.
- Chat voice sends should follow the same reply rule: capture `replyTo` before `sendVoiceMessage`, then clear only if that reply is still current.
- Add-photo multi-select upload should stop starting the next profile photo upload after the screen unmounts. Do not remove already completed backend uploads.
- Upload heavy bytes through presigned upload when possible.

## Visual parity

- Source of truth: `front/`.
- Theme tokens: `AppColors`, `AppTextStyles`, `AppSpacing`, `AppRadii`, `AppShadows`, `AppTheme`.
- Fonts: `Sora`, `Manrope`.
- Parity tests: `mobile/test/features/parity/`.
- Desktop fake phone preview in `app/app.dart` lets the screen render under the fake status bar and injects a 44px top `MediaQuery` safe area. Keep the status bar overlay transparent so each screen background fills the whole phone when scrolling or overscrolling.

## Performance notes

- Lists are bounded and lazy.
- Chat initial REST load is 20 messages.
- Chat state is scoped by `chatId`.
- Chat summaries patch local providers instead of refreshing the app.
- Profile state shares onboarding data through `onboardingProvider` instead of fetching `/onboarding/me` separately.
- Authenticated startup shares the first `/profile/me` response with `profileProvider` through a one-use cache.
- Fresh login avoids a redundant bootstrap `/profile/me` because the auth response already provided the current user id.
- Tonight reads route templates for the active manual city through the provider cache, so Home route previews and opening Routes reuse the same hydrated response.
- Auth bootstrap and token refresh must compare the current access/refresh tokens before writing or clearing session state after `/profile/me` or `/auth/refresh` awaits. Persisted token write/delete operations are serialized so logout, refresh and fresh login cannot reorder secure storage state. Session replacement uses a generation guard after runtime cleanup so an older login flow cannot overwrite a newer one.
- Root theme starts from local `SharedPreferences`. Root must not fetch `/settings/me` on authenticated startup; settings and safety screens own `settingsProvider` when opened.
- Root does not start chat realtime or chat-list providers. `ChatsScreen` starts `chatRealtimeSyncProvider` after the user opens chats, so socket connect and chat list REST loads stay off the Home startup path.
- Map viewport event results are auto-disposed by viewport key to avoid retaining old pan/zoom states.
- Affiche filtered feeds are auto-disposed by query/filter key.
- User profile and profile social states are auto-disposed by user id and cancel stale profile/social GET requests on dispose or replaced load.
- Screen-scoped detail providers keyed by id are auto-disposed after detail screens stop listening. Affiche and community detail providers should not watch feed providers just to reuse cache, because direct detail opens can otherwise trigger hidden feed requests. Screen-only providers such as host dashboard, verification, safety hub and matches are auto-disposed. Evening Plan cancels its post-frame backend route GET on dispose. Evening After Party cancels snapshot and pre-upload session GET requests on dispose. Keep global feeds, badges, settings, subscription state and catalogs cached unless there is a measured retention issue.
- Safety has a V5 `/sos` entry in addition to legacy `/safety`. `SafetyHubScreen` renders the hold-to-trigger SOS surface, quick actions, trusted contacts and hotlines while keeping existing safety settings, trusted contact CRUD, reports and blocks.
- Affiche and Affiche picker search fields should not call `setState()` on every raw character before debounce. Keep raw text in `TextEditingController`, then update provider query only after debounce and only when the trimmed query changes.
- Dating discover/likes data is auto-disposed after the screen stops listening. Dating likes are lazy-loaded only when the user opens the likes tab with Frendly+ access.
- Tonight metrics are decorative and must not watch chat, session or people providers. Pass already loaded cheap values from the parent or use static fallback values.
- Meetup chat typing indicator uses one parent `AnimationController` for the three dots. Do not add per-dot controllers for this small repeated animation.
- Meetup chats render through a lazy `ListView.builder`; do not revert to eager `ListView(children: [...])` for long chat sections.
- Create Meetup should watch subscription state only in dating mode. Regular meetup creation must not start subscription checks.
- Evening Plan should watch subscription state only when the route is premium and no premium flag was passed in. Regular routes should not start subscription checks.
- Post-frame callbacks that read providers, focus nodes, controllers, timers or navigation state must guard `mounted` before touching widget state.
- UI flows that await native pickers, geolocation, uploads, creates, publish actions, notification actions, safety actions, user block actions or logout should guard `mounted` before later `ref`, `context`, `Navigator` or `setState` use.
- Safety, settings, verification, host dashboard and profile photo action flows capture repository/services/notifiers and `ProviderContainer` before backend or native awaits, then guard `mounted` before invalidation, navigation, snackbar or local UI cleanup.
- First-run auth, permissions and add-photo flows capture backend repository, session controller, permission/push/media services and photo draft notifiers before native or backend awaits. Permission prompts should use request generation guards so a stale OS response cannot overwrite a newer tile state.
- CTA flows with optimistic state, subscription actions and community publish capture repository/local notifiers before awaits and only invalidate, roll back, show snackbars or navigate after a mounted guard.
- Invalidate-heavy CTA flows should capture `ProviderContainer` before backend, bottom sheet, native picker or GPS awaits, then call `container.invalidate(...)` only after a mounted guard. This keeps notifications invites, paywall, event join/leave/request, check-in, evening live, meetup live/join requests, dating actions, add-photo, safety, verification and community publish paths off widget `ref` after async boundaries.
- Share card and native fallback paths should guard `mounted` after external share, `launchUrl`, canvas capture and clipboard copy awaits before snackbar or copied-state updates. Chat copy and invite copy paths should use explicit post-copy guards, not rely only on snackbar helper guards.
- Map and check-in location helpers capture location service before GPS awaits and return without UI work after unmount.
- Evening preview, publish, live sync, partner QR and after-party upload flows capture backend repository, `ProviderContainer` or media picker before sheet/native/backend awaits and guard mounted before navigation, chat-cache writes or invalidation.
- Evening Plan publish should capture `ProviderContainer` before the launch sheet and backend publish await, then use it for chat cache and session invalidation only after `mounted` and `context.mounted` guards.
- Settings logout should capture current user id plus access/refresh token snapshot before push-token delete, backend logout and local cleanup awaits, then recheck the snapshot before clearing auth state or navigating.
- Root post-frame theme sync, session cleanup, QR polling, after-party snapshot and onboarding debounce callbacks should capture futures/services/controllers before awaits, then use mounted and cancel-token guards before touching UI state.
- Delayed timers, composer callbacks and post-frame callbacks that navigate or show snackbars should check both `mounted` and `context.mounted`. Capture services and callbacks before timer or async dispatch callbacks when possible instead of reading providers or widget callbacks inside the delayed callback.
- Chat mark-read post-frame callbacks should capture the chat controller before scheduling the callback, then only call `markRead()` after a `mounted` guard.
- Bottom-sheet external map fallbacks should pop the sheet with sheet context, then show fallback snackbars through the still-mounted root screen context.
- Onboarding contact validation must guard `mounted` before advancing to the next step after the backend check. Delayed overlay timers should guard `mounted` before calling widget callbacks.
- Provider and controller async paths should not use `await ref.read(...)` directly. Capture repository, futures, services or notifiers before awaiting, then rely on mounted or cancel-token guards where the provider is auto-disposed.
- Feature providers that await auth/bootstrap or subscription state should capture `BackendRepository` and dependent futures before the first await. Dating and Communities feeds follow this pattern.
- Shared app providers should capture `authBootstrapProvider.future`, repositories, cancel tokens and location services before awaits. Community detail fallback should stay backend-backed through `BackendRepository`, not by starting hidden UI provider work after a failed detail request.
- Chat screen owns app-level chat realtime sync. Root only handles auth bootstrap, routing, theme from local preferences and session cleanup.
- Debounced Yandex place search should guard with the current timer identity before and after `searchPlaces`, so an already-started stale request cannot write suggestions after a newer query.
- Map viewport query and fit callbacks should use generation guards around async camera/location work, so stale camera moves or filter changes cannot write old map queries or move the viewport later.
- Multi-step UI timer chains such as AI Voice should use a run generation guard before `setState`, navigation or snackbar work.
- Multiline `await ref.read(...)` is also banned. Direct-chat CTA, report, SOS, check-in and chat attachment actions should capture repository or services before await, then guard UI work with `mounted` or `context.mounted`.
- Chat history mapping should capture current user id before the REST history request, so `mine` flags are not computed from a later session.
- Tonight local search overlay should reuse `sharedPreferencesProvider` through one captured future instead of calling `SharedPreferences.getInstance()` for each recent-search action.
- Session cleanup should capture reset notifiers before persisted storage, private media cache or permission preference awaits, then write the captured notifier states after cleanup.
- Settings logout captures repository, auth notifiers and the app session controller before async work, then clears session/cache without reading `ref` after awaits.
- Settings logout calls shared session runtime cleanup. Session runtime clear coalesces overlapping cleanup requests, resets evening route overrides, and invalidates Affiche, evening session/route, profile social and community media provider families along with chat, onboarding, notifications and photo draft state.
- Chat summary providers and evening route template detail/session providers are auto-disposed by id after their screens stop listening.
- Media upload avoids REST body bytes when presigned upload works.
- Map initial radius is 50 km.

## Checks

```bash
cd mobile && flutter analyze
cd mobile && flutter test
```

Targeted areas:

- Router: `mobile/test/navigation/`.
- Evening: `mobile/test/features/evening_plan/`.
- Chat: `mobile/test/features/chats/presentation/`.
- Shared widgets: `mobile/test/shared/widgets/`.
- Performance: `mobile/test/performance/`.
- Affiche long list performance: `mobile/integration_test/affiche_performance_test.dart` on iOS Simulator or device. It records frame timings and `PaintingBinding.instance.imageCache` after scrolling a long list with external event images.
