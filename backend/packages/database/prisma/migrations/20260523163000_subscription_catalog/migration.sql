ALTER TABLE "UserSubscription" ALTER COLUMN "plan" TYPE TEXT USING "plan"::TEXT;

DROP TYPE IF EXISTS "SubscriptionPlan";

CREATE TABLE "SubscriptionCatalogPlan" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "priceRub" INTEGER NOT NULL,
  "priceMonthlyRub" INTEGER NOT NULL,
  "tokenCost" INTEGER NOT NULL,
  "tokenMonthlyCost" INTEGER NOT NULL,
  "trialDays" INTEGER NOT NULL DEFAULT 0,
  "durationDays" INTEGER NOT NULL,
  "badge" TEXT,
  "benefits" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionCatalogPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionCatalogSettings" (
  "id" TEXT NOT NULL,
  "benefits" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionCatalogSettings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubscriptionCatalogPlan_active_sortOrder_idx" ON "SubscriptionCatalogPlan"("active", "sortOrder");

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
) VALUES
  (
    'month',
    'Месячный',
    'Frendly+ на месяц',
    799,
    799,
    799,
    799,
    0,
    30,
    NULL,
    ARRAY[]::TEXT[],
    true,
    10,
    CURRENT_TIMESTAMP
  ),
  (
    'year',
    'Годовой',
    'Frendly+ на год',
    4788,
    399,
    4788,
    399,
    0,
    365,
    '-50%',
    ARRAY[]::TEXT[],
    true,
    20,
    CURRENT_TIMESTAMP
  );

INSERT INTO "SubscriptionCatalogSettings" ("id", "benefits", "updatedAt")
VALUES (
  'frendly_plus',
  ARRAY['Больше встреч', 'Больше лайков', 'Приоритет в радаре']::TEXT[],
  CURRENT_TIMESTAMP
);
