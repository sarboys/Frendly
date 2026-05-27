ALTER TABLE "SubscriptionCatalogSettings"
  ALTER COLUMN "freeMeetupMonthlyLimit" SET DEFAULT 7;

UPDATE "SubscriptionCatalogSettings"
SET "freeMeetupMonthlyLimit" = 7,
    "updatedAt" = NOW()
WHERE "id" = 'frendly_plus'
  AND "freeMeetupMonthlyLimit" > 7;
