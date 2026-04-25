CREATE INDEX IF NOT EXISTS "Event_geo_nearby_idx"
ON "Event" ("isAfterDark", "latitude", "longitude", "startsAt", "id")
WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;
