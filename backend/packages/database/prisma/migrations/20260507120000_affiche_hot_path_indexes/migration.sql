CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "ExternalContentItem_affiche_feed_idx"
ON "ExternalContentItem"("city", "startsAt", "id")
WHERE "contentKind" = 'event'
  AND "publicStatus" = 'published'
  AND "moderationStatus" <> 'rejected'
  AND "priceMode" IN ('free', 'paid');

CREATE INDEX IF NOT EXISTS "ExternalContentItem_affiche_category_feed_idx"
ON "ExternalContentItem"("city", "category", "startsAt", "id")
WHERE "contentKind" = 'event'
  AND "publicStatus" = 'published'
  AND "moderationStatus" <> 'rejected'
  AND "priceMode" IN ('free', 'paid');

CREATE INDEX IF NOT EXISTS "ExternalContentItem_affiche_price_feed_idx"
ON "ExternalContentItem"("city", "priceMode", "startsAt", "id")
WHERE "contentKind" = 'event'
  AND "publicStatus" = 'published'
  AND "moderationStatus" <> 'rejected'
  AND "priceMode" IN ('free', 'paid');

CREATE INDEX IF NOT EXISTS "ExternalContentItem_affiche_featured_feed_idx"
ON "ExternalContentItem"("city", "startsAt", "id")
WHERE "contentKind" = 'event'
  AND "publicStatus" = 'published'
  AND "moderationStatus" <> 'rejected'
  AND "priceMode" IN ('free', 'paid')
  AND "imageUrl" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "ExternalContentItem_title_trgm_idx"
ON "ExternalContentItem" USING GIN ("title" gin_trgm_ops)
WHERE "contentKind" = 'event';

CREATE INDEX IF NOT EXISTS "ExternalContentItem_venueName_trgm_idx"
ON "ExternalContentItem" USING GIN ("venueName" gin_trgm_ops)
WHERE "contentKind" = 'event' AND "venueName" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "ExternalContentItem_address_trgm_idx"
ON "ExternalContentItem" USING GIN ("address" gin_trgm_ops)
WHERE "contentKind" = 'event' AND "address" IS NOT NULL;
