ALTER TABLE "Chat"
ADD COLUMN "meetupPhase" TEXT NOT NULL DEFAULT 'upcoming',
ADD COLUMN "meetupMode" TEXT NOT NULL DEFAULT 'hybrid',
ADD COLUMN "currentStep" INTEGER,
ADD COLUMN "meetupStartsAt" TIMESTAMP(3),
ADD COLUMN "meetupEndsAt" TIMESTAMP(3);

CREATE INDEX "Chat_kind_meetupPhase_updatedAt_id_idx"
ON "Chat"("kind", "meetupPhase", "updatedAt", "id");
