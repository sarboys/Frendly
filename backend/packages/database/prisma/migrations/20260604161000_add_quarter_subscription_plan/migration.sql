INSERT INTO "SubscriptionCatalogPlan" (
  "id",
  "label",
  "description",
  "priceRub",
  "priceMonthlyRub",
  "tokenCost",
  "tokenMonthlyCost",
  "trialDays",
  "durationDays",
  "badge",
  "benefits",
  "active",
  "sortOrder",
  "updatedAt"
) VALUES (
  'quarter',
  '3 месяца',
  'Frendly+ на 3 месяца',
  1797,
  599,
  1797,
  599,
  0,
  90,
  '-25%',
  ARRAY[]::TEXT[],
  true,
  20,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "priceRub" = EXCLUDED."priceRub",
  "priceMonthlyRub" = EXCLUDED."priceMonthlyRub",
  "tokenCost" = EXCLUDED."tokenCost",
  "tokenMonthlyCost" = EXCLUDED."tokenMonthlyCost",
  "trialDays" = EXCLUDED."trialDays",
  "durationDays" = EXCLUDED."durationDays",
  "badge" = EXCLUDED."badge",
  "benefits" = EXCLUDED."benefits",
  "active" = EXCLUDED."active",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "SubscriptionCatalogPlan"
SET "sortOrder" = 30,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'year' AND "sortOrder" < 30;
