import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

export type PlaceSearchInput = {
  q: string;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  limit?: number | null;
};

export type PlacePromoDto = {
  title: string;
  description: string | null;
  validUntil: string | null;
  bookingUrl: string | null;
  sourceUrl: string | null;
};

const DEFAULT_CITY = 'Москва';
const MAX_LIMIT = 20;
const DEFAULT_LIMIT = 10;
const RAW_CANDIDATE_LIMIT = 100;

@Injectable()
export class PlacesService {
  constructor(private readonly prismaService: PrismaService) {}

  async searchPlaces(input: PlaceSearchInput) {
    const q = input.q.trim();
    const city = input.city?.trim() || DEFAULT_CITY;
    const limit = normalizeLimit(input.limit);
    const hasCoords = isFiniteNumber(input.latitude) && isFiniteNumber(input.longitude);

    if (q.length < 2) {
      console.warn('[places] search query too short', { city, length: q.length });
      throw new ApiError(400, 'place_search_query_too_short', 'Search query is too short');
    }
    if (city !== DEFAULT_CITY) {
      console.warn('[places] unsupported city', { city });
      return [];
    }

    console.debug('[places] search requested', { q, city, limit, hasCoords });
    const query = q.toLowerCase();
    const tagQuery = normalizeTagQuery(q);
    const places = await this.prismaService.client.externalContentItem.findMany({
      where: {
        source: { code: 'tomesto' },
        contentKind: 'place',
        publicStatus: 'published',
        city,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { address: { contains: q, mode: 'insensitive' } },
          { venueName: { contains: q, mode: 'insensitive' } },
          ...(tagQuery ? [{ tags: { array_contains: [tagQuery] } as any }] : []),
        ],
      },
      select: {
        id: true,
        sourceId: true,
        sourceUrl: true,
        title: true,
        address: true,
        city: true,
        category: true,
        placeKind: true,
        tags: true,
        lat: true,
        lng: true,
        priceFrom: true,
        currency: true,
        actionUrl: true,
        sourceProvider: true,
        raw: true,
        source: {
          select: { code: true, name: true },
        },
      },
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
      take: RAW_CANDIDATE_LIMIT,
    });

    const scored = places
      .map((place: any) => ({
        place,
        score: placeSearchScore(place, query, input.latitude, input.longitude),
      }))
      .filter((entry) => entry.score < 1000)
      .sort((left, right) => left.score - right.score)
      .slice(0, limit);
    const promosByPlaceId = await this.loadPromosForPlaces(scored.map((entry) => entry.place));

    const result = scored.map(({ place }) =>
      mapPlaceSearchResult(
        place,
        promosByPlaceId.get(place.id) ?? [],
        input.latitude,
        input.longitude,
      ),
    );
    console.info('[places] search completed', { city, resultCount: result.length });
    return result;
  }

  private async loadPromosForPlaces(places: any[]) {
    const byPlaceId = new Map<string, PlacePromoDto[]>();
    if (places.length === 0) {
      return byPlaceId;
    }
    const now = new Date();
    const sourceIds = [...new Set(places.map((place) => place.sourceId).filter(isString))];
    const promos = await this.prismaService.client.externalContentItem.findMany({
      where: {
        sourceId: { in: sourceIds },
        city: DEFAULT_CITY,
        contentKind: 'event',
        category: 'promo',
        OR: [
          { endsAt: null },
          { endsAt: { gte: now } },
        ],
      },
      select: {
        id: true,
        title: true,
        shortSummary: true,
        startsAt: true,
        endsAt: true,
        actionUrl: true,
        sourceUrl: true,
        raw: true,
      },
      orderBy: [{ endsAt: 'asc' }, { importedAt: 'desc' }, { id: 'asc' }],
      take: Math.max(places.length * 6, 12),
    });

    for (const place of places) {
      const matched = promos
        .filter((promo: any) => promoMatchesPlace(promo, place))
        .slice(0, 3)
        .map(mapPromoDto);
      if (matched.length > 0) {
        byPlaceId.set(place.id, matched);
      }
      console.debug('[places] promo match result', {
        placeId: place.id,
        strategy: placeSlug(place) ? 'slug' : 'title_address',
        promoCount: matched.length,
      });
    }
    return byPlaceId;
  }
}

export function mapPromoDto(promo: {
  title: string;
  shortSummary?: string | null;
  endsAt?: Date | null;
  actionUrl?: string | null;
  sourceUrl?: string | null;
}): PlacePromoDto {
  return {
    title: promo.title,
    description: promo.shortSummary ?? null,
    validUntil: promo.endsAt?.toISOString() ?? null,
    bookingUrl: promo.actionUrl ?? null,
    sourceUrl: promo.sourceUrl ?? null,
  };
}

function mapPlaceSearchResult(
  place: any,
  promos: PlacePromoDto[],
  latitude?: number | null,
  longitude?: number | null,
) {
  return {
    id: place.id,
    name: place.title,
    address: place.address ?? '',
    city: place.city,
    lat: place.lat ?? null,
    lng: place.lng ?? null,
    category: place.category,
    placeKind: place.placeKind ?? place.category,
    averageCheck: place.priceFrom ?? null,
    currency: place.currency ?? null,
    rating: ratingFromRaw(place.raw),
    bookingUrl: place.actionUrl ?? null,
    provider: place.sourceProvider ?? place.source?.name ?? null,
    sourceUrl: place.sourceUrl ?? null,
    distanceKm: distanceKm(latitude, longitude, place.lat, place.lng),
    promos,
  };
}

function placeSearchScore(
  place: any,
  query: string,
  latitude?: number | null,
  longitude?: number | null,
) {
  const title = normalizeText(place.title);
  const address = normalizeText(place.address);
  const tags = Array.isArray(place.tags) ? place.tags.map(normalizeText).join(' ') : '';
  let score = 1000;
  if (title.startsWith(query)) {
    score = 0;
  } else if (title.includes(query)) {
    score = 20;
  } else if (address.includes(query)) {
    score = 50;
  } else if (tags.includes(query)) {
    score = 80;
  }

  const distance = distanceKm(latitude, longitude, place.lat, place.lng);
  if (distance != null) {
    score += Math.min(distance, 25);
  }
  return score;
}

export function promoMatchesPlace(promo: any, place: any) {
  const promoRaw = asRecord(promo.raw);
  const promoSlug = text(promoRaw.placeSlug);
  const slug = placeSlug(place);
  if (promoSlug && slug) {
    return normalizeText(promoSlug) === normalizeText(slug);
  }
  const promoVenue = normalizeText(text(promoRaw.venueName) ?? '');
  const placeTitle = normalizeText(place.title);
  const promoAddress = normalizeText(text(promoRaw.address) ?? '');
  const placeAddress = normalizeText(place.address ?? '');
  return (
    promoVenue.length > 0 &&
    promoVenue === placeTitle &&
    (promoAddress.length === 0 || placeAddress.includes(promoAddress) || promoAddress.includes(placeAddress))
  );
}

function placeSlug(place: any) {
  return text(asRecord(place.raw).slug);
}

function ratingFromRaw(raw: unknown) {
  const rating = asRecord(raw).rating;
  return typeof rating === 'number' && Number.isFinite(rating) ? rating : null;
}

function normalizeLimit(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.max(Math.trunc(value), 1), MAX_LIMIT);
}

function distanceKm(
  fromLat?: number | null,
  fromLng?: number | null,
  toLat?: number | null,
  toLng?: number | null,
) {
  if (!isFiniteNumber(fromLat) || !isFiniteNumber(fromLng) || !isFiniteNumber(toLat) || !isFiniteNumber(toLng)) {
    return null;
  }
  const earthRadiusKm = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : '';
}

function normalizeTagQuery(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  return normalized.length > 0 ? normalized : null;
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
