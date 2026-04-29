import { AdminVenueService } from '../../src/services/admin-venue.service';

describe('AdminVenueService unit', () => {
  it('creates a Frendly venue with required fields and approved moderation', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'venue-1',
      ownerType: 'frendly',
      partnerId: null,
      source: 'manual',
      moderationStatus: 'approved',
      trustLevel: 'verified',
      city: 'Москва',
      timezone: 'Europe/Moscow',
      area: 'центр',
      name: 'Example Bar',
      address: 'Москва, Example street, 1',
      lat: 55.7558,
      lng: 37.6173,
      category: 'bar',
      tags: ['date', 'quiet'],
      averageCheck: 1800,
      openingHours: null,
      status: 'open',
      createdAt: new Date('2026-04-29T08:00:00.000Z'),
      updatedAt: new Date('2026-04-29T08:00:00.000Z'),
    });
    const service = new AdminVenueService({
      client: {
        venue: {
          create,
        },
      },
    } as any);

    const result = await service.createVenue({
      ownerType: 'frendly',
      city: 'Москва',
      area: 'центр',
      name: 'Example Bar',
      address: 'Москва, Example street, 1',
      lat: 55.7558,
      lng: 37.6173,
      category: 'bar',
      tags: ['date', 'quiet'],
      averageCheck: 1800,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerType: 'frendly',
        source: 'manual',
        moderationStatus: 'approved',
        trustLevel: 'verified',
        city: 'Москва',
        timezone: 'Europe/Moscow',
        name: 'Example Bar',
        address: 'Москва, Example street, 1',
        lat: 55.7558,
        lng: 37.6173,
        category: 'bar',
        tags: ['date', 'quiet'],
        averageCheck: 1800,
        status: 'open',
      }),
    });
    expect(result).toMatchObject({
      id: 'venue-1',
      city: 'Москва',
      moderationStatus: 'approved',
      trustLevel: 'verified',
    });
  });

  it('rejects offer creation for missing or inactive venue', async () => {
    const service = new AdminVenueService({
      client: {
        venue: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
              id: 'venue-closed',
              partnerId: 'partner-1',
              status: 'closed',
            }),
        },
        partner: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'partner-1',
            status: 'active',
          }),
        },
        partnerOffer: {
          create: jest.fn(),
        },
      },
    } as any);

    await expect(
      service.createOffer({
        partnerId: 'partner-1',
        venueId: 'missing-venue',
        title: 'Комплимент',
        description: 'Бокал игристого',
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'venue_not_found',
    });

    await expect(
      service.createOffer({
        partnerId: 'partner-1',
        venueId: 'venue-closed',
        title: 'Комплимент',
        description: 'Бокал игристого',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'venue_inactive',
    });
  });
});
