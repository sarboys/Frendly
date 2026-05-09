import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { ExternalPriceMode, ExternalRawItem, NormalizedExternalContentItem } from './content-source.types';

const CATEGORY_MAP: Record<string, string> = {
  cafe: 'food',
  bar: 'bar',
  pub: 'bar',
  bistro: 'food',
  gastropub: 'bar',
  karaoke: 'active',
  restaurant: 'food',
  restaurants: 'food',
  anticafe: 'cafe',
  quest: 'quest',
  quests: 'quest',
  questroom: 'quest',
  standup: 'comedy',
  stand_up: 'comedy',
  comedy: 'comedy',
  comedy_club: 'comedy',
  quiz: 'quiz',
  theatre: 'theatre',
  theater: 'theatre',
  concert: 'concert',
  concert_hall: 'concert',
  workshop: 'workshop',
  workshops: 'workshop',
  market: 'market',
  rynok: 'market',
  festival: 'festival',
  cinema: 'cinema',
  spa: 'spa',
  salons: 'spa',
  entertainment: 'active',
  amusement: 'active',
  recreation: 'sport',
  dance_studio: 'sport',
  bicycle: 'bike',
  bike: 'bike',
  bicycle_rental: 'bike',
  cycling: 'bike',
  quadbike: 'adventure',
  quad_bike: 'adventure',
  atv: 'adventure',
  stable: 'adventure',
  outdoor: 'outdoor',
  nature: 'outdoor',
  picnic_site: 'outdoor',
  viewpoint: 'outdoor',
  prirodnyj_zapovednik: 'outdoor',
  museum: 'culture',
  museums: 'culture',
  gallery: 'culture',
  art_centers: 'culture',
  art_space: 'culture',
  culture: 'culture',
  homesteads: 'culture',
  library: 'culture',
  observatory: 'culture',
  palace: 'culture',
  attractions: 'culture',
  sights: 'culture',
  exhibition: 'culture',
  park: 'walk',
  bridge: 'walk',
  fountain: 'walk',
  photo_places: 'walk',
  suburb: 'outdoor',
  sports_centre: 'sport',
  lecture: 'lecture',
  education: 'lecture',
  'комедии': 'comedy',
  'драмы': 'theatre',
  'балет': 'theatre',
  'рок': 'concert',
  'джаз': 'concert',
  'пешеходные_экскурсии': 'walk',
  'автобусные_экскурсии': 'culture',
  'детям': 'culture',
};

@Injectable()
export class ContentNormalizerService {
  normalize(raw: ExternalRawItem): NormalizedExternalContentItem {
    const title = cleanText(raw.title);
    if (!title) {
      throw new Error('content_title_missing');
    }
    const categoryKey = normalizeKey(raw.category ?? raw.contentKind);
    const lat = coordinate(raw.lat, -90, 90);
    const lng = coordinate(raw.lng, -180, 180);
    const priceFrom = integer(raw.priceFrom);
    const normalized: Omit<NormalizedExternalContentItem, 'normalizedHash'> = {
      sourceCode: raw.sourceCode,
      sourceItemId: raw.sourceItemId,
      sourceUrl: cleanText(raw.sourceUrl) ?? null,
      contentKind: raw.contentKind,
      city: cleanText(raw.city) ?? raw.city,
      timezone: cleanText(raw.timezone) ?? 'Europe/Moscow',
      area: null,
      title,
      shortSummary: cleanText(raw.description, 280),
      category: CATEGORY_MAP[categoryKey] ?? categoryKey,
      tags: (raw.tags ?? []).map((tag) => cleanText(tag)).filter((tag): tag is string => tag != null),
      address: cleanText(raw.address),
      lat,
      lng,
      startsAt: validDate(raw.startsAt),
      endsAt: validDate(raw.endsAt),
      priceFrom,
      currency: cleanText(raw.currency),
      venueName: cleanText(raw.venueName),
      imageUrl: cleanText(raw.imageUrl, 1000),
      actionUrl: cleanText(raw.actionUrl, 1000),
      actionKind: cleanText(raw.actionKind),
      priceMode: priceMode(raw.priceMode, priceFrom),
      isAffiliate: raw.isAffiliate === true,
      sourceProvider: cleanText(raw.sourceProvider),
      placeKind: cleanText(raw.placeKind),
      lastSeenAt: validDate(raw.lastSeenAt) ?? new Date(),
      raw: raw.raw,
      expiresAt: expiresAt(raw),
    };

    return {
      ...normalized,
      normalizedHash: this.hash(normalized),
    };
  }

  private hash(item: Omit<NormalizedExternalContentItem, 'normalizedHash'>) {
    return createHash('sha1')
      .update([
        item.city.toLowerCase(),
        normalizeTitle(item.title),
        item.contentKind,
        item.lat == null ? '' : item.lat.toFixed(3),
        item.lng == null ? '' : item.lng.toFixed(3),
      ].join('|'))
      .digest('hex');
  }
}

export function normalizeTitle(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function cleanText(value: unknown, maxLength = 500) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength).trim() : trimmed;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[-\s]+/g, '_');
}

function coordinate(value: unknown, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value >= min && value <= max ? value : null;
}

function integer(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.floor(value));
}

function priceMode(explicit: ExternalPriceMode | null | undefined, priceFrom: number | null): ExternalPriceMode {
  if (explicit === 'free' || explicit === 'paid' || explicit === 'unknown') {
    return explicit;
  }
  if (priceFrom === 0) {
    return 'free';
  }
  if (priceFrom != null && priceFrom > 0) {
    return 'paid';
  }
  return 'unknown';
}

function validDate(value: unknown) {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : null;
}

function expiresAt(raw: ExternalRawItem) {
  const endsAt = validDate(raw.endsAt);
  if (endsAt) {
    return endsAt;
  }
  const startsAt = validDate(raw.startsAt);
  if (!startsAt) {
    return null;
  }
  return new Date(startsAt.getTime() + 24 * 60 * 60 * 1000);
}
