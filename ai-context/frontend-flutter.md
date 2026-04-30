# Frontend Flutter Map

Use this for Flutter screens, navigation, state, UI parity and performance.

## Fast paths

- App boot: `mobile/lib/main.dart`, `mobile/lib/app/app.dart`.
- Routes: `mobile/lib/app/navigation/app_routes.dart`, `mobile/lib/app/navigation/app_router.dart`.
- Shell: `mobile/lib/app/navigation/app_shell.dart`.
- Theme: `mobile/lib/app/theme/`.
- API client: `mobile/lib/app/core/network/api_client.dart`.
- WebSocket client: `mobile/lib/app/core/network/chat_socket_client.dart`.
- Backend repository: `mobile/lib/shared/data/backend_repository.dart`.
- Shared providers: `mobile/lib/shared/data/app_providers.dart`.
- Shared widgets: `mobile/lib/shared/widgets/`.

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

## Main routes

First run:

- `/splash`, `/welcome`, `/phone-auth`, `/telegram-auth`, `/permissions`, `/add-photo`, `/onboarding`.

Shell tabs:

- `/tonight`, `/chats`, `/communities`, `/dating`, `/profile`.

Discovery:

- `/search`, `/map`, `/posters`, `/poster/:posterId`, `/event/:eventId`, `/create`.

Chat:

- `/meetup/:chatId`, `/personal/:chatId`, `/community/:communityId/chat`.

Evening:

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
- `/offer-code/:codeId`

Profile and settings:

- `/user/:userId`, `/edit-profile`, `/settings`, `/verification`, `/safety`, `/report/:userId`.

Dating and After Dark:

- `/paywall`, `/match/:userId`, `/after-dark`, `/after-dark/paywall`, `/after-dark/event/:eventId`, `/after-dark/verify`.

## Router behavior

- `buildAppRouter` creates `GoRouter`.
- Initial route: `/splash`.
- Guest outside public routes goes to `/welcome`.
- Authenticated user on public route goes to `/tonight`.
- Incomplete onboarding goes to `/onboarding`.
- Shell tabs use `ShellRoute` and `AppShell`.

## Feature index

First run:

- Screens: `splash`, `welcome`, `phone_auth`, `telegram_auth`, `permissions`, `add_photo`, `onboarding`.
- Auth state: `app/core/providers/core_providers.dart`.
- Social auth controller: `features/welcome/application/social_auth_controller.dart`.
- Phone field: `shared/widgets/bb_phone_number_field.dart`.

Discovery and events:

- Tonight: `features/tonight/presentation/tonight_screen.dart`.
- Search: `features/search/presentation/search_screen.dart`.
- Map: `features/map/presentation/map_screen.dart`.
- Posters: `features/posters/presentation/`.
- Event detail: `features/event_detail/presentation/`.
- Create meetup: `features/create_meetup/presentation/create_meetup_screen.dart`.

Chats:

- Hub: `features/chats/presentation/chats_screen.dart`.
- Thread state: `features/chats/presentation/chat_thread_providers.dart`.
- Thread UI: `features/chats/presentation/chat_thread_screen.dart`.
- Meetup wrapper: `features/meetup_chat/presentation/meetup_chat_screen.dart`.
- Personal wrapper: `features/personal_chat/presentation/personal_chat_screen.dart`.
- Chat model: `shared/models/meetup_chat.dart`.

Frendly Evening:

- Route catalog: `features/evening_routes/presentation/evening_routes_screen.dart`.
- Route detail: `features/evening_routes/presentation/evening_route_detail_screen.dart`.
- Create route meeting: `features/evening_routes/presentation/create_evening_session_screen.dart`.
- QR screen: `features/evening_routes/presentation/partner_offer_qr_screen.dart`.
- Builder and plan: `features/evening_plan/presentation/`.
- Session model: `shared/models/evening_session.dart`.

Other:

- Communities: `features/communities/`.
- Dating: `features/dating/presentation/`, model `shared/models/dating_profile.dart`.
- After Dark: `features/after_dark/presentation/`.
- Profile and settings: `features/profile/`, `features/edit_profile/`, `features/settings/`, `features/verification/`.
- Safety: `features/safety/`, `features/report/`.

## State and network

- `apiClientProvider` creates `ApiClient`.
- `backendRepositoryProvider` maps REST to typed models.
- `chatSocketClientProvider` owns WebSocket client.
- `authTokensProvider` stores token state and refresh flow.
- `chatRealtimeSyncProvider` subscribes to known chat ids.
- Chat local state lives in local providers scoped by chat id.
- Main lists and badges are in `shared/data/app_providers.dart`.

`ApiClient` adds bearer token, refreshes once on 401 and clears tokens on refresh failure.

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
  -> Route detail or create meeting
  -> EveningPreview
  -> join/request/invite
  -> MeetupChat
```

Important notes:

- Route catalog mirrors `front/src/components/bigbreak/screens/Routes.tsx`.
- Published route templates come from backend and use local fallback data for parity.
- Create meetup has icon-only source actions under `Где`: poster, partner, route. Route selection lives in `features/create_meetup/presentation/widgets/route_picker_sheet.dart` and sends either `routeId` or a custom route payload.
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
