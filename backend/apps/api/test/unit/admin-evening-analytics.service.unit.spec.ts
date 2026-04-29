import { AdminEveningAnalyticsService } from '../../src/services/admin-evening-analytics.service';
import { ApiError } from '../../src/common/api-error';

describe('AdminEveningAnalyticsService unit', () => {
  it('returns partner offer aggregates without personal data', async () => {
    const raw = jest
      .fn()
      .mockResolvedValueOnce([{ activations: 3, uniqueUsers: 2 }])
      .mockResolvedValueOnce([
        {
          partnerId: 'partner-1',
          partnerName: 'Brix',
          city: 'Москва',
          activations: 3,
          uniqueUsers: 2,
        },
      ])
      .mockResolvedValueOnce([
        {
          routeTemplateId: 'template-1',
          routeTitle: 'Кино без кино',
          city: 'Москва',
          activations: 2,
          uniqueUsers: 2,
        },
      ])
      .mockResolvedValueOnce([
        {
          date: '2026-04-29',
          activations: 3,
          uniqueUsers: 2,
        },
      ]);
    const service = new AdminEveningAnalyticsService({
      client: {
        $queryRaw: raw,
      },
    } as any);

    const result = await service.getPartnerOfferAnalytics({
      from: '2026-04-01',
      to: '2026-04-30',
      partnerId: 'partner-1',
    });

    expect(result).toEqual({
      filters: {
        from: '2026-04-01',
        to: '2026-04-30',
        partnerId: 'partner-1',
        venueId: null,
      },
      activations: 3,
      uniqueUsers: 2,
      topPartners: [
        {
          partnerId: 'partner-1',
          partnerName: 'Brix',
          city: 'Москва',
          activations: 3,
          uniqueUsers: 2,
        },
      ],
      topRoutes: [
        {
          routeTemplateId: 'template-1',
          routeTitle: 'Кино без кино',
          city: 'Москва',
          activations: 2,
          uniqueUsers: 2,
        },
      ],
      daily: [
        {
          date: '2026-04-29',
          activations: 3,
          uniqueUsers: 2,
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('user-');
  });

  it('rejects invalid date ranges', async () => {
    const service = new AdminEveningAnalyticsService({
      client: {
        $queryRaw: jest.fn(),
      },
    } as any);

    await expect(
      service.getPartnerOfferAnalytics({
        from: '2026-05-01',
        to: '2026-04-30',
      }),
    ).rejects.toThrow(ApiError);
  });
});
