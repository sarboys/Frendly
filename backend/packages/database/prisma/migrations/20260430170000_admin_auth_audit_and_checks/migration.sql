-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('owner', 'operator', 'analyst');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'operator',
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "refreshTokenId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditEvent" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT,
    "sessionId" TEXT,
    "action" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER,
    "requestId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
CREATE INDEX "AdminUser_status_createdAt_id_idx" ON "AdminUser"("status", "createdAt", "id");
CREATE UNIQUE INDEX "AdminSession_refreshTokenId_key" ON "AdminSession"("refreshTokenId");
CREATE INDEX "AdminSession_adminUserId_revokedAt_idx" ON "AdminSession"("adminUserId", "revokedAt");
CREATE INDEX "AdminAuditEvent_adminUserId_createdAt_id_idx" ON "AdminAuditEvent"("adminUserId", "createdAt", "id");
CREATE INDEX "AdminAuditEvent_action_createdAt_id_idx" ON "AdminAuditEvent"("action", "createdAt", "id");
CREATE INDEX "AdminAuditEvent_path_createdAt_id_idx" ON "AdminAuditEvent"("path", "createdAt", "id");
CREATE INDEX "EveningAnalyticsEvent_venueId_name_createdAt_id_idx"
ON "EveningAnalyticsEvent"("venueId", "name", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "AdminSession"
ADD CONSTRAINT "AdminSession_adminUserId_fkey"
FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminAuditEvent"
ADD CONSTRAINT "AdminAuditEvent_adminUserId_fkey"
FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Status and mode constraints for admin-managed string fields.
ALTER TABLE "AdminUser"
ADD CONSTRAINT "AdminUser_status_check"
CHECK ("status" IN ('active', 'suspended'));

ALTER TABLE "Partner"
ADD CONSTRAINT "Partner_status_check"
CHECK ("status" IN ('active', 'inactive', 'draft'));

ALTER TABLE "PartnerAccount"
ADD CONSTRAINT "PartnerAccount_status_check"
CHECK ("status" IN ('pending', 'approved', 'rejected', 'suspended'));

ALTER TABLE "Venue"
ADD CONSTRAINT "Venue_ownerType_check"
CHECK ("ownerType" IN ('frendly', 'partner'));

ALTER TABLE "Venue"
ADD CONSTRAINT "Venue_moderationStatus_check"
CHECK ("moderationStatus" IN ('approved', 'pending', 'rejected'));

ALTER TABLE "Venue"
ADD CONSTRAINT "Venue_trustLevel_check"
CHECK ("trustLevel" IN ('verified', 'partner_claimed', 'unverified'));

ALTER TABLE "Venue"
ADD CONSTRAINT "Venue_status_check"
CHECK ("status" IN ('open', 'closed', 'hidden'));

ALTER TABLE "PartnerOffer"
ADD CONSTRAINT "PartnerOffer_status_check"
CHECK ("status" IN ('active', 'inactive', 'draft'));

ALTER TABLE "PartnerOfferCode"
ADD CONSTRAINT "PartnerOfferCode_status_check"
CHECK ("status" IN ('issued', 'activated', 'expired'));

ALTER TABLE "PartnerFeaturedRequest"
ADD CONSTRAINT "PartnerFeaturedRequest_status_check"
CHECK ("status" IN ('draft', 'submitted', 'approved', 'rejected', 'archived'));

ALTER TABLE "Poster"
ADD CONSTRAINT "Poster_status_check"
CHECK ("status" IN ('draft', 'submitted', 'published', 'rejected', 'archived'));

ALTER TABLE "EveningRouteTemplate"
ADD CONSTRAINT "EveningRouteTemplate_status_check"
CHECK ("status" IN ('draft', 'published', 'archived'));

ALTER TABLE "EveningRoute"
ADD CONSTRAINT "EveningRoute_status_check"
CHECK ("status" IN ('legacy', 'private', 'draft', 'published', 'archived'));

ALTER TABLE "EveningSession"
ADD CONSTRAINT "EveningSession_phase_check"
CHECK ("phase" IN ('scheduled', 'live', 'done'));

ALTER TABLE "EveningSession"
ADD CONSTRAINT "EveningSession_privacy_check"
CHECK ("privacy" IN ('open', 'request', 'invite'));

ALTER TABLE "EveningSession"
ADD CONSTRAINT "EveningSession_mode_check"
CHECK ("mode" IN ('hybrid', 'manual'));

ALTER TABLE "EveningSessionParticipant"
ADD CONSTRAINT "EveningSessionParticipant_role_check"
CHECK ("role" IN ('host', 'guest'));

ALTER TABLE "EveningSessionParticipant"
ADD CONSTRAINT "EveningSessionParticipant_status_check"
CHECK ("status" IN ('joined', 'invited', 'left'));

ALTER TABLE "EveningSessionJoinRequest"
ADD CONSTRAINT "EveningSessionJoinRequest_status_check"
CHECK ("status" IN ('requested', 'approved', 'rejected'));

ALTER TABLE "EveningSessionStepState"
ADD CONSTRAINT "EveningSessionStepState_status_check"
CHECK ("status" IN ('upcoming', 'current', 'done', 'skipped'));

ALTER TABLE "AiEveningBrief"
ADD CONSTRAINT "AiEveningBrief_status_check"
CHECK ("status" IN ('draft', 'archived'));

ALTER TABLE "AiEveningGenerationRun"
ADD CONSTRAINT "AiEveningGenerationRun_status_check"
CHECK ("status" IN ('running', 'completed', 'failed'));

ALTER TABLE "AiEveningDraft"
ADD CONSTRAINT "AiEveningDraft_validationStatus_check"
CHECK ("validationStatus" IN ('pending', 'valid', 'warning', 'invalid'));
