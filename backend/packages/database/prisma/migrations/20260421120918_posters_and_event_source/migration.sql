-- CreateEnum
CREATE TYPE "PosterCategory" AS ENUM ('concert', 'sport', 'exhibition', 'theatre', 'standup', 'festival', 'cinema');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "sourcePosterId" TEXT;

-- CreateTable
CREATE TABLE "Poster" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "category" "PosterCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "dateLabel" TEXT NOT NULL,
    "timeLabel" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "priceFrom" INTEGER NOT NULL,
    "ticketUrl" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "tone" "EventTone" NOT NULL DEFAULT 'warm',
    "tags" JSONB NOT NULL,
    "description" TEXT NOT NULL,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Poster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Poster_city_startsAt_idx" ON "Poster"("city", "startsAt");

-- CreateIndex
CREATE INDEX "Poster_city_category_startsAt_idx" ON "Poster"("city", "category", "startsAt");

-- CreateIndex
CREATE INDEX "Poster_city_isFeatured_startsAt_idx" ON "Poster"("city", "isFeatured", "startsAt");

-- CreateIndex
CREATE INDEX "Event_sourcePosterId_idx" ON "Event"("sourcePosterId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_sourcePosterId_fkey" FOREIGN KEY ("sourcePosterId") REFERENCES "Poster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
