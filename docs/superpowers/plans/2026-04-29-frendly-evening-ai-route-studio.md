# Frendly Evening AI Route Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development if the user asks for parallel work, or superpowers:executing-plans for inline execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin and user system where the Frendly team creates curated AI-assisted route templates, users create public meetings from those templates, each meeting gets its own chat, and partner offers are redeemed through personal QR codes.

**Architecture:** Keep one production Evening runtime. Add a curated route template layer above the existing `EveningRoute`. For MVP, use existing `EveningRoute` rows as immutable route revisions, grouped by a new `EveningRouteTemplate`, because current sessions, live flow, chats and step states already depend on `EveningRoute` and `EveningRouteStep`.

**Tech Stack:** PostgreSQL, Prisma, NestJS, shared contracts package, React admin app, Flutter mobile app, React landing page, OpenRouter API for LLM generation, DaData later for address assist, 2GIS later for venue candidates.

---

## How To Use This Plan

- Start each new session with `project_map.md`, `ai-context/index.md`, then this plan.
- Read only the AI context files needed for the current task.
- Work task by task.
- Mark a checkbox only after code, tests and docs for that step are done.
- If a task changes architecture, update the matching file in `ai-context`.
- Keep commits small. Commit messages must be in Russian.
- Do not let LLM output become source of truth. Only saved admin approved data becomes public.
- Do not expose user personal data on partner QR activation pages.

## Locked Product Decisions

- Curated routes live in a separate mobile screen named `Маршруты`.
- Entry to `Маршруты` is a button on `Tonight`, not a bottom tab in MVP.
- General feed contains only real meetings with date, host, participants and chat.
- A route without created meetings appears only in `Маршруты`.
- Every route belongs to one city.
- Moscow routes are shown to users whose current app city is Moscow.
- Route cards can show area and distance ranking when location exists.
- Users can create meetings from team routes.
- Meetings created from team routes are public feed items for everyone in the city.
- Users cannot edit route steps, places, order, duration, budget or text for team routes.
- The Frendly team can edit anything in admin.
- Admin edits create a new version in the database.
- Old meetings keep the exact route version they were created from.
- A chat belongs to a concrete `EveningSession`, not to a route template.
- Partner offers are visible on route cards and in the related route step.
- Each user gets a separate QR code per partner offer in a meeting.
- QR opens `https://frendly.tech/code/<code>`.
- Partner sees only activation result, offer name, venue or partner name and activation time.
- Partner does not see user name, phone, profile or avatar.
- Code expiration is always next calendar day after `session.startsAt` in session timezone at `06:00`.
- For Moscow timezone use `Europe/Moscow`.

## MVP Boundaries

Included in MVP:

- Admin venue catalog.
- Partner and partner offer records.
- Curated route template model with versioned route revisions.
- Admin manual route editor.
- Admin AI Route Studio through OpenRouter.
- User route catalog screen.
- User can create meeting from a curated route.
- Meeting appears in general Evening session feed.
- Meeting has its own chat through existing Evening session flow.
- Partner offer QR generation, fullscreen display and public activation page.
- Focused analytics for route views, session creation and offer activation.

Not included in MVP:

- Partner cabinet.
- Partner login for scanning.
- Automatic 2GIS import as source of truth.
- Full booking integration.
- Payment or ticketing.
- Dynamic route rebuild during live evening.
- Bottom navigation tab for routes.
- Showing route version history in admin UI.

## Existing Code Anchors

- Project map: `project_map.md`
- Backend map: `ai-context/backend-api.md`
- Database map: `ai-context/database.md`
- Flutter map: `ai-context/frontend-flutter.md`
- Prisma schema: `backend/packages/database/prisma/schema.prisma`
- Evening controller: `backend/apps/api/src/controllers/evening.controller.ts`
- Evening service: `backend/apps/api/src/services/evening.service.ts`
- API module: `backend/apps/api/src/app.module.ts`
- Contracts: `backend/packages/contracts/src/index.ts`
- Admin client: `admin/src/admin/api/client.ts`
- Admin routes: `admin/src/App.tsx`
- Admin sidebar: `admin/src/admin/components/Sidebar.tsx`
- Flutter route enum: `mobile/lib/app/navigation/app_routes.dart`
- Flutter router: `mobile/lib/app/navigation/app_router.dart`
- Flutter backend repository: `mobile/lib/shared/data/backend_repository.dart`
- Flutter Evening feature: `mobile/lib/features/evening_plan/presentation/`
- Landing routes: `landing/src/App.tsx`
- Public share page pattern: `landing/src/pages/PublicSharePage.tsx`

## Data Model Direction

MVP uses this shape:

- `EveningRouteTemplate` is the public template users browse in `Маршруты`.
- `EveningRoute` is one immutable route revision.
- `EveningRouteStep` is one immutable step snapshot for that revision.
- `EveningRouteTemplate.currentRouteId` points to the latest public revision.
- `EveningSession.routeId` keeps pointing to the exact `EveningRoute` revision used by that meeting.
- `EveningSession.routeTemplateId` is added for fast listing by template.
- Admin edits clone current route and steps into a new `EveningRoute` revision.
- Old sessions keep old `routeId`.

This avoids a large rewrite of live flow, because `EveningSessionStepState`, `EveningStepCheckIn` and existing mappers already use `EveningRouteStep`.

## Phase Status

- [x] Phase 1, database foundation
- [x] Phase 2, backend route templates and venue catalog
- [x] Phase 3, admin catalog and route editor
- [x] Phase 4, mobile route catalog and meeting creation
- [ ] Phase 5, partner QR redemption
- [ ] Phase 6, AI Route Studio
- [ ] Phase 7, analytics and dashboards
- [ ] Phase 8, verification, docs and context update

---

## Phase 1, Database Foundation

### Task 1.1: Add curated route, partner, venue and offer schema

**Files:**

- Modify: `backend/packages/database/prisma/schema.prisma`
- Create migration: `backend/packages/database/prisma/migrations/<timestamp>_curated_evening_routes/migration.sql`
- Test through Prisma generate.

**Result after completion:** Database can store route templates, immutable route revisions, venues, partners and partner offers.

- [x] Add enum-like string fields through normal `String` columns, matching current schema style for Evening phase and privacy.
- [x] Add model `Partner`.
- [x] Add model `Venue`.
- [x] Add model `PartnerOffer`.
- [x] Add model `EveningRouteTemplate`.
- [x] Add fields to `EveningRoute`.
- [x] Add fields to `EveningRouteStep`.
- [x] Add field `routeTemplateId` to `EveningSession`.
- [x] Add indexes for city feeds and template session lists.
- [x] Run Prisma format.
- [x] Run Prisma generate.
- [x] Commit with `git commit -m "feat: добавить основу маршрутов Frendly"`.

Use this model shape:

```prisma
model Partner {
  id        String   @id @default(cuid())
  name      String
  city      String
  status    String   @default("active")
  contact   String?
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  venues Venue[]
  offers PartnerOffer[]

  @@index([city, status, id])
}

model Venue {
  id               String   @id @default(cuid())
  ownerType        String   @default("frendly")
  partnerId        String?
  source           String   @default("manual")
  externalId       String?
  moderationStatus String   @default("approved")
  trustLevel       String   @default("verified")
  city             String
  timezone         String   @default("Europe/Moscow")
  area             String?
  name             String
  address          String
  lat              Float
  lng              Float
  category         String
  tags             Json
  averageCheck     Int?
  openingHours     Json?
  status           String   @default("open")
  lastSyncedAt     DateTime?
  lastVerifiedAt   DateTime?
  verifiedByAdminId String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  partner Partner? @relation(fields: [partnerId], references: [id], onDelete: SetNull)
  offers  PartnerOffer[]

  @@unique([source, externalId])
  @@index([city, moderationStatus, trustLevel, id])
  @@index([city, category, id])
  @@index([partnerId, id])
}

model PartnerOffer {
  id          String   @id @default(cuid())
  partnerId   String
  venueId     String
  title       String
  description String
  terms       String?
  shortLabel  String?
  validFrom   DateTime?
  validTo     DateTime?
  daysOfWeek  Json?
  timeWindow  Json?
  status      String   @default("active")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  partner Partner @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  venue   Venue   @relation(fields: [venueId], references: [id], onDelete: Cascade)

  @@index([partnerId, status, id])
  @@index([venueId, status, id])
}

model EveningRouteTemplate {
  id                 String   @id @default(cuid())
  source             String   @default("team")
  status             String   @default("draft")
  city               String
  timezone           String   @default("Europe/Moscow")
  area               String?
  centerLat          Float?
  centerLng          Float?
  radiusMeters       Int?
  currentRouteId     String?  @unique
  scheduledPublishAt DateTime?
  publishedAt        DateTime?
  archivedAt         DateTime?
  createdByAdminId   String?
  updatedByAdminId   String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  currentRoute EveningRoute?  @relation("CurrentEveningRoute", fields: [currentRouteId], references: [id], onDelete: SetNull)
  revisions    EveningRoute[] @relation("EveningRouteTemplateRevisions")
  sessions     EveningSession[]

  @@index([city, status, publishedAt, id])
  @@index([city, scheduledPublishAt, id])
}
```

Add these fields to `EveningRoute`:

```prisma
templateId       String?
template         EveningRouteTemplate? @relation("EveningRouteTemplateRevisions", fields: [templateId], references: [id], onDelete: SetNull)
currentForTemplate EveningRouteTemplate? @relation("CurrentEveningRoute")
version          Int     @default(1)
source           String  @default("manual")
status           String  @default("legacy")
city             String  @default("Москва")
timezone         String  @default("Europe/Moscow")
centerLat        Float?
centerLng        Float?
radiusMeters     Int?
isCurated        Boolean @default(false)
badgeLabel       String?
coverAssetId     String?
createdByAdminId String?
publishedAt      DateTime?
archivedAt       DateTime?

@@index([templateId, version])
@@index([city, status, isCurated, id])
@@index([city, publishedAt, id])
```

Add these fields to `EveningRouteStep`:

```prisma
venueId                         String?
partnerOfferId                  String?
offerTitleSnapshot              String?
offerDescriptionSnapshot        String?
offerTermsSnapshot              String?
offerShortLabelSnapshot         String?
offerValidFromSnapshot          DateTime?
offerValidToSnapshot            DateTime?
venueNameSnapshot               String?
venueAddressSnapshot            String?
venueLatSnapshot                Float?
venueLngSnapshot                Float?

@@index([venueId])
@@index([partnerOfferId])
```

Add this field to `EveningSession`:

```prisma
routeTemplateId String?
routeTemplate   EveningRouteTemplate? @relation(fields: [routeTemplateId], references: [id], onDelete: SetNull)

@@index([routeTemplateId, phase, startsAt, id])
```

Validation command:

```bash
cd backend
pnpm --filter @big-break/database prisma format
pnpm db:generate
```

Expected result: Prisma client generation succeeds.

### Task 1.2: Add partner offer code schema

**Files:**

- Modify: `backend/packages/database/prisma/schema.prisma`
- Create migration: same migration as Task 1.1 if not applied yet, otherwise a new migration.

**Result after completion:** Database can issue, activate and audit one personal offer code per user, meeting, partner, step and offer.

- [x] Add `PartnerOfferCode` model.
- [x] Add relations from `User`, `EveningSession`, `EveningRoute`, `EveningRouteStep`, `Partner`, `Venue` and `PartnerOffer` where needed.
- [x] Add unique key that prevents duplicate active codes for one user and one offer in one meeting.
- [x] Add indexes for partner analytics.
- [x] Run Prisma generate.
- [x] Commit with `git commit -m "feat: добавить коды партнерских офферов"`.

Use this model shape:

```prisma
model PartnerOfferCode {
  id           String   @id @default(cuid())
  codeHash     String   @unique
  userId       String
  sessionId    String
  routeId      String
  routeTemplateId String?
  stepId       String
  partnerId    String
  venueId      String
  offerId      String
  status       String   @default("issued")
  issuedAt     DateTime @default(now())
  activatedAt  DateTime?
  expiresAt    DateTime
  activatedIpHash String?
  activatedUserAgent String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user    User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  session EveningSession   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  route   EveningRoute     @relation(fields: [routeId], references: [id], onDelete: Cascade)
  step    EveningRouteStep @relation(fields: [stepId], references: [id], onDelete: Cascade)
  partner Partner          @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  venue   Venue            @relation(fields: [venueId], references: [id], onDelete: Cascade)
  offer   PartnerOffer     @relation(fields: [offerId], references: [id], onDelete: Cascade)

  @@unique([userId, sessionId, partnerId, stepId, offerId])
  @@index([sessionId, userId, status])
  @@index([partnerId, activatedAt, id])
  @@index([venueId, activatedAt, id])
  @@index([offerId, activatedAt, id])
  @@index([routeTemplateId, activatedAt, id])
}
```

### Task 1.3: Add AI draft schema

**Files:**

- Modify: `backend/packages/database/prisma/schema.prisma`
- Create migration if previous migration is already applied.

**Result after completion:** Admin AI generation can save briefs, model runs, raw responses, generated drafts and draft steps without polluting public route tables.

- [x] Add `AiEveningBrief`.
- [x] Add `AiEveningGenerationRun`.
- [x] Add `AiEveningDraft`.
- [x] Add `AiEveningDraftStep`.
- [x] Keep raw request and raw response as `Json`.
- [x] Keep prompt version and model name on every run.
- [x] Add indexes by status, city and created time.
- [x] Run Prisma generate.
- [x] Commit with `git commit -m "feat: добавить черновики AI маршрутов"`.

Use this model shape:

```prisma
model AiEveningBrief {
  id              String   @id @default(cuid())
  city            String
  timezone        String   @default("Europe/Moscow")
  area            String?
  titleIdea       String
  audience        String
  format          String
  mood            String
  budget          String
  durationMinutes Int
  minSteps        Int      @default(2)
  maxSteps        Int      @default(4)
  requiredVenueIds Json?
  excludedVenueIds Json?
  partnerGoal     String?
  tone            String?
  boldness        String?
  status          String   @default("draft")
  createdByAdminId String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  runs   AiEveningGenerationRun[]
  drafts AiEveningDraft[]

  @@index([city, status, createdAt, id])
}

model AiEveningGenerationRun {
  id            String   @id @default(cuid())
  briefId       String
  provider      String   @default("openrouter")
  model         String
  promptVersion String
  status        String   @default("running")
  requestJson   Json
  responseJson  Json?
  errorCode     String?
  errorMessage  String?
  latencyMs     Int?
  createdAt     DateTime @default(now())
  finishedAt    DateTime?

  brief AiEveningBrief @relation(fields: [briefId], references: [id], onDelete: Cascade)
  drafts AiEveningDraft[]

  @@index([briefId, createdAt, id])
  @@index([provider, model, createdAt, id])
}

model AiEveningDraft {
  id              String   @id @default(cuid())
  briefId          String
  runId            String?
  title            String
  description      String
  city             String
  area             String?
  vibe             String
  budget           String
  durationLabel    String
  totalPriceFrom   Int
  score            Int      @default(0)
  validationStatus String   @default("pending")
  validationIssues Json?
  selectedAt       DateTime?
  createdRouteId   String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  brief AiEveningBrief @relation(fields: [briefId], references: [id], onDelete: Cascade)
  run   AiEveningGenerationRun? @relation(fields: [runId], references: [id], onDelete: SetNull)
  steps AiEveningDraftStep[]

  @@index([briefId, validationStatus, score, id])
}

model AiEveningDraftStep {
  id            String   @id @default(cuid())
  draftId       String
  sortOrder     Int
  venueId       String?
  partnerOfferId String?
  kind          String
  title         String
  timeLabel     String
  endTimeLabel  String?
  description   String?
  transition    String?
  priceEstimate Int?
  walkMin       Int?
  createdAt     DateTime @default(now())

  draft AiEveningDraft @relation(fields: [draftId], references: [id], onDelete: Cascade)

  @@index([draftId, sortOrder, id])
  @@index([venueId])
}
```

### Task 1.4: Add focused analytics schema

**Files:**

- Modify: `backend/packages/database/prisma/schema.prisma`
- Create migration if previous migration is already applied.

**Result after completion:** Product and partner metrics can be queried without scanning operational tables.

- [x] Add `EveningAnalyticsEvent`.
- [x] Store event name, user id, session id, route id, template id, partner id, offer id and metadata.
- [x] Add indexes for product dashboards and partner dashboards.
- [x] Run Prisma generate.
- [x] Commit with `git commit -m "feat: добавить аналитику вечерних маршрутов"`.

Use this model shape:

```prisma
model EveningAnalyticsEvent {
  id              String   @id @default(cuid())
  name            String
  userId          String?
  routeTemplateId String?
  routeId         String?
  sessionId       String?
  partnerId       String?
  venueId         String?
  offerId         String?
  city            String?
  metadata        Json?
  createdAt       DateTime @default(now())

  @@index([name, createdAt, id])
  @@index([routeTemplateId, name, createdAt, id])
  @@index([sessionId, name, createdAt, id])
  @@index([partnerId, name, createdAt, id])
  @@index([city, name, createdAt, id])
}
```

---

## Phase 2, Backend Route Templates And Venue Catalog

### Task 2.1: Split Evening service responsibilities without changing behavior

**Files:**

- Modify: `backend/apps/api/src/services/evening.service.ts`
- Create: `backend/apps/api/src/services/evening-route-template.service.ts`
- Create: `backend/apps/api/src/services/evening-analytics.service.ts`
- Modify: `backend/apps/api/src/app.module.ts`
- Test: `backend/apps/api/test/unit/evening-route-template.service.spec.ts`

**Result after completion:** Existing Evening endpoints still work, while new route template logic has a focused service.

- [x] Add `EveningRouteTemplateService`.
- [x] Add `EveningAnalyticsService` with a no-throw `track` method.
- [x] Register both services in `ApiAppModule`.
- [x] Do not move existing `EveningService` methods yet.
- [x] Add one unit test for `EveningAnalyticsService.track` to confirm analytics failures do not break user flow.
- [x] Run unit tests.
- [x] Commit with `git commit -m "refactor: выделить сервисы маршрутов Frendly"`.

Expected analytics service behavior:

```ts
await analytics.track({
  name: 'route_template_viewed',
  userId,
  routeTemplateId,
  city,
  metadata: { surface: 'routes_screen' },
});
```

If Prisma insert fails, method logs and returns.

Validation command:

```bash
cd backend
pnpm test:unit
```

Expected result: unit tests pass.

### Task 2.2: Add admin auth token guard for admin API

**Files:**

- Create: `backend/apps/api/src/common/admin-token.guard.ts`
- Create: `backend/apps/api/src/common/admin.decorator.ts`
- Modify: `backend/apps/api/src/app.module.ts` if needed.
- Modify: `admin/src/admin/api/client.ts`
- Test: `backend/apps/api/test/unit/admin-token.guard.spec.ts`

**Result after completion:** Admin endpoints can be protected before a full admin auth system exists.

- [x] Create `AdminTokenGuard`.
- [x] Create `@Admin()` decorator or controller-level guard helper.
- [x] Read token from `ADMIN_API_TOKEN`.
- [x] Accept token from header `x-admin-token`.
- [x] Return `403 admin_forbidden` if token is missing or wrong.
- [x] In admin client, send `VITE_ADMIN_API_TOKEN` as `x-admin-token` if present.
- [x] Add unit tests for missing, wrong and correct token.
- [x] Commit with `git commit -m "feat: защитить админские API токеном"`.

Important rule: do not use this as final long-term security. It is an MVP gate for admin-only routes.

### Task 2.3: Add venue and partner admin API

**Files:**

- Create: `backend/apps/api/src/controllers/admin-evening.controller.ts`
- Create: `backend/apps/api/src/services/admin-venue.service.ts`
- Modify: `backend/apps/api/src/app.module.ts`
- Modify: `backend/packages/contracts/src/index.ts`
- Test: `backend/apps/api/test/unit/admin-venue.service.spec.ts`

**Result after completion:** Admin can create, edit, list and approve partners, venues and offers through backend API.

- [x] Add DTO interfaces in contracts for `PartnerDto`, `VenueDto`, `PartnerOfferDto`.
- [x] Add `GET /admin/evening/partners`.
- [x] Add `POST /admin/evening/partners`.
- [x] Add `PATCH /admin/evening/partners/:partnerId`.
- [x] Add `GET /admin/evening/venues`.
- [x] Add `POST /admin/evening/venues`.
- [x] Add `PATCH /admin/evening/venues/:venueId`.
- [x] Add `GET /admin/evening/offers`.
- [x] Add `POST /admin/evening/offers`.
- [x] Add `PATCH /admin/evening/offers/:offerId`.
- [x] Validate city, address, coordinates, category and status.
- [x] Keep venue `moderationStatus=approved` for Frendly-created venues.
- [x] Keep partner-created venue support through `pending`, even though partner cabinet is outside MVP.
- [x] Unit test venue creation with required fields.
- [x] Unit test offer creation rejects inactive or missing venue.
- [x] Commit with `git commit -m "feat: добавить админский каталог мест"`.

Required request shape for venue create:

```json
{
  "ownerType": "frendly",
  "partnerId": null,
  "source": "manual",
  "city": "Москва",
  "timezone": "Europe/Moscow",
  "area": "центр",
  "name": "Example Bar",
  "address": "Москва, Example street, 1",
  "lat": 55.7558,
  "lng": 37.6173,
  "category": "bar",
  "tags": ["date", "quiet", "wine"],
  "averageCheck": 1800,
  "openingHours": {
    "mon": [["12:00", "23:00"]],
    "tue": [["12:00", "23:00"]],
    "wed": [["12:00", "23:00"]],
    "thu": [["12:00", "23:00"]],
    "fri": [["12:00", "02:00"]],
    "sat": [["12:00", "02:00"]],
    "sun": [["12:00", "23:00"]]
  }
}
```

### Task 2.4: Add route template public API

**Files:**

- Modify: `backend/apps/api/src/controllers/evening.controller.ts`
- Modify: `backend/apps/api/src/services/evening-route-template.service.ts`
- Modify: `backend/packages/contracts/src/index.ts`
- Test: `backend/apps/api/test/unit/evening-route-template.service.spec.ts`

**Result after completion:** Mobile can list route templates, open route details and see nearby sessions for one template.

- [x] Add contracts `EveningRouteTemplateSummaryDto`, `EveningRouteTemplateDetailDto`, `EveningRouteTemplateSessionDto`.
- [x] Add `GET /evening/route-templates?city=Москва&limit=20`.
- [x] Add `GET /evening/route-templates/:templateId`.
- [x] Add `GET /evening/route-templates/:templateId/sessions`.
- [x] Filter only `status=published`.
- [x] Filter by city.
- [x] Return current route revision data through `currentRouteId`.
- [x] Return at most 3 nearest sessions in summary.
- [x] Track `route_template_viewed` on detail.
- [x] Unit test city filtering.
- [x] Unit test archived template is hidden.
- [x] Commit with `git commit -m "feat: добавить публичный каталог маршрутов"`.

Summary response must include:

```ts
{
  id: string;
  routeId: string;
  title: string;
  blurb: string;
  city: string;
  area: string | null;
  badgeLabel: string | null;
  coverUrl: string | null;
  vibe: string;
  budget: string;
  durationLabel: string;
  totalPriceFrom: number;
  stepsPreview: Array<{ title: string; venue: string; emoji: string }>;
  partnerOffersPreview: Array<{ partnerId: string; title: string; shortLabel: string | null }>;
  nearestSessions: Array<{ sessionId: string; startsAt: string; joinedCount: number; capacity: number }>;
}
```

### Task 2.5: Add admin route template CRUD and versioning

**Files:**

- Modify: `backend/apps/api/src/controllers/admin-evening.controller.ts`
- Create: `backend/apps/api/src/services/admin-evening-route.service.ts`
- Modify: `backend/apps/api/src/app.module.ts`
- Modify: `backend/packages/contracts/src/index.ts`
- Test: `backend/apps/api/test/unit/admin-evening-route.service.spec.ts`

**Result after completion:** Admin can create a draft route, publish it, edit it, and each save creates a new route revision without changing old sessions.

- [x] Add `GET /admin/evening/route-templates`.
- [x] Add `POST /admin/evening/route-templates`.
- [x] Add `GET /admin/evening/route-templates/:templateId`.
- [x] Add `PATCH /admin/evening/route-templates/:templateId`.
- [x] Add `POST /admin/evening/route-templates/:templateId/publish`.
- [x] Add `POST /admin/evening/route-templates/:templateId/archive`.
- [x] Add `POST /admin/evening/route-templates/:templateId/revisions`.
- [x] On revision save, create a new `EveningRoute`.
- [x] Clone all submitted steps into new `EveningRouteStep` rows.
- [x] Set `EveningRouteTemplate.currentRouteId` to the new route.
- [x] Do not update existing route steps in place.
- [x] Unit test creating a second revision leaves an existing session on old `routeId`.
- [x] Commit with `git commit -m "feat: добавить версии маршрутов в админке"`.

Revision create request shape:

```json
{
  "title": "Кино без кино",
  "vibe": "спокойный вечер",
  "blurb": "Два места в центре Москвы и короткая прогулка между ними.",
  "totalPriceFrom": 1800,
  "totalSavings": 300,
  "durationLabel": "2.5 часа",
  "area": "центр",
  "goal": "date",
  "mood": "chill",
  "budget": "mid",
  "format": "mixed",
  "recommendedFor": "свидание или спокойная встреча вдвоем",
  "badgeLabel": "Маршрут от команды Frendly",
  "steps": [
    {
      "sortOrder": 1,
      "timeLabel": "19:00",
      "endTimeLabel": "20:15",
      "kind": "bar",
      "title": "Начать с вина",
      "venueId": "venue_id",
      "partnerOfferId": "offer_id",
      "description": "Тихий старт без спешки.",
      "emoji": "🍷",
      "distanceLabel": "7 минут пешком",
      "walkMin": 7
    }
  ]
}
```

Snapshot rule:

- Copy `venue.name` to `venueNameSnapshot`.
- Copy `venue.address` to `venueAddressSnapshot`.
- Copy `venue.lat` and `venue.lng`.
- Copy offer title, description, terms, short label and dates.
- Also fill existing fields `venue`, `address`, `lat`, `lng`, `perk`, `perkShort`, `partnerId`, `sponsored`.

### Task 2.6: Add user session creation from route template

**Files:**

- Modify: `backend/apps/api/src/controllers/evening.controller.ts`
- Modify: `backend/apps/api/src/services/evening-route-template.service.ts`
- Modify: `backend/apps/api/src/services/evening.service.ts` only if shared helpers are needed.
- Modify: `backend/packages/contracts/src/index.ts`
- Test: `backend/apps/api/test/unit/evening-route-template.service.spec.ts`

**Result after completion:** Any user can create a public or request-based meeting from a published Frendly route template, and the meeting appears in the regular Evening session feed.

- [x] Add `POST /evening/route-templates/:templateId/sessions`.
- [x] Body fields: `startsAt`, `privacy`, `capacity`, `hostNote`.
- [x] Use `EveningRouteTemplate.currentRouteId`.
- [x] Reject templates not `published`.
- [x] Reject missing current route.
- [x] Reject startsAt in the past.
- [x] Reject capacity above route template maximum if this field is added.
- [x] Apply anti-spam limits.
- [x] Create chat exactly like existing `launchRoute`.
- [x] Create session with `routeId=currentRouteId` and `routeTemplateId=templateId`.
- [x] Add host as chat member.
- [x] Add host as `EveningSessionParticipant`.
- [x] Create `EveningSessionStepState` for current route steps.
- [x] Track `route_session_created`.
- [x] Unit test session uses current revision.
- [x] Unit test new revision does not affect old session.
- [x] Commit with `git commit -m "feat: создать встречу из маршрута Frendly"`.

Anti-spam limits:

- User can have at most 3 active Evening sessions as host.
- User cannot create the same template more than once for the same local date.
- New accounts younger than 24 hours can create only 1 public curated route session per day.

Capacity rule for MVP:

- Default capacity is 8.
- Minimum capacity is 2.
- Maximum capacity is 12 unless route template later defines a lower max.

### Task 2.7: Add city filtering to Evening session feed

**Files:**

- Modify: `backend/apps/api/src/services/evening.service.ts`
- Modify: `backend/packages/contracts/src/index.ts`
- Test: `backend/apps/api/test/unit/evening.service.spec.ts`

**Result after completion:** General feed can show meetings for a selected city, including meetings created from curated routes.

- [x] Extend `GET /evening/sessions` query with `city`.
- [x] Keep old behavior if `city` is missing.
- [x] For curated sessions, filter through route city or denormalized session city if added.
- [x] Return `isCurated`, `badgeLabel`, `routeTemplateId` in session summary.
- [x] Keep chat list mapping stable.
- [x] Unit test city filter.
- [x] Commit with `git commit -m "feat: фильтровать вечерние встречи по городу"`.

---

## Phase 3, Admin Catalog And Route Editor

### Task 3.1: Add admin API types and route helpers

**Files:**

- Create: `admin/src/admin/evening/types.ts`
- Create: `admin/src/admin/evening/api.ts`
- Modify: `admin/src/admin/api/client.ts` if token header was not added in Task 2.2.
- Test: `admin/src/admin/evening/api.test.ts`

**Result after completion:** Admin UI has typed functions for partners, venues, offers and routes.

- [x] Add TypeScript types matching shared contracts.
- [x] Add API functions for partner list, venue list, offer list.
- [x] Add API functions for route template list, detail, create, save revision, publish and archive.
- [x] Add Vitest tests for URL and method creation.
- [x] Run admin tests.
- [x] Commit with `git commit -m "feat: добавить API для Route Studio"`.

Validation command:

```bash
cd admin
npm run test
```

Expected result: tests pass.

### Task 3.2: Add admin navigation pages

**Files:**

- Modify: `admin/src/App.tsx`
- Modify: `admin/src/admin/components/Sidebar.tsx`
- Create: `admin/src/admin/pages/EveningRoutes.tsx`
- Create: `admin/src/admin/pages/EveningRouteDetail.tsx`
- Create: `admin/src/admin/pages/Venues.tsx`
- Create: `admin/src/admin/pages/Partners.tsx`

**Result after completion:** Admin has visible sections for routes, venues and partners.

- [x] Add sidebar item `Маршруты`.
- [x] Add sidebar item `Места`.
- [x] Add sidebar item `Партнеры`.
- [x] Add route `/evening-routes`.
- [x] Add route `/evening-routes/:templateId`.
- [x] Add route `/venues`.
- [x] Add route `/partners`.
- [x] Keep layout consistent with existing admin pages.
- [x] Run admin build.
- [x] Commit with `git commit -m "feat: добавить разделы маршрутов в админку"`.

Validation command:

```bash
cd admin
npm run build
```

Expected result: build succeeds.

### Task 3.3: Build venue and offer CRUD UI

**Files:**

- Modify: `admin/src/admin/pages/Venues.tsx`
- Modify: `admin/src/admin/pages/Partners.tsx`
- Create: `admin/src/admin/evening/components/VenueForm.tsx`
- Create: `admin/src/admin/evening/components/PartnerForm.tsx`
- Create: `admin/src/admin/evening/components/OfferForm.tsx`

**Result after completion:** Team can create verified venues and partner offers without direct database edits.

- [x] List venues with city, category, trust level, moderation status and partner.
- [x] Add venue form with name, city, timezone, area, address, lat, lng, category, tags, average check and hours.
- [x] Add partner form with name, city, status, contact and notes.
- [x] Add offer form with partner, venue, title, short label, description, terms and validity.
- [x] Save forms through admin API.
- [x] Show validation errors from backend.
- [x] Keep UI dense and admin-focused.
- [x] Run admin build.
- [x] Commit with `git commit -m "feat: добавить редактор мест и офферов"`.

Performance rule:

- List pages should fetch first page only.
- Search and filters should pass query params to backend once backend supports pagination.
- Do not fetch all offers for all venues on every keystroke.

### Task 3.4: Build manual Route Studio editor

**Files:**

- Modify: `admin/src/admin/pages/EveningRoutes.tsx`
- Modify: `admin/src/admin/pages/EveningRouteDetail.tsx`
- Create: `admin/src/admin/evening/components/RouteEditor.tsx`
- Create: `admin/src/admin/evening/components/RouteStepEditor.tsx`
- Create: `admin/src/admin/evening/components/RoutePublishPanel.tsx`

**Result after completion:** Admin can create a route template, edit all route fields, attach venue steps, attach offers and publish the template.

- [x] Route list shows status, city, area, current title and published date.
- [x] Route detail loads template and current revision.
- [x] Editor supports title, blurb, vibe, budget, duration, goal, mood, format, recommendedFor and badge label.
- [x] Step editor supports venue selection.
- [x] Step editor supports partner offer selection filtered by venue.
- [x] Step editor shows warning if venue has no opening hours.
- [x] Step editor shows warning if offer is inactive.
- [x] Save creates a new revision through backend.
- [x] Publish button changes template status to `published`.
- [x] Archive button changes status to `archived`.
- [x] Run admin build.
- [x] Commit with `git commit -m "feat: добавить ручной Route Studio"`.

Important UX rule:

- Admin UI may look simple in MVP.
- It must not hide validation warnings.
- It must make clear that saving creates a new version for future meetings only.

---

## Phase 4, Mobile Route Catalog And Meeting Creation

### Task 4.1: Add Flutter route catalog models and repository calls

**Files:**

- Modify: `mobile/lib/shared/data/backend_repository.dart`
- Create: `mobile/lib/shared/models/evening_route_template.dart`
- Modify: `mobile/lib/shared/models/evening_session.dart`
- Modify: `mobile/lib/shared/data/app_providers.dart`
- Test: `mobile/test/evening_route_template_model_test.dart`

**Result after completion:** Flutter can parse route template summaries, route details and create session responses.

- [x] Add `EveningRouteTemplateSummary`.
- [x] Add `EveningRouteTemplateDetail`.
- [x] Add `EveningRouteTemplateStep`.
- [x] Add `EveningPartnerOfferPreview`.
- [x] Add repository method `fetchEveningRouteTemplates`.
- [x] Add repository method `fetchEveningRouteTemplate`.
- [x] Add repository method `fetchEveningRouteTemplateSessions`.
- [x] Add repository method `createEveningSessionFromTemplate`.
- [x] Add providers for list and detail.
- [x] Add model tests for nullable offer fields.
- [x] Run Flutter tests.
- [x] Commit with `git commit -m "feat: добавить модели маршрутов Frendly"`.

Validation command:

```bash
cd mobile
flutter test
```

Expected result: tests pass.

### Task 4.2: Add mobile routes and Tonight entry button

**Files:**

- Modify: `mobile/lib/app/navigation/app_routes.dart`
- Modify: `mobile/lib/app/navigation/app_router.dart`
- Modify: `mobile/lib/features/tonight/presentation/tonight_screen.dart`
- Create: `mobile/lib/features/evening_routes/presentation/evening_routes_screen.dart`
- Create: `mobile/lib/features/evening_routes/presentation/evening_route_detail_screen.dart`
- Create: `mobile/lib/features/evening_routes/presentation/create_evening_session_screen.dart`

**Result after completion:** User can open `Маршруты` from Tonight, see a placeholder backed by real providers, and navigate to route details.

- [x] Add route `/routes`.
- [x] Add route `/routes/:templateId`.
- [x] Add route `/routes/:templateId/create`.
- [x] Add button `Маршруты` on Tonight.
- [x] Keep bottom navigation unchanged.
- [x] Route list screen reads selected city, default to profile city or Moscow fallback.
- [x] Detail screen opens by template id.
- [x] Create screen opens by template id.
- [x] Run Flutter analyze.
- [x] Commit with `git commit -m "feat: добавить вход в маршруты"`.

Validation command:

```bash
cd mobile
flutter analyze
```

Expected result: no analyzer errors.

### Task 4.3: Build mobile route list screen

**Files:**

- Modify: `mobile/lib/features/evening_routes/presentation/evening_routes_screen.dart`
- Create: `mobile/lib/features/evening_routes/presentation/evening_route_card.dart`

**Result after completion:** User sees route template cards separate from general feed.

- [x] Show city header.
- [x] Show filters as small chips: `Свидание`, `Друзья`, `Недорого`, `Центр`, `Сегодня`.
- [x] Show route cards with cover, title, area, budget, duration and badge.
- [x] Show partner offer preview in card when present.
- [x] Show nearest sessions count when present.
- [x] Empty state says routes are not available for this city yet.
- [x] Loading state uses skeleton or simple progress without layout jump.
- [x] Cards do not fetch route details until opened.
- [x] Run Flutter analyze.
- [x] Commit with `git commit -m "feat: показать каталог маршрутов"`.

Performance rule:

- Route list must render lazily.
- Do not preload all route steps for every card.
- Do not fetch images outside existing shared image stack.

### Task 4.4: Build route detail screen

**Files:**

- Modify: `mobile/lib/features/evening_routes/presentation/evening_route_detail_screen.dart`
- Create: `mobile/lib/features/evening_routes/presentation/evening_route_step_list.dart`
- Create: `mobile/lib/features/evening_routes/presentation/evening_nearest_sessions.dart`

**Result after completion:** User can inspect a team route, see steps, partner offers and nearest meetings.

- [x] Show badge `Маршрут от команды Frendly`.
- [x] Show route title, blurb, area, budget, duration and recommendedFor.
- [x] Show steps with time labels, venues, addresses and offer labels.
- [x] Show nearest sessions block.
- [x] Add button `Создать встречу`.
- [x] Add button to join nearest session if sessions exist.
- [x] Make clear that route itself has no chat until a meeting exists.
- [x] Run Flutter analyze.
- [x] Commit with `git commit -m "feat: добавить экран маршрута"`.

### Task 4.5: Build create meeting flow from route

**Files:**

- Modify: `mobile/lib/features/evening_routes/presentation/create_evening_session_screen.dart`
- Modify: `mobile/lib/shared/data/app_providers.dart` if mutation provider is added.

**Result after completion:** User can choose date, time, privacy and capacity, then create a meeting from a team route.

- [x] Add date picker.
- [x] Add time picker.
- [x] Add privacy selector with `open` and `request`.
- [x] Keep `invite` out of MVP unless backend already supports it cleanly for template meetings.
- [x] Add capacity stepper from 2 to 12.
- [x] Add optional host note.
- [x] Submit to `POST /evening/route-templates/:templateId/sessions`.
- [x] On success, invalidate evening sessions provider.
- [x] On success, navigate to `/evening-preview/:sessionId` or meetup chat according to existing app pattern.
- [x] Show backend errors for spam limits and invalid dates.
- [x] Run Flutter analyze and tests.
- [x] Commit with `git commit -m "feat: создавать встречу из маршрута"`.

### Task 4.6: Show curated route badge in session feed and preview

**Files:**

- Modify: `mobile/lib/shared/models/evening_session.dart`
- Modify: `mobile/lib/features/tonight/presentation/tonight_screen.dart` if sessions are shown there.
- Modify: `mobile/lib/features/evening_plan/presentation/evening_preview_screen.dart`
- Modify: `mobile/lib/features/chats/presentation/chats_screen.dart` if meetup cards show session metadata.

**Result after completion:** Meetings created from team routes are recognizable in feed and preview.

- [x] Parse `isCurated`, `badgeLabel`, `routeTemplateId`.
- [x] Show badge on session cards.
- [x] In preview, show both route source and host.
- [x] Text rule: `Маршрут от команды Frendly`, `Хост: <name>`.
- [x] Do not imply Frendly verifies host behavior.
- [x] Run Flutter analyze.
- [x] Commit with `git commit -m "feat: показать бейдж маршрута Frendly"`.

---

## Phase 5, Partner QR Redemption

### Task 5.1: Add backend offer code service

**Files:**

- Create: `backend/apps/api/src/services/partner-offer-code.service.ts`
- Modify: `backend/apps/api/src/app.module.ts`
- Test: `backend/apps/api/test/unit/partner-offer-code.service.spec.ts`

**Result after completion:** Backend can issue one personal offer code and calculate exact expiration.

- [x] Add method `issueCode(userId, sessionId, stepId, offerId)`.
- [x] Add method `getCodeStatus(userId, codeId)`.
- [x] Add method `activateCode(code, requestMeta)`.
- [x] Generate random code with at least 64 bits of entropy.
- [x] Show short readable code in URL, for example 10 uppercase base32 chars.
- [x] Store only SHA-256 hash with server secret salt.
- [x] Return existing issued code if unique key already exists.
- [x] Compute `expiresAt` as next local calendar day after `session.startsAt` at `06:00`.
- [x] Unit test Moscow expiration for `2026-05-10T19:00:00+03:00` gives `2026-05-11T03:00:00.000Z`.
- [x] Unit test repeated issue returns same code row if not activated.
- [x] Commit with `git commit -m "feat: выпускать QR коды офферов"`.

Expiration helper behavior:

```ts
computeOfferCodeExpiresAt({
  startsAt: new Date('2026-05-10T16:00:00.000Z'),
  timezone: 'Europe/Moscow',
});
```

Expected result:

```ts
new Date('2026-05-11T03:00:00.000Z')
```

Because Moscow `06:00` is UTC `03:00`.

### Task 5.2: Add authenticated mobile offer code API

**Files:**

- Modify: `backend/apps/api/src/controllers/evening.controller.ts`
- Modify: `backend/apps/api/src/services/partner-offer-code.service.ts`
- Modify: `backend/packages/contracts/src/index.ts`
- Test: `backend/apps/api/test/unit/partner-offer-code.service.spec.ts`

**Result after completion:** App can ask for a QR code and poll its status.

- [x] Add `POST /evening/sessions/:sessionId/steps/:stepId/offers/:offerId/code`.
- [x] Add `GET /evening/offer-codes/:codeId`.
- [x] Require session membership.
- [x] Require step belongs to session route.
- [x] Require offer belongs to the step snapshot.
- [x] Return `codeUrl`, `status`, `expiresAt`, `offerTitle`, `venueName`.
- [x] Track `partner_offer_code_issued`.
- [x] Track `partner_offer_code_viewed` when status endpoint is requested from QR screen if this signal is useful.
- [x] Commit with `git commit -m "feat: добавить API QR офферов"`.

Response shape:

```ts
{
  id: string;
  codeUrl: string;
  status: 'issued' | 'activated' | 'expired';
  expiresAt: string;
  activatedAt: string | null;
  offerTitle: string;
  venueName: string;
  partnerName: string;
}
```

### Task 5.3: Add public code activation API

**Files:**

- Create: `backend/apps/api/src/controllers/public-code.controller.ts`
- Modify: `backend/apps/api/src/app.module.ts`
- Modify: `backend/apps/api/src/services/partner-offer-code.service.ts`
- Modify: `backend/packages/contracts/src/index.ts`
- Test: `backend/apps/api/test/unit/partner-offer-code.service.spec.ts`

**Result after completion:** Landing can activate a scanned code without auth and without exposing user personal data.

- [x] Add public endpoint `POST /public/offer-codes/:code/activate`.
- [x] Endpoint is marked `@Public()`.
- [x] If code is valid, activate it and return status `activated`.
- [x] If code was already activated, return status `already_activated`.
- [x] If code expired, return status `expired`.
- [x] If code does not exist, return status `not_found`.
- [x] Do not return user id or profile data.
- [x] Store `activatedIpHash` and `activatedUserAgent`.
- [x] Track `partner_offer_activated`.
- [x] Commit with `git commit -m "feat: активировать оффер по публичному коду"`.

Public response shape:

```ts
{
  status: 'activated' | 'already_activated' | 'expired' | 'not_found';
  offerTitle: string | null;
  venueName: string | null;
  partnerName: string | null;
  activatedAt: string | null;
}
```

### Task 5.4: Add landing code page

**Files:**

- Modify: `landing/src/App.tsx`
- Create: `landing/src/pages/OfferCodePage.tsx`
- Modify: `landing/src/index.css` only if existing styles are not enough.

**Result after completion:** QR opens `frendly.tech/code/<code>`, activates the offer, and shows a simple result page.

- [x] Add route `/code/:code` before `/:slug`.
- [x] On page load, call `POST https://api.frendly.tech/public/offer-codes/:code/activate`.
- [x] Show loading state.
- [x] Show success state `Предложение активировано`.
- [x] Show already activated state.
- [x] Show expired state.
- [x] Show not found state.
- [x] Show offer title, venue or partner and activation time.
- [x] Do not show personal data.
- [x] Run landing build.
- [x] Commit with `git commit -m "feat: добавить страницу активации оффера"`.

Validation command:

```bash
cd landing
npm run build
```

Expected result: build succeeds.

### Task 5.5: Add Flutter QR dependency and model

**Files:**

- Modify: `mobile/pubspec.yaml`
- Modify: `mobile/pubspec.lock`
- Create: `mobile/lib/shared/models/partner_offer_code.dart`
- Modify: `mobile/lib/shared/data/backend_repository.dart`
- Test: `mobile/test/partner_offer_code_model_test.dart`

**Result after completion:** Mobile can request QR data and render QR with `qr_flutter`.

- [x] Add dependency `qr_flutter`.
- [x] Run `flutter pub get`.
- [x] Add `PartnerOfferCode` model.
- [x] Add repository method `issuePartnerOfferCode`.
- [x] Add repository method `fetchPartnerOfferCode`.
- [x] Add model tests.
- [x] Commit with `git commit -m "feat: добавить модель QR оффера"`.

Validation command:

```bash
cd mobile
flutter pub get
flutter test
```

Expected result: dependencies resolve and tests pass.

### Task 5.6: Add fullscreen QR screen in Flutter

**Files:**

- Modify: `mobile/lib/app/navigation/app_routes.dart`
- Modify: `mobile/lib/app/navigation/app_router.dart`
- Create: `mobile/lib/features/evening_routes/presentation/partner_offer_qr_screen.dart`
- Modify: `mobile/lib/features/evening_plan/presentation/evening_preview_screen.dart`
- Modify: `mobile/lib/features/evening_plan/presentation/evening_live_meetup_screen.dart`

**Result after completion:** User can open a fullscreen QR for each partner offer and see status change after scan.

- [x] Add route `/offer-code/:codeId`.
- [x] QR screen receives `codeId`.
- [x] QR screen fetches code data.
- [x] Render QR from `codeUrl`.
- [x] Show offer title and venue.
- [x] Show status `Активен`, `Использован`, `Истек`.
- [x] Poll status every 4 seconds while screen is visible.
- [x] Stop polling when screen is closed.
- [x] Stop polling when status is not `issued`.
- [x] Add button close.
- [x] Add entry button `Показать QR` for offer steps in preview and live flow.
- [x] Run Flutter analyze and tests.
- [x] Commit with `git commit -m "feat: показать QR оффера в приложении"`.

Performance rule:

- Poll only while QR screen is open.
- Do not poll all offers in route preview.

---

## Phase 6, AI Route Studio

### Task 6.1: Add OpenRouter client

**Files:**

- Create: `backend/apps/api/src/services/openrouter.service.ts`
- Modify: `backend/apps/api/src/app.module.ts`
- Test: `backend/apps/api/test/unit/openrouter.service.spec.ts`

**Result after completion:** Backend can call OpenRouter through one isolated service.

- [x] Read `OPENROUTER_API_KEY`.
- [x] Read `OPENROUTER_MODEL`.
- [x] Default base URL to `https://openrouter.ai/api/v1`.
- [x] Add timeout.
- [x] Add method `generateJson`.
- [x] Return raw response and parsed JSON separately.
- [x] Throw controlled `openrouter_unavailable` on network failure.
- [x] Throw controlled `openrouter_invalid_json` on invalid JSON.
- [x] Unit test parser with valid JSON.
- [x] Unit test parser with fenced JSON.
- [x] Unit test invalid JSON.
- [x] Commit with `git commit -m "feat: добавить клиент OpenRouter"`.

Prompt rule:

- Always ask for strict JSON.
- Never ask model to invent real places.
- Give model only approved venues and active offers from our database.

### Task 6.2: Add route candidate selector and validator

**Files:**

- Create: `backend/apps/api/src/services/evening-route-ai-candidates.service.ts`
- Create: `backend/apps/api/src/services/evening-route-ai-validator.service.ts`
- Test: `backend/apps/api/test/unit/evening-route-ai-validator.service.spec.ts`

**Result after completion:** AI gets bounded clean venue candidates, and every generated draft is validated before admin sees it.

- [x] Candidate selector filters by city.
- [x] Candidate selector filters `moderationStatus=approved`.
- [x] Candidate selector filters `trustLevel=verified` or `partner_claimed`.
- [x] Candidate selector filters category and tags from brief.
- [x] Candidate selector includes active offers.
- [x] Candidate selector caps venue list at 40.
- [x] Validator rejects unknown venue id.
- [x] Validator rejects duplicate venue unless brief allows repeat.
- [x] Validator rejects steps below min or above max.
- [x] Validator rejects missing coordinates.
- [x] Validator warns when opening hours are missing.
- [x] Validator warns when step time is outside opening hours.
- [x] Validator warns when walk time is high.
- [x] Validator computes score.
- [x] Commit with `git commit -m "feat: проверять AI маршруты"`.

Score rule for MVP:

- Start at 100.
- Minus 30 for any hard validation error.
- Minus 10 for missing opening hours.
- Minus 10 for walk time above 20 minutes.
- Plus 10 for a partner offer if route still matches budget and mood.
- Clamp from 0 to 100.

### Task 6.3: Add admin AI generation API

**Files:**

- Modify: `backend/apps/api/src/controllers/admin-evening.controller.ts`
- Create: `backend/apps/api/src/services/admin-evening-ai.service.ts`
- Modify: `backend/apps/api/src/app.module.ts`
- Modify: `backend/packages/contracts/src/index.ts`
- Test: `backend/apps/api/test/unit/admin-evening-ai.service.spec.ts`

**Result after completion:** Admin can create a brief, run generation, inspect drafts and convert selected draft to a route template revision.

- [ ] Add `POST /admin/evening/ai/briefs`.
- [ ] Add `GET /admin/evening/ai/briefs/:briefId`.
- [ ] Add `POST /admin/evening/ai/briefs/:briefId/generate`.
- [ ] Add `GET /admin/evening/ai/briefs/:briefId/drafts`.
- [ ] Add `POST /admin/evening/ai/drafts/:draftId/convert`.
- [ ] Save prompt request in `AiEveningGenerationRun.requestJson`.
- [ ] Save raw response in `AiEveningGenerationRun.responseJson`.
- [ ] Save draft and steps.
- [ ] Run validator before draft becomes selectable.
- [ ] Convert creates `EveningRouteTemplate` and first `EveningRoute` revision.
- [ ] Commit with `git commit -m "feat: добавить AI Route Studio API"`.

Expected AI JSON shape:

```json
{
  "routes": [
    {
      "title": "Кино без кино",
      "description": "Тихий вечер в центре без суеты.",
      "vibe": "спокойно",
      "budget": "mid",
      "durationLabel": "2.5 часа",
      "totalPriceFrom": 1800,
      "recommendedFor": "свидание",
      "steps": [
        {
          "venueId": "venue_id",
          "partnerOfferId": "offer_id",
          "kind": "bar",
          "title": "Начать с вина",
          "timeLabel": "19:00",
          "endTimeLabel": "20:15",
          "description": "Мягкий старт вечера.",
          "transition": "Потом 7 минут пешком до следующей точки."
        }
      ]
    }
  ]
}
```

### Task 6.4: Add AI controls to admin Route Studio

**Files:**

- Modify: `admin/src/admin/pages/EveningRoutes.tsx`
- Modify: `admin/src/admin/pages/EveningRouteDetail.tsx`
- Create: `admin/src/admin/evening/components/AiBriefForm.tsx`
- Create: `admin/src/admin/evening/components/AiDraftList.tsx`
- Create: `admin/src/admin/evening/components/AiValidationPanel.tsx`
- Modify: `admin/src/admin/evening/api.ts`
- Modify: `admin/src/admin/evening/types.ts`

**Result after completion:** Admin can generate route ideas, see warnings, select a draft and continue editing manually.

- [ ] Add button `AI маршрут`.
- [ ] Add brief form with title idea, city, area, audience, format, mood, budget, duration, required venues, excluded venues, partner goal and tone.
- [ ] Add generate action.
- [ ] Show loading state with run status.
- [ ] Show 2 to 4 generated drafts.
- [ ] Show draft score.
- [ ] Show validation warnings.
- [ ] Select draft and convert to route.
- [ ] After convert, open manual route editor.
- [ ] Run admin build.
- [ ] Commit with `git commit -m "feat: добавить AI генерацию в админку"`.

---

## Phase 7, Analytics And Dashboards

### Task 7.1: Track core product events

**Files:**

- Modify: `backend/apps/api/src/services/evening-route-template.service.ts`
- Modify: `backend/apps/api/src/services/partner-offer-code.service.ts`
- Modify: `backend/apps/api/src/services/evening.service.ts` if session feed view events are tracked there.
- Test: `backend/apps/api/test/unit/evening-analytics.service.spec.ts`

**Result after completion:** Backend writes the first useful funnel events.

- [ ] Track `route_template_list_viewed`.
- [ ] Track `route_template_viewed`.
- [ ] Track `route_session_created`.
- [ ] Track `route_session_joined`.
- [ ] Track `partner_offer_code_issued`.
- [ ] Track `partner_offer_activated`.
- [ ] Track `ai_route_generated`.
- [ ] Track `ai_route_converted`.
- [ ] Keep event writes no-throw.
- [ ] Commit with `git commit -m "feat: записывать события маршрутов"`.

### Task 7.2: Add admin analytics endpoint for partners

**Files:**

- Modify: `backend/apps/api/src/controllers/admin-evening.controller.ts`
- Create: `backend/apps/api/src/services/admin-evening-analytics.service.ts`
- Modify: `backend/apps/api/src/app.module.ts`
- Modify: `backend/packages/contracts/src/index.ts`

**Result after completion:** Admin can see how many users activated partner offers.

- [ ] Add `GET /admin/evening/analytics/partners`.
- [ ] Add filters `from`, `to`, `partnerId`, `venueId`.
- [ ] Return activations count.
- [ ] Return unique users count.
- [ ] Return route templates that brought activations.
- [ ] Return daily breakdown.
- [ ] Do not expose personal data.
- [ ] Commit with `git commit -m "feat: добавить аналитику партнерских офферов"`.

### Task 7.3: Add admin analytics UI

**Files:**

- Modify: `admin/src/admin/pages/Analytics.tsx`
- Create: `admin/src/admin/evening/components/PartnerOfferAnalytics.tsx`
- Modify: `admin/src/admin/evening/api.ts`
- Modify: `admin/src/admin/evening/types.ts`

**Result after completion:** Team can inspect partner activation numbers inside admin.

- [ ] Add section `Партнерские офферы`.
- [ ] Show activations.
- [ ] Show unique clients.
- [ ] Show top partners.
- [ ] Show top routes.
- [ ] Add date filter.
- [ ] Run admin build.
- [ ] Commit with `git commit -m "feat: показать аналитику офферов в админке"`.

---

## Phase 8, Verification, Docs And Context Update

### Task 8.1: Add seed data for local testing

**Files:**

- Modify: `backend/packages/database/prisma/seed.ts`

**Result after completion:** Local environment has one partner, two venues, one offer, one curated route template and one current route revision.

- [ ] Seed partner `Frendly Test Partner`.
- [ ] Seed two Moscow venues.
- [ ] Seed one active partner offer.
- [ ] Seed one route template with `status=published`.
- [ ] Seed one current route revision.
- [ ] Seed two route steps.
- [ ] Ensure seed is idempotent.
- [ ] Run seed.
- [ ] Commit with `git commit -m "chore: добавить seed маршрутов Frendly"`.

Validation command:

```bash
cd backend
pnpm db:seed
```

Expected result: seed completes without duplicate errors.

### Task 8.2: Run backend verification

**Files:**

- No new files.

**Result after completion:** Backend compiles, tests pass and Prisma client is valid.

- [ ] Run Prisma generate.
- [ ] Run backend unit tests.
- [ ] Run backend build.
- [ ] Fix failures only in files touched by this plan.
- [ ] Commit fixes with a focused Russian message.

Commands:

```bash
cd backend
pnpm db:generate
pnpm test:unit
pnpm build
```

Expected result: all commands pass.

### Task 8.3: Run frontend verification

**Files:**

- No new files.

**Result after completion:** Admin, landing and mobile build or analyze cleanly.

- [ ] Run admin tests.
- [ ] Run admin build.
- [ ] Run landing build.
- [ ] Run Flutter analyze.
- [ ] Run Flutter tests.
- [ ] Commit fixes with a focused Russian message.

Commands:

```bash
cd admin
npm run test
npm run build

cd ../landing
npm run build

cd ../mobile
flutter analyze
flutter test
```

Expected result: all commands pass.

### Task 8.4: Update AI context maps

**Files:**

- Modify: `ai-context/database.md`
- Modify: `ai-context/backend-api.md`
- Modify: `ai-context/frontend-flutter.md`
- Modify: `ai-context/landing.md` if QR page was added.
- Modify: `ai-context/maintenance.md` only if maintenance rules changed.

**Result after completion:** Future sessions can find the new route template, venue, offer and QR flows without scanning the project.

- [ ] Update database map with `EveningRouteTemplate`, venue, partner, offer, code and AI draft models.
- [ ] Update backend map with new admin endpoints, route template endpoints and code activation endpoint.
- [ ] Update Flutter map with `Маршруты` screen, detail screen, create session screen and QR screen.
- [ ] Update landing map with `/code/:code`.
- [ ] Do not paste raw code into AI context.
- [ ] Commit with `git commit -m "docs: обновить карту AI маршрутов"`.

---

## End To End Manual Test Script

Run this after all MVP phases.

- [ ] Start backend and local database.
- [ ] Seed test data.
- [ ] Open admin.
- [ ] Create partner.
- [ ] Create venue.
- [ ] Create offer.
- [ ] Create route template.
- [ ] Add two route steps.
- [ ] Attach offer to one step.
- [ ] Publish route template.
- [ ] Open mobile app.
- [ ] Open Tonight.
- [ ] Tap `Маршруты`.
- [ ] Open created route.
- [ ] Create meeting for tomorrow.
- [ ] Confirm meeting appears in general Evening sessions.
- [ ] Join meeting from another user if test users are available.
- [ ] Open route step with offer.
- [ ] Open fullscreen QR.
- [ ] Scan QR or open code URL in browser.
- [ ] Confirm landing page says offer activated.
- [ ] Confirm mobile QR screen changes to used status.
- [ ] Confirm `PartnerOfferCode.status=activated` in database.
- [ ] Confirm analytics event `partner_offer_activated` exists.

## Rollout Notes

- In production, set `ADMIN_API_TOKEN`.
- In production, set `OPENROUTER_API_KEY`.
- In production, set `OPENROUTER_MODEL`.
- Keep AI generation disabled if venue catalog is empty.
- Keep partner activation page public, but never return personal data.
- Review data provider licenses before storing data imported from 2GIS, Yandex or another provider.
- Do not scrape map websites.

## Open Product Decisions After MVP

- Whether routes deserve a bottom navigation tab.
- Whether partners get a scanner login.
- Whether partner cabinet can create venues with moderation.
- Whether route templates support recurring seeded sessions.
- Whether user-personal AI route generation uses the same draft system.
- Whether route steps can be secret until check-in.
- Whether OpenRouter generation runs synchronously or through a worker queue.
