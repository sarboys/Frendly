import Redis from 'ioredis';

export const PUBSUB_CHANNEL = 'big-break:events';

export interface BusEvent<T = unknown> {
  type: string;
  payload: T;
}

export function createRedisPublisher(redisUrl: string): Redis {
  return new Redis(redisUrl, { maxRetriesPerRequest: null });
}

export function createRedisSubscriber(redisUrl: string): Redis {
  return new Redis(redisUrl, { maxRetriesPerRequest: null });
}

export async function publishBusEvent(redis: Redis, event: BusEvent): Promise<void> {
  await redis.publish(PUBSUB_CHANNEL, JSON.stringify(event));
}
