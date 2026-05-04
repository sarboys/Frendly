import { Injectable } from '@nestjs/common';
import type {
  AdminExternalImportRunDto,
  AdminExternalImportRunListDto,
  AdminExternalContentItemListDto,
  AdminRouteGenerationRunDto,
  AdminRouteGenerationRunInput,
  AdminRouteGenerationRunListDto,
  AdminRouteReviewActionInput,
  AdminRouteReviewDraftDto,
  AdminRouteReviewDraftListDto,
  AdminRouteReviewImportRunInput,
  AdminRouteReviewSourceDto,
  AdminRouteReviewSourceListDto,
} from '@big-break/contracts';
import { ApiError } from '../common/api-error';
import { AdminEveningRouteService } from './admin-evening-route.service';
import { PrismaService } from './prisma.service';

const VALID_SOURCES = ['kudago', 'timepad', 'overpass', 'advcake_ticketland'] as const;
type SourceCode = (typeof VALID_SOURCES)[number];
const PROMPT_VERSION = 'aggregation-route-review-v1';
const DEFAULT_AUDIENCE = 'friends';
const DEFAULT_FORMAT = 'evening_route';

const SOURCE_INFO: Record<SourceCode, { name: string; kind: string; baseUrl: string }> = {
  kudago: {
    name: 'KudaGo',
    kind: 'events_places',
    baseUrl: process.env.KUDAGO_BASE_URL ?? 'https://kudago.com/public-api/v1.4',
  },
  timepad: {
    name: 'Timepad',
    kind: 'events',
    baseUrl: process.env.TIMEPAD_BASE_URL ?? 'https://api.timepad.ru/v1',
  },
  overpass: {
    name: 'OSM Overpass',
    kind: 'places',
    baseUrl: process.env.OVERPASS_BASE_URL ?? 'https://overpass-api.de/api/interpreter',
  },
  advcake_ticketland: {
    name: 'AdvCake Ticketland',
    kind: 'affiliate_events',
    baseUrl: process.env.ADVCAKE_BASE_URL ?? 'https://api.advcake.com',
  },
};

@Injectable()
export class AdminRouteReviewService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly routeService: AdminEveningRouteService,
  ) {}

  async listDrafts(query: Record<string, unknown> = {}): Promise<AdminRouteReviewDraftListDto> {
    const limit = this.parseLimit(query.limit);
    const cursor = this.parseCursor(this.optionalText(query.cursor));
    const source = this.optionalText(query.source);
    const drafts = await this.prismaService.client.generatedRouteReviewDraft.findMany({
      where: {
        ...(this.optionalText(query.city) ? { city: this.optionalText(query.city)! } : {}),
        ...(this.optionalText(query.status) ? { status: this.optionalText(query.status)! } : {}),
        ...(source
          ? {
              steps: {
                some: {
                  externalContentItem: {
                    source: { code: source },
                  },
                },
              },
            }
          : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { gt: cursor.id } },
              ],
            }
          : {}),
      },
      include: this.draftInclude(),
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const items = drafts.slice(0, limit).map((draft: any) => this.mapDraft(draft));
    const next = drafts.length > limit ? drafts[limit] : null;
    return {
      items,
      nextCursor: next ? `${next.createdAt.toISOString()}|${next.id}` : null,
    };
  }

  async getDraft(draftId: string): Promise<AdminRouteReviewDraftDto> {
    const draft = await this.prismaService.client.generatedRouteReviewDraft.findUnique({
      where: { id: draftId },
      include: this.draftInclude(),
    });
    if (!draft) {
      throw new ApiError(404, 'route_review_draft_not_found', 'Route review draft not found');
    }
    return this.mapDraft(draft);
  }

  async approveDraft(draftId: string, body: AdminRouteReviewActionInput = {}) {
    const draft = await this.loadDraft(draftId);
    if (draft.status !== 'needs_review' || draft.validationStatus === 'invalid') {
      throw new ApiError(409, 'route_review_invalid_status', 'Draft cannot be approved');
    }
    const updated = await this.prismaService.client.generatedRouteReviewDraft.update({
      where: { id: draftId },
      data: {
        status: 'approved',
        reviewedAt: new Date(),
        reviewNote: this.optionalText(body.reviewNote),
      },
      include: this.draftInclude(),
    });
    return this.mapDraft(updated);
  }

  async rejectDraft(draftId: string, body: AdminRouteReviewActionInput = {}) {
    const draft = await this.loadDraft(draftId);
    if (draft.status !== 'needs_review' && draft.status !== 'approved') {
      throw new ApiError(409, 'route_review_invalid_status', 'Draft cannot be rejected');
    }
    const now = new Date();
    const updated = await this.prismaService.client.generatedRouteReviewDraft.update({
      where: { id: draftId },
      data: {
        status: 'rejected',
        reviewedAt: now,
        rejectedAt: now,
        reviewNote: this.optionalText(body.reviewNote),
      },
      include: this.draftInclude(),
    });
    return this.mapDraft(updated);
  }

  async convertDraft(draftId: string) {
    const draft = await this.loadDraft(draftId);
    if (draft.status !== 'approved') {
      throw new ApiError(409, 'route_review_invalid_status', 'Draft cannot be converted');
    }
    if (draft.createdTemplateId) {
      return this.routeService.getTemplate(draft.createdTemplateId);
    }

    const template = await this.routeService.createTemplate({
      city: draft.city,
      timezone: draft.timezone,
      area: draft.area ?? null,
      source: 'aggregation',
    });
    const revision = await this.routeService.createRevision(template.id, {
      title: draft.title,
      vibe: draft.vibe,
      blurb: draft.description,
      totalPriceFrom: draft.totalPriceFrom,
      totalSavings: 0,
      durationLabel: draft.durationLabel,
      area: draft.area ?? draft.city,
      goal: draft.goal,
      mood: draft.mood,
      budget: draft.budget,
      format: draft.format,
      recommendedFor: draft.recommendedFor,
      badgeLabel: draft.badgeLabel ?? 'AI маршрут Frendly',
      steps: (draft.steps ?? []).map((step: any) => ({
        sortOrder: step.sortOrder,
        timeLabel: step.timeLabel,
        endTimeLabel: step.endTimeLabel ?? null,
        kind: step.kind,
        title: step.title,
        venue: step.venue,
        address: step.address,
        description: step.description ?? null,
        emoji: step.emoji,
        distanceLabel: step.distanceLabel,
        walkMin: step.walkMin ?? null,
        ticketPrice: step.ticketPrice ?? null,
        ticketUrl: step.externalContentItem?.actionUrl ?? step.sourceUrl ?? null,
        ticketSourceCode: step.externalContentItem?.source?.code ?? null,
        ticketProvider: step.externalContentItem?.sourceProvider ?? step.sourceName ?? null,
        lat: step.lat,
        lng: step.lng,
      })),
    });

    await this.prismaService.client.generatedRouteReviewDraft.update({
      where: { id: draftId },
      data: {
        status: 'converted',
        createdTemplateId: revision.id,
        reviewedAt: draft.reviewedAt ?? new Date(),
      },
    });

    return revision;
  }

  async publishDraft(draftId: string) {
    const draft = await this.loadDraft(draftId);
    if (draft.status !== 'converted') {
      throw new ApiError(409, 'route_review_invalid_status', 'Draft cannot be published');
    }
    if (!draft.createdTemplateId) {
      throw new ApiError(409, 'route_review_template_missing', 'Route review template is missing');
    }
    const published = await this.routeService.publishTemplate(draft.createdTemplateId);
    await this.prismaService.client.generatedRouteReviewDraft.update({
      where: { id: draftId },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
    });
    return published;
  }

  async listImportRuns(query: Record<string, unknown> = {}): Promise<AdminExternalImportRunListDto> {
    const runs = await this.prismaService.client.externalImportRun.findMany({
      where: {
        ...(this.optionalText(query.city) ? { city: this.optionalText(query.city)! } : {}),
        ...(this.optionalText(query.status) ? { status: this.optionalText(query.status)! } : {}),
      },
      include: { source: { select: { code: true } } },
      orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
      take: this.parseLimit(query.limit),
    });
    return { items: runs.map((run: any) => this.mapImportRun(run)) };
  }

  async createImportRuns(input: AdminRouteReviewImportRunInput): Promise<AdminExternalImportRunListDto> {
    const city = this.requiredText(input.city, 'content_import_city_required');
    const from = this.requiredDate(input.from, 'content_import_from_invalid');
    const to = this.requiredDate(input.to, 'content_import_to_invalid');
    if (to <= from) {
      throw new ApiError(400, 'content_import_range_invalid', 'Import date range is invalid');
    }
    const sourceCodes = this.parseSources(input.sources);
    const items = [];
    for (const code of sourceCodes) {
      const source = await this.upsertSource(code);
      const run = await this.prismaService.client.externalImportRun.create({
        data: {
          sourceId: source.id,
          city,
          status: 'pending_manual',
          metadata: {
            from: from.toISOString(),
            to: to.toISOString(),
            requestedBy: 'admin',
          },
        },
        include: { source: { select: { code: true } } },
      });
      items.push(this.mapImportRun(run));
    }
    return { items };
  }

  async listContentItems(query: Record<string, unknown> = {}): Promise<AdminExternalContentItemListDto> {
    const limit = this.parseLimit(query.limit);
    const cursor = this.parseCursor(this.optionalText(query.cursor));
    const source = this.optionalText(query.source);
    const items = await this.prismaService.client.externalContentItem.findMany({
      where: {
        ...(this.optionalText(query.city) ? { city: this.optionalText(query.city)! } : {}),
        ...(this.optionalText(query.contentKind) ? { contentKind: this.optionalText(query.contentKind)! } : {}),
        ...(this.optionalText(query.category) ? { category: this.optionalText(query.category)! } : {}),
        ...(this.optionalText(query.priceMode) ? { priceMode: this.optionalText(query.priceMode)! } : {}),
        ...(this.optionalText(query.publicStatus) ? { publicStatus: this.optionalText(query.publicStatus)! } : {}),
        ...(this.optionalText(query.moderationStatus) ? { moderationStatus: this.optionalText(query.moderationStatus)! } : {}),
        ...(this.parseHasCoords(query.hasCoords) === true ? { lat: { not: null }, lng: { not: null } } : {}),
        ...(this.parseHasCoords(query.hasCoords) === false ? { OR: [{ lat: null }, { lng: null }] } : {}),
        ...(this.dateRangeWhere(query.dateFrom, query.dateTo)),
        ...(source ? { source: { code: source } } : {}),
        ...(cursor
          ? {
              OR: [
                { importedAt: { lt: cursor.createdAt } },
                { importedAt: cursor.createdAt, id: { gt: cursor.id } },
              ],
            }
          : {}),
      },
      include: { source: { select: { code: true, name: true } } },
      orderBy: [{ importedAt: 'desc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const page = items.slice(0, limit);
    const next = items.length > limit ? items[limit] : null;
    return {
      items: page.map((item: any) => this.mapContentItem(item)),
      nextCursor: next ? `${next.importedAt.toISOString()}|${next.id}` : null,
    };
  }

  async moderateContentItem(itemId: string, action: string) {
    const data = contentModerationData(action);
    if (!data) {
      throw new ApiError(400, 'content_item_action_invalid', 'Content item action is invalid');
    }
    const item = await this.prismaService.client.externalContentItem.update({
      where: { id: itemId },
      data,
      include: { source: { select: { code: true, name: true } } },
    });
    return this.mapContentItem(item);
  }

  async listGenerationRuns(query: Record<string, unknown> = {}): Promise<AdminRouteGenerationRunListDto> {
    const runs = await this.prismaService.client.generatedRouteDraftBatch.findMany({
      where: {
        ...(this.optionalText(query.city) ? { city: this.optionalText(query.city)! } : {}),
        ...(this.optionalText(query.status) ? { status: this.optionalText(query.status)! } : {}),
      },
      include: { _count: { select: { drafts: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: this.parseLimit(query.limit),
    });
    return { items: runs.map((run: any) => this.mapGenerationRun(run)) };
  }

  async createGenerationRun(input: AdminRouteGenerationRunInput): Promise<AdminRouteGenerationRunDto> {
    const city = this.requiredText(input.city, 'route_generation_city_required');
    const mood = this.requiredText(input.mood, 'route_generation_mood_required');
    const budget = this.requiredText(input.budget, 'route_generation_budget_required');
    const maxDrafts = this.parseMaxDrafts(input.maxDrafts);
    const run = await this.prismaService.client.generatedRouteDraftBatch.create({
      data: {
        city,
        timezone: 'Europe/Moscow',
        area: this.optionalText(input.area),
        mood,
        budget,
        audience: DEFAULT_AUDIENCE,
        format: DEFAULT_FORMAT,
        source: 'aggregation',
        status: 'pending_manual',
        promptVersion: PROMPT_VERSION,
        requestJson: {
          maxDrafts,
          requestedBy: 'admin',
        },
      },
      include: { _count: { select: { drafts: true } } },
    });
    return this.mapGenerationRun(run);
  }

  async listSources(): Promise<AdminRouteReviewSourceListDto> {
    const sources = await this.prismaService.client.externalContentSource.findMany({
      include: {
        importRuns: {
          orderBy: [{ startedAt: 'desc' as const }, { id: 'asc' as const }],
          take: 1,
        },
      },
      orderBy: [{ code: 'asc' }],
    });
    return { items: sources.map((source: any) => this.mapSource(source)) };
  }

  private async upsertSource(code: SourceCode) {
    const info = SOURCE_INFO[code];
    return this.prismaService.client.externalContentSource.upsert({
      where: { code },
      create: {
        code,
        name: info.name,
        kind: info.kind,
        baseUrl: info.baseUrl,
        status: 'active',
        config: sourceConfig(code),
      },
      update: {
        name: info.name,
        kind: info.kind,
        baseUrl: info.baseUrl,
        config: sourceConfig(code),
      },
    });
  }

  private async loadDraft(draftId: string) {
    const draft = await this.prismaService.client.generatedRouteReviewDraft.findUnique({
      where: { id: draftId },
      include: this.draftInclude(),
    });
    if (!draft) {
      throw new ApiError(404, 'route_review_draft_not_found', 'Route review draft not found');
    }
    return draft as any;
  }

  private draftInclude() {
    return {
      steps: {
        orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
        include: {
          externalContentItem: {
            include: {
              source: {
                select: { code: true, name: true },
              },
            },
          },
        },
      },
    };
  }

  private mapDraft(draft: any): AdminRouteReviewDraftDto {
    return {
      id: draft.id,
      batchId: draft.batchId,
      status: draft.status,
      title: draft.title,
      description: draft.description,
      city: draft.city,
      timezone: draft.timezone,
      area: draft.area ?? null,
      vibe: draft.vibe,
      budget: draft.budget,
      durationLabel: draft.durationLabel,
      totalPriceFrom: draft.totalPriceFrom,
      goal: draft.goal,
      mood: draft.mood,
      format: draft.format ?? null,
      recommendedFor: draft.recommendedFor ?? null,
      badgeLabel: draft.badgeLabel ?? null,
      score: draft.score,
      validationStatus: draft.validationStatus,
      validationIssues: Array.isArray(draft.validationIssues) ? draft.validationIssues : [],
      reviewedByAdminId: draft.reviewedByAdminId ?? null,
      reviewedAt: this.dateToIso(draft.reviewedAt),
      reviewNote: draft.reviewNote ?? null,
      createdTemplateId: draft.createdTemplateId ?? null,
      publishedAt: this.dateToIso(draft.publishedAt),
      rejectedAt: this.dateToIso(draft.rejectedAt),
      archivedAt: this.dateToIso(draft.archivedAt),
      createdAt: this.requiredDateToIso(draft.createdAt),
      updatedAt: this.requiredDateToIso(draft.updatedAt),
      steps: (draft.steps ?? []).map((step: any) => ({
        id: step.id,
        sortOrder: step.sortOrder,
        externalContentItemId: step.externalContentItemId ?? null,
        timeLabel: step.timeLabel,
        endTimeLabel: step.endTimeLabel ?? null,
        kind: step.kind,
        title: step.title,
        venue: step.venue,
        address: step.address,
        emoji: step.emoji,
        distanceLabel: step.distanceLabel,
        walkMin: step.walkMin ?? null,
        description: step.description ?? null,
        vibeTag: step.vibeTag ?? null,
        ticketPrice: step.ticketPrice ?? null,
        ticketUrl: step.externalContentItem?.actionUrl ?? step.sourceUrl ?? null,
        ticketSourceCode: step.externalContentItem?.source?.code ?? null,
        ticketProvider: step.externalContentItem?.sourceProvider ?? step.sourceName ?? null,
        lat: step.lat,
        lng: step.lng,
        sourceUrl: step.sourceUrl ?? step.externalContentItem?.sourceUrl ?? null,
        sourceName: step.sourceName ?? step.externalContentItem?.source?.name ?? null,
        sourceTitle: step.sourceTitle ?? step.externalContentItem?.title ?? null,
      })),
    };
  }

  private mapImportRun(run: any): AdminExternalImportRunDto {
    return {
      id: run.id,
      sourceId: run.sourceId,
      sourceCode: run.source?.code ?? null,
      city: run.city,
      status: run.status,
      startedAt: this.requiredDateToIso(run.startedAt),
      finishedAt: this.dateToIso(run.finishedAt),
      fetchedCount: run.fetchedCount,
      normalizedCount: run.normalizedCount,
      skippedCount: run.skippedCount,
      publishedCount: run.publishedCount ?? 0,
      paidCount: run.paidCount ?? 0,
      freeCount: run.freeCount ?? 0,
      unknownPriceCount: run.unknownPriceCount ?? 0,
      missingCoordsCount: run.missingCoordsCount ?? 0,
      errorCode: run.errorCode ?? null,
      errorMessage: run.errorMessage ?? null,
    };
  }

  private mapContentItem(item: any) {
    return {
      id: item.id,
      sourceId: item.sourceId,
      sourceCode: item.source?.code ?? null,
      sourceName: item.source?.name ?? null,
      sourceItemId: item.sourceItemId,
      sourceUrl: item.sourceUrl ?? null,
      contentKind: item.contentKind,
      city: item.city,
      timezone: item.timezone,
      area: item.area ?? null,
      title: item.title,
      shortSummary: item.shortSummary ?? null,
      category: item.category,
      tags: Array.isArray(item.tags) ? item.tags : [],
      address: item.address ?? null,
      lat: item.lat ?? null,
      lng: item.lng ?? null,
      startsAt: this.dateToIso(item.startsAt),
      endsAt: this.dateToIso(item.endsAt),
      priceFrom: item.priceFrom ?? null,
      currency: item.currency ?? null,
      venueName: item.venueName ?? null,
      imageUrl: item.imageUrl ?? null,
      actionUrl: item.actionUrl ?? null,
      actionKind: item.actionKind ?? null,
      priceMode: item.priceMode ?? 'unknown',
      isAffiliate: item.isAffiliate === true,
      sourceProvider: item.sourceProvider ?? null,
      placeKind: item.placeKind ?? null,
      publicStatus: item.publicStatus ?? 'published',
      hasCoords: item.lat != null && item.lng != null,
      routePlannerBlockedReason: routePlannerBlockedReason(item),
      rawSummary: rawSummary(item.raw),
      moderationStatus: item.moderationStatus,
      importedAt: this.requiredDateToIso(item.importedAt),
      expiresAt: this.dateToIso(item.expiresAt),
    };
  }

  private mapGenerationRun(run: any): AdminRouteGenerationRunDto {
    const request = run.requestJson != null && typeof run.requestJson === 'object'
      ? run.requestJson as Record<string, unknown>
      : {};
    return {
      id: run.id,
      city: run.city,
      timezone: run.timezone,
      area: run.area ?? null,
      mood: run.mood,
      budget: run.budget,
      audience: run.audience,
      format: run.format,
      source: run.source,
      status: run.status,
      promptVersion: run.promptVersion,
      maxDrafts: typeof request.maxDrafts === 'number' ? request.maxDrafts : null,
      draftCount: run._count?.drafts ?? 0,
      errorCode: run.errorCode ?? null,
      errorMessage: run.errorMessage ?? null,
      createdAt: this.requiredDateToIso(run.createdAt),
      finishedAt: this.dateToIso(run.finishedAt),
    };
  }

  private mapSource(source: any): AdminRouteReviewSourceDto {
    return {
      id: source.id,
      code: source.code,
      name: source.name,
      kind: source.kind,
      status: source.status,
      lastImportedAt: this.dateToIso(source.lastImportedAt),
      baseUrl: source.baseUrl ?? null,
      lastError: source.importRuns?.[0]?.errorMessage ?? null,
      lastFetchedCount: source.importRuns?.[0]?.fetchedCount ?? 0,
      lastPublishedCount: source.importRuns?.[0]?.publishedCount ?? 0,
    };
  }

  private parseHasCoords(value: unknown) {
    if (value === true || value === 'true' || value === '1') {
      return true;
    }
    if (value === false || value === 'false' || value === '0') {
      return false;
    }
    return null;
  }

  private dateRangeWhere(dateFrom: unknown, dateTo: unknown) {
    const from = this.optionalDate(dateFrom);
    const to = this.optionalDate(dateTo);
    if (!from && !to) {
      return {};
    }
    return {
      startsAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    };
  }

  private optionalDate(value: unknown) {
    const raw = this.optionalText(value);
    if (!raw) {
      return null;
    }
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private parseSources(value: unknown): SourceCode[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new ApiError(400, 'content_import_source_invalid', 'Import sources are invalid');
    }
    const sources = value.map((item) => this.requiredText(item, 'content_import_source_invalid'));
    for (const source of sources) {
      if (!VALID_SOURCES.includes(source as SourceCode)) {
        throw new ApiError(400, 'content_import_source_invalid', 'Import source is invalid');
      }
    }
    return Array.from(new Set(sources)) as SourceCode[];
  }

  private parseLimit(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.min(100, Math.max(1, Math.floor(value)));
    }
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return Math.min(100, Math.max(1, parsed));
      }
    }
    return 50;
  }

  private parseMaxDrafts(value: unknown) {
    const parsed = typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : 2;
    if (!Number.isFinite(parsed)) {
      return 2;
    }
    return Math.min(12, Math.max(1, Math.floor(parsed)));
  }

  private parseCursor(value: string | null) {
    if (!value) {
      return null;
    }
    const [rawDate, id] = value.split('|');
    const createdAt = new Date(rawDate ?? '');
    if (!id || Number.isNaN(createdAt.getTime())) {
      return null;
    }
    return { createdAt, id };
  }

  private requiredDate(value: unknown, code: string) {
    const raw = this.requiredText(value, code);
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      throw new ApiError(400, code, 'Date is invalid');
    }
    return date;
  }

  private requiredText(value: unknown, code: string) {
    const text = this.optionalText(value);
    if (!text) {
      throw new ApiError(400, code, 'Required text is missing');
    }
    return text;
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

  private requiredDateToIso(value: Date) {
    return value.toISOString();
  }
}

function sourceConfig(code: SourceCode) {
  if (code !== 'advcake_ticketland') {
    return {};
  }
  return {
    offerId: process.env.ADVCAKE_TICKETLAND_OFFER_ID ?? '663',
    websites: process.env.ADVCAKE_TICKETLAND_WEBSITES ?? 'ticketland.ru,live.mts.ru',
    feedFormat: process.env.ADVCAKE_FEED_FORMAT ?? 'yml',
  };
}

function contentModerationData(action: string) {
  switch (action) {
    case 'publish':
      return { publicStatus: 'published', moderationStatus: 'approved' };
    case 'hide':
      return { publicStatus: 'hidden', moderationStatus: 'pending' };
    case 'reject':
      return { publicStatus: 'hidden', moderationStatus: 'rejected' };
    case 'stale':
      return { publicStatus: 'stale' };
    case 'force-free':
      return { priceMode: 'free', priceFrom: 0, publicStatus: 'published' };
    case 'force-paid':
      return { priceMode: 'paid', publicStatus: 'published' };
    default:
      return null;
  }
}

function routePlannerBlockedReason(item: any) {
  if (item.contentKind !== 'event' && item.contentKind !== 'place') {
    return 'unsupported_kind';
  }
  if (item.publicStatus !== 'published') {
    return item.publicStatus ?? 'not_published';
  }
  if (item.moderationStatus === 'rejected') {
    return 'rejected';
  }
  if (item.lat == null || item.lng == null) {
    return 'missing_coords';
  }
  if (item.contentKind === 'event' && item.priceMode !== 'free' && item.priceMode !== 'paid') {
    return 'unknown_price';
  }
  return null;
}

function rawSummary(raw: unknown) {
  if (raw == null || typeof raw !== 'object') {
    return null;
  }
  const value = JSON.stringify(raw);
  return value.length > 600 ? `${value.slice(0, 600)}...` : value;
}
