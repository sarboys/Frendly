UPDATE "Profile"
SET "avatarUrl" = '/media/' || "avatarAssetId"
WHERE "avatarAssetId" IS NOT NULL;
