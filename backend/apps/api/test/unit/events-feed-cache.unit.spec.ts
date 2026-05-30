import {
  buildEventsFeedCacheKey,
  eventsFeedCacheTtlSeconds,
  normalizeEventsFeedGeo,
  shouldBypassEventsFeedCache,
} from '../../src/services/events-feed-cache';

describe('events feed cache helpers', () => {
  it('rounds geo to stable map cells', () => {
    expect(
      normalizeEventsFeedGeo({
        latitude: 55.755812,
        longitude: 37.617298,
        radiusKm: 50.4,
      }),
    ).toEqual({
      latitude: 55.756,
      longitude: 37.617,
      radiusKm: 50,
    });
  });

  it('builds same key for tiny geo changes', () => {
    const first = buildEventsFeedCacheKey({
      city: 'Москва',
      latitude: 55.755812,
      longitude: 37.617298,
      radiusKm: 50,
      limit: 20,
    });
    const second = buildEventsFeedCacheKey({
      city: 'Москва',
      latitude: 55.755849,
      longitude: 37.617251,
      radiusKm: 50,
      limit: 20,
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^events:feed:v1:[a-f0-9]{40}$/);
  });

  it('bypasses cache for text search', () => {
    expect(shouldBypassEventsFeedCache({ q: 'бар' })).toBe(true);
  });

  it('does not bypass cache for blank text search', () => {
    expect(shouldBypassEventsFeedCache({ q: '   ' })).toBe(false);
  });

  it('uses short ttl for geo feed', () => {
    expect(
      eventsFeedCacheTtlSeconds({
        latitude: 55.755812,
        longitude: 37.617298,
      }),
    ).toBe(15);
  });

  it('uses default ttl for non-geo feed', () => {
    expect(eventsFeedCacheTtlSeconds({ city: 'Москва' })).toBe(30);
  });

  it('keeps boolean requirement filters distinct', () => {
    const enabled = buildEventsFeedCacheKey({
      requiresVerification: true,
      limit: 20,
    });
    const disabled = buildEventsFeedCacheKey({
      requiresVerification: false,
      limit: 20,
    });

    expect(enabled).not.toBe(disabled);
    expect(enabled).toBe(
      buildEventsFeedCacheKey({ requiresVerification: 'true', limit: 20 }),
    );
  });

  it('keeps text search keys distinct even when caller forgets bypass', () => {
    const searchKey = buildEventsFeedCacheKey({ q: 'бар', limit: 20 });
    const defaultKey = buildEventsFeedCacheKey({ limit: 20 });

    expect(searchKey).not.toBe(defaultKey);
  });

  it('keeps missing city distinct from Moscow city filter', () => {
    const noCity = buildEventsFeedCacheKey({ limit: 20 });
    const moscow = buildEventsFeedCacheKey({ city: 'Москва', limit: 20 });

    expect(noCity).not.toBe(moscow);
  });

  it('keeps city cache versions distinct', () => {
    const versionOne = buildEventsFeedCacheKey({
      city: 'Москва',
      cityVersion: 1,
      limit: 20,
    });
    const versionTwo = buildEventsFeedCacheKey({
      city: 'Москва',
      cityVersion: 2,
      limit: 20,
    });

    expect(versionOne).not.toBe(versionTwo);
  });
});
