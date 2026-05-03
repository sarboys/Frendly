# Backend API Map

Use this for REST endpoints, DTOs, service behavior and API tests.

## Fast paths

- Controllers: `backend/apps/api/src/controllers/`.
- Services: `backend/apps/api/src/services/`.
- App module: `backend/apps/api/src/app.module.ts`.
- API boot: `backend/apps/api/src/main.ts`.
- Common helpers: `backend/apps/api/src/common/`.
- Presenters: `backend/apps/api/src/common/presenters.ts`, `media-presenters.ts`.
- Auth guard: `backend/apps/api/src/common/auth.guard.ts`.
- Contracts: `backend/packages/contracts/src/index.ts`.
- API tests: `backend/apps/api/test/unit/`, `backend/apps/api/test/integration/`.

## Runtime rules

- NestJS app, default port `3000`.
- Global `ValidationPipe` with whitelist and transform.
- Global `AuthGuard`; public routes use `@Public()`.
- Current user comes from `@CurrentUser()`.
- Request context carries `requestId`, `userId`, `sessionId`.
- Partner portal uses `PartnerAuthGuard` and partner request context.
- Admin routes use `@Admin()`, `AdminTokenGuard` and admin request context.
- Admin actions are written to `AdminAuditEvent` by `AdminAuditInterceptor`.
- Errors use `ApiError` and `ApiExceptionFilter`.
- CORS only when `CORS_ORIGIN` is set.

## Main controllers and services

- Auth: `auth.controller.ts`, `auth.service.ts`, `telegram-auth.service.ts`, `social-auth.service.ts`.
- Profile: `profile.controller.ts`, `profile.service.ts`.
- Onboarding: `onboarding.controller.ts`, `onboarding.service.ts`.
- Events: `events.controller.ts`, `events.service.ts`.
- Grouped search: `search.controller.ts`, `search.service.ts`.
- Host: `host.controller.ts`, `host.service.ts`.
- Chats: `chats.controller.ts`, `chats.service.ts`.
- Evening: `evening.controller.ts`, `evening.service.ts`, `partner-offer-code.service.ts`.
- Admin Evening: `admin-evening.controller.ts`, `admin-auth.controller.ts`, `admin-auth.service.ts`, `admin-venue.service.ts`, `admin-evening-route.service.ts`, `admin-evening-ai.service.ts`, `admin-evening-analytics.service.ts`.
- Partner portal: `partner-portal.controller.ts`, `partner-portal.service.ts`, `partner-auth.controller.ts`, `partner-auth.service.ts`.
- People: `people.controller.ts`, `people.service.ts`.
- Dating and matches: `dating.controller.ts`, `matches.controller.ts`, `dating.service.ts`, `matches.service.ts`.
- Communities: `communities.controller.ts`, `communities.service.ts`.
- After Dark: `after-dark.controller.ts`, `after-dark.service.ts`.
- Posters: `posters.controller.ts`, `posters.service.ts`.
- Uploads and media: `uploads.controller.ts`, `media.controller.ts`, `uploads.service.ts`, `media.service.ts`.
- Notifications: `notifications.controller.ts`, `notifications.service.ts`.
- Safety: `safety.controller.ts`, `safety.service.ts`.
- Shares: `shares.controller.ts`, `shares.service.ts`.
- Public offer codes: `public-code.controller.ts`.
- Internal Telegram: `internal-telegram.controller.ts`.

## Endpoint groups

Auth:

- `POST /auth/dev/login`
- `POST /auth/phone/request`
- `POST /auth/phone/verify`
- `POST /auth/phone/test-login`
- `POST /auth/refresh`
- `POST /auth/telegram/start`
- `POST /auth/telegram/verify`
- `POST /auth/google/verify`
- `POST /auth/yandex/verify`
- `POST /auth/logout`
- `GET /me`

Events:

- `GET /events`
- `GET /events/:eventId`
- `POST /events`
- `POST /events/:eventId/join`
- `DELETE /events/:eventId/join`
- `POST /events/:eventId/join-request`
- `POST /events/:eventId/invites/:requestId/accept`
- `POST /events/:eventId/invites/:requestId/decline`
- check-in, live, after-party, feedback endpoints live under `/events/:eventId/*`.

Search:

- `GET /search` returns `{ meetups, evenings, routes, posters, nextCursors }`.
- Query params include `q`, `date`, `city`, `lifestyle`, `price`, `gender`, `access`, plus per-block limits: `meetupsLimit`, `eveningsLimit`, `routesLimit`, `postersLimit`.
- `date` is `yyyy-mm-dd` or `any`. Events, after-dark events and posters apply it as a one-day UTC range.

Chats:

- `GET /chats/meetups`
- `GET /chats/personal`
- `GET /chats/:chatId/messages`
- `POST /chats/:chatId/read`

Evening:

- `GET /evening/options`
- `GET /evening/route-templates`
- `GET /evening/route-templates/:templateId`
- `GET /evening/route-templates/:templateId/sessions`
- `POST /evening/route-templates/:templateId/sessions`
- `POST /evening/routes/resolve`
- `GET /evening/routes/:routeId`
- `POST /evening/routes/:routeId/launch`
- `POST /evening/routes/:routeId/finish`
- `GET /evening/sessions`
- `GET /evening/sessions/:sessionId`
- `POST /evening/sessions/:sessionId/join`
- `POST /evening/sessions/:sessionId/join-request`
- `POST /evening/sessions/:sessionId/join-requests/:requestId/approve`
- `POST /evening/sessions/:sessionId/join-requests/:requestId/reject`
- `POST /evening/sessions/:sessionId/start`
- `POST /evening/sessions/:sessionId/finish`
- step check-in, advance, skip and offer code endpoints live under `/evening/sessions/:sessionId/steps/*`.

Uploads and media:

- `POST /uploads/media/upload-url`
- `POST /uploads/media/complete`
- `POST /uploads/media/file`
- `POST /uploads/chat-attachment/upload-url`
- `POST /uploads/chat-attachment/complete`
- `POST /uploads/chat-attachment/file`
- `GET /media/:assetId`
- `GET /media/:assetId/download-url`

Public sharing:

- `POST /shares`
- `GET /public/shares/:slug`
- `POST /public/offer-codes/:code/activate`

Admin auth:

- `POST /admin/auth/login`
- `POST /admin/auth/refresh`
- `POST /admin/auth/logout`
- `GET /admin/auth/me`

## Important behavior

- Event joins are idempotent for existing participants.
- `POST /events` accepts route selection for meetup creation. Existing routes use `routeId`; custom routes use a route payload with at least two titled steps and are saved as private `EveningRoute` records, not published templates.
- `GET /events` and `GET /posters` accept `date=yyyy-mm-dd` for one-day filtering.
- `GET /after-dark/events` accepts `q` and `date`; `GET /evening/route-templates` accepts `q`.
- Direct joins lock the event row and check capacity inside the transaction.
- Join request review must not reset a reviewed request back to pending.
- Event detail uses bounded previews and separate counts.
- Chat list member previews are bounded and block-aware.
- Chat history hides blocked `replyTo` previews.
- Cursors carry sort keys plus id when possible.
- Direct upload complete is idempotent by object key, owner, kind and target.
- Private media download checks chat membership, event participation and blocks.
- Dating, people, host, notifications and safety services use narrow selects on hot paths.
- `getBlockedUserIds` from `@big-break/database` is the shared hidden-user helper.
- Evening lifecycle writes system chat messages with `kind=system`.
- Evening phase refresh uses `chat.updated`.
- Dedicated `evening.session.updated` is not implemented yet.
- Public offer code activation has a per-IP in-process limit before DB lookup.
- Admin auth uses httpOnly cookies and can bootstrap the first admin from `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD`.
- Legacy `x-admin-token` still works when `ADMIN_API_TOKEN` is configured, but browser admin should use `/admin/auth/*`.

## Shared packages

`@big-break/database` owns Prisma, JWT helpers, Redis pub/sub, S3 helpers, outbox constants and DB scripts.

`@big-break/contracts` owns API DTOs, cursor pages, token pair, upload/media DTOs, chat DTOs, Evening DTOs, public share DTOs and WebSocket event maps.

## Checks

```bash
cd backend && pnpm --filter @big-break/api test:unit
cd backend && pnpm --filter @big-break/api build
```

Targeted Evening and chat tests:

```bash
cd backend && pnpm --filter @big-break/api test:unit -- evening.service.unit.spec.ts chats.service.unit.spec.ts
```
