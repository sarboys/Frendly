-- CreateEnum
CREATE TYPE "AppPlatform" AS ENUM ('ios', 'android');

-- CreateEnum
CREATE TYPE "AppPopupCampaignStatus" AS ENUM ('draft', 'active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "AppPopupAudienceKind" AS ENUM ('all', 'selected_users');

-- CreateEnum
CREATE TYPE "AppPopupTriState" AS ENUM ('any', 'yes', 'no');

-- CreateEnum
CREATE TYPE "AppPopupButtonAction" AS ENUM ('store_update', 'app_route', 'external_url');

-- CreateTable
CREATE TABLE "AppVersionPolicy" (
    "id" TEXT NOT NULL,
    "platform" "AppPlatform" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "minSupportedBuild" INTEGER NOT NULL DEFAULT 0,
    "latestBuild" INTEGER,
    "storeUrl" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Обновите Frendly',
    "body" TEXT NOT NULL DEFAULT 'Чтобы продолжить, установите последнюю версию приложения.',
    "buttonLabel" TEXT NOT NULL DEFAULT 'Обновить',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppVersionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppPopupCampaign" (
    "id" TEXT NOT NULL,
    "internalName" TEXT NOT NULL,
    "status" "AppPopupCampaignStatus" NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dismissible" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "buttonEnabled" BOOLEAN NOT NULL DEFAULT false,
    "buttonLabel" TEXT,
    "buttonAction" "AppPopupButtonAction",
    "buttonValue" TEXT,
    "audienceKind" "AppPopupAudienceKind" NOT NULL DEFAULT 'all',
    "platform" "AppPlatform",
    "minBuild" INTEGER,
    "maxBuild" INTEGER,
    "frendlyPlus" "AppPopupTriState" NOT NULL DEFAULT 'any',
    "verified" "AppPopupTriState" NOT NULL DEFAULT 'any',
    "cityNames" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppPopupCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppPopupTargetUser" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppPopupTargetUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppPopupCampaignStats" (
    "campaignId" TEXT NOT NULL,
    "impressionCount" INTEGER NOT NULL DEFAULT 0,
    "ctaClickCount" INTEGER NOT NULL DEFAULT 0,
    "dismissCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppPopupCampaignStats_pkey" PRIMARY KEY ("campaignId")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppVersionPolicy_platform_key" ON "AppVersionPolicy"("platform");

-- CreateIndex
CREATE INDEX "AppVersionPolicy_enabled_platform_idx" ON "AppVersionPolicy"("enabled", "platform");

-- CreateIndex
CREATE INDEX "AppPopupCampaign_status_priority_createdAt_idx" ON "AppPopupCampaign"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "AppPopupCampaign_platform_status_idx" ON "AppPopupCampaign"("platform", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AppPopupTargetUser_campaignId_userId_key" ON "AppPopupTargetUser"("campaignId", "userId");

-- CreateIndex
CREATE INDEX "AppPopupTargetUser_userId_campaignId_idx" ON "AppPopupTargetUser"("userId", "campaignId");

-- AddForeignKey
ALTER TABLE "AppPopupTargetUser" ADD CONSTRAINT "AppPopupTargetUser_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AppPopupCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppPopupTargetUser" ADD CONSTRAINT "AppPopupTargetUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppPopupCampaignStats" ADD CONSTRAINT "AppPopupCampaignStats_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AppPopupCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
