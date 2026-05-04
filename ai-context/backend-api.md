# Backend API Map

Use this for REST endpoints, DTOs, service behavior and API tests.

For concrete controllers and services, run `./scripts/ua-query.mjs "<endpoint or flow>"` first.

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
- Meetup chat list items keep `members` as display-name previews and also expose `memberProfiles` with `{ userId, name, online, isCurrentUser }` for profile and direct-chat actions.

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

Admin Evening route review:

- `GET /admin/evening/route-review/drafts`
- `GET /admin/evening/route-review/drafts/:draftId`
- `POST /admin/evening/route-review/drafts/:draftId/approve`
- `POST /admin/evening/route-review/drafts/:draftId/reject`
- `POST /admin/evening/route-review/drafts/:draftId/convert`
- `POST /admin/evening/route-review/drafts/:draftId/publish`
- `POST /admin/evening/route-review/import-runs`
- `GET /admin/evening/route-review/import-runs`
- `GET /admin/evening/route-review/sources`

## Important behavior

- Event joins are idempotent for existing participants.
- `POST /events` accepts route selection for meetup creation. Existing routes use `routeId`; custom routes use a route payload with at least two titled steps and are saved as private `EveningRoute` records, not published templates.
- `GET /events` and `GET /posters` accept `date=yyyy-mm-dd` for one-day filtering.
- `GET /after-dark/events` accepts `q` and `date`; `GET /evening/route-templates` accepts `q`.
- Direct joins lock the event row and check capacity inside the transaction.
- Join request review must not reset a reviewed request back to pending.
- Event detail uses bounded previews and separate counts.
- Chat list member previews are bounded and block-aware. Meetup previews include `memberProfiles` so clients do not use display names as ids.
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
- Generated route review drafts are never public by default. Admin must approve, convert to `EveningRouteTemplate`, then publish through existing Evening route publishing.
- Manual route review import requests create `pending_manual` import runs. External fetch stays in worker, not in the API request path.

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
