import type { ExternalRawItem, ExternalSourceAdapter, ExternalSourceFetchInput } from './content-source.types';

const MAX_ITEMS_PER_RUN = 1200;

const CITY_BBOX: Record<string, string> = {
  'Москва': '55.55,37.35,55.95,37.95',
  'Санкт-Петербург': '59.75,30.05,60.10,30.65',
};

const TAGS = [
  ['amenity', 'cafe'],
  ['amenity', 'bar'],
  ['amenity', 'restaurant'],
  ['tourism', 'museum'],
  ['tourism', 'gallery'],
  ['leisure', 'park'],
  ['leisure', 'sports_centre'],
  ['leisure', 'pitch'],
  ['leisure', 'track'],
  ['leisure', 'swimming_pool'],
  ['leisure', 'ice_rink'],
  ['leisure', 'marina'],
  ['tourism', 'viewpoint'],
  ['tourism', 'picnic_site'],
  ['tourism', 'attraction'],
  ['amenity', 'bicycle_rental'],
  ['shop', 'bicycle'],
  ['route', 'bicycle'],
] as const;

export class OverpassAdapter implements ExternalSourceAdapter {
  readonly code = 'overpass' as const;
  private readonly baseUrl = process.env.OVERPASS_BASE_URL ?? 'https://overpass-api.de/api/interpreter';

  async fetchItems(input: ExternalSourceFetchInput): Promise<ExternalRawItem[]> {
    const bbox = CITY_BBOX[input.city];
    if (!bbox) {
      return [];
    }
    const query = buildQuery(bbox);
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      body: new URLSearchParams({ data: query }),
      signal: input.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (!response.ok) {
      throw new Error(`overpass_${response.status}`);
    }
    const payload = await response.json();
    return elements(payload).flatMap((item) => this.mapElement(item, input.city)).slice(0, MAX_ITEMS_PER_RUN);
  }

  private mapElement(item: Record<string, unknown>, city: string): ExternalRawItem[] {
    try {
      const tags = object(item.tags) ?? {};
      const id = text(item.id);
      const type = text(item.type) ?? 'node';
      const name = text(tags.name);
      if (!id || !name) {
        return [];
      }
      const center = object(item.center);
      const lat = number(item.lat) ?? number(center?.lat);
      const lng = number(item.lon) ?? number(center?.lon);
      const category = text(tags.amenity) ?? text(tags.tourism) ?? text(tags.leisure) ?? text(tags.shop) ?? text(tags.route) ?? 'place';
      return [{
        sourceCode: this.code,
        sourceItemId: `${type}-${id}`,
        sourceUrl: `https://www.openstreetmap.org/${type}/${id}`,
        contentKind: 'place',
        city,
        timezone: 'Europe/Moscow',
        title: name,
        description: text(tags.description) ?? text(tags.opening_hours),
        category,
        tags: [category].filter(Boolean),
        address: addressFromTags(tags),
        lat,
        lng,
        startsAt: null,
        endsAt: null,
        priceFrom: null,
        currency: 'RUB',
        raw: item,
      }];
    } catch {
      return [];
    }
  }
}

function buildQuery(bbox: string) {
  const selectors = TAGS.flatMap(([key, value]) => [
    `node["${key}"="${value}"](${bbox});`,
    `way["${key}"="${value}"](${bbox});`,
    `relation["${key}"="${value}"](${bbox});`,
  ]).join('\n');
  return `[out:json][timeout:25];\n(\n${selectors}\n);\nout center 500;`;
}

function elements(payload: unknown): Record<string, unknown>[] {
  const data = payload as { elements?: unknown };
  return Array.isArray(data.elements)
    ? data.elements.filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    : [];
}

function object(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function text(value: unknown) {
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function number(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function addressFromTags(tags: Record<string, unknown>) {
  const street = text(tags['addr:street']);
  const house = text(tags['addr:housenumber']);
  const city = text(tags['addr:city']);
  return [city, street, house].filter(Boolean).join(', ') || null;
}
