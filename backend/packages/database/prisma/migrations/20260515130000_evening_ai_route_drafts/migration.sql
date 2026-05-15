CREATE TABLE "EveningAiRouteDraft" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'reviewing',
  "city" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
  "prompt" TEXT,
  "goal" TEXT,
  "mood" TEXT,
  "budget" TEXT,
  "format" TEXT,
  "area" TEXT,
  "stepCount" INTEGER NOT NULL DEFAULT 2,
  "candidatePackJson" JSONB NOT NULL,
  "routeSnapshotJson" JSONB NOT NULL,
  "acceptedStepIndexes" JSONB NOT NULL,
  "rejectedExternalItemIds" JSONB NOT NULL,
  "model" TEXT,
  "latencyMs" INTEGER,
  "validationIssues" JSONB,
  "routeId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EveningAiRouteDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EveningAiRouteDraft_userId_status_createdAt_id_idx"
  ON "EveningAiRouteDraft"("userId", "status", "createdAt", "id");

CREATE INDEX "EveningAiRouteDraft_expiresAt_idx"
  ON "EveningAiRouteDraft"("expiresAt");

CREATE INDEX "EveningAiRouteDraft_routeId_idx"
  ON "EveningAiRouteDraft"("routeId");
