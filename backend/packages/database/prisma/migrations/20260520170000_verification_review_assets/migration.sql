ALTER TYPE "MediaAssetKind" ADD VALUE IF NOT EXISTS 'verification_selfie';
ALTER TYPE "MediaAssetKind" ADD VALUE IF NOT EXISTS 'verification_document';

ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'verification';

ALTER TABLE "UserVerification"
  ADD COLUMN "selfieAssetId" TEXT,
  ADD COLUMN "documentAssetId" TEXT,
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "reviewNote" TEXT;

CREATE UNIQUE INDEX "UserVerification_selfieAssetId_key"
  ON "UserVerification"("selfieAssetId");

CREATE UNIQUE INDEX "UserVerification_documentAssetId_key"
  ON "UserVerification"("documentAssetId");

CREATE INDEX "UserVerification_status_submittedAt_idx"
  ON "UserVerification"("status", "submittedAt");

ALTER TABLE "UserVerification"
  ADD CONSTRAINT "UserVerification_selfieAssetId_fkey"
  FOREIGN KEY ("selfieAssetId")
  REFERENCES "MediaAsset"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "UserVerification"
  ADD CONSTRAINT "UserVerification_documentAssetId_fkey"
  FOREIGN KEY ("documentAssetId")
  REFERENCES "MediaAsset"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
