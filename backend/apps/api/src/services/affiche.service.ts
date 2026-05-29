import { Injectable } from '@nestjs/common';
import type {
  AfficheEventDto,
  AfficheEventListDto,
  MediaVariantDto,
} from '@big-break/contracts';
import {
  bboxForContentCity,
  createPresignedDownload,
  decodeCursor,
  encodeCursor,
  objectKeyFromPublicAssetUrl,
} from '@big-break/database';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { Readable } from 'node:stream';
import { ApiError } from '../common/api-error';
import { normalizeSearchQuery } from '../common/search-query';
import { PrismaService } from './prisma.service';

type AfficheCursor = {
  id: string;
  startsAt: Date | null;
  sortPriority?: number | null;
};

type AffichePriorityRow = {
  id: string;
  startsAt: Date | null;
  sortPriority: number;
};

const afficheEventSelect = {
  id: true,
  title: true,
  shortSummary: true,
  city: true,
  timezone: true,
  sourceItemId: true,
  venueName: true,
  address: true,
  lat: true,
  lng: true,
  startsAt: true,
  endsAt: true,
  category: true,
  priceFrom: true,
  priceMode: true,
  currency: true,
  imageUrl: true,
  imageVariants: true,
  sourceProvider: true,
  sourceUrl: true,
  actionUrl: true,
  actionKind: true,
  isAffiliate: true,
  tags: true,
  updatedAt: true,
  source: {
    select: { code: true, name: true },
  },
} satisfies Prisma.ExternalContentItemSelect;

type AfficheEventRecord = Prisma.ExternalContentItemGetPayload<{
  select: typeof afficheEventSelect;
}>;

type AfficheImageNotModified = {
  notModified: true;
  cacheControl: string;
  etag: string;
};

type AfficheImageStream = {
  stream: Readable;
  mimeType: string;
  contentLength: number | null;
  cacheControl: string;
  etag: string;
};

type AfficheClientGeoInput = {
  lat?: unknown;
  lng?: unknown;
  provider?: unknown;
  query?: unknown;
  displayName?: unknown;
  venueName?: unknown;
};

type AfficheClientGeoResult = {
  id: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  saved: boolean;
  code: 'saved' | 'already_has_coords' | 'same_coords';
};

type ClientGeoRateLimitEntry = {
  resetAt: number;
  count: number;
};

const AFFICHE_IMAGE_PROXY_CACHE_SECONDS = 86_400;
const AFFICHE_IMAGE_PROXY_STALE_SECONDS = 604_800;
const AFFICHE_MIRRORED_IMAGE_CACHE_CONTROL =
  'public, max-age=31536000, immutable';
const CLIENT_GEO_PROVIDER = 'yandex_mapkit_client';
const CLIENT_GEO_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const CLIENT_GEO_RATE_LIMIT_COUNT = 10;
const CLIENT_GEO_COORD_EPSILON = 0.00001;
const CLIENT_GEO_STOP_WORDS = new Set([
  'театр',
  'клуб',
  'кафе',
  'ресторан',
  'дом',
  'сцена',
  'зал',
  'центр',
  'московский',
]);
const CLIENT_GEO_PLACE_KIND_WORDS = new Set([
  'улица',
  'ул',
  'проспект',
  'пр',
  'переулок',
  'район',
  'микрорайон',
  'жк',
  'locality',
  'метро',
  'площадь',
  'набережная',
]);

@Injectable()
export class AfficheService {
  private readonly clientGeoRateLimits = new Map<string, ClientGeoRateLimitEntry>();

  constructor(private readonly prismaService: PrismaService) {}

  async listEvents(query: Record<string, unknown> = {}): Promise<AfficheEventListDto> {
    const limit = this.parseLimit(query.limit);
    const city = this.optionalText(query.city) ?? 'Москва';
    const cursor = await this.resolveCursor(this.optionalText(query.cursor));
    const where = this.buildWhere(query, city);
    const cursorWhere = this.buildCursorWhere(cursor);

    if (this.shouldUseDefaultPrioritySort(query)) {
      return this.listPrioritySortedEvents(query, city, limit, cursor);
    }

    const items = await this.prismaService.client.externalContentItem.findMany({
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
      select: afficheEventSelect,
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const page = items.slice(0, limit);
    const next = items.length > limit ? items[limit] : null;
    return {
      items: page.map((item: any) => this.mapEvent(item)),
      nextCursor: next ? this.encodeEventCursor(next) : null,
    };
  }

  async getEvent(eventId: string): Promise<AfficheEventDto> {
    const item = await this.prismaService.client.externalContentItem.findFirst({
      where: {
        id: eventId,
        contentKind: 'event',
        publicStatus: 'published',
        moderationStatus: { not: 'rejected' },
        priceMode: { in: ['free', 'paid'] },
        NOT: this.movieShowingWhere(),
      },
      select: afficheEventSelect,
    });
    if (!item) {
      throw new ApiError(404, 'affiche_event_not_found', 'Affiche event not found');
    }
    return this.mapEvent(item);
  }

  async saveClientGeo(
    eventId: string,
    userId: string,
    sessionId: string | undefined,
    input: AfficheClientGeoInput,
  ): Promise<AfficheClientGeoResult> {
    this.assertClientGeoRateLimit(userId, sessionId);
    const lat = this.parseClientCoordinate(input.lat, 'lat');
    const lng = this.parseClientCoordinate(input.lng, 'lng');
    if (input.provider !== CLIENT_GEO_PROVIDER) {
      throw new ApiError(400, 'client_geo_provider_invalid', 'Client geo provider is invalid');
    }
    const query = this.cleanClientGeoText(typeof input.query === 'string' ? input.query : null);
    if (!query) {
      throw new ApiError(400, 'client_geo_query_required', 'Client geo query is required');
    }

    const item = await this.prismaService.client.externalContentItem.findFirst({
      where: { id: eventId, contentKind: 'event' },
      select: {
        id: true,
        city: true,
        venueName: true,
        address: true,
        lat: true,
        lng: true,
        startsAt: true,
        endsAt: true,
        expiresAt: true,
        priceMode: true,
        actionUrl: true,
        publicStatus: true,
        moderationStatus: true,
        raw: true,
        source: { select: { code: true } },
      },
    });
    if (!item) {
      throw new ApiError(404, 'affiche_event_not_found', 'Affiche event not found');
    }
    if (item.source?.code !== 'advcake_ticketland') {
      throw new ApiError(409, 'client_geo_source_not_supported', 'Client geo source is not supported');
    }
    if (item.moderationStatus === 'rejected') {
      throw new ApiError(409, 'client_geo_event_rejected', 'Rejected affiche event cannot be enriched');
    }
    this.assertClientGeoEventFresh(item);

    if (this.hasValidCoordinatePair(item.lat, item.lng)) {
      return {
        id: item.id,
        lat: item.lat,
        lng: item.lng,
        address: item.address ?? null,
        saved: false,
        code: this.sameClientGeoPoint(item.lat, item.lng, lat, lng)
          ? 'same_coords'
          : 'already_has_coords',
      };
    }

    this.assertPointInCityBbox(item.city, lat, lng);
    this.assertVenueSimilar({
      eventVenueName: item.venueName,
      submittedVenueName: typeof input.venueName === 'string' ? input.venueName : null,
      displayName: typeof input.displayName === 'string' ? input.displayName : null,
      query,
    });

    const safeDisplayName = this.safeClientGeoDisplayName(
      typeof input.displayName === 'string' ? input.displayName : null,
    );
    const address = item.address?.trim() || safeDisplayName || null;
    const fields = ['lat', 'lng'];
    if (!item.address && safeDisplayName) {
      fields.push('address');
    }
    const raw = this.mergeClientGeoRaw(item.raw, {
      provider: CLIENT_GEO_PROVIDER,
      role: 'client_affiche_geo_enriched',
      query,
      displayName: safeDisplayName,
      geoConfidence: 'client_place_search',
      updatedByUserId: userId,
      fields,
    });
    const shouldPublish =
      item.priceMode === 'paid' &&
      typeof item.actionUrl === 'string' &&
      item.actionUrl.trim().length > 0 &&
      item.moderationStatus !== 'rejected';

    const updated = await this.prismaService.client.externalContentItem.update({
      where: { id: item.id },
      data: {
        lat,
        lng,
        ...(address != null && !item.address ? { address } : {}),
        raw: raw as Prisma.InputJsonValue,
        ...(shouldPublish ? { publicStatus: 'published' } : {}),
      },
    });
    await this.prismaService.client.event.updateMany({
      where: {
        sourceExternalContentItemId: item.id,
        OR: [{ latitude: null }, { longitude: null }],
      },
      data: {
        latitude: lat,
        longitude: lng,
      },
    });

    return {
      id: updated.id,
      lat: updated.lat ?? lat,
      lng: updated.lng ?? lng,
      address: updated.address ?? address,
      saved: true,
      code: 'saved',
    };
  }

  async getImage(
    objectKey: unknown,
    externalUrl?: unknown,
    ifNoneMatch?: string,
  ): Promise<AfficheImageNotModified | AfficheImageStream> {
    const key = this.optionalText(objectKey);
    const proxiedUrl = this.safeExternalImageUrl(externalUrl);
    if ((!key || !key.startsWith('external-content/')) && !proxiedUrl) {
      throw new ApiError(404, 'affiche_image_not_found', 'Affiche image not found');
    }

    const mirroredImage = key?.startsWith('external-content/') === true;
    const imageSource = mirroredImage ? key! : proxiedUrl!;
    const etag = this.buildImageEtag(imageSource);
    const cacheControl = mirroredImage
      ? AFFICHE_MIRRORED_IMAGE_CACHE_CONTROL
      : this.proxyImageCacheControl();
    if (this.isFreshRequest(etag, ifNoneMatch)) {
      return {
        notModified: true,
        cacheControl,
        etag,
      };
    }

    const fetchTarget = key?.startsWith('external-content/')
      ? await createPresignedDownload(key)
      : { url: this.externalImageFetchUrl(proxiedUrl!) };
    let upstream: Response;
    try {
      upstream = await fetch(
        fetchTarget.url,
        mirroredImage
          ? undefined
          : {
              headers: this.externalImageFetchHeaders(),
            },
      );
    } catch {
      throw new ApiError(404, 'affiche_image_not_found', 'Affiche image not found');
    }
    if (!upstream.ok || !upstream.body) {
      throw new ApiError(404, 'affiche_image_not_found', 'Affiche image not found');
    }
    const mimeType =
      upstream.headers.get('content-type') ?? 'application/octet-stream';
    if (!mimeType.toLowerCase().startsWith('image/')) {
      throw new ApiError(404, 'affiche_image_not_found', 'Affiche image not found');
    }

    return {
      stream: Readable.fromWeb(upstream.body as any),
      mimeType,
      contentLength: this.parseContentLength(upstream.headers.get('content-length')),
      cacheControl,
      etag,
    };
  }

  async getImageRedirect(objectKey: unknown, ifNoneMatch?: string) {
    return this.getImage(objectKey, undefined, ifNoneMatch);
  }

  private buildImageEtag(objectKey: string) {
    const hash = createHash('sha1').update(objectKey).digest('hex').slice(0, 16);
    return `W/"affiche-image-${hash}"`;
  }

  private isFreshRequest(etag: string, ifNoneMatch?: string) {
    return (
      ifNoneMatch
        ?.split(',')
        .map((value) => value.trim())
        .some((value) => value === '*' || value === etag) ?? false
    );
  }

  private parseContentLength(value: string | null) {
    if (!value) {
      return null;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  private buildWhere(query: Record<string, unknown>, city: string): Prisma.ExternalContentItemWhereInput {
    const priceMode = this.parsePriceMode(query.priceMode);
    const dateRange = this.parseDateRange(query);
    const source = this.optionalText(query.source);
    const category = this.optionalText(query.category);
    const standupCategory = category === 'standup';
    const search = normalizeSearchQuery(this.optionalText(query.q) ?? undefined);
    const featured = this.parseBoolean(query.featured);

    return {
      city,
      contentKind: 'event',
      publicStatus: 'published',
      moderationStatus: { not: 'rejected' },
      priceMode: priceMode === 'any' ? { in: ['free', 'paid'] } : priceMode,
      NOT: this.movieShowingWhere(),
      ...(source ? { source: { code: source } } : {}),
      ...(category && !standupCategory ? { category } : {}),
      ...(standupCategory ? { AND: [this.buildStandupCategoryWhere()] } : {}),
      ...(featured === true ? { imageUrl: { not: null } } : {}),
      ...(dateRange
        ? { startsAt: { gte: dateRange.from, lt: dateRange.to } }
        : { startsAt: { gte: new Date() } }),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { shortSummary: { contains: search, mode: 'insensitive' } },
              { venueName: { contains: search, mode: 'insensitive' } },
              { address: { contains: search, mode: 'insensitive' } },
              { category: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private buildStandupCategoryWhere(): Prisma.ExternalContentItemWhereInput {
    return {
      OR: [
        { category: 'standup' },
        { title: { contains: 'стендап', mode: 'insensitive' } },
        { title: { contains: 'standup', mode: 'insensitive' } },
        { title: { contains: 'stand up', mode: 'insensitive' } },
        { title: { contains: 'stand-up', mode: 'insensitive' } },
        ...['стендап', 'standup', 'stand up', 'stand-up', 'comedy-club'].map(
          (tag) => ({ tags: { array_contains: [tag] } }),
        ),
      ],
    };
  }

  private shouldUseDefaultPrioritySort(query: Record<string, unknown>) {
    if (typeof this.prismaService.client.$queryRaw !== 'function') {
      return false;
    }
    return (
      !this.optionalText(query.category) &&
      !normalizeSearchQuery(this.optionalText(query.q) ?? undefined)
    );
  }

  private async listPrioritySortedEvents(
    query: Record<string, unknown>,
    city: string,
    limit: number,
    cursor: AfficheCursor | null,
  ): Promise<AfficheEventListDto> {
    const priorityCursor = await this.resolvePriorityCursor(cursor);
    const rows = await this.prismaService.client.$queryRaw<AffichePriorityRow[]>(
      Prisma.sql`
        SELECT
          item."id",
          item."startsAt",
          ${this.defaultAfficheSortPrioritySql()} AS "sortPriority"
        FROM "ExternalContentItem" item
        LEFT JOIN "ExternalContentSource" source
          ON source."id" = item."sourceId"
        WHERE ${this.buildPrioritySortWhereSql(query, city, priorityCursor)}
        ORDER BY "sortPriority" ASC, item."startsAt" ASC, item."id" ASC
        LIMIT ${limit + 1}
      `,
    );
    const pageRows = rows.slice(0, limit);
    const next = rows.length > limit ? rows[limit] : null;
    if (pageRows.length === 0) {
      return { items: [], nextCursor: null };
    }

    const records = await this.prismaService.client.externalContentItem.findMany({
      where: { id: { in: pageRows.map((row) => row.id) } },
      select: afficheEventSelect,
    });
    const recordsById = new Map(records.map((record) => [record.id, record]));
    const items = pageRows
      .map((row) => recordsById.get(row.id))
      .filter((record): record is AfficheEventRecord => record != null);

    return {
      items: items.map((item: any) => this.mapEvent(item)),
      nextCursor: next ? this.encodeEventCursor(next) : null,
    };
  }

  private buildPrioritySortWhereSql(
    query: Record<string, unknown>,
    city: string,
    cursor: AfficheCursor | null,
  ) {
    const priceMode = this.parsePriceMode(query.priceMode);
    const dateRange = this.parseDateRange(query);
    const source = this.optionalText(query.source);
    const featured = this.parseBoolean(query.featured);
    const clauses = [
      Prisma.sql`item."city" = ${city}`,
      Prisma.sql`item."contentKind" = 'event'`,
      Prisma.sql`item."publicStatus" = 'published'`,
      Prisma.sql`item."moderationStatus" <> 'rejected'`,
      Prisma.sql`COALESCE(item."raw"->>'kind', '') <> 'movie_showing'`,
      priceMode === 'any'
        ? Prisma.sql`item."priceMode" IN ('free', 'paid')`
        : Prisma.sql`item."priceMode" = ${priceMode}`,
      dateRange
        ? Prisma.sql`item."startsAt" >= ${dateRange.from} AND item."startsAt" < ${dateRange.to}`
        : Prisma.sql`item."startsAt" >= ${new Date()}`,
    ];

    if (source) {
      clauses.push(Prisma.sql`source."code" = ${source}`);
    }
    if (featured === true) {
      clauses.push(Prisma.sql`item."imageUrl" IS NOT NULL`);
    }
    if (cursor?.sortPriority != null && cursor.startsAt != null) {
      const priority = this.defaultAfficheSortPrioritySql();
      clauses.push(Prisma.sql`(
        ${priority} > ${cursor.sortPriority}
        OR (
          ${priority} = ${cursor.sortPriority}
          AND (
            item."startsAt" > ${cursor.startsAt}
            OR (item."startsAt" = ${cursor.startsAt} AND item."id" > ${cursor.id})
          )
        )
      )`);
    }

    return Prisma.join(clauses, ' AND ');
  }

  private defaultAfficheSortPrioritySql() {
    return Prisma.sql`CASE
      WHEN (
        item."category" = 'standup'
        OR item."title" ILIKE '%стендап%'
        OR item."title" ILIKE '%standup%'
        OR item."title" ILIKE '%stand up%'
        OR item."title" ILIKE '%stand-up%'
        OR item."tags" @> '["стендап"]'::jsonb
        OR item."tags" @> '["standup"]'::jsonb
        OR item."tags" @> '["stand up"]'::jsonb
        OR item."tags" @> '["stand-up"]'::jsonb
        OR item."tags" @> '["comedy-club"]'::jsonb
      ) THEN 0
      WHEN item."category" = 'concert' THEN 1
      ELSE 2
    END`;
  }

  private parsePriceMode(value: unknown): 'free' | 'paid' | 'any' {
    const raw = this.optionalText(value);
    return raw === 'free' || raw === 'paid' || raw === 'any' ? raw : 'any';
  }

  private parseBoolean(value: unknown): boolean | null {
    const raw = this.optionalText(value);
    if (raw === 'true' || raw === '1') {
      return true;
    }
    if (raw === 'false' || raw === '0') {
      return false;
    }
    return null;
  }

  private parseDateRange(query: Record<string, unknown>) {
    const singleDate = this.optionalText(query.date);
    if (singleDate && singleDate !== 'any') {
      return oneDayRange(singleDate);
    }
    const from = this.optionalDate(query.dateFrom);
    const to = this.optionalDate(query.dateTo);
    if (!from && !to) {
      return null;
    }
    return {
      from: from ?? new Date(),
      to: to ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    };
  }

  private async resolveCursor(cursor?: string | null): Promise<AfficheCursor | null> {
    if (!cursor) {
      return null;
    }
    let cursorId: string | null = null;
    let startsAt: Date | null = null;
    try {
      const decoded = decodeCursor(cursor);
      cursorId = decoded?.value ?? null;
      startsAt = this.dateFromUnknown(decoded?.startsAt);
      const sortPriority = Number(decoded?.sortPriority);
      if (cursorId && startsAt) {
        return {
          id: cursorId,
          startsAt,
          sortPriority: Number.isFinite(sortPriority) ? sortPriority : null,
        };
      }
    } catch {
      cursorId = cursor;
    }
    if (!cursorId) {
      return null;
    }
    if (startsAt) {
      return { id: cursorId, startsAt };
    }
    const item = await this.prismaService.client.externalContentItem.findUnique({
      where: { id: cursorId },
      select: { id: true, startsAt: true, category: true, title: true, tags: true },
    });
    return item
      ? {
          id: item.id,
          startsAt: item.startsAt,
          sortPriority: this.defaultAfficheSortPriority(item),
        }
      : null;
  }

  private async resolvePriorityCursor(cursor: AfficheCursor | null) {
    if (!cursor || cursor.sortPriority != null) {
      return cursor;
    }
    const item = await this.prismaService.client.externalContentItem.findUnique({
      where: { id: cursor.id },
      select: { id: true, startsAt: true, category: true, title: true, tags: true },
    });
    return item
      ? {
          id: item.id,
          startsAt: item.startsAt,
          sortPriority: this.defaultAfficheSortPriority(item),
        }
      : cursor;
  }

  private defaultAfficheSortPriority(item: {
    category: string | null;
    title: string | null;
    tags: unknown;
  }) {
    const title = (item.title ?? '').toLowerCase();
    const tags = Array.isArray(item.tags)
      ? item.tags.filter((tag): tag is string => typeof tag === 'string')
      : [];
    if (
      item.category === 'standup' ||
      title.includes('стендап') ||
      title.includes('standup') ||
      title.includes('stand up') ||
      title.includes('stand-up') ||
      tags.some((tag) =>
        ['стендап', 'standup', 'stand up', 'stand-up', 'comedy-club'].includes(
          tag.toLowerCase(),
        ),
      )
    ) {
      return 0;
    }
    if (item.category === 'concert') {
      return 1;
    }
    return 2;
  }

  private buildCursorWhere(cursor: AfficheCursor | null): Prisma.ExternalContentItemWhereInput | null {
    if (!cursor) {
      return null;
    }
    if (!cursor.startsAt) {
      return { id: { gt: cursor.id } };
    }
    return {
      OR: [
        { startsAt: { gt: cursor.startsAt } },
        { startsAt: cursor.startsAt, id: { gt: cursor.id } },
      ],
    };
  }

  private encodeEventCursor(item: AfficheCursor) {
    return encodeCursor({
      value: item.id,
      startsAt: item.startsAt?.toISOString() ?? null,
      ...(item.sortPriority != null ? { sortPriority: item.sortPriority } : {}),
    });
  }

  private mapEvent(item: AfficheEventRecord): AfficheEventDto {
    return {
      id: item.id,
      sourceItemId: item.sourceItemId ?? null,
      title: cleanPublicText(item.title) ?? item.title,
      description: cleanPublicText(item.shortSummary),
      city: item.city,
      venue: cleanPublicText(item.venueName),
      address: cleanPublicText(item.address),
      lat: item.lat ?? null,
      lng: item.lng ?? null,
      startsAt: this.dateToIso(item.startsAt),
      endsAt: this.dateToIso(item.endsAt),
      dateLabel: this.dateLabel(item.startsAt, item.timezone),
      timeLabel: this.timeLabel(item.startsAt, item.timezone),
      category: item.category,
      priceFrom: item.priceFrom ?? null,
      priceMode: item.priceMode === 'free' || item.priceMode === 'paid' ? item.priceMode : 'unknown',
      currency: item.currency ?? null,
      imageUrl: this.mapImageUrl(item.imageUrl),
      imageVariants: this.mapImageVariants(item.imageVariants),
      provider: cleanPublicText(item.sourceProvider ?? item.source?.name ?? null),
      sourceCode: item.source?.code ?? null,
      actionUrl: item.actionUrl ?? item.sourceUrl ?? null,
      actionKind: item.actionKind ?? null,
      isAffiliate: item.isAffiliate === true,
      tags: Array.isArray(item.tags)
        ? item.tags
          .map((tag: unknown) => cleanPublicText(tag))
          .filter((tag): tag is string => tag != null)
        : [],
      geoUpdatedAt:
        this.hasValidCoordinatePair(item.lat, item.lng) && item.updatedAt
          ? item.updatedAt.toISOString()
          : null,
    };
  }

  private assertClientGeoRateLimit(userId: string, sessionId?: string) {
    const now = Date.now();
    const key = `${userId}:${sessionId?.trim() || 'unknown'}`;
    const current = this.clientGeoRateLimits.get(key);
    if (!current || current.resetAt <= now) {
      this.clientGeoRateLimits.set(key, {
        count: 1,
        resetAt: now + CLIENT_GEO_RATE_LIMIT_WINDOW_MS,
      });
      return;
    }
    if (current.count >= CLIENT_GEO_RATE_LIMIT_COUNT) {
      throw new ApiError(429, 'client_geo_rate_limited', 'Client geo rate limit exceeded');
    }
    current.count += 1;
  }

  private parseClientCoordinate(value: unknown, field: 'lat' | 'lng') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ApiError(400, `client_geo_${field}_invalid`, `${field} is invalid`);
    }
    if (
      field === 'lat'
        ? value < -90 || value > 90
        : value < -180 || value > 180
    ) {
      throw new ApiError(400, `client_geo_${field}_invalid`, `${field} is invalid`);
    }
    if (value === 0) {
      throw new ApiError(400, `client_geo_${field}_invalid`, `${field} is invalid`);
    }
    return value;
  }

  private assertClientGeoEventFresh(item: {
    startsAt: Date | null;
    endsAt: Date | null;
    expiresAt: Date | null;
  }) {
    const now = Date.now();
    const expiry = item.expiresAt ?? item.endsAt;
    if (expiry && expiry.getTime() < now) {
      throw new ApiError(409, 'client_geo_event_expired', 'Affiche event is expired');
    }
    if (!expiry && item.startsAt && item.startsAt.getTime() < now - 24 * 60 * 60 * 1000) {
      throw new ApiError(409, 'client_geo_event_expired', 'Affiche event is expired');
    }
  }

  private assertPointInCityBbox(city: string, lat: number, lng: number) {
    const bbox = bboxForContentCity(city);
    if (!bbox) {
      throw new ApiError(400, 'client_geo_city_bbox_missing', 'City bbox is missing');
    }
    const values = bbox.split(',').map((value) => Number.parseFloat(value));
    if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
      throw new ApiError(400, 'client_geo_city_bbox_missing', 'City bbox is missing');
    }
    const south = values[0]!;
    const west = values[1]!;
    const north = values[2]!;
    const east = values[3]!;
    if (lat < south || lat > north || lng < west || lng > east) {
      throw new ApiError(400, 'client_geo_out_of_city_bbox', 'Client geo point is outside city bbox');
    }
  }

  private assertVenueSimilar(params: {
    eventVenueName: string | null;
    submittedVenueName?: string | null;
    displayName?: string | null;
    query: string;
  }) {
    const eventTokens = this.significantVenueTokens(params.eventVenueName);
    if (eventTokens.size === 0) {
      throw new ApiError(400, 'client_geo_venue_missing', 'Event venue name is missing');
    }
    const candidateText = [
      params.submittedVenueName,
      params.displayName,
      params.query,
    ].filter((value): value is string => typeof value === 'string').join(' ');
    const candidateTokens = this.significantVenueTokens(candidateText);
    const hasMatch = [...eventTokens].some((token) => candidateTokens.has(token));
    if (!hasMatch) {
      throw new ApiError(400, 'client_geo_venue_mismatch', 'Client geo venue does not match event venue');
    }
    if (this.looksLikeNonVenuePlace(params.displayName ?? params.query) && candidateTokens.size <= 1) {
      throw new ApiError(400, 'client_geo_venue_mismatch', 'Client geo result is not a venue');
    }
  }

  private significantVenueTokens(value?: string | null) {
    const normalized = this.normalizeVenueText(value);
    const tokens = normalized
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length > 1 && !CLIENT_GEO_STOP_WORDS.has(token));
    return new Set(tokens);
  }

  private normalizeVenueText(value?: string | null) {
    return (value ?? '')
      .toLowerCase()
      .replaceAll('ё', 'е')
      .replace(/["'«»“”„`]/g, ' ')
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private looksLikeNonVenuePlace(value: string) {
    const tokens = new Set(this.normalizeVenueText(value).split(' ').filter(Boolean));
    return [...CLIENT_GEO_PLACE_KIND_WORDS].some((token) => tokens.has(token));
  }

  private safeClientGeoDisplayName(value?: string | null) {
    const cleaned = this.cleanClientGeoText(value);
    if (!cleaned || cleaned.length > 160 || /^https?:\/\//i.test(cleaned)) {
      return null;
    }
    return cleaned;
  }

  private cleanClientGeoText(value?: string | null) {
    const cleaned = value?.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    return cleaned && cleaned.length > 0 ? cleaned : null;
  }

  private mergeClientGeoRaw(raw: unknown, enrichment: Prisma.InputJsonObject) {
    const base =
      raw != null && typeof raw === 'object' && !Array.isArray(raw)
        ? { ...(raw as Prisma.InputJsonObject) }
        : {};
    return {
      ...base,
      enrichment,
    };
  }

  private sameClientGeoPoint(
    currentLat: number | null,
    currentLng: number | null,
    nextLat: number,
    nextLng: number,
  ) {
    return (
      typeof currentLat === 'number' &&
      typeof currentLng === 'number' &&
      Math.abs(currentLat - nextLat) <= CLIENT_GEO_COORD_EPSILON &&
      Math.abs(currentLng - nextLng) <= CLIENT_GEO_COORD_EPSILON
    );
  }

  private hasValidCoordinatePair(lat: unknown, lng: unknown): lat is number {
    return typeof lat === 'number' &&
      typeof lng === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      !(lat === 0 && lng === 0);
  }

  private mapImageUrl(imageUrl: string | null) {
    const trimmed = imageUrl?.trim();
    if (!trimmed) {
      return null;
    }

    const objectKey = this.publicAssetObjectKeyFromUrl(trimmed);
    if (!objectKey?.startsWith('external-content/')) {
      const proxiedUrl = this.safeExternalImageUrl(trimmed);
      return proxiedUrl ? `/affiche/images?url=${encodeURIComponent(proxiedUrl)}` : trimmed;
    }

    return trimmed;
  }

  private mapImageVariants(raw: unknown): Record<string, MediaVariantDto> {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
      return {};
    }

    const variants: Record<string, MediaVariantDto> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (value == null || typeof value !== 'object' || Array.isArray(value)) {
        continue;
      }
      const variant = value as Record<string, unknown>;
      const url = this.mapImageUrl(
        typeof variant.url === 'string' ? variant.url : null,
      );
      const downloadUrl = this.mapImageUrl(
        typeof variant.downloadUrl === 'string'
          ? variant.downloadUrl
          : typeof variant.url === 'string'
            ? variant.url
            : null,
      );
      if (url == null && downloadUrl == null) {
        continue;
      }

      variants[key] = {
        url,
        downloadUrl,
        downloadUrlPath:
          typeof variant.downloadUrlPath === 'string'
            ? variant.downloadUrlPath.trim()
            : null,
        mimeType:
          typeof variant.mimeType === 'string' ? variant.mimeType.trim() : null,
        byteSize:
          typeof variant.byteSize === 'number' && Number.isFinite(variant.byteSize)
            ? Math.max(0, Math.trunc(variant.byteSize))
            : null,
        width:
          typeof variant.width === 'number' && Number.isFinite(variant.width)
            ? Math.max(0, Math.trunc(variant.width))
            : null,
        height:
          typeof variant.height === 'number' && Number.isFinite(variant.height)
            ? Math.max(0, Math.trunc(variant.height))
            : null,
        cacheKey:
          typeof variant.cacheKey === 'string' ? variant.cacheKey.trim() : null,
        expiresAt:
          typeof variant.expiresAt === 'string' ? variant.expiresAt.trim() : null,
      };
    }
    return variants;
  }

  private publicAssetObjectKeyFromUrl(url: string) {
    try {
      return objectKeyFromPublicAssetUrl(url);
    } catch {
      return null;
    }
  }

  private proxyImageCacheControl() {
    const maxAge = this.positiveInteger(
      process.env.AFFICHE_IMAGE_PROXY_CACHE_SECONDS,
      AFFICHE_IMAGE_PROXY_CACHE_SECONDS,
    );
    const stale = this.positiveInteger(
      process.env.AFFICHE_IMAGE_PROXY_STALE_SECONDS,
      AFFICHE_IMAGE_PROXY_STALE_SECONDS,
    );
    return `public, max-age=${maxAge}, stale-while-revalidate=${stale}`;
  }

  private externalImageFetchHeaders() {
    return {
      accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
      'user-agent':
        process.env.AFFICHE_IMAGE_PROXY_USER_AGENT ??
        'FrendlyImageProxy/1.0 (+https://frendly.tech)',
    };
  }

  private externalImageFetchUrl(url: string) {
    const nestedUrl = this.nestedMtsLiveImageUrl(url);
    return nestedUrl ?? url;
  }

  private nestedMtsLiveImageUrl(url: string) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (
      parsed.hostname !== 'api.live.mts.ru' ||
      !parsed.pathname.includes('/image-scaling/')
    ) {
      return null;
    }

    const nested = this.safeExternalImageUrl(parsed.searchParams.get('Url'));
    return nested?.startsWith('https://media.ticketland.ru/') ? nested : null;
  }

  private positiveInteger(value: string | undefined, fallback: number) {
    if (!value) {
      return fallback;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private safeExternalImageUrl(value: unknown) {
    const raw = this.optionalText(value);
    if (!raw) {
      return null;
    }
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return null;
    }
    if (parsed.protocol !== 'https:') {
      return null;
    }
    const allowedHosts = new Set([
      'api.live.mts.ru',
      'media.ticketland.ru',
      'kudago.com',
      'static.kudago.com',
      'img.kudago.com',
    ]);
    return allowedHosts.has(parsed.hostname) ? parsed.toString() : null;
  }

  private parseLimit(value: unknown) {
    const parsed = typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : 24;
    if (!Number.isFinite(parsed)) {
      return 24;
    }
    return Math.min(50, Math.max(1, Math.floor(parsed)));
  }

  private optionalDate(value: unknown) {
    const raw = this.optionalText(value);
    if (!raw) {
      return null;
    }
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private dateFromUnknown(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private optionalText(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private dateToIso(value: Date | null | undefined) {
    return value ? value.toISOString() : null;
  }

  private dateLabel(value: Date | null | undefined, timezone: string | null | undefined) {
    if (!value) {
      return null;
    }
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      timeZone: timezone ?? 'Europe/Moscow',
    }).format(value);
  }

  private timeLabel(value: Date | null | undefined, timezone: string | null | undefined) {
    if (!value) {
      return null;
    }
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone ?? 'Europe/Moscow',
    }).format(value);
  }

  private movieShowingWhere(): Prisma.ExternalContentItemWhereInput {
    return { raw: { path: ['kind'], equals: 'movie_showing' } as any };
  }
}

function oneDayRange(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const from = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(from.getTime())) {
    return null;
  }
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 1);
  return { from, to };
}

function cleanPublicText(value: unknown, maxLength = 1000) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength).trim() : trimmed;
}

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    laquo: '\u00ab',
    lt: '<',
    mdash: '\u2014',
    nbsp: ' ',
    ndash: '\u2013',
    quot: '"',
    raquo: '\u00bb',
  };
  return value
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match)
    .replace(/&#(\d+);/g, (match, code: string) => {
      const parsed = Number.parseInt(code, 10);
      return Number.isFinite(parsed) ? safeCodePoint(parsed, match) : match;
    })
    .replace(/&#x([0-9a-f]+);/gi, (match, code: string) => {
      const parsed = Number.parseInt(code, 16);
      return Number.isFinite(parsed) ? safeCodePoint(parsed, match) : match;
    });
}

function safeCodePoint(code: number, fallback: string) {
  try {
    return String.fromCodePoint(code);
  } catch {
    return fallback;
  }
}
