import type { ExternalRawItem, ExternalSourceAdapter, ExternalSourceFetchInput } from './content-source.types';
import { kudagoCityCode, timezoneForCity } from './supported-cities';

const PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES_PER_ENDPOINT = 1000;
const KUDAGO_EVENT_CATEGORY_SLUGS = [
  'cinema',
  'concert',
  'education',
  'entertainment',
  'exhibition',
  'festival',
  'holiday',
  'party',
  'photo',
  'quest',
  'recreation',
  'theater',
  'tour',
  'yarmarki-razvlecheniya-yarmarki',
];
const KUDAGO_PLACE_CATEGORY_SLUGS = [
  'amusement',
  'anticafe',
  'art-centers',
  'art-space',
  'attractions',
  'bar',
  'brewery',
  'bridge',
  'cinema',
  'clubs',
  'comedy-club',
  'concert-hall',
  'culture',
  'dance-studio',
  'fountain',
  'handmade',
  'homesteads',
  'library',
  'museums',
  'observatory',
  'palace',
  'park',
  'photo-places',
  'prirodnyj-zapovednik',
  'questroom',
  'recreation',
  'restaurants',
  'rynok',
  'salons',
  'sights',
  'stable',
  'suburb',
  'theatre',
  'workshops',
];

export class KudaGoAdapter implements ExternalSourceAdapter {
  readonly code = 'kudago' as const;
  private readonly baseUrl = process.env.KUDAGO_BASE_URL ?? 'https://kudago.com/public-api/v1.4';

  async fetchItems(input: ExternalSourceFetchInput): Promise<ExternalRawItem[]> {
    const batches = [];
    for await (const batch of this.fetchBatches(input)) {
      batches.push(...batch);
    }
    return batches;
  }

  async *fetchBatches(input: ExternalSourceFetchInput): AsyncIterable<ExternalRawItem[]> {
    const cityCode = kudagoCityCode(input.city);
    if (!cityCode) {
      return;
    }
    yield* this.fetchEvents(input, cityCode);
    yield* this.fetchPlaces(input, cityCode);
    yield* this.fetchMovies(input, cityCode);
    yield* this.fetchMovieShowings(input, cityCode);
  }

  private async *fetchEvents(input: ExternalSourceFetchInput, cityCode: string): AsyncIterable<ExternalRawItem[]> {
    const url = new URL(`${this.baseUrl}/events/`);
    url.searchParams.set('lang', 'ru');
    url.searchParams.set('location', cityCode);
    url.searchParams.set('actual_since', String(Math.floor(input.from.getTime() / 1000)));
    url.searchParams.set('actual_until', String(Math.floor(input.to.getTime() / 1000)));
    url.searchParams.set('page_size', String(PAGE_SIZE));
    url.searchParams.set('categories', KUDAGO_EVENT_CATEGORY_SLUGS.join(','));
    url.searchParams.set('fields', 'id,slug,title,short_title,description,site_url,categories,tags,dates,place,price,images');
    url.searchParams.set('expand', 'place');
    for await (const items of fetchPaged(url, input.signal)) {
      const mapped = items.flatMap((item) => this.mapEvent(item, input.city));
      if (mapped.length > 0) {
        yield mapped;
      }
    }
  }

  private async *fetchPlaces(input: ExternalSourceFetchInput, cityCode: string): AsyncIterable<ExternalRawItem[]> {
    const url = new URL(`${this.baseUrl}/places/`);
    url.searchParams.set('lang', 'ru');
    url.searchParams.set('location', cityCode);
    url.searchParams.set('page_size', String(PAGE_SIZE));
    url.searchParams.set('categories', KUDAGO_PLACE_CATEGORY_SLUGS.join(','));
    url.searchParams.set('fields', 'id,slug,title,address,coords,site_url,categories,tags,subway,images');
    for await (const items of fetchPaged(url, input.signal)) {
      const mapped = items.flatMap((item) => this.mapPlace(item, input.city));
      if (mapped.length > 0) {
        yield mapped;
      }
    }
  }

  private async *fetchMovies(input: ExternalSourceFetchInput, cityCode: string): AsyncIterable<ExternalRawItem[]> {
    const url = new URL(`${this.baseUrl}/movies/`);
    url.searchParams.set('lang', 'ru');
    url.searchParams.set('location', cityCode);
    url.searchParams.set('page_size', String(PAGE_SIZE));
    url.searchParams.set(
      'fields',
      'id,slug,title,original_title,description,body_text,site_url,genres,country,year,poster,images,age_restriction,running_time,trailer,imdb_url,imdb_rating',
    );
    for await (const items of fetchPaged(url, input.signal)) {
      const mapped = items.flatMap((item) => this.mapMovie(item, input.city));
      if (mapped.length > 0) {
        yield mapped;
      }
    }
  }

  private async *fetchMovieShowings(input: ExternalSourceFetchInput, cityCode: string): AsyncIterable<ExternalRawItem[]> {
    const url = new URL(`${this.baseUrl}/movie-showings/`);
    url.searchParams.set('lang', 'ru');
    url.searchParams.set('location', cityCode);
    url.searchParams.set('actual_since', String(Math.floor(input.from.getTime() / 1000)));
    url.searchParams.set('actual_until', String(Math.floor(input.to.getTime() / 1000)));
    url.searchParams.set('page_size', String(PAGE_SIZE));
    url.searchParams.set('fields', 'id,site_url,movie,place,datetime,price');
    url.searchParams.set('expand', 'movie,place');
    for await (const items of fetchPaged(url, input.signal)) {
      const mapped = items.flatMap((item) => this.mapMovieShowing(item, input.city));
      if (mapped.length > 0) {
        yield mapped;
      }
    }
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
      const subway = text(place?.subway);
      return [{
        sourceCode: this.code,
        sourceItemId: `event-${id}`,
        sourceUrl: text(item.site_url),
        contentKind: 'event',
        city,
        timezone: timezoneForCity(city),
        title,
        description: text(item.description),
        category: firstString(item.categories) ?? 'concert',
        tags: uniqueStrings([
          ...tagStrings(item.categories),
          ...tagStrings(item.tags),
          ...tagStrings(place?.tags),
          ...metroTags(subway),
        ]),
        address: text(place?.address),
        lat: number(coords?.lat),
        lng: number(coords?.lon),
        startsAt: date?.start ?? null,
        endsAt: date?.end ?? null,
        priceFrom: priceFrom(item.price),
        currency: 'RUB',
        venueName: text(place?.title),
        imageUrl: firstImageUrl(item.images),
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
      const subway = text(item.subway);
      if (!id || !title) {
        return [];
      }
      return [{
        sourceCode: this.code,
        sourceItemId: `place-${id}`,
        sourceUrl: text(item.site_url),
        contentKind: 'place',
        city,
        timezone: timezoneForCity(city),
        title,
        description: null,
        category: firstString(item.categories) ?? 'place',
        tags: uniqueStrings([
          ...tagStrings(item.categories),
          ...tagStrings(item.tags),
          ...metroTags(subway),
        ]),
        address: text(item.address),
        lat: number(coords?.lat),
        lng: number(coords?.lon),
        startsAt: null,
        endsAt: null,
        priceFrom: null,
        currency: 'RUB',
        imageUrl: firstImageUrl(item.images),
        raw: item,
      }];
    } catch {
      return [];
    }
  }

  private mapMovie(item: Record<string, unknown>, city: string): ExternalRawItem[] {
    try {
      const id = text(item.id);
      const title = text(item.title);
      if (!id || !title) {
        return [];
      }
      const tags = uniqueStrings([
        'movie',
        'cinema',
        'film',
        ...tagStrings(item.genres),
      ]);
      return [{
        sourceCode: this.code,
        sourceItemId: `movie-${id}`,
        sourceUrl: text(item.site_url),
        contentKind: 'movie',
        city,
        timezone: timezoneForCity(city),
        title,
        description: text(item.description) ?? text(item.body_text),
        category: 'movie',
        tags,
        address: null,
        lat: null,
        lng: null,
        startsAt: null,
        endsAt: null,
        priceFrom: null,
        currency: 'RUB',
        imageUrl: posterImageUrl(item.poster) ?? firstImageUrl(item.images),
        raw: { ...item, kind: 'movie' },
      }];
    } catch {
      return [];
    }
  }

  private mapMovieShowing(item: Record<string, unknown>, city: string): ExternalRawItem[] {
    try {
      const id = text(item.id);
      const movie = object(item.movie);
      const place = object(item.place);
      const title = text(movie?.title);
      const coords = object(place?.coords);
      const startsAt = timestampDate(item.datetime);
      if (!id || !title || !startsAt) {
        return [];
      }
      const subway = text(place?.subway);
      const tags = uniqueStrings([
        'movie',
        'cinema',
        'film',
        ...tagStrings(movie?.genres),
        ...metroTags(subway),
      ]);
      return [{
        sourceCode: this.code,
        sourceItemId: `movie-showing-${id}`,
        sourceUrl: text(item.site_url) ?? text(place?.site_url),
        contentKind: 'event',
        city,
        timezone: timezoneForCity(city),
        title,
        description: text(movie?.description) ?? text(movie?.body_text),
        category: 'cinema',
        tags,
        address: text(place?.address),
        lat: number(coords?.lat),
        lng: number(coords?.lon),
        startsAt,
        endsAt: null,
        priceFrom: priceFrom(item.price),
        currency: 'RUB',
        venueName: text(place?.title),
        imageUrl: posterImageUrl(movie?.poster) ?? firstImageUrl(movie?.images) ?? firstImageUrl(place?.images),
        raw: { ...item, kind: 'movie_showing' },
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

async function* fetchPaged(url: URL, signal: AbortSignal): AsyncIterable<Record<string, unknown>[]> {
  const maxPages = positiveInt(process.env.CONTENT_IMPORT_MAX_PAGES_PER_ENDPOINT, DEFAULT_MAX_PAGES_PER_ENDPOINT);
  for (let page = 1; page <= maxPages; page += 1) {
    const pageUrl = new URL(url.toString());
    pageUrl.searchParams.set('page', String(page));
    const payload = await fetchJson(pageUrl, signal);
    const pageItems = results(payload);
    if (pageItems.length > 0) {
      yield pageItems;
    }
    if (pageItems.length < PAGE_SIZE) {
      break;
    }
  }
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

function tagStrings(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .flatMap((item) => {
      const raw = object(item);
      return [
        text(item),
        text(raw?.slug),
        text(raw?.name),
      ];
    })
    .filter((item): item is string => item != null);
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = value.trim();
    if (!cleaned || seen.has(cleaned)) {
      continue;
    }
    seen.add(cleaned);
    result.push(cleaned);
  }
  return result;
}

function firstImageUrl(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }
  for (const item of value) {
    const image = object(item);
    const url = text(image?.image);
    if (url?.startsWith('https://')) {
      return url;
    }
  }
  return null;
}

function posterImageUrl(value: unknown) {
  const url = text(object(value)?.image);
  return url?.startsWith('https://') ? url : null;
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

function timestampDate(value: unknown) {
  const timestamp = number(value);
  return timestamp == null ? null : new Date(timestamp * 1000);
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

function metroTags(value: string | null) {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => metroSlug(item))
    .filter((item): item is string => item != null)
    .map((slug) => `metro:${slug}`);
}

function metroSlug(value: string) {
  const normalized = transliterate(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || null;
}

function transliterate(value: string) {
  const map: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  };
  return value
    .trim()
    .toLowerCase()
    .replace(/[а-яё]/g, (char) => map[char] ?? char);
}
