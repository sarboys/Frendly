import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { ExternalRawItem, NormalizedExternalContentItem } from './content-source.types';

const CATEGORY_MAP: Record<string, string> = {
  cafe: 'food',
  bar: 'bar',
  pub: 'bar',
  restaurant: 'food',
  quest: 'quest',
  quests: 'quest',
  standup: 'comedy',
  stand_up: 'comedy',
  comedy: 'comedy',
  quiz: 'quiz',
  theatre: 'theatre',
  theater: 'theatre',
  concert: 'concert',
  workshop: 'workshop',
  market: 'market',
  festival: 'festival',
  cinema: 'cinema',
  spa: 'spa',
  entertainment: 'active',
  museum: 'culture',
  gallery: 'culture',
  park: 'walk',
  sports_centre: 'sport',
  lecture: 'lecture',
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
      priceFrom: integer(raw.priceFrom),
      currency: cleanText(raw.currency),
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
