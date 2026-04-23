-- CreateEnum
CREATE TYPE "UserGender" AS ENUM ('male', 'female');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "gender" "UserGender";

-- AlterTable
ALTER TABLE "OnboardingPreferences" ADD COLUMN "gender" "UserGender";
