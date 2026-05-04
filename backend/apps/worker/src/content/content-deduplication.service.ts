import { Injectable } from '@nestjs/common';
import type { NormalizedExternalContentItem } from './content-source.types';
import { normalizeTitle } from './content-normalizer.service';

export type DuplicateGroup = {
  key: string;
  items: NormalizedExternalContentItem[];
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
    if (normalizeTitle(item.title) !== normalizeTitle(first.title)) {
      return false;
    }
    if (item.contentKind === 'event') {
      return dayKey(item.startsAt) === dayKey(first.startsAt);
    }
    if (item.lat != null && item.lng != null && first.lat != null && first.lng != null) {
      return distanceMeters(item.lat, item.lng, first.lat, first.lng) < 80;
    }
    return item.normalizedHash === first.normalizedHash;
  }

  private groupKey(item: NormalizedExternalContentItem) {
    return [
      item.city,
      item.contentKind,
      normalizeTitle(item.title),
      item.contentKind === 'event' ? dayKey(item.startsAt) : item.normalizedHash,
    ].join('|');
  }
}

function dayKey(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : 'no-date';
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
