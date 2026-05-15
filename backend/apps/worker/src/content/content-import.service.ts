import { Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { maskAdvCakeSecrets } from './advcake-ticketland.adapter';
import { dayKey, eventDuplicateMatch } from './content-deduplication.service';
import { ContentNormalizerService } from './content-normalizer.service';
import { ContentImageMirrorService } from './content-image-mirror.service';
import { ContentVenueGeocoderService, type VenueGeocodeResult } from './content-venue-geocoder.service';
import { ExternalSourceRegistry } from './external-source.registry';
import { cityCodesForSource, timezoneForCity } from './supported-cities';
import type {
  ExternalRawItem,
  ExternalSourceAdapter,
  ExternalSourceCode,
  ExternalSourceFetchInput,
  NormalizedExternalContentItem,
} from './content-source.types';

export type ContentImportInput = {
  city: string;
  sources: ExternalSourceCode[];
  from: Date;
  to: Date;
  importMode?: string | null;
  catalogOffset?: number | null;
  catalogLimit?: number | null;
};

const DEFAULT_IMPORT_TIMEOUT_MS = 1_800_000;
const TOMESTO_PLACES_CATALOG_MODE = 'tomesto_places_catalog';
const DEFAULT_TOMESTO_CATALOG_BATCH_SIZE = 250;
const PUBLIC_STATUS_PUBLISHED = 'published';
const PUBLIC_STATUS_HIDDEN = 'hidden';
const PUBLIC_STATUS_STALE = 'stale';
const STALE_GRACE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DUPLICATE_PRELOAD_LIMIT = 1000;
const DEFAULT_IMAGE_BACKFILL_LIMIT = 50;

type DuplicateCandidateCache = Map<string, Promise<EventDuplicateCandidate[]>>;
type PlaceCandidateCache = Map<string, Promise<PlaceCandidate | null>>;
type GeocodeCache = Map<string, Promise<VenueGeocodeResult | null>>;

type EventDuplicateCandidate = {
  id: string;
  sourceItemId: string;
  sourceUrl: string | null;
  contentKind: 'place' | 'event';
  city: string;
  title: string;
  venueName: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  startsAt: Date | null;
  priceMode: string;
  publicStatus: string;
  actionUrl: string | null;
  raw: unknown;
  source: { code: ExternalSourceCode; name: string } | null;
};

type PlaceCandidate = {
  id: string;
  sourceItemId: string;
  title: string;
  venueName: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  raw: unknown;
  source: { code: ExternalSourceCode; name: string } | null;
};

type ImportCounters = {
  fetchedCount: number;
  normalizedCount: number;
  skippedCount: number;
  publishedCount: number;
  paidCount: number;
  freeCount: number;
  unknownPriceCount: number;
  missingCoordsCount: number;
};

const EVENT_DUPLICATE_CANDIDATE_SELECT = {
  id: true,
  sourceItemId: true,
  sourceUrl: true,
  contentKind: true,
  city: true,
  title: true,
  venueName: true,
  address: true,
  lat: true,
  lng: true,
  startsAt: true,
  priceMode: true,
  publicStatus: true,
  actionUrl: true,
  raw: true,
  source: {
    select: {
      code: true,
      name: true,
    },
  },
} satisfies Prisma.ExternalContentItemSelect;

const PLACE_CANDIDATE_SELECT = {
  id: true,
  sourceItemId: true,
  title: true,
  venueName: true,
  address: true,
  lat: true,
  lng: true,
  raw: true,
  source: {
    select: {
      code: true,
      name: true,
    },
  },
} satisfies Prisma.ExternalContentItemSelect;

const AFFILIATE_PLACE_SOURCE_CODES: ExternalSourceCode[] = ['kudago', 'tomesto'];
const GENERIC_AFFILIATE_VENUE_NAMES = new Set([
  'бар',
  'зал',
  'кафе',
  'клуб',
  'музей',
  'театр',
  'ресторан',
  'концертный зал',
  'малый зал',
  'большой зал',
  'пешеходные экскурсии',
  'экскурсии пешие',
  'экскурсии',
]);

@Injectable()
export class ContentImportService {
  private readonly timeoutMs = positiveInt(process.env.CONTENT_IMPORT_TIMEOUT_MS, DEFAULT_IMPORT_TIMEOUT_MS);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly normalizer: ContentNormalizerService,
    private readonly registry: ExternalSourceRegistry,
    @Optional() private readonly imageMirror?: ContentImageMirrorService,
    @Optional() private readonly venueGeocoder?: ContentVenueGeocoderService,
  ) {}

  async runImport(input: ContentImportInput) {
    const runs = [];
    for (const adapter of this.registry.getAdapters(input.sources)) {
      const sourceInfo = this.registry.getInfo(adapter.code);
      const source = await this.prismaService.client.externalContentSource.upsert({
        where: { code: sourceInfo.code },
        create: {
          code: sourceInfo.code,
          name: sourceInfo.name,
          kind: sourceInfo.kind,
          baseUrl: sourceInfo.baseUrl,
          status: 'active',
          cityCodes: cityCodesForSource(sourceInfo.code) as Prisma.InputJsonValue,
          config: safeJson(sourceInfo.config ?? {}),
        },
        update: {
          name: sourceInfo.name,
          kind: sourceInfo.kind,
          baseUrl: sourceInfo.baseUrl,
          cityCodes: cityCodesForSource(sourceInfo.code) as Prisma.InputJsonValue,
          config: safeJson(sourceInfo.config ?? {}),
        },
      });
      const run = await this.prismaService.client.externalImportRun.create({
        data: {
          sourceId: source.id,
          city: input.city,
          status: 'running',
          metadata: {
            from: input.from.toISOString(),
            to: input.to.toISOString(),
            ...(input.importMode ? { importMode: input.importMode } : {}),
            ...(input.catalogOffset != null ? { catalogOffset: input.catalogOffset } : {}),
            ...(input.catalogLimit != null ? { catalogLimit: input.catalogLimit } : {}),
          },
        },
      });
      runs.push(run);
      await this.executeRun({
        runId: run.id,
        sourceId: source.id,
        sourceCode: adapter.code,
        city: input.city,
        from: input.from,
        to: input.to,
        importMode: input.importMode,
        catalogOffset: input.catalogOffset,
        catalogLimit: input.catalogLimit,
      });
    }
    return runs;
  }

  async processPendingManualRuns(limit = 10) {
    await this.failStaleRunningRuns();
    const runs = await this.prismaService.client.externalImportRun.findMany({
      where: { status: 'pending_manual' },
      select: {
        id: true,
        sourceId: true,
        city: true,
        metadata: true,
        source: {
          select: {
            code: true,
          },
        },
      },
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });

    for (const run of runs as any[]) {
      const metadata = object(run.metadata);
      const from = parseDate(metadata?.from) ?? new Date();
      const to = parseDate(metadata?.to) ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await this.prismaService.client.externalImportRun.update({
        where: { id: run.id },
        data: { status: 'running', startedAt: new Date(), finishedAt: null, errorCode: null, errorMessage: null },
      });
      await this.executeRun({
        runId: run.id,
        sourceId: run.sourceId,
        sourceCode: run.source.code,
        city: run.city,
        from,
        to,
        importMode: optionalString(metadata?.importMode),
        catalogOffset: optionalNonNegativeInteger(metadata?.catalogOffset),
        catalogLimit: optionalPositiveInteger(metadata?.catalogLimit),
      });
    }
  }

  async backfillMirroredImages(
    input: { city?: string; limit?: number } = {},
  ) {
    if (!this.imageMirror) {
      return { scanned: 0, mirrored: 0 };
    }

    const take = boundedPositiveInt(
      input.limit,
      positiveInt(
        process.env.CONTENT_IMPORT_IMAGE_BACKFILL_BATCH_SIZE,
        DEFAULT_IMAGE_BACKFILL_LIMIT,
      ),
      500,
    );
    const rows = await this.prismaService.client.externalContentItem.findMany({
      where: {
        contentKind: 'event',
        publicStatus: PUBLIC_STATUS_PUBLISHED,
        imageUrl: { not: null },
        ...(input.city ? { city: input.city } : {}),
      },
      select: {
        id: true,
        sourceItemId: true,
        imageUrl: true,
        source: {
          select: {
            code: true,
          },
        },
      },
      orderBy: [{ importedAt: 'desc' }, { id: 'asc' }],
      take,
    });

    let mirrored = 0;
    for (const row of rows) {
      const nextUrl = await this.imageMirror.mirrorImageUrl({
        sourceCode: row.source.code,
        sourceItemId: row.sourceItemId,
        imageUrl: row.imageUrl,
      });
      if (!nextUrl || nextUrl === row.imageUrl) {
        continue;
      }

      await this.prismaService.client.externalContentItem.update({
        where: { id: row.id },
        data: { imageUrl: nextUrl },
      });
      mirrored += 1;
    }

    if (rows.length > 0) {
      console.info('[content-import] image backfill completed', {
        city: input.city ?? null,
        scanned: rows.length,
        mirrored,
      });
    }

    return { scanned: rows.length, mirrored };
  }

  private async failStaleRunningRuns() {
    const staleAfterMs = Math.max(
      this.timeoutMs + 60_000,
      positiveInt(process.env.CONTENT_IMPORT_STALE_RUNNING_MS, 0),
    );
    const now = new Date();
    const cutoff = new Date(now.getTime() - staleAfterMs);
    const staleRuns = await this.prismaService.client.externalImportRun.findMany({
      where: {
        status: 'running',
        startedAt: { lt: cutoff },
      },
      select: {
        id: true,
        sourceId: true,
        city: true,
        metadata: true,
        source: {
          select: {
            code: true,
          },
        },
      },
    });
    const result = await this.prismaService.client.externalImportRun.updateMany({
      where: {
        status: 'running',
        startedAt: { lt: cutoff },
      },
      data: {
        status: 'failed',
        errorCode: 'content_import_interrupted',
        errorMessage:
          'Content import was interrupted or exceeded stale running timeout. Start a new import run.',
        finishedAt: now,
      },
    });
    for (const run of staleRuns as any[]) {
      await this.enqueueTomestoCatalogResumeRun(run);
    }
    if (result.count > 0) {
      console.warn('[content-import] stale running runs failed', {
        count: result.count,
        staleAfterMs,
      });
    }
  }

  private async executeRun(input: {
    runId: string;
    sourceId: string;
    sourceCode: ExternalSourceCode;
    city: string;
    from: Date;
    to: Date;
    importMode?: string | null;
    catalogOffset?: number | null;
    catalogLimit?: number | null;
  }) {
    const adapter = this.registry.getAdapter(input.sourceCode);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    timeout.unref?.();
    let fetchedCount = 0;
    let normalizedCount = 0;
    let skippedCount = 0;
    let publishedCount = 0;
    let paidCount = 0;
    let freeCount = 0;
    let unknownPriceCount = 0;
    let missingCoordsCount = 0;
    let catalogProgress: TomestoCatalogProgress | null = null;
    const tomestoHiddenCounts = {
      eventDefaultDisabled: 0,
      promoSurfaceMissing: 0,
      unknownPrice: 0,
    };
    const rssBefore = process.memoryUsage().rss;
    const startedAt = Date.now();
    const duplicateCache: DuplicateCandidateCache = new Map();
    const sourcePlaceCache: PlaceCandidateCache = new Map();
    const venuePlaceCache: PlaceCandidateCache = new Map();
    const geocodeCache: GeocodeCache = new Map();
    try {
      console.info('[content-import] source started', {
        runId: input.runId,
        sourceCode: input.sourceCode,
        city: input.city,
        from: input.from.toISOString(),
        to: input.to.toISOString(),
        rssBefore,
      });
      const fetchInput = {
        city: input.city,
        cityCode: cityCodesForSource(input.sourceCode)[input.city] ?? input.city,
        timezone: timezoneForCity(input.city),
        from: input.from,
        to: input.to,
        signal: controller.signal,
        importMode: input.importMode,
        catalogOffset: input.catalogOffset,
        catalogLimit: input.catalogLimit,
      };
      for await (const rawItems of this.fetchItemBatches(adapter, fetchInput)) {
        fetchedCount += rawItems.length;
        for (const rawItem of rawItems) {
          try {
            catalogProgress = catalogProgress ?? tomestoCatalogProgress(rawItem.raw);
            const normalized = await this.prepareItemForUpsert(
              this.normalizer.normalize(rawItem),
              duplicateCache,
              sourcePlaceCache,
              venuePlaceCache,
              geocodeCache,
            );
            const item = this.imageMirror
              ? await this.imageMirror.mirrorExternalImage(normalized.item)
              : normalized.item;
            const publicStatus = normalized.publicStatusOverride ?? publicStatusFor(item);
            if (item.sourceCode === 'tomesto' && publicStatus === PUBLIC_STATUS_HIDDEN) {
              countTomestoHiddenReason(item, tomestoHiddenCounts);
            }
            await this.upsertItem(input.sourceId, input.runId, item, publicStatus);
            normalizedCount += 1;
            if (publicStatus === PUBLIC_STATUS_PUBLISHED) {
              publishedCount += 1;
            }
            if (item.priceMode === 'paid') {
              paidCount += 1;
            } else if (item.priceMode === 'free') {
              freeCount += 1;
            } else {
              unknownPriceCount += 1;
            }
            if (item.lat == null || item.lng == null) {
              missingCoordsCount += 1;
            }
          } catch {
            skippedCount += 1;
          }
        }
        await this.updateRunProgress(input.runId, {
          fetchedCount,
          normalizedCount,
          skippedCount,
          publishedCount,
          paidCount,
          freeCount,
          unknownPriceCount,
          missingCoordsCount,
        });
      }
      if (fetchedCount === 0) {
        console.warn('[content-import] source returned empty feed', {
          runId: input.runId,
          sourceCode: input.sourceCode,
          city: input.city,
        });
      }
      await this.markStaleItems(input.sourceId, input.city);
      const durationMs = Date.now() - startedAt;
      const rssAfter = process.memoryUsage().rss;
      await this.prismaService.client.externalImportRun.update({
        where: { id: input.runId },
        data: {
          status: 'completed',
          fetchedCount,
          normalizedCount,
          skippedCount,
          publishedCount,
          paidCount,
          freeCount,
          unknownPriceCount,
          missingCoordsCount,
          finishedAt: new Date(),
        },
      });
      await this.prismaService.client.externalContentSource.update({
        where: { id: input.sourceId },
        data: { lastImportedAt: new Date() },
      });
      await this.enqueueNextTomestoCatalogRun(input, catalogProgress);
      console.info('[content-import] source completed', {
        runId: input.runId,
        sourceCode: input.sourceCode,
        city: input.city,
        fetchedCount,
        normalizedCount,
        skippedCount,
        publishedCount,
        paidCount,
        freeCount,
        unknownPriceCount,
        missingCoordsCount,
        rssBefore,
        rssAfter,
        durationMs,
        itemsPerSecond: itemsPerSecond(fetchedCount, durationMs),
      });
      if (input.sourceCode === 'tomesto' && Object.values(tomestoHiddenCounts).some((count) => count > 0)) {
        console.info('[content-import] tomesto hidden counts', {
          runId: input.runId,
          ...tomestoHiddenCounts,
        });
      }
    } catch (caught) {
      const failure = contentImportFailure(caught);
      const durationMs = Date.now() - startedAt;
      const rssAfter = process.memoryUsage().rss;
      await this.prismaService.client.externalImportRun.update({
        where: { id: input.runId },
        data: {
          status: 'failed',
          fetchedCount,
          normalizedCount,
          skippedCount,
          publishedCount,
          paidCount,
          freeCount,
          unknownPriceCount,
          missingCoordsCount,
          errorCode: failure.code,
          errorMessage: failure.message,
          finishedAt: new Date(),
        },
      });
      console.error('[content-import] source failed', {
        runId: input.runId,
        sourceCode: input.sourceCode,
        city: input.city,
        code: failure.code,
        message: failure.message,
        fetchedCount,
        normalizedCount,
        skippedCount,
        rssBefore,
        rssAfter,
        durationMs,
        itemsPerSecond: itemsPerSecond(fetchedCount, durationMs),
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async *fetchItemBatches(
    adapter: ExternalSourceAdapter,
    input: ExternalSourceFetchInput,
  ): AsyncIterable<ExternalRawItem[]> {
    if (adapter.fetchBatches) {
      yield* adapter.fetchBatches(input);
      return;
    }
    const items = await adapter.fetchItems(input);
    if (items.length > 0) {
      yield items;
    }
  }

  private upsertItem(
    sourceId: string,
    importRunId: string,
    item: NormalizedExternalContentItem,
    publicStatus: string,
  ) {
    return this.prismaService.client.externalContentItem.upsert({
      where: {
        sourceId_sourceItemId: {
          sourceId,
          sourceItemId: item.sourceItemId,
        },
      },
      create: {
        sourceId,
        importRunId,
        sourceItemId: item.sourceItemId,
        sourceUrl: item.sourceUrl,
        contentKind: item.contentKind,
        city: item.city,
        timezone: item.timezone,
        area: item.area,
        title: item.title,
        shortSummary: item.shortSummary,
        category: item.category,
        tags: item.tags as Prisma.InputJsonValue,
        address: item.address,
        lat: item.lat,
        lng: item.lng,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        priceFrom: item.priceFrom,
        currency: item.currency,
        venueName: item.venueName,
        imageUrl: item.imageUrl,
        imageVariants: safeJson(item.imageVariants),
        actionUrl: item.actionUrl,
        actionKind: item.actionKind,
        priceMode: item.priceMode,
        isAffiliate: item.isAffiliate,
        sourceProvider: item.sourceProvider,
        placeKind: item.placeKind,
        lastSeenAt: item.lastSeenAt,
        publicStatus,
        raw: safeJson(item.raw),
        normalizedHash: item.normalizedHash,
        moderationStatus: 'pending',
        expiresAt: item.expiresAt,
      },
      update: {
        importRunId,
        sourceUrl: item.sourceUrl,
        contentKind: item.contentKind,
        city: item.city,
        timezone: item.timezone,
        area: item.area,
        title: item.title,
        shortSummary: item.shortSummary,
        category: item.category,
        tags: item.tags as Prisma.InputJsonValue,
        address: item.address,
        lat: item.lat,
        lng: item.lng,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        priceFrom: item.priceFrom,
        currency: item.currency,
        venueName: item.venueName,
        imageUrl: item.imageUrl,
        imageVariants: safeJson(item.imageVariants),
        actionUrl: item.actionUrl,
        actionKind: item.actionKind,
        priceMode: item.priceMode,
        isAffiliate: item.isAffiliate,
        sourceProvider: item.sourceProvider,
        placeKind: item.placeKind,
        lastSeenAt: item.lastSeenAt,
        publicStatus: {
          set: publicStatus,
        },
        raw: safeJson(item.raw),
        normalizedHash: item.normalizedHash,
        importedAt: new Date(),
        expiresAt: item.expiresAt,
      },
    });
  }

  private markStaleItems(sourceId: string, city: string) {
    const cutoff = new Date(Date.now() - STALE_GRACE_MS);
    return this.prismaService.client.externalContentItem.updateMany({
      where: {
        sourceId,
        city,
        publicStatus: PUBLIC_STATUS_PUBLISHED,
        lastSeenAt: { lt: cutoff },
      },
      data: { publicStatus: PUBLIC_STATUS_STALE },
    });
  }

  private updateRunProgress(runId: string, counters: ImportCounters) {
    return this.prismaService.client.externalImportRun.update({
      where: { id: runId },
      data: {
        status: 'running',
        ...counters,
      },
    });
  }

  private async prepareItemForUpsert(
    item: NormalizedExternalContentItem,
    duplicateCache: DuplicateCandidateCache,
    sourcePlaceCache: PlaceCandidateCache,
    venuePlaceCache: PlaceCandidateCache,
    geocodeCache: GeocodeCache,
  ): Promise<{
    item: NormalizedExternalContentItem;
    publicStatusOverride?: string;
  }> {
    let enrichedItem = item;
    if (enrichedItem.contentKind === 'event') {
      enrichedItem = await this.enrichEventFromStableVenueData(
        enrichedItem,
        sourcePlaceCache,
        venuePlaceCache,
        geocodeCache,
      );
    }

    if (enrichedItem.contentKind !== 'event' || !enrichedItem.startsAt) {
      return { item: enrichedItem };
    }

    const duplicate = await this.findEventDuplicate(enrichedItem, duplicateCache);
    if (!duplicate || duplicate.match.confidence === 'low') {
      return { item: enrichedItem };
    }

    if (enrichedItem.sourceCode === 'advcake_ticketland') {
      const enriched = enrichItemFromDuplicate(enrichedItem, duplicate.item);
      await this.hideDuplicateItem(duplicate.item.id, duplicate.item.raw, {
        sourceCode: enrichedItem.sourceCode,
        sourceItemId: enrichedItem.sourceItemId,
        confidence: duplicate.match.confidence,
        duplicateKey: duplicate.match.key,
        role: 'merged_into_affiliate_event',
      });
      return { item: enriched };
    }

    if (duplicate.item.source?.code === 'advcake_ticketland') {
      await this.enrichExistingAffiliateItem(duplicate.item, enrichedItem, duplicate.match);
      return {
        item: {
          ...enrichedItem,
          raw: mergeRaw(enrichedItem.raw, {
            sourceCode: duplicate.item.source.code,
            sourceItemId: duplicate.item.sourceItemId,
            confidence: duplicate.match.confidence,
            duplicateKey: duplicate.match.key,
            role: 'duplicate_of_affiliate_event',
          }),
        },
        publicStatusOverride: PUBLIC_STATUS_HIDDEN,
      };
    }

    return { item: enrichedItem };
  }

  private async enrichEventFromStableVenueData(
    item: NormalizedExternalContentItem,
    sourcePlaceCache: PlaceCandidateCache,
    venuePlaceCache: PlaceCandidateCache,
    geocodeCache: GeocodeCache,
  ) {
    if (item.sourceCode === 'kudago') {
      return this.enrichKudaGoEventFromPlace(item, sourcePlaceCache);
    }
    if (item.sourceCode === 'advcake_ticketland') {
      return this.enrichAffiliateEventFromVenue(item, venuePlaceCache, geocodeCache);
    }
    return item;
  }

  private async enrichKudaGoEventFromPlace(
    item: NormalizedExternalContentItem,
    sourcePlaceCache: PlaceCandidateCache,
  ) {
    if (item.lat != null && item.lng != null) {
      return item;
    }
    const placeId = kudagoPlaceId(item.raw);
    if (!placeId) {
      return item;
    }
    const place = await this.findSourcePlaceCandidate(item, `place-${placeId}`, sourcePlaceCache);
    if (!place || place.lat == null || place.lng == null) {
      return item;
    }
    return enrichItemFromPlace(item, place, {
      role: 'source_place_enriched',
      method: 'kudago_place_id',
      geoConfidence: 'high',
    });
  }

  private async enrichAffiliateEventFromVenue(
    item: NormalizedExternalContentItem,
    venuePlaceCache: PlaceCandidateCache,
    geocodeCache: GeocodeCache,
  ) {
    if (item.lat != null && item.lng != null) {
      return item;
    }

    const place = await this.findExactVenuePlaceCandidate(item, venuePlaceCache);
    if (place && place.lat != null && place.lng != null) {
      return enrichItemFromPlace(item, place, {
        role: 'affiliate_venue_enriched',
        method: 'exact_venue_place_match',
        geoConfidence: 'high',
      });
    }

    const geocoded = await this.geocodeAffiliateVenue(item, geocodeCache);
    if (!geocoded) {
      return item;
    }
    return enrichItemFromGeocoder(item, geocoded);
  }

  private findSourcePlaceCandidate(
    item: NormalizedExternalContentItem,
    sourceItemId: string,
    sourcePlaceCache: PlaceCandidateCache,
  ) {
    const key = ['source-place', item.sourceCode, item.city, sourceItemId].join('|');
    const cached = sourcePlaceCache.get(key);
    if (cached) {
      return cached;
    }
    const load = this.prismaService.client.externalContentItem.findMany({
      where: {
        source: { code: item.sourceCode },
        contentKind: 'place',
        publicStatus: PUBLIC_STATUS_PUBLISHED,
        city: item.city,
        sourceItemId,
        lat: { not: null },
        lng: { not: null },
      },
      select: PLACE_CANDIDATE_SELECT,
      take: 1,
    }).then((rows) => (rows[0] as PlaceCandidate | undefined) ?? null);
    sourcePlaceCache.set(key, load);
    return load;
  }

  private findExactVenuePlaceCandidate(
    item: NormalizedExternalContentItem,
    venuePlaceCache: PlaceCandidateCache,
  ) {
    const venueName = optionalString(item.venueName);
    if (!venueName || !isReliableAffiliateVenueName(venueName)) {
      return Promise.resolve(null);
    }

    const venueKey = normalizeVenueText(venueName);
    const key = ['affiliate-place', item.city, venueKey].join('|');
    const cached = venuePlaceCache.get(key);
    if (cached) {
      return cached;
    }
    const load = this.prismaService.client.externalContentItem.findMany({
      where: {
        source: { code: { in: AFFILIATE_PLACE_SOURCE_CODES } },
        contentKind: 'place',
        publicStatus: PUBLIC_STATUS_PUBLISHED,
        city: item.city,
        lat: { not: null },
        lng: { not: null },
        OR: [
          { title: { equals: venueName, mode: 'insensitive' } },
          { venueName: { equals: venueName, mode: 'insensitive' } },
        ],
      },
      select: PLACE_CANDIDATE_SELECT,
      take: 10,
    }).then((rows) => selectExactVenuePlace(rows as unknown as PlaceCandidate[], venueKey));
    venuePlaceCache.set(key, load);
    return load;
  }

  private geocodeAffiliateVenue(
    item: NormalizedExternalContentItem,
    geocodeCache: GeocodeCache,
  ) {
    if (!this.venueGeocoder) {
      return Promise.resolve(null);
    }
    const address = optionalString(item.address);
    const venueName = optionalString(item.venueName);
    if (!address && !isReliableAffiliateVenueName(venueName)) {
      return Promise.resolve(null);
    }
    const key = ['affiliate-geocode', item.city, address ?? '', normalizeVenueText(venueName)].join('|');
    const cached = geocodeCache.get(key);
    if (cached) {
      return cached;
    }
    const load = this.venueGeocoder.geocode({
      city: item.city,
      venueName: isReliableAffiliateVenueName(venueName) ? venueName : null,
      address,
    });
    geocodeCache.set(key, load);
    return load;
  }

  private async findEventDuplicate(
    item: NormalizedExternalContentItem,
    duplicateCache: DuplicateCandidateCache,
  ) {
    if (!item.startsAt) {
      return null;
    }
    const candidates = await this.loadEventDuplicateCandidates(item, duplicateCache);

    const matches = candidates
      .map((candidate) => ({
        item: candidate,
        match: eventDuplicateMatch(item, {
          city: candidate.city,
          contentKind: candidate.contentKind,
          title: candidate.title,
          startsAt: candidate.startsAt,
          venueName: candidate.venueName,
        }),
      }))
      .filter((candidate) => candidate.match.confidence !== 'low');
    return matches.find((candidate) => candidate.item.source?.code === 'advcake_ticketland')
      ?? matches[0]
      ?? null;
  }

  private loadEventDuplicateCandidates(
    item: NormalizedExternalContentItem,
    duplicateCache: DuplicateCandidateCache,
  ) {
    if (!item.startsAt) {
      return Promise.resolve([]);
    }
    const key = duplicateCacheKey(item);
    const existing = duplicateCache.get(key);
    if (existing) {
      return existing;
    }

    const [from, to] = dayBounds(item.startsAt);
    const preload = this.prismaService.client.externalContentItem.findMany({
      where: {
        city: item.city,
        contentKind: 'event',
        startsAt: { gte: from, lt: to },
        source: { code: { not: item.sourceCode } },
      },
      select: EVENT_DUPLICATE_CANDIDATE_SELECT,
      orderBy: [{ importedAt: 'desc' }, { id: 'asc' }],
      take: positiveInt(
        process.env.CONTENT_IMPORT_DUPLICATE_PRELOAD_LIMIT,
        DEFAULT_DUPLICATE_PRELOAD_LIMIT,
      ),
    }) as Promise<EventDuplicateCandidate[]>;
    duplicateCache.set(key, preload);
    return preload;
  }

  private enrichExistingAffiliateItem(
    existing: any,
    item: NormalizedExternalContentItem,
    match: { confidence: 'high' | 'medium' | 'low'; key: string },
  ) {
    return this.prismaService.client.externalContentItem.update({
      where: { id: existing.id },
      data: {
        address: existing.address ?? item.address,
        lat: existing.lat ?? item.lat,
        lng: existing.lng ?? item.lng,
        venueName: existing.venueName ?? item.venueName,
        publicStatus: existing.priceMode === 'paid' && existing.actionUrl
          ? PUBLIC_STATUS_PUBLISHED
          : existing.publicStatus,
        raw: safeJson(mergeRaw(existing.raw, {
          sourceCode: item.sourceCode,
          sourceItemId: item.sourceItemId,
          confidence: match.confidence,
          duplicateKey: match.key,
          role: 'affiliate_event_enriched',
          fields: ['address', 'lat', 'lng', 'venueName'],
        })),
      },
    });
  }

  private hideDuplicateItem(
    itemId: string,
    raw: unknown,
    enrichment: Record<string, unknown>,
  ) {
    return this.prismaService.client.externalContentItem.update({
      where: { id: itemId },
      data: {
        publicStatus: PUBLIC_STATUS_HIDDEN,
        raw: safeJson(mergeRaw(raw, enrichment)),
      },
    });
  }

  private async enqueueTomestoCatalogResumeRun(run: {
    id: string;
    sourceId: string;
    city: string;
    metadata: unknown;
    source?: { code?: ExternalSourceCode | string | null } | null;
  }) {
    if (run.source?.code !== 'tomesto') {
      return;
    }
    const metadata = object(run.metadata);
    if (optionalString(metadata?.importMode) !== TOMESTO_PLACES_CATALOG_MODE) {
      return;
    }
    const offset = optionalNonNegativeInteger(metadata?.catalogOffset);
    if (offset == null) {
      return;
    }
    const from = parseDate(metadata?.from) ?? new Date();
    const to = parseDate(metadata?.to) ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const limit = optionalPositiveInteger(metadata?.catalogLimit) ?? DEFAULT_TOMESTO_CATALOG_BATCH_SIZE;
    const total = optionalPositiveInteger(metadata?.catalogTotal);
    const next = await this.enqueueTomestoCatalogRun({
      sourceId: run.sourceId,
      city: run.city,
      from,
      to,
      offset,
      limit,
      total,
      previousRunId: run.id,
      requestedBy: 'worker-resume',
    });
    if (next) {
      console.warn('[content-import] tomesto catalog resume run queued', {
        interruptedRunId: run.id,
        resumeRunId: next.id,
        offset,
        total,
      });
    }
  }

  private async enqueueNextTomestoCatalogRun(
    input: {
      runId: string;
      sourceId: string;
      sourceCode: ExternalSourceCode;
      city: string;
      from: Date;
      to: Date;
      importMode?: string | null;
      catalogOffset?: number | null;
      catalogLimit?: number | null;
    },
    progress: TomestoCatalogProgress | null,
  ) {
    if (
      input.sourceCode !== 'tomesto' ||
      input.importMode !== TOMESTO_PLACES_CATALOG_MODE ||
      !progress
    ) {
      return;
    }
    const nextOffset = progress.offset + progress.limit;
    if (nextOffset >= progress.total) {
      return;
    }
    const next = await this.enqueueTomestoCatalogRun({
      sourceId: input.sourceId,
      city: input.city,
      from: input.from,
      to: input.to,
      offset: nextOffset,
      limit: progress.limit,
      total: progress.total,
      previousRunId: input.runId,
      requestedBy: 'worker',
    });
    if (!next) {
      console.warn('[content-import] tomesto catalog next run skipped because a run is already active', {
        currentRunId: input.runId,
        nextOffset,
      });
      return;
    }
    console.info('[content-import] tomesto catalog next run queued', {
      currentRunId: input.runId,
      nextRunId: next.id,
      nextOffset,
      total: progress.total,
    });
  }

  private async enqueueTomestoCatalogRun(input: {
    sourceId: string;
    city: string;
    from: Date;
    to: Date;
    offset: number;
    limit: number;
    total?: number | null;
    previousRunId: string;
    requestedBy: string;
  }) {
    const existing = await this.prismaService.client.externalImportRun.findFirst({
      where: {
        sourceId: input.sourceId,
        city: input.city,
        status: { in: ['pending_manual', 'running'] },
        metadata: {
          path: ['importMode'],
          equals: TOMESTO_PLACES_CATALOG_MODE,
        },
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
    });
    if (existing) {
      console.warn('[content-import] tomesto catalog run skipped because a run is already active', {
        previousRunId: input.previousRunId,
        existingRunId: existing.id,
        offset: input.offset,
      });
      return null;
    }
    return this.prismaService.client.externalImportRun.create({
      data: {
        sourceId: input.sourceId,
        city: input.city,
        status: 'pending_manual',
        metadata: {
          from: input.from.toISOString(),
          to: input.to.toISOString(),
          requestedBy: input.requestedBy,
          importMode: TOMESTO_PLACES_CATALOG_MODE,
          catalogOffset: input.offset,
          catalogLimit: input.limit,
          ...(input.total != null ? { catalogTotal: input.total } : {}),
          previousRunId: input.previousRunId,
        },
      },
    });
  }
}

type TomestoCatalogProgress = {
  offset: number;
  limit: number;
  total: number;
};

function safeJson(value: unknown): Prisma.InputJsonValue {
  if (value == null) {
    return {};
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function dayBounds(value: Date): [Date, Date] {
  const day = dayKey(value);
  const from = new Date(`${day}T00:00:00.000Z`);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return [from, to];
}

function duplicateCacheKey(item: NormalizedExternalContentItem) {
  return [
    item.city,
    item.contentKind,
    dayKey(item.startsAt),
    item.sourceCode,
  ].join('|');
}

function itemsPerSecond(count: number, durationMs: number) {
  if (durationMs <= 0) {
    return count;
  }
  return Math.round((count / durationMs) * 1000 * 100) / 100;
}

function enrichItemFromDuplicate(
  item: NormalizedExternalContentItem,
  duplicate: any,
): NormalizedExternalContentItem {
  const match = eventDuplicateMatch(item, {
    city: duplicate.city,
    contentKind: duplicate.contentKind,
    title: duplicate.title,
    startsAt: duplicate.startsAt,
    venueName: duplicate.venueName,
  });
  return {
    ...item,
    address: item.address ?? duplicate.address ?? null,
    lat: item.lat ?? duplicate.lat ?? null,
    lng: item.lng ?? duplicate.lng ?? null,
    venueName: item.venueName ?? duplicate.venueName ?? null,
    raw: mergeRaw(item.raw, {
      sourceCode: duplicate.source?.code,
      sourceItemId: duplicate.sourceItemId,
      confidence: match.confidence,
      duplicateKey: match.key,
      role: 'affiliate_event_enriched',
      fields: ['address', 'lat', 'lng', 'venueName'],
    }),
  };
}

function enrichItemFromPlace(
  item: NormalizedExternalContentItem,
  place: PlaceCandidate,
  enrichment: {
    role: string;
    method: string;
    geoConfidence: string;
  },
): NormalizedExternalContentItem {
  return {
    ...item,
    address: item.address ?? place.address ?? null,
    lat: item.lat ?? place.lat ?? null,
    lng: item.lng ?? place.lng ?? null,
    venueName: item.venueName ?? place.venueName ?? place.title ?? null,
    raw: mergeRaw(item.raw, {
      ...enrichment,
      sourceCode: place.source?.code,
      sourceItemId: place.sourceItemId,
      fields: ['address', 'lat', 'lng', 'venueName'],
    }),
  };
}

function enrichItemFromGeocoder(
  item: NormalizedExternalContentItem,
  geocoded: VenueGeocodeResult,
): NormalizedExternalContentItem {
  return {
    ...item,
    address: item.address ?? geocoded.address ?? null,
    lat: item.lat ?? geocoded.lat,
    lng: item.lng ?? geocoded.lng,
    raw: mergeRaw(item.raw, {
      role: 'affiliate_venue_enriched',
      method: 'geocoder_high_confidence',
      geoConfidence: 'high',
      provider: geocoded.provider,
      precision: geocoded.precision,
      kind: geocoded.kind,
      fields: ['address', 'lat', 'lng'],
    }),
  };
}

function mergeRaw(raw: unknown, enrichment: Record<string, unknown>) {
  const base = object(raw) ?? {};
  return {
    ...base,
    enrichment: {
      ...(object(base.enrichment) ?? {}),
      ...enrichment,
    },
  };
}

function kudagoPlaceId(raw: unknown) {
  const place = object(object(raw)?.place);
  const id = place?.id;
  if (typeof id === 'number' && Number.isFinite(id)) {
    return String(Math.trunc(id));
  }
  if (typeof id === 'string' && id.trim().length > 0) {
    return id.trim();
  }
  return null;
}

function selectExactVenuePlace(rows: PlaceCandidate[], venueKey: string) {
  const matches = rows
    .filter((row) =>
      normalizeVenueText(row.title) === venueKey ||
      normalizeVenueText(row.venueName) === venueKey,
    )
    .sort((left, right) => placeSourcePriority(left) - placeSourcePriority(right));
  return matches[0] ?? null;
}

function placeSourcePriority(place: PlaceCandidate) {
  if (place.source?.code === 'kudago') {
    return 0;
  }
  if (place.source?.code === 'tomesto') {
    return 1;
  }
  return 2;
}

function isReliableAffiliateVenueName(value: string | null) {
  const normalized = normalizeVenueText(value);
  if (normalized.length < 5 || GENERIC_AFFILIATE_VENUE_NAMES.has(normalized)) {
    return false;
  }
  return /[a-zа-яё]/i.test(normalized);
}

function normalizeVenueText(value: string | null) {
  if (!value) {
    return '';
  }
  return value
    .toLowerCase()
    .replace(/[«»"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function positiveInt(value: unknown, fallback: number) {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function boundedPositiveInt(
  value: number | undefined,
  fallback: number,
  max: number,
) {
  const parsed = typeof value === 'number' ? value : fallback;
  return Math.max(1, Math.min(Math.trunc(parsed), max));
}

function object(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function parseDate(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function optionalPositiveInteger(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseInt(value, 10)
      : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

function optionalNonNegativeInteger(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseInt(value, 10)
      : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

function tomestoCatalogProgress(raw: unknown): TomestoCatalogProgress | null {
  const catalog = object(object(raw)?.catalog);
  if (!catalog || catalog.mode !== TOMESTO_PLACES_CATALOG_MODE) {
    return null;
  }
  const offset = optionalNonNegativeInteger(catalog.offset);
  const limit = optionalPositiveInteger(catalog.limit);
  const total = optionalPositiveInteger(catalog.total);
  if (offset == null || limit == null || total == null) {
    return null;
  }
  return { offset, limit, total };
}

function publicStatusFor(item: NormalizedExternalContentItem) {
  if (item.contentKind === 'place') {
    return PUBLIC_STATUS_PUBLISHED;
  }
  if (item.sourceCode === 'tomesto') {
    if (object(item.raw)?.kind === 'promo') {
      return PUBLIC_STATUS_HIDDEN;
    }
    if (process.env.TOMESTO_PUBLIC_EVENTS_ENABLED !== 'true') {
      return PUBLIC_STATUS_HIDDEN;
    }
    return item.priceMode === 'free' || item.priceMode === 'paid'
      ? PUBLIC_STATUS_PUBLISHED
      : PUBLIC_STATUS_HIDDEN;
  }
  if (item.priceMode === 'unknown') {
    return PUBLIC_STATUS_HIDDEN;
  }
  if (item.sourceCode === 'advcake_ticketland') {
    return item.priceMode === 'paid' && item.actionUrl ? PUBLIC_STATUS_PUBLISHED : PUBLIC_STATUS_HIDDEN;
  }
  if (item.sourceCode === 'kudago' || item.sourceCode === 'timepad') {
    if (item.priceMode === 'free') {
      return PUBLIC_STATUS_PUBLISHED;
    }
    return process.env.CONTENT_IMPORT_INCLUDE_UNMONETIZED_PAID === 'true'
      ? PUBLIC_STATUS_PUBLISHED
      : PUBLIC_STATUS_HIDDEN;
  }
  return PUBLIC_STATUS_HIDDEN;
}

function contentImportFailure(caught: unknown) {
  const rawMessage = caught instanceof Error ? caught.message : 'Content import failed';
  const masked = maskKnownSecrets(maskTomestoSecrets(maskAdvCakeSecrets(rawMessage)));
  return {
    code: masked.slice(0, 120) || 'content_import_failed',
    message: masked.slice(0, 500) || 'Content import failed',
  };
}

function maskKnownSecrets(value: string) {
  let masked = value;
  for (const secret of [process.env.TIMEPAD_API_TOKEN, process.env.ADVCAKE_API_PASS, process.env.TOMESTO_REF_QUERY]) {
    if (typeof secret === 'string' && secret.length > 0) {
      masked = masked.split(secret).join('***');
    }
  }
  return masked;
}

function maskTomestoSecrets(value: string) {
  return value.replace(/([?&](?:ref|utm_[^=]+|partner|aff|affiliate)=)[^&\s]+/gi, '$1***');
}

function countTomestoHiddenReason(
  item: NormalizedExternalContentItem,
  counts: { eventDefaultDisabled: number; promoSurfaceMissing: number; unknownPrice: number },
) {
  if (object(item.raw)?.kind === 'promo') {
    counts.promoSurfaceMissing += 1;
    return;
  }
  if (item.priceMode === 'unknown') {
    counts.unknownPrice += 1;
    return;
  }
  counts.eventDefaultDisabled += 1;
}
