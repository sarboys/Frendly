import { AdminUsersService } from '../../src/services/admin-users.service';

const now = new Date('2026-05-05T10:00:00.000Z');

function createService(
  client: Record<string, unknown>,
  dropsRewardService?: Record<string, unknown>,
  verificationService?: Record<string, unknown>,
) {
  return new AdminUsersService(
    { client } as any,
    dropsRewardService as any,
    verificationService as any,
  );
}

function detailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    displayName: 'Анна',
    email: 'anna@example.com',
    phoneNumber: '+70000000000',
    status: 'active',
    verified: false,
    createdAt: now,
    updatedAt: now,
    suspendedAt: null,
    suspensionReason: null,
    profile: {
      age: null,
      birthDate: null,
      gender: null,
      city: 'Москва',
      area: null,
      bio: null,
      vibe: null,
      rating: 0,
      meetupCount: 0,
      avatarUrl: null,
      updatedAt: now,
    },
    settings: null,
    verification: null,
    subscriptions: [],
    _count: {
      hostedEvents: 0,
      eventParticipants: 0,
      reportsReceived: 0,
    },
    ...overrides,
  };
}

describe('AdminUsersService unit', () => {
  it('passes search and exact filters to the list query', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = createService({
      user: { findMany },
    });

    await service.listUsers({
      q: ' anna ',
      city: 'Москва',
      status: 'active',
      verified: 'true',
      plan: 'plus',
      createdFrom: '2026-01-01T00:00:00.000Z',
      createdTo: '2026-05-01T00:00:00.000Z',
      limit: '10',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 11,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(
      expect.arrayContaining([
        {
          OR: [
            { displayName: { contains: 'anna', mode: 'insensitive' } },
            { email: { contains: 'anna', mode: 'insensitive' } },
            { phoneNumber: { contains: 'anna', mode: 'insensitive' } },
          ],
        },
        { profile: { is: { city: 'Москва' } } },
        { status: 'active' },
        { verified: true },
        expect.objectContaining({
          subscriptions: expect.objectContaining({
            some: expect.objectContaining({
              status: { in: ['active', 'trial', 'canceled'] },
            }),
          }),
        }),
        {
          createdAt: {
            gte: new Date('2026-01-01T00:00:00.000Z'),
            lte: new Date('2026-05-01T00:00:00.000Z'),
          },
        },
      ]),
    );
  });

  it('throws not found for missing detail user', async () => {
    const service = createService({
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      session: { count: jest.fn().mockResolvedValue(0) },
      userReport: { count: jest.fn().mockResolvedValue(0) },
    });

    await expect(service.getUser('missing')).rejects.toMatchObject({
      statusCode: 404,
      code: 'admin_user_not_found',
    });
  });

  it('rejects duplicate email during profile update', async () => {
    const tx = jest.fn();
    const service = createService({
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
        findFirst: jest.fn().mockResolvedValue({ id: 'user-2' }),
      },
      $transaction: tx,
    });

    await expect(
      service.updateProfile('user-1', { email: ' Taken@Example.com ' }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'admin_user_email_exists',
    });
    expect(tx).not.toHaveBeenCalled();
  });

  it('sets suspended status and reason', async () => {
    const userUpdate = jest.fn().mockResolvedValue({ id: 'user-1' });
    const sessionUpdateMany = jest.fn().mockResolvedValue({ count: 2 });
    const userFindUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: 'user-1' })
      .mockResolvedValueOnce(
        detailRow({
          status: 'suspended',
          suspendedAt: now,
          suspensionReason: 'spam',
        }),
      );
    const service = createService({
      user: {
        findUnique: userFindUnique,
        update: userUpdate,
      },
      session: {
        updateMany: sessionUpdateMany,
        count: jest.fn().mockResolvedValue(1),
      },
      userReport: { count: jest.fn().mockResolvedValue(0) },
    });

    const result = await service.suspendUser('user-1', { reason: ' spam ' });

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        status: 'suspended',
        suspendedAt: expect.any(Date),
        suspensionReason: 'spam',
      },
    });
    expect(sessionUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
    expect(result.status).toBe('suspended');
    expect(result.suspensionReason).toBe('spam');
  });

  it('clears suspension fields during unsuspend', async () => {
    const userUpdate = jest.fn().mockResolvedValue({ id: 'user-1' });
    const userFindUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: 'user-1' })
      .mockResolvedValueOnce(detailRow());
    const service = createService({
      user: {
        findUnique: userFindUnique,
        update: userUpdate,
      },
      session: { count: jest.fn().mockResolvedValue(1) },
      userReport: { count: jest.fn().mockResolvedValue(0) },
    });

    const result = await service.unsuspendUser('user-1');

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        status: 'active',
        suspendedAt: null,
        suspensionReason: null,
      },
    });
    expect(result.status).toBe('active');
    expect(result.suspensionReason).toBeNull();
  });

  it('notifies Drops rewards after admin verification', async () => {
    const userFindUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: 'user-1' })
      .mockResolvedValueOnce(detailRow({ verified: true }));
    const tx = {
      user: {
        update: jest.fn(),
      },
      userVerification: {
        upsert: jest.fn(),
      },
    };
    const dropsRewardService = {
      handleUserVerified: jest.fn().mockResolvedValue({}),
    };
    const service = createService(
      {
        user: { findUnique: userFindUnique },
        session: { count: jest.fn().mockResolvedValue(1) },
        userReport: { count: jest.fn().mockResolvedValue(0) },
        $transaction: jest.fn((callback) => callback(tx)),
      },
      dropsRewardService,
    );

    await service.verifyUser('user-1');

    expect(dropsRewardService.handleUserVerified).toHaveBeenCalledWith('user-1');
  });

  it('returns fresh user detail after delegating manual verification approval', async () => {
    const userFindUnique = jest
      .fn()
      .mockResolvedValueOnce(detailRow({ verified: true }));
    const verificationService = {
      approveVerification: jest.fn().mockResolvedValue({
        status: 'verified',
      }),
    };
    const service = createService(
      {
        user: { findUnique: userFindUnique },
        session: { count: jest.fn().mockResolvedValue(1) },
        userReport: { count: jest.fn().mockResolvedValue(0) },
      },
      undefined,
      verificationService,
    );

    const result = await service.verifyUser('user-1');

    expect(verificationService.approveVerification).toHaveBeenCalledWith('user-1');
    expect(result.id).toBe('user-1');
    expect(result.verified).toBe(true);
  });

  it('revokes only active sessions', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const service = createService({
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }) },
      session: { updateMany },
    });

    const result = await service.revokeSessions('user-1');

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
    expect(result).toEqual({ revokedCount: 2 });
  });

  it('grants Frendly+ for a manual number of days', async () => {
    const currentRenewal = new Date('2026-06-10T10:00:00.000Z');
    const subscriptionUpdate = jest.fn().mockResolvedValue({});
    const userFindUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: 'user-1' })
      .mockResolvedValueOnce(detailRow({
        subscriptions: [{
          id: 'sub-1',
          plan: 'month',
          status: 'active',
          startedAt: now,
          renewsAt: new Date('2026-06-09T10:00:00.000Z'),
          trialEndsAt: null,
        }],
      }));
    const service = createService({
      user: { findUnique: userFindUnique },
      userSubscription: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'sub-1',
          plan: 'month',
          status: 'active',
          startedAt: now,
          renewsAt: currentRenewal,
          trialEndsAt: null,
        }),
        update: subscriptionUpdate,
      },
      session: { count: jest.fn().mockResolvedValue(0) },
      userReport: { count: jest.fn().mockResolvedValue(0) },
    });

    const result = await service.grantFrendlyPlus('user-1', { days: 30 });

    expect(subscriptionUpdate).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: {
        plan: 'month',
        status: 'active',
        renewsAt: expect.any(Date),
        trialEndsAt: null,
      },
    });
    expect(result.plan).toBe('plus');
  });

  it('revokes active Frendly+ subscriptions', async () => {
    const subscriptionUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const userFindUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: 'user-1' })
      .mockResolvedValueOnce(detailRow());
    const service = createService({
      user: { findUnique: userFindUnique },
      userSubscription: { updateMany: subscriptionUpdateMany },
      session: { count: jest.fn().mockResolvedValue(0) },
      userReport: { count: jest.fn().mockResolvedValue(0) },
    });

    const result = await service.revokeFrendlyPlus('user-1');

    expect(subscriptionUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: { in: ['active', 'trial', 'canceled'] },
      },
      data: {
        status: 'inactive',
        renewsAt: expect.any(Date),
        trialEndsAt: null,
      },
    });
    expect(result.plan).toBe('free');
  });
});
