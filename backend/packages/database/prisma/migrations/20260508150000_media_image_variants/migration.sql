ALTER TABLE "MediaAsset"
ADD COLUMN "variants" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "ExternalContentItem"
ADD COLUMN "imageVariants" JSONB;
