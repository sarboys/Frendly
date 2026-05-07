import { Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { maskAdvCakeSecrets } from './advcake-ticketland.adapter';
import { dayKey, eventDuplicateMatch } from './content-deduplication.service';
import { ContentNormalizerService } from './content-normalizer.service';
import { ContentImageMirrorService } from './content-image-mirror.service';
import { ExternalSourceRegistry } from './external-source.registry';
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
};

const DEFAULT_IMPORT_TIMEOUT_MS = 600_000;
const SOURCE_CITY_CODES: Record<ExternalSourceCode, Record<string, string>> = {
  kudago: {
    'Москва': 'msk',
    'Санкт-Петербург': 'spb',
  },
  timepad: {
    'Москва': 'Москва',
    'Санкт-Петербург': 'Санкт-Петербург',
  },
  overpass: {
    'Москва': 'Москва',
    'Санкт-Петербург': 'Санкт-Петербург',
  },
  advcake_ticketland: {
    'Москва': 'Москва',
    'Санкт-Петербург': 'Санкт-Петербург',
  },
};

const PUBLIC_STATUS_PUBLISHED = 'published';
const PUBLIC_STATUS_HIDDEN = 'hidden';
const PUBLIC_STATUS_STALE = 'stale';
const STALE_GRACE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DUPLICATE_PRELOAD_LIMIT = 1000;
const DEFAULT_IMAGE_BACKFILL_LIMIT = 50;

type DuplicateCandidateCache = Map<string, Promise<EventDuplicateCandidate[]>>;

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

@Injectable()
export class ContentImportService {
  private readonly timeoutMs = positiveInt(process.env.CONTENT_IMPORT_TIMEOUT_MS, DEFAULT_IMPORT_TIMEOUT_MS);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly normalizer: ContentNormalizerService,
    private readonly registry: ExternalSourceRegistry,
    @Optional() private readonly imageMirror?: ContentImageMirrorService,
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
          cityCodes: SOURCE_CITY_CODES[sourceInfo.code] as Prisma.InputJsonValue,
          config: safeJson(sourceInfo.config ?? {}),
        },
        update: {
          name: sourceInfo.name,
          kind: sourceInfo.kind,
          baseUrl: sourceInfo.baseUrl,
          cityCodes: SOURCE_CITY_CODES[sourceInfo.code] as Prisma.InputJsonValue,
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
    const rssBefore = process.memoryUsage().rss;
    const startedAt = Date.now();
    const duplicateCache: DuplicateCandidateCache = new Map();
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
        cityCode: SOURCE_CITY_CODES[input.sourceCode]?.[input.city] ?? input.city,
        from: input.from,
        to: input.to,
        signal: controller.signal,
      };
      for await (const rawItems of this.fetchItemBatches(adapter, fetchInput)) {
        fetchedCount += rawItems.length;
        for (const rawItem of rawItems) {
          try {
            const normalized = await this.prepareItemForUpsert(
              this.normalizer.normalize(rawItem),
              duplicateCache,
            );
            const item = this.imageMirror
              ? await this.imageMirror.mirrorExternalImage(normalized.item)
              : normalized.item;
            const publicStatus = normalized.publicStatusOverride ?? publicStatusFor(item);
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

  private async prepareItemForUpsert(
    item: NormalizedExternalContentItem,
    duplicateCache: DuplicateCandidateCache,
  ): Promise<{
    item: NormalizedExternalContentItem;
    publicStatusOverride?: string;
  }> {
    if (item.contentKind !== 'event' || !item.startsAt) {
      return { item };
    }

    const duplicate = await this.findEventDuplicate(item, duplicateCache);
    if (!duplicate || duplicate.match.confidence === 'low') {
      return { item };
    }

    if (item.sourceCode === 'advcake_ticketland') {
      const enriched = enrichItemFromDuplicate(item, duplicate.item);
      await this.hideDuplicateItem(duplicate.item.id, duplicate.item.raw, {
        sourceCode: item.sourceCode,
        sourceItemId: item.sourceItemId,
        confidence: duplicate.match.confidence,
        duplicateKey: duplicate.match.key,
        role: 'merged_into_affiliate_event',
      });
      return { item: enriched };
    }

    if (duplicate.item.source?.code === 'advcake_ticketland') {
      await this.enrichExistingAffiliateItem(duplicate.item, item, duplicate.match);
      return {
        item: {
          ...item,
          raw: mergeRaw(item.raw, {
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

    return { item };
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
}

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

function publicStatusFor(item: NormalizedExternalContentItem) {
  if (item.contentKind === 'place') {
    return PUBLIC_STATUS_PUBLISHED;
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
  const masked = maskKnownSecrets(maskAdvCakeSecrets(rawMessage));
  return {
    code: masked.slice(0, 120) || 'content_import_failed',
    message: masked.slice(0, 500) || 'Content import failed',
  };
}

function maskKnownSecrets(value: string) {
  let masked = value;
  for (const secret of [process.env.TIMEPAD_API_TOKEN, process.env.ADVCAKE_API_PASS]) {
    if (typeof secret === 'string' && secret.length > 0) {
      masked = masked.split(secret).join('***');
    }
  }
  return masked;
}
