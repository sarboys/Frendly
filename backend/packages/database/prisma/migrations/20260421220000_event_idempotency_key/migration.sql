ALTER TABLE "Event"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Event_hostId_idempotencyKey_key"
ON "Event"("hostId", "idempotencyKey");
