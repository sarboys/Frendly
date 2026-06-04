ALTER TABLE "UserReport"
  ADD COLUMN IF NOT EXISTS "targetEventId" TEXT;

ALTER TABLE "UserReport"
  ADD CONSTRAINT "UserReport_targetEventId_fkey"
  FOREIGN KEY ("targetEventId") REFERENCES "Event"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "UserReport_targetEventId_status_createdAt_id_idx"
  ON "UserReport"("targetEventId", "status", "createdAt", "id");
