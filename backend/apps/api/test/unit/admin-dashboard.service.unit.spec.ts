import { AdminDashboardService } from '../../src/services/admin-dashboard.service';

const now = new Date('2026-05-23T09:00:00.000Z');
const future = new Date('2026-05-23T09:05:00.000Z');
const past = new Date('2026-05-23T08:59:00.000Z');

function createService(client: Record<string, unknown>) {
  return new AdminDashboardService({ client } as any, () => now);
}

function liveClient(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    event: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    userReport: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    paymentOrder: {
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amountKopecks: 0 } }),
    },
    userVerification: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    session: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    adminDashboardSnapshot: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
    },
    ...overrides,
  };
}

describe('AdminDashboardService unit', () => {
  it('uses a fresh analytics snapshot without recomputing counters', async () => {
    const payload = {
      stats: {
        users: { value: 10, delta: 0, series: [10] },
        active7d: { value: 4, delta: 0, series: [4] },
        meetups7d: { value: 2, delta: 0, series: [2] },
        revenue30d: { value: 1000, delta: 0, series: [1000] },
        openReports: { value: 1, delta: 0, series: [1] },
        plusConversion: { value: 20, delta: 0, series: [20] },
      },
      computedAt: now.toISOString(),
      expiresAt: future.toISOString(),
    };
    const client = liveClient({
      adminDashboardSnapshot: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'main',
          payload,
          expiresAt: future,
        }),
        upsert: jest.fn(),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn(),
      },
    });
    const service = createService(client);

    const result = await service.getDashboard();

    expect(result.stats.users.value).toBe(10);
    expect((client.user as any).count).not.toHaveBeenCalled();
    expect((client.adminDashboardSnapshot as any).upsert).not.toHaveBeenCalled();
  });

  it('recomputes and stores stale analytics snapshots', async () => {
    const client = liveClient({
      adminDashboardSnapshot: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'main',
          payload: {},
          expiresAt: past,
        }),
        upsert: jest.fn().mockImplementation(({ update }) => ({
          id: 'main',
          ...update,
        })),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest
          .fn()
          .mockResolvedValueOnce(10)
          .mockResolvedValueOnce(2),
      },
      session: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'user-1' },
          { userId: 'user-2' },
          { userId: 'user-1' },
        ]),
      },
      event: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(3),
      },
      userReport: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(1),
      },
      paymentOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amountKopecks: 250000 } }),
      },
    });
    const service = createService(client);

    const result = await service.getDashboard();

    expect(result.stats.users.value).toBe(10);
    expect(result.stats.active7d.value).toBe(2);
    expect(result.stats.meetups7d.value).toBe(3);
    expect(result.stats.revenue30d.value).toBe(2500);
    expect(result.stats.openReports.value).toBe(1);
    expect(result.stats.plusConversion.value).toBe(20);
    expect((client.adminDashboardSnapshot as any).upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'main' },
        update: expect.objectContaining({
          expiresAt: new Date('2026-05-23T09:05:00.000Z'),
        }),
      }),
    );
  });

  it('returns recent activity sorted by creation time', async () => {
    const client = liveClient({
      user: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: 'user-1',
              displayName: 'Анна',
              email: null,
              phoneNumber: null,
              status: 'active',
              verified: false,
              createdAt: new Date('2026-05-23T08:00:00.000Z'),
              updatedAt: now,
              profile: null,
              subscriptions: [],
              _count: { hostedEvents: 0, eventParticipants: 0, reportsReceived: 0 },
            },
          ])
          .mockResolvedValueOnce([]),
      },
      event: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            { id: 'event-1', title: 'Завтрак', createdAt: new Date('2026-05-23T08:30:00.000Z') },
          ]),
      },
      userReport: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'report-1',
            reason: 'spam',
            createdAt: new Date('2026-05-23T08:45:00.000Z'),
            targetUser: { id: 'user-2', displayName: 'Илья' },
          },
        ]),
      },
      adminDashboardSnapshot: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
    });
    const service = createService(client);

    const result = await service.getDashboard();

    expect(result.recentActivity.map((item) => item.type).slice(0, 3)).toEqual([
      'report_created',
      'meetup_created',
      'user_registered',
    ]);
  });
});
