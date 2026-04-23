ALTER TYPE "MediaAssetKind" ADD VALUE IF NOT EXISTS 'story_media';
ALTER TYPE "MediaAssetKind" ADD VALUE IF NOT EXISTS 'poster_cover';

ALTER TABLE "EventStory"
  ADD COLUMN IF NOT EXISTS "mediaAssetId" TEXT;

ALTER TABLE "Poster"
  ADD COLUMN IF NOT EXISTS "coverAssetId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "EventStory_mediaAssetId_key"
  ON "EventStory"("mediaAssetId");

CREATE UNIQUE INDEX IF NOT EXISTS "Poster_coverAssetId_key"
  ON "Poster"("coverAssetId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Poster_coverAssetId_fkey'
      AND table_name = 'Poster'
  ) THEN
    ALTER TABLE "Poster"
      ADD CONSTRAINT "Poster_coverAssetId_fkey"
      FOREIGN KEY ("coverAssetId") REFERENCES "MediaAsset"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'EventStory_mediaAssetId_fkey'
      AND table_name = 'EventStory'
  ) THEN
    ALTER TABLE "EventStory"
      ADD CONSTRAINT "EventStory_mediaAssetId_fkey"
      FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
