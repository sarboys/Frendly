CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Event_title_trgm_idx"
ON "Event" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Event_place_trgm_idx"
ON "Event" USING GIN ("place" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Event_description_trgm_idx"
ON "Event" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Event_hostNote_trgm_idx"
ON "Event" USING GIN ("hostNote" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Event_vibe_trgm_idx"
ON "Event" USING GIN ("vibe" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "User_displayName_trgm_idx"
ON "User" USING GIN ("displayName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Profile_area_trgm_idx"
ON "Profile" USING GIN ("area" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Profile_vibe_trgm_idx"
ON "Profile" USING GIN ("vibe" gin_trgm_ops);
