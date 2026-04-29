-- AlterTable
ALTER TABLE "Partner"
ADD COLUMN "taxId" TEXT,
ADD COLUMN "hostUserId" TEXT;

-- AlterTable
ALTER TABLE "Event"
ADD COLUMN "partnerId" TEXT,
ADD COLUMN "canceledAt" TIMESTAMP(3),
ADD COLUMN "cancelReason" TEXT;

-- AlterTable
ALTER TABLE "Community"
ADD COLUMN "partnerId" TEXT,
ADD COLUMN "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Poster"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'published',
ADD COLUMN "partnerId" TEXT;

-- CreateTable
CREATE TABLE "PartnerAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "partnerId" TEXT,
    "organizationName" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "reviewNote" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerSession" (
    "id" TEXT NOT NULL,
    "partnerAccountId" TEXT NOT NULL,
    "refreshTokenId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PartnerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerFeaturedRequest" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerFeaturedRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_hostUserId_key" ON "Partner"("hostUserId");

-- CreateIndex
CREATE INDEX "Partner_taxId_idx" ON "Partner"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerAccount_email_key" ON "PartnerAccount"("email");

-- CreateIndex
CREATE INDEX "PartnerAccount_status_createdAt_id_idx" ON "PartnerAccount"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "PartnerAccount_partnerId_status_id_idx" ON "PartnerAccount"("partnerId", "status", "id");

-- CreateIndex
CREATE INDEX "PartnerAccount_taxId_idx" ON "PartnerAccount"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerSession_refreshTokenId_key" ON "PartnerSession"("refreshTokenId");

-- CreateIndex
CREATE INDEX "PartnerSession_partnerAccountId_revokedAt_idx" ON "PartnerSession"("partnerAccountId", "revokedAt");

-- CreateIndex
CREATE INDEX "PartnerFeaturedRequest_partnerId_status_startsAt_id_idx" ON "PartnerFeaturedRequest"("partnerId", "status", "startsAt", "id");

-- CreateIndex
CREATE INDEX "PartnerFeaturedRequest_targetType_targetId_idx" ON "PartnerFeaturedRequest"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "PartnerFeaturedRequest_city_placement_status_startsAt_id_idx" ON "PartnerFeaturedRequest"("city", "placement", "status", "startsAt", "id");

-- CreateIndex
CREATE INDEX "Event_partnerId_startsAt_id_idx" ON "Event"("partnerId", "startsAt", "id");

-- CreateIndex
CREATE INDEX "Event_canceledAt_startsAt_id_idx" ON "Event"("canceledAt", "startsAt", "id");

-- CreateIndex
CREATE INDEX "Community_partnerId_createdAt_id_idx" ON "Community"("partnerId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Community_archivedAt_createdAt_id_idx" ON "Community"("archivedAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Poster_partnerId_startsAt_id_idx" ON "Poster"("partnerId", "startsAt", "id");

-- CreateIndex
CREATE INDEX "Poster_status_city_startsAt_id_idx" ON "Poster"("status", "city", "startsAt", "id");

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAccount" ADD CONSTRAINT "PartnerAccount_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSession" ADD CONSTRAINT "PartnerSession_partnerAccountId_fkey" FOREIGN KEY ("partnerAccountId") REFERENCES "PartnerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerFeaturedRequest" ADD CONSTRAINT "PartnerFeaturedRequest_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poster" ADD CONSTRAINT "Poster_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
