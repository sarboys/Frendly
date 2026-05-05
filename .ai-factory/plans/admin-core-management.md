# Admin Core Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task by task. Steps use checkbox syntax for progress tracking. After each finished step, replace its comment with one short factual note.

**Goal:** Сделать рабочую внутреннюю админку для пунктов меню `Пользователи`, `Сообщества`, `Встречи`, `Афиша`: просмотр, фильтры, карточка объекта, редактирование, модерация, статусы, аудит, тесты.

**Architecture:** Внутренняя админка идет через существующий React app `admin/` и cookie auth `/admin/auth/*`. Backend добавляет узкие NestJS admin controllers and services под `/admin/*`, без нового сервиса и без обхода существующих моделей. Partner portal остается отдельным режимом, его API не ломаем.

**Tech Stack:** NestJS, Prisma, PostgreSQL, React, React Router, TanStack Query, Vitest, Jest, existing `AdminAuditInterceptor`.

---

## Правило ведения плана

После исполнения каждого пункта:

1. Поставить `[x]`.
2. В строке `Комментарий после исполнения:` заменить `не начато` на короткий факт.
3. Если пункт отменен, оставить `[ ]`, написать причину в комментарии.
4. После изменения файлов запускать `bash scripts/update-understand-graph.sh`.

Формат комментария:

```text
Комментарий после исполнения: сделан `GET /admin/users`, добавлен unit test.
```

## Контекст

Уже есть:

- `admin/src/App.tsx`, routes для `users`, `communities`, `meetups`, `posters`.
- `admin/src/admin/pages/Users.tsx`, `Communities.tsx`, `Meetups.tsx`, `Posters.tsx`.
- Detail pages: `UserDetail.tsx`, `CommunityDetail.tsx`, `MeetupDetail.tsx`.
- `admin/src/admin/data.ts`, сейчас это mock data для internal admin.
- `admin/src/admin/api/client.ts`, cookie based admin client with refresh.
- `PartnerPortalController` and `PartnerPortalService`, там уже есть реальные CRUD операции для partner meetups, communities, posters.
- `AdminRouteReviewService` and `RouteReviewQueue`, там уже есть moderation для imported `ExternalContentItem`.
- `AdminAuditInterceptor`, он пишет admin action в `AdminAuditEvent`.

Главный разрыв:

```text
internal admin pages
  -> сейчас читают mock data
  -> должны читать /admin/* backend API
```

## Решения

- Внутренний режим `adminPortal === "internal"` переводим с mock data на real API.
- Partner mode не трогаем, кроме shared UI fixes, если они нужны.
- Пользователей не создаем через админку в первой реализации. Пользователь создается через auth and onboarding. В админке управляем существующими пользователями.
- Для банов пользователей добавляем явный status в `User`, потому что сейчас в schema нет user ban state.
- `Афиша` объединяет две реальные сущности:
  - native `Poster`.
  - imported public events in `ExternalContentItem` with `contentKind=event`.
- Не добавляем отдельный content service. Используем Prisma models, existing route review logic, public affiche policy.
- Все admin endpoints идут через `@Admin()`, значит cookies, admin guard, audit already work.

## Scope

In scope:

- Backend admin endpoints for users, meetups, communities, affiche.
- Minimal DB migration for user suspension.
- Cursor pagination and bounded selects.
- Search and filters for all four menu items.
- Detail endpoints with tabs data.
- Mutations for status and moderation actions.
- React API clients and typed DTOs.
- React pages wired to backend.
- Loading, empty, error, saving states.
- Tests for services, API clients, routing, main pages.
- Context update if API contracts or auth behavior changed.

Out of scope:

- Новый внешний moderation engine.
- Новый payment flow.
- Новая мобильная фича.
- Создание обычного пользователя вручную из админки.
- Редактор rich text для community posts.
- Bulk actions beyond CSV export of loaded rows.

---

## Backend API Contract

### Users

```text
GET /admin/users
GET /admin/users/:userId
PATCH /admin/users/:userId/profile
POST /admin/users/:userId/verify
POST /admin/users/:userId/unverify
POST /admin/users/:userId/suspend
POST /admin/users/:userId/unsuspend
POST /admin/users/:userId/revoke-sessions
GET /admin/users/:userId/meetups
GET /admin/users/:userId/reports
GET /admin/users/:userId/audit
```

List filters:

```text
q, city, status, verified, plan, createdFrom, createdTo, cursor, limit
```

Management:

- edit safe profile fields: `displayName`, `email`, `phoneNumber`, profile city and bio fields if present.
- verify or unverify profile.
- suspend or unsuspend account.
- revoke active sessions.
- view hosted meetups, joined meetups, reports.

### Communities

```text
GET /admin/communities
POST /admin/communities
GET /admin/communities/:communityId
PATCH /admin/communities/:communityId
POST /admin/communities/:communityId/archive
POST /admin/communities/:communityId/restore
GET /admin/communities/:communityId/members
POST /admin/communities/:communityId/members/:memberId/remove
PATCH /admin/communities/:communityId/members/:memberId/role
GET /admin/communities/:communityId/news
POST /admin/communities/:communityId/news
PATCH /admin/communities/:communityId/news/:newsId
DELETE /admin/communities/:communityId/news/:newsId
GET /admin/communities/:communityId/media
POST /admin/communities/:communityId/media
PATCH /admin/communities/:communityId/media/:mediaId
DELETE /admin/communities/:communityId/media/:mediaId
```

List filters:

```text
q, city, privacy, archived, partnerId, createdFrom, createdTo, cursor, limit
```

Management:

- create community with owner user.
- edit name, avatar, description, privacy, tags, mood.
- archive or restore.
- manage members and roles.
- manage news and media.

### Meetups

```text
GET /admin/meetups
POST /admin/meetups
GET /admin/meetups/:meetupId
PATCH /admin/meetups/:meetupId
POST /admin/meetups/:meetupId/cancel
POST /admin/meetups/:meetupId/restore
GET /admin/meetups/:meetupId/participants
POST /admin/meetups/:meetupId/participants/:participantId/remove
GET /admin/meetups/:meetupId/join-requests
POST /admin/meetups/:meetupId/join-requests/:requestId/approve
POST /admin/meetups/:meetupId/join-requests/:requestId/reject
```

List filters:

```text
q, city, status, joinMode, priceMode, hostId, partnerId, startsFrom, startsTo, cursor, limit
```

Management:

- create meetup with existing host user.
- edit title, emoji, time, place, coordinates, description, capacity, join mode, price.
- cancel or restore.
- remove participant.
- review join requests without resetting reviewed requests to pending.

### Affiche

Native posters:

```text
GET /admin/affiche/posters
POST /admin/affiche/posters
GET /admin/affiche/posters/:posterId
PATCH /admin/affiche/posters/:posterId
POST /admin/affiche/posters/:posterId/publish
POST /admin/affiche/posters/:posterId/hide
POST /admin/affiche/posters/:posterId/reject
POST /admin/affiche/posters/:posterId/archive
POST /admin/affiche/posters/:posterId/feature
POST /admin/affiche/posters/:posterId/unfeature
```

Imported affiche:

```text
GET /admin/affiche/content-items
GET /admin/affiche/content-items/:itemId
PATCH /admin/affiche/content-items/:itemId
POST /admin/affiche/content-items/:itemId/publish
POST /admin/affiche/content-items/:itemId/hide
POST /admin/affiche/content-items/:itemId/reject
POST /admin/affiche/content-items/:itemId/stale
POST /admin/affiche/content-items/:itemId/force-free
POST /admin/affiche/content-items/:itemId/force-paid
```

List filters:

```text
q, city, source, category, status, priceMode, featured, hasCoords, dateFrom, dateTo, cursor, limit
```

Management:

- create native poster.
- edit native poster fields.
- publish, hide, reject, archive, feature.
- moderate imported event rows through existing public status and moderation status rules.
- never show `contentKind=place` as affiche event.
- unknown price stays admin only until forced or corrected.

---

## Files

Create:

- `backend/apps/api/src/controllers/admin-users.controller.ts`
- `backend/apps/api/src/controllers/admin-meetups.controller.ts`
- `backend/apps/api/src/controllers/admin-communities.controller.ts`
- `backend/apps/api/src/controllers/admin-affiche.controller.ts`
- `backend/apps/api/src/services/admin-users.service.ts`
- `backend/apps/api/src/services/admin-meetups.service.ts`
- `backend/apps/api/src/services/admin-communities.service.ts`
- `backend/apps/api/src/services/admin-affiche.service.ts`
- `backend/apps/api/test/unit/admin-users.service.unit.spec.ts`
- `backend/apps/api/test/unit/admin-meetups.service.unit.spec.ts`
- `backend/apps/api/test/unit/admin-communities.service.unit.spec.ts`
- `backend/apps/api/test/unit/admin-affiche.service.unit.spec.ts`
- `admin/src/admin/management/api.ts`
- `admin/src/admin/management/types.ts`
- `admin/src/admin/management/format.ts`
- `admin/src/admin/management/api.test.ts`
- `admin/src/admin/pages/Users.test.tsx`
- `admin/src/admin/pages/Meetups.test.tsx`
- `admin/src/admin/pages/Communities.test.tsx`
- `admin/src/admin/pages/Posters.test.tsx`

Modify:

- `backend/apps/api/src/app.module.ts`
- `backend/packages/database/prisma/schema.prisma`
- `admin/src/admin/pages/Users.tsx`
- `admin/src/admin/pages/UserDetail.tsx`
- `admin/src/admin/pages/Meetups.tsx`
- `admin/src/admin/pages/MeetupDetail.tsx`
- `admin/src/admin/pages/Communities.tsx`
- `admin/src/admin/pages/CommunityDetail.tsx`
- `admin/src/admin/pages/Posters.tsx`
- `admin/src/admin/components/DataToolbar.tsx`
- `admin/src/admin/components/StatusBadge.tsx`
- `ai-context/backend-api.md`
- `ai-context/auth.md`
- `ai-context/database.md`

Maybe modify:

- `backend/apps/api/src/common/auth.guard.ts`
- `backend/packages/contracts/src/index.ts`

Only modify `contracts` if the project wants admin DTOs shared outside `admin/`.

---

## Checklist

### Task 1: Backend foundation

**Files:**

- Modify: `backend/apps/api/src/app.module.ts`
- Modify: `backend/packages/database/prisma/schema.prisma`
- Maybe modify: `backend/apps/api/src/common/auth.guard.ts`
- Test: `backend/apps/api/test/unit/admin-users.service.unit.spec.ts`

- [x] **Step 1.1: Add user suspension fields**

Add to `User`:

```prisma
status           String    @default("active")
suspendedAt      DateTime?
suspensionReason String?
```

Add indexes:

```prisma
@@index([status, createdAt, id])
```

Комментарий после исполнения: добавлены поля suspension в `User`, индекс и migration SQL.

- [x] **Step 1.2: Decide auth behavior for suspended users**

Update `AuthGuard` so `status === "suspended"` rejects normal mobile API access with:

```text
403 user_suspended
```

Keep admin auth separate. Do not reject `AdminUser` here.

Комментарий после исполнения: `AuthGuard` возвращает `403 user_suspended` для suspended `User`.

- [x] **Step 1.3: Register new controllers and services**

Add admin controllers and services to `ApiAppModule`.

Комментарий после исполнения: новые admin controllers и services зарегистрированы в `ApiAppModule`.

- [x] **Step 1.4: Add shared parse helpers inside services**

Use small local helpers per service:

```text
parseLimit
parseCursor
optionalText
requiredText
parseDate
parseBoolean
page
```

Do not add a shared abstraction until two services need exactly the same code shape.

Комментарий после исполнения: добавлены локальные helpers в admin services для limit, cursor, text, date, boolean и page.

- [x] **Step 1.5: Verify backend compiles after registration**

Run:

```bash
cd backend && pnpm --filter @big-break/api build
```

Expected: build passes.

Комментарий после исполнения: `pnpm --filter @big-break/api build` прошел успешно.

### Task 2: Users backend

**Files:**

- Create: `backend/apps/api/src/controllers/admin-users.controller.ts`
- Create: `backend/apps/api/src/services/admin-users.service.ts`
- Create: `backend/apps/api/test/unit/admin-users.service.unit.spec.ts`
- Modify: `backend/apps/api/src/app.module.ts`

- [x] **Step 2.1: Implement `GET /admin/users`**

Return bounded list:

```ts
type AdminUserListItemDto = {
  id: string;
  displayName: string;
  email: string | null;
  phoneNumber: string | null;
  city: string | null;
  status: string;
  verified: boolean;
  plan: "free" | "plus" | "afterdark";
  hostedMeetupsCount: number;
  joinedMeetupsCount: number;
  reportsCount: number;
  createdAt: string;
  updatedAt: string;
};
```

Use narrow selects and counts. Do not include sessions, tokens or raw profile JSON in list.

Комментарий после исполнения: сделан bounded `GET /admin/users` с narrow select и counts.

- [x] **Step 2.2: Implement user search and filters**

Support `q` over `displayName`, `email`, `phoneNumber`.

Support exact filters:

```text
city, status, verified, plan
```

Use cursor by `createdAt + id`.

Комментарий после исполнения: добавлены q, city, status, verified, plan, createdFrom, createdTo и cursor фильтры.

- [x] **Step 2.3: Implement `GET /admin/users/:userId`**

Return profile, counts and safe related state:

```text
profile
settings summary
verification
current subscription summary
open reports count
hosted count
joined count
active sessions count
```

No token values. No OTP data.

Комментарий после исполнения: сделан detail без токенов и OTP, с profile, settings, verification, subscription и counts.

- [x] **Step 2.4: Implement profile update**

Endpoint:

```text
PATCH /admin/users/:userId/profile
```

Allowed fields:

```text
displayName, email, phoneNumber, profile.bio, profile.city, profile.avatarUrl
```

Reject duplicate email and phone with clear `ApiError` codes.

Комментарий после исполнения: сделан `PATCH /admin/users/:userId/profile` с проверкой duplicate email и phone.

- [x] **Step 2.5: Implement verify and unverify**

Endpoints:

```text
POST /admin/users/:userId/verify
POST /admin/users/:userId/unverify
```

Update `User.verified`. If `UserVerification` exists, keep it consistent where possible.

Комментарий после исполнения: сделаны verify и unverify с синхронизацией `UserVerification`.

- [x] **Step 2.6: Implement suspend and unsuspend**

Endpoints:

```text
POST /admin/users/:userId/suspend
POST /admin/users/:userId/unsuspend
```

Suspension sets:

```text
status=suspended
suspendedAt=now
suspensionReason=body.reason
```

Unsuspension sets:

```text
status=active
suspendedAt=null
suspensionReason=null
```

Комментарий после исполнения: сделаны suspend и unsuspend с `status`, `suspendedAt`, `suspensionReason`.

- [x] **Step 2.7: Implement revoke sessions**

Endpoint:

```text
POST /admin/users/:userId/revoke-sessions
```

Set `Session.revokedAt` for non revoked sessions.

Комментарий после исполнения: сделан revoke active sessions через `Session.revokedAt`.

- [x] **Step 2.8: Implement related tabs**

Endpoints:

```text
GET /admin/users/:userId/meetups
GET /admin/users/:userId/reports
GET /admin/users/:userId/audit
```

Return bounded lists with cursor.

Комментарий после исполнения: сделаны bounded tabs для user meetups, reports и audit.

- [x] **Step 2.9: Add users service tests**

Cover:

```text
list filters
detail not found
duplicate email
suspend blocks user status
unsuspend clears reason
revoke sessions touches only active sessions
```

Комментарий после исполнения: добавлен `admin-users.service.unit.spec.ts`, unit suite прошел 42/42.

### Task 3: Meetups backend

**Files:**

- Create: `backend/apps/api/src/controllers/admin-meetups.controller.ts`
- Create: `backend/apps/api/src/services/admin-meetups.service.ts`
- Create: `backend/apps/api/test/unit/admin-meetups.service.unit.spec.ts`
- Modify: `backend/apps/api/src/app.module.ts`

- [x] **Step 3.1: Implement `GET /admin/meetups`**

Return:

```ts
type AdminMeetupListItemDto = {
  id: string;
  title: string;
  emoji: string;
  city: string | null;
  place: string;
  startsAt: string;
  hostId: string;
  hostName: string;
  partnerId: string | null;
  partnerName: string | null;
  joinMode: string;
  priceMode: string;
  participantsCount: number;
  joinRequestsCount: number;
  capacity: number;
  status: "upcoming" | "live" | "past" | "cancelled";
};
```

Status is derived from `startsAt`, `canceledAt`, `EventLiveState.status`.

Комментарий после исполнения: сделан bounded `GET /admin/meetups` с derived status и counts.

- [x] **Step 3.2: Implement meetup filters**

Support:

```text
q, city, status, joinMode, priceMode, hostId, partnerId, startsFrom, startsTo
```

Use `startsAt + id` cursor.

Комментарий после исполнения: добавлены q, city, status, joinMode, priceMode, hostId, partnerId, startsFrom, startsTo и cursor.

- [x] **Step 3.3: Implement `POST /admin/meetups`**

Create event with existing host user.

Create linked chat, host participant, attendance, live state, chat member. Follow the same invariants used in `PartnerPortalService.createMeetup`.

Комментарий после исполнения: сделано создание meetup с chat, host participant, attendance, live state и chat member.

- [x] **Step 3.4: Implement meetup detail**

Endpoint:

```text
GET /admin/meetups/:meetupId
```

Include event fields, host, partner, chat id, counts, live state, source poster or source external content summary.

Комментарий после исполнения: сделан detail с host, partner, chat id, counts, live state и source summaries.

- [x] **Step 3.5: Implement update**

Endpoint:

```text
PATCH /admin/meetups/:meetupId
```

Allowed fields:

```text
title, emoji, startsAt, durationMinutes, place, latitude, longitude, vibe, joinMode, priceMode, priceAmountFrom, priceAmountTo, accessMode, visibilityMode, description, capacity
```

Do not allow host change in first implementation.

Комментарий после исполнения: сделан `PATCH /admin/meetups/:meetupId` только для разрешенных полей.

- [x] **Step 3.6: Implement cancel and restore**

Endpoints:

```text
POST /admin/meetups/:meetupId/cancel
POST /admin/meetups/:meetupId/restore
```

Cancel sets `canceledAt` and `cancelReason`.

Restore clears both fields if the meetup still exists.

Комментарий после исполнения: сделаны cancel и restore через `canceledAt` и `cancelReason`.

- [x] **Step 3.7: Implement participants**

Endpoints:

```text
GET /admin/meetups/:meetupId/participants
POST /admin/meetups/:meetupId/participants/:participantId/remove
```

Remove participant also removes matching chat member when meetup chat exists.

Do not remove host participant.

Комментарий после исполнения: сделаны participants list и remove без удаления host participant.

- [x] **Step 3.8: Implement join request review**

Endpoints:

```text
GET /admin/meetups/:meetupId/join-requests
POST /admin/meetups/:meetupId/join-requests/:requestId/approve
POST /admin/meetups/:meetupId/join-requests/:requestId/reject
```

Approval must be idempotent for already approved participant.

Do not reset reviewed requests to pending.

Комментарий после исполнения: сделаны join requests list, approve и reject с idempotent participant/chat upsert.

- [x] **Step 3.9: Add meetups service tests**

Cover:

```text
list status derivation
create creates chat and host participant
update rejects invalid capacity
cancel and restore
remove participant does not remove host
join request approval adds participant and chat member
```

Комментарий после исполнения: добавлен `admin-meetups.service.unit.spec.ts`, 6 targeted tests прошли.

### Task 4: Communities backend

**Files:**

- Create: `backend/apps/api/src/controllers/admin-communities.controller.ts`
- Create: `backend/apps/api/src/services/admin-communities.service.ts`
- Create: `backend/apps/api/test/unit/admin-communities.service.unit.spec.ts`
- Modify: `backend/apps/api/src/app.module.ts`

- [x] **Step 4.1: Implement `GET /admin/communities`**

Return:

```ts
type AdminCommunityListItemDto = {
  id: string;
  name: string;
  avatar: string;
  city: string | null;
  privacy: string;
  ownerId: string;
  ownerName: string;
  partnerId: string | null;
  membersCount: number;
  newsCount: number;
  mediaCount: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
```

City can come from creator profile or partner city.

Комментарий после исполнения: сделан bounded `GET /admin/communities` с counts и owner/partner city.

- [x] **Step 4.2: Implement community filters**

Support:

```text
q, city, privacy, archived, partnerId, createdFrom, createdTo
```

Use `createdAt + id` cursor.

Комментарий после исполнения: добавлены q, city, privacy, archived, partnerId, createdFrom, createdTo и cursor.

- [x] **Step 4.3: Implement `POST /admin/communities`**

Create community with existing owner user.

Create chat, owner member, owner chat member. Follow `PartnerPortalService.createCommunity` invariants.

Комментарий после исполнения: сделано создание community с chat, owner member и owner chat member.

- [x] **Step 4.4: Implement community detail**

Endpoint:

```text
GET /admin/communities/:communityId
```

Include settings, owner, partner, counts, social links, archived state.

Комментарий после исполнения: сделан detail с owner, partner, counts, social links и archived state.

- [x] **Step 4.5: Implement update**

Endpoint:

```text
PATCH /admin/communities/:communityId
```

Allowed fields:

```text
name, avatar, description, privacy, tags, joinRule, premiumOnly, mood, sharedMediaLabel
```

Комментарий после исполнения: сделан `PATCH /admin/communities/:communityId` для разрешенных полей.

- [x] **Step 4.6: Implement archive and restore**

Endpoints:

```text
POST /admin/communities/:communityId/archive
POST /admin/communities/:communityId/restore
```

Archive sets `archivedAt`.

Restore clears `archivedAt`.

Комментарий после исполнения: сделаны archive и restore через `archivedAt`.

- [x] **Step 4.7: Implement member management**

Endpoints:

```text
GET /admin/communities/:communityId/members
POST /admin/communities/:communityId/members/:memberId/remove
PATCH /admin/communities/:communityId/members/:memberId/role
```

Do not remove the last owner.

When removing member, remove linked community chat member too.

Комментарий после исполнения: сделаны members list, remove с chat cleanup и role update без удаления last owner.

- [x] **Step 4.8: Implement news and media management**

Endpoints:

```text
GET /admin/communities/:communityId/news
POST /admin/communities/:communityId/news
PATCH /admin/communities/:communityId/news/:newsId
DELETE /admin/communities/:communityId/news/:newsId
GET /admin/communities/:communityId/media
POST /admin/communities/:communityId/media
PATCH /admin/communities/:communityId/media/:mediaId
DELETE /admin/communities/:communityId/media/:mediaId
```

Use existing `CommunityNewsItem` and `CommunityMediaItem`.

Комментарий после исполнения: сделан news/media CRUD на `CommunityNewsItem` и `CommunityMediaItem`.

- [x] **Step 4.9: Add communities service tests**

Cover:

```text
list filters
create creates chat and owner member
archive and restore
cannot remove last owner
role update
news and media CRUD
```

Комментарий после исполнения: добавлен `admin-communities.service.unit.spec.ts`, 6 targeted tests прошли.

### Task 5: Affiche backend

**Files:**

- Create: `backend/apps/api/src/controllers/admin-affiche.controller.ts`
- Create: `backend/apps/api/src/services/admin-affiche.service.ts`
- Create: `backend/apps/api/test/unit/admin-affiche.service.unit.spec.ts`
- Modify: `backend/apps/api/src/app.module.ts`

- [x] **Step 5.1: Implement native poster list**

Endpoint:

```text
GET /admin/affiche/posters
```

Return `Poster` rows with source `native`.

Use filters:

```text
q, city, category, status, featured, dateFrom, dateTo
```

Комментарий после исполнения: сделан `GET /admin/affiche/posters` с filters и cursor.

- [x] **Step 5.2: Implement native poster create**

Endpoint:

```text
POST /admin/affiche/posters
```

Create `Poster` with explicit id, city, category, title, emoji, startsAt, dateLabel, timeLabel, venue, address, price, ticketUrl, provider, tags, description, status.

Комментарий после исполнения: сделан `POST /admin/affiche/posters` с explicit id и safe https ticketUrl.

- [x] **Step 5.3: Implement native poster detail and update**

Endpoints:

```text
GET /admin/affiche/posters/:posterId
PATCH /admin/affiche/posters/:posterId
```

Do not mutate linked events silently. Show linked events count in detail.

Комментарий после исполнения: сделаны native poster detail и update с linked events count.

- [x] **Step 5.4: Implement native poster actions**

Endpoints:

```text
POST /admin/affiche/posters/:posterId/publish
POST /admin/affiche/posters/:posterId/hide
POST /admin/affiche/posters/:posterId/reject
POST /admin/affiche/posters/:posterId/archive
POST /admin/affiche/posters/:posterId/feature
POST /admin/affiche/posters/:posterId/unfeature
```

Allowed statuses:

```text
published, hidden, rejected, archived, draft
```

Комментарий после исполнения: сделаны publish, hide, reject, archive, feature, unfeature.

- [x] **Step 5.5: Implement imported affiche list**

Endpoint:

```text
GET /admin/affiche/content-items
```

Always force:

```text
contentKind=event
```

Support existing route review filters:

```text
city, source, priceMode, category, publicStatus, moderationStatus, hasCoords, dateFrom, dateTo, q
```

Комментарий после исполнения: сделан `GET /admin/affiche/content-items` с forced `contentKind=event`.

- [x] **Step 5.6: Implement imported affiche detail and update**

Endpoints:

```text
GET /admin/affiche/content-items/:itemId
PATCH /admin/affiche/content-items/:itemId
```

Allowed update fields:

```text
title, shortSummary, category, tags, address, lat, lng, startsAt, endsAt, priceFrom, currency, venueName, imageUrl, actionUrl, actionKind, priceMode, publicStatus, moderationStatus
```

Mask or reject unsafe action URLs using the same policy as content import.

Комментарий после исполнения: сделаны imported detail и update с reject unsafe non-https `actionUrl`.

- [x] **Step 5.7: Implement imported affiche actions**

Endpoints:

```text
POST /admin/affiche/content-items/:itemId/publish
POST /admin/affiche/content-items/:itemId/hide
POST /admin/affiche/content-items/:itemId/reject
POST /admin/affiche/content-items/:itemId/stale
POST /admin/affiche/content-items/:itemId/force-free
POST /admin/affiche/content-items/:itemId/force-paid
```

Reuse behavior from `AdminRouteReviewService` where it already exists.

Комментарий после исполнения: сделаны publish, hide, reject, stale, force-free и force-paid.

- [x] **Step 5.8: Add affiche service tests**

Cover:

```text
native poster filters
native status actions
imported list excludes places
unknown price is not public free
force-free and force-paid update priceMode
unsafe actionUrl rejected or masked
```

Комментарий после исполнения: добавлен `admin-affiche.service.unit.spec.ts`, 6 targeted tests прошли.

### Task 6: Admin React shared management API

**Files:**

- Create: `admin/src/admin/management/api.ts`
- Create: `admin/src/admin/management/types.ts`
- Create: `admin/src/admin/management/format.ts`
- Create: `admin/src/admin/management/api.test.ts`
- Modify: `admin/src/admin/api/client.ts`

- [x] **Step 6.1: Add management DTO types**

Mirror backend response shapes for:

```text
AdminUserListItemDto
AdminUserDetailDto
AdminMeetupListItemDto
AdminMeetupDetailDto
AdminCommunityListItemDto
AdminCommunityDetailDto
AdminPosterDto
AdminAfficheContentItemDto
CursorPageDto<T>
```

Комментарий после исполнения: добавлены DTO types в `admin/src/admin/management/types.ts`.

- [x] **Step 6.2: Add query builder**

Implement typed `withQuery(path, params)` for management API.

Skip undefined, null and empty string.

Комментарий после исполнения: добавлен `withQuery`, он пропускает undefined, null и empty string.

- [x] **Step 6.3: Add users API functions**

Functions:

```text
listAdminUsers
getAdminUser
updateAdminUserProfile
verifyAdminUser
unverifyAdminUser
suspendAdminUser
unsuspendAdminUser
revokeAdminUserSessions
listAdminUserMeetups
listAdminUserReports
listAdminUserAudit
```

Комментарий после исполнения: добавлены users management API functions.

- [x] **Step 6.4: Add meetups API functions**

Functions:

```text
listAdminMeetups
createAdminMeetup
getAdminMeetup
updateAdminMeetup
cancelAdminMeetup
restoreAdminMeetup
listAdminMeetupParticipants
removeAdminMeetupParticipant
listAdminMeetupJoinRequests
approveAdminMeetupJoinRequest
rejectAdminMeetupJoinRequest
```

Комментарий после исполнения: добавлены meetups management API functions.

- [x] **Step 6.5: Add communities API functions**

Functions:

```text
listAdminCommunities
createAdminCommunity
getAdminCommunity
updateAdminCommunity
archiveAdminCommunity
restoreAdminCommunity
listAdminCommunityMembers
removeAdminCommunityMember
updateAdminCommunityMemberRole
listAdminCommunityNews
createAdminCommunityNews
updateAdminCommunityNews
deleteAdminCommunityNews
listAdminCommunityMedia
createAdminCommunityMedia
updateAdminCommunityMedia
deleteAdminCommunityMedia
```

Комментарий после исполнения: добавлены communities management API functions.

- [x] **Step 6.6: Add affiche API functions**

Functions:

```text
listAdminPosters
createAdminPoster
getAdminPoster
updateAdminPoster
publishAdminPoster
hideAdminPoster
rejectAdminPoster
archiveAdminPoster
featureAdminPoster
unfeatureAdminPoster
listAdminAfficheContentItems
getAdminAfficheContentItem
updateAdminAfficheContentItem
moderateAdminAfficheContentItem
```

Комментарий после исполнения: добавлены native posters и imported affiche API functions.

- [x] **Step 6.7: Add API tests**

Test path, method and body for every mutation group.

Комментарий после исполнения: добавлен `management/api.test.ts`, targeted vitest прошел 5/5.

### Task 7: Shared admin UI pieces

**Files:**

- Modify: `admin/src/admin/components/DataToolbar.tsx`
- Modify: `admin/src/admin/components/StatusBadge.tsx`
- Create or modify only if needed: small local form components inside pages

- [x] **Step 7.1: Make `DataToolbar` controlled**

Props:

```ts
type DataToolbarProps = {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onFiltersClick?: () => void;
  onExportClick?: () => void;
  onAdd?: () => void;
  addLabel?: string;
};
```

Keep old optional behavior only if existing pages still need it.

Комментарий после исполнения: `DataToolbar` поддерживает controlled search и старый optional режим.

- [x] **Step 7.2: Add shared page states**

Use consistent text for:

```text
Загрузка...
Ничего не найдено.
Не удалось загрузить данные.
Сохранение...
```

No full screen rebuild for local action. Use per row saving state.

Комментарий после исполнения: добавлены единые тексты состояния в `adminPageText`.

- [x] **Step 7.3: Extend `StatusBadge`**

Support statuses from backend:

```text
active, suspended, upcoming, live, past, cancelled, published, hidden, rejected, archived, draft, submitted, open, private, public, unknown, free, paid
```

Комментарий после исполнения: `StatusBadge` поддерживает backend statuses для admin management.

- [x] **Step 7.4: Add CSV export for loaded rows**

Export currently loaded list only. Do not auto fetch all pages.

Комментарий после исполнения: добавлены `toCsv` и `downloadCsv` для переданных loaded rows.

### Task 8: Users UI

**Files:**

- Modify: `admin/src/admin/pages/Users.tsx`
- Modify: `admin/src/admin/pages/UserDetail.tsx`
- Create: `admin/src/admin/pages/Users.test.tsx`

- [x] **Step 8.1: Replace mock list with `listAdminUsers`**

Use `useQuery` or existing async pattern. Keep filters in URL search params.

Комментарий после исполнения: Users list читает `listAdminUsers` и держит filters в URL.

- [x] **Step 8.2: Add list filters**

Filters:

```text
search, city, status, verified, plan
```

Комментарий после исполнения: добавлены search, city, status, verified и plan filters.

- [x] **Step 8.3: Wire user detail to `getAdminUser`**

Remove fallback to `users[0]`. If not found, show not found state.

Комментарий после исполнения: User detail читает `getAdminUser`, fallback на mock удален.

- [x] **Step 8.4: Wire profile form**

Save through `updateAdminUserProfile`.

Disable save while request runs.

Show API error code and message.

Комментарий после исполнения: profile form сохраняет через `updateAdminUserProfile` и показывает API error.

- [x] **Step 8.5: Wire user actions**

Actions:

```text
verify
unverify
suspend
unsuspend
revoke sessions
```

Show confirm dialog for suspend and revoke sessions.

Комментарий после исполнения: wired verify, unverify, suspend, unsuspend и revoke sessions с confirm.

- [x] **Step 8.6: Wire tabs**

Tabs:

```text
profile
meetups
reports
audit
access
```

Load tab data only when tab opens.

Комментарий после исполнения: tabs profile, meetups, reports, audit, access подключены, data tabs грузятся lazy.

- [x] **Step 8.7: Add users page tests**

Cover:

```text
list renders API data
search changes query
detail not found state
suspend calls correct endpoint
revoke sessions confirm flow
```

Комментарий после исполнения: добавлен `Users.test.tsx`, 5 targeted tests прошли.

### Task 9: Meetups UI

**Files:**

- Modify: `admin/src/admin/pages/Meetups.tsx`
- Modify: `admin/src/admin/pages/MeetupDetail.tsx`
- Create: `admin/src/admin/pages/Meetups.test.tsx`

- [x] **Step 9.1: Keep partner branch unchanged**

Only internal branch switches to `listAdminMeetups`.

Комментарий после исполнения: partner branch оставлен на `partner/portal-api`, internal branch переключен отдельно.

- [x] **Step 9.2: Replace mock list**

Use real API list, loading, empty and error states.

Комментарий после исполнения: Meetups list читает `listAdminMeetups`, добавлены loading, empty и error states.

- [x] **Step 9.3: Add meetup filters**

Filters:

```text
search, city, status, joinMode, priceMode, startsFrom, startsTo
```

Комментарий после исполнения: добавлены search, city, status, joinMode, priceMode, startsFrom и startsTo filters.

- [x] **Step 9.4: Add create meetup form**

Fields:

```text
hostId, title, emoji, startsAt, durationMinutes, place, city label if needed, latitude, longitude, description, capacity, joinMode, priceMode
```

Комментарий после исполнения: create form вызывает `createAdminMeetup` с hostId, title, time, place, coords, capacity и modes.

- [x] **Step 9.5: Wire meetup detail**

Use `getAdminMeetup`. Remove fallback to mock.

Комментарий после исполнения: Meetup detail читает `getAdminMeetup`, mock fallback удален.

- [x] **Step 9.6: Wire details edit form**

Use `updateAdminMeetup`.

Do not allow host change in UI.

Комментарий после исполнения: details edit form сохраняет через `updateAdminMeetup`, host change в UI отсутствует.

- [x] **Step 9.7: Wire cancel and restore**

Use confirm dialog. Ask for cancel reason.

Комментарий после исполнения: cancel и restore подключены к admin API, cancel спрашивает confirm и reason.

- [x] **Step 9.8: Wire participants and requests tabs**

Load participants and join requests lazily.

Actions:

```text
remove participant
approve request
reject request
```

Комментарий после исполнения: participants и join requests tabs грузятся lazy, remove, approve и reject подключены.

- [x] **Step 9.9: Add meetups page tests**

Cover:

```text
list renders API data
create form posts payload
cancel sends reason
participant removal
join request approval
```

Комментарий после исполнения: добавлен `Meetups.test.tsx`, targeted vitest прошел 5/5.

### Task 10: Communities UI

**Files:**

- Modify: `admin/src/admin/pages/Communities.tsx`
- Modify: `admin/src/admin/pages/CommunityDetail.tsx`
- Create: `admin/src/admin/pages/Communities.test.tsx`

- [x] **Step 10.1: Keep partner branch unchanged**

Only internal branch switches to admin API.

Комментарий после исполнения: partner branch оставлен на `partner/portal-api`, internal branch переключен отдельно.

- [x] **Step 10.2: Replace mock list**

Use `listAdminCommunities`.

Комментарий после исполнения: Communities list читает `listAdminCommunities`, mock list удален.

- [x] **Step 10.3: Add community filters**

Filters:

```text
search, city, privacy, archived, partnerId
```

Комментарий после исполнения: добавлены search, city, privacy, archived и partnerId filters.

- [x] **Step 10.4: Add create community form**

Fields:

```text
ownerUserId, name, avatar, description, privacy, tags, mood, premiumOnly
```

Комментарий после исполнения: create form вызывает `createAdminCommunity` с ownerId, name, avatar, description, privacy, tags, mood и premiumOnly.

- [x] **Step 10.5: Wire community detail**

Use `getAdminCommunity`. Remove mock posts and mock members.

Комментарий после исполнения: Community detail читает `getAdminCommunity`, mock posts и mock members удалены.

- [x] **Step 10.6: Wire settings form**

Use `updateAdminCommunity`.

Комментарий после исполнения: settings form сохраняет через `updateAdminCommunity`.

- [x] **Step 10.7: Wire archive and restore**

Use confirm dialog.

Комментарий после исполнения: archive и restore подключены к admin API с confirm.

- [x] **Step 10.8: Wire members tab**

Actions:

```text
remove member
change role
```

Protect last owner in UI and backend.

Комментарий после исполнения: members tab грузится lazy, remove member и role update подключены, last owner блокируется в UI.

- [x] **Step 10.9: Wire news and media tabs**

CRUD news and media using admin endpoints.

Комментарий после исполнения: news и media tabs грузятся lazy, create, update и delete подключены.

- [x] **Step 10.10: Add communities page tests**

Cover:

```text
list renders API data
create form posts payload
archive action
member role update
news create and delete
```

Комментарий после исполнения: добавлен `Communities.test.tsx`, targeted vitest прошел 5/5.

### Task 11: Affiche UI

**Files:**

- Modify: `admin/src/admin/pages/Posters.tsx`
- Create: `admin/src/admin/pages/Posters.test.tsx`
- Reuse if helpful: `admin/src/admin/evening/routeReviewApi.ts`

- [x] **Step 11.1: Keep partner branch unchanged**

Only internal branch switches to admin affiche API.

Комментарий после исполнения: partner branch оставлен на `partner/portal-api`, internal branch переключен отдельно.

- [x] **Step 11.2: Replace mock poster list**

Show two tabs:

```text
Native posters
Imported events
```

Use real lists.

Комментарий после исполнения: internal affiche показывает tabs Native posters и Imported events с real API lists.

- [x] **Step 11.3: Add affiche filters**

Filters:

```text
search, city, source, category, status, priceMode, featured, hasCoords, dateFrom, dateTo
```

Комментарий после исполнения: добавлены search, city, source, category, status, priceMode, featured, hasCoords, dateFrom и dateTo filters.

- [x] **Step 11.4: Add native poster create and edit form**

Fields:

```text
title, city, category, emoji, startsAt, venue, address, priceFrom, ticketUrl, provider, tags, description, status, featured
```

Комментарий после исполнения: native poster create/edit form сохраняет через `createAdminPoster` и `updateAdminPoster`.

- [x] **Step 11.5: Add native poster actions**

Actions:

```text
publish
hide
reject
archive
feature
unfeature
```

Комментарий после исполнения: publish, hide, reject, archive, feature и unfeature подключены к admin API.

- [x] **Step 11.6: Add imported event editor**

Allow editing safe imported fields. Show source, raw summary, coords, price mode, action URL, public status, moderation status.

Комментарий после исполнения: imported event editor сохраняет safe fields через `updateAdminAfficheContentItem`.

- [x] **Step 11.7: Add imported event actions**

Actions:

```text
publish
hide
reject
stale
force-free
force-paid
```

Комментарий после исполнения: publish, hide, reject, stale, force-free и force-paid подключены через `moderateAdminAfficheContentItem`.

- [x] **Step 11.8: Add price policy copy inside controls**

Use short labels:

```text
Бесплатно
Платно
Цена неизвестна
```

Do not show unknown price as free.

Комментарий после исполнения: добавлены labels `Бесплатно`, `Платно`, `Цена неизвестна`; unknown price не показывается free.

- [x] **Step 11.9: Add posters page tests**

Cover:

```text
native tab renders posters
imported tab renders events only
publish action
force-free action
unknown price label
```

Комментарий после исполнения: добавлен `Posters.test.tsx`, targeted vitest прошел 5/5.

### Task 12: Security and audit

**Files:**

- Use existing: `backend/apps/api/src/common/admin.decorator.ts`
- Use existing: `backend/apps/api/src/common/admin-audit.interceptor.ts`
- Modify services from Tasks 2 to 5

- [x] **Step 12.1: Check every admin controller uses `@Admin()`**

No internal admin endpoint should rely on global user auth.

Комментарий после исполнения: `admin-users`, `admin-meetups`, `admin-communities`, `admin-affiche` controllers имеют class-level `@Admin()`.

- [x] **Step 12.2: Check list endpoints use bounded limits**

Limit default:

```text
20
```

Max:

```text
50
```

Комментарий после исполнения: all admin services use `DEFAULT_LIMIT=20`, `MAX_LIMIT=50` и `parseLimit`.

- [x] **Step 12.3: Check sensitive fields are never returned**

Never return:

```text
passwordHash
refreshTokenId
OTP hashes
raw auth provider tokens
full S3 object keys unless already public media id
```

Комментарий после исполнения: admin management selects проверены, tokens, passwordHash, OTP hashes и raw provider tokens не выбираются.

- [x] **Step 12.4: Check audit rows are written**

Run one mutation in an integration or manual dev path. Confirm `AdminAuditEvent` has method, path, status, admin id.

Комментарий после исполнения: добавлен unit test для `AdminAuditInterceptor`, проверены admin id, method, path и status.

- [x] **Step 12.5: Check suspended user cannot use normal API**

Suspend test user, call protected mobile API with existing access token, expect `403 user_suspended`.

Комментарий после исполнения: добавлен unit test для `AuthGuard`, suspended user получает `403 user_suspended`.

### Task 13: Docs and context

**Files:**

- Modify: `ai-context/backend-api.md`
- Modify: `ai-context/auth.md`
- Modify: `ai-context/database.md`
- Maybe modify: `ai-context/entry-points.md`

- [x] **Step 13.1: Update backend API context**

Document new `/admin/users`, `/admin/meetups`, `/admin/communities`, `/admin/affiche` groups.

Комментарий после исполнения: `backend-api.md` documented `/admin/users`, `/admin/meetups`, `/admin/communities` и `/admin/affiche`.

- [x] **Step 13.2: Update auth context**

Document user suspension and guard behavior.

Комментарий после исполнения: `auth.md` documented user suspension and `403 user_suspended` guard behavior.

- [x] **Step 13.3: Update database context**

Document new `User.status`, `suspendedAt`, `suspensionReason` fields.

Комментарий после исполнения: `database.md` documented `User.status`, `suspendedAt`, `suspensionReason` and admin status index usage.

- [x] **Step 13.4: Update plan comments**

Before final implementation report, all completed steps have comments. No completed checkbox should keep `не начато`.

Комментарий после исполнения: completed steps reviewed, no completed checkbox keeps `не начато`.

### Task 14: Verification

**Files:**

- No direct source files unless tests expose a fix.

- [x] **Step 14.1: Run backend unit tests**

Run:

```bash
cd backend && pnpm --filter @big-break/api test:unit
```

Expected: pass.

Комментарий после исполнения: `pnpm --filter @big-break/api test:unit` прошел, 46 suites и 279 tests passed.

- [x] **Step 14.2: Run backend build**

Run:

```bash
cd backend && pnpm --filter @big-break/api build
```

Expected: pass.

Комментарий после исполнения: `pnpm --filter @big-break/api build` прошел успешно.

- [x] **Step 14.3: Run admin tests**

Run:

```bash
cd admin && npm run test
```

Expected: pass.

Комментарий после исполнения: `npm run test` прошел повторно, 12 files и 44 tests passed.

- [x] **Step 14.4: Run admin build**

Run:

```bash
cd admin && npm run build
```

Expected: pass.

Комментарий после исполнения: `npm run build` прошел успешно, остался только штатный Vite chunk size warning.

- [ ] **Step 14.5: Manual smoke in browser**

Run backend and admin locally.

Check:

```text
/users
/users/:id
/meetups
/meetups/:id
/communities
/communities/:id
/posters
```

For every page, verify loading, empty, error, list, detail, save action.

Комментарий после исполнения: не выполнено: нет запущенного backend с рабочей БД и admin session для ручной проверки save actions.

- [x] **Step 14.6: Update Understand graph**

Run:

```bash
bash scripts/update-understand-graph.sh
```

Expected: graph update completes.

Комментарий после исполнения: `bash scripts/update-understand-graph.sh` прошел, graph обновлен без warnings.

---

## Execution order

Recommended order:

1. Task 1.
2. Task 2, then Task 8.
3. Task 3, then Task 9.
4. Task 4, then Task 10.
5. Task 5, then Task 11.
6. Task 12.
7. Task 13.
8. Task 14.

This keeps every menu item shippable in slices:

```text
backend contract
  -> admin API client
  -> page list
  -> detail
  -> actions
  -> tests
```

## Risk notes

- `User` currently has no status field. Suspension requires migration and auth guard change.
- `Афиша` has two data sources. Native `Poster` and imported `ExternalContentItem` must not be mixed in backend writes.
- Imported places must not appear in `Афиша`.
- Removing event or community members must also handle chat membership.
- List pages can be hot paths for admin usage. Use narrow selects and counts.
- Do not load all pages for export.
- Do not expose tokens, password hashes or OTP data.

## Done criteria

- The four menu items no longer use `admin/src/admin/data.ts` in internal admin mode.
- Every list has search, filters, pagination, loading, empty and error states.
- Every detail page reads real backend data.
- All management buttons call real admin endpoints.
- All mutations are protected by `@Admin()` and audited.
- Backend tests pass.
- Admin tests pass.
- Backend build passes.
- Admin build passes.
- `ai-context` reflects new contracts and suspension behavior.
- `bash scripts/update-understand-graph.sh` has been run after changes.
