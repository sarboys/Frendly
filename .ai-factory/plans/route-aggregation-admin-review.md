# Route Aggregation Admin Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a route aggregation pipeline for Moscow and Saint Petersburg that imports external places and events, generates Frendly route drafts, sends them to admin review, and publishes only approved routes into the existing Evening route catalog.

**Architecture:** Keep the first version inside the existing backend monorepo. The API owns admin review endpoints. The worker owns scheduled import and generation jobs. Prisma stores raw imported facts, normalized candidates, generated drafts, review decisions, and links to published `EveningRouteTemplate` records.

**Tech Stack:** NestJS, Prisma, PostgreSQL, existing `backend/apps/worker`, existing `backend/apps/api`, OpenRouter via `OpenRouterService`, React admin, Vitest, Jest.

---

## Контекст

Сейчас в проекте уже есть Route Studio:

- `AiEveningBrief`, `AiEveningGenerationRun`, `AiEveningDraft`, `AiEveningDraftStep`.
- `AdminEveningAiService.generateDrafts()` генерирует drafts по ручному brief.
- `AdminEveningAiService.convertDraft()` превращает draft в `EveningRouteTemplate`.
- `AdminEveningRouteService.publishTemplate()` публикует текущую ревизию.
- `AdminEveningRoutes` показывает список шаблонов и ручную AI форму.

Новая фича не должна делать отдельный микросервис на старте. Она добавляет автоматический слой поверх текущей AI студии:

```text
external source
  -> raw import
  -> normalized item
  -> route generation batch
  -> generated review draft
  -> admin review
  -> convert to route template
  -> publish
```

## Продуктовые правила

- AI маршруты не публикуются в приложение автоматически.
- Каждый маршрут сначала попадает в админку.
- Админ видит источники, места, события, карту шагов, предупреждения, цену, район, настроение.
- Админ может отредактировать маршрут перед публикацией.
- MVP работает без купонов.
- MVP города: Москва и Санкт-Петербург.
- Если источник недоступен, API пользователя не страдает.
- Если источник запрещает хранение контента, храним только факт, ссылку, координаты, короткий свой summary.
- Первые источники лучше держать за флагами: KudaGo, Timepad, OpenStreetMap Overpass.

## Scope

In scope:

- Prisma models for source imports, normalized places/events, route draft batches, review drafts.
- Worker jobs for scheduled import and route generation.
- Source adapters for KudaGo, Timepad and OSM Overpass.
- AI prompt that builds route drafts from normalized candidates.
- Admin API for listing, inspecting, approving, rejecting, converting, publishing.
- Admin UI page for review queue.
- Unit tests for normalization, deduplication, generation, review transitions.
- Context updates after implementation.

Out of scope:

- Купоны.
- Автоматическая публикация без админа.
- Новый отдельный ingestion service.
- Платные 2ГИС или Яндекс API.
- Мобильные UI изменения, если опубликованные маршруты уже видны через existing Evening routes.
- Полная гео-рекомендация по всем городам мира.

## Data Model Draft

Add these Prisma models.

```prisma
model ExternalContentSource {
  id             String   @id @default(cuid())
  code           String   @unique
  name           String
  kind           String
  baseUrl        String?
  status         String   @default("active")
  cityCodes      Json?
  config         Json?
  lastImportedAt DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  importRuns ExternalImportRun[]
  items      ExternalContentItem[]

  @@index([status, kind, id])
}

model ExternalImportRun {
  id              String    @id @default(cuid())
  sourceId        String
  city            String
  status          String    @default("running")
  startedAt       DateTime  @default(now())
  finishedAt      DateTime?
  fetchedCount    Int       @default(0)
  normalizedCount Int       @default(0)
  skippedCount    Int       @default(0)
  errorCode       String?
  errorMessage    String?
  cursor          String?
  metadata        Json?

  source ExternalContentSource @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  items  ExternalContentItem[]

  @@index([sourceId, city, startedAt, id])
  @@index([status, startedAt, id])
}

model ExternalContentItem {
  id              String    @id @default(cuid())
  sourceId        String
  importRunId     String?
  sourceItemId    String
  sourceUrl       String?
  contentKind     String
  city            String
  timezone        String    @default("Europe/Moscow")
  area            String?
  title           String
  shortSummary    String?
  category        String
  tags            Json?
  address         String?
  lat             Float?
  lng             Float?
  startsAt        DateTime?
  endsAt          DateTime?
  priceFrom       Int?
  currency        String?
  raw             Json?
  normalizedHash  String
  moderationStatus String  @default("pending")
  importedAt      DateTime @default(now())
  expiresAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  source    ExternalContentSource @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  importRun ExternalImportRun?    @relation(fields: [importRunId], references: [id], onDelete: SetNull)
  routeDraftSteps GeneratedRouteDraftStep[]

  @@unique([sourceId, sourceItemId])
  @@index([city, contentKind, startsAt, id])
  @@index([city, category, moderationStatus, id])
  @@index([normalizedHash])
}

model GeneratedRouteDraftBatch {
  id              String    @id @default(cuid())
  city            String
  timezone        String    @default("Europe/Moscow")
  area            String?
  mood            String
  budget          String
  audience        String
  format          String
  source          String    @default("aggregation")
  status          String    @default("running")
  promptVersion   String
  requestJson     Json
  responseJson    Json?
  errorCode       String?
  errorMessage    String?
  createdAt       DateTime  @default(now())
  finishedAt      DateTime?

  drafts GeneratedRouteReviewDraft[]

  @@index([city, status, createdAt, id])
}

model GeneratedRouteReviewDraft {
  id                 String    @id @default(cuid())
  batchId            String
  status             String    @default("needs_review")
  title              String
  description        String
  city               String
  timezone           String    @default("Europe/Moscow")
  area               String?
  vibe               String
  budget             String
  durationLabel      String
  totalPriceFrom     Int
  goal               String
  mood               String
  format             String?
  recommendedFor     String?
  badgeLabel         String?
  score              Int       @default(0)
  validationStatus   String    @default("pending")
  validationIssues   Json?
  reviewedByAdminId  String?
  reviewedAt         DateTime?
  reviewNote         String?
  createdTemplateId  String?
  publishedAt        DateTime?
  rejectedAt         DateTime?
  archivedAt         DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  batch GeneratedRouteDraftBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  steps GeneratedRouteDraftStep[]

  @@index([city, status, createdAt, id])
  @@index([batchId, score, id])
}

model GeneratedRouteDraftStep {
  id                    String   @id @default(cuid())
  draftId               String
  externalContentItemId String?
  sortOrder             Int
  timeLabel             String
  endTimeLabel          String?
  kind                  String
  title                 String
  venue                 String
  address               String
  emoji                 String
  distanceLabel         String
  walkMin               Int?
  description           String?
  vibeTag               String?
  ticketPrice           Int?
  lat                   Float
  lng                   Float
  sourceUrl             String?
  sourceName            String?
  sourceTitle           String?
  createdAt             DateTime @default(now())

  draft GeneratedRouteReviewDraft @relation(fields: [draftId], references: [id], onDelete: Cascade)
  externalContentItem ExternalContentItem? @relation(fields: [externalContentItemId], references: [id], onDelete: SetNull)

  @@index([draftId, sortOrder, id])
  @@index([externalContentItemId])
}
```

Status values:

- `ExternalImportRun.status`: `running`, `completed`, `failed`.
- `ExternalContentItem.moderationStatus`: `pending`, `approved`, `rejected`, `stale`.
- `GeneratedRouteDraftBatch.status`: `running`, `completed`, `failed`.
- `GeneratedRouteReviewDraft.status`: `needs_review`, `approved`, `converted`, `published`, `rejected`, `archived`.

Add DB check constraints in the migration for these string status fields.

## File Map

Create:

- `backend/apps/worker/src/content/content-source.types.ts`
- `backend/apps/worker/src/content/external-source.registry.ts`
- `backend/apps/worker/src/content/kudago.adapter.ts`
- `backend/apps/worker/src/content/timepad.adapter.ts`
- `backend/apps/worker/src/content/overpass.adapter.ts`
- `backend/apps/worker/src/content/content-normalizer.service.ts`
- `backend/apps/worker/src/content/content-deduplication.service.ts`
- `backend/apps/worker/src/content/content-import.service.ts`
- `backend/apps/worker/src/content/route-draft-generation.service.ts`
- `backend/apps/worker/test/unit/content-normalizer.service.spec.ts`
- `backend/apps/worker/test/unit/content-deduplication.service.spec.ts`
- `backend/apps/worker/test/unit/content-import.service.spec.ts`
- `backend/apps/worker/test/unit/route-draft-generation.service.spec.ts`
- `backend/apps/api/src/services/admin-route-review.service.ts`
- `backend/apps/api/test/unit/admin-route-review.service.unit.spec.ts`
- `admin/src/admin/pages/RouteReviewQueue.tsx`
- `admin/src/admin/evening/components/RouteReviewDraftCard.tsx`
- `admin/src/admin/evening/components/RouteReviewFilters.tsx`
- `admin/src/admin/evening/components/RouteReviewStepList.tsx`
- `admin/src/admin/evening/routeReviewApi.ts`
- `admin/src/admin/evening/routeReviewTypes.ts`
- `admin/src/admin/evening/routeReviewApi.test.ts`
- `admin/src/admin/pages/RouteReviewQueue.test.tsx`
- `backend/packages/database/prisma/migrations/<timestamp>_route_aggregation_review/migration.sql`

Modify:

- `backend/packages/database/prisma/schema.prisma`
- `backend/packages/contracts/src/index.ts`
- `backend/apps/api/src/app.module.ts`
- `backend/apps/api/src/controllers/admin-evening.controller.ts`
- `backend/apps/api/src/services/admin-evening-route.service.ts`
- `backend/apps/worker/src/app.module.ts`
- `backend/apps/worker/src/worker.service.ts`
- `admin/src/App.tsx`
- `admin/src/admin/portal.ts`
- `admin/src/admin/evening/api.test.ts`
- `ai-context/database.md`
- `ai-context/backend-api.md`
- `ai-context/infra.md`

## API Design

Admin endpoints under existing `@Admin()` controller:

```text
GET  /admin/evening/route-review/drafts
GET  /admin/evening/route-review/drafts/:draftId
POST /admin/evening/route-review/drafts/:draftId/approve
POST /admin/evening/route-review/drafts/:draftId/reject
POST /admin/evening/route-review/drafts/:draftId/convert
POST /admin/evening/route-review/drafts/:draftId/publish
POST /admin/evening/route-review/import-runs
GET  /admin/evening/route-review/import-runs
GET  /admin/evening/route-review/sources
```

Query for draft list:

```text
city=Москва
status=needs_review
source=kudago
limit=50
cursor=<createdAt:id>
```

Review action body:

```json
{
  "reviewNote": "Подходит для спокойного вечера, места рядом"
}
```

Manual import body:

```json
{
  "city": "Москва",
  "sources": ["kudago", "timepad", "overpass"],
  "from": "2026-05-04",
  "to": "2026-05-11"
}
```

## Worker Runtime

Add env flags:

```text
CONTENT_IMPORT_ENABLED=false
CONTENT_IMPORT_INTERVAL_MS=21600000
CONTENT_IMPORT_CITIES=Москва,Санкт-Петербург
CONTENT_IMPORT_SOURCES=kudago,timepad,overpass
CONTENT_ROUTE_GENERATION_ENABLED=false
CONTENT_ROUTE_GENERATION_INTERVAL_MS=21600000
CONTENT_ROUTE_GENERATION_MAX_DRAFTS_PER_CITY=12
OPENROUTER_API_KEY=
OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free
KUDAGO_BASE_URL=https://kudago.com/public-api/v1.4
TIMEPAD_BASE_URL=https://api.timepad.ru/v1
TIMEPAD_API_TOKEN=
OVERPASS_BASE_URL=https://overpass-api.de/api/interpreter
```

Default all scheduled imports to disabled. Manual admin trigger can still create an import run.

Use `fetch` with timeout through `AbortController`. Do not add a dependency unless Node runtime lacks global `fetch`.

OpenRouter model note:

- The first MVP model is `nvidia/nemotron-3-super-120b-a12b:free`.
- Treat the OpenRouter context as `262144` tokens for prompt budgeting.
- Do not rely on full-context prompts for normal jobs. Keep each route generation request bounded to the top candidate set for one city, area, mood and budget.
- Reserve output room. Target request payload should stay under `180000` input tokens even if the model advertises a larger context.
- Free models can have stricter rate, availability, queue and parameter limits. If OpenRouter returns model availability or rate errors, mark only the generation batch as failed.
- Never store `OPENROUTER_API_KEY` in the repository, plan files, admin UI or logs.

## Route Generation Strategy

MVP generation batches:

- City: Moscow, Saint Petersburg.
- Areas: center, north, south, east, west, plus null area.
- Moods: `calm`, `social`, `date`, `culture`, `active`.
- Budget: `free`, `low`, `mid`.
- Steps: 2 to 4.

Candidate selection:

- Events with `startsAt` in the next 14 days.
- Places with coordinates.
- Walk time between steps should be under 20 minutes.
- Avoid repeating the same source item.
- Prefer mix: one anchor event plus one nearby place, or two to four nearby places.
- For unknown opening hours, add warning instead of rejecting.
- Reject drafts with missing coordinates or over 30 minutes between steps.

Prompt guardrails:

- Do not copy external article text.
- Create original Frendly copy.
- Include source URLs only as references.
- Do not claim a partner perk.
- Do not claim reservation, discount, ticket availability, or official partnership.
- Route must work as a social meeting scenario.

## Tasks

### Task 1: Add database schema and migration

**Files:**

- Modify: `backend/packages/database/prisma/schema.prisma`
- Create: `backend/packages/database/prisma/migrations/<timestamp>_route_aggregation_review/migration.sql`

- [ ] Add the models from `Data Model Draft`.
- [ ] Add indexes exactly as listed in the draft.
- [ ] Add check constraints for string statuses in migration SQL.
- [ ] Run Prisma format:

```bash
cd backend && pnpm --filter @big-break/database prisma:format
```

- [ ] Run Prisma generate:

```bash
cd backend && pnpm --filter @big-break/database prisma:generate
```

- [ ] Expected result: Prisma client generates without schema errors.

### Task 2: Add contracts for route review

**Files:**

- Modify: `backend/packages/contracts/src/index.ts`

- [ ] Add DTOs:

```ts
export interface AdminRouteReviewDraftStepDto {
  id: string;
  sortOrder: number;
  externalContentItemId: string | null;
  timeLabel: string;
  endTimeLabel: string | null;
  kind: string;
  title: string;
  venue: string;
  address: string;
  emoji: string;
  distanceLabel: string;
  walkMin: number | null;
  description: string | null;
  vibeTag: string | null;
  ticketPrice: number | null;
  lat: number;
  lng: number;
  sourceUrl: string | null;
  sourceName: string | null;
  sourceTitle: string | null;
}

export interface AdminRouteReviewDraftDto {
  id: string;
  batchId: string;
  status: string;
  title: string;
  description: string;
  city: string;
  timezone: string;
  area: string | null;
  vibe: string;
  budget: string;
  durationLabel: string;
  totalPriceFrom: number;
  goal: string;
  mood: string;
  format: string | null;
  recommendedFor: string | null;
  badgeLabel: string | null;
  score: number;
  validationStatus: string;
  validationIssues: AdminAiEveningValidationIssueDto[];
  reviewedByAdminId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdTemplateId: string | null;
  publishedAt: string | null;
  rejectedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  steps: AdminRouteReviewDraftStepDto[];
}

export interface AdminRouteReviewDraftListDto {
  items: AdminRouteReviewDraftDto[];
  nextCursor: string | null;
}

export interface AdminRouteReviewActionInput {
  reviewNote?: string | null;
}

export interface AdminExternalImportRunDto {
  id: string;
  sourceId: string;
  city: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  fetchedCount: number;
  normalizedCount: number;
  skippedCount: number;
  errorCode: string | null;
  errorMessage: string | null;
}
```

- [ ] Run contracts build through backend build later in Task 13.

### Task 3: Add worker source adapter types and registry

**Files:**

- Create: `backend/apps/worker/src/content/content-source.types.ts`
- Create: `backend/apps/worker/src/content/external-source.registry.ts`

- [ ] Define shared raw and normalized shapes:

```ts
export type ExternalSourceCode = 'kudago' | 'timepad' | 'overpass';

export type ExternalRawItem = {
  sourceCode: ExternalSourceCode;
  sourceItemId: string;
  sourceUrl?: string | null;
  contentKind: 'place' | 'event';
  city: string;
  timezone: string;
  title: string;
  description?: string | null;
  category?: string | null;
  tags?: string[];
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  priceFrom?: number | null;
  currency?: string | null;
  raw: unknown;
};

export type ExternalSourceFetchInput = {
  city: string;
  cityCode: string;
  from: Date;
  to: Date;
  signal: AbortSignal;
};

export interface ExternalSourceAdapter {
  code: ExternalSourceCode;
  fetchItems(input: ExternalSourceFetchInput): Promise<ExternalRawItem[]>;
}
```

- [ ] Registry maps enabled source codes to adapter instances.
- [ ] Add unit tests in Task 7.

### Task 4: Add KudaGo, Timepad and Overpass adapters

**Files:**

- Create: `backend/apps/worker/src/content/kudago.adapter.ts`
- Create: `backend/apps/worker/src/content/timepad.adapter.ts`
- Create: `backend/apps/worker/src/content/overpass.adapter.ts`

- [ ] `KudaGoAdapter` maps city names:

```ts
const KUDAGO_CITY_CODES: Record<string, string> = {
  'Москва': 'msk',
  'Санкт-Петербург': 'spb',
};
```

- [ ] Fetch events and places separately. Store upstream URL in `sourceUrl`.
- [ ] `TimepadAdapter` requires `TIMEPAD_API_TOKEN`. If token is missing, return an empty list and log `timepad_disabled_missing_token`.
- [ ] `OverpassAdapter` imports only places for MVP:

```text
amenity=cafe
amenity=bar
amenity=restaurant
tourism=museum
tourism=gallery
leisure=park
leisure=sports_centre
```

- [ ] Each adapter must return no more than 500 raw items per city per run.
- [ ] Each adapter must accept `AbortSignal`.
- [ ] Each adapter must avoid throwing for one bad item. Skip bad item, keep run alive.

### Task 5: Add normalization and deduplication

**Files:**

- Create: `backend/apps/worker/src/content/content-normalizer.service.ts`
- Create: `backend/apps/worker/src/content/content-deduplication.service.ts`
- Create: `backend/apps/worker/test/unit/content-normalizer.service.spec.ts`
- Create: `backend/apps/worker/test/unit/content-deduplication.service.spec.ts`

- [ ] Normalizer trims title, address and summary.
- [ ] Normalizer maps categories to Frendly categories:

```ts
const CATEGORY_MAP: Record<string, string> = {
  cafe: 'food',
  bar: 'food',
  restaurant: 'food',
  museum: 'culture',
  gallery: 'culture',
  park: 'walk',
  sports_centre: 'active',
  concert: 'culture',
  theatre: 'culture',
  lecture: 'culture',
};
```

- [ ] Normalizer computes `normalizedHash` from city, normalized title, rounded coordinates, content kind.
- [ ] Deduplication uses:

```text
same city
same contentKind
same normalized title
distance under 80 meters when both coordinates exist
```

- [ ] Test: two OSM and KudaGo items with same title and close coordinates map to the same hash group.
- [ ] Test: two events with same title but different dates are not deduplicated.

### Task 6: Add import service in worker

**Files:**

- Create: `backend/apps/worker/src/content/content-import.service.ts`
- Modify: `backend/apps/worker/src/app.module.ts`
- Modify: `backend/apps/worker/src/worker.service.ts`
- Create: `backend/apps/worker/test/unit/content-import.service.spec.ts`

- [ ] `ContentImportService.runImport({ city, sources, from, to })` creates `ExternalImportRun`.
- [ ] It upserts `ExternalContentSource` by source code.
- [ ] It upserts `ExternalContentItem` by `sourceId + sourceItemId`.
- [ ] It stores `raw` only for debugging and reprocessing.
- [ ] It increments `fetchedCount`, `normalizedCount`, `skippedCount`.
- [ ] On adapter failure, mark only that run as `failed`.
- [ ] Add worker scheduled scan:

```ts
if (process.env.CONTENT_IMPORT_ENABLED === 'true') {
  // every CONTENT_IMPORT_INTERVAL_MS
  // run each configured city and source
}
```

- [ ] Do not run import from API request path. Admin manual trigger may enqueue or call worker service later, but MVP API should only create a run request if worker integration is explicit.

### Task 7: Add route draft generation service in worker

**Files:**

- Create: `backend/apps/worker/src/content/route-draft-generation.service.ts`
- Modify: `backend/apps/worker/src/app.module.ts`
- Modify: `backend/apps/worker/src/worker.service.ts`
- Create: `backend/apps/worker/test/unit/route-draft-generation.service.spec.ts`

- [ ] Select candidate `ExternalContentItem` rows:

```text
city matches
moderationStatus in pending or approved
lat and lng are not null
expiresAt is null or in future
startsAt is null or within next 14 days
```

- [ ] Build one `GeneratedRouteDraftBatch` per city plus area plus mood plus budget.
- [ ] Prompt OpenRouter through a small wrapper. Reuse existing `OpenRouterService` logic by extracting a shared helper if needed. Do not duplicate provider config parsing.
- [ ] Save AI response to `GeneratedRouteDraftBatch.responseJson`.
- [ ] Save 1 to 4 `GeneratedRouteReviewDraft` rows per batch.
- [ ] Validate drafts before saving:

```text
steps count between 2 and 4
all steps have coordinates
walkMin under 30
no repeated externalContentItemId
title length under 90
description length under 500
```

- [ ] Invalid drafts should be saved with `validationStatus=invalid`, not published.
- [ ] Scheduled generation is controlled by `CONTENT_ROUTE_GENERATION_ENABLED`.

### Task 8: Add admin route review service

**Files:**

- Create: `backend/apps/api/src/services/admin-route-review.service.ts`
- Modify: `backend/apps/api/src/app.module.ts`
- Create: `backend/apps/api/test/unit/admin-route-review.service.unit.spec.ts`

- [ ] Add `listDrafts(query)` with filters: city, status, source, limit, cursor.
- [ ] Add `getDraft(draftId)`.
- [ ] Add `approveDraft(draftId, body)`.
- [ ] Add `rejectDraft(draftId, body)`.
- [ ] Add `convertDraft(draftId)`.
- [ ] Add `publishDraft(draftId)`.
- [ ] `approveDraft` only allows `needs_review`.
- [ ] `rejectDraft` only allows `needs_review` or `approved`.
- [ ] `convertDraft` only allows `approved`.
- [ ] `publishDraft` only allows `converted`.
- [ ] `convertDraft` creates `EveningRouteTemplate` and revision through `AdminEveningRouteService`.
- [ ] `publishDraft` calls `AdminEveningRouteService.publishTemplate(createdTemplateId)`.
- [ ] Map generated steps to route revision steps:

```ts
{
  sortOrder: step.sortOrder,
  timeLabel: step.timeLabel,
  endTimeLabel: step.endTimeLabel,
  kind: step.kind,
  title: step.title,
  venue: step.venue,
  address: step.address,
  description: step.description,
  emoji: step.emoji,
  distanceLabel: step.distanceLabel,
  walkMin: step.walkMin,
  lat: step.lat,
  lng: step.lng,
}
```

- [ ] Do not set `partnerOfferId`.
- [ ] Do not set `perk`, `sponsored`, or partner snapshots.
- [ ] Unit test transitions:

```text
needs_review -> approved
approved -> converted
converted -> published
needs_review -> rejected
invalid direct publish fails
```

### Task 9: Add admin controller endpoints

**Files:**

- Modify: `backend/apps/api/src/controllers/admin-evening.controller.ts`

- [ ] Inject `AdminRouteReviewService`.
- [ ] Add endpoints from `API Design`.
- [ ] Keep them under existing `@Admin()` guard.
- [ ] Return DTOs from contracts.
- [ ] Use `ApiError` codes:

```text
route_review_draft_not_found
route_review_invalid_status
route_review_template_missing
content_import_source_invalid
```

### Task 10: Add admin client API and types

**Files:**

- Create: `admin/src/admin/evening/routeReviewTypes.ts`
- Create: `admin/src/admin/evening/routeReviewApi.ts`
- Create: `admin/src/admin/evening/routeReviewApi.test.ts`

- [ ] Mirror contract DTOs in admin types.
- [ ] Add client functions:

```ts
export function listRouteReviewDrafts(params: QueryParams = {}) {}
export function getRouteReviewDraft(draftId: string) {}
export function approveRouteReviewDraft(draftId: string, input: RouteReviewActionInput) {}
export function rejectRouteReviewDraft(draftId: string, input: RouteReviewActionInput) {}
export function convertRouteReviewDraft(draftId: string) {}
export function publishRouteReviewDraft(draftId: string) {}
export function listRouteReviewSources() {}
export function listRouteReviewImportRuns(params: QueryParams = {}) {}
export function createRouteReviewImportRun(input: RouteReviewImportRunInput) {}
```

- [ ] Test URL building with city, status and limit.
- [ ] Test POST bodies for approve and reject.

### Task 11: Add admin review queue UI

**Files:**

- Create: `admin/src/admin/pages/RouteReviewQueue.tsx`
- Create: `admin/src/admin/evening/components/RouteReviewDraftCard.tsx`
- Create: `admin/src/admin/evening/components/RouteReviewFilters.tsx`
- Create: `admin/src/admin/evening/components/RouteReviewStepList.tsx`
- Create: `admin/src/admin/pages/RouteReviewQueue.test.tsx`
- Modify: `admin/src/App.tsx`
- Modify: `admin/src/admin/portal.ts`

- [ ] Add route `/route-review`.
- [ ] Add sidebar item `Route Review` or Russian label `Ревью маршрутов`.
- [ ] Filters: city, status, source.
- [ ] Draft card shows:

```text
title
city
area
mood
budget
score
validationStatus
source links by step
steps
createdAt
reviewNote field
```

- [ ] Actions:

```text
approve
reject
convert
publish
open created template
```

- [ ] Disable impossible actions by status.
- [ ] Show destructive warning for reject.
- [ ] Do not nest cards inside cards.
- [ ] Keep table/list dense. This is admin tooling, not a landing page.
- [ ] Test renders empty state and one draft with actions.

### Task 12: Add manual import trigger in admin

**Files:**

- Modify: `admin/src/admin/pages/RouteReviewQueue.tsx`
- Modify: `admin/src/admin/evening/routeReviewApi.ts`
- Modify: `backend/apps/api/src/services/admin-route-review.service.ts`

- [ ] Add small manual import form:

```text
city
sources checkboxes
from date
to date
```

- [ ] On submit, call `POST /admin/evening/route-review/import-runs`.
- [ ] For MVP, service may create import run records with `status=pending_manual` only if direct worker call is not wired. If direct import is implemented inside API, document why it is acceptable. Preferred path is worker-owned import.
- [ ] Show import runs below the form.

### Task 13: Verification commands

**Files:** none.

- [ ] Run database generation:

```bash
cd backend && pnpm --filter @big-break/database prisma:generate
```

- [ ] Run API targeted tests:

```bash
cd backend && pnpm --filter @big-break/api test:unit -- admin-route-review.service.unit.spec.ts admin-evening-route.service.unit.spec.ts
```

- [ ] Run worker targeted tests:

```bash
cd backend && pnpm --filter @big-break/worker test:unit -- content-normalizer.service.spec.ts content-deduplication.service.spec.ts content-import.service.spec.ts route-draft-generation.service.spec.ts
```

- [ ] Run API build:

```bash
cd backend && pnpm --filter @big-break/api build
```

- [ ] Run worker build:

```bash
cd backend && pnpm --filter @big-break/worker build
```

- [ ] Run admin tests:

```bash
cd admin && npm run test
```

- [ ] Run admin build:

```bash
cd admin && npm run build
```

### Task 14: Update project context

**Files:**

- Modify: `ai-context/database.md`
- Modify: `ai-context/backend-api.md`
- Modify: `ai-context/infra.md`

- [ ] Update `database.md` with new model cluster:

```text
Route aggregation:
ExternalContentSource, ExternalImportRun, ExternalContentItem,
GeneratedRouteDraftBatch, GeneratedRouteReviewDraft, GeneratedRouteDraftStep.
```

- [ ] Update `backend-api.md` with admin route review endpoints.
- [ ] Update `infra.md` with new worker env flags.
- [ ] Run graph update:

```bash
bash scripts/update-understand-graph.sh
```

- [ ] If graph update fails, report the exact failure.

## Rollout

1. Deploy schema with import and review tables.
2. Keep `CONTENT_IMPORT_ENABLED=false` and `CONTENT_ROUTE_GENERATION_ENABLED=false`.
3. Use admin manual import for Moscow only.
4. Review first 20 generated drafts manually.
5. Publish only 3 to 5 safe routes.
6. Enable Saint Petersburg after Moscow review quality is acceptable.
7. Enable scheduled imports only after duplicate rate and source quality are measured.

## Acceptance Criteria

- Admin can trigger or inspect an import run.
- Worker can import KudaGo, Timepad and OSM data without breaking outbox processing.
- Worker can generate review drafts from imported candidates.
- Drafts appear in admin queue with source links and validation warnings.
- Admin can approve, reject, convert and publish a draft.
- Published draft appears as an existing Evening route template.
- No AI generated route becomes public before an admin action.
- Existing Route Studio still works.
- Existing mobile Evening catalog does not need changes for published routes.

## Risks

- Source terms may restrict storage or display. Keep links and facts. Do not copy article text.
- Duplicate places will happen. Use hash plus distance. Add manual merge later if needed.
- AI may invent details. Prompt must forbid perks, reservations and partnerships.
- OSM data can be noisy. Start with conservative categories.
- Timepad may require token and rate handling. Missing token should not fail the whole job.
- Worker can become too large. If ingestion grows, split into `content-worker` later.

## Future Follow-ups

- Add coupon adapters after route quality is stable.
- Add 2ГИС or Yandex only after legal terms are clear.
- Add map preview in admin route review.
- Add route quality analytics: publish rate, reject reasons, duplicate rate.
- Add source health dashboard.
- Add automatic publish for high confidence drafts only after manual review data proves quality.
