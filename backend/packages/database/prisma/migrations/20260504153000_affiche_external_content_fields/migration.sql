ALTER TABLE "ExternalImportRun"
  ADD COLUMN "publishedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "paidCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "freeCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "unknownPriceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "missingCoordsCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ExternalContentItem"
  ADD COLUMN "venueName" TEXT,
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "actionUrl" TEXT,
  ADD COLUMN "actionKind" TEXT,
  ADD COLUMN "priceMode" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "isAffiliate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sourceProvider" TEXT,
  ADD COLUMN "placeKind" TEXT,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3),
  ADD COLUMN "publicStatus" TEXT NOT NULL DEFAULT 'published';

UPDATE "ExternalContentItem"
SET "priceMode" = CASE
  WHEN "priceFrom" = 0 THEN 'free'
  WHEN "priceFrom" > 0 THEN 'paid'
  ELSE 'unknown'
END
WHERE "priceMode" = 'unknown';

UPDATE "ExternalContentItem"
SET "lastSeenAt" = "importedAt"
WHERE "lastSeenAt" IS NULL;

CREATE INDEX "ExternalContentItem_city_startsAt_priceMode_contentKind_moderationStatus_sourceId_idx"
  ON "ExternalContentItem"("city", "startsAt", "priceMode", "contentKind", "moderationStatus", "sourceId");

CREATE INDEX "ExternalContentItem_publicStatus_city_startsAt_id_idx"
  ON "ExternalContentItem"("publicStatus", "city", "startsAt", "id");

CREATE INDEX "ExternalContentItem_sourceId_priceMode_importedAt_id_idx"
  ON "ExternalContentItem"("sourceId", "priceMode", "importedAt", "id");
