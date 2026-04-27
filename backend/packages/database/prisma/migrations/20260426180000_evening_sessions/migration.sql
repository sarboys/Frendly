CREATE TABLE "EveningSession" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "hostUserId" TEXT NOT NULL,
  "chatId" TEXT NOT NULL,
  "phase" TEXT NOT NULL DEFAULT 'scheduled',
  "privacy" TEXT NOT NULL DEFAULT 'open',
  "mode" TEXT NOT NULL DEFAULT 'hybrid',
  "capacity" INTEGER NOT NULL DEFAULT 10,
  "startsAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "currentStep" INTEGER,
  "inviteToken" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EveningSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EveningSessionParticipant" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'guest',
  "status" TEXT NOT NULL DEFAULT 'joined',
  "joinedAt" TIMESTAMP(3),
  "leftAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EveningSessionParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EveningSessionJoinRequest" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'requested',
  "note" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EveningSessionJoinRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EveningSessionStepState" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "stepId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'upcoming',
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "skippedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EveningSessionStepState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EveningStepCheckIn" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "stepId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EveningStepCheckIn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EveningAfterPartyFeedback" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "reaction" TEXT,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EveningAfterPartyFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EveningAfterPartyPhoto" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EveningAfterPartyPhoto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EveningSession_chatId_key" ON "EveningSession"("chatId");
CREATE UNIQUE INDEX "EveningSession_inviteToken_key" ON "EveningSession"("inviteToken");
CREATE INDEX "EveningSession_phase_startsAt_id_idx" ON "EveningSession"("phase", "startsAt", "id");
CREATE INDEX "EveningSession_hostUserId_phase_id_idx" ON "EveningSession"("hostUserId", "phase", "id");
CREATE INDEX "EveningSession_routeId_createdAt_id_idx" ON "EveningSession"("routeId", "createdAt", "id");
CREATE INDEX "EveningSession_chatId_idx" ON "EveningSession"("chatId");

CREATE UNIQUE INDEX "EveningSessionParticipant_sessionId_userId_key" ON "EveningSessionParticipant"("sessionId", "userId");
CREATE INDEX "EveningSessionParticipant_sessionId_status_id_idx" ON "EveningSessionParticipant"("sessionId", "status", "id");
CREATE INDEX "EveningSessionParticipant_userId_status_id_idx" ON "EveningSessionParticipant"("userId", "status", "id");

CREATE UNIQUE INDEX "EveningSessionJoinRequest_sessionId_userId_key" ON "EveningSessionJoinRequest"("sessionId", "userId");
CREATE INDEX "EveningSessionJoinRequest_sessionId_status_id_idx" ON "EveningSessionJoinRequest"("sessionId", "status", "id");
CREATE INDEX "EveningSessionJoinRequest_userId_status_id_idx" ON "EveningSessionJoinRequest"("userId", "status", "id");

CREATE UNIQUE INDEX "EveningSessionStepState_sessionId_stepId_key" ON "EveningSessionStepState"("sessionId", "stepId");
CREATE INDEX "EveningSessionStepState_sessionId_status_id_idx" ON "EveningSessionStepState"("sessionId", "status", "id");
CREATE INDEX "EveningSessionStepState_stepId_idx" ON "EveningSessionStepState"("stepId");

CREATE UNIQUE INDEX "EveningStepCheckIn_sessionId_stepId_userId_key" ON "EveningStepCheckIn"("sessionId", "stepId", "userId");
CREATE INDEX "EveningStepCheckIn_sessionId_stepId_checkedInAt_idx" ON "EveningStepCheckIn"("sessionId", "stepId", "checkedInAt");
CREATE INDEX "EveningStepCheckIn_userId_checkedInAt_idx" ON "EveningStepCheckIn"("userId", "checkedInAt");

CREATE UNIQUE INDEX "EveningAfterPartyFeedback_sessionId_userId_key" ON "EveningAfterPartyFeedback"("sessionId", "userId");
CREATE INDEX "EveningAfterPartyFeedback_sessionId_rating_id_idx" ON "EveningAfterPartyFeedback"("sessionId", "rating", "id");
CREATE INDEX "EveningAfterPartyFeedback_userId_createdAt_idx" ON "EveningAfterPartyFeedback"("userId", "createdAt");

CREATE UNIQUE INDEX "EveningAfterPartyPhoto_sessionId_mediaAssetId_key" ON "EveningAfterPartyPhoto"("sessionId", "mediaAssetId");
CREATE INDEX "EveningAfterPartyPhoto_sessionId_createdAt_idx" ON "EveningAfterPartyPhoto"("sessionId", "createdAt");
CREATE INDEX "EveningAfterPartyPhoto_userId_createdAt_idx" ON "EveningAfterPartyPhoto"("userId", "createdAt");
CREATE INDEX "EveningAfterPartyPhoto_mediaAssetId_idx" ON "EveningAfterPartyPhoto"("mediaAssetId");

ALTER TABLE "EveningSession"
ADD CONSTRAINT "EveningSession_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "EveningRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "EveningSession_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "EveningSession_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EveningSessionParticipant"
ADD CONSTRAINT "EveningSessionParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EveningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "EveningSessionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EveningSessionJoinRequest"
ADD CONSTRAINT "EveningSessionJoinRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EveningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "EveningSessionJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "EveningSessionJoinRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EveningSessionStepState"
ADD CONSTRAINT "EveningSessionStepState_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EveningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "EveningSessionStepState_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "EveningRouteStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EveningStepCheckIn"
ADD CONSTRAINT "EveningStepCheckIn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EveningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "EveningStepCheckIn_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "EveningRouteStep"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "EveningStepCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EveningAfterPartyFeedback"
ADD CONSTRAINT "EveningAfterPartyFeedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EveningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "EveningAfterPartyFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EveningAfterPartyPhoto"
ADD CONSTRAINT "EveningAfterPartyPhoto_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EveningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "EveningAfterPartyPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "EveningAfterPartyPhoto_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
