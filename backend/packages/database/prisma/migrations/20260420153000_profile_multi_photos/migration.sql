CREATE TABLE "ProfilePhoto" (
  "id" TEXT NOT NULL,
  "profileUserId" TEXT NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProfilePhoto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfilePhoto_mediaAssetId_key" ON "ProfilePhoto"("mediaAssetId");
CREATE INDEX "ProfilePhoto_profileUserId_sortOrder_idx" ON "ProfilePhoto"("profileUserId", "sortOrder");

ALTER TABLE "ProfilePhoto"
ADD CONSTRAINT "ProfilePhoto_profileUserId_fkey"
FOREIGN KEY ("profileUserId") REFERENCES "Profile"("userId")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "ProfilePhoto"
ADD CONSTRAINT "ProfilePhoto_mediaAssetId_fkey"
FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
