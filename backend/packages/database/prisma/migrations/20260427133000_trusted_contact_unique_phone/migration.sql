DELETE FROM "TrustedContact"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "userId", "phoneNumber"
        ORDER BY "createdAt" ASC, "id" ASC
      ) AS "row_number"
    FROM "TrustedContact"
  ) AS "duplicates"
  WHERE "row_number" > 1
);

DROP INDEX IF EXISTS "TrustedContact_userId_phoneNumber_idx";

CREATE UNIQUE INDEX "TrustedContact_userId_phoneNumber_key"
ON "TrustedContact"("userId", "phoneNumber");
