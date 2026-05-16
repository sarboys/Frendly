ALTER TABLE "Event"
  ADD COLUMN "requiresVerification" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requiresFrendlyPlus" BOOLEAN NOT NULL DEFAULT false;
