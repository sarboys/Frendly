ALTER TABLE "Community"
  ADD COLUMN "imageAssetId" TEXT;

ALTER TABLE "Community"
  ADD CONSTRAINT "Community_imageAssetId_fkey"
  FOREIGN KEY ("imageAssetId") REFERENCES "MediaAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Community_imageAssetId_idx" ON "Community"("imageAssetId");
