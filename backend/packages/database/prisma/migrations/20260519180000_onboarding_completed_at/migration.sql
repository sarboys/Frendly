ALTER TABLE "OnboardingPreferences"
ADD COLUMN "completedAt" TIMESTAMP(3);

UPDATE "OnboardingPreferences"
SET "completedAt" = COALESCE("completedAt", "updatedAt")
WHERE "completedAt" IS NULL
  AND (
    "intent" IS NOT NULL
    OR "gender" IS NOT NULL
    OR "birthDate" IS NOT NULL
    OR "city" IS NOT NULL
    OR "area" IS NOT NULL
    OR "vibe" IS NOT NULL
    OR (
      jsonb_typeof("interests") = 'array'
      AND jsonb_array_length("interests") > 0
    )
  );
