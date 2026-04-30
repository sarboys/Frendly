# Entry Points Map

Use this for boot files, routes and app starts.

## Fast paths

- Flutter boot: `mobile/lib/main.dart`, `mobile/lib/app/app.dart`.
- Flutter routes: `mobile/lib/app/navigation/app_routes.dart`, `mobile/lib/app/navigation/app_router.dart`.
- Flutter shell: `mobile/lib/app/navigation/app_shell.dart`, `mobile/lib/shared/widgets/bb_bottom_nav.dart`.
- API boot: `backend/apps/api/src/main.ts`, `backend/apps/api/src/app.module.ts`.
- Chat boot: `backend/apps/chat/src/main.ts`, `backend/apps/chat/src/chat-server.service.ts`.
- Worker boot: `backend/apps/worker/src/main.ts`, `backend/apps/worker/src/worker.service.ts`.
- Telegram relay boot: `backend/apps/telegram-relay/src/main.ts`.
- DB schema: `backend/packages/database/prisma/schema.prisma`.
- Contracts: `backend/packages/contracts/src/index.ts`.
- Visual source: `front/src/components/bigbreak/BigBreakApp.tsx`.
- Landing: `landing/src/App.tsx`, `landing/src/pages/Landing.tsx`, `landing/src/pages/Partners.tsx`.

## Flutter app

`mobile/lib/main.dart`:

- ensures widgets binding
- initializes `SharedPreferences`
- restores auth tokens
- starts Riverpod root

`mobile/lib/app/app.dart`:

- builds `MaterialApp.router`
- wires theme, router, session clear and realtime sync

`mobile/lib/app/core/config/backend_config.dart`:

- API URL
- chat WebSocket URL
- Telegram bot URL

## Flutter navigation

`mobile/lib/app/navigation/app_routes.dart`:

- route enum
- `pushRoute` and `goRoute`

`mobile/lib/app/navigation/app_router.dart`:

- `GoRouter`
- public/setup/auth redirects
- shell tabs and push screens

Shell tabs:

- `tonight` -> `TonightScreen`
- `chats` -> `ChatsScreen`
- `communities` -> `CommunitiesScreen`
- `dating` -> `DatingScreen`
- `profile` -> `ProfileScreen`

Important query params:

- `/map?eventId=<id>`
- `/create?inviteeUserId=<id>`
- `/create?posterId=<id>`
- `/create?communityId=<id>`
- `/create?mode=dating`
- `/create?mode=afterdark`
- `/evening-plan/:routeId?launch=1`
- `/evening-live/:routeId?mode=auto|manual|hybrid`

## Flutter network

- HTTP: `mobile/lib/app/core/network/api_client.dart`.
- Repository: `mobile/lib/shared/data/backend_repository.dart`.
- WebSocket: `mobile/lib/app/core/network/chat_socket_client.dart`.
- App realtime sync: `chatRealtimeSyncProvider` in `mobile/lib/shared/data/app_providers.dart`.

## Flutter features

- Tonight: `features/tonight/presentation/tonight_screen.dart`.
- Search: `features/search/presentation/search_screen.dart`.
- Map: `features/map/presentation/map_screen.dart`.
- Posters: `features/posters/presentation/`.
- Event detail: `features/event_detail/presentation/`.
- Create meetup: `features/create_meetup/presentation/create_meetup_screen.dart`.
- Chat hub: `features/chats/presentation/chats_screen.dart`.
- Meetup chat: `features/meetup_chat/presentation/meetup_chat_screen.dart`.
- Personal chat: `features/personal_chat/presentation/personal_chat_screen.dart`.
- Evening: `features/evening_plan/presentation/`, `features/evening_routes/presentation/`.
- Communities: `features/communities/presentation/`.
- Dating: `features/dating/presentation/`.
- After Dark: `features/after_dark/presentation/`.
- Profile/settings: `features/profile/`, `features/edit_profile/`, `features/settings/`, `features/verification/`.
- Safety: `features/safety/presentation/safety_hub_screen.dart`, `features/report/presentation/report_screen.dart`.

## Backend API

`backend/apps/api/src/main.ts`:

- creates `ApiAppModule`
- configures CORS and validation
- listens on `PORT`, default `3000`

`backend/apps/api/src/app.module.ts`:

- registers controllers and services
- registers global auth guard
- registers exception filter
- applies request context middleware

Common starts:

- `backend/apps/api/src/common/auth.guard.ts`
- `backend/apps/api/src/common/api-exception.filter.ts`

## Chat server

`backend/apps/chat/src/main.ts`:

- creates `ChatAppModule`
- attaches WebSocket server
- listens on `PORT`, default `3001`

`backend/apps/chat/src/chat-server.service.ts` owns socket lifecycle, auth, subscriptions, messages, sync and Redis bus.

## Worker

`backend/apps/worker/src/main.ts` starts worker Nest app and loop.

`backend/apps/worker/src/worker.service.ts` processes outbox, push, media finalize, realtime publish, notification fanout and unread fanout.

## Telegram relay

- `backend/apps/telegram-relay/src/main.ts`
- `backend/apps/telegram-relay/src/telegram-relay.service.ts`

It polls Telegram Bot API and routes updates to API.

## Database and packages

- `backend/packages/database/prisma/schema.prisma`
- `backend/packages/database/src/index.ts`
- `backend/packages/database/src/auth-tokens.ts`
- `backend/packages/database/src/pubsub.ts`
- `backend/packages/database/src/s3.ts`
- `backend/packages/database/src/outbox.ts`
- `backend/packages/contracts/src/index.ts`

## React visual source

- `front/src/main.tsx`
- `front/src/App.tsx`
- `front/src/components/bigbreak/BigBreakApp.tsx`
- `front/src/components/bigbreak/screens/`
- `front/src/components/bigbreak/data.ts`
- `front/src/index.css`
- `front/tailwind.config.ts`

## Landing

- `landing/src/main.tsx`
- `landing/src/App.tsx`
- `landing/src/pages/Landing.tsx`
- `landing/src/pages/Partners.tsx`
- `landing/src/pages/PublicSharePage.tsx`
- `landing/src/pages/OfferCodePage.tsx`
- `landing/src/components/landing/AnimatedDemo.tsx`
- `landing/src/index.css`
- `landing/tailwind.config.ts`
- `landing/vite.config.ts`
- `landing/Dockerfile`
- `landing/nginx.conf`
- `landing/.github/workflows/deploy.yml`
- `scripts/deploy-landing.sh`

Landing routes:

- `/`
- `/landing`
- `/partners`
- `/code/:code`
- `/:slug`

## Admin

- `admin/src/main.tsx`
- `admin/src/App.tsx`
- `admin/src/admin/AdminLayout.tsx`
- `admin/src/admin/pages/`
- `admin/src/admin/api/client.ts`

## Deploy starts

- `backend/Dockerfile`
- `compose.yaml`
- `compose.prod.yml`
- `compose.telegram-relay.yml`
- `deploy/nginx/frendly.conf`
- `.github/workflows/deploy.yml`
- `scripts/bootstrap-server.sh`
- `scripts/deploy.sh`

