import { mapBasicProfile } from '../../src/common/presenters';

describe('profile onboarding completion presenter', () => {
  it('returns onboardingComplete from persisted onboarding completion', () => {
    const profile = mapBasicProfile({
      id: 'user-1',
      displayName: 'Алекс',
      verified: false,
      online: false,
      subscriptions: [],
      onboarding: {
        completedAt: new Date('2026-05-19T10:00:00.000Z'),
      },
      profile: null,
    });

    expect(profile).toMatchObject({
      id: 'user-1',
      onboardingComplete: true,
    });
  });
});
