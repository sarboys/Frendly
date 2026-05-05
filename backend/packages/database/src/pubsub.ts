import Redis from 'ioredis';

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
  return new Redis(redisUrl, { maxRetriesPerRequest: null });
}

export function createRedisSubscriber(redisUrl: string): Redis {
  return new Redis(redisUrl, { maxRetriesPerRequest: null });
}

export async function publishBusEvent(redis: Redis, event: BusEvent): Promise<void> {
  const payload = JSON.stringify(event);
  const payloadBytes = Buffer.byteLength(payload);

  if (payloadBytes > pubsubWarnPayloadBytes) {
    console.warn(
      '[redis-pubsub] large_payload',
      JSON.stringify({
        type: event.type,
        payloadBytes,
        thresholdBytes: pubsubWarnPayloadBytes,
      }),
    );
  }

  await redis.publish(PUBSUB_CHANNEL, payload);
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
