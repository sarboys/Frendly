import { EventEmitter } from 'node:events';
import { appMetrics, renderAppMetrics } from '@big-break/database';
import { createHttpMetricsMiddleware } from '../../src/common/http-metrics.middleware';

describe('createHttpMetricsMiddleware', () => {
  beforeEach(() => {
    appMetrics.reset();
  });

  it('records request duration and response payload size with normalized route labels', async () => {
    const middleware = createHttpMetricsMiddleware('api');
    const request = {
      method: 'GET',
      baseUrl: '',
      url: '/health?debug=1',
      route: { path: '/health' },
    };
    const response = Object.assign(new EventEmitter(), {
      statusCode: 200,
      getHeader: jest.fn((name: string) => (name.toLowerCase() === 'content-length' ? '42' : undefined)),
    });
    const next = jest.fn();

    middleware(request as never, response as never, next);
    response.emit('finish');

    const text = await renderAppMetrics();

    expect(next).toHaveBeenCalledTimes(1);
    expect(text).toContain('frendly_http_request_duration_seconds');
    expect(text).toContain('endpoint="/health"');
    expect(text).toContain('status_class="2xx"');
    expect(text).toContain('frendly_http_response_payload_bytes');
  });
});
