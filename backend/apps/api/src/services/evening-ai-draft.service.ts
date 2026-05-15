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
const DEFAULT_STEP_COUNT = 5;
const MAX_STEP_COUNT = 5;
const MIN_STEP_COUNT = 2;
const MAX_CANDIDATES = 300;
const MAX_LEG_KM = 3.5;
const CANDIDATE_CORE_RATIO = 0.7;
const WALK_ALLOWED_CATEGORY_TERMS = ['walk', 'outdoor', 'park', 'route', 'маршрут', 'прогул', 'парк'];
const WALK_STRONG_TERMS = [
  'прогул',
  'пеш',
  'маршрут',
  'парк',
  'сквер',
  'сад',
  'набереж',
  'бульвар',
  'лесопарк',
  'усадьб',
  'площад',
  'алле',
];
const WALK_BLOCKED_TERMS = [
  'каток',
  'коньк',
  'ледовый',
  'аквапарк',
  'аттракцион',
  'квест',
  'vr',
  'виртуаль',
  'музей',
  'выстав',
  'экспозици',
  'галере',
  'театр',
  'спектак',
  'кино',
  'цирк',
  'зоопарк',
  'ресторан',
  'кафе',
  'клуб',
  'караоке',
  'боулинг',
  'батут',
  'стадион',
  'арена',
];
const WALK_BLOCKED_CATEGORY_TERMS = [
  'sport',
  'active',
  'quest',
  'museum',
  'exhibition',
  'theatre',
  'cinema',
  'concert',
  'food',
  'restaurant',
  'bar',
  'club',
  'entertainment',
];

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
  category: string | null;
  placeKind: string | null;
  priceMode: string;
  priceFrom: number | null;
  startsAt: string | null;
  lat: number | null;
  lng: number | null;
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

type GeneratedIntentJson = {
  steps?: Array<{
    role?: unknown;
    preferredTerms?: unknown;
    avoidTerms?: unknown;
    instruction?: unknown;
  }>;
};

type DraftValidationIssue = {
  code: string;
  message: string;
  stepIndex?: number;
  externalContentItemId?: string;
};

type RoleIntentHint = {
  role: RouteRole;
  preferredTerms: string[];
  avoidTerms: string[];
  instruction: string | null;
};

type DraftIntent = {
  roles: RouteRole[];
  roleHints: RoleIntentHint[];
  source: 'llm' | 'rules';
};

type RouteSnapshotIntent = DraftIntent;

const ROUTE_ROLES: RouteRole[] = [
  'place_food',
  'place_bar',
  'place_club',
  'show',
  'free_activity',
  'walk',
];
const ROUTE_ROLE_SET = new Set<string>(ROUTE_ROLES);

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
    const parsedInput = this.parseInput(body);
    const intent = await this.resolveDraftIntent(parsedInput);
    const input = { ...parsedInput, stepCount: intent.roles.length };
    const candidates = await this.loadCandidatePack(input, intent.roles, intent.roleHints);
    if (candidates.length < MIN_STEP_COUNT) {
      throw new ApiError(404, 'evening_ai_candidates_not_found', 'Route candidates not found');
    }

    const generated = await this.generateRouteWithFallback({
      input,
      roles: intent.roles,
      roleHints: intent.roleHints,
      candidates,
      timeoutMs: 4500,
    });
    const expiresAt = new Date(Date.now() + DRAFT_TTL_MS);
    const routeSnapshot = this.routeWithIntent(generated.route, intent);
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
        routeSnapshotJson: routeSnapshot as unknown as Prisma.InputJsonValue,
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
    const intent = this.intentFromRoute(route, input) ?? await this.resolveDraftIntent(input);
    const generated = await this.generateRouteWithFallback({
      input,
      roles: intent.roles,
      roleHints: intent.roleHints,
      candidates: candidates.filter((candidate) => !rejected.has(candidate.id)),
      timeoutMs: 3500,
      previousRoute: route,
      regenerateStepIndex: stepIndex,
      rejectedIds: [...rejected],
    });
    const nextRoute = this.routeWithIntent({
      ...route,
      steps: route.steps.map((step: any, index: number) =>
        index === stepIndex ? generated.route.steps[stepIndex] ?? step : step,
      ),
    }, intent);

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

  async regenerateDraft(userId: string, draftId: string) {
    const draft = await this.loadDraft(userId, draftId);
    const route = this.routeSnapshot(draft);
    const candidates = this.candidatePack(draft);
    const rejected = new Set(this.stringList(draft.rejectedExternalItemIds));
    for (const [index, step] of (route.steps ?? []).entries()) {
      const currentId = this.hiddenExternalId(step) ?? candidates[index]?.id ?? null;
      if (currentId) {
        rejected.add(currentId);
      }
    }

    const input = this.inputFromDraft(draft);
    const intent = this.intentFromRoute(route, input) ?? await this.resolveDraftIntent(input);
    const availableCandidates = candidates.filter((candidate) => !rejected.has(candidate.id));
    if (
      availableCandidates.length < MIN_STEP_COUNT ||
      !this.hasEnoughCandidatesForRoles(availableCandidates, intent.roles)
    ) {
      throw new ApiError(
        409,
        'evening_ai_regenerate_candidates_exhausted',
        'Not enough alternative candidates to regenerate route',
      );
    }

    const generated = await this.generateRouteWithFallback({
      input,
      roles: intent.roles,
      roleHints: intent.roleHints,
      candidates: availableCandidates,
      timeoutMs: 4500,
      previousRoute: route,
      rejectedIds: [...rejected],
    });
    const nextRoute = this.routeWithIntent(generated.route, intent);
    const updated = await (this.prismaService.client as any).eveningAiRouteDraft.update({
      where: { id: draft.id },
      data: {
        routeSnapshotJson: nextRoute as Prisma.InputJsonValue,
        acceptedStepIndexes: [],
        rejectedExternalItemIds: [...rejected],
        model: generated.model,
        latencyMs: generated.latencyMs,
        validationIssues: generated.warnings as unknown as Prisma.InputJsonValue,
      },
    });
    return this.mapDraftResponse(updated);
  }

  private hasEnoughCandidatesForRoles(candidates: CandidateCard[], roles: RouteRole[]) {
    const availableByRole = new Map<RouteRole, number>();
    for (const candidate of candidates) {
      availableByRole.set(candidate.role, (availableByRole.get(candidate.role) ?? 0) + 1);
    }
    const neededByRole = new Map<RouteRole, number>();
    for (const role of roles) {
      neededByRole.set(role, (neededByRole.get(role) ?? 0) + 1);
      if ((availableByRole.get(role) ?? 0) < (neededByRole.get(role) ?? 0)) {
        return false;
      }
    }
    return true;
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
    roleHints?: RoleIntentHint[];
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
        input.roleHints,
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
        input.roleHints,
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
            input.roleHints,
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
      const legKm =
        previous && hasCandidateCoords(previous) && hasCandidateCoords(candidate)
          ? geoDistanceKm(previous, candidate)
          : null;
      const routePoint = this.routePointForCandidate(input, candidate);
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
        distance:
          index === 0
            ? 'старт'
            : legKm == null
              ? 'адрес в билете'
              : `${legKm.toFixed(1)} км`,
        walkMin:
          index === 0 || legKm == null
            ? null
            : Math.max(1, Math.round((legKm / 4.5) * 60)),
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
        lat: routePoint.lat,
        lng: routePoint.lng,
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

  private async loadCandidatePack(
    input: ParsedDraftInput,
    roles: RouteRole[],
    roleHints: RoleIntentHint[] = [],
  ) {
    const uniqueRoles = Array.from(new Set(roles));
    const groups = await Promise.all(
      uniqueRoles.map((role) => this.loadRoleCandidates(input, role, roleHints)),
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
        roleHints,
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
    roleHints: RoleIntentHint[] = [],
  ) {
    const ranked = candidates
      .slice()
      .sort(
        (left, right) =>
          this.candidateScore(input, left, roleHints) -
          this.candidateScore(input, right, roleHints),
      );
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

  private async loadRoleCandidates(
    input: ParsedDraftInput,
    role: RouteRole,
    roleHints: RoleIntentHint[] = [],
  ): Promise<CandidateCard[]> {
    const source = this.sourceForRole(role);
    const contentKindWhere =
      source === 'tomesto'
        ? 'place'
        : source === 'kudago'
          ? { in: ['event', 'place'] }
          : 'event';
    const intent = this.roleIntentHint(input, role, roleHints);
    const baseWhere: Prisma.ExternalContentItemWhereInput = {
      source: { code: source },
      contentKind: contentKindWhere,
      publicStatus: 'published',
      city: input.city,
      ...(source === 'advcake_ticketland'
        ? {}
        : {
            lat: { not: null },
            lng: { not: null },
          }),
      ...(source === 'advcake_ticketland'
        ? {
            moderationStatus: { not: 'rejected' },
            startsAt: { gte: new Date() },
            priceMode: { in: ['free', 'paid'] },
          }
        : {}),
      ...(source === 'kudago'
        ? {
            AND: [
              {
                OR: [
                  { contentKind: 'place' },
                  {
                    contentKind: 'event',
                    moderationStatus: { not: 'rejected' },
                    startsAt: { gte: new Date() },
                    priceMode: 'free',
                  },
                ],
              },
            ],
          }
        : {}),
    };

    const findManyByTerms = (terms: string[], take: number) => {
      const where: Prisma.ExternalContentItemWhereInput = {
        ...baseWhere,
        OR: terms.flatMap((term) => [
          { title: { contains: term, mode: 'insensitive' as const } },
          { category: { contains: term, mode: 'insensitive' as const } },
          { shortSummary: { contains: term, mode: 'insensitive' as const } },
          { venueName: { contains: term, mode: 'insensitive' as const } },
          { placeKind: { contains: term, mode: 'insensitive' as const } },
        ]),
      };

      return (this.prismaService.client as any).externalContentItem.findMany({
        where,
        select: {
          id: true,
          contentKind: true,
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
          source === 'tomesto'
            ? [{ title: 'asc' }, { id: 'asc' }]
            : [{ startsAt: 'asc' }, { title: 'asc' }, { id: 'asc' }],
        take,
      });
    };

    const [preferredItems, genericItems] = await Promise.all([
      intent.preferredTerms.length > 0
        ? findManyByTerms(intent.preferredTerms, 80)
        : Promise.resolve([]),
      findManyByTerms(this.searchTermsForRole(role), 120),
    ]);
    const items = uniqueById([...preferredItems, ...genericItems]);

    const mapped = items
      .filter(
        (item: any) =>
          source === 'advcake_ticketland' ||
          (typeof item.lat === 'number' && typeof item.lng === 'number'),
      )
      .map((item: any) => {
        const contentKind: CandidateCard['contentKind'] =
          item.contentKind === 'place' ? 'place' : 'event';
        const freeKudagoWalkPlace = source === 'kudago' && role === 'walk' && contentKind === 'place';
        return {
          id: item.id,
          role,
          source,
          contentKind,
          title: item.title,
          area: item.area ?? null,
          tags: normalizeTags(item.tags),
          category: item.category ?? null,
          placeKind: item.placeKind ?? null,
          priceMode: freeKudagoWalkPlace ? 'free' : item.priceMode ?? 'unknown',
          priceFrom: freeKudagoWalkPlace
            ? 0
            : typeof item.priceFrom === 'number'
              ? item.priceFrom
              : null,
          startsAt: item.startsAt instanceof Date ? item.startsAt.toISOString() : null,
          lat: typeof item.lat === 'number' ? roundCoord(item.lat) : null,
          lng: typeof item.lng === 'number' ? roundCoord(item.lng) : null,
          address: item.address ?? null,
          venueName: item.venueName ?? null,
          actionUrl: item.actionUrl ?? null,
          sourceUrl: item.sourceUrl ?? null,
          sourceProvider: item.sourceProvider ?? item.source?.name ?? null,
          shortSummary: item.shortSummary ?? null,
        };
      });
    return mapped.filter((candidate) => this.isCandidateAllowedForIntent(candidate, intent));
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
    const routeFields = { ...route };
    delete routeFields._aiIntent;
    return {
      ...routeFields,
      steps: (route.steps ?? []).map((step: any) => {
        const { externalContentItemId: _externalContentItemId, ...publicStep } = step;
        return publicStep;
      }),
    };
  }

  private routeWithIntent(route: any, intent: RouteSnapshotIntent) {
    return {
      ...route,
      _aiIntent: {
        roles: intent.roles,
        roleHints: intent.roleHints,
        source: intent.source,
      },
    };
  }

  private intentFromRoute(route: any, input: ParsedDraftInput): DraftIntent | null {
    const stored = route?._aiIntent;
    if (!stored || typeof stored !== 'object') {
      return null;
    }
    const roles: RouteRole[] = Array.isArray(stored.roles)
      ? stored.roles
          .map((role: unknown) => this.routeRoleOrNull(role))
          .filter((role: RouteRole | null): role is RouteRole => role != null)
      : [];
    if (roles.length !== input.stepCount) {
      return null;
    }
    const rawHints = Array.isArray(stored.roleHints) ? stored.roleHints : [];
    return {
      roles,
      roleHints: roles.map((role, index) =>
        this.normalizeLlmIntentHint(input, role, {
          preferredTerms: rawHints[index]?.preferredTerms,
          avoidTerms: rawHints[index]?.avoidTerms,
          instruction: rawHints[index]?.instruction,
        }),
      ),
      source: stored.source === 'llm' ? 'llm' : 'rules',
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
      stepCountExplicit: true,
      latitude: null,
      longitude: null,
    };
  }

  private parseInput(body: Record<string, unknown>): ParsedDraftInput {
    const prompt = stringOrNull(body.prompt);
    const stepCountExplicit = body.stepCount != null && body.stepCount !== '';
    return {
      city: stringOrNull(body.city) ?? DEFAULT_CITY,
      prompt,
      goal: stringOrNull(body.goal),
      mood: stringOrNull(body.mood),
      budget: stringOrNull(body.budget) ?? budgetFromPrompt(prompt),
      format: this.parseFormat(body.format),
      area: stringOrNull(body.area),
      stepCount: this.parseStepCount(body.stepCount),
      stepCountExplicit,
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
          : DEFAULT_STEP_COUNT;
    if (!Number.isFinite(parsed)) {
      return DEFAULT_STEP_COUNT;
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

  private async resolveDraftIntent(input: ParsedDraftInput): Promise<DraftIntent> {
    const fallbackRoles = this.resolveRoles(input.prompt, input.format, input.stepCount);
    const fallbackIntent: DraftIntent = {
      roles: fallbackRoles,
      roleHints: fallbackRoles.map((role) => this.roleIntentHint(input, role)),
      source: 'rules',
    };
    if (!input.prompt) {
      return fallbackIntent;
    }

    try {
      const response = await this.openRouterService.generateJson<GeneratedIntentJson>({
        model: QWEN_FREE_MODEL,
        timeoutMs: 1800,
        systemPrompt: this.intentSystemPrompt(),
        userPrompt: this.intentUserPrompt(input, fallbackRoles),
        temperature: 0,
        maxTokens: 600,
        responseFormat: this.intentResponseFormat(),
      });
      const parsedIntent = this.parseIntentResponse(input, response.parsedJson, fallbackRoles);
      if (parsedIntent.roles.length >= MIN_STEP_COUNT && parsedIntent.roles.length <= input.stepCount) {
        return {
          ...parsedIntent,
          source: 'llm',
        };
      }
    } catch {
      return fallbackIntent;
    }

    return fallbackIntent;
  }

  private parseIntentResponse(
    input: ParsedDraftInput,
    generated: GeneratedIntentJson,
    fallbackRoles: RouteRole[],
  ): Omit<DraftIntent, 'source'> {
    const roles: RouteRole[] = [];
    const roleHints: RoleIntentHint[] = [];
    const steps = Array.isArray(generated?.steps) ? generated.steps : [];

    for (const step of steps) {
      const role = this.routeRoleOrNull(step?.role);
      if (!role || roles.length >= input.stepCount) {
        continue;
      }
      roles.push(role);
      roleHints.push(
        this.normalizeLlmIntentHint(input, role, {
          preferredTerms: step?.preferredTerms,
          avoidTerms: step?.avoidTerms,
          instruction: step?.instruction,
        }),
      );
    }

    if (!input.stepCountExplicit && roles.length >= MIN_STEP_COUNT) {
      return {
        roles,
        roleHints,
      };
    }

    for (const fallbackRole of fallbackRoles) {
      if (roles.length >= input.stepCount) {
        break;
      }
      roles.push(fallbackRole);
      roleHints.push(this.roleIntentHint(input, fallbackRole));
    }

    return {
      roles: roles.slice(0, input.stepCount),
      roleHints: roleHints.slice(0, input.stepCount),
    };
  }

  private normalizeLlmIntentHint(
    input: ParsedDraftInput,
    role: RouteRole,
    rawHint: {
      preferredTerms?: unknown;
      avoidTerms?: unknown;
      instruction?: unknown;
    },
  ): RoleIntentHint {
    const fallback = this.roleIntentHint(input, role);
    return {
      role,
      preferredTerms: uniqueStrings([
        ...stringArray(rawHint.preferredTerms, 10),
        ...fallback.preferredTerms,
      ]),
      avoidTerms: uniqueStrings([...stringArray(rawHint.avoidTerms, 10), ...fallback.avoidTerms]),
      instruction: stringOrNull(rawHint.instruction) ?? fallback.instruction,
    };
  }

  private routeRoleOrNull(value: unknown): RouteRole | null {
    if (typeof value !== 'string') {
      return null;
    }
    return ROUTE_ROLE_SET.has(value) ? (value as RouteRole) : null;
  }

  private resolveRoles(prompt: string | null, format: string | null, stepCount: number): RouteRole[] {
    const normalized = normalizeText([prompt, format].filter(Boolean).join(' '));
    const roles: RouteRole[] = [];
    const add = (role: RouteRole) => {
      if (roles.length < stepCount && !roles.includes(role)) {
        roles.push(role);
      }
    };

    const orderedMentions = [
      {
        role: 'place_club' as const,
        index: firstTermIndex(normalized, ['клуб', 'танц', 'караоке']),
      },
      {
        role: 'place_bar' as const,
        index: firstTermIndex(normalized, ['бар', 'вино', 'коктейл', 'wine', 'bar']),
      },
      {
        role: 'place_food' as const,
        index: firstTermIndex(normalized, [
          'поесть',
          'еда',
          'ужин',
          'ресторан',
          'кафе',
          'кофе',
          'бранч',
          'завтрак',
          'десерт',
          'паст',
          'суши',
          'ролл',
          'бургер',
          'стейк',
          'пицц',
          'итальян',
          'грузин',
          'хинкали',
          'азиат',
          'рамен',
        ]),
      },
      {
        role: 'show' as const,
        index: firstTermIndex(normalized, [
          'театр',
          'спектак',
          'опера',
          'балет',
          'мюзикл',
          'шоу',
          'стендап',
          'концерт',
          'джаз',
        ]),
      },
      {
        role: hasAny(normalized, ['прогул', 'погуля', 'маршрут', 'парк', 'набереж', 'бульвар'])
          ? 'walk' as const
          : 'free_activity' as const,
        index: firstTermIndex(normalized, [
          'погуля',
          'прогул',
          'маршрут',
          'парк',
          'набереж',
          'бульвар',
          'бесплат',
          'праздн',
          'активност',
        ]),
      },
    ]
      .filter((item) => item.index >= 0)
      .sort((left, right) => left.index - right.index);

    for (const mention of orderedMentions) {
      add(mention.role);
    }

    if (roles.length === 0) {
      if (format === 'bar') {
        add('place_bar');
      } else if (format === 'show') {
        add('show');
      } else if (format === 'active') {
        add('free_activity');
      }
    }

    const fallbackCycle: RouteRole[] = ['place_food', 'show', 'walk', 'place_bar', 'free_activity'];
    let fallbackIndex = 0;
    while (roles.length < stepCount) {
      const nextRole =
        !roles.some((role) => role.startsWith('place_'))
          ? 'place_food'
          : !roles.includes('show')
            ? 'show'
            : !roles.includes('walk')
              ? 'walk'
              : fallbackCycle[fallbackIndex % fallbackCycle.length] ?? 'place_food';
      roles.push(nextRole);
      fallbackIndex += 1;
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
        return ['стендап', 'спектакль', 'театр', 'концерт', 'джаз', 'шоу', 'опера', 'балет'];
      case 'walk':
        return ['прогулка', 'погулять', 'парк', 'маршрут', 'набережная', 'бульвар', 'экскурсия'];
      case 'free_activity':
        return ['бесплатно', 'фестиваль', 'праздник', 'лекция', 'активность', 'выставка'];
      case 'place_food':
      default:
        return ['ресторан', 'кафе', 'кофе', 'бранч', 'ужин', 'еда', 'coffee', 'десерт', 'паст', 'итальян'];
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

  private candidateScore(
    input: ParsedDraftInput,
    candidate: CandidateCard,
    roleHints: RoleIntentHint[] = [],
  ) {
    let score = 0;
    const intent = this.roleIntentHint(input, candidate.role, roleHints);
    const text = candidateSearchText(candidate);
    for (const term of this.searchTermsForRole(candidate.role)) {
      if (hasAny(text, [term])) {
        score -= 20;
      }
    }
    if (intent.preferredTerms.length > 0) {
      score += candidateMatchesTerms(candidate, intent.preferredTerms) ? -90 : 20;
    }
    if (intent.avoidTerms.length > 0 && candidateMatchesTerms(candidate, intent.avoidTerms)) {
      score += 150;
    }
    if (input.budget === 'free' && candidate.priceMode !== 'free') {
      score += 100;
    }
    if (input.budget === 'low') {
      const text = candidateSearchText(candidate);
      if (hasAny(text, ['budget:cheap', 'недорог', 'дешев', 'бюджет'])) {
        score -= 50;
      }
      if (candidate.priceFrom != null && candidate.priceFrom <= 1500) {
        score -= 40;
      } else if (candidate.priceFrom != null && candidate.priceFrom > 2500) {
        score += 90;
      } else {
        score += 10;
      }
    }
    if (input.latitude != null && input.longitude != null && hasCandidateCoords(candidate)) {
      score += geoDistanceKm(
        { lat: input.latitude, lng: input.longitude },
        candidate,
      ) * 10;
    }
    return score;
  }

  private routePointForCandidate(input: ParsedDraftInput, candidate: CandidateCard) {
    if (hasCandidateCoords(candidate)) {
      return { lat: candidate.lat, lng: candidate.lng };
    }
    return fallbackPointForInput(input);
  }

  private roleIntentHint(
    input: ParsedDraftInput,
    role: RouteRole,
    roleHints: RoleIntentHint[] = [],
  ): RoleIntentHint {
    const explicitHints = roleHints.filter((hint) => hint.role === role);
    if (explicitHints.length > 0) {
      return {
        role,
        preferredTerms: uniqueStrings(explicitHints.flatMap((hint) => hint.preferredTerms)),
        avoidTerms: uniqueStrings(explicitHints.flatMap((hint) => hint.avoidTerms)),
        instruction:
          explicitHints
            .map((hint) => hint.instruction)
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
            .join(' ') || null,
      };
    }

    const normalized = normalizeText([input.prompt, input.format].filter(Boolean).join(' '));
    const hint = (preferredTerms: string[], avoidTerms: string[], instruction: string): RoleIntentHint => ({
      role,
      preferredTerms: uniqueStrings(preferredTerms),
      avoidTerms: uniqueStrings(avoidTerms),
      instruction,
    });

    if (role === 'walk' && hasAny(normalized, ['погуля', 'прогул', 'маршрут', 'парк', 'набереж', 'бульвар'])) {
      return hint(
        ['прогул', 'маршрут', 'парк', 'сквер', 'бульвар', 'набереж', 'пеш', 'экскурс'],
        ['музей', 'выстав', 'экспозици', 'галере', 'театр', 'спектак', 'концерт', 'стендап'],
        'Нужна именно прогулка, парк, набережная или пеший маршрут, не музей и не выставка.',
      );
    }

    if (role === 'place_food') {
      if (hasAny(normalized, ['паст', 'итальян', 'italian'])) {
        return hint(
          ['паста', 'итальян', 'italian', 'траттор', 'trattoria', 'остери', 'osteria', 'равиол', 'пицц'],
          [],
          'Нужен итальянский ресторан или место, где явно есть паста.',
        );
      }
      if (hasAny(normalized, ['суши', 'ролл', 'рамен', 'япон'])) {
        return hint(
          ['суши', 'ролл', 'рамен', 'япон', 'izakaya', 'азиат'],
          [],
          'Нужно место под суши, роллы, рамен или японскую кухню.',
        );
      }
      if (hasAny(normalized, ['бургер'])) {
        return hint(['бургер', 'burger'], [], 'Нужно место с бургерами.');
      }
      if (hasAny(normalized, ['стейк', 'мясо', 'гриль', 'grill'])) {
        return hint(['стейк', 'мясо', 'гриль', 'grill'], [], 'Нужно мясное место, стейк или гриль.');
      }
      if (hasAny(normalized, ['грузин', 'хинкали', 'хачапури'])) {
        return hint(
          ['грузин', 'хинкали', 'хачапури'],
          [],
          'Нужно место с грузинской кухней.',
        );
      }
      if (hasAny(normalized, ['кофе', 'coffee'])) {
        return hint(['кофе', 'кофей', 'coffee', 'кафе'], [], 'Нужно место для кофе.');
      }
    }

    if (role === 'show') {
      if (hasAny(normalized, ['театр', 'спектак', 'опера', 'балет', 'мюзикл'])) {
        return hint(
          ['театр', 'театраль', 'спектак', 'опера', 'балет', 'мюзикл', 'постанов'],
          ['музей', 'выстав', 'экспозици', 'галере'],
          'Нужен театр, спектакль, опера, балет или мюзикл, не музей и не выставка.',
        );
      }
      if (hasAny(normalized, ['стендап', 'standup', 'stand up', 'комед'])) {
        return hint(['стендап', 'standup', 'stand up', 'комед'], [], 'Нужен стендап или комедийное шоу.');
      }
      if (hasAny(normalized, ['концерт', 'джаз', 'музык'])) {
        return hint(['концерт', 'джаз', 'музык'], [], 'Нужен концерт, джаз или музыкальное событие.');
      }
    }

    if (role === 'place_bar' && hasAny(normalized, ['вино', 'винн'])) {
      return hint(['вино', 'винн', 'wine'], [], 'Нужен винный бар.');
    }

    return {
      role,
      preferredTerms: [],
      avoidTerms: [],
      instruction: null,
    };
  }

  private isCandidateAllowedForIntent(candidate: CandidateCard, intent: RoleIntentHint) {
    if (candidate.role === 'walk' && !this.isWalkCandidate(candidate)) {
      return false;
    }
    if (intent.avoidTerms.length === 0) {
      return true;
    }
    if (!candidateMatchesTerms(candidate, intent.avoidTerms)) {
      return true;
    }
    return candidateMatchesTerms(candidate, intent.preferredTerms);
  }

  private isWalkCandidate(candidate: CandidateCard) {
    const text = candidateSearchText(candidate);
    if (hasAny(text, WALK_BLOCKED_TERMS)) {
      return false;
    }
    const categoryText = normalizeText(
      [candidate.category, candidate.tags.join(' ')]
        .filter(Boolean)
        .join(' '),
    );
    if (hasAny(categoryText, WALK_BLOCKED_CATEGORY_TERMS)) {
      return false;
    }
    return hasAny(categoryText, WALK_ALLOWED_CATEGORY_TERMS) ||
      hasAny(text, WALK_STRONG_TERMS);
  }

  private candidateTailScore(candidate: CandidateCard, seed: number) {
    return stableHash(`${seed}:${candidate.id}`);
  }

  private intentSystemPrompt() {
    return [
      'Return strict JSON only.',
      'Extract the ordered route intent from the user text.',
      'Keep the same step order as the user asked.',
      'Infer step count from the user text unless config.stepCountMode is exact.',
      'Use only allowed roles.',
      'Write short Russian search terms in preferredTerms and avoidTerms.',
      'Do not choose real places here.',
    ].join('\n');
  }

  private intentUserPrompt(input: ParsedDraftInput, fallbackRoles: RouteRole[]) {
    return JSON.stringify({
      prompt: input.prompt,
      config: {
        city: input.city,
        area: input.area,
        budget: input.budget,
        goal: input.goal,
        mood: input.mood,
        format: input.format,
        stepCountMode: input.stepCountExplicit ? 'exact' : 'infer',
        defaultStepCount: DEFAULT_STEP_COUNT,
        maxStepCount: input.stepCount,
        fallbackRoles,
      },
      allowedRoles: [
        {
          role: 'place_food',
          source: 'tomesto',
          meaning: 'кафе, рестораны, кухня, паста, суши, кофе, завтрак, ужин',
        },
        {
          role: 'place_bar',
          source: 'tomesto',
          meaning: 'бар, винный бар, коктейли',
        },
        {
          role: 'place_club',
          source: 'tomesto',
          meaning: 'клуб, танцы, караоке',
        },
        {
          role: 'show',
          source: 'advcake_ticketland',
          meaning: 'театр, спектакль, стендап, концерт, джаз, шоу, опера, балет',
        },
        {
          role: 'walk',
          source: 'kudago',
          meaning: 'пешая прогулка, парк, маршрут, набережная, бульвар',
        },
        {
          role: 'free_activity',
          source: 'kudago',
          meaning: 'бесплатная активность, фестиваль, праздник, выставка, лекция',
        },
      ],
      rules: [
        'If stepCountMode is exact, return exactly maxStepCount steps.',
        'If stepCountMode is infer, return the number of steps requested by the user, from 2 to maxStepCount.',
        'If stepCountMode is infer and the user does not imply a count, return defaultStepCount steps.',
        'If the user asks the same kind of step twice, keep it twice.',
        'preferredTerms must describe what the candidate should match.',
        'avoidTerms must describe wrong candidates for this step.',
        'For theatre requests prefer театр, спектакль, опера, балет, мюзикл and avoid музей, выставка.',
        'For walking requests prefer прогулка, парк, маршрут, набережная and avoid музей, выставка.',
      ],
    });
  }

  private intentResponseFormat() {
    return {
      type: 'json_schema',
      json_schema: {
        name: 'evening_ai_route_intent',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            steps: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  role: { type: 'string', enum: ROUTE_ROLES },
                  preferredTerms: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  avoidTerms: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  instruction: { type: 'string' },
                },
                required: ['role', 'preferredTerms', 'avoidTerms', 'instruction'],
              },
            },
          },
          required: ['steps'],
        },
      },
    };
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
    roleHints?: RoleIntentHint[];
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
        roleHints:
          input.roleHints && input.roleHints.length > 0
            ? input.roleHints
            : input.roles.map((role) => this.roleIntentHint(input.input, role)),
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
        category: candidate.category,
        placeKind: candidate.placeKind,
        priceMode: candidate.priceMode,
        priceFrom: candidate.priceFrom,
        startsAt: candidate.startsAt,
        venueName: candidate.venueName,
        address: candidate.address,
        geo: hasCandidateCoords(candidate) ? `${candidate.lat},${candidate.lng}` : null,
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
    roleHints: RoleIntentHint[] = [],
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
      const intent =
        roleHints[index]?.role === role
          ? roleHints[index]
          : this.roleIntentHint(input, role, roleHints);
      const roleCandidates = candidates.filter((item) => item.role === role);
      if (
        intent.preferredTerms.length > 0 &&
        roleCandidates.some((item) => candidateMatchesTerms(item, intent.preferredTerms)) &&
        !candidateMatchesTerms(candidate, intent.preferredTerms)
      ) {
        issues.push({
          code: 'intent_mismatch',
          message: 'Step does not match requested role details',
          stepIndex: index,
          externalContentItemId,
        });
      }
      if (
        intent.avoidTerms.length > 0 &&
        candidateMatchesTerms(candidate, intent.avoidTerms) &&
        roleCandidates.some((item) => !candidateMatchesTerms(item, intent.avoidTerms))
      ) {
        issues.push({
          code: 'intent_mismatch',
          message: 'Step uses a candidate that conflicts with requested role details',
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
      if (!hasCandidateCoords(previous) || !hasCandidateCoords(current)) {
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
  stepCountExplicit: boolean;
  latitude: number | null;
  longitude: number | null;
};

const AREA_FALLBACK_POINTS: Record<string, { lat: number; lng: number }> = {
  center: { lat: 55.7558, lng: 37.6173 },
  patriki: { lat: 55.7638, lng: 37.5932 },
  chistye: { lat: 55.7657, lng: 37.6388 },
  gorky: { lat: 55.7298, lng: 37.6011 },
  kursk: { lat: 55.7585, lng: 37.6591 },
};

const CITY_FALLBACK_POINTS: Record<string, { lat: number; lng: number }> = {
  Москва: { lat: 55.7558, lng: 37.6173 },
  'Санкт-Петербург': { lat: 59.9311, lng: 30.3609 },
  Новосибирск: { lat: 55.0084, lng: 82.9357 },
  Екатеринбург: { lat: 56.8389, lng: 60.6057 },
  Казань: { lat: 55.7961, lng: 49.1064 },
  'Нижний Новгород': { lat: 56.2965, lng: 43.9361 },
  Красноярск: { lat: 56.0153, lng: 92.8932 },
  Челябинск: { lat: 55.1644, lng: 61.4368 },
  Самара: { lat: 53.1959, lng: 50.1008 },
  Уфа: { lat: 54.7351, lng: 55.9587 },
  'Ростов-на-Дону': { lat: 47.2225, lng: 39.7187 },
  Краснодар: { lat: 45.0355, lng: 38.9753 },
  Омск: { lat: 54.9893, lng: 73.3682 },
  Воронеж: { lat: 51.6608, lng: 39.2003 },
  Пермь: { lat: 58.0105, lng: 56.2502 },
  Волгоград: { lat: 48.708, lng: 44.5133 },
};

function hasCandidateCoords(
  candidate: CandidateCard,
): candidate is CandidateCard & { lat: number; lng: number } {
  return typeof candidate.lat === 'number' && typeof candidate.lng === 'number';
}

function fallbackPointForInput(input: ParsedDraftInput): { lat: number; lng: number } {
  if (input.latitude != null && input.longitude != null) {
    return { lat: roundCoord(input.latitude), lng: roundCoord(input.longitude) };
  }
  const areaPoint = input.area ? AREA_FALLBACK_POINTS[input.area] : null;
  if (areaPoint) {
    return areaPoint;
  }
  return CITY_FALLBACK_POINTS[input.city] ?? { lat: 55.7558, lng: 37.6173 };
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function stringArray(value: unknown, limit: number) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => stringOrNull(item))
    .filter((item): item is string => item != null)
    .slice(0, limit);
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

function firstTermIndex(value: string, terms: string[]) {
  return terms.reduce((best, term) => {
    const index = value.indexOf(normalizeText(term));
    if (index < 0) {
      return best;
    }
    return best < 0 ? index : Math.min(best, index);
  }, -1);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map(normalizeText).filter(Boolean)));
}

function uniqueById<T extends { id?: unknown }>(items: T[]) {
  const seen = new Set<unknown>();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

function candidateSearchText(candidate: CandidateCard) {
  return normalizeText(
    [
      candidate.title,
      candidate.shortSummary,
      candidate.venueName,
      candidate.area,
      candidate.category,
      candidate.placeKind,
      candidate.tags.join(' '),
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function candidateMatchesTerms(candidate: CandidateCard, terms: string[]) {
  return terms.length > 0 && hasAny(candidateSearchText(candidate), terms);
}

function budgetFromPrompt(prompt: string | null) {
  const text = normalizeText(prompt ?? '');
  if (!text) {
    return null;
  }
  if (/(?:бесплат|free|без\s+денег)/.test(text)) {
    return 'free';
  }
  if (
    /(?:недорог|не\s+дорог|дешев|бюджет|эконом|до\s*1\s*500|до\s*1500|до\s*тысяч[аи]?)/.test(text)
  ) {
    return 'low';
  }
  if (/(?:премиум|дорого|без\s+лимит|люкс|premium)/.test(text)) {
    return 'premium';
  }
  return null;
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
