import Redis from 'ioredis';
import { appMetrics } from './metrics';

export const PUBSUB_CHANNEL = 'big-break:events';

export interface BusEvent<T = unknown> {
  type: string;
  payload: T;
}

const DEFAULT_PUBSUB_WARN_PAYLOAD_BYTES = 64 * 1024;
const pubsubWarnPayloadBytes = resolvePositiveInteger(
  process.env.REDIS_PUBSUB_WARN_PAYLOAD_BYTES,
  DEFAULT_PUBSUB_WARN_PAYLOAD_BYTES,
);

export function createRedisPublisher(redisUrl: string): Redis {
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const service = metricsServiceName();
  redis.on('error', () => {
    appMetrics.redisPublishTotal.inc({ service, event_type: 'connection', status: 'error' });
  });
  redis.on('reconnecting', () => {
    appMetrics.redisPublishTotal.inc({ service, event_type: 'connection', status: 'reconnecting' });
  });
  return redis;
}

export function createRedisSubscriber(redisUrl: string): Redis {
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const service = metricsServiceName();
  redis.on('error', () => {
    appMetrics.redisSubscribeTotal.inc({ service, event_type: 'connection', status: 'error' });
  });
  redis.on('reconnecting', () => {
    appMetrics.redisSubscribeTotal.inc({ service, event_type: 'connection', status: 'reconnecting' });
  });
  return redis;
}

export async function publishBusEvent(redis: Redis, event: BusEvent): Promise<void> {
  const payload = JSON.stringify(event);
  const payloadBytes = Buffer.byteLength(payload);
  const service = metricsServiceName();
  const eventType = event.type || 'unknown';

  appMetrics.payloadSizeBytes.observe(
    { service, event_type: eventType, direction: 'publish' },
    payloadBytes,
  );

  if (payloadBytes > pubsubWarnPayloadBytes) {
    appMetrics.redisPublishTotal.inc({
      service,
      event_type: eventType,
      status: 'large_payload',
    });
    console.warn(
      '[redis-pubsub] large_payload',
      JSON.stringify({
        type: event.type,
        payloadBytes,
        thresholdBytes: pubsubWarnPayloadBytes,
      }),
    );
  }

  try {
    await redis.publish(PUBSUB_CHANNEL, payload);
    appMetrics.redisPublishTotal.inc({ service, event_type: eventType, status: 'ok' });
  } catch (error) {
    appMetrics.redisPublishTotal.inc({ service, event_type: eventType, status: 'error' });
    throw error;
  }
}

function metricsServiceName() {
  return process.env.METRICS_SERVICE_NAME?.trim() || 'shared';
}

function resolvePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}
