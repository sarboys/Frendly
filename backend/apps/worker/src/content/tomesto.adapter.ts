import * as cheerio from 'cheerio';
import type {
  ExternalPriceMode,
  ExternalRawItem,
  ExternalSourceAdapter,
  ExternalSourceFetchInput,
} from './content-source.types';

const DEFAULT_BASE_URL = 'https://tomesto.ru';
const DEFAULT_MAX_PAGES = 200;
const DEFAULT_REQUEST_DELAY_MS = 1000;
const DEFAULT_WINDOW_DAYS = 30;
const TOMESTO_PROVIDER = 'ТоМесто';
const MOSCOW = 'Москва';
const MOSCOW_TIMEZONE = 'Europe/Moscow';
const PLACE_BATCH_SIZE = 50;
const EVENT_BATCH_SIZE = 50;

type CheerioRoot = ReturnType<typeof cheerio.load>;
type TomestoListKind = 'places' | 'events' | 'promos';
type TomestoTaxonomy = {
  occasion: string[];
  area: string[];
  budget: string[];
  metro: string[];
  placeCategory: string[];
  cuisine: string[];
  features: string[];
  sets: string[];
};

type ParsedDateWindow = {
  startsAt: Date | null;
  endsAt: Date | null;
};

export class TomestoAdapter implements ExternalSourceAdapter {
  readonly code = 'tomesto' as const;
  private readonly baseUrl = text(process.env.TOMESTO_BASE_URL) ?? DEFAULT_BASE_URL;
  private readonly refQuery = normalizeRefQuery(process.env.TOMESTO_REF_QUERY);
  private readonly maxPages = positiveInt(process.env.TOMESTO_MAX_PAGES, DEFAULT_MAX_PAGES);
  private readonly requestDelayMs = nonNegativeInt(process.env.TOMESTO_REQUEST_DELAY_MS, DEFAULT_REQUEST_DELAY_MS);
  private readonly windowDays = positiveInt(process.env.TOMESTO_WINDOW_DAYS, DEFAULT_WINDOW_DAYS);
  private readonly importImages = process.env.TOMESTO_IMPORT_IMAGES === 'true';

  async fetchItems(input: ExternalSourceFetchInput): Promise<ExternalRawItem[]> {
    const items = [];
    for await (const batch of this.fetchBatches(input)) {
      items.push(...batch);
    }
    return items;
  }

  async *fetchBatches(input: ExternalSourceFetchInput): AsyncIterable<ExternalRawItem[]> {
    if (input.city !== MOSCOW) {
      console.warn('[tomesto] skipped unsupported city', {
        city: input.city,
        supportedCity: MOSCOW,
      });
      return;
    }

    console.info('[tomesto] import started', {
      city: input.city,
      from: input.from.toISOString(),
      to: input.to.toISOString(),
      maxPages: this.maxPages,
      windowDays: this.windowDays,
      importImages: this.importImages,
    });
    if (!this.refQuery) {
      console.warn('[tomesto] ref query missing', {
        env: 'TOMESTO_REF_QUERY',
        affiliateLinksEnabled: false,
      });
    }

    const placeUrls = await this.discoverDetailUrls('places', input);
    console.info('[tomesto] discovered detail urls', {
      kind: 'places',
      count: placeUrls.length,
    });
    const taxonomyCounts = emptyTaxonomyCounts();
    for await (const batch of this.fetchPlaceBatches(placeUrls, input, taxonomyCounts)) {
      yield batch;
    }
    console.info('[tomesto] place taxonomy counts', taxonomyCounts);

    const eventUrls = await this.discoverDetailUrls('events', input);
    console.info('[tomesto] discovered detail urls', {
      kind: 'events',
      count: eventUrls.length,
    });
    for await (const batch of this.fetchTimedBatches('events', eventUrls, input)) {
      yield batch;
    }

    const promoUrls = await this.discoverDetailUrls('promos', input);
    console.info('[tomesto] discovered detail urls', {
      kind: 'promos',
      count: promoUrls.length,
    });
    for await (const batch of this.fetchTimedBatches('promos', promoUrls, input)) {
      yield batch;
    }
  }

  private async discoverDetailUrls(kind: TomestoListKind, input: ExternalSourceFetchInput) {
    const urls = new Set<string>();
    for (let page = 1; page <= this.maxPages; page += 1) {
      const url = this.listUrl(kind, page, input.from, input.to);
      const html = await this.fetchHtml(url, input.signal);
      const $ = cheerio.load(html);
      const discovered = this.extractDetailUrls($, kind);
      let newCount = 0;
      for (const detailUrl of discovered) {
        if (!urls.has(detailUrl)) {
          urls.add(detailUrl);
          newCount += 1;
        }
      }
      console.debug('[tomesto] list page parsed', {
        kind,
        page,
        path: url.pathname,
        discoveredCount: discovered.length,
        newCount,
      });
      if (newCount === 0) {
        break;
      }
      if (page === this.maxPages) {
        console.warn('[tomesto] max page guard stopped pagination', {
          kind,
          maxPages: this.maxPages,
        });
      }
      await delay(this.requestDelayMs);
    }
    return Array.from(urls);
  }

  private async *fetchPlaceBatches(
    urls: string[],
    input: ExternalSourceFetchInput,
    taxonomyCounts: ReturnType<typeof emptyTaxonomyCounts>,
  ) {
    let batch: ExternalRawItem[] = [];
    for (const url of urls) {
      const html = await this.fetchHtml(new URL(url), input.signal);
      const item = this.parsePlace(html, url, input.city);
      if (item) {
        countTaxonomyTags(item.tags ?? [], taxonomyCounts);
        batch.push(item);
      }
      if (batch.length >= PLACE_BATCH_SIZE) {
        yield batch;
        batch = [];
      }
      await delay(this.requestDelayMs);
    }
    if (batch.length > 0) {
      yield batch;
    }
  }

  private async *fetchTimedBatches(
    kind: Extract<TomestoListKind, 'events' | 'promos'>,
    urls: string[],
    input: ExternalSourceFetchInput,
  ) {
    let batch: ExternalRawItem[] = [];
    const hiddenReasons = {
      eventDefaultDisabled: 0,
      promoSurfaceMissing: 0,
      unknownPrice: 0,
    };
    for (const url of urls) {
      const html = await this.fetchHtml(new URL(url), input.signal);
      const item = this.parseTimedItem(kind, html, url, input);
      if (item) {
        if (kind === 'promos') {
          hiddenReasons.promoSurfaceMissing += 1;
        } else if (item.priceMode === 'unknown') {
          hiddenReasons.unknownPrice += 1;
        } else if (process.env.TOMESTO_PUBLIC_EVENTS_ENABLED !== 'true') {
          hiddenReasons.eventDefaultDisabled += 1;
        }
        batch.push(item);
      }
      if (batch.length >= EVENT_BATCH_SIZE) {
        yield batch;
        batch = [];
      }
      await delay(this.requestDelayMs);
    }
    if (batch.length > 0) {
      yield batch;
    }
    if (Object.values(hiddenReasons).some((count) => count > 0)) {
      console.info('[tomesto] hidden imported events', hiddenReasons);
    }
  }

  private listUrl(kind: TomestoListKind, page: number, from: Date, to: Date) {
    const cityCode = 'moskva';
    const path = page === 1
      ? `/${cityCode}/${kind}`
      : `/${cityCode}/${kind}/page/${page}`;
    const url = new URL(path, ensureTrailingSlash(this.baseUrl));
    if (kind === 'events' || kind === 'promos') {
      url.searchParams.set('date_from', dateKey(from));
      url.searchParams.set('date_to', dateKey(to));
    }
    return url;
  }

  private async fetchHtml(url: URL, signal: AbortSignal) {
    console.debug('[tomesto] fetching page', {
      path: url.pathname,
      query: safeQuery(url),
    });
    const response = await fetch(url, {
      signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'FrendlyTomestoImporter/1.0',
      },
    });
    if (!response.ok) {
      console.error('[tomesto] non-2xx response', {
        status: response.status,
        path: url.pathname,
      });
      throw new Error(`tomesto_${response.status}_${url.pathname}`);
    }
    return response.text();
  }

  private extractDetailUrls($: CheerioRoot, kind: TomestoListKind) {
    const urls = new Set<string>();
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      const url = this.safeTomestoUrl(href);
      if (!url || !isDetailPath(url, kind)) {
        return;
      }
      urls.add(stripHash(url).toString());
    });
    return Array.from(urls);
  }

  private safeTomestoUrl(value: string | undefined) {
    if (!value) {
      return null;
    }
    let url: URL;
    try {
      url = new URL(value, ensureTrailingSlash(this.baseUrl));
    } catch {
      return null;
    }
    const baseHost = new URL(ensureTrailingSlash(this.baseUrl)).hostname;
    if (url.hostname !== baseHost || url.protocol !== 'https:') {
      return null;
    }
    if (url.search) {
      return null;
    }
    if (
      url.pathname.includes('/reservations/') ||
      url.pathname.includes('/favorite') ||
      url.pathname.includes('/occurrences/')
    ) {
      return null;
    }
    return url;
  }

  private parsePlace(html: string, detailUrl: string, city: string): ExternalRawItem | null {
    const $ = cheerio.load(html);
    const sourceUrl = canonicalUrl($, detailUrl);
    const slug = slugFromUrl(sourceUrl);
    const title = firstText($, ['h1', '[itemprop="name"]']) ?? meta($, 'og:title');
    const address = firstText($, [
      '[itemprop="address"]',
      '[data-test="address"]',
      '.place-address',
      '.address',
      'address',
    ]);
    const coords = coordinates($);
    if (!title) {
      console.warn('[tomesto] place skipped without title', { slug });
      return null;
    }
    if (!address) {
      console.warn('[tomesto] place has no address', { slug, title });
    }
    if (coords.lat == null || coords.lng == null) {
      console.warn('[tomesto] place coordinates missing', { slug, title });
    }

    const categoryLabels = collectTexts($, [
      '.breadcrumbs a',
      '.place-category a',
      '.categories a',
      '[rel="tag"]',
      '[data-category]',
    ]);
    const category = placeCategory(categoryLabels);
    const priceFrom = averageCheck($);
    const metro = metroLabels($);
    const features = featureLabels($);
    const sets = setLabels($, sourceUrl);
    const cuisine = cuisineLabels($);
    const taxonomy = buildPlaceTaxonomy({
      sourceUrl,
      text: compactPageText($),
      priceFrom,
      category,
      categoryLabels,
      metro,
      features,
      sets,
      cuisine,
    });
    const tags = taxonomyTags(taxonomy);
    const itemImageUrl = this.importImages ? extractImageUrl($, sourceUrl) : null;
    const actionUrl = this.actionUrl(sourceUrl);
    console.debug('[tomesto] parsed place', {
      slug,
      hasTitle: true,
      hasAddress: Boolean(address),
      hasCoords: coords.lat != null && coords.lng != null,
      taxonomyTags: tags.length,
    });

    return {
      sourceCode: this.code,
      sourceItemId: `place:${slug}`,
      sourceUrl,
      contentKind: 'place',
      city,
      timezone: MOSCOW_TIMEZONE,
      title,
      description: meta($, 'description'),
      category,
      tags,
      address,
      lat: coords.lat,
      lng: coords.lng,
      startsAt: null,
      endsAt: null,
      priceFrom,
      currency: 'RUB',
      venueName: null,
      imageUrl: itemImageUrl,
      actionUrl,
      actionKind: 'affiliate_booking',
      priceMode: 'unknown',
      isAffiliate: this.refQuery.length > 0,
      sourceProvider: TOMESTO_PROVIDER,
      placeKind: category,
      lastSeenAt: new Date(),
      raw: {
        slug,
        rating: rating($),
        metro,
        features,
        sourceUpdatedText: sourceUpdatedText($),
        taxonomy,
      },
    };
  }

  private parseTimedItem(
    kind: Extract<TomestoListKind, 'events' | 'promos'>,
    html: string,
    detailUrl: string,
    input: ExternalSourceFetchInput,
  ): ExternalRawItem | null {
    const $ = cheerio.load(html);
    const sourceUrl = canonicalUrl($, detailUrl);
    const slug = slugFromUrl(sourceUrl);
    const title = firstText($, ['h1', '[itemprop="name"]']) ?? meta($, 'og:title');
    if (!title) {
      console.warn('[tomesto] timed item skipped without title', { kind, slug });
      return null;
    }
    const originalCategory = firstText($, [
      '.breadcrumbs a:last-child',
      '.event-category',
      '.event-category a',
      '.promo-category',
      '.promo-category a',
      '.categories',
      '.categories a',
      '[rel="tag"]',
    ]);
    const categorySlug = normalizeSlug(originalCategory ?? kind);
    const normalizedCategory = kind === 'promos' ? 'promo' : eventCategory(originalCategory, title);
    const dateWindow = firstDateWindow($, input.from, input.to);
    const price = visiblePrice($);
    const venueName = firstText($, [
      '[itemprop="location"] [itemprop="name"]',
      '.venue a',
      '.place a',
      '.event-place a',
      '.promo-place a',
    ]);
    const venueUrl = firstAttr($, [
      '[itemprop="location"] a',
      '.venue a',
      '.place a',
      '.event-place a',
      '.promo-place a',
    ], 'href');
    const placeSlug = kind === 'promos' ? placeSlugFromVenueUrl(venueUrl) : null;
    if (!venueName) {
      console.warn('[tomesto] timed item missing venue', { kind, slug, title });
    }
    if (!dateWindow.startsAt) {
      console.warn('[tomesto] timed item date unknown', { kind, slug, title });
    }
    const sourceItemId = kind === 'promos'
      ? `promo:${categorySlug}:${slug}`
      : `event:${categorySlug}:${slug}`;
    const tags = kind === 'promos'
      ? dedupe(['promo', originalCategory ? normalizeToken(originalCategory) : null].filter(isString))
      : dedupe([normalizedCategory, originalCategory ? normalizeToken(originalCategory) : null].filter(isString));
    console.debug('[tomesto] parsed timed item', {
      kind,
      slug,
      hasDate: Boolean(dateWindow.startsAt),
      hasVenue: Boolean(venueName),
      priceMode: price.priceMode,
    });

    return {
      sourceCode: this.code,
      sourceItemId,
      sourceUrl,
      contentKind: 'event',
      city: MOSCOW,
      timezone: MOSCOW_TIMEZONE,
      title,
      description: shortDescription($),
      category: normalizedCategory,
      tags,
      address: firstText($, ['[itemprop="address"]', '.address', 'address']),
      lat: coordinates($).lat,
      lng: coordinates($).lng,
      startsAt: dateWindow.startsAt,
      endsAt: dateWindow.endsAt,
      priceFrom: price.priceFrom,
      currency: 'RUB',
      venueName,
      imageUrl: this.importImages ? extractImageUrl($, sourceUrl) : null,
      actionUrl: this.actionUrl(sourceUrl),
      actionKind: 'affiliate_booking',
      priceMode: price.priceMode,
      isAffiliate: this.refQuery.length > 0,
      sourceProvider: TOMESTO_PROVIDER,
      placeKind: null,
      lastSeenAt: new Date(),
      raw: {
        kind: kind === 'promos' ? 'promo' : 'event',
        slug,
        category: originalCategory,
        placeSlug,
        venueName,
        address: firstText($, ['[itemprop="address"]', '.address', 'address']),
        sourceUrl,
      },
    };
  }

  private actionUrl(sourceUrl: string) {
    if (!this.refQuery) {
      return sourceUrl;
    }
    const url = new URL(sourceUrl);
    const params = new URLSearchParams(this.refQuery);
    for (const [key, value] of params.entries()) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }
}

function isDetailPath(url: URL, kind: TomestoListKind) {
  const path = url.pathname.replace(/\/+$/, '');
  if (!path.startsWith('/moskva/')) {
    return false;
  }
  if (path.includes('/page/')) {
    return false;
  }
  const parts = path.split('/').filter(Boolean);
  if (parts.length < 3) {
    return false;
  }
  return parts[1] === kind;
}

function stripHash(url: URL) {
  const next = new URL(url.toString());
  next.hash = '';
  return next;
}

function canonicalUrl($: CheerioRoot, fallback: string) {
  const value = $('link[rel="canonical"]').attr('href') ?? meta($, 'og:url');
  if (!value) {
    return fallback;
  }
  try {
    return stripHash(new URL(value, fallback)).toString();
  } catch {
    return fallback;
  }
}

function slugFromUrl(value: string) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);
    return normalizeSlug(parts.at(-1) ?? 'item');
  } catch {
    return normalizeSlug(value.split('/').filter(Boolean).at(-1) ?? 'item');
  }
}

function firstText($: CheerioRoot, selectors: string[]) {
  for (const selector of selectors) {
    const value = cleanText($(selector).first().text());
    if (value) {
      return value;
    }
    const attr = cleanText($(selector).first().attr('content'));
    if (attr) {
      return attr;
    }
  }
  return null;
}

function firstAttr($: CheerioRoot, selectors: string[], attrName: string) {
  for (const selector of selectors) {
    const value = cleanText($(selector).first().attr(attrName), 500);
    if (value) {
      return value;
    }
  }
  return null;
}

function placeSlugFromVenueUrl(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value, DEFAULT_BASE_URL);
  const parts = url.pathname.split('/').filter(Boolean);
  const placeIndex = parts.indexOf('places');
  const slug = placeIndex >= 0 ? parts[placeIndex + 1] : undefined;
  if (slug) {
    return normalizeSlug(slug);
  }
  } catch {
    return null;
  }
  return null;
}

function collectTexts($: CheerioRoot, selectors: string[]) {
  const values: string[] = [];
  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const attrValue = cleanText($(element).attr('data-category'));
      const value = attrValue ?? cleanText($(element).text());
      if (value) {
        values.push(value);
      }
    });
  }
  return dedupe(values);
}

function meta($: CheerioRoot, name: string) {
  return cleanText(
    $(`meta[property="${name}"]`).attr('content') ??
    $(`meta[name="${name}"]`).attr('content'),
    name === 'description' ? 500 : 300,
  );
}

function shortDescription($: CheerioRoot) {
  return cleanText(
    meta($, 'description') ??
    firstText($, ['[itemprop="description"]', '.description', '.event-description', '.promo-description']),
    500,
  );
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

function coordinates($: CheerioRoot) {
  const jsonLd = jsonLdObjects($);
  for (const item of jsonLd) {
    const geo = object(item.geo);
    const lat = number(geo?.latitude ?? item.latitude);
    const lng = number(geo?.longitude ?? geo?.lon ?? item.longitude);
    if (lat != null && lng != null) {
      return { lat, lng };
    }
  }
  const lat = number(
    $('[itemprop="latitude"]').attr('content') ??
    $('meta[property="place:location:latitude"]').attr('content') ??
    $('[data-lat]').first().attr('data-lat'),
  );
  const lng = number(
    $('[itemprop="longitude"]').attr('content') ??
    $('meta[property="place:location:longitude"]').attr('content') ??
    $('[data-lng]').first().attr('data-lng') ??
    $('[data-lon]').first().attr('data-lon'),
  );
  return { lat, lng };
}

function jsonLdObjects($: CheerioRoot) {
  const objects: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text();
    try {
      collectJsonObjects(JSON.parse(raw), objects);
    } catch {
      return;
    }
  });
  return objects;
}

function collectJsonObjects(value: unknown, output: Record<string, unknown>[]) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonObjects(item, output));
    return;
  }
  const item = object(value);
  if (!item) {
    return;
  }
  output.push(item);
  collectJsonObjects(item['@graph'], output);
}

function placeCategory(labels: string[]) {
  for (const label of labels) {
    const normalized = normalizeToken(label);
    if (normalized.includes('karaoke')) {
      return 'karaoke';
    }
    if (normalized.includes('gastropub')) {
      return 'gastropub';
    }
    if (normalized.includes('pub') || normalized.includes('паб')) {
      return 'pub';
    }
    if (normalized.includes('bar') || normalized.includes('бар')) {
      return 'bar';
    }
    if (normalized.includes('bistro') || normalized.includes('бистро')) {
      return 'bistro';
    }
    if (normalized.includes('cafe') || normalized.includes('кафе') || normalized.includes('кофе')) {
      return 'cafe';
    }
    if (normalized.includes('restaurant') || normalized.includes('ресторан')) {
      return 'restaurant';
    }
  }
  return 'restaurant';
}

function averageCheck($: CheerioRoot) {
  const textValue = [
    firstText($, ['[data-test="average-check"]', '.average-check', '.price', '.check']),
    compactPageText($),
  ].filter(isString).join(' ');
  const match = textValue.match(/(?:средний\s+чек|чек)[^\d]{0,24}([\d\s]{2,8})(?:₽|руб|р\.)?/i);
  return match?.[1] ? positiveNumber(match[1]) : null;
}

function visiblePrice($: CheerioRoot): { priceFrom: number | null; priceMode: ExternalPriceMode } {
  const value = [
    firstText($, ['[data-test="price"]', '.price', '.event-price', '.promo-price']),
    compactPageText($),
  ].filter(isString).join(' ');
  if (/бесплатно|свободный вход|вход свобод/i.test(value)) {
    return { priceFrom: 0, priceMode: 'free' };
  }
  const match = value.match(/(?:от\s*)?([\d\s]{2,8})\s*(?:₽|руб|р\.)/i);
  const priceFrom = match?.[1] ? positiveNumber(match[1]) : null;
  return {
    priceFrom,
    priceMode: priceFrom != null && priceFrom > 0 ? 'paid' : 'unknown',
  };
}

function rating($: CheerioRoot) {
  return number(
    $('[itemprop="ratingValue"]').attr('content') ??
    $('[data-rating]').first().attr('data-rating') ??
    firstText($, ['.rating']),
  );
}

function metroLabels($: CheerioRoot) {
  const values = collectTexts($, [
    '[data-metro]',
    '.metro',
    '.subway',
    '.place-metro',
  ]);
  $('[data-metro]').each((_, element) => {
    const value = cleanText($(element).attr('data-metro'));
    if (value) {
      values.push(value);
    }
  });
  return dedupe(values.map((value) => value.replace(/^м\.\s*/i, '')));
}

function featureLabels($: CheerioRoot) {
  const values = collectTexts($, [
    '.features li',
    '.feature',
    '.place-features li',
    '[data-feature]',
  ]);
  $('[data-feature]').each((_, element) => {
    const value = cleanText($(element).attr('data-feature'));
    if (value) {
      values.push(value);
    }
  });
  return dedupe(values);
}

function cuisineLabels($: CheerioRoot) {
  return collectTexts($, [
    '.cuisine a',
    '.cuisines a',
    '[data-cuisine]',
  ]);
}

function setLabels($: CheerioRoot, sourceUrl: string) {
  const values = new Set<string>();
  const collect = (href: string | undefined) => {
    if (!href) {
      return;
    }
    try {
      const url = new URL(href, sourceUrl);
      for (const part of url.pathname.split('/').filter(Boolean)) {
        const normalized = normalizeToken(part);
        if (
          normalized.includes('nedorogie') ||
          normalized.includes('gde_vkusno_poest') ||
          normalized.includes('poest')
        ) {
          values.add(normalized.replace(/_/g, '-'));
        }
      }
    } catch {
      return;
    }
  };
  collect(sourceUrl);
  $('a[href]').each((_, element) => collect($(element).attr('href')));
  return Array.from(values);
}

function sourceUpdatedText($: CheerioRoot) {
  return firstText($, [
    '[data-test="updated-at"]',
    '.updated-at',
    '.source-updated',
    'time[datetime]',
  ]);
}

function compactPageText($: CheerioRoot) {
  const clone = $.root().clone();
  clone.find('script,style,.reviews,.review,.menu,.menu-item').remove();
  return cleanText(clone.text(), 2000) ?? '';
}

function buildPlaceTaxonomy(input: {
  sourceUrl: string;
  text: string;
  priceFrom: number | null;
  category: string;
  categoryLabels: string[];
  metro: string[];
  features: string[];
  sets: string[];
  cuisine: string[];
}): TomestoTaxonomy {
  const sourceTokens = [
    input.sourceUrl,
    input.text,
    ...input.categoryLabels,
    ...input.sets,
    ...input.metro,
  ].map((value) => normalizeToken(value)).join(' ');
  const area = /tsentr|центр|sadovoe|tversk|arbat|lubyank|ohotny|teatral|kitay_gorod|kuzneck/i.test(sourceTokens)
    ? ['center']
    : [];
  const budget = input.priceFrom != null && input.priceFrom <= 1500 || /nedorog|недорог|дешев|cheap/i.test(sourceTokens)
    ? ['cheap']
    : [];
  return {
    occasion: ['food'],
    area,
    budget,
    metro: input.metro.map((value) => normalizeToken(value)).filter(Boolean),
    placeCategory: [input.category],
    cuisine: input.cuisine.map((value) => normalizeToken(value)).filter(Boolean),
    features: input.features.map(normalizeFeature).filter(Boolean),
    sets: input.sets,
  };
}

function taxonomyTags(taxonomy: TomestoTaxonomy) {
  return dedupe([
    ...taxonomy.occasion.map((value) => `occasion:${value}`),
    ...taxonomy.area.map((value) => `area:${value}`),
    ...taxonomy.budget.map((value) => `budget:${value}`),
    ...taxonomy.placeCategory.map((value) => `place:${value}`),
    ...taxonomy.cuisine.map((value) => `cuisine:${value}`),
    ...taxonomy.features.map((value) => `feature:${value}`),
    ...taxonomy.metro.map((value) => `metro:${value}`),
    ...taxonomy.sets.map((value) => `set:${value}`),
  ]);
}

function normalizeFeature(value: string) {
  const normalized = normalizeToken(value);
  if (/letnyaya_veranda|veranda|terrace|террас|веранд/.test(normalized)) {
    return 'summer_terrace';
  }
  if (/otkrytaya_kuhnya|open_kitchen|открыт.*кух/.test(normalized)) {
    return 'open_kitchen';
  }
  if (/panoramn|panorama|вид/.test(normalized)) {
    return 'panoramic_view';
  }
  if (/kamin|камин/.test(normalized)) {
    return 'fireplace';
  }
  if (/zhivaya_muzyka|live_music|живая.*музык/.test(normalized)) {
    return 'live_music';
  }
  if (/business_lunch|biznes_lanch|бизнес.*ланч/.test(normalized)) {
    return 'business_lunch';
  }
  if (/zavtrak|breakfast|завтрак/.test(normalized)) {
    return 'breakfast';
  }
  return normalized;
}

function extractImageUrl($: CheerioRoot, sourceUrl: string) {
  const value = meta($, 'og:image') ?? $('img[itemprop="image"]').first().attr('src');
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value, sourceUrl);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function firstDateWindow($: CheerioRoot, from: Date, to: Date): ParsedDateWindow {
  const windows = dateWindows($);
  const inWindow = windows.find((window) =>
    window.startsAt != null &&
    window.startsAt >= from &&
    window.startsAt <= to,
  );
  return inWindow ?? windows[0] ?? { startsAt: null, endsAt: null };
}

function dateWindows($: CheerioRoot): ParsedDateWindow[] {
  const windows: ParsedDateWindow[] = [];
  for (const item of jsonLdObjects($)) {
    const startsAt = parseDate(item.startDate);
    const endsAt = parseDate(item.endDate);
    if (startsAt) {
      windows.push({ startsAt, endsAt });
    }
  }
  $('time[datetime], [data-start], [data-date]').each((_, element) => {
    const startsAt = parseDate(
      $(element).attr('datetime') ??
      $(element).attr('data-start') ??
      $(element).attr('data-date'),
    );
    if (startsAt) {
      windows.push({ startsAt, endsAt: null });
    }
  });
  const textValue = compactPageText($);
  const textDate = parseDate(textValue);
  if (textDate) {
    windows.push({ startsAt: textDate, endsAt: null });
  }
  return windows;
}

function parseDate(value: unknown) {
  const raw = cleanText(value, 120);
  if (!raw) {
    return null;
  }
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }
  const match = raw.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})(?:[^\d]+(\d{1,2}):(\d{2}))?/);
  if (!match) {
    return null;
  }
  const day = Number.parseInt(match[1] ?? '', 10);
  const month = Number.parseInt(match[2] ?? '', 10);
  const year = Number.parseInt(match[3] ?? '', 10);
  const hour = Number.parseInt(match[4] ?? '12', 10);
  const minute = Number.parseInt(match[5] ?? '0', 10);
  const timestamp = Date.UTC(year, month - 1, day, hour - 3, minute);
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

function eventCategory(category: string | null, title: string) {
  const raw = normalizeToken([category, title].filter(Boolean).join(' '));
  if (/standup|stendap|стендап|comedy|комеди/.test(raw)) {
    return 'comedy';
  }
  if (/concert|концерт/.test(raw)) {
    return 'concert';
  }
  if (/theatre|teatr|театр|спектак/.test(raw)) {
    return 'theatre';
  }
  if (/quiz|квиз/.test(raw)) {
    return 'quiz';
  }
  if (/lecture|лекци/.test(raw)) {
    return 'lecture';
  }
  if (/workshop|мастер/.test(raw)) {
    return 'workshop';
  }
  return 'food';
}

function ensureTrailingSlash(value: string) {
  return value.endsWith('/') ? value : `${value}/`;
}

function normalizeRefQuery(value: unknown) {
  const raw = text(value);
  if (!raw) {
    return '';
  }
  return raw.startsWith('?') ? raw.slice(1) : raw;
}

function safeQuery(url: URL) {
  if (!url.search) {
    return null;
  }
  const params = new URLSearchParams(url.search);
  return Array.from(params.keys()).sort();
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function text(value: unknown) {
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
    const normalized = value.replace(',', '.').replace(/[^\d.-]/g, '');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function positiveNumber(value: string) {
  const parsed = Number.parseInt(value.replace(/\D/g, ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function positiveInt(value: unknown, fallback: number) {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInt(value: unknown, fallback: number) {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function object(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function delay(ms: number) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function normalizeToken(value: string) {
  return transliterate(value)
    .trim()
    .toLowerCase()
    .replace(/['"`]+/g, '')
    .replace(/[^a-z0-9а-яё]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function normalizeSlug(value: string) {
  return transliterate(value)
    .trim()
    .toLowerCase()
    .replace(/['"`]+/g, '')
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
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
  return value.replace(/[а-яё]/gi, (char) => {
    const lower = char.toLowerCase();
    return map[lower] ?? char;
  });
}

function dedupe<T>(values: T[]) {
  return Array.from(new Set(values));
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function emptyTaxonomyCounts() {
  return {
    areaCenter: 0,
    budgetCheap: 0,
    occasionFood: 0,
  };
}

function countTaxonomyTags(tags: string[], counts: ReturnType<typeof emptyTaxonomyCounts>) {
  if (tags.includes('area:center')) {
    counts.areaCenter += 1;
  }
  if (tags.includes('budget:cheap')) {
    counts.budgetCheap += 1;
  }
  if (tags.includes('occasion:food')) {
    counts.occasionFood += 1;
  }
}
