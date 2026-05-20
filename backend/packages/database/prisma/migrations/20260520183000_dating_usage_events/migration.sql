ALTER TYPE "TokenLedgerReason" ADD VALUE IF NOT EXISTS 'dating_spend';

CREATE TYPE "DatingUsageEventKind" AS ENUM (
  'swipe',
  'super_like_free',
  'super_like_paid',
  'rewind_free',
  'rewind_paid'
);

CREATE TABLE "DatingUsageEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "targetUserId" TEXT,
  "kind" "DatingUsageEventKind" NOT NULL,
  "chargedTokens" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DatingUsageEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DatingUsageEvent"
  ADD CONSTRAINT "DatingUsageEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "DatingUsageEvent_userId_kind_createdAt_idx"
  ON "DatingUsageEvent"("userId", "kind", "createdAt");

CREATE INDEX "DatingUsageEvent_userId_createdAt_idx"
  ON "DatingUsageEvent"("userId", "createdAt");

CREATE INDEX "DatingUsageEvent_targetUserId_kind_createdAt_idx"
  ON "DatingUsageEvent"("targetUserId", "kind", "createdAt");

CREATE INDEX IF NOT EXISTS "OnboardingPreferences_interests_gin_idx"
  ON "OnboardingPreferences" USING GIN ("interests");
