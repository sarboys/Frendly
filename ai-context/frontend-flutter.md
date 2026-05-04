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
- Search date filter is `yyyy-mm-dd` or `any` and counts as an active filter.
- `BackendRepository` is the shared REST mapping boundary.
- Affiche uses a separate `AfficheEvent` model under `shared/models`, because imported paid events may have no address or coordinates. `BackendRepository` owns `fetchAfficheEvents` and `fetchAfficheEventDetail`.
- Chat local state is scoped by chat id.
- Tonight location can be overridden manually through `manualLocationProvider`. Nearby event feed and city-limited Tonight entries must prefer manual coordinates/city before device GPS.
- Tonight shows an affiche rail for the current manual city. The rail "all" action opens `/affiche`, not the legacy posters feed. Search shows an affiche results block. KudaGo places must not be mixed into these event rails.
- Affiche UI lives under `features/affiche/presentation`. Prices are rendered from the backend label semantics as rubles, without `k` abbreviations. Event images must go through shared `BbExternalEventImage` with `rail`, `card` or `hero` usage profiles, stable URL plus profile cache keys and fixed cache buckets. The detail screen opens paid ticket `actionUrl` through `url_launcher` with `LaunchMode.externalApplication`; free events use a non-buy CTA.
- Affiche detail address tiles open a bottom sheet with external map choices. Keep Google Maps and Yandex Maps as URL launches, not embedded maps.
- Affiche detail can open Create Meetup through `/create?afficheEventId=<id>`. `CreateMeetupScreen` loads the event detail, prefills title, description, date, place, price and coordinates, then sends `afficheEventId` to `POST /events`. It must not combine affiche source with poster or route source.
- Evening route steps can include `ticketUrl`, `ticketSourceCode` and `ticketProvider`. `EveningPlanScreen` opens HTTPS ticket URLs with `url_launcher` external mode before marking the ticket as bought.
- Meetup chat participants use `memberProfiles.userId` for profile and direct-chat actions. Do not route by display name from `members`.
- Evening route catalog mirrors `front/src/components/bigbreak/screens/Routes.tsx`.
- Global system overlays live in `shared/widgets/bb_system_overlays.dart`: admin-ready announcement banner state, city-limit toast, and chat members sheet.

## State and network

- `apiClientProvider` creates `ApiClient`.
- `backendRepositoryProvider` maps REST to typed models.
- `chatSocketClientProvider` owns WebSocket client.
- `authTokensProvider` stores token state and refresh flow.
- `chatRealtimeSyncProvider` subscribes to known chat ids.
- Chat local state lives in local providers scoped by chat id.
- Main lists and badges are in `shared/data/app_providers.dart`.

`ApiClient` adds bearer token, refreshes once on 401 and clears tokens on refresh failure.

Affiche provider notes:

- `afficheEventsProvider` is keyed by `AfficheEventsQuery` with city, date/date range, price mode, source, category and featured.
- Full Affiche screen uses `afficheEventsPagedProvider`, first page around one viewport and next pages by scroll threshold. Keep previous page visible during filter refresh.
- Affiche pagination must be triggered from the screen `ScrollController` listener, not from `ListView.itemBuilder`, so Riverpod state is not changed during build.
- Unknown-price events are not shown as free. Address and coordinates are optional in UI.

## Realtime

- Full thread loads REST history first, then subscribes and syncs.
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
- Profiles: `BbProfilePhotoImage`, `BbProfilePhotoGallery`.
- Chat images: `BbChatAttachmentImage`.
- Voice: `BbVoiceMessage`, `ChatVoicePlaybackController`.
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
