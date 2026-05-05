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

- Splash uses the Frendly 4-act intro: pulse, interest orbit, route formation, brand reveal.
- Search results are grouped as meetups, evenings, routes, posters and affiche.
- Search separates discovery and remote search modes. During remote search it must not watch `eventsProvider('nearby')` or `peopleProvider`.
- Search remote results use an `autoDispose` family provider so old query/filter result states are released after the screen stops listening.
- Search date filter is `yyyy-mm-dd` or `any` and counts as an active filter.
- `BackendRepository` is the shared REST mapping boundary.
- Affiche uses a separate `AfficheEvent` model under `shared/models`, because imported paid events may have no address or coordinates. `BackendRepository` owns `fetchAfficheEvents` and `fetchAfficheEventDetail`.
- Chat local state is scoped by chat id.
- Tonight location can be overridden manually through `manualLocationProvider`. Nearby event feed and city-limited Tonight entries must prefer manual coordinates/city before device GPS.
- Debounced Yandex place search in onboarding, Tonight manual location and Create Meetup place picker must guard `mounted`, catch search errors, and clear loading only for the current query.
- Map viewport events use an `autoDispose` family provider because query keys change with camera center/bounds.
- Tonight shows an affiche rail for the current manual city. The rail "all" action opens `/affiche`, not the legacy posters feed. Search shows an affiche results block. KudaGo places must not be mixed into these event rails.
- Tonight poster preview loads featured posters only as a fallback when Affiche data is empty or failed.
- Tonight people preview is placed in a lazy sliver item so `peopleProvider` is not watched during initial top-screen build.
- Affiche UI lives under `features/affiche/presentation`. Prices are rendered from the backend label semantics as rubles, without `k` abbreviations. Event images must go through shared `BbExternalEventImage` with `rail`, `card` or `hero` usage profiles, stable URL plus profile cache keys and fixed cache buckets. The detail screen opens paid ticket `actionUrl` through `url_launcher` with `LaunchMode.externalApplication`; free events use a non-buy CTA.
- Affiche detail address tiles open a bottom sheet with external map choices. Keep Google Maps and Yandex Maps as URL launches, not embedded maps.
- Affiche detail can open Create Meetup through `/create?afficheEventId=<id>`. `CreateMeetupScreen` loads the event detail, prefills title, description, date, place, price and coordinates, then sends `afficheEventId` to `POST /events`. It must not combine affiche source with poster or route source.
- Evening route steps can include `ticketUrl`, `ticketSourceCode` and `ticketProvider`. `EveningPlanScreen` opens HTTPS ticket URLs with `url_launcher` external mode before marking the ticket as bought.
- Meetup chat participants use `memberProfiles.userId` for profile and direct-chat actions. Do not route by display name from `members`.
- User profiles render `BbSocialActions.full` from `shared/widgets/bb_social_actions.dart`. It uses `ProfileData.social` for the first frame and `profileSocialProvider(userId)` for scoped optimistic follow, like and super-like actions.
- Per-user profile and social providers are auto-disposed by user id after profile/report screens stop listening.
- Reuse `BbSocialActions.compact` or `BbSocialActions.row` only when a list already has bounded social data for that user. Do not start one social request per visible list item.
- Meetup chat paid ticket CTA is rendered from `MeetupChat` ticket summary fields under the pinned meetup card. It supports legacy Poster and public Affiche sources and opens `ticketUrl` through `url_launcher` external mode.
- Evening route catalog mirrors `front/src/components/bigbreak/screens/Routes.tsx`.
- Global system overlays live in `shared/widgets/bb_system_overlays.dart`: admin-ready announcement banner state, city-limit toast, and chat members sheet. Announcement banners use a card surface, left severity stripe, soft icon tile and CTA with arrow.
- Dating discover and likes providers are auto-disposed. Discover does not watch `datingLikesProvider`; likes are loaded only when the likes tab is active.
- Stories progress ticker stops after the last story completes and must not restart from build unless the user moves to another story.

## State and network

- `apiClientProvider` creates `ApiClient`.
- `backendRepositoryProvider` maps REST to typed models.
- `chatSocketClientProvider` owns WebSocket client.
- `authTokensProvider` stores token state and refresh flow.
- `chatRealtimeSyncProvider` subscribes to known chat ids. Root queues it after the first frame and only for a stable authenticated user id.
- Chat local state lives in local providers scoped by chat id.
- Chat attachment and location sends guard `mounted` after native picker, GPS and reverse-geocode awaits before reading providers again.
- Chat thread and voice playback auto-dispose controllers guard async state writes after network/audio awaits. Chat thread reply scrolling also guards `mounted` and `ScrollController.hasClients` after frame waits.
- Main lists and badges are in `shared/data/app_providers.dart`.
- Notification list and unread count providers return empty state when there is no auth token.
- `profileProvider` uses `onboardingProvider` for onboarding-derived interests and intent, so profile screens do not trigger a second `/onboarding/me` request while root routing already watches onboarding.
- `authBootstrapProvider` stores its `/profile/me` result in a one-use `authBootstrapProfileProvider`. `profileProvider` consumes and clears it to avoid a second startup profile request without keeping stale profile data around.
- `authBootstrapProvider` skips `/profile/me` when `replaceAuthenticatedSession` already set `currentUserIdProvider` after a fresh login. Cold app start still validates saved tokens through `/profile/me`.

`ApiClient` adds bearer token, refreshes once on 401 and clears tokens on refresh failure.
Auth retry preserves per-request Dio options and timeout values.

Affiche provider notes:

- `afficheEventsProvider` is keyed by `AfficheEventsQuery` with city, date/date range, price mode, source, category and featured.
- `afficheEventsProvider` and `posterFeedProvider` are auto-disposed by filter/query key, because picker/search filters can create many short-lived keys.
- Full Affiche screen uses `afficheEventsPagedProvider`, first page around one viewport and next pages by scroll threshold. Keep previous page visible during filter refresh.
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
  -> EveningPlan
  -> LaunchEveningSheet with launch=1 from "Создать встречу"
  -> MeetupChat after publish
```

Important notes:

- Route catalog mirrors `front/src/components/bigbreak/screens/Routes.tsx`.
- Published route templates come from backend and use local fallback data for parity.
- Route catalog cards use `routeId` and open `/evening-plan/:routeId`; create CTA opens `/evening-plan/:routeId?launch=1`.
- Route catalog builds the main list lazily. Do not replace it with `ListView(children:)` when adding route cards.
- Legacy `/routes/:templateId` and `/routes/:templateId/create` entry points resolve the template to `routeId` and render the same `EveningPlanScreen`, with `autoOpenLaunch` for create. They pass the fetched template detail as `initialRoute` so generated routes do not flash local fallback mocks before the route API hydrates.
- Create meetup has icon-only source actions under `Где`: poster, partner, route. Route selection lives in `features/create_meetup/presentation/widgets/route_picker_sheet.dart` and sends either `routeId` or a custom route payload.
- Event host edit opens `CreateMeetupScreen` through `/create?editEventId=<eventId>`, reusing event detail data to prefill title, place, date, capacity, description, and chips.
- Launch seeds local meetup chat summary before opening chat.
- Invite links use `/evening-preview/:sessionId?inviteToken=...`.
- QR issue happens only on tap and polling runs only inside `PartnerOfferQrScreen`.
- Auto mode advances from backend worker and refreshes through `chat.updated`.

## Media rules

- Use shared image/media widgets, not raw `Image.network` on hot screens.
- Current static check found network images centralized in shared widgets.
- Profiles: `BbProfilePhotoImage`, `BbProfilePhotoGallery`. They set bounded memory and disk cache dimensions. Keep usage profiles and scoped cache keys when adding profile images.
- Avatars: `BbAvatar` uses size scoped cache keys and avatar-sized decode/cache buckets. Use it for list/chat/profile avatars instead of raw cached images.
- Chat images: `BbChatAttachmentImage`. It resolves local files before remote URLs and uses displayed-size decode/cache buckets for memory, file and network sources.
- Brand marks: use `BbBrandIcon`. It points to the compact JPEG brand asset and sets bounded decode dimensions by widget size and device pixel ratio.
- Local profile photo previews in add/edit profile flows must keep bounded decode hints for both width and height.
- Add/edit profile photo upload, primary-photo and delete flows keep busy-state cleanup and show a short failure message instead of letting upload errors escape.
- Voice: `BbVoiceMessage`, `ChatVoicePlaybackController`.
- Voice uploads use the shared presigned upload helper so local files can stream from disk instead of loading the whole recording into memory.
- Upload heavy bytes through presigned upload when possible.

## Visual parity

- Source of truth: `front/`.
- Theme tokens: `AppColors`, `AppTextStyles`, `AppSpacing`, `AppRadii`, `AppShadows`, `AppTheme`.
- Fonts: `Sora`, `Manrope`.
- Parity tests: `mobile/test/features/parity/`.

## Performance notes

- Lists are bounded and lazy.
- Chat initial REST load is 20 messages.
- Chat state is scoped by `chatId`.
- Chat summaries patch local providers instead of refreshing the app.
- Profile state shares onboarding data through `onboardingProvider` instead of fetching `/onboarding/me` separately.
- Authenticated startup shares the first `/profile/me` response with `profileProvider` through a one-use cache.
- Fresh login avoids a redundant bootstrap `/profile/me` because the auth response already provided the current user id.
- Root theme starts from local `SharedPreferences`. Remote `settingsProvider` sync into `appThemeModeProvider` is queued after the first frame and only for a stable authenticated user id.
- Root chat realtime sync is queued after the first frame so socket connect and chat-list provider listeners do not start inside the authenticated root build. Root triggers one rebuild after starting it so bottom navigation can attach to chat badge providers.
- Remote search results are auto-disposed by query/filter key to avoid retaining old search states.
- Map viewport event results are auto-disposed by viewport key to avoid retaining old pan/zoom states.
- Poster and Affiche filtered feeds are auto-disposed by query/filter key.
- User profile and profile social states are auto-disposed by user id.
- Screen-scoped detail providers keyed by id are auto-disposed after detail screens stop listening. Poster, Affiche and community detail providers should not watch feed providers just to reuse cache, because direct detail opens can otherwise trigger hidden feed requests. Screen-only providers such as host dashboard, verification, safety hub, matches and After Dark events are auto-disposed. Keep global feeds, badges, settings, subscription state and catalogs cached unless there is a measured retention issue.
- Poster picker search is debounced before watching `posterFeedProvider`, matching other remote search surfaces.
- Dating discover/likes data is auto-disposed after the screen stops listening. Dating likes are lazy-loaded only when the user opens the likes tab.
- Meetup chats render through a lazy `ListView.builder`; do not revert to eager `ListView(children: [...])` for long chat sections.
- Profile lower action cards own their matches and After Dark provider watches. Keep profile hero data independent from lower-block provider state.
- Create Meetup should watch subscription state only in dating mode and After Dark access only in afterdark mode. Regular meetup creation must not start those access checks.
- Evening Plan should watch subscription state only when the route is premium and no premium flag was passed in. Regular routes should not start subscription checks.
- Post-frame callbacks that read providers, focus nodes, controllers, timers or navigation state must guard `mounted` before touching widget state.
- UI flows that await native pickers, geolocation, uploads, creates, publish actions, notification actions, safety actions, user block actions or logout should guard `mounted` before later `ref`, `context`, `Navigator` or `setState` use.
- Settings logout captures repository, auth notifiers and the app session controller before async work, then clears session/cache without reading `ref` after awaits.
- Settings logout calls shared session runtime cleanup. Session runtime clear coalesces overlapping cleanup requests, resets evening route overrides, and invalidates Affiche, evening session/route, profile social and community media provider families along with chat, onboarding, notifications and photo draft state.
- Chat summary providers and evening route template detail/session providers are auto-disposed by id after their screens stop listening.
- Media upload avoids REST body bytes when presigned upload works.
- Map initial radius is 25 km.

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
