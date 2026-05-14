import { MetricsController } from '../../src/metrics.controller';

describe('MetricsController', () => {
  it('returns prometheus metrics text and content type', async () => {
    const response = { type: jest.fn() };
    const controller = new MetricsController();

    const body = await controller.getMetrics(response as never);

    expect(response.type).toHaveBeenCalledWith(expect.stringContaining('text/plain'));
    expect(body).toContain('frendly_');
  });
});
