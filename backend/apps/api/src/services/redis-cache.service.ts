import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(@Optional() redis?: Redis) {
    this.redis =
      redis ??
      new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
        connectTimeout: 200,
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        lazyConnect: true,
      });
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);

      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
      return;
    }

    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', Math.trunc(ttlSeconds));
    } catch {
      return;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch {
      return;
    }
  }

  async increment(key: string): Promise<number | null> {
    try {
      return await this.redis.incr(key);
    } catch {
      return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}
