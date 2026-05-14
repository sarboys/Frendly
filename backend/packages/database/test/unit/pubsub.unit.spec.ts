import { appMetrics, renderAppMetrics } from '../../src/metrics';
import { publishBusEvent } from '../../src/pubsub';

describe('publishBusEvent metrics', () => {
  beforeEach(() => {
    appMetrics.reset();
    delete process.env.METRICS_SERVICE_NAME;
  });

  it('records publish attempts and payload size without payload labels', async () => {
    const redis = {
      publish: jest.fn().mockResolvedValue(1),
    };

    await publishBusEvent(redis as never, {
      type: 'realtime.publish',
      payload: { chatId: 'chat-1' },
    });

    const text = await renderAppMetrics();

    expect(redis.publish).toHaveBeenCalledTimes(1);
    expect(text).toContain('frendly_redis_publish_total');
    expect(text).toContain('event_type="realtime.publish"');
    expect(text).toContain('status="ok"');
    expect(text).toContain('frendly_payload_size_bytes');
    expect(text).not.toContain('chat-1');
  });
});
