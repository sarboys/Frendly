import { ContentDeduplicationService } from '../../src/content/content-deduplication.service';
import type { NormalizedExternalContentItem } from '../../src/content/content-source.types';

function item(input: Partial<NormalizedExternalContentItem>): NormalizedExternalContentItem {
  return {
    sourceCode: 'kudago',
    sourceItemId: '1',
    sourceUrl: null,
    contentKind: 'place',
    city: 'Москва',
    timezone: 'Europe/Moscow',
    area: null,
    title: 'Кофейня Смена',
    shortSummary: null,
    category: 'food',
    tags: [],
    address: null,
    lat: 55.7558,
    lng: 37.6173,
    startsAt: null,
    endsAt: null,
    priceFrom: null,
    currency: null,
    venueName: null,
    imageUrl: null,
    actionUrl: null,
    actionKind: null,
    priceMode: 'unknown',
    isAffiliate: false,
    sourceProvider: null,
    placeKind: null,
    lastSeenAt: null,
    raw: {},
    normalizedHash: 'hash',
    expiresAt: null,
    ...input,
  };
}

describe('ContentDeduplicationService', () => {
  it('groups close places with the same title across sources', () => {
    const service = new ContentDeduplicationService();

    const groups = service.groupDuplicates([
      item({ sourceCode: 'kudago', sourceItemId: 'k1' }),
      item({ sourceCode: 'overpass', sourceItemId: 'o1', lat: 55.75585, lng: 37.61735 }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.items).toHaveLength(2);
  });

  it('does not group events with the same title on different dates', () => {
    const service = new ContentDeduplicationService();

    const groups = service.groupDuplicates([
      item({ contentKind: 'event', sourceItemId: 'e1', startsAt: new Date('2026-05-05T18:00:00.000Z') }),
      item({ contentKind: 'event', sourceItemId: 'e2', startsAt: new Date('2026-05-06T18:00:00.000Z') }),
    ]);

    expect(groups).toHaveLength(2);
  });
});
