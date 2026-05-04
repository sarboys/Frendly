import type { ExternalRawItem, ExternalSourceAdapter, ExternalSourceFetchInput } from './content-source.types';

const PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES_PER_ENDPOINT = 1000;

export class TimepadAdapter implements ExternalSourceAdapter {
  readonly code = 'timepad' as const;
  private readonly baseUrl = process.env.TIMEPAD_BASE_URL ?? 'https://api.timepad.ru/v1';

  async fetchItems(input: ExternalSourceFetchInput): Promise<ExternalRawItem[]> {
    const token = text(process.env.TIMEPAD_API_TOKEN);
    if (!token) {
      console.warn('[content-import] timepad_disabled_missing_token');
      return [];
    }

    const items: Record<string, unknown>[] = [];
    const maxPages = positiveInt(process.env.CONTENT_IMPORT_MAX_PAGES_PER_ENDPOINT, DEFAULT_MAX_PAGES_PER_ENDPOINT);
    for (let page = 0; page < maxPages; page += 1) {
      const skip = page * PAGE_SIZE;
      const url = new URL(`${this.baseUrl}/events.json`);
      url.searchParams.set('limit', String(PAGE_SIZE));
      url.searchParams.set('skip', String(skip));
      url.searchParams.set('cities', input.city);
      url.searchParams.set('starts_at', input.from.toISOString().slice(0, 10));
      url.searchParams.set('sort', '+starts_at');
      url.searchParams.set('fields', 'location,starts_at,ends_at,name,description,url,categories,price_min');
      const response = await fetch(url, {
        signal: input.signal,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`timepad_${response.status}`);
      }
      const payload = await response.json();
      const pageItems = values(payload);
      items.push(...pageItems.filter((item) => {
        const startsAt = date(item.starts_at);
        return startsAt == null || startsAt <= input.to;
      }));
      const hasItemAfterWindow = pageItems.some((item) => {
        const startsAt = date(item.starts_at);
        return startsAt != null && startsAt > input.to;
      });
      if (pageItems.length < PAGE_SIZE) {
        break;
      }
      if (hasItemAfterWindow) {
        break;
      }
    }
    return items.flatMap((item) => this.mapEvent(item, input.city));
  }

  private mapEvent(item: Record<string, unknown>, city: string): ExternalRawItem[] {
    try {
      const id = text(item.id);
      const title = text(item.name);
      if (!id || !title) {
        return [];
      }
      const location = object(item.location);
      return [{
        sourceCode: this.code,
        sourceItemId: `event-${id}`,
        sourceUrl: text(item.url),
        contentKind: 'event',
        city,
        timezone: 'Europe/Moscow',
        title,
        description: text(item.description),
        category: firstCategory(item.categories) ?? 'lecture',
        tags: categoryTags(item.categories),
        address: text(location?.address),
        lat: number(location?.latitude),
        lng: number(location?.longitude),
        startsAt: date(item.starts_at),
        endsAt: date(item.ends_at),
        priceFrom: integer(item.price_min),
        currency: 'RUB',
        raw: item,
      }];
    } catch {
      return [];
    }
  }
}

function values(payload: unknown): Record<string, unknown>[] {
  const data = payload as { values?: unknown };
  return Array.isArray(data.values)
    ? data.values.filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
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
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function integer(value: unknown) {
  const parsed = number(value);
  return parsed == null ? null : Math.max(0, Math.floor(parsed));
}

function date(value: unknown) {
  const raw = text(value);
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function categoryTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => {
    if (typeof item === 'string') {
      return item;
    }
    if (item && typeof item === 'object') {
      return text((item as { name?: unknown }).name) ?? text((item as { id?: unknown }).id);
    }
    return null;
  }).filter((item): item is string => item != null);
}

function firstCategory(value: unknown) {
  return categoryTags(value)[0] ?? null;
}

function positiveInt(value: unknown, fallback: number) {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
