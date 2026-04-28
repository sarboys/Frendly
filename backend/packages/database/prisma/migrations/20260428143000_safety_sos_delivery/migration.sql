CREATE TYPE "TrustedContactChannel" AS ENUM ('phone', 'telegram', 'email');

ALTER TABLE "TrustedContact"
ADD COLUMN "channel" "TrustedContactChannel" NOT NULL DEFAULT 'phone',
ADD COLUMN "value" TEXT;

UPDATE "TrustedContact"
SET "value" = "phoneNumber"
WHERE "value" IS NULL;

ALTER TABLE "TrustedContact"
ALTER COLUMN "value" SET NOT NULL;

DROP INDEX IF EXISTS "TrustedContact_userId_phoneNumber_key";

CREATE UNIQUE INDEX "TrustedContact_userId_channel_value_key"
ON "TrustedContact"("userId", "channel", "value");

CREATE TABLE "SafetySosAlert" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventId" TEXT,
  "recipients" JSONB NOT NULL,
  "recipientsCount" INTEGER NOT NULL,
  "messagePreview" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SafetySosAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SafetySosAlert_userId_createdAt_id_idx"
ON "SafetySosAlert"("userId", "createdAt", "id");

CREATE INDEX "SafetySosAlert_eventId_createdAt_id_idx"
ON "SafetySosAlert"("eventId", "createdAt", "id");

ALTER TABLE "SafetySosAlert"
ADD CONSTRAINT "SafetySosAlert_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SafetySosAlert"
ADD CONSTRAINT "SafetySosAlert_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
