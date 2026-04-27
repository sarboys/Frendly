-- Harden phone OTP storage and bounded request/verify behavior.
ALTER TYPE "AuthProvider" ADD VALUE IF NOT EXISTS 'session';

ALTER TABLE "PhoneOtpChallenge"
  ADD COLUMN "codeHash" TEXT,
  ADD COLUMN "codeSalt" TEXT,
  ADD COLUMN "requestKeyHash" TEXT,
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN "lastIssuedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "PhoneOtpChallenge"
SET
  "codeHash" = 'migrated:' || "id",
  "codeSalt" = 'migrated',
  "lastIssuedAt" = "createdAt";

ALTER TABLE "PhoneOtpChallenge"
  ALTER COLUMN "codeHash" SET NOT NULL,
  ALTER COLUMN "codeSalt" SET NOT NULL,
  DROP COLUMN "code";

CREATE INDEX "PhoneOtpChallenge_phoneNumber_consumedAt_expiresAt_idx"
  ON "PhoneOtpChallenge"("phoneNumber", "consumedAt", "expiresAt");

CREATE INDEX "PhoneOtpChallenge_requestKeyHash_createdAt_idx"
  ON "PhoneOtpChallenge"("requestKeyHash", "createdAt");
