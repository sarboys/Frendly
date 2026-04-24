import { OnboardingService } from '../../src/services/onboarding.service';

describe('OnboardingService unit', () => {
  it('stores birth date and updates profile age from onboarding', async () => {
    const birthDate = new Date('2000-04-24T00:00:00.000Z');
    const onboardingUpsert = jest.fn().mockResolvedValue({
      intent: 'dating',
      gender: 'female',
      birthDate,
      city: 'Москва',
      area: 'Покровка',
      interests: ['Кофе', 'Кино'],
      vibe: 'calm',
    });
    const profileUpsert = jest.fn().mockResolvedValue({});
    const client = {
      $transaction: jest.fn((callback: any) =>
        callback({
          onboardingPreferences: {
            upsert: onboardingUpsert,
          },
          profile: {
            upsert: profileUpsert,
          },
        }),
      ),
    };
    const service = new OnboardingService({ client } as any);

    const result = await service.updateOnboarding('user-me', {
      intent: 'dating',
      gender: 'female',
      birthDate: '2000-04-24',
      city: 'Москва',
      area: 'Покровка',
      interests: ['Кофе', 'Кино'],
      vibe: 'calm',
    });

    expect(result).toMatchObject({
      birthDate: '2000-04-24',
    });
    expect(profileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          birthDate,
          age: expect.any(Number),
        }),
        create: expect.objectContaining({
          birthDate,
          age: expect.any(Number),
        }),
      }),
    );
  });
});
