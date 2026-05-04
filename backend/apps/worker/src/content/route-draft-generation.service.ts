import { Injectable } from '@nestjs/common';
import { OpenRouterClient, OpenRouterClientError } from '@big-break/database';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type GeneratedRoute = {
  title?: unknown;
  description?: unknown;
  vibe?: unknown;
  durationLabel?: unknown;
  totalPriceFrom?: unknown;
  goal?: unknown;
  recommendedFor?: unknown;
  badgeLabel?: unknown;
  steps?: GeneratedRouteStep[];
};

type GeneratedRouteStep = {
  externalContentItemId?: unknown;
  timeLabel?: unknown;
  endTimeLabel?: unknown;
  kind?: unknown;
  title?: unknown;
  venue?: unknown;
  address?: unknown;
  emoji?: unknown;
  distanceLabel?: unknown;
  walkMin?: unknown;
  description?: unknown;
  vibeTag?: unknown;
  ticketPrice?: unknown;
  lat?: unknown;
  lng?: unknown;
};

type OpenRouterRouteReviewResponse = {
  routes?: GeneratedRoute[];
};

export type RouteDraftGenerationInput = {
  city: string;
  area?: string | null;
  mood: string;
  budget: string;
  maxDrafts?: number;
};

const PROMPT_VERSION = 'aggregation-route-review-v1';
const DEFAULT_AUDIENCE = 'friends';
const DEFAULT_FORMAT = 'evening_route';
const MAX_CANDIDATES_PER_PROMPT = 36;
const MAX_INPUT_PROMPT_CHARS = 720_000;
const MAX_OPENROUTER_TOKENS = 4096;
const DEFAULT_STALE_RUNNING_MS = 5 * 60 * 1000;
const FALLBACK_MAX_WALK_METERS = 1800;

@Injectable()
export class RouteDraftGenerationService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly openRouterClient: OpenRouterClient,
  ) {}

  async generateForCity(input: RouteDraftGenerationInput) {
    const candidates = await this.selectCandidates(input.city);
    if (candidates.length < 2) {
      return null;
    }
    const request = this.buildPromptRequest(input, candidates);
    const batch = await this.prismaService.client.generatedRouteDraftBatch.create({
      data: {
        city: input.city,
        timezone: 'Europe/Moscow',
        area: input.area ?? null,
        mood: input.mood,
        budget: input.budget,
        audience: DEFAULT_AUDIENCE,
        format: DEFAULT_FORMAT,
        source: 'aggregation',
        status: 'running',
        promptVersion: PROMPT_VERSION,
        requestJson: request as Prisma.InputJsonValue,
      },
    });

    await this.executeBatch(batch.id, input, candidates, request);
    return batch;
  }

  async processPendingManualBatches(limit = 5) {
    await this.failStaleRunningBatches();

    const batches = await this.prismaService.client.generatedRouteDraftBatch.findMany({
      where: { status: 'pending_manual' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });

    for (const batch of batches as any[]) {
      const input = this.inputFromBatch(batch);
      const candidates = await this.selectCandidates(input.city);
      if (candidates.length < 2) {
        await this.prismaService.client.generatedRouteDraftBatch.update({
          where: { id: batch.id },
          data: {
            status: 'failed',
            errorCode: 'content_candidates_insufficient',
            errorMessage: 'Not enough imported candidates with coordinates',
            finishedAt: new Date(),
          },
        });
        continue;
      }
      const request = this.buildPromptRequest(input, candidates);
      await this.prismaService.client.generatedRouteDraftBatch.update({
        where: { id: batch.id },
        data: {
          status: 'running',
          requestJson: {
            ...request,
            queuedRequest: batch.requestJson ?? null,
          } as Prisma.InputJsonValue,
          responseJson: undefined,
          errorCode: null,
          errorMessage: null,
          finishedAt: null,
        },
      });
      await this.executeBatch(batch.id, input, candidates, request);
    }
  }

  private async executeBatch(
    batchId: string,
    input: RouteDraftGenerationInput,
    candidates: any[],
    request: Record<string, unknown>,
  ) {
    try {
      console.log('[route-generation] started', {
        batchId,
        city: input.city,
        mood: input.mood,
        budget: input.budget,
        maxDrafts: input.maxDrafts ?? 4,
        candidateCount: candidates.length,
      });
      const generated = await this.generateRoutes(input, candidates, request);
      const routes = generated.routes;
      for (const route of routes) {
        await this.saveDraft(batchId, input, candidates, route);
      }
      await this.prismaService.client.generatedRouteDraftBatch.update({
        where: { id: batchId },
        data: {
          status: 'completed',
          responseJson: generated.responseJson,
          finishedAt: new Date(),
        },
      });

      console.log('[route-generation] completed', {
        batchId,
        draftCount: routes.length,
        fallback: generated.fallback,
      });
    } catch (caught) {
      const failure = routeGenerationFailure(caught);
      await this.prismaService.client.generatedRouteDraftBatch.update({
        where: { id: batchId },
        data: {
          status: 'failed',
          errorCode: failure.code,
          errorMessage: failure.message,
          finishedAt: new Date(),
        },
      });
      console.warn('[route-generation] failed', {
        batchId,
        code: failure.code,
        message: failure.message,
      });
    }
  }

  private async generateRoutes(
    input: RouteDraftGenerationInput,
    candidates: any[],
    request: Record<string, unknown>,
  ) {
    try {
      const response = await this.openRouterClient.generateJson<OpenRouterRouteReviewResponse>({
        systemPrompt: this.systemPrompt(),
        userPrompt: JSON.stringify(request).slice(0, MAX_INPUT_PROMPT_CHARS),
        temperature: 0.1,
        maxTokens: MAX_OPENROUTER_TOKENS,
      });
      const routes = Array.isArray(response.parsedJson.routes)
        ? response.parsedJson.routes.filter(hasUsableStepCount).slice(0, input.maxDrafts ?? 4)
        : [];
      if (routes.length > 0) {
        return {
          routes,
          responseJson: response.rawResponse as Prisma.InputJsonValue,
          fallback: false,
        };
      }
      throw new OpenRouterClientError(
        502,
        'openrouter_invalid_route_draft',
        'OpenRouter returned no route drafts with 2 to 4 steps',
      );
    } catch (caught) {
      const failure = routeGenerationFailure(caught);
      const fallbackRoute = buildFallbackRoute(input, candidates);
      if (!fallbackRoute) {
        throw caught;
      }
      console.warn('[route-generation] using fallback draft', {
        reasonCode: failure.code,
        reasonMessage: failure.message,
      });
      return {
        routes: [fallbackRoute],
        responseJson: {
          fallback: true,
          reasonCode: failure.code,
          reasonMessage: failure.message,
          generatedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
        fallback: true,
      };
    }
  }

  private async failStaleRunningBatches() {
    const staleAfterMs = Math.max(
      DEFAULT_STALE_RUNNING_MS,
      positiveInt(process.env.OPENROUTER_TIMEOUT_MS, 180_000) + 60_000,
      positiveInt(process.env.CONTENT_ROUTE_GENERATION_STALE_RUNNING_MS, 0),
    );
    const now = new Date();
    const cutoff = new Date(now.getTime() - staleAfterMs);
    const result = await this.prismaService.client.generatedRouteDraftBatch.updateMany({
      where: {
        status: 'running',
        createdAt: { lt: cutoff },
      },
      data: {
        status: 'failed',
        errorCode: 'route_generation_interrupted',
        errorMessage: 'Route generation was interrupted or exceeded stale running timeout. Start a new generation run.',
        finishedAt: now,
      },
    });
    if (result.count > 0) {
      console.warn('[route-generation] stale running batches failed', {
        count: result.count,
        staleAfterMs,
      });
    }
  }

  async runScheduledGeneration() {
    const cities = csv(process.env.CONTENT_IMPORT_CITIES) ?? ['Москва', 'Санкт-Петербург'];
    const maxDrafts = positiveInt(process.env.CONTENT_ROUTE_GENERATION_MAX_DRAFTS_PER_CITY, 12);
    for (const city of cities) {
      for (const mood of ['calm', 'social', 'date', 'culture', 'active']) {
        for (const budget of ['free', 'low', 'mid']) {
          await this.generateForCity({ city, mood, budget, maxDrafts });
        }
      }
    }
  }

  private selectCandidates(city: string) {
    const now = new Date();
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    return this.prismaService.client.externalContentItem.findMany({
      where: {
        city,
        moderationStatus: { in: ['pending', 'approved'] },
        lat: { not: null },
        lng: { not: null },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
        AND: [
          {
            OR: [
              { startsAt: null },
              { startsAt: { gte: now, lte: in14Days } },
            ],
          },
        ],
      },
      include: {
        source: {
          select: { code: true, name: true },
        },
      },
      orderBy: [{ startsAt: 'asc' }, { importedAt: 'desc' }, { id: 'asc' }],
      take: MAX_CANDIDATES_PER_PROMPT,
    });
  }

  private buildPromptRequest(input: RouteDraftGenerationInput, candidates: any[]) {
    return {
      promptVersion: PROMPT_VERSION,
      instructions: {
        output: 'Return strict JSON with a routes array of 1 to 4 route drafts.',
        sourcePolicy: 'Use only candidate ids from candidates. Keep source URLs only as references.',
        copyPolicy: 'Write original Frendly copy. Do not copy external article text.',
        forbidden: [
          'Do not claim a partner perk.',
          'Do not claim discounts, coupons, reservation, ticket availability, or official partnership.',
          'Do not publish anything. Drafts require admin review.',
          'Do not return empty route objects.',
        ],
        routePolicy: 'Each route must work as a social meeting scenario with 2 to 4 nearby steps.',
        stepPolicy: 'Every route must include a steps array with 2 to 4 step objects. If you cannot build that route, omit it.',
      },
      brief: {
        city: input.city,
        timezone: 'Europe/Moscow',
        area: input.area ?? null,
        mood: input.mood,
        budget: input.budget,
        audience: DEFAULT_AUDIENCE,
        format: DEFAULT_FORMAT,
      },
      candidates: candidates.map((item) => ({
        id: item.id,
        source: item.source?.code,
        sourceName: item.source?.name,
        sourceUrl: item.sourceUrl,
        contentKind: item.contentKind,
        title: item.title,
        summary: item.shortSummary,
        category: item.category,
        address: item.address,
        lat: item.lat,
        lng: item.lng,
        startsAt: dateToIso(item.startsAt),
        endsAt: dateToIso(item.endsAt),
        priceFrom: item.priceFrom,
      })),
      expectedShape: {
        routes: [
          {
            title: 'string under 90 chars',
            description: 'string under 500 chars',
            vibe: 'string',
            durationLabel: '2 часа',
            totalPriceFrom: 1000,
            goal: 'social',
            recommendedFor: 'friends',
            steps: [
              {
                externalContentItemId: 'candidate id',
                timeLabel: '19:00',
                endTimeLabel: '20:00',
                kind: 'cafe',
                title: 'string',
                venue: 'candidate title',
                address: 'candidate address',
                emoji: '☕',
                distanceLabel: '10 минут пешком',
                walkMin: 10,
                description: 'original copy',
                lat: 55.75,
                lng: 37.61,
              },
            ],
          },
        ],
      },
    };
  }

  private inputFromBatch(batch: {
    city: string;
    area?: string | null;
    mood: string;
    budget: string;
    requestJson?: unknown;
  }): RouteDraftGenerationInput {
    const request = batch.requestJson != null && typeof batch.requestJson === 'object'
      ? batch.requestJson as Record<string, unknown>
      : {};
    return {
      city: batch.city,
      area: batch.area ?? null,
      mood: batch.mood,
      budget: batch.budget,
      maxDrafts: positiveInt(request.maxDrafts, 2),
    };
  }

  private systemPrompt() {
    return [
      'You create Frendly evening route drafts for admin review.',
      'Return only strict JSON.',
      'Every route must include 2 to 4 steps.',
      'Never return empty route objects.',
      'Use only provided candidate ids and facts.',
      'Never claim coupons, partner perks, reservations, ticket availability, or official partnerships.',
      'Every draft is only a review draft, never a published route.',
    ].join('\n');
  }

  private async saveDraft(
    batchId: string,
    input: RouteDraftGenerationInput,
    candidates: any[],
    route: GeneratedRoute,
  ) {
    const steps = Array.isArray(route.steps) ? route.steps.slice(0, 4) : [];
    const validation = validateRoute(route, steps);
    const candidateById = new Map(candidates.map((item) => [item.id, item]));

    await this.prismaService.client.generatedRouteReviewDraft.create({
      data: {
        batchId,
        status: 'needs_review',
        title: text(route.title, 'Маршрут Frendly').slice(0, 90),
        description: text(route.description, '').slice(0, 500),
        city: input.city,
        timezone: 'Europe/Moscow',
        area: input.area ?? null,
        vibe: text(route.vibe, input.mood),
        budget: input.budget,
        durationLabel: text(route.durationLabel, '2 часа'),
        totalPriceFrom: int(route.totalPriceFrom, 0),
        goal: text(route.goal, 'social'),
        mood: input.mood,
        format: DEFAULT_FORMAT,
        recommendedFor: nullableText(route.recommendedFor),
        badgeLabel: nullableText(route.badgeLabel),
        score: validation.score,
        validationStatus: validation.status,
        validationIssues: validation.issues as Prisma.InputJsonValue,
        steps: {
          create: steps.map((step, index) => {
            const externalContentItemId = nullableText(step.externalContentItemId);
            const candidate = externalContentItemId ? candidateById.get(externalContentItemId) : null;
            const lat = number(step.lat) ?? candidate?.lat ?? 0;
            const lng = number(step.lng) ?? candidate?.lng ?? 0;
            return {
              externalContentItemId: candidate?.id ?? null,
              sortOrder: index + 1,
              timeLabel: text(step.timeLabel, '19:00'),
              endTimeLabel: nullableText(step.endTimeLabel),
              kind: text(step.kind, candidate?.category ?? 'place'),
              title: text(step.title, candidate?.title ?? `Шаг ${index + 1}`),
              venue: text(step.venue, candidate?.title ?? `Место ${index + 1}`),
              address: text(step.address, candidate?.address ?? 'Адрес уточняется'),
              emoji: text(step.emoji, emojiForKind(text(step.kind, candidate?.category ?? 'place'))),
              distanceLabel: text(step.distanceLabel, ''),
              walkMin: nullableInt(step.walkMin),
              description: nullableText(step.description),
              vibeTag: nullableText(step.vibeTag),
              ticketPrice: nullableInt(step.ticketPrice),
              lat,
              lng,
              sourceUrl: candidate?.sourceUrl ?? null,
              sourceName: candidate?.source?.name ?? null,
              sourceTitle: candidate?.title ?? null,
            };
          }),
        },
      },
    });
  }
}

function validateRoute(route: GeneratedRoute, steps: GeneratedRouteStep[]) {
  const issues = [];
  if (steps.length < 2 || steps.length > 4) {
    issues.push({ severity: 'error', code: 'steps_count_invalid', message: 'Route must have 2 to 4 steps' });
  }
  if (text(route.title, '').length > 90) {
    issues.push({ severity: 'error', code: 'title_too_long', message: 'Title is too long' });
  }
  if (text(route.description, '').length > 500) {
    issues.push({ severity: 'error', code: 'description_too_long', message: 'Description is too long' });
  }
  const seen = new Set<string>();
  steps.forEach((step, index) => {
    const id = nullableText(step.externalContentItemId);
    if (id) {
      if (seen.has(id)) {
        issues.push({ severity: 'error', code: 'source_item_repeated', message: 'Source item is repeated', stepIndex: index });
      }
      seen.add(id);
    }
    if (number(step.lat) == null || number(step.lng) == null) {
      issues.push({ severity: 'error', code: 'coordinates_missing', message: 'Step coordinates are missing', stepIndex: index });
    }
    const walkMin = nullableInt(step.walkMin);
    if (walkMin != null && walkMin >= 30) {
      issues.push({ severity: 'error', code: 'walk_too_long', message: 'Walk time is too long', stepIndex: index });
    }
  });
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  return {
    status: errorCount > 0 ? 'invalid' : 'valid',
    score: Math.max(0, 100 - errorCount * 20),
    issues,
  };
}

function hasUsableStepCount(route: GeneratedRoute) {
  const steps = Array.isArray(route.steps) ? route.steps : [];
  return steps.length >= 2 && steps.length <= 4;
}

function buildFallbackRoute(input: RouteDraftGenerationInput, candidates: any[]): GeneratedRoute | null {
  const selected = selectFallbackCandidates(candidates);
  if (selected.length < 2) {
    return null;
  }
  const routeTitle = fallbackTitle(input.mood, input.city);
  const steps = selected.map((candidate, index) => {
    const previous = index > 0 ? selected[index - 1] : null;
    const walkMin = previous
      ? Math.max(1, Math.ceil(distanceMeters(previous, candidate) / 80))
      : 0;
    const titleValue = text(candidate.title, `Место ${index + 1}`);
    const kind = text(candidate.category, text(candidate.contentKind, 'place'));
    return {
      externalContentItemId: candidate.id,
      timeLabel: ['19:00', '20:00', '21:00', '22:00'][index] ?? '19:00',
      endTimeLabel: ['19:45', '20:45', '21:45', '22:45'][index] ?? null,
      kind,
      title: titleValue,
      venue: titleValue,
      address: text(candidate.address, 'Адрес уточняется'),
      emoji: emojiForKind(kind),
      distanceLabel: index === 0 ? 'старт маршрута' : `${walkMin} минут пешком`,
      walkMin,
      description: fallbackStepDescription(index, titleValue, input.mood),
      vibeTag: input.mood,
      ticketPrice: nullableInt(candidate.priceFrom),
      lat: candidate.lat,
      lng: candidate.lng,
    };
  });
  const totalPriceFrom = selected.reduce(
    (sum, candidate) => sum + (nullableInt(candidate.priceFrom) ?? 0),
    0,
  );
  return {
    title: routeTitle,
    description: `${routeTitle}: ${steps.map((step) => step.venue).join(' -> ')}. Черновик собран автоматически из импортированных мест, проверь факты перед публикацией.`,
    vibe: fallbackVibe(input.mood),
    durationLabel: selected.length >= 3 ? '3 часа' : '2 часа',
    totalPriceFrom,
    goal: 'social',
    recommendedFor: 'friends',
    badgeLabel: 'fallback',
    steps,
  };
}

function selectFallbackCandidates(candidates: any[]) {
  const points = candidates
    .map((candidate) => ({
      ...candidate,
      lat: number(candidate.lat),
      lng: number(candidate.lng),
    }))
    .filter((candidate) => candidate.lat != null && candidate.lng != null);
  let best: any[] = [];
  for (const anchor of points) {
    const nearby = points
      .map((candidate) => ({
        candidate,
        distance: distanceMeters(anchor, candidate),
      }))
      .filter((item) => item.distance <= FALLBACK_MAX_WALK_METERS)
      .sort((left, right) => left.distance - right.distance)
      .map((item) => item.candidate);
    const selected = diversifyCandidates(nearby).slice(0, 3);
    if (selected.length > best.length) {
      best = selected;
    }
    if (best.length >= 3) {
      break;
    }
  }
  return best;
}

function diversifyCandidates(candidates: any[]) {
  const selected: any[] = [];
  const seenCategories = new Set<string>();
  for (const candidate of candidates) {
    const category = text(candidate.category, text(candidate.contentKind, 'place'));
    if (selected.length < 2 || !seenCategories.has(category)) {
      selected.push(candidate);
      seenCategories.add(category);
    }
    if (selected.length >= 3) {
      return selected;
    }
  }
  for (const candidate of candidates) {
    if (!selected.some((item) => item.id === candidate.id)) {
      selected.push(candidate);
    }
    if (selected.length >= 3) {
      return selected;
    }
  }
  return selected;
}

function distanceMeters(left: { lat: number; lng: number }, right: { lat: number; lng: number }) {
  const radius = 6371000;
  const lat1 = degreesToRadians(left.lat);
  const lat2 = degreesToRadians(right.lat);
  const deltaLat = degreesToRadians(right.lat - left.lat);
  const deltaLng = degreesToRadians(right.lng - left.lng);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return value * Math.PI / 180;
}

function fallbackTitle(mood: string, city: string) {
  if (mood === 'calm') {
    return `Спокойный вечер, ${city}`;
  }
  if (mood === 'social') {
    return `Дружеский вечер, ${city}`;
  }
  if (mood === 'date') {
    return `Маршрут для свидания, ${city}`;
  }
  if (mood === 'culture') {
    return `Культурный вечер, ${city}`;
  }
  if (mood === 'active') {
    return `Активный вечер, ${city}`;
  }
  return `Вечерний маршрут, ${city}`;
}

function fallbackVibe(mood: string) {
  if (mood === 'calm') {
    return 'спокойно';
  }
  if (mood === 'social') {
    return 'дружески';
  }
  if (mood === 'date') {
    return 'для двоих';
  }
  if (mood === 'culture') {
    return 'культурно';
  }
  if (mood === 'active') {
    return 'активно';
  }
  return mood;
}

function fallbackStepDescription(index: number, titleValue: string, mood: string) {
  if (index === 0) {
    return `Начните маршрут с "${titleValue}". Это базовый шаг для настроения "${fallbackVibe(mood)}".`;
  }
  return `Продолжите вечер в "${titleValue}". Место рядом с предыдущим шагом, проверь детали перед публикацией.`;
}

function text(value: unknown, fallback: string) {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function nullableText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function number(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function int(value: unknown, fallback: number) {
  const parsed = number(value);
  return parsed == null ? fallback : Math.max(0, Math.floor(parsed));
}

function nullableInt(value: unknown) {
  const parsed = number(value);
  return parsed == null ? null : Math.max(0, Math.floor(parsed));
}

function dateToIso(value: unknown) {
  return value instanceof Date ? value.toISOString() : null;
}

function csv(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }
  const values = value.split(',').map((item) => item.trim()).filter(Boolean);
  return values.length > 0 ? values : null;
}

function positiveInt(value: unknown, fallback: number) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseInt(value, 10)
      : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function routeGenerationFailure(caught: unknown) {
  if (caught instanceof OpenRouterClientError) {
    return {
      code: caught.code.slice(0, 120),
      message: caught.message.slice(0, 500),
    };
  }
  if (caught instanceof Error) {
    return {
      code: 'route_generation_failed',
      message: caught.message.slice(0, 500),
    };
  }
  return {
    code: 'route_generation_failed',
    message: 'Route generation failed',
  };
}

function emojiForKind(kind: string) {
  if (kind.includes('food') || kind.includes('cafe') || kind.includes('restaurant')) {
    return '☕';
  }
  if (kind.includes('bar')) {
    return '🍷';
  }
  if (kind.includes('culture') || kind.includes('museum') || kind.includes('gallery')) {
    return '🖼️';
  }
  if (kind.includes('walk') || kind.includes('park')) {
    return '🌿';
  }
  return '✨';
}
