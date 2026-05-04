import { Injectable } from '@nestjs/common';
import type { NormalizedExternalContentItem } from './content-source.types';
import { normalizeTitle } from './content-normalizer.service';

export type DuplicateGroup = {
  key: string;
  items: NormalizedExternalContentItem[];
};

export type EventDuplicateMatch = {
  confidence: 'high' | 'medium' | 'low';
  key: string;
};

@Injectable()
export class ContentDeduplicationService {
  groupDuplicates(items: NormalizedExternalContentItem[]): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];
    for (const item of items) {
      const group = groups.find((candidate) => this.belongsToGroup(item, candidate));
      if (group) {
        group.items.push(item);
      } else {
        groups.push({ key: this.groupKey(item), items: [item] });
      }
    }
    return groups;
  }

  private belongsToGroup(item: NormalizedExternalContentItem, group: DuplicateGroup) {
    const first = group.items[0];
    if (!first || item.city !== first.city || item.contentKind !== first.contentKind) {
      return false;
    }
    if (item.contentKind === 'event') {
      return eventDuplicateMatch(item, first).confidence !== 'low';
    }
    if (normalizeTitle(item.title) !== normalizeTitle(first.title)) {
      return false;
    }
    if (item.lat != null && item.lng != null && first.lat != null && first.lng != null) {
      return distanceMeters(item.lat, item.lng, first.lat, first.lng) < 80;
    }
    return item.normalizedHash === first.normalizedHash;
  }

  private groupKey(item: NormalizedExternalContentItem) {
    return item.contentKind === 'event'
      ? eventDuplicateKey(item)
      : [
          item.city,
          item.contentKind,
          normalizeTitle(item.title),
          item.normalizedHash,
        ].join('|');
  }
}

export function eventDuplicateKey(item: Pick<NormalizedExternalContentItem, 'city' | 'contentKind' | 'title' | 'startsAt' | 'venueName'>) {
  return [
    item.city,
    item.contentKind,
    normalizeTitle(item.title),
    dayKey(item.startsAt),
    normalizeVenue(item.venueName),
  ].join('|');
}

export function eventDuplicateMatch(
  left: Pick<NormalizedExternalContentItem, 'city' | 'contentKind' | 'title' | 'startsAt' | 'venueName'>,
  right: Pick<NormalizedExternalContentItem, 'city' | 'contentKind' | 'title' | 'startsAt' | 'venueName'>,
): EventDuplicateMatch {
  const key = eventDuplicateKey(left);
  if (
    left.contentKind !== 'event' ||
    right.contentKind !== 'event' ||
    left.city !== right.city ||
    normalizeTitle(left.title) !== normalizeTitle(right.title) ||
    dayKey(left.startsAt) !== dayKey(right.startsAt)
  ) {
    return { confidence: 'low', key };
  }

  const leftVenue = normalizeVenue(left.venueName);
  const rightVenue = normalizeVenue(right.venueName);
  if (leftVenue && rightVenue && leftVenue === rightVenue) {
    return { confidence: 'high', key };
  }
  if (leftVenue && rightVenue && (leftVenue.includes(rightVenue) || rightVenue.includes(leftVenue))) {
    return { confidence: 'medium', key };
  }
  return { confidence: leftVenue || rightVenue ? 'medium' : 'high', key };
}

export function dayKey(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : 'no-date';
}

function normalizeVenue(value: string | null | undefined) {
  return value ? normalizeTitle(value).replace(/[«»"']/g, '').trim() : '';
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadiusMeters = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(value: number) {
  return value * Math.PI / 180;
}
