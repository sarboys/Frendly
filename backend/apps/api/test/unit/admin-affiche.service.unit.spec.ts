import { AdminAfficheService } from '../../src/services/admin-affiche.service';

const now = new Date('2026-05-05T10:00:00.000Z');

function createService(client: Record<string, unknown>) {
  return new AdminAfficheService({ client } as any);
}

function posterRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'poster-1',
    city: 'Москва',
    category: 'concert',
    title: 'Concert',
    emoji: '🎟️',
    startsAt: now,
    dateLabel: '05.05',
    timeLabel: '10:00',
    venue: 'Club',
    address: 'Street',
    distanceKm: 0,
    priceFrom: 0,
    ticketUrl: 'https://tickets.example.com/',
    provider: 'admin',
    tone: 'warm',
    tags: [],
    description: 'Description',
    status: 'draft',
    isFeatured: false,
    coverAssetId: null,
    partnerId: null,
    createdAt: now,
    updatedAt: now,
    _count: { events: 0 },
    ...overrides,
  };
}

function itemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    sourceId: 'source-1',
    sourceItemId: 'external-1',
    sourceUrl: 'https://source.example.com/',
    contentKind: 'event',
    city: 'Москва',
    timezone: 'Europe/Moscow',
    area: null,
    title: 'Imported event',
    shortSummary: null,
    category: 'concert',
    tags: [],
    address: null,
    lat: null,
    lng: null,
    startsAt: now,
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
    publicStatus: 'hidden',
    moderationStatus: 'pending',
    importedAt: now,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
    source: { code: 'kudago', name: 'KudaGo' },
    ...overrides,
  };
}

describe('AdminAfficheService unit', () => {
  it('passes native poster filters to Prisma', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = createService({
      poster: { findMany },
    });

    await service.listPosters({
      q: ' concert ',
      city: 'Москва',
      category: 'concert',
      status: 'published',
      featured: 'true',
      dateFrom: '2026-05-01T00:00:00.000Z',
      dateTo: '2026-05-31T00:00:00.000Z',
      limit: '10',
    });

    const where = findMany.mock.calls[0][0].where;
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 11,
        orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ OR: expect.any(Array) }),
        { city: 'Москва' },
        { category: 'concert' },
        { status: 'published' },
        { isFeatured: true },
        {
          startsAt: {
            gte: new Date('2026-05-01T00:00:00.000Z'),
            lte: new Date('2026-05-31T00:00:00.000Z'),
          },
        },
      ]),
    );
  });

  it('updates native poster status and feature actions', async () => {
    const update = jest
      .fn()
      .mockResolvedValueOnce(posterRow({ status: 'published' }))
      .mockResolvedValueOnce(posterRow({ isFeatured: true }));
    const service = createService({
      poster: { update },
    });

    const published = await service.posterAction('poster-1', 'publish');
    const featured = await service.posterAction('poster-1', 'feature');

    expect(update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'poster-1' },
        data: { status: 'published' },
      }),
    );
    expect(update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'poster-1' },
        data: { isFeatured: true },
      }),
    );
    expect(published.status).toBe('published');
    expect(featured.isFeatured).toBe(true);
  });

  it('forces imported list to event content kind', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = createService({
      externalContentItem: { findMany },
    });

    await service.listContentItems({ city: 'Москва' });

    expect(findMany.mock.calls[0][0].where.AND).toEqual(
      expect.arrayContaining([{ contentKind: 'event' }, { city: 'Москва' }]),
    );
  });

  it('publishes unknown price without converting it to free', async () => {
    const update = jest.fn().mockResolvedValue(
      itemRow({
        publicStatus: 'published',
        moderationStatus: 'approved',
        priceMode: 'unknown',
      }),
    );
    const service = createService({
      externalContentItem: {
        findFirst: jest.fn().mockResolvedValue({ id: 'item-1' }),
        update,
      },
    });

    const result = await service.contentItemAction('item-1', 'publish');

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          publicStatus: 'published',
          moderationStatus: 'approved',
        },
      }),
    );
    expect(result.priceMode).toBe('unknown');
  });

  it('force-free and force-paid update price mode', async () => {
    const update = jest
      .fn()
      .mockResolvedValueOnce(itemRow({ priceMode: 'free', priceFrom: 0 }))
      .mockResolvedValueOnce(itemRow({ priceMode: 'paid' }));
    const service = createService({
      externalContentItem: {
        findFirst: jest.fn().mockResolvedValue({ id: 'item-1' }),
        update,
      },
    });

    await service.contentItemAction('item-1', 'force-free');
    await service.contentItemAction('item-1', 'force-paid');

    expect(update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: { priceMode: 'free', priceFrom: 0, publicStatus: 'published' },
      }),
    );
    expect(update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: { priceMode: 'paid', publicStatus: 'published' },
      }),
    );
  });

  it('rejects unsafe actionUrl during imported update', async () => {
    const update = jest.fn();
    const service = createService({
      externalContentItem: {
        findFirst: jest.fn().mockResolvedValue({ id: 'item-1' }),
        update,
      },
    });

    await expect(
      service.updateContentItem('item-1', { actionUrl: 'javascript:alert(1)' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'admin_affiche_action_url_invalid',
    });
    expect(update).not.toHaveBeenCalled();
  });
});
