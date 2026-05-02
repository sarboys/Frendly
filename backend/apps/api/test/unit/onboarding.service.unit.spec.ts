import { OnboardingService } from '../../src/services/onboarding.service';

describe('OnboardingService unit', () => {
  it('starts onboarding lookup while session provider is still loading', async () => {
    let resolveSession!: (value: any) => void;
    const sessionFindUnique = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
    );
    const onboardingUpsert = jest.fn().mockResolvedValue({
      intent: 'dating',
      gender: 'female',
      birthDate: null,
      city: 'Москва',
      area: 'Покровка',
      interests: ['Кофе'],
      vibe: 'calm',
      user: {
        email: null,
        phoneNumber: '+79990000000',
      },
    });
    const client = {
      session: {
        findUnique: sessionFindUnique,
      },
      onboardingPreferences: {
        upsert: onboardingUpsert,
      },
    };
    const service = new OnboardingService({ client } as any);

    const resultPromise = service.getOnboarding('user-me', 'session-1');

    await new Promise((resolve) => setImmediate(resolve));

    expect(sessionFindUnique).toHaveBeenCalledTimes(1);
    expect(onboardingUpsert).toHaveBeenCalledTimes(1);

    resolveSession({ provider: 'telegram' });

    await expect(resultPromise).resolves.toMatchObject({
      requiredContact: 'email',
    });
  });

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
      user: {
        email: null,
        phoneNumber: null,
      },
    });
    const profileUpsert = jest.fn().mockResolvedValue({});
    const userFindUnique = jest.fn().mockResolvedValue({
      email: null,
      phoneNumber: null,
    });
    const userUpdate = jest.fn().mockResolvedValue({});
    const client = {
      session: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn((callback: any) =>
        callback({
          user: {
            findUnique: userFindUnique,
            update: userUpdate,
          },
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

    const result = await service.updateOnboarding(
      'user-me',
      undefined,
      {
        intent: 'dating',
        gender: 'female',
        birthDate: '2000-04-24',
        city: 'Москва',
        area: 'Покровка',
        interests: ['Кофе', 'Кино'],
        vibe: 'calm',
      },
    );

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

  it('rejects duplicate required email before onboarding save', async () => {
    const userFindFirst = jest.fn().mockResolvedValue({ id: 'other-user' });
    const client = {
      session: {
        findUnique: jest.fn().mockResolvedValue({ provider: 'phone_otp' }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          email: null,
          phoneNumber: '+79990000000',
        }),
        findFirst: userFindFirst,
      },
    };
    const service = new OnboardingService({ client } as any);

    await expect(
      service.checkContactAvailability('user-me', 'session-1', {
        email: 'Used@Example.COM',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'contact_already_used',
    });

    expect(userFindFirst).toHaveBeenCalledWith({
      where: {
        email: 'used@example.com',
        id: { not: 'user-me' },
      },
      select: { id: true },
    });
  });

  it('accepts free required phone before onboarding save', async () => {
    const userFindFirst = jest.fn().mockResolvedValue(null);
    const client = {
      session: {
        findUnique: jest.fn().mockResolvedValue({ provider: 'google' }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          email: 'social@example.com',
          phoneNumber: null,
        }),
        findFirst: userFindFirst,
      },
    };
    const service = new OnboardingService({ client } as any);

    await expect(
      service.checkContactAvailability('user-me', 'session-1', {
        phoneNumber: '8 999 000 00 00',
      }),
    ).resolves.toEqual({
      available: true,
      requiredContact: 'phone',
    });

    expect(userFindFirst).toHaveBeenCalledWith({
      where: {
        phoneNumber: '+79990000000',
        id: { not: 'user-me' },
      },
      select: { id: true },
    });
  });
});
