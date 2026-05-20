UPDATE "Profile" AS profile
SET "avatarUrl" = asset."publicUrl"
FROM "MediaAsset" AS asset
WHERE profile."avatarAssetId" = asset."id"
  AND asset."publicUrl" IS NOT NULL
  AND asset."publicUrl" <> ''
  AND profile."avatarUrl" IS DISTINCT FROM asset."publicUrl";
