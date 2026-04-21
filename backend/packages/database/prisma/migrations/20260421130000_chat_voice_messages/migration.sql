ALTER TYPE "MediaAssetKind" ADD VALUE IF NOT EXISTS 'chat_voice';

ALTER TABLE "MediaAsset"
ADD COLUMN "durationMs" INTEGER;
