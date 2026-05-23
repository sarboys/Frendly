CREATE TABLE "AdminDashboardSnapshot" (
  "id" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminDashboardSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminDashboardSnapshot_expiresAt_idx" ON "AdminDashboardSnapshot"("expiresAt");
