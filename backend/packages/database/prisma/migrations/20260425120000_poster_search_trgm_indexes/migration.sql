CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Poster_title_trgm_idx"
ON "Poster" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Poster_venue_trgm_idx"
ON "Poster" USING GIN ("venue" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Poster_address_trgm_idx"
ON "Poster" USING GIN ("address" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Poster_description_trgm_idx"
ON "Poster" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Poster_provider_trgm_idx"
ON "Poster" USING GIN ("provider" gin_trgm_ops);
