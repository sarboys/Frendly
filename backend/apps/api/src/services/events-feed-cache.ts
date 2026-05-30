import { createHash } from 'node:crypto';

type CacheInputValue = boolean | number | string | null | undefined;

export interface EventsFeedCacheInput {
  filter?: CacheInputValue;
  lifestyle?: CacheInputValue;
  price?: CacheInputValue;
  gender?: CacheInputValue;
  access?: CacheInputValue;
  city?: CacheInputValue;
  requiresVerification?: CacheInputValue;
  requiresFrendlyPlus?: CacheInputValue;
  date?: CacheInputValue;
  cursor?: CacheInputValue;
  limit?: CacheInputValue;
  latitude?: CacheInputValue;
  longitude?: CacheInputValue;
  radiusKm?: CacheInputValue;
  southWestLatitude?: CacheInputValue;
  southWestLongitude?: CacheInputValue;
  northEastLatitude?: CacheInputValue;
  northEastLongitude?: CacheInputValue;
  q?: CacheInputValue;
  cityVersion?: CacheInputValue;
}

interface NormalizedEventsFeedGeo {
  latitude: number;
  longitude: number;
  radiusKm: number | null;
}

function clean(value: CacheInputValue): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function toFiniteNumber(value: CacheInputValue): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return null;
    }

    const parsed = Number(trimmed);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function roundNumber(value: number, decimals = 3): number {
  const multiplier = 10 ** decimals;

  return Math.round(value * multiplier) / multiplier;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeBounds(
  input: EventsFeedCacheInput,
): number[] | null {
  const southWestLatitude = toFiniteNumber(input.southWestLatitude);
  const southWestLongitude = toFiniteNumber(input.southWestLongitude);
  const northEastLatitude = toFiniteNumber(input.northEastLatitude);
  const northEastLongitude = toFiniteNumber(input.northEastLongitude);

  if (
    southWestLatitude === null ||
    southWestLongitude === null ||
    northEastLatitude === null ||
    northEastLongitude === null
  ) {
    return null;
  }

  return [
    roundNumber(southWestLatitude),
    roundNumber(southWestLongitude),
    roundNumber(northEastLatitude),
    roundNumber(northEastLongitude),
  ];
}

function normalizeLimit(value: CacheInputValue): number {
  const parsed = toFiniteNumber(value);

  if (parsed === null) {
    return 20;
  }

  return clamp(Math.trunc(parsed), 1, 50);
}

function isTrue(value: CacheInputValue): boolean {
  return value === true || value === 'true';
}

export function normalizeEventsFeedGeo(
  input: EventsFeedCacheInput,
): NormalizedEventsFeedGeo | null {
  const latitude = toFiniteNumber(input.latitude);
  const longitude = toFiniteNumber(input.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  const radiusKm = toFiniteNumber(input.radiusKm);

  return {
    latitude: roundNumber(latitude),
    longitude: roundNumber(longitude),
    radiusKm: radiusKm === null ? null : clamp(Math.round(radiusKm), 1, 150),
  };
}

export function shouldBypassEventsFeedCache(
  input: EventsFeedCacheInput,
): boolean {
  return clean(input.q) !== null;
}

export function eventsFeedCacheTtlSeconds(
  input: EventsFeedCacheInput,
): number {
  return normalizeEventsFeedGeo(input) === null ? 30 : 15;
}

export function buildEventsFeedCacheKey(input: EventsFeedCacheInput): string {
  const stable = {
    version: 1,
    filter: clean(input.filter),
    lifestyle: clean(input.lifestyle),
    price: clean(input.price),
    gender: clean(input.gender),
    access: clean(input.access),
    city: clean(input.city),
    requiresVerification: isTrue(input.requiresVerification),
    requiresFrendlyPlus: isTrue(input.requiresFrendlyPlus),
    date: clean(input.date) ?? 'any',
    cursor: clean(input.cursor),
    limit: normalizeLimit(input.limit),
    geo: normalizeEventsFeedGeo(input),
    bounds: normalizeBounds(input),
    q: clean(input.q),
    cityVersion: toFiniteNumber(input.cityVersion),
  };
  const digest = createHash('sha1')
    .update(JSON.stringify(stable))
    .digest('hex');

  return `events:feed:v1:${digest}`;
}
