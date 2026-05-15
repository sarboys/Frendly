import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { OpenRouterService } from './openrouter.service';
import { PrismaService } from './prisma.service';

const QWEN_FREE_MODEL = 'qwen/qwen3-next-80b-a3b-instruct:free';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CITY = 'Москва';
const DEFAULT_TIMEZONE = 'Europe/Moscow';
const MAX_STEP_COUNT = 4;
const MIN_STEP_COUNT = 2;
const MAX_CANDIDATES = 300;
const MAX_LEG_KM = 3.5;
const CANDIDATE_CORE_RATIO = 0.7;

type RouteRole =
  | 'place_food'
  | 'place_bar'
  | 'place_club'
  | 'show'
  | 'free_activity'
  | 'walk';

type CandidateCard = {
  id: string;
  role: RouteRole;
  source: 'tomesto' | 'advcake_ticketland' | 'kudago';
  contentKind: 'place' | 'event';
  title: string;
  area: string | null;
  tags: string[];
  priceMode: string;
  priceFrom: number | null;
  startsAt: string | null;
  lat: number;
  lng: number;
  address: string | null;
  venueName: string | null;
  actionUrl: string | null;
  sourceUrl: string | null;
  sourceProvider: string | null;
  shortSummary: string | null;
};

type GeneratedDraftJson = {
  title?: unknown;
  vibe?: unknown;
  blurb?: unknown;
  steps?: Array<{
    externalContentItemId?: unknown;
    timeLabel?: unknown;
    endTimeLabel?: unknown;
    description?: unknown;
  }>;
};

type DraftValidationIssue = {
  code: string;
  message: string;
  stepIndex?: number;
  externalContentItemId?: string;
};

type AiDraftRecord = {
  id: string;
  userId: string;
  status: string;
  city: string;
  timezone: string;
  prompt: string | null;
  goal: string | null;
  mood: string | null;
  budget: string | null;
  format: string | null;
  area: string | null;
  stepCount: number;
  candidatePackJson: unknown;
  routeSnapshotJson: unknown;
  acceptedStepIndexes: unknown;
  rejectedExternalItemIds: unknown;
  model: string | null;
  latencyMs: number | null;
  validationIssues: unknown | null;
  routeId: string | null;
  expiresAt: Date;
};

@Injectable()
export class EveningAiDraftService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly openRouterService: OpenRouterService,
  ) {}

  async createDraft(userId: string, body: Record<string, unknown>) {
    const input = this.parseInput(body);
    const roles = this.resolveRoles(input.prompt, input.format, input.stepCount);
    const candidates = await this.loadCandidatePack(input, roles);
    if (candidates.length < MIN_STEP_COUNT) {
      throw new ApiError(404, 'evening_ai_candidates_not_found', 'Route candidates not found');
    }

    const generated = await this.generateRouteWithFallback({
      input,
      roles,
      candidates,
      timeoutMs: 4500,
    });
    const expiresAt = new Date(Date.now() + DRAFT_TTL_MS);
    const draft = await (this.prismaService.client as any).eveningAiRouteDraft.create({
      data: {
        userId,
        status: 'reviewing',
        city: input.city,
        timezone: DEFAULT_TIMEZONE,
        prompt: input.prompt,
        goal: input.goal,
        mood: input.mood,
        budget: input.budget,
        format: input.format,
        area: input.area,
        stepCount: input.stepCount,
        candidatePackJson: candidates as unknown as Prisma.InputJsonValue,
        routeSnapshotJson: generated.route as unknown as Prisma.InputJsonValue,
        acceptedStepIndexes: [],
        rejectedExternalItemIds: [],
        model: generated.model,
        latencyMs: generated.latencyMs,
        validationIssues: generated.warnings as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
    });

    return this.mapDraftResponse(draft);
  }

  async getDraft(userId: string, draftId: string) {
    return this.mapDraftResponse(await this.loadDraft(userId, draftId));
  }

  async acceptStep(userId: string, draftId: string, stepIndex: number) {
    const draft = await this.loadDraft(userId, draftId);
    const route = this.routeSnapshot(draft);
    if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= route.steps.length) {
      throw new ApiError(400, 'evening_ai_step_index_invalid', 'Step index is invalid');
    }

    const accepted = new Set(this.numberList(draft.acceptedStepIndexes));
    accepted.add(stepIndex);
    const updated = await (this.prismaService.client as any).eveningAiRouteDraft.update({
      where: { id: draft.id },
      data: {
        acceptedStepIndexes: [...accepted].sort((left, right) => left - right),
      },
    });
    return this.mapDraftResponse(updated);
  }

  async regenerateStep(userId: string, draftId: string, stepIndex: number) {
    const draft = await this.loadDraft(userId, draftId);
    const route = this.routeSnapshot(draft);
    if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= route.steps.length) {
      throw new ApiError(400, 'evening_ai_step_index_invalid', 'Step index is invalid');
    }

    const candidates = this.candidatePack(draft);
    const rejected = new Set(this.stringList(draft.rejectedExternalItemIds));
    const currentCandidateId =
      this.hiddenExternalId(route.steps[stepIndex]) ?? candidates[stepIndex]?.id ?? null;
    if (currentCandidateId) {
      rejected.add(currentCandidateId);
    }

    const accepted = this.numberList(draft.acceptedStepIndexes)
      .filter((index) => index !== stepIndex)
      .sort((left, right) => left - right);
    const input = this.inputFromDraft(draft);
    const roles = this.resolveRoles(input.prompt, input.format, input.stepCount);
    const generated = await this.generateRouteWithFallback({
      input,
      roles,
      candidates: candidates.filter((candidate) => !rejected.has(candidate.id)),
      timeoutMs: 3500,
      previousRoute: route,
      regenerateStepIndex: stepIndex,
      rejectedIds: [...rejected],
    });
    const nextRoute = {
      ...route,
      steps: route.steps.map((step: any, index: number) =>
        index === stepIndex ? generated.route.steps[stepIndex] ?? step : step,
      ),
    };

    const updated = await (this.prismaService.client as any).eveningAiRouteDraft.update({
      where: { id: draft.id },
      data: {
        routeSnapshotJson: nextRoute as Prisma.InputJsonValue,
        acceptedStepIndexes: accepted,
        rejectedExternalItemIds: [...rejected],
        model: generated.model,
        latencyMs: generated.latencyMs,
        validationIssues: generated.warnings as unknown as Prisma.InputJsonValue,
      },
    });
    return this.mapDraftResponse(updated);
  }

  async confirmDraft(userId: string, draftId: string) {
    const draft = await this.loadDraft(userId, draftId);
    const route = this.routeSnapshot(draft);
    const accepted = new Set(this.numberList(draft.acceptedStepIndexes));
    if (route.steps.some((_step: unknown, index: number) => !accepted.has(index))) {
      throw new ApiError(
        409,
        'evening_ai_draft_steps_not_accepted',
        'All route steps must be accepted',
      );
    }
    if (draft.routeId) {
      return this.mapDraftResponse(draft);
    }

    const routeId = this.createId('route');
    const steps = route.steps.map((step: any, index: number) =>
      this.stepRecordFromDto(routeId, step, index),
    );
    const routeData = {
      id: routeId,
      templateId: null,
      title: route.title,
      vibe: route.vibe,
      blurb: route.blurb,
      totalPriceFrom: route.totalPriceFrom,
      totalSavings: 0,
      durationLabel: route.durationLabel,
      area: route.area,
      goal: route.goal,
      mood: route.mood,
      budget: route.budget,
      format: route.format ?? 'mixed',
      premium: false,
      recommendedFor: route.recommendedFor,
      hostsCount: 0,
      chatId: null,
      source: 'ai_openrouter',
      status: 'draft',
      city: draft.city,
      timezone: draft.timezone,
      isCurated: false,
      badgeLabel: 'AI маршрут',
      publishedAt: null,
    };

    await (this.prismaService.client as any).$transaction(async (tx: any) => {
      await tx.eveningRoute.create({ data: routeData });
      await tx.eveningRouteStep.createMany({ data: steps });
      await tx.eveningAiRouteDraft.update({
        where: { id: draft.id },
        data: {
          status: 'confirmed',
          routeId,
          routeSnapshotJson: { ...route, id: routeId } as Prisma.InputJsonValue,
        },
      });
    });

    return this.mapDraftResponse({
      ...draft,
      status: 'confirmed',
      routeId,
      routeSnapshotJson: { ...route, id: routeId },
    });
  }

  private async loadDraft(userId: string, draftId: string): Promise<AiDraftRecord> {
    const draft = await (this.prismaService.client as any).eveningAiRouteDraft.findFirst({
      where: {
        id: draftId,
        userId,
        expiresAt: { gt: new Date() },
      },
    });
    if (!draft) {
      throw new ApiError(404, 'evening_ai_draft_not_found', 'AI route draft not found');
    }
    return draft;
  }

  private async generateRouteWithFallback(input: {
    input: ParsedDraftInput;
    roles: RouteRole[];
    candidates: CandidateCard[];
    timeoutMs: number;
    previousRoute?: any;
    regenerateStepIndex?: number;
    rejectedIds?: string[];
    validationErrors?: DraftValidationIssue[];
  }) {
    let latestValidationIssues: DraftValidationIssue[] = [];
    try {
      const firstResponse = await this.openRouterService.generateJson<GeneratedDraftJson>({
        model: QWEN_FREE_MODEL,
        timeoutMs: input.timeoutMs,
        systemPrompt: this.systemPrompt(),
        userPrompt: this.userPrompt(input),
        temperature: 0.2,
        maxTokens: 900,
        responseFormat: this.responseFormat(),
      });
      const firstIssues = this.validateGeneratedRoute(
        input.input,
        input.roles,
        input.candidates,
        firstResponse.parsedJson,
      );
      if (firstIssues.length === 0) {
        const route = this.routeFromGenerated(
          input.input,
          input.roles,
          input.candidates,
          firstResponse.parsedJson,
        );
        return {
          route,
          model: firstResponse.model,
          latencyMs: firstResponse.latencyMs,
          warnings: [],
        };
      }

      latestValidationIssues = firstIssues;
      const retryResponse = await this.openRouterService.generateJson<GeneratedDraftJson>({
        model: QWEN_FREE_MODEL,
        timeoutMs: input.timeoutMs,
        systemPrompt: this.systemPrompt(),
        userPrompt: this.userPrompt({
          ...input,
          validationErrors: firstIssues,
        }),
        temperature: 0.2,
        maxTokens: 900,
        responseFormat: this.responseFormat(),
      });
      const retryIssues = this.validateGeneratedRoute(
        input.input,
        input.roles,
        input.candidates,
        retryResponse.parsedJson,
      );
      if (retryIssues.length > 0) {
        latestValidationIssues = retryIssues;
        const route = this.deterministicRoute(input);
        return {
          route,
          model: retryResponse.model,
          latencyMs: retryResponse.latencyMs,
          warnings: [
            {
              code: 'llm_validation_fallback',
              message: 'LLM route failed validation twice',
              issues: retryIssues,
            },
          ],
        };
      }
      const route = this.routeFromGenerated(
        input.input,
        input.roles,
        input.candidates,
        retryResponse.parsedJson,
      );
      return {
        route,
        model: retryResponse.model,
        latencyMs: retryResponse.latencyMs,
        warnings: [],
      };
    } catch (caught) {
      if (latestValidationIssues.length === 0) {
        latestValidationIssues = [
          {
            code: 'llm_response_error',
            message: caught instanceof Error ? caught.message : 'LLM response failed',
          },
        ];
        try {
          const retryResponse = await this.openRouterService.generateJson<GeneratedDraftJson>({
            model: QWEN_FREE_MODEL,
            timeoutMs: input.timeoutMs,
            systemPrompt: this.systemPrompt(),
            userPrompt: this.userPrompt({
              ...input,
              validationErrors: latestValidationIssues,
            }),
            temperature: 0.2,
            maxTokens: 900,
            responseFormat: this.responseFormat(),
          });
          const retryIssues = this.validateGeneratedRoute(
            input.input,
            input.roles,
            input.candidates,
            retryResponse.parsedJson,
          );
          if (retryIssues.length === 0) {
            const route = this.routeFromGenerated(
              input.input,
              input.roles,
              input.candidates,
              retryResponse.parsedJson,
            );
            return {
              route,
              model: retryResponse.model,
              latencyMs: retryResponse.latencyMs,
              warnings: [],
            };
          }
          latestValidationIssues = retryIssues;
          const route = this.deterministicRoute(input);
          return {
            route,
            model: retryResponse.model,
            latencyMs: retryResponse.latencyMs,
            warnings: [
              {
                code: 'llm_validation_fallback',
                message: 'LLM route failed validation after response retry',
                issues: retryIssues,
              },
            ],
          };
        } catch (retryCaught) {
          const route = this.deterministicRoute(input);
          return {
            route,
            model: QWEN_FREE_MODEL,
            latencyMs: null,
            warnings: [
              {
                code: 'llm_fallback_used',
                message: retryCaught instanceof Error ? retryCaught.message : 'LLM fallback used',
              },
              ...latestValidationIssues,
            ],
          };
        }
      }
      const route = this.deterministicRoute(input);
      return {
        route,
        model: QWEN_FREE_MODEL,
        latencyMs: null,
        warnings: [
          {
            code: 'llm_fallback_used',
            message: caught instanceof Error ? caught.message : 'LLM fallback used',
          },
          ...latestValidationIssues,
        ],
      };
    }
  }

  private deterministicRoute(input: {
    input: ParsedDraftInput;
    roles: RouteRole[];
    candidates: CandidateCard[];
  }) {
    return this.routeFromGenerated(input.input, input.roles, input.candidates, {
      title: null,
      vibe: null,
      blurb: null,
      steps: input.roles.map((role) => {
        const candidate = input.candidates.find((item) => item.role === role);
        return {
          externalContentItemId: candidate?.id,
        };
      }),
    });
  }

  private routeFromGenerated(
    input: ParsedDraftInput,
    roles: RouteRole[],
    candidates: CandidateCard[],
    generated: GeneratedDraftJson,
  ) {
    const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    const selected: CandidateCard[] = [];
    const usedIds = new Set<string>();
    const generatedSteps = Array.isArray(generated.steps) ? generated.steps : [];

    for (const [index, role] of roles.entries()) {
      const generatedId = stringOrNull(generatedSteps[index]?.externalContentItemId);
      const generatedCandidate = generatedId ? byId.get(generatedId) : null;
      const fallbackCandidate = candidates.find(
        (candidate) => candidate.role === role && !usedIds.has(candidate.id),
      );
      const candidate =
        generatedCandidate &&
        generatedCandidate.role === role &&
        !usedIds.has(generatedCandidate.id)
          ? generatedCandidate
          : fallbackCandidate;
      if (!candidate) {
        continue;
      }
      usedIds.add(candidate.id);
      selected.push(candidate);
    }

    if (selected.length < MIN_STEP_COUNT) {
      throw new ApiError(404, 'evening_ai_route_not_found', 'AI route not found');
    }

    const steps = selected.map((candidate, index) => {
      const generatedStep = generatedSteps[index] ?? {};
      const previous = selected[index - 1] ?? null;
      const legKm = previous ? geoDistanceKm(previous, candidate) : 0;
      const startHour = 19 + index;
      const timeLabel = stringOrNull(generatedStep.timeLabel) ?? `${pad2(startHour)}:00`;
      const endTimeLabel = stringOrNull(generatedStep.endTimeLabel) ?? `${pad2(startHour + 1)}:00`;
      const ticketUrl =
        candidate.source === 'advcake_ticketland'
          ? candidate.actionUrl ?? candidate.sourceUrl
          : null;
      return {
        id: this.createId('step'),
        externalContentItemId: candidate.id,
        time: timeLabel,
        endTime: endTimeLabel,
        kind: this.kindForRole(candidate.role),
        title: candidate.title,
        venue: candidate.venueName ?? candidate.title,
        address: candidate.address ?? input.city,
        emoji: this.emojiForRole(candidate.role),
        distance: index === 0 ? 'старт' : `${legKm.toFixed(1)} км`,
        walkMin: index === 0 ? null : Math.max(1, Math.round((legKm / 4.5) * 60)),
        perk: null,
        perkShort: null,
        ticketPrice: ticketUrl ? candidate.priceFrom : null,
        ticketCommission: null,
        ticketUrl,
        ticketSourceCode: candidate.source,
        ticketProvider: candidate.sourceProvider ?? candidate.source,
        sponsored: false,
        premium: false,
        partnerId: null,
        venueId: null,
        partnerOfferId: null,
        description:
          stringOrNull(generatedStep.description) ??
          candidate.shortSummary ??
          this.labelForRole(candidate.role),
        vibeTag: this.labelForRole(candidate.role),
        lat: candidate.lat,
        lng: candidate.lng,
        hasShareable: ticketUrl != null,
        state: {
          perkUsed: false,
          ticketBought: false,
          sentToChat: false,
          chatMessageId: null,
        },
      };
    });
    const totalPriceFrom = selected.reduce(
      (sum, candidate) => sum + Math.max(0, Number(candidate.priceFrom ?? 0)),
      0,
    );

    return {
      id: this.createId('draft_route'),
      title: stringOrNull(generated.title) ?? this.titleForRoles(roles),
      vibe: stringOrNull(generated.vibe) ?? 'AI собрал точки рядом',
      blurb: stringOrNull(generated.blurb) ?? 'Маршрут собран из городских источников.',
      totalPriceFrom,
      totalSavings: 0,
      durationLabel: `${steps[0]?.time ?? '19:00'} - ${steps[steps.length - 1]?.endTime ?? '22:00'}`,
      area: input.area ?? input.city,
      goal: input.goal ?? 'newfriends',
      mood: input.mood ?? 'chill',
      budget: input.budget ?? (totalPriceFrom === 0 ? 'free' : 'low'),
      format: input.format ?? 'mixed',
      premium: false,
      locked: false,
      recommendedFor: 'AI подобрал реальные места',
      hostsCount: 0,
      chatId: null,
      steps,
      userState: {
        usedPerkStepIds: [],
        boughtTicketStepIds: [],
        sentToChatStepIds: [],
      },
    };
  }

  private async loadCandidatePack(input: ParsedDraftInput, roles: RouteRole[]) {
    const uniqueRoles = Array.from(new Set(roles));
    const groups = await Promise.all(
      uniqueRoles.map((role) => this.loadRoleCandidates(input, role)),
    );
    const daySeed = new Date().toISOString().slice(0, 10);
    const serverSeed = process.env.EVENING_AI_CANDIDATE_SEED ?? daySeed;
    const seed = stableHash([serverSeed, input.prompt, input.city, input.area, roles.join('|')].join('|'));
    const perRoleLimit = Math.max(MIN_STEP_COUNT, Math.ceil(MAX_CANDIDATES / uniqueRoles.length));
    const rankedGroups = groups.map((group, index) =>
      this.rankCandidateGroup(
        input,
        group,
        stableHash(`${seed}:${uniqueRoles[index]}`),
        perRoleLimit,
      ),
    );
    const candidates: CandidateCard[] = [];
    for (let index = 0; candidates.length < MAX_CANDIDATES; index += 1) {
      let added = false;
      for (const group of rankedGroups) {
        const candidate = group[index];
        if (!candidate) {
          continue;
        }
        candidates.push(candidate);
        added = true;
        if (candidates.length >= MAX_CANDIDATES) {
          break;
        }
      }
      if (!added) {
        break;
      }
    }
    return candidates;
  }

  private rankCandidateGroup(
    input: ParsedDraftInput,
    candidates: CandidateCard[],
    seed: number,
    limit: number,
  ) {
    const ranked = candidates
      .slice()
      .sort((left, right) => this.candidateScore(input, left) - this.candidateScore(input, right));
    const cappedLimit = Math.min(limit, ranked.length);
    const coreSize = Math.min(cappedLimit, Math.floor(cappedLimit * CANDIDATE_CORE_RATIO));
    const core = ranked.slice(0, coreSize);
    const tail = ranked
      .slice(coreSize)
      .sort(
        (left, right) =>
          this.candidateTailScore(left, seed) - this.candidateTailScore(right, seed),
      )
      .slice(0, cappedLimit - core.length);
    return [...core, ...tail];
  }

  private async loadRoleCandidates(input: ParsedDraftInput, role: RouteRole): Promise<CandidateCard[]> {
    const source = this.sourceForRole(role);
    const contentKind = source === 'tomesto' ? 'place' : 'event';
    const where: Prisma.ExternalContentItemWhereInput = {
      source: { code: source },
      contentKind,
      publicStatus: 'published',
      city: input.city,
      lat: { not: null },
      lng: { not: null },
      ...(contentKind === 'event'
        ? {
            moderationStatus: { not: 'rejected' },
            startsAt: { gte: new Date() },
            priceMode:
              source === 'kudago'
                ? 'free'
                : { in: ['free', 'paid'] },
          }
        : {}),
      OR: this.searchTermsForRole(role).flatMap((term) => [
        { title: { contains: term, mode: 'insensitive' as const } },
        { category: { contains: term, mode: 'insensitive' as const } },
        { shortSummary: { contains: term, mode: 'insensitive' as const } },
        { venueName: { contains: term, mode: 'insensitive' as const } },
        { placeKind: { contains: term, mode: 'insensitive' as const } },
      ]),
    };

    const items = await (this.prismaService.client as any).externalContentItem.findMany({
      where,
      select: {
        id: true,
        title: true,
        shortSummary: true,
        category: true,
        tags: true,
        address: true,
        lat: true,
        lng: true,
        startsAt: true,
        endsAt: true,
        priceFrom: true,
        currency: true,
        venueName: true,
        actionUrl: true,
        sourceUrl: true,
        priceMode: true,
        sourceProvider: true,
        placeKind: true,
        area: true,
        source: {
          select: { code: true, name: true },
        },
      },
      orderBy:
        contentKind === 'event'
          ? [{ startsAt: 'asc' }, { id: 'asc' }]
          : [{ title: 'asc' }, { id: 'asc' }],
      take: 120,
    });

    return items
      .filter((item: any) => typeof item.lat === 'number' && typeof item.lng === 'number')
      .map((item: any) => ({
        id: item.id,
        role,
        source,
        contentKind,
        title: item.title,
        area: item.area ?? null,
        tags: normalizeTags(item.tags),
        priceMode: item.priceMode ?? 'unknown',
        priceFrom: typeof item.priceFrom === 'number' ? item.priceFrom : null,
        startsAt: item.startsAt instanceof Date ? item.startsAt.toISOString() : null,
        lat: roundCoord(item.lat),
        lng: roundCoord(item.lng),
        address: item.address ?? null,
        venueName: item.venueName ?? null,
        actionUrl: item.actionUrl ?? null,
        sourceUrl: item.sourceUrl ?? null,
        sourceProvider: item.sourceProvider ?? item.source?.name ?? null,
        shortSummary: item.shortSummary ?? null,
      }));
  }

  private mapDraftResponse(draft: AiDraftRecord) {
    const route = this.routeSnapshot(draft);
    const acceptedStepIndexes = this.numberList(draft.acceptedStepIndexes)
      .filter((index) => index >= 0 && index < route.steps.length)
      .sort((left, right) => left - right);
    const accepted = new Set(acceptedStepIndexes);
    const currentStepIndex = route.steps.findIndex((_step: unknown, index: number) => !accepted.has(index));
    const canConfirm = route.steps.length > 0 && currentStepIndex === -1;
    return {
      draftId: draft.id,
      route: this.publicRoute(route),
      acceptedStepIndexes,
      currentStepIndex: canConfirm ? null : currentStepIndex,
      canConfirm,
      expiresAt: draft.expiresAt.toISOString(),
      warnings: Array.isArray(draft.validationIssues) ? draft.validationIssues : [],
    };
  }

  private publicRoute(route: any) {
    return {
      ...route,
      steps: (route.steps ?? []).map((step: any) => {
        const { externalContentItemId: _externalContentItemId, ...publicStep } = step;
        return publicStep;
      }),
    };
  }

  private routeSnapshot(draft: AiDraftRecord): any {
    if (!draft.routeSnapshotJson || typeof draft.routeSnapshotJson !== 'object') {
      throw new ApiError(409, 'evening_ai_draft_invalid', 'AI draft is invalid');
    }
    return draft.routeSnapshotJson;
  }

  private candidatePack(draft: AiDraftRecord): CandidateCard[] {
    return Array.isArray(draft.candidatePackJson)
      ? (draft.candidatePackJson as CandidateCard[])
      : [];
  }

  private inputFromDraft(draft: AiDraftRecord): ParsedDraftInput {
    return {
      city: draft.city,
      prompt: draft.prompt,
      goal: draft.goal,
      mood: draft.mood,
      budget: draft.budget,
      format: draft.format,
      area: draft.area,
      stepCount: draft.stepCount,
      latitude: null,
      longitude: null,
    };
  }

  private parseInput(body: Record<string, unknown>): ParsedDraftInput {
    return {
      city: stringOrNull(body.city) ?? DEFAULT_CITY,
      prompt: stringOrNull(body.prompt),
      goal: stringOrNull(body.goal),
      mood: stringOrNull(body.mood),
      budget: stringOrNull(body.budget),
      format: this.parseFormat(body.format),
      area: stringOrNull(body.area),
      stepCount: this.parseStepCount(body.stepCount),
      latitude: numberOrNull(body.latitude),
      longitude: numberOrNull(body.longitude),
    };
  }

  private parseStepCount(value: unknown) {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number.parseInt(value, 10)
          : MIN_STEP_COUNT;
    if (!Number.isFinite(parsed)) {
      return MIN_STEP_COUNT;
    }
    return Math.max(MIN_STEP_COUNT, Math.min(MAX_STEP_COUNT, Math.trunc(parsed)));
  }

  private parseFormat(value: unknown) {
    const format = stringOrNull(value);
    if (!format) {
      return null;
    }
    if (['friends', 'friend', 'newfriends', 'social'].includes(format)) {
      return 'mixed';
    }
    return format;
  }

  private resolveRoles(prompt: string | null, format: string | null, stepCount: number): RouteRole[] {
    const normalized = normalizeText([prompt, format].filter(Boolean).join(' '));
    const roles: RouteRole[] = [];
    const add = (role: RouteRole) => {
      if (roles.length < stepCount && !roles.includes(role)) {
        roles.push(role);
      }
    };

    if (format === 'bar' || hasAny(normalized, ['бар', 'вино', 'коктейл', 'клуб'])) {
      add(normalized.includes('клуб') ? 'place_club' : 'place_bar');
    }
    if (hasAny(normalized, ['кафе', 'кофе', 'бранч', 'ужин', 'ресторан', 'еда'])) {
      add('place_food');
    }
    if (format === 'show' || hasAny(normalized, ['шоу', 'стендап', 'спектакл', 'театр', 'концерт', 'джаз'])) {
      add('show');
    }
    if (format === 'active' || hasAny(normalized, ['бесплат', 'прогул', 'маршрут', 'парк', 'праздн', 'активност'])) {
      add(hasAny(normalized, ['прогул', 'маршрут', 'парк']) ? 'walk' : 'free_activity');
    }

    while (roles.length < stepCount) {
      if (!roles.some((role) => role.startsWith('place_'))) {
        add('place_food');
      } else if (!roles.includes('show')) {
        add('show');
      } else if (!roles.includes('walk')) {
        add('walk');
      } else {
        add('free_activity');
      }
    }
    return roles.slice(0, stepCount);
  }

  private sourceForRole(role: RouteRole) {
    if (role === 'show') {
      return 'advcake_ticketland' as const;
    }
    if (role === 'walk' || role === 'free_activity') {
      return 'kudago' as const;
    }
    return 'tomesto' as const;
  }

  private searchTermsForRole(role: RouteRole) {
    switch (role) {
      case 'place_bar':
        return ['бар', 'вино', 'коктейл', 'wine', 'bar'];
      case 'place_club':
        return ['клуб', 'танцы', 'караоке', 'club'];
      case 'show':
        return ['стендап', 'спектакль', 'театр', 'концерт', 'джаз', 'шоу'];
      case 'walk':
        return ['прогулка', 'парк', 'маршрут', 'выставка'];
      case 'free_activity':
        return ['бесплатно', 'фестиваль', 'праздник', 'лекция', 'активность'];
      case 'place_food':
      default:
        return ['ресторан', 'кафе', 'бранч', 'ужин', 'еда', 'coffee'];
    }
  }

  private kindForRole(role: RouteRole) {
    if (role === 'show') {
      return 'show';
    }
    if (role === 'walk' || role === 'free_activity') {
      return 'active';
    }
    if (role === 'place_bar' || role === 'place_club') {
      return 'bar';
    }
    return 'dinner';
  }

  private emojiForRole(role: RouteRole) {
    if (role === 'show') {
      return '🎤';
    }
    if (role === 'walk' || role === 'free_activity') {
      return '🌿';
    }
    if (role === 'place_bar') {
      return '🍷';
    }
    if (role === 'place_club') {
      return '🪩';
    }
    return '🍽️';
  }

  private labelForRole(role: RouteRole) {
    if (role === 'show') {
      return 'Шоу';
    }
    if (role === 'walk') {
      return 'Прогулка';
    }
    if (role === 'free_activity') {
      return 'Активность';
    }
    if (role === 'place_bar') {
      return 'Бар';
    }
    if (role === 'place_club') {
      return 'Клуб';
    }
    return 'Еда';
  }

  private titleForRoles(roles: RouteRole[]) {
    return Array.from(new Set(roles.map((role) => this.labelForRole(role)))).join(' + ');
  }

  private candidateScore(input: ParsedDraftInput, candidate: CandidateCard) {
    let score = 0;
    const text = normalizeText([candidate.title, candidate.shortSummary, candidate.tags.join(' ')].join(' '));
    for (const term of this.searchTermsForRole(candidate.role)) {
      if (text.includes(normalizeText(term))) {
        score -= 20;
      }
    }
    if (input.budget === 'free' && candidate.priceMode !== 'free') {
      score += 100;
    }
    if (input.latitude != null && input.longitude != null) {
      score += geoDistanceKm(
        { lat: input.latitude, lng: input.longitude },
        candidate,
      ) * 10;
    }
    return score;
  }

  private candidateTailScore(candidate: CandidateCard, seed: number) {
    return stableHash(`${seed}:${candidate.id}`);
  }

  private systemPrompt() {
    return [
      'Return strict JSON only.',
      'Use only candidate ids from the prompt.',
      'Do not invent real places, addresses, dates or URLs.',
      'Build a coherent city route with short Russian copy.',
    ].join('\n');
  }

  private userPrompt(input: {
    input: ParsedDraftInput;
    roles: RouteRole[];
    candidates: CandidateCard[];
    previousRoute?: any;
    regenerateStepIndex?: number;
    rejectedIds?: string[];
    validationErrors?: DraftValidationIssue[];
  }) {
    return JSON.stringify({
      prompt: input.input.prompt,
      config: {
        city: input.input.city,
        area: input.input.area,
        budget: input.input.budget,
        goal: input.input.goal,
        mood: input.input.mood,
        format: input.input.format,
        stepCount: input.input.stepCount,
        roles: input.roles,
      },
      regenerateStepIndex: input.regenerateStepIndex ?? null,
      rejectedIds: input.rejectedIds ?? [],
      validationErrors: input.validationErrors ?? [],
      previousRoute: input.previousRoute
        ? {
            title: input.previousRoute.title,
            steps: input.previousRoute.steps?.map((step: any) => ({
              title: step.title,
              externalContentItemId: this.hiddenExternalId(step),
            })),
          }
        : null,
      candidates: input.candidates.map((candidate) => ({
        id: candidate.id,
        role: candidate.role,
        source: candidate.source,
        title: candidate.title,
        area: candidate.area,
        tags: candidate.tags.slice(0, 8),
        priceMode: candidate.priceMode,
        priceFrom: candidate.priceFrom,
        startsAt: candidate.startsAt,
        geo: `${candidate.lat},${candidate.lng}`,
      })),
    });
  }

  private responseFormat() {
    return {
      type: 'json_schema',
      json_schema: {
        name: 'evening_ai_route',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            vibe: { type: 'string' },
            blurb: { type: 'string' },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  externalContentItemId: { type: 'string' },
                  timeLabel: { type: 'string' },
                  endTimeLabel: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['externalContentItemId', 'timeLabel', 'endTimeLabel', 'description'],
              },
            },
          },
          required: ['title', 'vibe', 'blurb', 'steps'],
        },
      },
    };
  }

  private validateGeneratedRoute(
    input: ParsedDraftInput,
    roles: RouteRole[],
    candidates: CandidateCard[],
    generated: GeneratedDraftJson,
  ) {
    const issues: DraftValidationIssue[] = [];
    const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    const used = new Set<string>();
    const generatedSteps = Array.isArray(generated.steps) ? generated.steps : null;
    if (!generatedSteps) {
      return [
        {
          code: 'invalid_steps',
          message: 'LLM response does not contain steps array',
        },
      ];
    }
    const selected: CandidateCard[] = [];

    roles.forEach((role, index) => {
      const externalContentItemId = stringOrNull(generatedSteps[index]?.externalContentItemId);
      if (!externalContentItemId) {
        issues.push({
          code: 'missing_external_content_item_id',
          message: 'Step is missing externalContentItemId',
          stepIndex: index,
        });
        return;
      }

      const candidate = byId.get(externalContentItemId);
      if (!candidate) {
        issues.push({
          code: 'unknown_external_content_item_id',
          message: 'Step uses an id outside candidate pack',
          stepIndex: index,
          externalContentItemId,
        });
        return;
      }
      if (used.has(externalContentItemId)) {
        issues.push({
          code: 'duplicate_external_content_item_id',
          message: 'Route contains duplicated candidate id',
          stepIndex: index,
          externalContentItemId,
        });
      }
      used.add(externalContentItemId);
      if (candidate.role !== role) {
        issues.push({
          code: 'role_mismatch',
          message: `Step role must be ${role}`,
          stepIndex: index,
          externalContentItemId,
        });
      }
      if (candidate.source !== this.sourceForRole(role)) {
        issues.push({
          code: 'source_role_mismatch',
          message: `Source ${candidate.source} does not match role ${role}`,
          stepIndex: index,
          externalContentItemId,
        });
      }
      if (candidate.contentKind === 'event') {
        const startsAt = candidate.startsAt ? new Date(candidate.startsAt) : null;
        if (startsAt && Number.isFinite(startsAt.getTime()) && startsAt.getTime() < Date.now()) {
          issues.push({
            code: 'expired_event',
            message: 'Event candidate is in the past',
            stepIndex: index,
            externalContentItemId,
          });
        }
      }
      if (input.budget === 'free' && candidate.priceMode !== 'free') {
        issues.push({
          code: 'budget_mismatch',
          message: 'Free route cannot use paid candidate',
          stepIndex: index,
          externalContentItemId,
        });
      }
      if (candidate.source === 'advcake_ticketland' && !candidate.actionUrl && !candidate.sourceUrl) {
        issues.push({
          code: 'ticket_metadata_missing',
          message: 'Ticket candidate has no ticket URL metadata',
          stepIndex: index,
          externalContentItemId,
        });
      }
      selected.push(candidate);
    });

    for (let index = 1; index < selected.length; index += 1) {
      const previous = selected[index - 1];
      const current = selected[index];
      if (!previous || !current) {
        continue;
      }
      const distanceKm = geoDistanceKm(previous, current);
      if (distanceKm > MAX_LEG_KM) {
        issues.push({
          code: 'max_walk_exceeded',
          message: `Leg distance ${distanceKm.toFixed(1)} km exceeds ${MAX_LEG_KM} km`,
          stepIndex: index,
          externalContentItemId: current.id,
        });
      }
    }

    return issues;
  }

  private stepRecordFromDto(routeId: string, step: any, sortOrder: number) {
    return {
      id: this.createId('step'),
      routeId,
      venueId: null,
      partnerOfferId: null,
      sortOrder,
      timeLabel: step.time,
      endTimeLabel: step.endTime ?? null,
      kind: step.kind,
      title: step.title,
      venue: step.venue,
      address: step.address,
      emoji: step.emoji,
      distanceLabel: step.distance,
      walkMin: step.walkMin ?? null,
      perk: null,
      perkShort: null,
      ticketPrice: step.ticketPrice ?? null,
      ticketCommission: step.ticketCommission ?? null,
      ticketUrl: step.ticketUrl ?? null,
      ticketSourceCode: step.ticketSourceCode ?? null,
      ticketProvider: step.ticketProvider ?? null,
      sponsored: false,
      premium: false,
      partnerId: null,
      description: step.description ?? null,
      vibeTag: step.vibeTag ?? null,
      lat: step.lat,
      lng: step.lng,
      offerTitleSnapshot: null,
      offerDescriptionSnapshot: null,
      offerTermsSnapshot: null,
      offerShortLabelSnapshot: null,
    };
  }

  private hiddenExternalId(step: any) {
    return typeof step?.externalContentItemId === 'string' ? step.externalContentItemId : null;
  }

  private numberList(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is number => Number.isInteger(item))
      : [];
  }

  private stringList(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];
  }

  private createId(prefix: string) {
    return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
  }
}

type ParsedDraftInput = {
  city: string;
  prompt: string | null;
  goal: string | null;
  mood: string | null;
  budget: string | null;
  format: string | null;
  area: string | null;
  stepCount: number;
  latitude: number | null;
  longitude: number | null;
};

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberOrNull(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, 'е');
}

function hasAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(normalizeText(term)));
}

function roundCoord(value: number) {
  return Math.round(value * 10000) / 10000;
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function geoDistanceKm(
  left: { lat: number; lng: number },
  right: { lat: number; lng: number },
) {
  const earthRadiusKm = 6371;
  const lat1 = toRad(left.lat);
  const lat2 = toRad(right.lat);
  const dLat = toRad(right.lat - left.lat);
  const dLng = toRad(right.lng - left.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}
