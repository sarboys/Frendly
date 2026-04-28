import { SubscriptionService } from '../../src/services/subscription.service';

describe('SubscriptionService unit', () => {
  it('loads only fields needed for the current subscription response', async () => {
    const subscription = {
      plan: 'month',
      status: 'active',
      startedAt: new Date('2026-04-28T00:00:00.000Z'),
      renewsAt: new Date('2026-05-28T00:00:00.000Z'),
      trialEndsAt: null,
    };
    const findFirst = jest.fn().mockResolvedValue(subscription);
    const service = new SubscriptionService({
      client: {
        userSubscription: {
          findFirst,
        },
      },
    } as any);

    await expect(service.getCurrent('user-me')).resolves.toEqual({
      plan: 'month',
      status: 'active',
      startedAt: '2026-04-28T00:00:00.000Z',
      renewsAt: '2026-05-28T00:00:00.000Z',
      trialEndsAt: null,
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-me' },
      orderBy: { createdAt: 'desc' },
      select: {
        plan: true,
        status: true,
        startedAt: true,
        renewsAt: true,
        trialEndsAt: true,
      },
    });
  });

  it('returns matching active subscription without reading it again', async () => {
    const subscription = {
      plan: 'month',
      status: 'active',
      startedAt: new Date('2026-04-28T00:00:00.000Z'),
      renewsAt: new Date('2026-05-28T00:00:00.000Z'),
      trialEndsAt: null,
    };
    const findFirst = jest.fn().mockResolvedValue(subscription);
    const create = jest.fn();
    const service = new SubscriptionService({
      client: {
        userSubscription: {
          findFirst,
          create,
        },
      },
    } as any);

    await expect(
      service.subscribe('user-me', {
        plan: 'month',
      }),
    ).resolves.toEqual({
      plan: 'month',
      status: 'active',
      startedAt: '2026-04-28T00:00:00.000Z',
      renewsAt: '2026-05-28T00:00:00.000Z',
      trialEndsAt: null,
    });
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });
});
