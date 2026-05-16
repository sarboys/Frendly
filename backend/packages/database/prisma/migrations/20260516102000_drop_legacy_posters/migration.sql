ALTER TABLE "Event" DROP CONSTRAINT IF EXISTS "Event_sourcePosterId_fkey";

DROP INDEX IF EXISTS "Event_sourcePosterId_idx";

ALTER TABLE "Event" DROP COLUMN IF EXISTS "sourcePosterId";

DROP TABLE IF EXISTS "Poster";

DROP TYPE IF EXISTS "PosterCategory";

DELETE FROM "MediaAsset" WHERE "kind" = 'poster_cover';

ALTER TYPE "MediaAssetKind" RENAME TO "MediaAssetKind_old";

CREATE TYPE "MediaAssetKind" AS ENUM ('avatar', 'chat_attachment', 'chat_voice', 'story_media');

ALTER TABLE "MediaAsset"
  ALTER COLUMN "kind" TYPE "MediaAssetKind"
  USING ("kind"::text::"MediaAssetKind");

DROP TYPE "MediaAssetKind_old";
