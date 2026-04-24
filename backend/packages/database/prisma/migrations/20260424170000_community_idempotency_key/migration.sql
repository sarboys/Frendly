ALTER TABLE "Community"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Community_createdById_idempotencyKey_key"
ON "Community"("createdById", "idempotencyKey");
