import type { ExternalRawItem, ExternalSourceAdapter, ExternalSourceFetchInput } from './content-source.types';

const KUDAGO_CITY_CODES: Record<string, string> = {
  'Москва': 'msk',
  'Санкт-Петербург': 'spb',
};

const PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES_PER_ENDPOINT = 1000;

export class KudaGoAdapter implements ExternalSourceAdapter {
  readonly code = 'kudago' as const;
  private readonly baseUrl = process.env.KUDAGO_BASE_URL ?? 'https://kudago.com/public-api/v1.4';

  async fetchItems(input: ExternalSourceFetchInput): Promise<ExternalRawItem[]> {
    const cityCode = KUDAGO_CITY_CODES[input.city] ?? input.cityCode;
    const [events, places] = await Promise.all([
      this.fetchEvents(input, cityCode),
      this.fetchPlaces(input, cityCode),
    ]);
    return [...events, ...places];
  }

  private async fetchEvents(input: ExternalSourceFetchInput, cityCode: string) {
    const url = new URL(`${this.baseUrl}/events/`);
    url.searchParams.set('lang', 'ru');
    url.searchParams.set('location', cityCode);
    url.searchParams.set('actual_since', String(Math.floor(input.from.getTime() / 1000)));
    url.searchParams.set('actual_until', String(Math.floor(input.to.getTime() / 1000)));
    url.searchParams.set('page_size', String(PAGE_SIZE));
    url.searchParams.set('fields', 'id,title,short_title,description,site_url,categories,dates,place,price');
    const items = await fetchPaged(url, input.signal);
    return items.flatMap((item) => this.mapEvent(item, input.city));
  }

  private async fetchPlaces(input: ExternalSourceFetchInput, cityCode: string) {
    const url = new URL(`${this.baseUrl}/places/`);
    url.searchParams.set('lang', 'ru');
    url.searchParams.set('location', cityCode);
    url.searchParams.set('page_size', String(PAGE_SIZE));
    url.searchParams.set('fields', 'id,title,address,coords,site_url,categories,subway');
    const items = await fetchPaged(url, input.signal);
    return items.flatMap((item) => this.mapPlace(item, input.city));
  }

  private mapEvent(item: Record<string, unknown>, city: string): ExternalRawItem[] {
    try {
      const id = text(item.id);
      const title = text(item.title) ?? text(item.short_title);
      if (!id || !title) {
        return [];
      }
      const place = object(item.place);
      const coords = object(place?.coords);
      const date = firstDate(item.dates);
      return [{
        sourceCode: this.code,
        sourceItemId: `event-${id}`,
        sourceUrl: text(item.site_url),
        contentKind: 'event',
        city,
        timezone: 'Europe/Moscow',
        title,
        description: text(item.description),
        category: firstString(item.categories) ?? 'concert',
        tags: stringArray(item.categories),
        address: text(place?.address),
        lat: number(coords?.lat),
        lng: number(coords?.lon),
        startsAt: date?.start ?? null,
        endsAt: date?.end ?? null,
        priceFrom: priceFrom(item.price),
        currency: 'RUB',
        raw: item,
      }];
    } catch {
      return [];
    }
  }

  private mapPlace(item: Record<string, unknown>, city: string): ExternalRawItem[] {
    try {
      const id = text(item.id);
      const title = text(item.title);
      const coords = object(item.coords);
      if (!id || !title) {
        return [];
      }
      return [{
        sourceCode: this.code,
        sourceItemId: `place-${id}`,
        sourceUrl: text(item.site_url),
        contentKind: 'place',
        city,
        timezone: 'Europe/Moscow',
        title,
        description: null,
        category: firstString(item.categories) ?? 'place',
        tags: stringArray(item.categories),
        address: text(item.address),
        lat: number(coords?.lat),
        lng: number(coords?.lon),
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

async function fetchJson(url: URL, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`kudago_${response.status}`);
  }
  return response.json();
}

async function fetchPaged(url: URL, signal: AbortSignal) {
  const items: Record<string, unknown>[] = [];
  const maxPages = positiveInt(process.env.CONTENT_IMPORT_MAX_PAGES_PER_ENDPOINT, DEFAULT_MAX_PAGES_PER_ENDPOINT);
  for (let page = 1; page <= maxPages; page += 1) {
    const pageUrl = new URL(url.toString());
    pageUrl.searchParams.set('page', String(page));
    const payload = await fetchJson(pageUrl, signal);
    const pageItems = results(payload);
    items.push(...pageItems);
    if (pageItems.length < PAGE_SIZE) {
      break;
    }
  }
  return items;
}

function results(payload: unknown): Record<string, unknown>[] {
  const value = payload as { results?: unknown };
  return Array.isArray(value.results)
    ? value.results.filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
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

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => text(item)).filter((item): item is string => item != null)
    : [];
}

function firstString(value: unknown) {
  return stringArray(value)[0] ?? null;
}

function firstDate(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }
  const raw = value.find((item) => item != null && typeof item === 'object') as Record<string, unknown> | undefined;
  if (!raw) {
    return null;
  }
  const start = number(raw.start);
  const end = number(raw.end);
  return {
    start: start == null ? null : new Date(start * 1000),
    end: end == null ? null : new Date(end * 1000),
  };
}

function priceFrom(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === 'string') {
    const match = value.match(/\d+/);
    return match ? Number.parseInt(match[0], 10) : null;
  }
  return null;
}

function positiveInt(value: unknown, fallback: number) {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
