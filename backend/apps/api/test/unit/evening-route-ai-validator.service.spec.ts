import { EveningRouteAiValidatorService } from '../../src/services/evening-route-ai-validator.service';
import type { EveningRouteAiCandidateVenue } from '../../src/services/evening-route-ai-candidates.service';

describe('EveningRouteAiValidatorService unit', () => {
  const service = new EveningRouteAiValidatorService();
  const candidates: EveningRouteAiCandidateVenue[] = [
    {
      id: 'venue-1',
      partnerId: 'partner-1',
      city: 'Москва',
      area: 'центр',
      name: 'Brix Wine',
      address: 'Москва, Example, 1',
      lat: 55.75,
      lng: 37.61,
      category: 'bar',
      tags: ['date', 'quiet'],
      averageCheck: 1800,
      openingHours: {
        mon: [['12:00', '23:00']],
      },
      offers: [
        {
          id: 'offer-1',
          partnerId: 'partner-1',
          venueId: 'venue-1',
          title: 'Бокал в подарок',
          description: 'По QR',
          terms: null,
          shortLabel: 'Подарок',
        },
      ],
    },
    {
      id: 'venue-2',
      partnerId: null,
      city: 'Москва',
      area: 'центр',
      name: 'Gallery',
      address: 'Москва, Example, 2',
      lat: 55.76,
      lng: 37.62,
      category: 'gallery',
      tags: ['art'],
      averageCheck: null,
      openingHours: null,
      offers: [],
    },
    {
      id: 'venue-no-coords',
      partnerId: null,
      city: 'Москва',
      area: 'центр',
      name: 'Secret Place',
      address: 'Москва, Example, 3',
      lat: null,
      lng: null,
      category: 'bar',
      tags: ['date'],
      averageCheck: null,
      openingHours: {
        mon: [['12:00', '23:00']],
      },
      offers: [],
    },
  ];

  it('rejects unknown venue id', () => {
    const result = service.validateDraft(
      { minSteps: 1, maxSteps: 4 },
      candidates,
      {
        steps: [{ venueId: 'unknown', timeLabel: '19:00' }],
      },
    );

    expect(result.status).toBe('invalid');
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'ai_route_unknown_venue' }),
    ]);
  });

  it('rejects duplicate venue unless repeats are allowed', () => {
    const rejected = service.validateDraft(
      { minSteps: 1, maxSteps: 4 },
      candidates,
      {
        steps: [
          { venueId: 'venue-1', timeLabel: '19:00' },
          { venueId: 'venue-1', timeLabel: '20:00' },
        ],
      },
    );
    const allowed = service.validateDraft(
      { minSteps: 1, maxSteps: 4, allowRepeatVenues: true },
      candidates,
      {
        steps: [
          { venueId: 'venue-1', timeLabel: '19:00' },
          { venueId: 'venue-1', timeLabel: '20:00' },
        ],
      },
    );

    expect(rejected.errors).toEqual([
      expect.objectContaining({ code: 'ai_route_duplicate_venue' }),
    ]);
    expect(allowed.errors).toHaveLength(0);
  });

  it('rejects steps below min or above max', () => {
    expect(
      service.validateDraft({ minSteps: 2, maxSteps: 4 }, candidates, {
        steps: [{ venueId: 'venue-1', timeLabel: '19:00' }],
      }).errors,
    ).toEqual([expect.objectContaining({ code: 'ai_route_steps_below_min' })]);

    expect(
      service.validateDraft({ minSteps: 1, maxSteps: 1 }, candidates, {
        steps: [
          { venueId: 'venue-1', timeLabel: '19:00' },
          { venueId: 'venue-2', timeLabel: '20:00' },
        ],
      }).errors,
    ).toEqual([expect.objectContaining({ code: 'ai_route_steps_above_max' })]);
  });

  it('rejects missing coordinates', () => {
    const result = service.validateDraft(
      { minSteps: 1, maxSteps: 4 },
      candidates,
      {
        steps: [{ venueId: 'venue-no-coords', timeLabel: '19:00' }],
      },
    );

    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'ai_route_missing_coordinates' }),
    ]);
  });

  it('warns about missing opening hours, outside hours and high walk time', () => {
    const result = service.validateDraft(
      { minSteps: 1, maxSteps: 4 },
      candidates,
      {
        steps: [
          { venueId: 'venue-2', timeLabel: '19:00', walkMin: 25 },
          { venueId: 'venue-1', timeLabel: '03:00' },
        ],
      },
    );

    expect(result.status).toBe('warning');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'ai_route_opening_hours_missing' }),
        expect.objectContaining({ code: 'ai_route_walk_time_high' }),
        expect.objectContaining({ code: 'ai_route_outside_opening_hours' }),
      ]),
    );
  });

  it('computes score with errors, warnings and partner offer bonus', () => {
    const clean = service.validateDraft(
      { minSteps: 1, maxSteps: 4, budget: 'mid', mood: 'chill' },
      candidates,
      {
        vibe: 'quiet chill',
        budget: 'mid',
        steps: [
          {
            venueId: 'venue-1',
            partnerOfferId: 'offer-1',
            timeLabel: '19:00',
            walkMin: 7,
          },
        ],
      },
    );
    const withWarning = service.validateDraft(
      { minSteps: 1, maxSteps: 4 },
      candidates,
      {
        steps: [{ venueId: 'venue-2', timeLabel: '19:00', walkMin: 25 }],
      },
    );
    const withError = service.validateDraft(
      { minSteps: 1, maxSteps: 4 },
      candidates,
      {
        steps: [{ venueId: 'unknown', timeLabel: '19:00' }],
      },
    );

    expect(clean.score).toBe(100);
    expect(withWarning.score).toBe(80);
    expect(withError.score).toBe(70);
  });
});
