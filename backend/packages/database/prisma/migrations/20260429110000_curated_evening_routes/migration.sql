-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "contact" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL DEFAULT 'frendly',
    "partnerId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "externalId" TEXT,
    "moderationStatus" TEXT NOT NULL DEFAULT 'approved',
    "trustLevel" TEXT NOT NULL DEFAULT 'verified',
    "city" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "area" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "tags" JSONB NOT NULL,
    "averageCheck" INTEGER,
    "openingHours" JSONB,
    "status" TEXT NOT NULL DEFAULT 'open',
    "lastSyncedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "verifiedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerOffer" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "terms" TEXT,
    "shortLabel" TEXT,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "daysOfWeek" JSONB,
    "timeWindow" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerOfferCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "routeTemplateId" TEXT,
    "stepId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "activatedIpHash" TEXT,
    "activatedUserAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerOfferCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiEveningBrief" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "area" TEXT,
    "titleIdea" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "mood" TEXT NOT NULL,
    "budget" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "minSteps" INTEGER NOT NULL DEFAULT 2,
    "maxSteps" INTEGER NOT NULL DEFAULT 4,
    "requiredVenueIds" JSONB,
    "excludedVenueIds" JSONB,
    "partnerGoal" TEXT,
    "tone" TEXT,
    "boldness" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiEveningBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiEveningGenerationRun" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openrouter',
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "requestJson" JSONB NOT NULL,
    "responseJson" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AiEveningGenerationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiEveningDraft" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "runId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT,
    "vibe" TEXT NOT NULL,
    "budget" TEXT NOT NULL,
    "durationLabel" TEXT NOT NULL,
    "totalPriceFrom" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "validationStatus" TEXT NOT NULL DEFAULT 'pending',
    "validationIssues" JSONB,
    "selectedAt" TIMESTAMP(3),
    "createdRouteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiEveningDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiEveningDraftStep" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "venueId" TEXT,
    "partnerOfferId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "timeLabel" TEXT NOT NULL,
    "endTimeLabel" TEXT,
    "description" TEXT,
    "transition" TEXT,
    "priceEstimate" INTEGER,
    "walkMin" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiEveningDraftStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EveningRouteTemplate" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'team',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "city" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "area" TEXT,
    "centerLat" DOUBLE PRECISION,
    "centerLng" DOUBLE PRECISION,
    "radiusMeters" INTEGER,
    "currentRouteId" TEXT,
    "scheduledPublishAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdByAdminId" TEXT,
    "updatedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EveningRouteTemplate_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "EveningRoute"
ADD COLUMN "templateId" TEXT,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN "city" TEXT NOT NULL DEFAULT 'Москва',
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
ADD COLUMN "centerLat" DOUBLE PRECISION,
ADD COLUMN "centerLng" DOUBLE PRECISION,
ADD COLUMN "radiusMeters" INTEGER,
ADD COLUMN "isCurated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "badgeLabel" TEXT,
ADD COLUMN "coverAssetId" TEXT,
ADD COLUMN "createdByAdminId" TEXT,
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EveningRouteStep"
ADD COLUMN "venueId" TEXT,
ADD COLUMN "partnerOfferId" TEXT,
ADD COLUMN "offerTitleSnapshot" TEXT,
ADD COLUMN "offerDescriptionSnapshot" TEXT,
ADD COLUMN "offerTermsSnapshot" TEXT,
ADD COLUMN "offerShortLabelSnapshot" TEXT,
ADD COLUMN "offerValidFromSnapshot" TIMESTAMP(3),
ADD COLUMN "offerValidToSnapshot" TIMESTAMP(3),
ADD COLUMN "venueNameSnapshot" TEXT,
ADD COLUMN "venueAddressSnapshot" TEXT,
ADD COLUMN "venueLatSnapshot" DOUBLE PRECISION,
ADD COLUMN "venueLngSnapshot" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "EveningSession" ADD COLUMN "routeTemplateId" TEXT;

-- CreateIndex
CREATE INDEX "Partner_city_status_id_idx" ON "Partner"("city", "status", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Venue_source_externalId_key" ON "Venue"("source", "externalId");

-- CreateIndex
CREATE INDEX "Venue_city_moderationStatus_trustLevel_id_idx" ON "Venue"("city", "moderationStatus", "trustLevel", "id");

-- CreateIndex
CREATE INDEX "Venue_city_category_id_idx" ON "Venue"("city", "category", "id");

-- CreateIndex
CREATE INDEX "Venue_partnerId_id_idx" ON "Venue"("partnerId", "id");

-- CreateIndex
CREATE INDEX "PartnerOffer_partnerId_status_id_idx" ON "PartnerOffer"("partnerId", "status", "id");

-- CreateIndex
CREATE INDEX "PartnerOffer_venueId_status_id_idx" ON "PartnerOffer"("venueId", "status", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerOfferCode_codeHash_key" ON "PartnerOfferCode"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerOfferCode_userId_sessionId_partnerId_stepId_offerId_key" ON "PartnerOfferCode"("userId", "sessionId", "partnerId", "stepId", "offerId");

-- CreateIndex
CREATE INDEX "PartnerOfferCode_sessionId_userId_status_idx" ON "PartnerOfferCode"("sessionId", "userId", "status");

-- CreateIndex
CREATE INDEX "PartnerOfferCode_partnerId_activatedAt_id_idx" ON "PartnerOfferCode"("partnerId", "activatedAt", "id");

-- CreateIndex
CREATE INDEX "PartnerOfferCode_venueId_activatedAt_id_idx" ON "PartnerOfferCode"("venueId", "activatedAt", "id");

-- CreateIndex
CREATE INDEX "PartnerOfferCode_offerId_activatedAt_id_idx" ON "PartnerOfferCode"("offerId", "activatedAt", "id");

-- CreateIndex
CREATE INDEX "PartnerOfferCode_routeTemplateId_activatedAt_id_idx" ON "PartnerOfferCode"("routeTemplateId", "activatedAt", "id");

-- CreateIndex
CREATE INDEX "AiEveningBrief_city_status_createdAt_id_idx" ON "AiEveningBrief"("city", "status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AiEveningGenerationRun_briefId_createdAt_id_idx" ON "AiEveningGenerationRun"("briefId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AiEveningGenerationRun_provider_model_createdAt_id_idx" ON "AiEveningGenerationRun"("provider", "model", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AiEveningDraft_briefId_validationStatus_score_id_idx" ON "AiEveningDraft"("briefId", "validationStatus", "score", "id");

-- CreateIndex
CREATE INDEX "AiEveningDraftStep_draftId_sortOrder_id_idx" ON "AiEveningDraftStep"("draftId", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "AiEveningDraftStep_venueId_idx" ON "AiEveningDraftStep"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "EveningRouteTemplate_currentRouteId_key" ON "EveningRouteTemplate"("currentRouteId");

-- CreateIndex
CREATE INDEX "EveningRouteTemplate_city_status_publishedAt_id_idx" ON "EveningRouteTemplate"("city", "status", "publishedAt", "id");

-- CreateIndex
CREATE INDEX "EveningRouteTemplate_city_scheduledPublishAt_id_idx" ON "EveningRouteTemplate"("city", "scheduledPublishAt", "id");

-- CreateIndex
CREATE INDEX "EveningRoute_templateId_version_idx" ON "EveningRoute"("templateId", "version");

-- CreateIndex
CREATE INDEX "EveningRoute_city_status_isCurated_id_idx" ON "EveningRoute"("city", "status", "isCurated", "id");

-- CreateIndex
CREATE INDEX "EveningRoute_city_publishedAt_id_idx" ON "EveningRoute"("city", "publishedAt", "id");

-- CreateIndex
CREATE INDEX "EveningRouteStep_venueId_idx" ON "EveningRouteStep"("venueId");

-- CreateIndex
CREATE INDEX "EveningRouteStep_partnerOfferId_idx" ON "EveningRouteStep"("partnerOfferId");

-- CreateIndex
CREATE INDEX "EveningSession_routeTemplateId_phase_startsAt_id_idx" ON "EveningSession"("routeTemplateId", "phase", "startsAt", "id");

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOffer" ADD CONSTRAINT "PartnerOffer_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOffer" ADD CONSTRAINT "PartnerOffer_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOfferCode" ADD CONSTRAINT "PartnerOfferCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOfferCode" ADD CONSTRAINT "PartnerOfferCode_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EveningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOfferCode" ADD CONSTRAINT "PartnerOfferCode_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "EveningRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOfferCode" ADD CONSTRAINT "PartnerOfferCode_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "EveningRouteStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOfferCode" ADD CONSTRAINT "PartnerOfferCode_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOfferCode" ADD CONSTRAINT "PartnerOfferCode_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOfferCode" ADD CONSTRAINT "PartnerOfferCode_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "PartnerOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEveningGenerationRun" ADD CONSTRAINT "AiEveningGenerationRun_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "AiEveningBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEveningDraft" ADD CONSTRAINT "AiEveningDraft_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "AiEveningBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEveningDraft" ADD CONSTRAINT "AiEveningDraft_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AiEveningGenerationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEveningDraftStep" ADD CONSTRAINT "AiEveningDraftStep_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "AiEveningDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EveningRouteTemplate" ADD CONSTRAINT "EveningRouteTemplate_currentRouteId_fkey" FOREIGN KEY ("currentRouteId") REFERENCES "EveningRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EveningRoute" ADD CONSTRAINT "EveningRoute_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EveningRouteTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EveningRouteStep" ADD CONSTRAINT "EveningRouteStep_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EveningRouteStep" ADD CONSTRAINT "EveningRouteStep_partnerOfferId_fkey" FOREIGN KEY ("partnerOfferId") REFERENCES "PartnerOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EveningSession" ADD CONSTRAINT "EveningSession_routeTemplateId_fkey" FOREIGN KEY ("routeTemplateId") REFERENCES "EveningRouteTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
