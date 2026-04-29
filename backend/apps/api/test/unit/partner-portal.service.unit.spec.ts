import { PartnerPortalService } from '../../src/services/partner-portal.service';

const approvedPartner = {
  partnerAccountId: 'account-1',
  partnerId: 'partner-1',
};

describe('PartnerPortalService unit', () => {
  it('requires an approved partner binding before portal CRUD', async () => {
    const service = new PartnerPortalService({ client: {} } as any);

    await expect(
      service.listMeetups({ partnerAccountId: 'account-1', partnerId: null }, {}),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'partner_account_pending',
    });
  });

  it('lists only current partner meetups and skips canceled rows', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new PartnerPortalService({
      client: {
        event: {
          findMany,
        },
      },
    } as any);

    await service.listMeetups(approvedPartner, { limit: 20 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          partnerId: 'partner-1',
          canceledAt: null,
        },
        take: 21,
      }),
    );
  });

  it('creates partner posters as drafts owned by the session partner', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'poster-1',
      partnerId: 'partner-1',
      category: 'concert',
      title: 'Jazz Night',
      emoji: '🎷',
      startsAt: new Date('2026-05-01T20:00:00.000Z'),
      dateLabel: '01.05',
      timeLabel: '20:00',
      venue: 'Roof',
      address: 'Москва, Тверская 1',
      distanceKm: 0,
      priceFrom: 1200,
      ticketUrl: 'https://tickets.example',
      provider: 'partner',
      tone: 'warm',
      tags: ['jazz'],
      description: 'Live jazz',
      status: 'draft',
      isFeatured: false,
      coverAssetId: null,
      createdAt: new Date('2026-04-29T10:00:00.000Z'),
      updatedAt: new Date('2026-04-29T10:00:00.000Z'),
    });
    const service = new PartnerPortalService({
      client: {
        poster: {
          create,
        },
      },
    } as any);

    const result = await service.createPoster(approvedPartner, {
      category: 'concert',
      title: 'Jazz Night',
      emoji: '🎷',
      startsAt: '2026-05-01T20:00:00.000Z',
      venue: 'Roof',
      address: 'Москва, Тверская 1',
      priceFrom: 1200,
      ticketUrl: 'https://tickets.example',
      tags: ['jazz'],
      description: 'Live jazz',
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        partnerId: 'partner-1',
        status: 'draft',
        provider: 'partner',
      }),
    });
    expect(result).toMatchObject({
      id: 'poster-1',
      partnerId: 'partner-1',
      status: 'draft',
    });
  });

  it('does not create featuring requests for targets owned by another partner', async () => {
    const service = new PartnerPortalService({
      client: {
        event: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        partnerFeaturedRequest: {
          create: jest.fn(),
        },
      },
    } as any);

    await expect(
      service.createFeaturedRequest(approvedPartner, {
        targetType: 'event',
        targetId: 'event-from-other-partner',
        city: 'Москва',
        placement: 'home',
        title: 'Jazz Night',
        description: 'Put us on home',
        startsAt: '2026-05-01T10:00:00.000Z',
        endsAt: '2026-05-05T10:00:00.000Z',
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'partner_target_not_found',
    });
  });
});
