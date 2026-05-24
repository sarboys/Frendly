-- Event covers are public media assets owned by the host.
ALTER TYPE "MediaAssetKind" ADD VALUE IF NOT EXISTS 'event_cover';

ALTER TABLE "Event"
  ADD COLUMN "coverAssetId" TEXT,
  ADD COLUMN "city" TEXT;

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_coverAssetId_fkey"
  FOREIGN KEY ("coverAssetId") REFERENCES "MediaAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Event_coverAssetId_idx" ON "Event"("coverAssetId");
CREATE INDEX "Event_city_startsAt_id_idx" ON "Event"("city", "startsAt", "id");

ALTER TABLE "Message"
  ADD COLUMN "locationLatitude" DOUBLE PRECISION,
  ADD COLUMN "locationLongitude" DOUBLE PRECISION,
  ADD COLUMN "locationLabel" TEXT,
  ADD COLUMN "locationExpiresAt" TIMESTAMP(3);
