CREATE TYPE "DropType" AS ENUM (
  'main_monthly',
  'free',
  'frendly_plus',
  'partner',
  'special'
);

CREATE TYPE "DropStatus" AS ENUM (
  'draft',
  'scheduled',
  'active',
  'drawing_pending',
  'finished',
  'cancelled'
);

CREATE TYPE "DropTicketStatus" AS ENUM (
  'pending',
  'active',
  'cancelled',
  'used_in_draw',
  'winner',
  'expired'
);

CREATE TYPE "DropRewardStatus" AS ENUM (
  'pending',
  'active',
  'cancelled',
  'rejected'
);

CREATE TYPE "DropRewardSource" AS ENUM (
  'verification',
  'daily_login',
  'host_meeting',
  'visit_meeting',
  'referral',
  'subscription',
  'boost',
  'manual_admin'
);

CREATE TYPE "DropWinnerStatus" AS ENUM (
  'pending_verification',
  'approved',
  'rejected',
  'prize_delivered',
  'prize_replaced',
  'expired'
);

CREATE TABLE "Drop" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "type" "DropType" NOT NULL,
  "status" "DropStatus" NOT NULL DEFAULT 'draft',
  "prizes" JSONB NOT NULL DEFAULT '[]',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "drawAt" TIMESTAMP(3) NOT NULL,
  "conditions" JSONB NOT NULL DEFAULT '{}',
  "userLimit" INTEGER,
  "maxTicketsPerUser" INTEGER,
  "requiresVerified" BOOLEAN NOT NULL DEFAULT true,
  "requiresFrendlyPlus" BOOLEAN NOT NULL DEFAULT false,
  "minAge" INTEGER,
  "region" TEXT,
  "seedHash" TEXT,
  "secretSeed" TEXT,
  "seedRevealedAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Drop_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DropRewardEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "source" "DropRewardSource" NOT NULL,
  "status" "DropRewardStatus" NOT NULL DEFAULT 'active',
  "idempotencyKey" TEXT NOT NULL,
  "monthKey" TEXT NOT NULL,
  "ticketCount" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "relatedType" TEXT,
  "relatedId" TEXT,
  "eventId" TEXT,
  "cancellationReason" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DropRewardEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DropTicket" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "dropId" TEXT,
  "rewardEventId" TEXT NOT NULL,
  "source" "DropRewardSource" NOT NULL,
  "monthKey" TEXT NOT NULL,
  "status" "DropTicketStatus" NOT NULL DEFAULT 'active',
  "assignedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DropTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DropDrawSnapshot" (
  "id" TEXT NOT NULL,
  "dropId" TEXT NOT NULL,
  "seedHash" TEXT NOT NULL,
  "secretSeed" TEXT NOT NULL,
  "ticketCount" INTEGER NOT NULL,
  "participantCount" INTEGER NOT NULL,
  "tickets" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DropDrawSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DropWinner" (
  "id" TEXT NOT NULL,
  "dropId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "status" "DropWinnerStatus" NOT NULL DEFAULT 'pending_verification',
  "position" INTEGER NOT NULL,
  "reserve" BOOLEAN NOT NULL DEFAULT false,
  "prize" JSONB NOT NULL DEFAULT '{}',
  "rejectedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DropWinner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DropReferral" (
  "id" TEXT NOT NULL,
  "inviterUserId" TEXT NOT NULL,
  "invitedUserId" TEXT,
  "code" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'created',
  "rewardEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMP(3),

  CONSTRAINT "DropReferral_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DropUserRestriction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),

  CONSTRAINT "DropUserRestriction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Drop_status_startsAt_endsAt_idx" ON "Drop"("status", "startsAt", "endsAt");
CREATE INDEX "Drop_type_status_drawAt_idx" ON "Drop"("type", "status", "drawAt");

CREATE UNIQUE INDEX "DropRewardEvent_idempotencyKey_key" ON "DropRewardEvent"("idempotencyKey");
CREATE INDEX "DropRewardEvent_userId_monthKey_status_idx" ON "DropRewardEvent"("userId", "monthKey", "status");
CREATE INDEX "DropRewardEvent_userId_source_monthKey_status_idx" ON "DropRewardEvent"("userId", "source", "monthKey", "status");
CREATE INDEX "DropRewardEvent_eventId_source_idx" ON "DropRewardEvent"("eventId", "source");
CREATE INDEX "DropRewardEvent_createdAt_id_idx" ON "DropRewardEvent"("createdAt", "id");

CREATE UNIQUE INDEX "DropTicket_code_key" ON "DropTicket"("code");
CREATE INDEX "DropTicket_userId_status_dropId_createdAt_id_idx" ON "DropTicket"("userId", "status", "dropId", "createdAt", "id");
CREATE INDEX "DropTicket_userId_monthKey_status_idx" ON "DropTicket"("userId", "monthKey", "status");
CREATE INDEX "DropTicket_dropId_status_createdAt_id_idx" ON "DropTicket"("dropId", "status", "createdAt", "id");
CREATE INDEX "DropTicket_rewardEventId_idx" ON "DropTicket"("rewardEventId");

CREATE UNIQUE INDEX "DropDrawSnapshot_dropId_key" ON "DropDrawSnapshot"("dropId");

CREATE UNIQUE INDEX "DropWinner_ticketId_key" ON "DropWinner"("ticketId");
CREATE UNIQUE INDEX "DropWinner_dropId_position_reserve_key" ON "DropWinner"("dropId", "position", "reserve");
CREATE INDEX "DropWinner_dropId_reserve_position_idx" ON "DropWinner"("dropId", "reserve", "position");
CREATE INDEX "DropWinner_userId_status_createdAt_idx" ON "DropWinner"("userId", "status", "createdAt");

CREATE UNIQUE INDEX "DropReferral_invitedUserId_key" ON "DropReferral"("invitedUserId");
CREATE UNIQUE INDEX "DropReferral_code_key" ON "DropReferral"("code");
CREATE INDEX "DropReferral_inviterUserId_status_createdAt_idx" ON "DropReferral"("inviterUserId", "status", "createdAt");
CREATE INDEX "DropReferral_code_idx" ON "DropReferral"("code");

CREATE UNIQUE INDEX "DropUserRestriction_userId_key" ON "DropUserRestriction"("userId");
CREATE INDEX "DropUserRestriction_expiresAt_idx" ON "DropUserRestriction"("expiresAt");

ALTER TABLE "DropRewardEvent"
  ADD CONSTRAINT "DropRewardEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DropRewardEvent"
  ADD CONSTRAINT "DropRewardEvent_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DropTicket"
  ADD CONSTRAINT "DropTicket_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DropTicket"
  ADD CONSTRAINT "DropTicket_dropId_fkey"
  FOREIGN KEY ("dropId") REFERENCES "Drop"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DropTicket"
  ADD CONSTRAINT "DropTicket_rewardEventId_fkey"
  FOREIGN KEY ("rewardEventId") REFERENCES "DropRewardEvent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DropDrawSnapshot"
  ADD CONSTRAINT "DropDrawSnapshot_dropId_fkey"
  FOREIGN KEY ("dropId") REFERENCES "Drop"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DropWinner"
  ADD CONSTRAINT "DropWinner_dropId_fkey"
  FOREIGN KEY ("dropId") REFERENCES "Drop"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DropWinner"
  ADD CONSTRAINT "DropWinner_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DropWinner"
  ADD CONSTRAINT "DropWinner_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "DropTicket"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DropReferral"
  ADD CONSTRAINT "DropReferral_inviterUserId_fkey"
  FOREIGN KEY ("inviterUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DropReferral"
  ADD CONSTRAINT "DropReferral_invitedUserId_fkey"
  FOREIGN KEY ("invitedUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DropUserRestriction"
  ADD CONSTRAINT "DropUserRestriction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
