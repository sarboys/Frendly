ALTER TYPE "AuthProvider" ADD VALUE IF NOT EXISTS 'apple';

ALTER TABLE "User"
ADD COLUMN "legalTermsAcceptedAt" TIMESTAMP(3),
ADD COLUMN "legalTermsVersion" TEXT,
ADD COLUMN "privacyPolicyAcceptedAt" TIMESTAMP(3),
ADD COLUMN "communityRulesAcceptedAt" TIMESTAMP(3);
