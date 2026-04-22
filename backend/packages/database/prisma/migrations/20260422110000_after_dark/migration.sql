ALTER TABLE "UserSettings"
ADD COLUMN "afterDarkAgeConfirmedAt" TIMESTAMP(3),
ADD COLUMN "afterDarkCodeAcceptedAt" TIMESTAMP(3);

ALTER TABLE "Event"
ADD COLUMN "isAfterDark" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "afterDarkCategory" TEXT,
ADD COLUMN "afterDarkGlow" TEXT,
ADD COLUMN "dressCode" TEXT,
ADD COLUMN "ageRange" TEXT,
ADD COLUMN "ratioLabel" TEXT,
ADD COLUMN "consentRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "rules" JSONB;

CREATE INDEX "Event_isAfterDark_startsAt_idx" ON "Event"("isAfterDark", "startsAt");
