# Entry Points Map

Use this for boot files, routes and app starts.

## Mobile app rule

- `mobile2/` это актуальный Flutter клиент.
- `mobile/` устарел. Не используй его для поиска, чтения или правок, если пользователь явно не попросил старое приложение.

## Fast paths

- Flutter boot: `mobile2/lib/main.dart`, `mobile2/lib/app/dateasy_app.dart`.
- Flutter routes: `mobile2/lib/app/dateasy_router.dart`.
- API boot: `backend/apps/api/src/main.ts`, `backend/apps/api/src/app.module.ts`.
- Chat boot: `backend/apps/chat/src/main.ts`, `backend/apps/chat/src/chat-server.service.ts`.
- Worker boot: `backend/apps/worker/src/main.ts`, `backend/apps/worker/src/worker.service.ts`.
- Telegram relay boot: `backend/apps/telegram-relay/src/main.ts`.
- DB schema: `backend/packages/database/prisma/schema.prisma`.
- Contracts: `backend/packages/contracts/src/index.ts`.
- Visual source: `front/src/pages/v5/` and `front/src/pages/HomeV5.tsx`.
- Landing: `landing/src/App.tsx`, `landing/src/pages/Landing.tsx`, `landing/src/pages/Partners.tsx`.

## Flutter app

`mobile2/lib/main.dart`:

- ensures widgets binding
- starts edge-to-edge system UI setup and `SharedPreferences` init concurrently
- restores auth tokens after prefs are ready. Secure storage read starts before sync prefs inspection inside `restoreInitialAuthTokens`
- starts Riverpod root

`mobile2/lib/app/dateasy_app.dart`:

- builds `MaterialApp.router`
- wires theme, router and session clear
- listens to app links for payment return URLs. `frendly://payment/<success|fail>?orderId=...` and `dateasy://payment/<success|fail>?orderId=...` close the in-app browser, invalidate wallet/payment/subscription providers and route to `/wallet`
- does not start chat realtime or `/settings/me` on authenticated startup

`mobile2/lib/app/core/config/backend_config.dart`:

- API URL
- chat WebSocket URL
- Telegram bot URL

## Flutter navigation

`mobile2/lib/app/dateasy_router.dart`:

- `GoRouter`
- public/setup/auth redirects
- route table for current mobile2 screens

Important query params:

- `/phone` and `/phone-auth`
- `/ai-create`
- `/ai-voice`
- `/after-dark`
- `/streak`
- `/memory-map`
- `/perks`
- `/map?eventId=<id>`
- `/meetups`
- `/host`
- `/giveaways`
- `/create?inviteeUserId=<id>`
- `/create?communityId=<id>`
- `/create?mode=dating`
- `/publish`
- `/sos`
- `/routes/new`
- `/evening-builder` legacy redirects to `/ai-create`
- `/permissions` and `/add-photo` legacy setup links redirect to `/onboarding` or `/tonight`
- `/tokens/focus`, `/tokens/balance`, `/tokens/top-up` and `/tokens/boost` legacy token links redirect to `/wallet`
- `/wallet?paymentResult=<success|fail>&orderId=<id>&productKind=<kind>` is the mobile landing route after T-Bank redirects back through `frendly://payment/...`
- `/chats`
- `/chats/:chatId`
- `/posters`
- `/posters/:posterId`
- `/meetings/new?afficheEventId=<id>`
- `/meetings/:meetingId?inviteRequestId=<requestId>` opens meeting detail with invite accept CTA
- `/evening/:eventId`
- `/evening-plan/:routeId?launch=1`
- `/evening-live/:routeId?mode=auto|manual|hybrid`

## Flutter network

- HTTP: `mobile2/lib/app/core/network/api_client.dart`.
- Repository: `mobile2/lib/shared/data/backend_repository.dart`.
- WebSocket: `mobile2/lib/app/core/network/chat_socket_client.dart`.
- App realtime providers live in `mobile2/lib/shared/data/app_providers.dart`.

## Flutter features

- Tonight: `features/tonight/presentation/tonight_screen.dart`.
- V5 search modal: `features/tonight/presentation/v5_search_modal.dart`.
- Map: `features/map/presentation/map_screen.dart`.
- Meetups list: `features/meetings/presentation/meetings_screen.dart`.
- New meeting: `features/meetings/presentation/new_meeting_screen.dart`.
- Affiche: `features/posters/presentation/posters_screen.dart`, `features/posters/presentation/poster_detail_screen.dart`.
- Event detail: `features/meetings/presentation/meeting_detail_screen.dart`.
- Streak: `features/streak/presentation/streak_screen.dart`.
- Memory map: `features/memory_map/presentation/memory_map_screen.dart`.
- Perks: `features/perks/presentation/perks_screen.dart`.
- AI voice: `features/ai_voice/presentation/ai_voice_screen.dart`.
- After Dark: `features/after_dark/presentation/after_dark_screen.dart`.
- Create meetup: `features/create_meetup/presentation/create_meetup_screen.dart`.
- Host dashboard: `features/host_dashboard/presentation/host_dashboard_screen.dart`.
- Giveaways: `features/giveaways/presentation/giveaways_screen.dart`.
- Chat hub: `features/chats/presentation/chats_screen.dart`.
- Chat thread: `features/chats/presentation/meeting_chat_screen.dart`.
- Evening: `features/evening_plan/presentation/`, `features/evening_routes/presentation/`.
- Unified meetup evening flow: `features/evening_flow/presentation/evening_flow_screen.dart`.
- Communities: `features/communities/presentation/`.
- Dating: `features/dating/presentation/`.
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
- `front/src/pages/HomeV5.tsx`
- `front/src/pages/v5/`
- `front/src/pages/v5/_tokens.ts`
- `front/src/pages/v5/_ui.tsx`
- `front/src/pages/v5/_BottomNav.tsx`
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

