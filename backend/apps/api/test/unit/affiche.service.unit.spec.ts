import { AfficheService } from '../../src/services/affiche.service';

describe('AfficheService', () => {
  it('lists only public event content and applies filters', async () => {
    const findMany = jest.fn().mockResolvedValue([
      afficheItem({
        id: 'event-1',
        source: { code: 'advcake_ticketland', name: 'AdvCake Ticketland' },
      }),
    ]);
    const service = new AfficheService({
      client: {
        externalContentItem: {
          findMany,
        },
      },
    } as any);

    const result = await service.listEvents({
      city: 'Москва',
      date: '2026-05-05',
      priceMode: 'paid',
      source: 'advcake_ticketland',
      category: 'comedy',
      featured: 'true',
      q: 'стендап',
      limit: '10',
    });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        city: 'Москва',
        contentKind: 'event',
        publicStatus: 'published',
        priceMode: 'paid',
        source: { code: 'advcake_ticketland' },
        category: 'comedy',
        imageUrl: { not: null },
      }),
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: 11,
    }));
    const findManyArgs = findMany.mock.calls[0][0];
    expect(findManyArgs).not.toHaveProperty('include');
    expect(findManyArgs.select).toEqual(expect.objectContaining({
      id: true,
      title: true,
      shortSummary: true,
      source: { select: { code: true, name: true } },
    }));
    expect(findManyArgs.select).not.toHaveProperty('raw');
    expect(findManyArgs.select).not.toHaveProperty('normalizedHash');
    expect(findManyArgs.select).not.toHaveProperty('importRunId');
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'event-1',
        priceMode: 'paid',
        sourceCode: 'advcake_ticketland',
        actionUrl: 'https://go.avred.online/click',
        actionKind: 'affiliate_ticket',
        isAffiliate: true,
        venue: 'Клуб',
      }),
    ]);
  });

  it('does not expose places through affiche detail', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new AfficheService({
      client: {
        externalContentItem: {
          findFirst,
        },
      },
    } as any);

    await expect(service.getEvent('place-1')).rejects.toMatchObject({
      code: 'affiche_event_not_found',
    });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'place-1',
        contentKind: 'event',
        publicStatus: 'published',
        priceMode: { in: ['free', 'paid'] },
      }),
    }));
    const findFirstArgs = findFirst.mock.calls[0][0];
    expect(findFirstArgs).not.toHaveProperty('include');
    expect(findFirstArgs.select).not.toHaveProperty('raw');
  });
});

function afficheItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    title: 'Большой стендап',
    shortSummary: 'Вечер комедии',
    city: 'Москва',
    timezone: 'Europe/Moscow',
    venueName: 'Клуб',
    address: null,
    lat: null,
    lng: null,
    startsAt: new Date('2026-05-05T16:00:00.000Z'),
    endsAt: null,
    category: 'comedy',
    priceFrom: 1500,
    priceMode: 'paid',
    currency: 'RUB',
    imageUrl: 'https://ticketland.ru/image.jpg',
    sourceProvider: 'Ticketland / MTS Live',
    actionUrl: 'https://go.avred.online/click',
    actionKind: 'affiliate_ticket',
    isAffiliate: true,
    tags: ['18+'],
    source: { code: 'advcake_ticketland', name: 'AdvCake Ticketland' },
    ...overrides,
  };
}
