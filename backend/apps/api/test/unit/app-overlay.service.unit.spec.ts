import { AppOverlayService } from '../../src/services/app-overlay.service';

const now = new Date('2026-05-23T10:00:00.000Z');

function createService(client: Record<string, unknown>) {
  return new AppOverlayService({ client } as any);
}

function activeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    verified: true,
    profile: { city: 'Москва' },
    subscriptions: [],
    ...overrides,
  };
}

function activeCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: 'campaign-1',
    internalName: 'Промо Frendly+',
    status: 'active',
    title: 'Попробуйте Frendly+',
    body: 'Откройте больше возможностей.',
    dismissible: true,
    priority: 10,
    buttonEnabled: true,
    buttonLabel: 'Открыть Frendly+',
    buttonAction: 'app_route',
    buttonValue: '/paywall',
    audienceKind: 'all',
    platform: null,
    minBuild: null,
    maxBuild: null,
    frendlyPlus: 'any',
    verified: 'any',
    cityNames: [],
    targetUsers: [],
    stats: {
      impressionCount: 3,
      ctaClickCount: 1,
      dismissCount: 1,
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('AppOverlayService unit', () => {
  it('returns blocking version policy overlay for unsupported build', async () => {
    const service = createService({
      user: { findUnique: jest.fn().mockResolvedValue(activeUser()) },
      appVersionPolicy: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'policy-ios',
          platform: 'ios',
          enabled: true,
          minSupportedBuild: 42,
          latestBuild: 50,
          storeUrl: 'https://apps.apple.com/app/frendly',
          title: 'Обновите Frendly',
          body: 'Эта версия больше не поддерживается.',
          buttonLabel: 'Обновить',
        }),
      },
      appPopupCampaign: {
        findMany: jest.fn().mockResolvedValue([activeCampaign()]),
      },
    });

    await expect(
      service.resolveOverlay('user-1', { platform: 'ios', buildNumber: 41 }),
    ).resolves.toEqual({
      overlay: {
        id: 'policy-ios',
        source: 'version_policy',
        kind: 'force_update',
        title: 'Обновите Frendly',
        body: 'Эта версия больше не поддерживается.',
        dismissible: false,
        cta: {
          label: 'Обновить',
          action: 'store_update',
          value: 'https://apps.apple.com/app/frendly',
        },
      },
      checkAfterSeconds: 300,
    });
  });

  it('returns no overlay for a supported build when no campaigns match', async () => {
    const service = createService({
      user: { findUnique: jest.fn().mockResolvedValue(activeUser()) },
      appVersionPolicy: {
        findUnique: jest.fn().mockResolvedValue({
          platform: 'android',
          enabled: true,
          minSupportedBuild: 42,
        }),
      },
      appPopupCampaign: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    await expect(
      service.resolveOverlay('user-1', { platform: 'android', buildNumber: 42 }),
    ).resolves.toEqual({
      overlay: null,
      checkAfterSeconds: 300,
    });
  });

  it('chooses the highest priority matching campaign', async () => {
    const service = createService({
      user: {
        findUnique: jest.fn().mockResolvedValue(
          activeUser({
            verified: false,
            profile: { city: 'Казань' },
            subscriptions: [
              {
                status: 'active',
                renewsAt: new Date('2026-06-01T00:00:00.000Z'),
                trialEndsAt: null,
              },
            ],
          }),
        ),
      },
      appVersionPolicy: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      appPopupCampaign: {
        findMany: jest.fn().mockResolvedValue([
          activeCampaign({
            id: 'low',
            priority: 5,
            title: 'Низкий приоритет',
          }),
          activeCampaign({
            id: 'best',
            priority: 50,
            title: 'Для Frendly+ в Казани',
            body: 'Специальный текст.',
            frendlyPlus: 'yes',
            verified: 'no',
            cityNames: ['Казань'],
            platform: 'android',
            minBuild: 30,
            maxBuild: 80,
            buttonEnabled: false,
          }),
          activeCampaign({
            id: 'wrong-city',
            priority: 90,
            cityNames: ['Москва'],
          }),
        ]),
      },
    });

    await expect(
      service.resolveOverlay('user-1', { platform: 'android', buildNumber: 60 }),
    ).resolves.toEqual({
      overlay: {
        id: 'best',
        source: 'campaign',
        kind: 'announcement',
        title: 'Для Frendly+ в Казани',
        body: 'Специальный текст.',
        dismissible: true,
        cta: null,
      },
      checkAfterSeconds: 300,
    });
  });

  it('matches selected users only when user id is listed', async () => {
    const service = createService({
      user: { findUnique: jest.fn().mockResolvedValue(activeUser()) },
      appVersionPolicy: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      appPopupCampaign: {
        findMany: jest.fn().mockResolvedValue([
          activeCampaign({
            id: 'selected',
            audienceKind: 'selected_users',
            targetUsers: [{ userId: 'user-2' }],
          }),
          activeCampaign({
            id: 'all',
            priority: 1,
            targetUsers: [],
          }),
        ]),
      },
    });

    await expect(
      service.resolveOverlay('user-1', { platform: 'ios', buildNumber: 10 }),
    ).resolves.toMatchObject({
      overlay: {
        id: 'all',
      },
    });
  });

  it('skips campaigns when platform, build, Frendly+, verified or city filters do not match', async () => {
    const service = createService({
      user: {
        findUnique: jest.fn().mockResolvedValue(
          activeUser({
            verified: true,
            profile: { city: 'Москва' },
            subscriptions: [
              {
                status: 'active',
                renewsAt: new Date('2026-06-01T00:00:00.000Z'),
                trialEndsAt: null,
              },
            ],
          }),
        ),
      },
      appVersionPolicy: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      appPopupCampaign: {
        findMany: jest.fn().mockResolvedValue([
          activeCampaign({ id: 'wrong-platform', priority: 100, platform: 'ios' }),
          activeCampaign({ id: 'too-new-build', priority: 90, minBuild: 100 }),
          activeCampaign({ id: 'too-old-build', priority: 80, maxBuild: 10 }),
          activeCampaign({ id: 'needs-no-plus', priority: 70, frendlyPlus: 'no' }),
          activeCampaign({ id: 'needs-unverified', priority: 60, verified: 'no' }),
          activeCampaign({ id: 'wrong-city', priority: 50, cityNames: ['Казань'] }),
          activeCampaign({ id: 'matched', priority: 1 }),
        ]),
      },
    });

    await expect(
      service.resolveOverlay('user-1', { platform: 'android', buildNumber: 50 }),
    ).resolves.toMatchObject({
      overlay: {
        id: 'matched',
      },
    });
  });

  it('increments aggregate counters for overlay events', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const service = createService({
      appPopupCampaignStats: { upsert },
    });

    await service.recordEvent('user-1', {
      overlayId: 'campaign-1',
      source: 'campaign',
      event: 'cta_click',
    });

    expect(upsert).toHaveBeenCalledWith({
      where: { campaignId: 'campaign-1' },
      create: {
        campaignId: 'campaign-1',
        impressionCount: 0,
        ctaClickCount: 1,
        dismissCount: 0,
      },
      update: {
        ctaClickCount: { increment: 1 },
      },
    });

    await service.recordEvent('user-1', {
      overlayId: 'campaign-1',
      source: 'campaign',
      event: 'impression',
    });

    await service.recordEvent('user-1', {
      overlayId: 'campaign-1',
      source: 'campaign',
      event: 'dismiss',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          impressionCount: { increment: 1 },
        },
      }),
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          dismissCount: { increment: 1 },
        },
      }),
    );
  });
});
