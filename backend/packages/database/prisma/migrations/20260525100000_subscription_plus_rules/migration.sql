ALTER TABLE "SubscriptionCatalogSettings"
  ADD COLUMN "freeSwipeHourlyLimit" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "plusSwipeHourlyLimit" INTEGER,
  ADD COLUMN "freeSuperLikeDailyLimit" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "plusSuperLikeDailyLimit" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "paidSuperLikeTokenCost" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "freeMeetupMonthlyLimit" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "plusMeetupMonthlyLimit" INTEGER,
  ADD COLUMN "tokenPurchaseDiscountPercent" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "communityCreationRequiresPlus" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "incomingLikesRequiresPlus" BOOLEAN NOT NULL DEFAULT true;
