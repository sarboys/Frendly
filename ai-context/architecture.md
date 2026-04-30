# Architecture Map

Общая карта проекта. Перед ней читай `project_map.md` и `ai-context/index.md`.

## Выбор следующей карты

- Flutter, UI, routes, state, performance: `ai-context/frontend-flutter.md`.
- REST API, controllers, services, DTO, tests: `ai-context/backend-api.md`.
- Prisma, models, migrations, seed, indexes: `ai-context/database.md`.
- Chat, WebSocket, unread, sync, attachments: `ai-context/realtime-chat.md`.
- Auth, sessions, JWT, Telegram, Google, Yandex: `ai-context/auth.md`.
- Docker, deploy, worker, Redis, S3, push: `ai-context/infra.md`.
- Landing site: `ai-context/landing.md`.
- Boot files and routes: `ai-context/entry-points.md`.

## Product shape

- Product: Frendly.
- Mobile client: Flutter in `mobile/`.
- Backend: NestJS monorepo in `backend/`.
- Realtime: `backend/apps/chat/`.
- Background jobs: `backend/apps/worker/`.
- Telegram relay: `backend/apps/telegram-relay/`.
- Visual source: `front/`.
- Landing: `landing/`.
- Admin: `admin/`.

## Runtime

```text
Flutter mobile
  -> REST API, backend/apps/api, port 3000
  -> WebSocket, backend/apps/chat, port 3001

API
  -> PostgreSQL, Prisma
  -> S3 compatible storage
  -> OutboxEvent

Chat server
  -> PostgreSQL
  -> Redis pub/sub
  -> RealtimeEvent
  -> OutboxEvent

Worker
  -> OutboxEvent
  -> Redis pub/sub
  -> S3 HeadObject
  -> push providers

Landing
  -> Vite static build
  -> nginx container
```

## Main paths

- `mobile/lib/main.dart`: Flutter boot.
- `mobile/lib/app/app.dart`: root widget.
- `mobile/lib/app/navigation/`: routes, router, shell.
- `mobile/lib/shared/data/`: repository and shared providers.
- `backend/apps/api/src/`: REST API.
- `backend/apps/chat/src/`: WebSocket server.
- `backend/apps/worker/src/`: worker loop.
- `backend/packages/database/`: Prisma, JWT, Redis, S3, outbox.
- `backend/packages/contracts/src/index.ts`: DTO and WebSocket contracts.
- `front/src/components/bigbreak/`: visual reference.
- `landing/src/`: landing app.

## Core flows

Auth:

- Flutter token state: `mobile/lib/app/core/providers/core_providers.dart`.
- API: `auth.controller.ts`, `auth.service.ts`, `telegram-auth.service.ts`, `social-auth.service.ts`.
- DB: `Session`, `PhoneOtpChallenge`, `TelegramAccount`, `TelegramLoginSession`, `ExternalAuthAccount`.
- Details: `ai-context/auth.md`.

Discovery and events:

- Flutter: `tonight`, `search`, `map`, `posters`, `event_detail`.
- API: `EventsService`, `PostersService`.
- DB: `Event`, `Poster`, participants, requests, attendance, live state, feedback, stories.

Chats and realtime:

- Flutter: `ChatSocketClient`, `ChatThreadController`, `ChatsScreen`.
- API history: `ChatsService`.
- WebSocket: `ChatServerService`.
- DB: `Chat`, `ChatMember`, `Message`, `RealtimeEvent`.
- Details: `ai-context/realtime-chat.md`.

Frendly Evening:

- Flutter: `evening_routes`, `evening_plan`, `evening_live`, `evening_after_party`.
- API: `EveningService`.
- DB: `EveningRouteTemplate`, `EveningRoute`, `EveningSession`, `EveningRouteStep`, `PartnerOfferCode`.
- Realtime summary uses `chat.updated`; dedicated `evening.session.updated` does not exist yet.

Media:

- Prefer direct upload to S3 through presigned URL.
- API: `UploadsService`, `MediaService`.
- DB: `MediaAsset`.
- Reads use public URL, proxy `/media/:assetId`, or signed download URL.

## Design rule

`front/` is the visual source of truth. Flutter must match it by colors, typography, spacing, components and flows.

For Flutter visual work, open only the needed docs:

- `docs/design-system-big-break.md`
- `docs/flutter-ui-mapping-big-break.md`
- `docs/flutter-engineering-standards.md`

## Checks

- Flutter: `cd mobile && flutter analyze`, `cd mobile && flutter test`.
- API: `cd backend && pnpm --filter @big-break/api test:unit`, `cd backend && pnpm --filter @big-break/api build`.
- DB: `cd backend && pnpm --filter @big-break/database prisma:generate`.
- Chat: `cd backend && pnpm --filter @big-break/chat test`.
- Worker: `cd backend && pnpm --filter @big-break/worker test`.
- Landing: `cd landing && npm run build`, `cd landing && npm run lint`.

