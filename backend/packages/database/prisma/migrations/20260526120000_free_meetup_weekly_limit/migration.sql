UPDATE "SubscriptionCatalogSettings"
SET "freeMeetupMonthlyLimit" = 10,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'frendly_plus'
  AND "freeMeetupMonthlyLimit" > 10;
