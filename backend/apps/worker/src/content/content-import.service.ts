import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { maskAdvCakeSecrets } from './advcake-ticketland.adapter';
import { ContentNormalizerService } from './content-normalizer.service';
import { ExternalSourceRegistry } from './external-source.registry';
import type { ExternalSourceCode, NormalizedExternalContentItem } from './content-source.types';

export type ContentImportInput = {
  city: string;
  sources: ExternalSourceCode[];
  from: Date;
  to: Date;
};

const DEFAULT_IMPORT_TIMEOUT_MS = 120_000;
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

@Injectable()
export class ContentImportService {
  private readonly timeoutMs = positiveInt(process.env.CONTENT_IMPORT_TIMEOUT_MS, DEFAULT_IMPORT_TIMEOUT_MS);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly normalizer: ContentNormalizerService,
    private readonly registry: ExternalSourceRegistry,
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
    const runs = await this.prismaService.client.externalImportRun.findMany({
      where: { status: 'pending_manual' },
      include: { source: true },
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
    let fetchedCount = 0;
    let normalizedCount = 0;
    let skippedCount = 0;
    let publishedCount = 0;
    let paidCount = 0;
    let freeCount = 0;
    let unknownPriceCount = 0;
    let missingCoordsCount = 0;
    try {
      console.info('[content-import] source started', {
        runId: input.runId,
        sourceCode: input.sourceCode,
        city: input.city,
        from: input.from.toISOString(),
        to: input.to.toISOString(),
      });
      const rawItems = await adapter.fetchItems({
        city: input.city,
        cityCode: SOURCE_CITY_CODES[input.sourceCode]?.[input.city] ?? input.city,
        from: input.from,
        to: input.to,
        signal: controller.signal,
      });
      fetchedCount = rawItems.length;
      if (fetchedCount === 0) {
        console.warn('[content-import] source returned empty feed', {
          runId: input.runId,
          sourceCode: input.sourceCode,
          city: input.city,
        });
      }
      for (const rawItem of rawItems) {
        try {
          const normalized = this.normalizer.normalize(rawItem);
          const publicStatus = publicStatusFor(normalized);
          await this.upsertItem(input.sourceId, input.runId, normalized, publicStatus);
          normalizedCount += 1;
          if (publicStatus === PUBLIC_STATUS_PUBLISHED) {
            publishedCount += 1;
          }
          if (normalized.priceMode === 'paid') {
            paidCount += 1;
          } else if (normalized.priceMode === 'free') {
            freeCount += 1;
          } else {
            unknownPriceCount += 1;
          }
          if (normalized.lat == null || normalized.lng == null) {
            missingCoordsCount += 1;
          }
        } catch {
          skippedCount += 1;
        }
      }
      await this.markStaleItems(input.sourceId, input.city);
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
      });
    } catch (caught) {
      const failure = contentImportFailure(caught);
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
      });
    } finally {
      clearTimeout(timeout);
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
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  if (value == null) {
    return {};
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function positiveInt(value: unknown, fallback: number) {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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
