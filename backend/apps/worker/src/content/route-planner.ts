export type RoutePlannerCandidate = {
  id: string;
  sourceUrl?: string | null;
  contentKind: string;
  title: string;
  shortSummary?: string | null;
  category: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  priceFrom?: number | null;
  priceMode?: string | null;
  source?: {
    name?: string | null;
    code?: string | null;
  } | null;
};

export type RoutePlannerInput = {
  city: string;
  area?: string | null;
  mood: string;
  budget: string;
  timezone?: string | null;
  maxDrafts?: number;
};

export type PlannedRoute = {
  title: string;
  description: string;
  vibe: string;
  durationLabel: string;
  totalPriceFrom: number;
  goal: string;
  recommendedFor: string;
  badgeLabel: string;
  steps: PlannedRouteStep[];
};

export type PlannedRouteStep = {
  externalContentItemId: string;
  timeLabel: string;
  endTimeLabel: string | null;
  kind: string;
  title: string;
  venue: string;
  address: string;
  emoji: string;
  distanceLabel: string;
  walkMin: number;
  description: string;
  vibeTag: string;
  ticketPrice: number | null;
  lat: number;
  lng: number;
};

export type RouteValidationIssue = {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  stepIndex?: number;
  externalContentItemId?: string | null;
};

export type RouteValidationResult = {
  status: 'valid' | 'warning' | 'invalid';
  score: number;
  issues: RouteValidationIssue[];
};

type PlanningCandidate = RoutePlannerCandidate & {
  lat: number;
  lng: number;
  normalizedCategory: string;
};

type RouteDraftForValidation = {
  title?: unknown;
  description?: unknown;
  steps?: RouteDraftStepForValidation[];
};

type RouteDraftStepForValidation = {
  externalContentItemId?: unknown;
  timeLabel?: unknown;
  endTimeLabel?: unknown;
  kind?: unknown;
  lat?: unknown;
  lng?: unknown;
  walkMin?: unknown;
};

const DEFAULT_TIMEZONE = 'Europe/Moscow';
const MAX_WALK_BY_MOOD: Record<string, number> = {
  calm: 15,
  date: 15,
  culture: 18,
  social: 20,
  active: 25,
  outdoor: 35,
};
const MINUTES_PER_STEP = 45;
const ANCHOR_GAP_MINUTES = 10;
const VENUE_CLUSTER_METERS = 80;
const ROUTE_MOVEMENT_METERS = 120;
const EVENT_HOP_MAX_GAP_MINUTES = 150;
const BUDGET_LIMITS: Record<string, number | null> = {
  free: 0,
  low: 2500,
  mid: 6000,
  high: null,
  premium: null,
};

export function buildRouteSkeletons(
  input: RoutePlannerInput,
  rawCandidates: RoutePlannerCandidate[],
): PlannedRoute[] {
  const timezone = input.timezone ?? DEFAULT_TIMEZONE;
  const candidates = normalizeCandidates(rawCandidates)
    .filter((candidate) => candidateFitsBudget(candidate, input.budget));
  const routes: PlannedRoute[] = [];
  const anchors = selectAnchors(input.mood, candidates);

  if (input.mood === 'outdoor') {
    const flexibleRoute = buildFlexibleRoute(input, candidates);
    if (
      flexibleRoute &&
      validateRouteDraft(flexibleRoute, candidates, timezone, input.budget).status === 'valid'
    ) {
      routes.push(flexibleRoute);
    }
    if (routes.length >= (input.maxDrafts ?? 4)) {
      return routes;
    }
  }

  for (const anchor of anchors) {
    const route = buildAnchoredRoute(input, timezone, candidates, anchor);
    if (route && validateRouteDraft(route, candidates, timezone, input.budget).status === 'valid') {
      routes.push(route);
    }
    if (routes.length >= (input.maxDrafts ?? 4)) {
      return routes;
    }
  }

  if (input.mood !== 'outdoor') {
    const flexibleRoute = buildFlexibleRoute(input, candidates);
    if (
      flexibleRoute &&
      validateRouteDraft(flexibleRoute, candidates, timezone, input.budget).status === 'valid'
    ) {
      routes.push(flexibleRoute);
    }
  }

  if (routes.length === 0) {
    const eventHopRoute = buildEventHopRoute(input, timezone, candidates);
    if (
      eventHopRoute &&
      validateRouteDraft(eventHopRoute, candidates, timezone, input.budget).status !== 'invalid'
    ) {
      routes.push(eventHopRoute);
    }
  }

  return routes.slice(0, input.maxDrafts ?? 4);
}

export function validateRouteDraft(
  route: RouteDraftForValidation,
  rawCandidates: RoutePlannerCandidate[],
  timezone = DEFAULT_TIMEZONE,
  budget?: string | null,
): RouteValidationResult {
  const issues: RouteValidationIssue[] = [];
  const candidates = normalizeCandidates(rawCandidates);
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const steps = Array.isArray(route.steps) ? route.steps : [];

  if (steps.length < 2 || steps.length > 4) {
    issues.push({
      severity: 'error',
      code: 'steps_count_invalid',
      message: 'Route must have 2 to 4 steps',
    });
  }
  if (text(route.title, '').length > 90) {
    issues.push({
      severity: 'error',
      code: 'title_too_long',
      message: 'Title is too long',
    });
  }
  if (text(route.description, '').length > 500) {
    issues.push({
      severity: 'error',
      code: 'description_too_long',
      message: 'Description is too long',
    });
  }

  const seenIds = new Set<string>();
  const timedAnchors: Array<{ step: RouteDraftStepForValidation; candidate: PlanningCandidate; index: number }> = [];
  const resolvedSteps: Array<{ step: RouteDraftStepForValidation; candidate: PlanningCandidate; index: number }> = [];
  let totalPriceFrom = 0;

  steps.forEach((step, index) => {
    const id = nullableText(step.externalContentItemId);
    if (!id) {
      issues.push({
        severity: 'error',
        code: 'source_item_missing',
        message: 'Step must reference an imported item',
        stepIndex: index,
        externalContentItemId: null,
      });
      return;
    }
    if (seenIds.has(id)) {
      issues.push({
        severity: 'error',
        code: 'source_item_repeated',
        message: 'Source item is repeated',
        stepIndex: index,
        externalContentItemId: id,
      });
    }
    seenIds.add(id);

    const candidate = candidateById.get(id);
    if (!candidate) {
      issues.push({
        severity: 'error',
        code: 'source_item_unknown',
        message: 'Step references an unknown imported item',
        stepIndex: index,
        externalContentItemId: id,
      });
      return;
    }
    resolvedSteps.push({ step, candidate, index });
    totalPriceFrom += candidate.priceFrom ?? 0;

    if (number(step.lat) == null || number(step.lng) == null) {
      issues.push({
        severity: 'error',
        code: 'coordinates_missing',
        message: 'Step coordinates are missing',
        stepIndex: index,
        externalContentItemId: id,
      });
    }

    const walkMin = nullableInt(step.walkMin);
    if (walkMin != null && walkMin >= 30) {
      issues.push({
        severity: 'error',
        code: 'walk_too_long',
        message: 'Walk time is too long',
        stepIndex: index,
        externalContentItemId: id,
      });
    }

    if (candidate.contentKind === 'event' && candidate.startsAt) {
      timedAnchors.push({ step, candidate, index });
      const expectedStart = formatTime(candidate.startsAt, timezone);
      const expectedEnd = candidate.endsAt ? formatTime(candidate.endsAt, timezone) : null;
      if (!sameTimeLabel(step.timeLabel, expectedStart)) {
        issues.push({
          severity: 'error',
          code: 'event_time_mismatch',
          message: 'Event step must start at the imported event time',
          stepIndex: index,
          externalContentItemId: id,
        });
      }
      if (expectedEnd && !sameTimeLabel(step.endTimeLabel, expectedEnd)) {
        issues.push({
          severity: 'error',
          code: 'event_time_mismatch',
          message: 'Event step must end at the imported event end time',
          stepIndex: index,
          externalContentItemId: id,
        });
      }
    }
  });

  if (timedAnchors.length === 2) {
    issues.push({
      severity: 'warning',
      code: 'too_many_timed_events',
      message: 'Route uses two timed events and needs admin review',
    });
  } else if (timedAnchors.length > 2) {
    issues.push({
      severity: 'error',
      code: 'too_many_timed_events',
      message: 'Route should not use more than two timed events',
    });
  }

  for (let index = 0; index < resolvedSteps.length; index += 1) {
    const current = resolvedSteps[index];
    if (!current) {
      continue;
    }
    if (current.candidate.normalizedCategory === 'bar' && index < resolvedSteps.length - 1) {
      issues.push({
        severity: 'error',
        code: 'bar_step_not_final',
        message: 'Bar should be the final social stop, not a middle step before another activity',
        stepIndex: current.index,
        externalContentItemId: current.candidate.id,
      });
    }
    const previous = index > 0 ? resolvedSteps[index - 1] : null;
    if (
      previous &&
      isHospitalityCategory(previous.candidate.normalizedCategory) &&
      isHospitalityCategory(current.candidate.normalizedCategory)
    ) {
      issues.push({
        severity: 'error',
        code: 'hospitality_steps_adjacent',
        message: 'Restaurant, cafe and bar steps should not be adjacent in the same route',
        stepIndex: current.index,
        externalContentItemId: current.candidate.id,
      });
    }
  }

  const eventCategoryCounts = new Map<string, number>();
  for (const timedAnchor of timedAnchors) {
    const count = eventCategoryCounts.get(timedAnchor.candidate.normalizedCategory) ?? 0;
    if (count > 0) {
      issues.push({
        severity: 'error',
        code: 'event_category_repeated',
        message: 'Route repeats the same event category',
        stepIndex: timedAnchor.index,
        externalContentItemId: timedAnchor.candidate.id,
      });
    }
    eventCategoryCounts.set(timedAnchor.candidate.normalizedCategory, count + 1);
  }

  for (let index = 1; index < resolvedSteps.length; index += 1) {
    const previous = resolvedSteps[index - 1];
    const current = resolvedSteps[index];
    if (!previous || !current || previous.candidate.contentKind !== 'event' || current.candidate.contentKind !== 'event') {
      continue;
    }
    const previousEnd = eventEndDate(previous.candidate);
    const currentStart = current.candidate.startsAt;
    if (!previousEnd || !currentStart) {
      continue;
    }
    const requiredGapMs = Math.max(ANCHOR_GAP_MINUTES, walkMinutes(previous.candidate, current.candidate) + 5) * 60_000;
    if (currentStart.getTime() < previousEnd.getTime() + requiredGapMs) {
      issues.push({
        severity: 'error',
        code: 'event_time_overlap',
        message: 'Timed events overlap or do not leave enough travel time',
        stepIndex: current.index,
        externalContentItemId: current.candidate.id,
      });
    }
  }

  for (let index = 0; index < resolvedSteps.length; index += 1) {
    const left = resolvedSteps[index];
    if (!left) {
      continue;
    }
    for (let nextIndex = index + 1; nextIndex < resolvedSteps.length; nextIndex += 1) {
      const right = resolvedSteps[nextIndex];
      if (!right) {
        continue;
      }
      if (
        sameVenueCluster(left.candidate, right.candidate) &&
        (left.candidate.contentKind === 'event' ||
          right.candidate.contentKind === 'event' ||
          left.candidate.normalizedCategory === right.candidate.normalizedCategory)
      ) {
        issues.push({
          severity: 'error',
          code: 'venue_cluster_repeated',
          message: 'Route repeats the same venue cluster',
          stepIndex: right.index,
          externalContentItemId: right.candidate.id,
        });
      }
    }
  }

  if (resolvedSteps.length >= 3 && maxPairDistance(resolvedSteps.map((item) => item.candidate)) <= ROUTE_MOVEMENT_METERS) {
    issues.push({
      severity: 'error',
      code: 'route_has_no_movement',
      message: 'Route has no real movement between places',
    });
  }

  const budgetLimit = budget == null ? null : budgetLimitFor(budget);
  if (budgetLimit != null && totalPriceFrom > budgetLimit) {
    issues.push({
      severity: 'error',
      code: 'budget_exceeded',
      message: 'Route total price exceeds requested budget',
    });
  }

  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  return {
    status: errorCount > 0 ? 'invalid' : warningCount > 0 ? 'warning' : 'valid',
    score: Math.max(0, 100 - errorCount * 25 - warningCount * 10),
    issues,
  };
}

function buildAnchoredRoute(
  input: RoutePlannerInput,
  timezone: string,
  candidates: PlanningCandidate[],
  anchor: PlanningCandidate,
): PlannedRoute | null {
  if (!anchor.startsAt) {
    return null;
  }
  const maxWalk = MAX_WALK_BY_MOOD[input.mood] ?? 18;
  let before = findFlexiblePlace(candidates, anchor, beforeCategories(input.mood), [], maxWalk);
  const after = findFlexiblePlace(
    candidates,
    anchor,
    afterCategories(input.mood),
    [anchor.id, before?.id ?? ''],
    maxWalk,
  );
  const secondAfterOptions = after
    ? secondAfterCategories(input.mood, after.normalizedCategory)
    : [];
  const secondAfter = after && secondAfterOptions.length > 0
    ? findFlexiblePlace(
      candidates,
      after,
      secondAfterOptions,
      [anchor.id, before?.id ?? '', after.id],
      maxWalk,
    )
    : null;
  if (prefersPostEventFlow(input.mood) && after?.normalizedCategory === 'walk' && secondAfter) {
    before = null;
  }
  if (!before && !after) {
    return null;
  }

  const anchorStart = localMinutes(anchor.startsAt, timezone);
  const anchorEnd = anchor.endsAt
    ? localMinutes(anchor.endsAt, timezone)
    : anchorStart + defaultDuration(anchor);
  const steps: PlannedRouteStep[] = [];

  if (before) {
    const walkMin = walkMinutes(before, anchor);
    const beforeEnd = anchorStart - Math.max(ANCHOR_GAP_MINUTES, walkMin + 5);
    const beforeStart = beforeEnd - MINUTES_PER_STEP;
    steps.push(buildStep({
      candidate: before,
      input,
      startMin: beforeStart,
      endMin: beforeEnd,
      walkMin: 0,
      distanceLabel: 'старт маршрута',
      description: `Начните с "${before.title}": спокойно собраться, поесть и настроиться на вечер.`,
    }));
  }

  steps.push(buildStep({
    candidate: anchor,
    input,
    startMin: anchorStart,
    endMin: anchorEnd,
    walkMin: before ? walkMinutes(before, anchor) : 0,
    distanceLabel: before ? `${walkMinutes(before, anchor)} минут пешком` : 'главное событие маршрута',
    description: `Главный якорь вечера: "${anchor.title}". Время взято из импортированного события.`,
  }));

  if (after) {
    const walkMin = walkMinutes(anchor, after);
    const afterStart = anchorEnd + Math.max(ANCHOR_GAP_MINUTES, walkMin + 5);
    const afterEnd = afterStart + defaultDuration(after);
    steps.push(buildStep({
      candidate: after,
      input,
      startMin: afterStart,
      endMin: afterEnd,
      walkMin,
      distanceLabel: `${walkMin} минут пешком`,
      description: `После события зайдите в "${after.title}", чтобы спокойно обсудить впечатления.`,
    }));

    if (secondAfter) {
      const secondWalkMin = walkMinutes(after, secondAfter);
      const secondAfterStart = afterEnd + Math.max(ANCHOR_GAP_MINUTES, secondWalkMin + 5);
      const secondAfterEnd = secondAfterStart + defaultDuration(secondAfter);
      steps.push(buildStep({
        candidate: secondAfter,
        input,
        startMin: secondAfterStart,
        endMin: secondAfterEnd,
        walkMin: secondWalkMin,
        distanceLabel: `${secondWalkMin} минут пешком`,
        description: `Финал в "${secondAfter.title}": точка, где можно остаться и продолжить разговор.`,
      }));
    }
  }

  if (steps.length < 2) {
    return null;
  }

  return buildRouteSummary(input, steps, anchor);
}

function buildFlexibleRoute(
  input: RoutePlannerInput,
  candidates: PlanningCandidate[],
): PlannedRoute | null {
  const preferred = flexibleCategories(input.mood);
  const selected = selectFlexiblePlaceCluster(input.mood, preferred, candidates);
  if (selected.length < 2) {
    return null;
  }

  let startMin = 19 * 60;
  const steps = selected.slice(0, 3).map((candidate, index) => {
    const previous = index > 0 ? selected[index - 1] : null;
    const walkMin = previous ? walkMinutes(previous, candidate) : 0;
    if (previous) {
      startMin += Math.max(ANCHOR_GAP_MINUTES, walkMin + 5);
    }
    const endMin = startMin + defaultDuration(candidate);
    const step = buildStep({
      candidate,
      input,
      startMin,
      endMin,
      walkMin,
      distanceLabel: index === 0 ? 'старт маршрута' : `${walkMin} минут пешком`,
      description: flexibleStepDescription(index, candidate, input.mood),
    });
    startMin = endMin;
    return step;
  });

  return buildRouteSummary(input, steps, selected[0] ?? null);
}

function selectFlexiblePlaceCluster(
  mood: string,
  preferred: string[],
  candidates: PlanningCandidate[],
) {
  const places = candidates.filter((candidate) => candidate.contentKind === 'place');
  const maxWalk = Math.min(MAX_WALK_BY_MOOD[mood] ?? 18, 28);
  const seeds = [...places].sort((left, right) => {
    const leftPriority = categoryPriority(left.normalizedCategory, preferred);
    const rightPriority = categoryPriority(right.normalizedCategory, preferred);
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    return left.title.localeCompare(right.title, 'ru');
  });

  let best: { selected: PlanningCandidate[]; score: number } | null = null;
  for (const seed of seeds) {
    const selected = growFlexiblePlaceCluster(seed, places, preferred, maxWalk);
    if (selected.length < 2) {
      continue;
    }
    const score = flexibleClusterScore(selected, preferred);
    if (!best || score < best.score) {
      best = { selected, score };
    }
  }
  return best?.selected ?? [];
}

function growFlexiblePlaceCluster(
  seed: PlanningCandidate,
  places: PlanningCandidate[],
  preferred: string[],
  maxWalk: number,
) {
  const selected = [seed];
  while (selected.length < 3) {
    const next = findNextFlexiblePlace(places, selected, preferred, maxWalk);
    if (!next) {
      break;
    }
    selected.push(next);
  }
  return selected;
}

function findNextFlexiblePlace(
  places: PlanningCandidate[],
  selected: PlanningCandidate[],
  preferred: string[],
  maxWalk: number,
) {
  const previous = selected[selected.length - 1];
  if (!previous) {
    return null;
  }
  const selectedCategories = new Set(selected.map((candidate) => candidate.normalizedCategory));
  return places
    .filter((candidate) =>
      !selectedCategories.has(candidate.normalizedCategory) &&
      !selected.some((selectedItem) => selectedItem.id === candidate.id || sameVenueCluster(selectedItem, candidate)) &&
      walkMinutes(previous, candidate) <= maxWalk,
    )
    .sort((left, right) => {
      const leftScore = nextFlexiblePlaceScore(left, previous, preferred);
      const rightScore = nextFlexiblePlaceScore(right, previous, preferred);
      return leftScore - rightScore;
    })[0] ?? null;
}

function nextFlexiblePlaceScore(
  candidate: PlanningCandidate,
  previous: PlanningCandidate,
  preferred: string[],
) {
  return categoryPriority(candidate.normalizedCategory, preferred) * 500
    + distanceMeters(candidate, previous);
}

function flexibleClusterScore(selected: PlanningCandidate[], preferred: string[]) {
  const lengthPenalty = selected.length < 3 ? 5000 : 0;
  const categoryScore = selected.reduce(
    (sum, candidate, index) =>
      sum + categoryPriority(candidate.normalizedCategory, preferred) * (selected.length - index),
    0,
  );
  const walkScore = selected.reduce((sum, candidate, index) => {
    const previous = index > 0 ? selected[index - 1] : null;
    return previous ? sum + walkMinutes(previous, candidate) : sum;
  }, 0);
  const movementPenalty = maxPairDistance(selected) <= ROUTE_MOVEMENT_METERS ? 10000 : 0;
  return lengthPenalty + categoryScore * 100 + walkScore + movementPenalty;
}

function buildEventHopRoute(
  input: RoutePlannerInput,
  timezone: string,
  candidates: PlanningCandidate[],
): PlannedRoute | null {
  const maxWalk = MAX_WALK_BY_MOOD[input.mood] ?? 18;
  const anchors = selectAnchors(input.mood, candidates);
  for (const first of anchors) {
    const firstEnd = eventEndDate(first);
    if (!first.startsAt || !firstEnd) {
      continue;
    }
    const second = anchors.find((candidate) => {
      if (
        candidate.id === first.id ||
        candidate.normalizedCategory === first.normalizedCategory ||
        sameVenueCluster(first, candidate) ||
        !candidate.startsAt
      ) {
        return false;
      }
      const walkMin = walkMinutes(first, candidate);
      const gapMinutes = (candidate.startsAt.getTime() - firstEnd.getTime()) / 60_000;
      return (
        walkMin <= maxWalk &&
        gapMinutes >= Math.max(ANCHOR_GAP_MINUTES, walkMin + 5) &&
        gapMinutes <= EVENT_HOP_MAX_GAP_MINUTES
      );
    });
    if (!second || !second.startsAt) {
      continue;
    }
    const secondEnd = eventEndDate(second);
    const walkMin = walkMinutes(first, second);
    const secondEndForStep = secondEnd ?? new Date(second.startsAt.getTime() + defaultDuration(second) * 60_000);
    const steps = [
      buildStep({
        candidate: first,
        input,
        startMin: localMinutes(first.startsAt, timezone),
        endMin: localMinutes(firstEnd, timezone),
        walkMin: 0,
        distanceLabel: 'старт маршрута',
        description: `Начните с "${first.title}". Это первый временной слот вечера, время взято из импорта.`,
      }),
      buildStep({
        candidate: second,
        input,
        startMin: localMinutes(second.startsAt, timezone),
        endMin: localMinutes(secondEndForStep, timezone),
        walkMin,
        distanceLabel: `${walkMin} минут пешком`,
        description: `Дальше "${second.title}". События не пересекаются, переход заложен в расписание.`,
      }),
    ];
    return buildRouteSummary(input, steps, first);
  }
  return null;
}

function buildRouteSummary(
  input: RoutePlannerInput,
  steps: PlannedRouteStep[],
  anchor: PlanningCandidate | null,
): PlannedRoute {
  const first = steps[0];
  const last = steps[steps.length - 1];
  const totalPriceFrom = steps.reduce((sum, step) => sum + (step.ticketPrice ?? 0), 0);
  return {
    title: routeTitle(input, anchor),
    description: `${routeTitle(input, anchor)}: ${steps.map((step) => step.venue).join(' -> ')}. Черновик собран по времени, длительности и переходам.`,
    vibe: fallbackVibe(input.mood),
    durationLabel: first && last ? durationLabel(first.timeLabel, last.endTimeLabel ?? last.timeLabel) : '2 часа',
    totalPriceFrom,
    goal: 'social',
    recommendedFor: 'friends',
    badgeLabel: 'planner',
    steps,
  };
}

function buildStep(input: {
  candidate: PlanningCandidate;
  input: RoutePlannerInput;
  startMin: number;
  endMin: number;
  walkMin: number;
  distanceLabel: string;
  description: string;
}): PlannedRouteStep {
  const { candidate } = input;
  return {
    externalContentItemId: candidate.id,
    timeLabel: formatMinutes(input.startMin),
    endTimeLabel: formatMinutes(input.endMin),
    kind: candidate.normalizedCategory,
    title: candidate.title,
    venue: candidate.title,
    address: text(candidate.address, 'Адрес уточняется'),
    emoji: emojiForKind(candidate.normalizedCategory),
    distanceLabel: input.distanceLabel,
    walkMin: input.walkMin,
    description: input.description,
    vibeTag: input.input.mood,
    ticketPrice: nullableInt(candidate.priceFrom),
    lat: candidate.lat,
    lng: candidate.lng,
  };
}

function selectAnchors(mood: string, candidates: PlanningCandidate[]) {
  const anchors = candidates.filter((candidate) =>
    candidate.contentKind === 'event' &&
    candidate.startsAt instanceof Date &&
    !Number.isNaN(candidate.startsAt.getTime()),
  );
  const preferred = anchorCategories(mood);
  return anchors.sort((left, right) => {
    const leftPriority = preferred.indexOf(left.normalizedCategory);
    const rightPriority = preferred.indexOf(right.normalizedCategory);
    const normalizedLeftPriority = leftPriority === -1 ? 99 : leftPriority;
    const normalizedRightPriority = rightPriority === -1 ? 99 : rightPriority;
    if (normalizedLeftPriority !== normalizedRightPriority) {
      return normalizedLeftPriority - normalizedRightPriority;
    }
    return (left.startsAt?.getTime() ?? 0) - (right.startsAt?.getTime() ?? 0);
  });
}

function findFlexiblePlace(
  candidates: PlanningCandidate[],
  anchor: PlanningCandidate,
  categories: string[],
  excludedIds: string[],
  maxWalk: number,
) {
  const excluded = new Set(excludedIds.filter(Boolean));
  return candidates
    .filter((candidate) =>
      candidate.contentKind === 'place' &&
      !excluded.has(candidate.id) &&
      candidateFitsBudget(candidate, null) &&
      !sameVenueCluster(candidate, anchor) &&
      walkMinutes(candidate, anchor) <= maxWalk,
    )
    .sort((left, right) => {
      const leftPriority = categoryPriority(left.normalizedCategory, categories);
      const rightPriority = categoryPriority(right.normalizedCategory, categories);
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return distanceMeters(left, anchor) - distanceMeters(right, anchor);
    })[0] ?? null;
}

function normalizeCandidates(candidates: RoutePlannerCandidate[]): PlanningCandidate[] {
  return candidates.flatMap((candidate) => {
    const lat = number(candidate.lat);
    const lng = number(candidate.lng);
    if (lat == null || lng == null) {
      return [];
    }
    return [{
      ...candidate,
      lat,
      lng,
      normalizedCategory: normalizeCategory(candidate.category, candidate.title, candidate.shortSummary),
    }];
  });
}

function anchorCategories(mood: string) {
  if (mood === 'outdoor') {
    return ['bike', 'adventure', 'outdoor', 'sport', 'walk', 'festival', 'market'];
  }
  if (mood === 'active') {
    return ['sport', 'adventure', 'bike', 'outdoor', 'workshop', 'festival', 'quest'];
  }
  if (mood === 'date') {
    return ['theatre', 'concert', 'cinema', 'culture', 'walk', 'quest'];
  }
  if (mood === 'culture') {
    return ['theatre', 'concert', 'lecture', 'workshop', 'culture', 'festival', 'market'];
  }
  if (mood === 'calm') {
    return ['culture', 'walk', 'lecture', 'market', 'concert', 'theatre'];
  }
  return ['comedy', 'quiz', 'concert', 'festival', 'market', 'culture', 'quest', 'active', 'walk'];
}

function beforeCategories(mood: string) {
  if (mood === 'outdoor') {
    return ['cafe', 'food', 'walk'];
  }
  if (mood === 'active') {
    return ['food', 'cafe'];
  }
  if (mood === 'date') {
    return ['food', 'bar', 'culture'];
  }
  if (mood === 'culture') {
    return ['cafe', 'food', 'walk'];
  }
  if (mood === 'calm') {
    return ['cafe', 'food', 'walk'];
  }
  return ['food', 'bar', 'cafe', 'culture'];
}

function afterCategories(mood: string) {
  if (mood === 'outdoor') {
    return ['walk', 'food', 'cafe', 'bar'];
  }
  if (mood === 'active') {
    return ['bar', 'food', 'cafe'];
  }
  if (mood === 'date') {
    return ['bar', 'food', 'walk'];
  }
  if (mood === 'culture') {
    return ['bar', 'food', 'cafe', 'walk'];
  }
  if (mood === 'calm') {
    return ['walk', 'cafe', 'food'];
  }
  return ['walk', 'bar', 'food'];
}

function secondAfterCategories(mood: string, previousCategory: string) {
  if (previousCategory !== 'walk' && previousCategory !== 'outdoor') {
    return [];
  }
  if (mood === 'social' || mood === 'culture' || mood === 'date') {
    return ['bar', 'cafe', 'food'];
  }
  if (mood === 'calm') {
    return ['cafe', 'food'];
  }
  return [];
}

function prefersPostEventFlow(mood: string) {
  return mood === 'social' || mood === 'culture';
}

function flexibleCategories(mood: string) {
  if (mood === 'outdoor') {
    return ['walk', 'outdoor', 'bike', 'sport', 'adventure', 'park', 'food', 'cafe'];
  }
  if (mood === 'active') {
    return ['sport', 'adventure', 'bike', 'outdoor', 'workshop', 'food', 'bar', 'walk', 'quest'];
  }
  if (mood === 'date') {
    return ['food', 'culture', 'theatre', 'bar', 'walk'];
  }
  if (mood === 'culture') {
    return ['cafe', 'culture', 'theatre', 'concert', 'lecture', 'bar', 'walk'];
  }
  if (mood === 'calm') {
    return ['cafe', 'walk', 'culture', 'market', 'food'];
  }
  return ['food', 'comedy', 'quiz', 'bar', 'concert', 'festival', 'walk'];
}

function categoryPriority(category: string, categories: string[]) {
  const priority = categories.indexOf(category);
  return priority === -1 ? 99 : priority;
}

function isHospitalityCategory(category: string) {
  return category === 'food' || category === 'cafe' || category === 'bar';
}

function normalizeCategory(category: string, title?: string | null, summary?: string | null) {
  const explicitCategory = explicitCategoryFromSource(category);
  if (explicitCategory) {
    return explicitCategory;
  }

  const raw = [title, summary, category].filter(Boolean).join(' ').toLowerCase();
  if (
    raw.includes('велосип') ||
    raw.includes('велопрогул') ||
    raw.includes('веломаршрут') ||
    raw.includes('bike') ||
    raw.includes('bicycle') ||
    raw.includes('cycling')
  ) {
    return 'bike';
  }
  if (
    raw.includes('квадроцикл') ||
    raw.includes('atv') ||
    raw.includes('джип') ||
    raw.includes('off-road') ||
    raw.includes('offroad') ||
    raw.includes('приключ')
  ) {
    return 'adventure';
  }
  if (
    raw.includes('поход') ||
    raw.includes('hiking') ||
    raw.includes('outdoor') ||
    raw.includes('nature') ||
    raw.includes('природ') ||
    raw.includes('лес') ||
    raw.includes('набереж') ||
    raw.includes('пикник')
  ) {
    return 'outdoor';
  }
  if (raw.includes('квест') || raw.includes('quest')) {
    return 'quest';
  }
  if (raw.includes('стендап') || raw.includes('standup') || raw.includes('stand-up') || raw.includes('comedy')) {
    return 'comedy';
  }
  if (raw.includes('quiz') || raw.includes('квиз') || raw.includes('trivia')) {
    return 'quiz';
  }
  if (raw.includes('театр') || raw.includes('theatre') || raw.includes('theater') || raw.includes('спектак')) {
    return 'theatre';
  }
  if (raw.includes('concert') || raw.includes('концерт')) {
    return 'concert';
  }
  if (raw.includes('cinema') || raw.includes('кино') || raw.includes('фильм')) {
    return 'cinema';
  }
  if (raw.includes('lecture') || raw.includes('лекци')) {
    return 'lecture';
  }
  if (raw.includes('workshop') || raw.includes('мастер-класс') || raw.includes('мастеркласс')) {
    return 'workshop';
  }
  if (raw.includes('market') || raw.includes('маркет') || raw.includes('ярмарк')) {
    return 'market';
  }
  if (raw.includes('festival') || raw.includes('фестивал')) {
    return 'festival';
  }
  if (raw.includes('spa') || raw.includes('спа')) {
    return 'spa';
  }
  if (raw.includes('club') || raw.includes('клуб')) {
    return 'club';
  }
  if (raw.includes('bar') || raw.includes('бар') || raw.includes('pub')) {
    return 'bar';
  }
  if (
    raw.includes('cafe') ||
    raw.includes('coffee') ||
    raw.includes('кафе') ||
    raw.includes('кофе')
  ) {
    return 'cafe';
  }
  if (
    raw.includes('restaurant') ||
    raw.includes('food') ||
    raw.includes('еда') ||
    raw.includes('ресторан')
  ) {
    return 'food';
  }
  if (
    raw.includes('museum') ||
    raw.includes('gallery') ||
    raw.includes('culture') ||
    raw.includes('музей') ||
    raw.includes('галере')
  ) {
    return 'culture';
  }
  if (
    raw.includes('park') ||
    raw.includes('walk') ||
    raw.includes('парк') ||
    raw.includes('прогул')
  ) {
    return 'walk';
  }
  if (
    raw.includes('sport') ||
    raw.includes('sports') ||
    raw.includes('active') ||
    raw.includes('спорт') ||
    raw.includes('актив')
  ) {
    return 'sport';
  }
  return normalizeToken(category) || 'place';
}

function explicitCategoryFromSource(category: string) {
  const normalized = normalizeToken(category);
  if (normalized === 'restaurant' || normalized === 'food') {
    return 'food';
  }
  if (normalized === 'cafe' || normalized === 'coffee') {
    return 'cafe';
  }
  if (normalized === 'bar' || normalized === 'pub') {
    return 'bar';
  }
  if (normalized === 'quest' || normalized === 'quests') {
    return 'quest';
  }
  if (normalized === 'standup' || normalized === 'stand_up' || normalized === 'comedy') {
    return 'comedy';
  }
  if (normalized === 'quiz' || normalized === 'trivia') {
    return 'quiz';
  }
  if (normalized === 'theatre' || normalized === 'theater') {
    return 'theatre';
  }
  if (normalized === 'concert') {
    return 'concert';
  }
  if (normalized === 'cinema') {
    return 'cinema';
  }
  if (normalized === 'lecture') {
    return 'lecture';
  }
  if (normalized === 'workshop') {
    return 'workshop';
  }
  if (normalized === 'market') {
    return 'market';
  }
  if (normalized === 'festival') {
    return 'festival';
  }
  if (
    normalized === 'museum' ||
    normalized === 'gallery' ||
    normalized === 'culture' ||
    normalized === 'attraction' ||
    normalized === 'sights' ||
    normalized === 'monastery' ||
    normalized === 'place_of_worship'
  ) {
    return 'culture';
  }
  if (normalized === 'park' || normalized === 'walk') {
    return 'walk';
  }
  if (
    normalized === 'bike' ||
    normalized === 'bicycle' ||
    normalized === 'bicycle_rental' ||
    normalized === 'cycling'
  ) {
    return 'bike';
  }
  if (
    normalized === 'adventure' ||
    normalized === 'atv' ||
    normalized === 'quadbike' ||
    normalized === 'quad_bike' ||
    normalized === 'offroad'
  ) {
    return 'adventure';
  }
  if (
    normalized === 'outdoor' ||
    normalized === 'nature' ||
    normalized === 'picnic_site' ||
    normalized === 'viewpoint' ||
    normalized === 'hiking'
  ) {
    return 'outdoor';
  }
  if (
    normalized === 'sport' ||
    normalized === 'sports' ||
    normalized === 'sports_centre' ||
    normalized === 'pitch' ||
    normalized === 'track' ||
    normalized === 'training' ||
    normalized === 'sport_school' ||
    normalized === 'dojo' ||
    normalized === 'ice_rink' ||
    normalized === 'swimming_pool' ||
    normalized === 'fitness_centre'
  ) {
    return 'sport';
  }
  if (normalized === 'marina' || normalized === 'camp_site' || normalized === 'beach') {
    return 'outdoor';
  }
  if (normalized === 'spa') {
    return 'spa';
  }
  if (normalized === 'club') {
    return 'club';
  }
  if (normalized === 'place' || normalized === 'event' || normalized === 'entertainment') {
    return null;
  }
  return null;
}

function sameVenueCluster(left: PlanningCandidate, right: PlanningCandidate) {
  return distanceMeters(left, right) <= VENUE_CLUSTER_METERS;
}

function maxPairDistance(candidates: PlanningCandidate[]) {
  let max = 0;
  for (let index = 0; index < candidates.length; index += 1) {
    const left = candidates[index];
    if (!left) {
      continue;
    }
    for (let nextIndex = index + 1; nextIndex < candidates.length; nextIndex += 1) {
      const right = candidates[nextIndex];
      if (!right) {
        continue;
      }
      max = Math.max(max, distanceMeters(left, right));
    }
  }
  return max;
}

function walkMinutes(left: PlanningCandidate, right: PlanningCandidate) {
  return Math.max(1, Math.ceil(distanceMeters(left, right) / 80));
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

function defaultDuration(candidate: PlanningCandidate) {
  if (candidate.normalizedCategory === 'quest') {
    return 90;
  }
  if (
    candidate.normalizedCategory === 'theatre' ||
    candidate.normalizedCategory === 'concert' ||
    candidate.normalizedCategory === 'cinema'
  ) {
    return 120;
  }
  if (candidate.normalizedCategory === 'comedy' || candidate.normalizedCategory === 'quiz') {
    return 90;
  }
  if (
    candidate.normalizedCategory === 'lecture' ||
    candidate.normalizedCategory === 'workshop' ||
    candidate.normalizedCategory === 'market' ||
    candidate.normalizedCategory === 'festival' ||
    candidate.normalizedCategory === 'sport' ||
    candidate.normalizedCategory === 'bike' ||
    candidate.normalizedCategory === 'adventure' ||
    candidate.normalizedCategory === 'outdoor' ||
    candidate.normalizedCategory === 'spa' ||
    candidate.normalizedCategory === 'active'
  ) {
    return 90;
  }
  if (candidate.normalizedCategory === 'culture') {
    return 75;
  }
  if (candidate.normalizedCategory === 'food' || candidate.normalizedCategory === 'bar') {
    return 60;
  }
  if (candidate.normalizedCategory === 'walk') {
    return 30;
  }
  return MINUTES_PER_STEP;
}

function eventEndDate(candidate: PlanningCandidate) {
  if (!candidate.startsAt) {
    return null;
  }
  if (candidate.endsAt && candidate.endsAt.getTime() > candidate.startsAt.getTime()) {
    return candidate.endsAt;
  }
  return new Date(candidate.startsAt.getTime() + defaultDuration(candidate) * 60_000);
}

function localMinutes(date: Date, timezone: string) {
  const label = formatTime(date, timezone);
  return parseTimeLabel(label) ?? 0;
}

function formatTime(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function sameTimeLabel(value: unknown, expected: string) {
  const actual = parseTimeLabel(value);
  const expectedMinutes = parseTimeLabel(expected);
  if (actual == null || expectedMinutes == null) {
    return false;
  }
  return Math.abs(actual - expectedMinutes) <= 5;
}

function parseTimeLabel(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1] ?? '', 10);
  const minutes = Number.parseInt(match[2] ?? '', 10);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

function formatMinutes(value: number) {
  const normalized = ((Math.floor(value) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function durationLabel(start: string, end: string) {
  const startMin = parseTimeLabel(start);
  const endMin = parseTimeLabel(end);
  if (startMin == null || endMin == null) {
    return '2 часа';
  }
  const raw = endMin >= startMin ? endMin - startMin : endMin + 1440 - startMin;
  const roundedHalfHours = Math.max(1, Math.round(raw / 30));
  const hours = roundedHalfHours / 2;
  if (Number.isInteger(hours)) {
    return `${hours} часа`;
  }
  return `${hours.toFixed(1)} часа`;
}

function routeTitle(input: RoutePlannerInput, anchor: PlanningCandidate | null) {
  if (anchor) {
    if (input.mood === 'active') {
      return `Активный вечер: ${anchor.title}`.slice(0, 90);
    }
    if (input.mood === 'outdoor') {
      return `На природе: ${anchor.title}`.slice(0, 90);
    }
    if (input.mood === 'date') {
      return `Вечер для двоих: ${anchor.title}`.slice(0, 90);
    }
    if (input.mood === 'culture') {
      return `Культурный вечер: ${anchor.title}`.slice(0, 90);
    }
    if (input.mood === 'calm') {
      return `Спокойный вечер: ${anchor.title}`.slice(0, 90);
    }
  }
  if (input.mood === 'calm') {
    return `Спокойный вечер, ${input.city}`;
  }
  if (input.mood === 'social') {
    return `Дружеский вечер, ${input.city}`;
  }
  if (input.mood === 'date') {
    return `Маршрут для свидания, ${input.city}`;
  }
  if (input.mood === 'culture') {
    return `Культурный вечер, ${input.city}`;
  }
  if (input.mood === 'active') {
    return `Активный вечер, ${input.city}`;
  }
  if (input.mood === 'outdoor') {
    return `На природе, ${input.city}`;
  }
  return `Вечерний маршрут, ${input.city}`;
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
  if (mood === 'outdoor') {
    return 'на природе';
  }
  return mood;
}

function flexibleStepDescription(index: number, candidate: PlanningCandidate, mood: string) {
  if (index === 0) {
    return `Начните с "${candidate.title}". Это спокойная точка входа в маршрут.`;
  }
  if (mood === 'date') {
    return `Продолжите в "${candidate.title}", чтобы вечер не развалился на отдельные места.`;
  }
  return `Дальше "${candidate.title}": место рядом, с другим смыслом для вечера.`;
}

function emojiForKind(kind: string) {
  if (kind === 'cafe' || kind === 'food') {
    return '☕';
  }
  if (kind === 'bar') {
    return '🍷';
  }
  if (kind === 'culture') {
    return '🖼️';
  }
  if (kind === 'theatre' || kind === 'concert' || kind === 'comedy' || kind === 'cinema') {
    return '🎭';
  }
  if (kind === 'quiz' || kind === 'lecture' || kind === 'workshop') {
    return '🎤';
  }
  if (kind === 'market' || kind === 'festival') {
    return '🎪';
  }
  if (kind === 'sport') {
    return '🏃';
  }
  if (kind === 'bike') {
    return '🚲';
  }
  if (kind === 'outdoor') {
    return '🌿';
  }
  if (kind === 'adventure') {
    return '🧭';
  }
  if (kind === 'spa') {
    return '🫧';
  }
  if (kind === 'walk') {
    return '🌿';
  }
  if (kind === 'quest' || kind === 'active') {
    return '✨';
  }
  return '✨';
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

function nullableInt(value: unknown) {
  const parsed = number(value);
  return parsed == null ? null : Math.max(0, Math.floor(parsed));
}

function candidateFitsBudget(candidate: PlanningCandidate, budget: string | null | undefined) {
  if (
    candidate.contentKind === 'event' &&
    (candidate.priceMode === 'unknown' || (candidate.priceMode == null && candidate.priceFrom == null))
  ) {
    return false;
  }
  if (candidate.contentKind === 'event' && budget === 'free') {
    return candidate.priceMode === 'free' || candidate.priceFrom === 0;
  }
  const limit = budget == null ? null : budgetLimitFor(budget);
  return limit == null || (candidate.priceFrom ?? 0) <= limit;
}

function budgetLimitFor(budget: string) {
  return BUDGET_LIMITS[budget] ?? null;
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase().replace(/[-\s]+/g, '_');
}
