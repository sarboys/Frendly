import { AdminAfficheService } from '../../src/services/admin-affiche.service';

const now = new Date('2026-05-05T10:00:00.000Z');

function createService(client: Record<string, unknown>) {
  return new AdminAfficheService({ client } as any);
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
