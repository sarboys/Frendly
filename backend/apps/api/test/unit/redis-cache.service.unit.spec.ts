import { RedisCacheService } from '../../src/services/redis-cache.service';

type RedisMock = {
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
  incr: jest.Mock;
  quit: jest.Mock;
  disconnect: jest.Mock;
};

function createRedisMock(overrides: Partial<RedisMock> = {}): RedisMock {
  return {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    quit: jest.fn(),
    disconnect: jest.fn(),
    ...overrides,
  };
}

describe('RedisCacheService', () => {
  it('returns null when Redis get fails', async () => {
    const redis = createRedisMock({
      get: jest.fn().mockRejectedValue(new Error('redis unavailable')),
    });
    const service = new RedisCacheService(redis as never);

    await expect(service.getJson('cache:key')).resolves.toBeNull();
  });

  it('stores JSON with ttl seconds', async () => {
    const redis = createRedisMock({
      set: jest.fn().mockResolvedValue('OK'),
    });
    const service = new RedisCacheService(redis as never);
    const value = { id: 'user-1', count: 2 };

    await service.setJson('cache:key', value, 30);

    expect(redis.set).toHaveBeenCalledWith(
      'cache:key',
      JSON.stringify(value),
      'EX',
      30,
    );
  });

  it('truncates fractional ttl seconds before storing', async () => {
    const redis = createRedisMock({
      set: jest.fn().mockResolvedValue('OK'),
    });
    const service = new RedisCacheService(redis as never);

    await service.setJson('cache:key', { ok: true }, 10.9);

    expect(redis.set).toHaveBeenCalledWith(
      'cache:key',
      JSON.stringify({ ok: true }),
      'EX',
      10,
    );
  });

  it('returns parsed JSON when value exists', async () => {
    const value = { enabled: true, limit: 12 };
    const redis = createRedisMock({
      get: jest.fn().mockResolvedValue(JSON.stringify(value)),
    });
    const service = new RedisCacheService(redis as never);

    await expect(service.getJson<typeof value>('cache:key')).resolves.toEqual(
      value,
    );
  });

  it('increments a cache version key', async () => {
    const redis = createRedisMock({
      incr: jest.fn().mockResolvedValue(2),
    });
    const service = new RedisCacheService(redis as never);

    await expect(service.increment('cache:version')).resolves.toBe(2);
    expect(redis.incr).toHaveBeenCalledWith('cache:version');
  });

  it('returns null when increment fails', async () => {
    const redis = createRedisMock({
      incr: jest.fn().mockRejectedValue(new Error('redis unavailable')),
    });
    const service = new RedisCacheService(redis as never);

    await expect(service.increment('cache:version')).resolves.toBeNull();
  });
});
