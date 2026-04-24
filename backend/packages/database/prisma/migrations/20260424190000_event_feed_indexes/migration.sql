CREATE INDEX IF NOT EXISTS "Event_isAfterDark_startsAt_id_idx"
  ON "Event"("isAfterDark", "startsAt", "id");

CREATE INDEX IF NOT EXISTS "Event_isAfterDark_distanceKm_id_idx"
  ON "Event"("isAfterDark", "distanceKm", "id");

CREATE INDEX IF NOT EXISTS "Event_isAfterDark_isCalm_startsAt_id_idx"
  ON "Event"("isAfterDark", "isCalm", "startsAt", "id");

CREATE INDEX IF NOT EXISTS "Event_isAfterDark_isNewcomers_startsAt_id_idx"
  ON "Event"("isAfterDark", "isNewcomers", "startsAt", "id");

CREATE INDEX IF NOT EXISTS "Event_isAfterDark_isDate_startsAt_id_idx"
  ON "Event"("isAfterDark", "isDate", "startsAt", "id");

CREATE INDEX IF NOT EXISTS "Event_isAfterDark_lifestyle_startsAt_id_idx"
  ON "Event"("isAfterDark", "lifestyle", "startsAt", "id");

CREATE INDEX IF NOT EXISTS "Event_isAfterDark_priceMode_startsAt_id_idx"
  ON "Event"("isAfterDark", "priceMode", "startsAt", "id");

CREATE INDEX IF NOT EXISTS "Event_isAfterDark_accessMode_startsAt_id_idx"
  ON "Event"("isAfterDark", "accessMode", "startsAt", "id");

CREATE INDEX IF NOT EXISTS "Event_isAfterDark_genderMode_startsAt_id_idx"
  ON "Event"("isAfterDark", "genderMode", "startsAt", "id");
