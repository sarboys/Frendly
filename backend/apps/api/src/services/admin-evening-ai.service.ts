import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdminAiEveningBriefDto,
  AdminAiEveningBriefInput,
  AdminAiEveningDraftDto,
  AdminAiEveningGenerateResponseDto,
} from '@big-break/contracts';
import { ApiError } from '../common/api-error';
import { AdminEveningRouteService } from './admin-evening-route.service';
import {
  EveningRouteAiCandidatesService,
  EveningRouteAiCandidateVenue,
} from './evening-route-ai-candidates.service';
import {
  EveningRouteAiDraftInput,
  EveningRouteAiValidatorService,
  EveningRouteAiValidationResult,
} from './evening-route-ai-validator.service';
import { OpenRouterService } from './openrouter.service';
import { EveningAnalyticsService } from './evening-analytics.service';
import { PrismaService } from './prisma.service';

type GeneratedAiRoute = {
  title?: unknown;
  description?: unknown;
  vibe?: unknown;
  budget?: unknown;
  durationLabel?: unknown;
  totalPriceFrom?: unknown;
  recommendedFor?: unknown;
  steps?: GeneratedAiRouteStep[];
};

type GeneratedAiRouteStep = {
  venueId?: unknown;
  partnerOfferId?: unknown;
  kind?: unknown;
  title?: unknown;
  timeLabel?: unknown;
  endTimeLabel?: unknown;
  description?: unknown;
  transition?: unknown;
  priceEstimate?: unknown;
  walkMin?: unknown;
};

type OpenRouterRoutesResponse = {
  routes?: GeneratedAiRoute[];
};

const PROMPT_VERSION = 'evening-route-studio-v1';
const MAX_GENERATED_DRAFTS = 4;

@Injectable()
export class AdminEveningAiService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly candidatesService: EveningRouteAiCandidatesService,
    private readonly validatorService: EveningRouteAiValidatorService,
    private readonly openRouterService: OpenRouterService,
    private readonly routeService: AdminEveningRouteService,
    private readonly analytics?: EveningAnalyticsService,
  ) {}

  async createBrief(
    body: Record<string, unknown>,
  ): Promise<AdminAiEveningBriefDto> {
    const input = this.parseBriefInput(body);
    const brief = await this.prismaService.client.aiEveningBrief.create({
      data: {
        city: input.city,
        timezone: input.timezone ?? 'Europe/Moscow',
        area: input.area ?? null,
        titleIdea: input.titleIdea,
        audience: input.audience,
        format: input.format,
        mood: input.mood,
        budget: input.budget,
        durationMinutes: input.durationMinutes,
        minSteps: input.minSteps ?? 2,
        maxSteps: input.maxSteps ?? 4,
        requiredVenueIds: this.jsonArray(input.requiredVenueIds),
        excludedVenueIds: this.jsonArray(input.excludedVenueIds),
        partnerGoal: input.partnerGoal ?? null,
        tone: input.tone ?? null,
        boldness: input.boldness ?? null,
        createdByAdminId: input.createdByAdminId ?? null,
      },
    });

    return this.mapBrief(brief);
  }

  async getBrief(briefId: string): Promise<AdminAiEveningBriefDto> {
    const brief = await this.prismaService.client.aiEveningBrief.findUnique({
      where: { id: briefId },
    });
    if (!brief) {
      throw new ApiError(404, 'ai_evening_brief_not_found', 'AI brief not found');
    }
    return this.mapBrief(brief);
  }

  async generateDrafts(
    briefId: string,
  ): Promise<AdminAiEveningGenerateResponseDto> {
    const brief = await this.prismaService.client.aiEveningBrief.findUnique({
      where: { id: briefId },
    });
    if (!brief) {
      throw new ApiError(404, 'ai_evening_brief_not_found', 'AI brief not found');
    }

    const candidates = await this.selectCandidatesForBrief(brief);
    const promptRequest = this.buildPromptRequest(brief, candidates);
    const run = await this.prismaService.client.aiEveningGenerationRun.create({
      data: {
        briefId,
        provider: 'openrouter',
        model: this.openRouterService.configuredModel,
        promptVersion: PROMPT_VERSION,
        status: 'running',
        requestJson: promptRequest as Prisma.InputJsonValue,
      },
    });
    const startedAt = Date.now();

    try {
      const response =
        await this.openRouterService.generateJson<OpenRouterRoutesResponse>({
          systemPrompt: this.systemPrompt(),
          userPrompt: JSON.stringify(promptRequest),
          temperature: 0.35,
          maxTokens: 2400,
        });
      await this.prismaService.client.aiEveningGenerationRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          responseJson: response.rawResponse as Prisma.InputJsonValue,
          latencyMs: response.latencyMs,
          finishedAt: new Date(),
        },
      });

      const drafts = await this.saveGeneratedDrafts({
        brief,
        runId: run.id,
        candidates,
        routes: Array.isArray(response.parsedJson.routes)
          ? response.parsedJson.routes.slice(0, MAX_GENERATED_DRAFTS)
          : [],
      });

      await this.analytics?.track({
        name: 'ai_route_generated',
        city: brief.city,
        metadata: {
          briefId: brief.id,
          runId: run.id,
          draftCount: drafts.length,
        },
      });

      return {
        runId: run.id,
        status: 'completed',
        drafts,
      };
    } catch (caught) {
      await this.prismaService.client.aiEveningGenerationRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          errorCode:
            caught instanceof ApiError ? caught.code : 'ai_generation_failed',
          errorMessage:
            caught instanceof Error ? caught.message : 'AI generation failed',
          latencyMs: Date.now() - startedAt,
          finishedAt: new Date(),
        },
      });
      throw caught;
    }
  }

  async listDrafts(briefId: string): Promise<{ items: AdminAiEveningDraftDto[] }> {
    await this.getBrief(briefId);
    const drafts = await this.prismaService.client.aiEveningDraft.findMany({
      where: { briefId },
      include: this.draftInclude(),
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    });
    return {
      items: drafts.map((draft: any) => this.mapDraft(draft)),
    };
  }

  async convertDraft(draftId: string) {
    const draft = await this.prismaService.client.aiEveningDraft.findUnique({
      where: { id: draftId },
      include: {
        ...this.draftInclude(),
        brief: true,
      },
    });
    if (!draft) {
      throw new ApiError(404, 'ai_evening_draft_not_found', 'AI draft not found');
    }
    if (draft.validationStatus === 'invalid') {
      throw new ApiError(
        409,
        'ai_evening_draft_invalid',
        'AI draft has validation errors',
      );
    }
    if (draft.createdRouteId) {
      const route = await this.prismaService.client.eveningRoute.findUnique({
        where: { id: draft.createdRouteId },
        select: { templateId: true },
      });
      if (route?.templateId) {
        return this.routeService.getTemplate(route.templateId);
      }
    }

    const template = await this.routeService.createTemplate({
      city: draft.city,
      timezone: draft.brief.timezone,
      area: draft.area ?? draft.brief.area ?? null,
      source: 'team',
    });
    const revision = await this.routeService.createRevision(template.id, {
      title: draft.title,
      vibe: draft.vibe,
      blurb: draft.description,
      totalPriceFrom: draft.totalPriceFrom,
      totalSavings: 0,
      durationLabel: draft.durationLabel,
      area: draft.area ?? draft.brief.area ?? draft.city,
      goal: draft.brief.partnerGoal ?? draft.brief.audience,
      mood: draft.brief.mood,
      budget: draft.budget,
      format: draft.brief.format,
      recommendedFor: draft.brief.audience,
      badgeLabel: 'AI маршрут Frendly',
      steps: (draft.steps ?? []).map((step: any, index: number) => ({
        sortOrder: index + 1,
        timeLabel: step.timeLabel,
        endTimeLabel: step.endTimeLabel ?? null,
        kind: step.kind,
        title: step.title,
        venueId: step.venueId,
        partnerOfferId: step.partnerOfferId,
        description: step.description,
        emoji: emojiForKind(step.kind),
        distanceLabel: step.transition ?? '',
        walkMin: step.walkMin ?? null,
      })),
    });

    await this.prismaService.client.aiEveningDraft.update({
      where: { id: draft.id },
      data: {
        selectedAt: new Date(),
        createdRouteId: revision.currentRouteId,
      },
    });

    await this.analytics?.track({
      name: 'ai_route_converted',
      routeTemplateId: revision.id,
      routeId: revision.currentRouteId ?? null,
      city: draft.city,
      metadata: {
        briefId: draft.briefId,
        draftId: draft.id,
        runId: draft.runId,
      },
    });

    return revision;
  }

  private async selectCandidatesForBrief(brief: any) {
    const categories = categoryHints(brief.format);
    const tags = tagHints([
      brief.mood,
      brief.audience,
      brief.partnerGoal,
      brief.tone,
    ]);
    const base = {
      city: brief.city,
      requiredVenueIds: jsonStringArray(brief.requiredVenueIds),
      excludedVenueIds: jsonStringArray(brief.excludedVenueIds),
    };
    const filtered = await this.candidatesService.selectCandidates({
      ...base,
      categories,
      tags,
    });
    if (filtered.length > 0) {
      return filtered;
    }
    return this.candidatesService.selectCandidates(base);
  }

  private buildPromptRequest(
    brief: any,
    candidates: EveningRouteAiCandidateVenue[],
  ) {
    return {
      promptVersion: PROMPT_VERSION,
      instructions: {
        output: 'Return strict JSON with a routes array of 2 to 4 items.',
        placePolicy:
          'Use only venueId and partnerOfferId values from approvedVenues.',
        forbidden: 'Do not invent real places or offers.',
      },
      brief: {
        city: brief.city,
        timezone: brief.timezone,
        area: brief.area,
        titleIdea: brief.titleIdea,
        audience: brief.audience,
        format: brief.format,
        mood: brief.mood,
        budget: brief.budget,
        durationMinutes: brief.durationMinutes,
        minSteps: brief.minSteps,
        maxSteps: brief.maxSteps,
        requiredVenueIds: jsonStringArray(brief.requiredVenueIds),
        excludedVenueIds: jsonStringArray(brief.excludedVenueIds),
        partnerGoal: brief.partnerGoal,
        tone: brief.tone,
      },
      approvedVenues: candidates.map((venue) => ({
        id: venue.id,
        area: venue.area,
        name: venue.name,
        address: venue.address,
        category: venue.category,
        tags: venue.tags,
        averageCheck: venue.averageCheck,
        openingHours: venue.openingHours,
        offers: venue.offers.map((offer) => ({
          id: offer.id,
          title: offer.title,
          description: offer.description,
          shortLabel: offer.shortLabel,
        })),
      })),
      expectedShape: {
        routes: [
          {
            title: 'string',
            description: 'string',
            vibe: 'string',
            budget: brief.budget,
            durationLabel: '2.5 часа',
            totalPriceFrom: 1800,
            recommendedFor: brief.audience,
            steps: [
              {
                venueId: 'venue_id',
                partnerOfferId: 'offer_id or null',
                kind: 'bar',
                title: 'string',
                timeLabel: '19:00',
                endTimeLabel: '20:15',
                description: 'string',
                transition: '7 минут пешком',
                walkMin: 7,
              },
            ],
          },
        ],
      },
    };
  }

  private systemPrompt() {
    return [
      'You create curated Frendly evening route drafts for admins.',
      'Return only valid JSON.',
      'Each route must use only approved venue ids from the user prompt.',
      'Partner offers are optional and must use only active offer ids.',
    ].join('\n');
  }

  private async saveGeneratedDrafts(input: {
    brief: any;
    runId: string;
    candidates: EveningRouteAiCandidateVenue[];
    routes: GeneratedAiRoute[];
  }) {
    const drafts: AdminAiEveningDraftDto[] = [];
    for (const route of input.routes) {
      const normalized = this.normalizeGeneratedRoute(route, input.brief);
      const validation = this.validatorService.validateDraft(
        {
          minSteps: input.brief.minSteps,
          maxSteps: input.brief.maxSteps,
          budget: input.brief.budget,
          mood: input.brief.mood,
        },
        input.candidates,
        normalized,
      );
      const draft = await this.prismaService.client.aiEveningDraft.create({
        data: {
          briefId: input.brief.id,
          runId: input.runId,
          title: normalized.title ?? input.brief.titleIdea,
          description: stringOrFallback(route.description, ''),
          city: input.brief.city,
          area: input.brief.area,
          vibe: normalized.vibe ?? input.brief.mood,
          budget: normalized.budget ?? input.brief.budget,
          durationLabel:
            stringOrNull(route.durationLabel) ??
            `${Math.round(input.brief.durationMinutes / 30) / 2} часа`,
          totalPriceFrom: numberOrDefault(route.totalPriceFrom, 0),
          score: validation.score,
          validationStatus: validation.status,
          validationIssues: validation.issues as Prisma.InputJsonValue,
          steps: {
            create: ((normalized.steps ?? []) as GeneratedAiRouteStep[]).map((step, index) => ({
              sortOrder: index + 1,
              venueId: stringOrNull(step.venueId),
              partnerOfferId: stringOrNull(step.partnerOfferId),
              kind: stringOrFallback(step.kind, 'place'),
              title: stringOrFallback(step.title, `Шаг ${index + 1}`),
              timeLabel: stringOrFallback(step.timeLabel, '19:00'),
              endTimeLabel: stringOrNull(step.endTimeLabel),
              description: stringOrNull(step.description),
              transition: stringOrNull(step.transition),
              priceEstimate: numberOrNull(step.priceEstimate),
              walkMin: numberOrNull(step.walkMin),
            })),
          },
        },
        include: this.draftInclude(),
      });
      drafts.push(this.mapDraft(draft));
    }
    return drafts;
  }

  private normalizeGeneratedRoute(
    route: GeneratedAiRoute,
    brief: any,
  ): EveningRouteAiDraftInput & GeneratedAiRoute {
    const steps = Array.isArray(route.steps) ? route.steps : [];
    return {
      ...route,
      title: stringOrNull(route.title) ?? brief.titleIdea,
      vibe: stringOrNull(route.vibe) ?? brief.mood,
      mood: brief.mood,
      budget: stringOrNull(route.budget) ?? brief.budget,
      steps: steps.map((step) => ({
        ...step,
        venueId: stringOrNull(step.venueId),
        partnerOfferId: stringOrNull(step.partnerOfferId),
        timeLabel: stringOrNull(step.timeLabel),
        endTimeLabel: stringOrNull(step.endTimeLabel),
        walkMin: numberOrNull(step.walkMin),
      })),
    };
  }

  private parseBriefInput(body: Record<string, unknown>): AdminAiEveningBriefInput {
    const minSteps = this.optionalInt(body.minSteps) ?? 2;
    const maxSteps = this.optionalInt(body.maxSteps) ?? 4;
    if (minSteps < 1 || maxSteps < minSteps || maxSteps > 8) {
      throw new ApiError(
        400,
        'ai_evening_steps_range_invalid',
        'AI brief step range is invalid',
      );
    }
    return {
      city: this.requiredText(body.city, 'ai_evening_city_required'),
      timezone: this.optionalText(body.timezone) ?? 'Europe/Moscow',
      area: this.optionalText(body.area),
      titleIdea: this.requiredText(
        body.titleIdea,
        'ai_evening_title_idea_required',
      ),
      audience: this.requiredText(body.audience, 'ai_evening_audience_required'),
      format: this.requiredText(body.format, 'ai_evening_format_required'),
      mood: this.requiredText(body.mood, 'ai_evening_mood_required'),
      budget: this.requiredText(body.budget, 'ai_evening_budget_required'),
      durationMinutes: this.requiredInt(
        body.durationMinutes,
        'ai_evening_duration_invalid',
      ),
      minSteps,
      maxSteps,
      requiredVenueIds: this.stringArray(body.requiredVenueIds),
      excludedVenueIds: this.stringArray(body.excludedVenueIds),
      partnerGoal: this.optionalText(body.partnerGoal),
      tone: this.optionalText(body.tone),
      boldness: this.optionalText(body.boldness),
      createdByAdminId: this.optionalText(body.createdByAdminId),
    };
  }

  private draftInclude() {
    return {
      steps: {
        orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
      },
    };
  }

  private mapBrief(brief: any): AdminAiEveningBriefDto {
    return {
      id: brief.id,
      city: brief.city,
      timezone: brief.timezone,
      area: brief.area ?? null,
      titleIdea: brief.titleIdea,
      audience: brief.audience,
      format: brief.format,
      mood: brief.mood,
      budget: brief.budget,
      durationMinutes: brief.durationMinutes,
      minSteps: brief.minSteps,
      maxSteps: brief.maxSteps,
      requiredVenueIds: jsonStringArray(brief.requiredVenueIds),
      excludedVenueIds: jsonStringArray(brief.excludedVenueIds),
      partnerGoal: brief.partnerGoal ?? null,
      tone: brief.tone ?? null,
      boldness: brief.boldness ?? null,
      status: brief.status,
      createdAt: this.requiredDateToIso(brief.createdAt),
      updatedAt: this.requiredDateToIso(brief.updatedAt),
    };
  }

  private mapDraft(draft: any): AdminAiEveningDraftDto {
    return {
      id: draft.id,
      briefId: draft.briefId,
      runId: draft.runId ?? null,
      title: draft.title,
      description: draft.description,
      city: draft.city,
      area: draft.area ?? null,
      vibe: draft.vibe,
      budget: draft.budget,
      durationLabel: draft.durationLabel,
      totalPriceFrom: draft.totalPriceFrom,
      score: draft.score,
      validationStatus: draft.validationStatus,
      validationIssues: Array.isArray(draft.validationIssues)
        ? draft.validationIssues
        : [],
      selectedAt: this.dateToIso(draft.selectedAt),
      createdRouteId: draft.createdRouteId ?? null,
      createdAt: this.requiredDateToIso(draft.createdAt),
      updatedAt: this.requiredDateToIso(draft.updatedAt),
      steps: (draft.steps ?? []).map((step: any) => ({
        id: step.id,
        sortOrder: step.sortOrder,
        venueId: step.venueId ?? null,
        partnerOfferId: step.partnerOfferId ?? null,
        kind: step.kind,
        title: step.title,
        timeLabel: step.timeLabel,
        endTimeLabel: step.endTimeLabel ?? null,
        description: step.description ?? null,
        transition: step.transition ?? null,
        priceEstimate: step.priceEstimate ?? null,
        walkMin: step.walkMin ?? null,
      })),
    };
  }

  private jsonArray(value: string[] | undefined) {
    return (value ?? []) as Prisma.InputJsonArray;
  }

  private stringArray(value: unknown) {
    if (value == null) {
      return [];
    }
    if (!Array.isArray(value)) {
      throw new ApiError(
        400,
        'ai_evening_string_array_invalid',
        'Expected an array of strings',
      );
    }
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  }

  private optionalInt(value: unknown) {
    if (value == null || value === '') {
      return null;
    }
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number.parseInt(value, 10)
          : Number.NaN;
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new ApiError(400, 'number_invalid', 'Number is invalid');
    }
    return Math.floor(parsed);
  }

  private requiredInt(value: unknown, code: string) {
    const parsed = this.optionalInt(value);
    if (parsed == null) {
      throw new ApiError(400, code, 'Number is required');
    }
    return parsed;
  }

  private optionalText(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private requiredText(value: unknown, code: string) {
    const text = this.optionalText(value);
    if (!text) {
      throw new ApiError(400, code, 'Required text is missing');
    }
    return text;
  }

  private dateToIso(value: Date | null | undefined) {
    return value instanceof Date ? value.toISOString() : null;
  }

  private requiredDateToIso(value: Date | null | undefined) {
    return this.dateToIso(value) ?? '';
  }
}

function categoryHints(format: unknown) {
  const text = typeof format === 'string' ? format.toLowerCase() : '';
  const categories = ['bar', 'restaurant', 'cafe', 'gallery', 'cinema', 'walk'];
  return categories.filter((category) => text.includes(category));
}

function tagHints(values: unknown[]) {
  return values
    .flatMap((value) => (typeof value === 'string' ? value.split(/[,\s]+/) : []))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 1);
}

function jsonStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

function stringOrNull(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stringOrFallback(value: unknown, fallback: string) {
  return stringOrNull(value) ?? fallback;
}

function numberOrNull(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed);
    }
  }
  return null;
}

function numberOrDefault(value: unknown, fallback: number) {
  return numberOrNull(value) ?? fallback;
}

function emojiForKind(kind: unknown) {
  const value = typeof kind === 'string' ? kind : '';
  if (value.includes('bar')) {
    return '🍷';
  }
  if (value.includes('restaurant')) {
    return '🍽️';
  }
  if (value.includes('gallery')) {
    return '🖼️';
  }
  if (value.includes('walk')) {
    return '🚶';
  }
  return '✨';
}
