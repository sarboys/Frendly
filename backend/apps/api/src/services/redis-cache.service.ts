import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly runtimeCacheEnabled: boolean;

  constructor(@Optional() redis?: Redis) {
    this.runtimeCacheEnabled =
      redis != null ||
      process.env.API_REDIS_CACHE_IN_TESTS === 'true' ||
      process.env.NODE_ENV !== 'test';
    this.redis =
      redis ??
      new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
        connectTimeout: 200,
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        lazyConnect: true,
      });
  }

  isRuntimeCacheEnabled() {
    return this.runtimeCacheEnabled;
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.runtimeCacheEnabled) {
      return null;
    }

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
    if (!this.runtimeCacheEnabled) {
      return;
    }

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
    if (!this.runtimeCacheEnabled) {
      return;
    }

    try {
      await this.redis.del(key);
    } catch {
      return;
    }
  }

  async increment(key: string): Promise<number | null> {
    if (!this.runtimeCacheEnabled) {
      return null;
    }

    try {
      return await this.redis.incr(key);
    } catch {
      return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.runtimeCacheEnabled) {
      this.redis.disconnect();
      return;
    }

    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}
