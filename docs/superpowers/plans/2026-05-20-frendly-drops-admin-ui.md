# Frendly Drops Admin UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task by task. Keep checkboxes updated as work moves.

**Goal:** добить Frendly Drops после backend MVP: понять остаток работ, добавить рабочий UI в админке, оставить mobile2 на отдельное решение по ветке.

**Architecture:** backend уже дает Drops API. Админка должна быть тонким React слоем поверх `/admin/drops`, без моков. Все опасные действия идут через подтверждение. Все данные грузятся через React Query.

**Tech Stack:** React, Vite, TypeScript, Tailwind, Radix UI, `@tanstack/react-query`, существующий `adminApiRequest`.

---

## Текущее состояние

- [x] Backend Drops MVP добавлен в `main`.
- [x] Prisma модели, enum, миграция, reward service, draw service уже есть.
- [x] Публичные endpoints для Drops уже есть.
- [x] Базовые admin endpoints для Drops уже есть.
- [x] Хуки наград подключены к verification, daily login, meeting finish, subscription, boost, referral.
- [x] Unit tests backend уже покрывают основную механику.
- [x] `ai-context/backend-api.md` и `ai-context/database.md` обновлены под Drops.

Осталось:

- [x] UI в админке для Drops.
- [x] Проверить, хватает ли admin API для UI. Добавлены detail endpoint, фильтры, counts и пагинация для основных списков.
- [ ] Notifications для Drops.
- [ ] Нормальная антифрод очередь для ручной проверки.
- [ ] Публичный referral landing и bind flow через `/r/:code`.
- [ ] Mobile2 подключение к Drops API. Сейчас `mobile2/` в текущем `main` лежит как untracked каталог после отмены ошибочного коммита, поэтому его не трогаем в этом плане.
- [ ] Не MVP rewards: афиша, брони, рейтинг, Telegram или VK repost.

---

## Scope этого плана

Делаем только admin UI плюс минимальные backend API доработки, если UI без них не собрать нормально.

Не делаем:

- [ ] новую React админку с нуля;
- [ ] mobile2 подключение;
- [ ] partner purchases;
- [ ] bookings;
- [ ] rating rewards;
- [ ] repost rewards;
- [ ] сложный antifraud scoring;
- [ ] delivery workflow для реальной выдачи призов вне статуса winner.

---

## Нужные экраны админки

### 1. Drops list

Route: `/drops`

Задачи:

- [x] Показать список Drops.
- [x] Фильтры: status, type, search by title.
- [x] Быстрые счетчики: active, scheduled, drawing pending, finished, cancelled.
- [x] Таблица: title, type, status, start, end, draw date, tickets count, participants count.
- [x] Actions per row: open, edit, activate, cancel.
- [x] Кнопка create Drop.

Ограничения:

- [x] Edit доступен только для `draft` и `scheduled`.
- [x] Activate доступен для `draft` и `scheduled`.
- [x] Cancel доступен для `draft`, `scheduled`, `active`, `drawing_pending`.
- [x] Finished Drop нельзя менять.

### 2. Drop detail

Route: `/drops/:dropId`

Задачи:

- [x] Header с названием, статусом, типом, датами, seed hash.
- [x] Если Drop finished, показать раскрытый seed.
- [x] Tabs: overview, participants, tickets, reward events, winners.
- [x] Overview: prizes, conditions, limits.
- [x] Participants: user, ticket count, eligibility status, frozen status.
- [x] Tickets: ticket code, user, source, status, createdAt.
- [x] Reward events: source, user, status, ticket count, idempotency key, reason.
- [x] Winners: main winners, reserve winners, status, ticket, user, prize.

Actions:

- [ ] Edit draft or scheduled Drop.
- [ ] Activate Drop.
- [ ] Cancel Drop with reason.
- [x] Run draw.
- [x] Approve winner.
- [x] Reject winner.
- [x] Choose reserve winner.
- [x] Mark prize delivered.
- [x] Manual grant tickets to user.
- [x] Cancel ticket.
- [x] Freeze user from Drops.
- [x] Unfreeze user from Drops.

### 3. Create and edit modal

Fields:

- [x] title;
- [x] description;
- [x] type;
- [x] prizes as structured JSON or repeatable rows;
- [x] startsAt;
- [x] endsAt;
- [x] drawAt;
- [x] maxTicketsPerUser;
- [x] participantLimit;
- [x] conditions: verified, frendlyPlus, age, region.

Validation:

- [x] title required;
- [x] type required;
- [x] startsAt before endsAt;
- [x] endsAt before drawAt;
- [x] prizes not empty;
- [ ] maxTicketsPerUser positive when set;
- [ ] participantLimit positive when set.

---

## Backend API gaps to check first

Файл:

- [x] `backend/apps/api/src/controllers/admin-drops.controller.ts`
- [x] `backend/apps/api/src/services/drops.service.ts`
- [x] `backend/apps/api/test/unit/drops.service.unit.spec.ts`

Нужно проверить, есть ли уже:

- [x] `GET /admin/drops/:dropId`
- [x] winners in `GET /admin/drops/:dropId`
- [x] filters for `GET /admin/drops`
- [x] pagination for drop tickets;
- [x] pagination for participants;
- [x] pagination for reward events;
- [x] stable counts for list rows.

Если чего-то нет, добавить минимально:

- [x] `GET /admin/drops/:dropId`
- [x] `GET /admin/drops?status=&type=&q=&limit=&cursor=`
- [x] `GET /admin/drops/:dropId/tickets?status=&source=&userId=&limit=&cursor=`
- [x] `GET /admin/drops/:dropId/participants?q=&limit=&cursor=`
- [x] `GET /admin/drops/reward-events/list?userId=&dropId=&source=&status=&limit=&cursor=`

Backend tests:

- [x] filters return only matching drops;
- [x] cursor or limit does not break existing list behavior;
- [x] admin detail does not reveal `secretSeed` before `finished`;
- [ ] winner actions keep valid transitions.

---

## Admin files to add or change

Add:

- [x] `admin/src/admin/drops/types.ts`
- [x] `admin/src/admin/drops/api.ts`
- [x] `admin/src/admin/pages/Drops.tsx`
- [x] `admin/src/admin/pages/DropDetail.tsx`
- [x] `admin/src/admin/pages/Drops.test.tsx`
- [x] `admin/src/admin/pages/DropDetail.test.tsx`
- [x] `admin/src/admin/drops/api.test.ts`

Change:

- [x] `admin/src/App.tsx`
- [x] `admin/src/admin/portal.ts`
- [x] `admin/src/admin/components/Sidebar.tsx`
- [x] `admin/src/admin/components/StatusBadge.tsx`

Reuse:

- [x] `admin/src/admin/api/client.ts`
- [x] `admin/src/admin/components/DataToolbar.tsx`
- [x] `admin/src/admin/components/StatCard.tsx`
- [x] `admin/src/admin/components/ui/table.tsx`
- [x] `admin/src/admin/components/ui/button.tsx`
- [ ] `admin/src/admin/components/ui/dialog.tsx`

---

## Implementation tasks

### Phase 1. Lock API contract

- [x] Read current admin Drops controller and service.
- [x] Compare current endpoints with UI needs.
- [x] Add only missing read endpoints, filters, pagination.
- [x] Add backend tests for new API behavior.
- [x] Run backend tests and build.

Commands:

```bash
cd backend && pnpm --filter @big-break/api test:unit
cd backend && pnpm --filter @big-break/api build
```

### Phase 2. Add admin Drops API client

- [x] Add DTOs in `admin/src/admin/drops/types.ts`.
- [x] Add request functions in `admin/src/admin/drops/api.ts`.
- [x] Keep response mapping thin. Backend remains source of truth.
- [x] Add API tests with mocked `fetch`.

Core functions:

- [x] `listAdminDrops`
- [x] `getAdminDrop`
- [x] `createAdminDrop`
- [x] `updateAdminDrop`
- [x] `activateAdminDrop`
- [x] `cancelAdminDrop`
- [x] `runAdminDropDraw`
- [x] `listDropParticipants`
- [x] `listDropTickets`
- [x] `listDropRewardEvents`
- [x] `manualGrantDropTickets`
- [x] `cancelDropTicket`
- [x] `freezeDropUser`
- [x] `unfreezeDropUser`
- [x] `updateDropWinnerStatus`
- [x] `chooseReserveDropWinner`

### Phase 3. Add navigation

- [x] Add route id `drops`.
- [x] Add route id `dropDetail`.
- [x] Add sidebar item `Drops`.
- [x] Add routes in `admin/src/App.tsx`.
- [x] Keep route internal only.

### Phase 4. Build Drops list page

- [x] Use `useQuery` for list.
- [x] Use `DataToolbar` for filters.
- [x] Use existing table components.
- [x] Use `StatusBadge` with Drops statuses.
- [x] Add create modal.
- [x] Add edit modal.
- [x] Add activate action.
- [x] Add cancel action with reason.
- [x] Invalidate query after mutations.
- [ ] Add tests for render, filters, create, activate, cancel.

### Phase 5. Build Drop detail page

- [x] Load drop detail by `dropId`.
- [x] Load tickets, participants, reward events, winners by tabs.
- [x] Keep tabs lazy, load tab data only when opened.
- [x] Add draw panel.
- [x] Add seed hash and revealed seed display.
- [ ] Add winner action buttons with status guards.
- [x] Add manual grant action.
- [x] Add cancel ticket action.
- [x] Add freeze and unfreeze user action.
- [x] Invalidate related queries after every mutation.
- [ ] Add tests for draw, winner approve, ticket cancel, user freeze.

### Phase 6. Status and UX safety

- [x] Extend `StatusBadge` labels for Drops.
- [ ] Show backend error message from `AdminApiError`.
- [ ] Disable unsafe actions by status.
- [x] Add confirmation for cancel Drop, cancel ticket and run draw.
- [x] Show empty states for all tabs.
- [x] Show loading and error states.

### Phase 7. Verify

- [x] `cd admin && npm run test`
- [x] `cd admin && npm run build`
- [x] `cd backend && pnpm --filter @big-break/api test:unit`
- [x] `cd backend && pnpm --filter @big-break/api build`
- [x] `bash scripts/update-understand-graph.sh`

---

## Definition of done

- [x] Admin can create, edit, activate, cancel Drop.
- [x] Admin can see participants, tickets, reward events, winners.
- [x] Admin can run draw.
- [x] Admin can approve, reject, replace, deliver winner.
- [x] Admin can manually grant or cancel tickets.
- [x] Admin can freeze or unfreeze user from Drops.
- [x] No mock Drops data remains in admin pages.
- [x] Tests cover main admin flows.
- [x] Graph update command runs after changes.

---

## Risks

- [x] Current admin Drops API may be too coarse for tables. Fixed with small filters and pagination before UI.
- [x] `secretSeed` must not leak before `finished`. Backend test added.
- [x] Draw action is destructive for UX. Confirmation added before draw.
- [x] Manual grants can affect fairness. Manual grant uses explicit title and admin action endpoint.
- [ ] `mobile2/` and `front2/` are untracked in current `main`. Do not mix their changes with admin UI.

---

## Suggested commits

- [ ] `Добавить API клиент Drops в админке`
- [ ] `Добавить список Drops в админке`
- [ ] `Добавить карточку Drop и действия победителей`
- [ ] `Покрыть Drops UI тестами`
