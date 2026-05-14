import {
  appMetrics,
  bindPrismaMetrics,
  getMetricsContentType,
  renderAppMetrics,
} from '../../src/metrics';

describe('app metrics', () => {
  beforeEach(() => {
    appMetrics.reset();
  });

  it('renders prometheus text with safe low-cardinality labels', async () => {
    appMetrics.httpRequestDurationSeconds.observe(
      { service: 'api', method: 'GET', endpoint: '/health', status_class: '2xx' },
      0.01,
    );
    appMetrics.dbQueryDurationSeconds.observe({ service: 'api' }, 0.02);
    appMetrics.redisPublishTotal.inc({ service: 'worker', event_type: 'realtime.publish', status: 'ok' });
    appMetrics.websocketActiveConnections.set({ service: 'chat' }, 3);
    appMetrics.payloadWarningTotal.inc({
      service: 'chat',
      event_type: 'message.send',
      direction: 'inbound',
    });

    const text = await renderAppMetrics();

    expect(getMetricsContentType()).toContain('text/plain');
    expect(text).toContain('frendly_http_request_duration_seconds');
    expect(text).toContain('endpoint="/health"');
    expect(text).toContain('frendly_db_query_duration_seconds');
    expect(text).toContain('frendly_redis_publish_total');
    expect(text).toContain('frendly_websocket_active_connections');
    expect(text).toContain('frendly_payload_warning_total');
    expect(text).not.toContain('user_id');
    expect(text).not.toContain('chat_id');
    expect(text).not.toContain('message_id');
    expect(text).not.toContain('object_key');
  });

  it('records prisma query events without SQL labels', async () => {
    let queryHandler: ((event: { duration: number; query: string }) => void) | undefined;
    const prisma = {
      $on: jest.fn((_event: 'query', handler: (event: { duration: number; query: string }) => void) => {
        queryHandler = handler;
      }),
    };

    bindPrismaMetrics(prisma, 'api');
    queryHandler?.({ duration: 25, query: 'SELECT * FROM "User"' });

    const text = await renderAppMetrics();

    expect(prisma.$on).toHaveBeenCalledWith('query', expect.any(Function));
    expect(text).toContain('frendly_db_query_total');
    expect(text).toContain('service="api"');
    expect(text).not.toContain('SELECT * FROM');
  });
});
