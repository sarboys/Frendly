ALTER TYPE "TokenLedgerReason" ADD VALUE IF NOT EXISTS 'reward_grant';

CREATE TABLE "UserSeasonRewardClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonKey" TEXT NOT NULL,
    "rewardKey" TEXT NOT NULL,
    "rewardKind" TEXT NOT NULL,
    "rewardAmount" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSeasonRewardClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserSeasonRewardClaim_userId_seasonKey_rewardKey_key"
    ON "UserSeasonRewardClaim"("userId", "seasonKey", "rewardKey");

CREATE INDEX "UserSeasonRewardClaim_userId_seasonKey_claimedAt_idx"
    ON "UserSeasonRewardClaim"("userId", "seasonKey", "claimedAt");

ALTER TABLE "UserSeasonRewardClaim"
    ADD CONSTRAINT "UserSeasonRewardClaim_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
