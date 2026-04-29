import { Injectable } from '@nestjs/common';
import type { EveningRouteAiCandidateVenue } from './evening-route-ai-candidates.service';

export type EveningRouteAiValidationBrief = {
  minSteps: number;
  maxSteps: number;
  budget?: string | null;
  mood?: string | null;
  allowRepeatVenues?: boolean;
};

export type EveningRouteAiDraftStepInput = {
  venueId?: string | null;
  partnerOfferId?: string | null;
  timeLabel?: string | null;
  endTimeLabel?: string | null;
  walkMin?: number | null;
};

export type EveningRouteAiDraftInput = {
  title?: string | null;
  vibe?: string | null;
  mood?: string | null;
  budget?: string | null;
  steps?: EveningRouteAiDraftStepInput[];
};

export type EveningRouteAiValidationIssue = {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  stepIndex?: number;
  venueId?: string | null;
};

export type EveningRouteAiValidationResult = {
  status: 'valid' | 'warning' | 'invalid';
  score: number;
  issues: EveningRouteAiValidationIssue[];
  errors: EveningRouteAiValidationIssue[];
  warnings: EveningRouteAiValidationIssue[];
};

const HIGH_WALK_MINUTES = 20;

@Injectable()
export class EveningRouteAiValidatorService {
  validateDraft(
    brief: EveningRouteAiValidationBrief,
    candidates: EveningRouteAiCandidateVenue[],
    draft: EveningRouteAiDraftInput,
  ): EveningRouteAiValidationResult {
    const errors: EveningRouteAiValidationIssue[] = [];
    const warnings: EveningRouteAiValidationIssue[] = [];
    const candidateById = new Map(candidates.map((venue) => [venue.id, venue]));
    const steps = Array.isArray(draft.steps) ? draft.steps : [];

    if (steps.length < brief.minSteps) {
      errors.push({
        severity: 'error',
        code: 'ai_route_steps_below_min',
        message: 'Route has fewer steps than requested',
      });
    }
    if (steps.length > brief.maxSteps) {
      errors.push({
        severity: 'error',
        code: 'ai_route_steps_above_max',
        message: 'Route has more steps than requested',
      });
    }

    const seenVenueIds = new Set<string>();
    for (const [index, step] of steps.entries()) {
      const venueId = typeof step.venueId === 'string' ? step.venueId.trim() : '';
      const venue = venueId ? candidateById.get(venueId) : null;
      if (!venue) {
        errors.push({
          severity: 'error',
          code: 'ai_route_unknown_venue',
          message: 'Route step uses an unknown venue',
          stepIndex: index,
          venueId: venueId || null,
        });
        continue;
      }

      if (!brief.allowRepeatVenues && seenVenueIds.has(venue.id)) {
        errors.push({
          severity: 'error',
          code: 'ai_route_duplicate_venue',
          message: 'Route repeats a venue',
          stepIndex: index,
          venueId: venue.id,
        });
      }
      seenVenueIds.add(venue.id);

      if (venue.lat == null || venue.lng == null) {
        errors.push({
          severity: 'error',
          code: 'ai_route_missing_coordinates',
          message: 'Route step venue has no coordinates',
          stepIndex: index,
          venueId: venue.id,
        });
      }

      if (!venue.openingHours) {
        warnings.push({
          severity: 'warning',
          code: 'ai_route_opening_hours_missing',
          message: 'Venue has no opening hours',
          stepIndex: index,
          venueId: venue.id,
        });
      } else if (!isTimeInsideOpeningHours(step.timeLabel, venue.openingHours)) {
        warnings.push({
          severity: 'warning',
          code: 'ai_route_outside_opening_hours',
          message: 'Step time is outside venue opening hours',
          stepIndex: index,
          venueId: venue.id,
        });
      }

      if (typeof step.walkMin === 'number' && step.walkMin > HIGH_WALK_MINUTES) {
        warnings.push({
          severity: 'warning',
          code: 'ai_route_walk_time_high',
          message: 'Walk time is above 20 minutes',
          stepIndex: index,
          venueId: venue.id,
        });
      }
    }

    const score = computeScore({
      brief,
      draft,
      errors,
      warnings,
      hasPartnerOffer: steps.some((step) => typeof step.partnerOfferId === 'string' && step.partnerOfferId.trim().length > 0),
    });
    const status =
      errors.length > 0 ? 'invalid' : warnings.length > 0 ? 'warning' : 'valid';

    return {
      status,
      score,
      issues: [...errors, ...warnings],
      errors,
      warnings,
    };
  }
}

function computeScore(input: {
  brief: EveningRouteAiValidationBrief;
  draft: EveningRouteAiDraftInput;
  errors: EveningRouteAiValidationIssue[];
  warnings: EveningRouteAiValidationIssue[];
  hasPartnerOffer: boolean;
}) {
  let score = 100 - input.errors.length * 30;
  for (const warning of input.warnings) {
    if (
      warning.code === 'ai_route_opening_hours_missing' ||
      warning.code === 'ai_route_walk_time_high'
    ) {
      score -= 10;
    }
  }

  if (
    input.hasPartnerOffer &&
    input.errors.length === 0 &&
    matchesBudget(input.brief, input.draft) &&
    matchesMood(input.brief, input.draft)
  ) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
}

function matchesBudget(
  brief: EveningRouteAiValidationBrief,
  draft: EveningRouteAiDraftInput,
) {
  if (!brief.budget) {
    return true;
  }
  return draft.budget === brief.budget;
}

function matchesMood(
  brief: EveningRouteAiValidationBrief,
  draft: EveningRouteAiDraftInput,
) {
  if (!brief.mood) {
    return true;
  }
  const haystack = [draft.mood, draft.vibe]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  return haystack.includes(brief.mood.toLowerCase());
}

function isTimeInsideOpeningHours(timeLabel: unknown, openingHours: unknown) {
  const timeMinutes = parseTimeToMinutes(timeLabel);
  if (timeMinutes == null) {
    return false;
  }
  if (!openingHours || typeof openingHours !== 'object') {
    return false;
  }

  return Object.values(openingHours as Record<string, unknown>).some((day) => {
    if (!Array.isArray(day)) {
      return false;
    }
    return day.some((interval) => isTimeInsideInterval(timeMinutes, interval));
  });
}

function isTimeInsideInterval(timeMinutes: number, interval: unknown) {
  if (!Array.isArray(interval) || interval.length < 2) {
    return false;
  }
  const start = parseTimeToMinutes(interval[0]);
  const end = parseTimeToMinutes(interval[1]);
  if (start == null || end == null) {
    return false;
  }
  if (end >= start) {
    return timeMinutes >= start && timeMinutes <= end;
  }
  return timeMinutes >= start || timeMinutes <= end;
}

function parseTimeToMinutes(value: unknown) {
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
