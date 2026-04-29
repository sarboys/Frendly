import { EveningAnalyticsService } from '../../src/services/evening-analytics.service';

describe('EveningAnalyticsService unit', () => {
  it('does not throw when analytics insert fails', async () => {
    const create = jest.fn().mockRejectedValue(new Error('database is down'));
    const service = new EveningAnalyticsService({
      client: {
        eveningAnalyticsEvent: {
          create,
        },
      },
    } as any);

    const warnSpy = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => undefined);

    await expect(
      service.track({
        name: 'route_template_viewed',
        userId: 'user-1',
        routeTemplateId: 'template-1',
        city: 'Москва',
        metadata: { surface: 'routes_screen' },
      }),
    ).resolves.toBeUndefined();

    expect(create).toHaveBeenCalledWith({
      data: {
        name: 'route_template_viewed',
        userId: 'user-1',
        routeTemplateId: 'template-1',
        routeId: null,
        sessionId: null,
        partnerId: null,
        venueId: null,
        offerId: null,
        city: 'Москва',
        metadata: { surface: 'routes_screen' },
      },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to track evening analytics event'),
    );
  });
});
