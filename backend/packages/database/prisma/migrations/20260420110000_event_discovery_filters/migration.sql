-- CreateEnum
CREATE TYPE "EventLifestyle" AS ENUM ('zozh', 'neutral', 'anti');

-- CreateEnum
CREATE TYPE "EventPriceMode" AS ENUM ('free', 'fixed', 'from', 'upto', 'range', 'split');

-- CreateEnum
CREATE TYPE "EventAccessMode" AS ENUM ('open', 'request', 'free');

-- CreateEnum
CREATE TYPE "EventGenderMode" AS ENUM ('all', 'male', 'female');

-- CreateEnum
CREATE TYPE "EventVisibilityMode" AS ENUM ('public', 'friends');

-- AlterTable
ALTER TABLE "Event"
  ADD COLUMN "lifestyle" "EventLifestyle" NOT NULL DEFAULT 'neutral',
  ADD COLUMN "priceMode" "EventPriceMode" NOT NULL DEFAULT 'free',
  ADD COLUMN "priceAmountFrom" INTEGER,
  ADD COLUMN "priceAmountTo" INTEGER,
  ADD COLUMN "accessMode" "EventAccessMode" NOT NULL DEFAULT 'open',
  ADD COLUMN "genderMode" "EventGenderMode" NOT NULL DEFAULT 'all',
  ADD COLUMN "visibilityMode" "EventVisibilityMode" NOT NULL DEFAULT 'public';
