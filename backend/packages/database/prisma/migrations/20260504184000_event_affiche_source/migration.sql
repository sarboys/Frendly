ALTER TABLE "Event"
  ADD COLUMN "sourceExternalContentItemId" TEXT;

CREATE INDEX "Event_sourceExternalContentItemId_idx"
  ON "Event"("sourceExternalContentItemId");

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_sourceExternalContentItemId_fkey"
  FOREIGN KEY ("sourceExternalContentItemId")
  REFERENCES "ExternalContentItem"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
