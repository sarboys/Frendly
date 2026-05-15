import { Injectable } from '@nestjs/common';
import { overpassBboxForCity } from './supported-cities';

const DEFAULT_YANDEX_GEOCODER_URL = 'https://geocode-maps.yandex.ru/1.x/';
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
  provider: 'yandex';
  query: string;
  precision: string | null;
  kind: string | null;
};

@Injectable()
export class ContentVenueGeocoderService {
  private readonly apiKey = cleanText(
    process.env.YANDEX_GEOCODER_API_KEY
      ?? process.env.CONTENT_GEOCODER_API_KEY,
  );
  private readonly baseUrl = cleanText(process.env.YANDEX_GEOCODER_BASE_URL)
    ?? DEFAULT_YANDEX_GEOCODER_URL;
  private readonly timeoutMs = positiveInt(
    process.env.CONTENT_GEOCODER_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  );

  async geocode(input: VenueGeocodeInput): Promise<VenueGeocodeResult | null> {
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
        return null;
      }
      return highConfidenceResult(
        await response.json(),
        input.city,
        query,
        cleanText(input.address) != null,
      );
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
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
  const bbox = overpassBboxForCity(city);
  if (!bbox) {
    return true;
  }
  const values = bbox.split(',').map((value) => Number.parseFloat(value));
  if (values.length !== 4) {
    return false;
  }
  const south = values[0];
  const west = values[1];
  const north = values[2];
  const east = values[3];
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

function cleanText(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function positiveInt(value: unknown, fallback: number) {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
