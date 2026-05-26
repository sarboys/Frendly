import { bboxForContentCity } from './content-city-catalog';

const DEFAULT_YANDEX_GEOCODER_URL = 'https://geocode-maps.yandex.ru/1.x/';
const DEFAULT_NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const DEFAULT_TIMEOUT_MS = 2500;
const DEFAULT_NOMINATIM_RATE_LIMIT_MS = 1200;

export type VenueGeocodeInput = {
  city: string;
  venueName: string | null;
  address: string | null;
};

export type VenueGeocodeResult = {
  address: string | null;
  lat: number;
  lng: number;
  provider: 'yandex' | 'nominatim';
  query: string;
  precision: string | null;
  kind: string | null;
  osmType?: string | null;
  osmId?: number | null;
  category?: string | null;
  type?: string | null;
  importance?: number | null;
  displayName?: string | null;
};

type VenueGeocoderClientOptions = {
  apiKey?: string | null;
  baseUrl?: string | null;
  timeoutMs?: number | null;
};

export class VenueGeocoderHttpError extends Error {
  constructor(readonly statusCode: number) {
    super(`Venue geocoder request failed with status ${statusCode}`);
    this.name = 'VenueGeocoderHttpError';
  }
}

export function isVenueGeocoderLimitError(value: unknown) {
  return value instanceof VenueGeocoderHttpError
    && (value.statusCode === 403 || value.statusCode === 429);
}

export class VenueGeocoderClient {
  private static readonly nominatimCache = new Map<string, VenueGeocodeResult | null>();
  private static lastNominatimRequestAt = 0;
  private static nominatimStoppedForRun = false;

  private readonly apiKey: string | null;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly nominatimEnabled: boolean;
  private readonly nominatimBaseUrl: string;
  private readonly nominatimUserAgent: string | null;
  private readonly nominatimRateLimitMs: number;

  constructor(options: VenueGeocoderClientOptions = {}) {
    this.apiKey = cleanText(
      options.apiKey
        ?? process.env.YANDEX_GEOCODER_API_KEY
        ?? process.env.CONTENT_GEOCODER_API_KEY,
    );
    this.baseUrl = cleanText(options.baseUrl ?? process.env.YANDEX_GEOCODER_BASE_URL)
      ?? DEFAULT_YANDEX_GEOCODER_URL;
    this.timeoutMs = positiveInt(
      options.timeoutMs ?? process.env.CONTENT_GEOCODER_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
    );
    this.nominatimEnabled = process.env.NOMINATIM_GEOCODER_ENABLED === 'true';
    this.nominatimBaseUrl = cleanText(process.env.NOMINATIM_BASE_URL) ?? DEFAULT_NOMINATIM_URL;
    this.nominatimUserAgent = cleanText(process.env.NOMINATIM_USER_AGENT);
    this.nominatimRateLimitMs = nonNegativeInt(
      process.env.NOMINATIM_RATE_LIMIT_MS,
      DEFAULT_NOMINATIM_RATE_LIMIT_MS,
    );
  }

  static resetNominatimStateForTests() {
    VenueGeocoderClient.nominatimCache.clear();
    VenueGeocoderClient.lastNominatimRequestAt = 0;
    VenueGeocoderClient.nominatimStoppedForRun = false;
  }

  async geocode(input: VenueGeocodeInput): Promise<VenueGeocodeResult | null> {
    try {
      return await this.geocodeOrThrow(input);
    } catch {
      return null;
    }
  }

  async geocodeOrThrow(input: VenueGeocodeInput): Promise<VenueGeocodeResult | null> {
    const nominatimResult = await this.geocodeWithNominatim(input);
    if (nominatimResult) {
      return nominatimResult;
    }
    const query = geocodeQuery(input);
    if (!query) {
      return null;
    }
    if (!this.apiKey) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    timeout.unref?.();
    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set('apikey', this.apiKey);
      url.searchParams.set('geocode', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('lang', 'ru_RU');
      url.searchParams.set('results', '1');

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        if (response.status === 403 || response.status === 429) {
          throw new VenueGeocoderHttpError(response.status);
        }
        return null;
      }
      return highConfidenceResult(
        await response.json(),
        input.city,
        query,
        cleanText(input.address) != null,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async geocodeWithNominatim(input: VenueGeocodeInput): Promise<VenueGeocodeResult | null> {
    if (!this.nominatimEnabled || VenueGeocoderClient.nominatimStoppedForRun) {
      return null;
    }
    const city = cleanText(input.city);
    const venueName = cleanText(input.venueName);
    const address = cleanText(input.address);
    if (!city || !venueName || address || !this.nominatimUserAgent) {
      return null;
    }

    const query = `${city}, ${venueName}`;
    const cacheKey = normalizedCacheKey(query);
    if (VenueGeocoderClient.nominatimCache.has(cacheKey)) {
      return VenueGeocoderClient.nominatimCache.get(cacheKey) ?? null;
    }

    await this.waitForNominatimSlot();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    timeout.unref?.();
    try {
      const url = new URL(this.nominatimBaseUrl);
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('limit', '5');
      url.searchParams.set('countrycodes', 'ru');
      const viewbox = nominatimViewbox(city);
      if (viewbox) {
        url.searchParams.set('viewbox', viewbox);
        url.searchParams.set('bounded', '1');
      }

      VenueGeocoderClient.lastNominatimRequestAt = Date.now();
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': this.nominatimUserAgent,
        },
      });
      if (!response.ok) {
        if (response.status === 403 || response.status === 429) {
          VenueGeocoderClient.nominatimStoppedForRun = true;
          throw new VenueGeocoderHttpError(response.status);
        }
        VenueGeocoderClient.nominatimCache.set(cacheKey, null);
        return null;
      }

      const result = nominatimResult(await response.json(), city, venueName, query);
      VenueGeocoderClient.nominatimCache.set(cacheKey, result);
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async waitForNominatimSlot() {
    if (this.nominatimRateLimitMs <= 0 || VenueGeocoderClient.lastNominatimRequestAt <= 0) {
      return;
    }
    const elapsed = Date.now() - VenueGeocoderClient.lastNominatimRequestAt;
    const waitMs = this.nominatimRateLimitMs - elapsed;
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

function geocodeQuery(input: VenueGeocodeInput) {
  const city = cleanText(input.city);
  const address = cleanText(input.address);
  const venueName = cleanText(input.venueName);
  if (!city) {
    return null;
  }
  if (address) {
    return `${city}, ${address}`;
  }
  if (venueName) {
    return `${city}, ${venueName}`;
  }
  return null;
}

function highConfidenceResult(
  payload: unknown,
  city: string,
  query: string,
  hasAddress: boolean,
): VenueGeocodeResult | null {
  const collection = object(object(object(payload)?.response)?.GeoObjectCollection);
  const members = array(collection?.featureMember);
  const geoObject = object(object(members[0])?.GeoObject);
  const point = cleanText(object(geoObject?.Point)?.pos);
  const [lng, lat] = parsePoint(point);
  if (lat == null || lng == null || !withinCity(city, lat, lng)) {
    return null;
  }

  const meta = object(object(geoObject?.metaDataProperty)?.GeocoderMetaData);
  const precision = cleanText(meta?.precision);
  const kind = cleanText(meta?.kind);
  if (!isHighConfidence(precision, kind, hasAddress)) {
    return null;
  }

  return {
    address: cleanText(meta?.text),
    lat,
    lng,
    provider: 'yandex',
    query,
    precision,
    kind,
  };
}

function nominatimResult(
  payload: unknown,
  city: string,
  venueName: string,
  query: string,
): VenueGeocodeResult | null {
  for (const item of array(payload)) {
    const value = object(item);
    if (!value) {
      continue;
    }
    const lat = numberFromString(value.lat);
    const lng = numberFromString(value.lon);
    if (lat == null || lng == null || !withinCity(city, lat, lng)) {
      continue;
    }

    const category = cleanText(value.category);
    const type = cleanText(value.type);
    const addresstype = cleanText(value.addresstype);
    const displayName = cleanText(value.display_name);
    const name = cleanText(value.name) ?? displayName;
    if (!isNominatimPlaceLike(category, type, addresstype) || !nameLooksSimilar(venueName, name)) {
      continue;
    }

    return {
      address: displayName,
      lat,
      lng,
      provider: 'nominatim',
      query,
      precision: null,
      kind: type,
      osmType: cleanText(value.osm_type),
      osmId: numberFromUnknown(value.osm_id),
      category,
      type,
      importance: numberFromUnknown(value.importance),
      displayName,
    };
  }
  return null;
}

function isNominatimPlaceLike(
  category: string | null,
  type: string | null,
  addresstype: string | null,
) {
  const normalizedCategory = category?.toLowerCase() ?? '';
  const normalizedType = type?.toLowerCase() ?? '';
  const normalizedAddressType = addresstype?.toLowerCase() ?? '';
  if ([
    'city',
    'district',
    'locality',
    'municipality',
    'neighbourhood',
    'quarter',
    'region',
    'road',
    'state',
    'street',
    'suburb',
    'town',
    'village',
  ].includes(normalizedType) || [
    'city',
    'district',
    'locality',
    'road',
    'street',
    'suburb',
  ].includes(normalizedAddressType)) {
    return false;
  }
  return ['amenity', 'tourism', 'leisure', 'building'].includes(normalizedCategory);
}

function nameLooksSimilar(venueName: string, resultName: string | null) {
  const venueTokens = normalizedTokens(venueName);
  const resultTokens = normalizedTokens(resultName);
  if (venueTokens.length === 0 || resultTokens.length === 0) {
    return false;
  }
  const resultSet = new Set(resultTokens);
  const matched = venueTokens.filter((token) => resultSet.has(token)).length;
  return matched >= Math.min(2, venueTokens.length) || matched / venueTokens.length >= 0.5;
}

function normalizedTokens(value: string | null) {
  return (value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function normalizedCacheKey(value: string) {
  return normalizedTokens(value).join(' ');
}

function nominatimViewbox(city: string) {
  const bbox = bboxForContentCity(city);
  if (!bbox) {
    return null;
  }
  const [south, west, north, east] = bbox.split(',').map((value) => Number.parseFloat(value));
  if (![south, west, north, east].every((value) => Number.isFinite(value))) {
    return null;
  }
  return `${west},${north},${east},${south}`;
}

function isHighConfidence(precision: string | null, kind: string | null, hasAddress: boolean) {
  const normalizedPrecision = precision?.toLowerCase() ?? '';
  const normalizedKind = kind?.toLowerCase() ?? '';
  if (['country', 'province', 'area', 'district', 'locality', 'other'].includes(normalizedKind)) {
    return false;
  }
  if (!hasAddress) {
    return ['exact', 'number', 'near'].includes(normalizedPrecision)
      && ['house', 'metro'].includes(normalizedKind);
  }
  if (['exact', 'number', 'range', 'near'].includes(normalizedPrecision)) {
    return true;
  }
  return ['house', 'street', 'metro'].includes(normalizedKind);
}

function withinCity(city: string, lat: number, lng: number) {
  const bbox = bboxForContentCity(city);
  if (!bbox) {
    return true;
  }
  const values = bbox.split(',').map((value) => Number.parseFloat(value));
  if (values.length !== 4) {
    return false;
  }
  const [south, west, north, east] = values;
  if (
    south == null ||
    west == null ||
    north == null ||
    east == null ||
    !Number.isFinite(south) ||
    !Number.isFinite(west) ||
    !Number.isFinite(north) ||
    !Number.isFinite(east)
  ) {
    return false;
  }
  return lat >= south
    && lat <= north
    && lng >= west
    && lng <= east;
}

function parsePoint(value: string | null): [number | null, number | null] {
  if (!value) {
    return [null, null];
  }
  const [lngRaw, latRaw] = value.split(/\s+/);
  if (!lngRaw || !latRaw) {
    return [null, null];
  }
  const lng = Number.parseFloat(lngRaw);
  const lat = Number.parseFloat(latRaw);
  return [
    Number.isFinite(lng) ? lng : null,
    Number.isFinite(lat) ? lat : null,
  ];
}

function numberFromString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberFromUnknown(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseFloat(value)
      : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function object(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function array(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function positiveInt(value: unknown, fallback: number) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseInt(value, 10)
      : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInt(value: unknown, fallback: number) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseInt(value, 10)
      : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
