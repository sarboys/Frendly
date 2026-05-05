ALTER TABLE "User"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "suspensionReason" TEXT;

ALTER TABLE "User"
  ADD CONSTRAINT "User_status_check"
  CHECK ("status" IN ('active', 'suspended'));

CREATE INDEX "User_status_createdAt_id_idx"
  ON "User"("status", "createdAt", "id");
