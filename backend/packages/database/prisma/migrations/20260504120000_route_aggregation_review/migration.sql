CREATE TABLE "ExternalContentSource" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "baseUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "cityCodes" JSONB,
  "config" JSONB,
  "lastImportedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalContentSource_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalContentSource_status_check" CHECK ("status" IN ('active', 'paused', 'disabled'))
);

CREATE TABLE "ExternalImportRun" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "fetchedCount" INTEGER NOT NULL DEFAULT 0,
  "normalizedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "cursor" TEXT,
  "metadata" JSONB,
  CONSTRAINT "ExternalImportRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalImportRun_status_check" CHECK ("status" IN ('pending_manual', 'running', 'completed', 'failed'))
);

CREATE TABLE "ExternalContentItem" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "importRunId" TEXT,
  "sourceItemId" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "contentKind" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
  "area" TEXT,
  "title" TEXT NOT NULL,
  "shortSummary" TEXT,
  "category" TEXT NOT NULL,
  "tags" JSONB,
  "address" TEXT,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "priceFrom" INTEGER,
  "currency" TEXT,
  "raw" JSONB,
  "normalizedHash" TEXT NOT NULL,
  "moderationStatus" TEXT NOT NULL DEFAULT 'pending',
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalContentItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalContentItem_contentKind_check" CHECK ("contentKind" IN ('place', 'event')),
  CONSTRAINT "ExternalContentItem_moderationStatus_check" CHECK ("moderationStatus" IN ('pending', 'approved', 'rejected', 'stale'))
);

CREATE TABLE "GeneratedRouteDraftBatch" (
  "id" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
  "area" TEXT,
  "mood" TEXT NOT NULL,
  "budget" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'aggregation',
  "status" TEXT NOT NULL DEFAULT 'running',
  "promptVersion" TEXT NOT NULL,
  "requestJson" JSONB NOT NULL,
  "responseJson" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "GeneratedRouteDraftBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GeneratedRouteDraftBatch_status_check" CHECK ("status" IN ('running', 'completed', 'failed'))
);

CREATE TABLE "GeneratedRouteReviewDraft" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'needs_review',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
  "area" TEXT,
  "vibe" TEXT NOT NULL,
  "budget" TEXT NOT NULL,
  "durationLabel" TEXT NOT NULL,
  "totalPriceFrom" INTEGER NOT NULL,
  "goal" TEXT NOT NULL,
  "mood" TEXT NOT NULL,
  "format" TEXT,
  "recommendedFor" TEXT,
  "badgeLabel" TEXT,
  "score" INTEGER NOT NULL DEFAULT 0,
  "validationStatus" TEXT NOT NULL DEFAULT 'pending',
  "validationIssues" JSONB,
  "reviewedByAdminId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdTemplateId" TEXT,
  "publishedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GeneratedRouteReviewDraft_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GeneratedRouteReviewDraft_status_check" CHECK ("status" IN ('needs_review', 'approved', 'converted', 'published', 'rejected', 'archived')),
  CONSTRAINT "GeneratedRouteReviewDraft_validationStatus_check" CHECK ("validationStatus" IN ('pending', 'valid', 'warning', 'invalid'))
);

CREATE TABLE "GeneratedRouteDraftStep" (
  "id" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "externalContentItemId" TEXT,
  "sortOrder" INTEGER NOT NULL,
  "timeLabel" TEXT NOT NULL,
  "endTimeLabel" TEXT,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "venue" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "distanceLabel" TEXT NOT NULL,
  "walkMin" INTEGER,
  "description" TEXT,
  "vibeTag" TEXT,
  "ticketPrice" INTEGER,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "sourceUrl" TEXT,
  "sourceName" TEXT,
  "sourceTitle" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeneratedRouteDraftStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalContentSource_code_key" ON "ExternalContentSource"("code");
CREATE INDEX "ExternalContentSource_status_kind_id_idx" ON "ExternalContentSource"("status", "kind", "id");

CREATE INDEX "ExternalImportRun_sourceId_city_startedAt_id_idx" ON "ExternalImportRun"("sourceId", "city", "startedAt", "id");
CREATE INDEX "ExternalImportRun_status_startedAt_id_idx" ON "ExternalImportRun"("status", "startedAt", "id");

CREATE UNIQUE INDEX "ExternalContentItem_sourceId_sourceItemId_key" ON "ExternalContentItem"("sourceId", "sourceItemId");
CREATE INDEX "ExternalContentItem_city_contentKind_startsAt_id_idx" ON "ExternalContentItem"("city", "contentKind", "startsAt", "id");
CREATE INDEX "ExternalContentItem_city_category_moderationStatus_id_idx" ON "ExternalContentItem"("city", "category", "moderationStatus", "id");
CREATE INDEX "ExternalContentItem_normalizedHash_idx" ON "ExternalContentItem"("normalizedHash");

CREATE INDEX "GeneratedRouteDraftBatch_city_status_createdAt_id_idx" ON "GeneratedRouteDraftBatch"("city", "status", "createdAt", "id");

CREATE INDEX "GeneratedRouteReviewDraft_city_status_createdAt_id_idx" ON "GeneratedRouteReviewDraft"("city", "status", "createdAt", "id");
CREATE INDEX "GeneratedRouteReviewDraft_batchId_score_id_idx" ON "GeneratedRouteReviewDraft"("batchId", "score", "id");

CREATE INDEX "GeneratedRouteDraftStep_draftId_sortOrder_id_idx" ON "GeneratedRouteDraftStep"("draftId", "sortOrder", "id");
CREATE INDEX "GeneratedRouteDraftStep_externalContentItemId_idx" ON "GeneratedRouteDraftStep"("externalContentItemId");

ALTER TABLE "ExternalImportRun"
  ADD CONSTRAINT "ExternalImportRun_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "ExternalContentSource"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalContentItem"
  ADD CONSTRAINT "ExternalContentItem_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "ExternalContentSource"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalContentItem"
  ADD CONSTRAINT "ExternalContentItem_importRunId_fkey"
  FOREIGN KEY ("importRunId") REFERENCES "ExternalImportRun"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GeneratedRouteReviewDraft"
  ADD CONSTRAINT "GeneratedRouteReviewDraft_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "GeneratedRouteDraftBatch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GeneratedRouteDraftStep"
  ADD CONSTRAINT "GeneratedRouteDraftStep_draftId_fkey"
  FOREIGN KEY ("draftId") REFERENCES "GeneratedRouteReviewDraft"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GeneratedRouteDraftStep"
  ADD CONSTRAINT "GeneratedRouteDraftStep_externalContentItemId_fkey"
  FOREIGN KEY ("externalContentItemId") REFERENCES "ExternalContentItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
