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
    expect(text).toContain('status_code="200"');
    expect(text).toContain('error_code="none"');
    expect(text).toContain('frendly_http_response_payload_bytes');
  });

  it('records safe status code and api error code labels', async () => {
    const middleware = createHttpMetricsMiddleware('api');
    const request = {
      method: 'POST',
      baseUrl: '',
      url: '/events',
      route: { path: '/events' },
    };
    const response = Object.assign(new EventEmitter(), {
      statusCode: 400,
      getHeader: jest.fn(() => undefined),
      json: jest.fn(),
    });
    const next = jest.fn();

    middleware(request as never, response as never, next);
    response.json({ code: 'invalid_event_payload', message: 'latitude is invalid' });
    response.emit('finish');

    const text = await renderAppMetrics();

    expect(next).toHaveBeenCalledTimes(1);
    expect(text).toContain('endpoint="/events"');
    expect(text).toContain('status_class="4xx"');
    expect(text).toContain('status_code="400"');
    expect(text).toContain('error_code="invalid_event_payload"');
  });

  it('collapses unmatched paths into one endpoint label', async () => {
    const middleware = createHttpMetricsMiddleware('api');
    const request = {
      method: 'GET',
      baseUrl: '',
      path: '/.env',
      url: '/.env',
    };
    const response = Object.assign(new EventEmitter(), {
      statusCode: 404,
      getHeader: jest.fn(() => undefined),
    });
    const next = jest.fn();

    middleware(request as never, response as never, next);
    response.emit('finish');

    const text = await renderAppMetrics();

    expect(next).toHaveBeenCalledTimes(1);
    expect(text).toContain('endpoint="unmatched"');
    expect(text).not.toContain('endpoint="/.env"');
    expect(text).toContain('status_code="404"');
  });
});
