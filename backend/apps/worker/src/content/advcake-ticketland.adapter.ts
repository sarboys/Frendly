import { XMLParser } from 'fast-xml-parser';
import type { ExternalRawItem, ExternalSourceAdapter, ExternalSourceFetchInput } from './content-source.types';

const DEFAULT_BASE_URL = 'https://api.advcake.com';
const DEFAULT_OFFER_ID = '663';
const DEFAULT_WEBSITES = ['ticketland.ru', 'live.mts.ru'];
const DEFAULT_FEED_FORMAT = 'yml';
const DEFAULT_MAX_FEED_BYTES = 60 * 1024 * 1024;
const TICKETLAND_PROVIDER = 'Ticketland / MTS Live';
const SUPPORTED_CITIES = ['Москва', 'Санкт-Петербург'];

const CATEGORY_MAP: Record<string, string> = {
  'комедии': 'comedy',
  'комедия': 'comedy',
  'стендап': 'comedy',
  'stand up': 'comedy',
  'драмы': 'theatre',
  'драма': 'theatre',
  'спектакли': 'theatre',
  'театр': 'theatre',
  'балет': 'theatre',
  'опера': 'theatre',
  'мюзикл': 'theatre',
  'рок': 'concert',
  'джаз': 'concert',
  'концерты': 'concert',
  'концерт': 'concert',
  'классическая музыка': 'concert',
  'пешеходные экскурсии': 'walk',
  'пешеходная экскурсия': 'walk',
  'автобусные экскурсии': 'culture',
  'экскурсии': 'culture',
  'музеи': 'culture',
  'выставки': 'culture',
  'детям': 'culture',
  'детские': 'culture',
  'кино': 'cinema',
  'фестивали': 'festival',
  'фестиваль': 'festival',
};

export class AdvCakeTicketlandAdapter implements ExternalSourceAdapter {
  readonly code = 'advcake_ticketland' as const;
  private readonly baseUrl = text(process.env.ADVCAKE_BASE_URL) ?? DEFAULT_BASE_URL;
  private readonly offerId = text(process.env.ADVCAKE_TICKETLAND_OFFER_ID) ?? DEFAULT_OFFER_ID;
  private readonly websites = parseWebsites();
  private readonly feedFormat = (text(process.env.ADVCAKE_FEED_FORMAT) ?? DEFAULT_FEED_FORMAT).toLowerCase();
  private readonly maxFeedBytes = positiveInt(process.env.ADVCAKE_FEED_MAX_BYTES, DEFAULT_MAX_FEED_BYTES);
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    parseTagValue: false,
    parseAttributeValue: false,
  });

  async fetchItems(input: ExternalSourceFetchInput): Promise<ExternalRawItem[]> {
    const pass = text(process.env.ADVCAKE_API_PASS);
    if (!pass) {
      console.warn('[content-import] advcake_ticketland_disabled_missing_pass');
      return [];
    }

    const feedUrl = await this.loadFeedUrl(pass, input.signal);
    const yml = await this.loadFeed(feedUrl, input.signal);
    const offers = extractOffers(this.parser.parse(yml));
    return offers.flatMap((offer) => this.mapOffer(offer, input));
  }

  private async loadFeedUrl(pass: string, signal: AbortSignal) {
    const url = new URL('/common-feeds', ensureTrailingSlash(this.baseUrl));
    url.searchParams.set('pass', pass);
    url.searchParams.set('offer_id', this.offerId);

    const response = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`advcake_common_feeds_${response.status}`);
    }

    const payload = await response.json();
    const feedUrl = findFeedUrl(payload, this.feedFormat);
    if (!feedUrl) {
      throw new Error('advcake_feed_url_missing');
    }
    if (!isAllowedFeedUrl(feedUrl)) {
      throw new Error('advcake_feed_url_forbidden');
    }
    return feedUrl;
  }

  private async loadFeed(feedUrl: string, signal: AbortSignal) {
    const response = await fetch(feedUrl, {
      signal,
      headers: { Accept: 'application/xml,text/xml,*/*' },
    });
    if (!response.ok) {
      throw new Error(`advcake_feed_${response.status}`);
    }

    const contentLength = numberFromString(response.headers.get('content-length'));
    if (contentLength != null && contentLength > this.maxFeedBytes) {
      throw new Error('advcake_feed_too_large');
    }

    const body = await response.text();
    if (Buffer.byteLength(body, 'utf8') > this.maxFeedBytes) {
      throw new Error('advcake_feed_too_large');
    }
    return body;
  }

  private mapOffer(offer: Record<string, unknown>, input: ExternalSourceFetchInput): ExternalRawItem[] {
    const id = text(readField(offer, 'id', '@_id'));
    const title = text(readField(offer, 'model', 'name'));
    const region = normalizeCity(text(readField(offer, 'region')));
    const startsAt = parseMoscowDate(text(readField(offer, 'date')));
    const priceFrom = integer(readField(offer, 'price'));
    const actionUrl = text(readField(offer, 'url'));

    if (!id || !title || !region || !startsAt || priceFrom == null || !actionUrl || !isAllowedActionUrl(actionUrl)) {
      return [];
    }
    if (!SUPPORTED_CITIES.includes(region) || region !== input.city) {
      return [];
    }
    if (startsAt < input.from || startsAt > input.to) {
      return [];
    }

    const typePrefix = text(readField(offer, 'typePrefix'));
    const description = cleanHtml(text(readField(offer, 'description')));
    const age = text(readField(offer, 'age'));
    const category = mapCategory(typePrefix);
    const sourceItemId = `offer-${id}`;
    const tags = [typePrefix, age].filter((value): value is string => value != null);

    return [{
      sourceCode: this.code,
      sourceItemId,
      sourceUrl: actionUrl,
      contentKind: 'event',
      city: region,
      timezone: 'Europe/Moscow',
      title,
      description,
      category,
      tags,
      address: null,
      lat: null,
      lng: null,
      startsAt,
      endsAt: null,
      priceFrom,
      currency: text(readField(offer, 'currencyId')) ?? 'RUB',
      venueName: text(readField(offer, 'vendor')),
      imageUrl: normalizeImageUrl(text(readField(offer, 'picture'))),
      actionUrl,
      actionKind: 'affiliate_ticket',
      priceMode: priceFrom > 0 ? 'paid' : 'free',
      isAffiliate: true,
      sourceProvider: TICKETLAND_PROVIDER,
      lastSeenAt: new Date(),
      raw: {
        offerId: id,
        categoryId: text(readField(offer, 'categoryId')),
        typePrefix,
        region,
        websites: this.websites,
      },
    }];
  }
}

export function maskAdvCakeSecrets(value: string) {
  const pass = text(process.env.ADVCAKE_API_PASS);
  let masked = value.replace(/([?&]pass=)[^&\s]+/gi, '$1***');
  if (pass) {
    masked = masked.split(pass).join('***');
  }
  return masked
    .replace(/https:\/\/feeds\.advcake\.[^\s"'<>]+/gi, 'https://feeds.advcake.***/***')
    .replace(/https:\/\/go\.avred\.online\/[^\s"'<>]+/gi, 'https://go.avred.online/***');
}

function extractOffers(payload: unknown): Record<string, unknown>[] {
  const root = object(payload);
  const shop = object(object(root?.yml_catalog)?.shop) ?? object(root?.shop) ?? root;
  const offers = object(shop?.offers)?.offer ?? shop?.offer;
  return array(offers).filter((item): item is Record<string, unknown> => item != null && typeof item === 'object');
}

function findFeedUrl(payload: unknown, feedFormat: string): string | null {
  const queue: unknown[] = [payload];
  while (queue.length > 0) {
    const current = queue.shift();
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    const item = object(current);
    if (!item) {
      continue;
    }
    const format = text(readField(item, 'format', 'feedFormat', 'feed_format', 'type'));
    const url = text(readField(item, 'url', 'feedUrl', 'feed_url', 'link'));
    if (url && (!format || format.toLowerCase() === feedFormat)) {
      return url;
    }
    queue.push(...Object.values(item));
  }
  return null;
}

function isAllowedFeedUrl(value: string) {
  const url = parseUrl(value);
  return url?.protocol === 'https:' && hostMatches(url.hostname, ['feeds.advcake.ru']);
}

function isAllowedActionUrl(value: string) {
  const url = parseUrl(value);
  return url?.protocol === 'https:' && hostMatches(url.hostname, [
    'go.avred.online',
    'ticketland.ru',
    'live.mts.ru',
  ]);
}

function parseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function hostMatches(host: string, allowed: string[]) {
  return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function readField(item: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (item[key] != null) {
      return item[key];
    }
  }
  return null;
}

function mapCategory(value: string | null) {
  if (!value) {
    return 'culture';
  }
  const normalized = value.trim().toLowerCase();
  return CATEGORY_MAP[normalized] ?? CATEGORY_MAP[normalized.replace(/\s+/g, ' ')] ?? 'culture';
}

function cleanHtml(value: string | null) {
  if (!value) {
    return null;
  }
  const withoutTags = decodeEntities(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(withoutTags).replace(/\s+/g, ' ').trim() || null;
}

function normalizeImageUrl(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = parseUrl(value);
  if (
    parsed?.protocol === 'https:' &&
    parsed.hostname === 'api.live.mts.ru' &&
    parsed.pathname.includes('/image-scaling/')
  ) {
    parsed.searchParams.set('ScalingFactor', '4');
    return parsed.toString();
  }
  return value;
}

function parseWebsites() {
  const explicit = text(process.env.ADVCAKE_TICKETLAND_WEBSITES);
  if (explicit) {
    return explicit.split(',').map((item) => item.trim()).filter(Boolean);
  }
  const legacy = text(process.env.ADVCAKE_TICKETLAND_WEBSITE);
  return legacy ? [legacy] : DEFAULT_WEBSITES;
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function parseMoscowDate(value: string | null) {
  if (!value) {
    return null;
  }
  const raw = value.trim();
  const withTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw)
    ? raw
    : `${raw.replace(' ', 'T')}+03:00`;
  const parsed = new Date(withTimezone);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeCity(value: string | null) {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'москва' || normalized === 'moscow') {
    return 'Москва';
  }
  if (
    normalized === 'санкт-петербург' ||
    normalized === 'санкт петербург' ||
    normalized === 'спб' ||
    normalized === 'saint petersburg' ||
    normalized === 'st petersburg'
  ) {
    return 'Санкт-Петербург';
  }
  return value.trim();
}

function ensureTrailingSlash(value: string) {
  return value.endsWith('/') ? value : `${value}/`;
}

function object(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function array(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }
  return value == null ? [] : [value];
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

function numberFromString(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function number(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function integer(value: unknown) {
  const parsed = number(value);
  return parsed == null ? null : Math.max(0, Math.floor(parsed));
}

function positiveInt(value: unknown, fallback: number) {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
