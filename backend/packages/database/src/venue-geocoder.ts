import { bboxForContentCity } from './content-city-catalog';

const DEFAULT_YANDEX_GEOCODER_URL = 'https://geocode-maps.yandex.ru/1.x/';
const DEFAULT_NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const DEFAULT_NOMINATIM_RATE_LIMIT_MS = 1200;
const DEFAULT_TIMEOUT_MS = 2500;

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
  osmId?: number | string | null;
  category?: string | null;
  type?: string | null;
  importance?: number | null;
  displayName?: string | null;
};

type VenueGeocoderClientOptions = {
  apiKey?: string | null;
  baseUrl?: string | null;
  timeoutMs?: number | null;
  nominatimEnabled?: boolean | string | null;
  nominatimBaseUrl?: string | null;
  nominatimUserAgent?: string | null;
  nominatimRateLimitMs?: number | string | null;
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
  private static readonly nominatimCache = new Map<string, Promise<VenueGeocodeResult | null>>();
  private static nominatimNextRequestAt = 0;

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
    this.nominatimEnabled = booleanFlag(
      options.nominatimEnabled ?? process.env.NOMINATIM_GEOCODER_ENABLED,
      false,
    );
    this.nominatimBaseUrl = cleanText(options.nominatimBaseUrl ?? process.env.NOMINATIM_BASE_URL)
      ?? DEFAULT_NOMINATIM_URL;
    this.nominatimUserAgent = cleanText(
      options.nominatimUserAgent ?? process.env.NOMINATIM_USER_AGENT,
    );
    this.nominatimRateLimitMs = positiveInt(
      options.nominatimRateLimitMs ?? process.env.NOMINATIM_RATE_LIMIT_MS,
      DEFAULT_NOMINATIM_RATE_LIMIT_MS,
    );
  }

  static resetNominatimStateForTests() {
    VenueGeocoderClient.nominatimCache.clear();
    VenueGeocoderClient.nominatimNextRequestAt = 0;
  }

  async geocode(input: VenueGeocodeInput): Promise<VenueGeocodeResult | null> {
    try {
      return await this.geocodeOrThrow(input);
    } catch {
      return null;
    }
  }

  async geocodeOrThrow(input: VenueGeocodeInput): Promise<VenueGeocodeResult | null> {
    const nominatim = await this.geocodeWithNominatim(input);
    if (nominatim) {
      return nominatim;
    }
    return this.geocodeWithYandex(input);
  }

  private async geocodeWithYandex(input: VenueGeocodeInput): Promise<VenueGeocodeResult | null> {
    if (!this.apiKey) {
      return null;
    }
    const query = geocodeQuery(input);
    if (!query) {
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

  private geocodeWithNominatim(input: VenueGeocodeInput): Promise<VenueGeocodeResult | null> {
    const query = nominatimQuery(input);
    if (!this.nominatimEnabled || !this.nominatimUserAgent || !query) {
      return Promise.resolve(null);
    }

    const key = nominatimCacheKey(input.city, input.venueName);
    const cached = VenueGeocoderClient.nominatimCache.get(key);
    if (cached) {
      return cached;
    }

    const load = this.fetchNominatim(query, input.city, input.venueName)
      .catch((caught) => {
        VenueGeocoderClient.nominatimCache.delete(key);
        throw caught;
      });
    VenueGeocoderClient.nominatimCache.set(key, load);
    return load;
  }

  private async fetchNominatim(
    query: string,
    city: string,
    venueName: string | null,
  ): Promise<VenueGeocodeResult | null> {
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
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('accept-language', 'ru');

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': this.nominatimUserAgent ?? '',
        },
      });
      if (!response.ok) {
        if (response.status === 403 || response.status === 429) {
          throw new VenueGeocoderHttpError(response.status);
        }
        return null;
      }
      return highConfidenceNominatimResult(
        await response.json(),
        city,
        query,
        venueName,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async waitForNominatimSlot() {
    const now = Date.now();
    const waitMs = Math.max(0, VenueGeocoderClient.nominatimNextRequestAt - now);
    VenueGeocoderClient.nominatimNextRequestAt = now + waitMs + this.nominatimRateLimitMs;
    if (waitMs > 0) {
      await sleep(waitMs);
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

function nominatimQuery(input: VenueGeocodeInput) {
  const city = cleanText(input.city);
  const venueName = cleanText(input.venueName);
  if (!city || !venueName) {
    return null;
  }
  return `${city}, ${venueName}`;
}

function highConfidenceNominatimResult(
  payload: unknown,
  city: string,
  query: string,
  venueName: string | null,
): VenueGeocodeResult | null {
  const rows = array(payload);
  for (const rowRaw of rows) {
    const row = object(rowRaw);
    if (!row) {
      continue;
    }
    const lat = optionalFloat(row.lat);
    const lng = optionalFloat(row.lon);
    if (lat == null || lng == null || !withinCity(city, lat, lng)) {
      continue;
    }

    const category = cleanText(row.category);
    const type = cleanText(row.type);
    const addresstype = cleanText(row.addresstype);
    const displayName = cleanText(row.display_name);
    const name = cleanText(row.name) ?? firstDisplayNamePart(displayName);
    if (!isNominatimPlaceLike(category, type, addresstype)) {
      continue;
    }
    if (!isVenueNameMatch(venueName, name, displayName)) {
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
      osmType: cleanText(row.osm_type),
      osmId: optionalNumberOrString(row.osm_id),
      category,
      type,
      importance: optionalFloat(row.importance),
      displayName,
    };
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

function isNominatimPlaceLike(
  category: string | null,
  type: string | null,
  addresstype: string | null,
) {
  const normalizedCategory = category?.toLowerCase() ?? '';
  const normalizedType = type?.toLowerCase() ?? '';
  const normalizedAddressType = addresstype?.toLowerCase() ?? '';
  if (!['amenity', 'tourism', 'leisure', 'building'].includes(normalizedCategory)) {
    return false;
  }
  const blockedTypes = new Set([
    'administrative',
    'apartments',
    'borough',
    'city',
    'county',
    'district',
    'locality',
    'municipality',
    'neighbourhood',
    'quarter',
    'region',
    'residential',
    'road',
    'state',
    'street',
    'suburb',
    'town',
    'village',
  ]);
  return !blockedTypes.has(normalizedType) && !blockedTypes.has(normalizedAddressType);
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

function isVenueNameMatch(
  venueName: string | null,
  resultName: string | null,
  displayName: string | null,
) {
  const venue = cleanText(venueName);
  const result = cleanText([resultName, firstDisplayNamePart(displayName)].filter(Boolean).join(' '));
  if (!venue || !result) {
    return false;
  }
  if (isResidentialComplexText(result)) {
    return false;
  }
  const normalizedVenue = normalizeNameText(venue);
  const normalizedResult = normalizeNameText(result);
  if (normalizedResult.includes(normalizedVenue) || normalizedVenue.includes(normalizedResult)) {
    return true;
  }

  const venueTokens = distinctiveTokens(venue);
  const resultTokens = distinctiveTokens(result);
  if (venueTokens.length === 0 || resultTokens.length === 0) {
    return false;
  }
  const matches = venueTokens.filter((token) => resultTokens.some((candidate) => sameToken(token, candidate)));
  return matches.length >= Math.min(2, venueTokens.length);
}

function distinctiveTokens(value: string) {
  const stopWords = new Set([
    'cafe',
    'club',
    'concert',
    'nightclub',
    'restaurant',
    'theatre',
    'бар',
    'дом',
    'дворец',
    'кафе',
    'клуб',
    'концерт',
    'концертный',
    'московский',
    'музыки',
    'на',
    'ресторан',
    'театр',
    'центр',
  ]);
  return normalizeNameText(value)
    .split(' ')
    .filter((token) => token.length >= 2 && !stopWords.has(token));
}

function sameToken(left: string, right: string) {
  if (left === right) {
    return true;
  }
  const minLength = Math.min(left.length, right.length);
  return minLength >= 5 && left.slice(0, minLength - 1) === right.slice(0, minLength - 1);
}

function normalizeNameText(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^0-9a-zа-я]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isResidentialComplexText(value: string) {
  const normalized = normalizeNameText(value);
  return normalized.includes('жилой комплекс') || normalized.split(' ').includes('жк');
}

function firstDisplayNamePart(value: string | null) {
  return cleanText(value?.split(',')[0]);
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

function object(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function array(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function optionalFloat(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseFloat(value)
      : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalNumberOrString(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return cleanText(value);
  }
  return null;
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

function booleanFlag(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'string') {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function nominatimCacheKey(city: string, venueName: string | null) {
  return [
    normalizeNameText(city),
    normalizeNameText(venueName ?? ''),
  ].join('|');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
