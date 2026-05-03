const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_SEED_TODAY_UTC = Date.UTC(2026, 3, 18);
const FUTURE_SEED_BUFFER_DAYS = 7;

export function shiftSeedDatesIntoFuture(now = new Date()) {
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const targetBaseUtc = todayUtc + FUTURE_SEED_BUFFER_DAYS * DAY_MS;

  return Math.max(0, targetBaseUtc - BASE_SEED_TODAY_UTC);
}

export function shiftSeedDate(date: Date, offsetMs: number) {
  return new Date(date.getTime() + offsetMs);
}
