import { AdminUsersService } from '../../src/services/admin-users.service';

const now = new Date('2026-05-05T10:00:00.000Z');

function createService(client: Record<string, unknown>) {
  return new AdminUsersService({ client } as any);
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
      session: { count: jest.fn().mockResolvedValue(1) },
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
});
