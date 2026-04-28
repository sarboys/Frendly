import { AuthService } from '../../src/services/auth.service';

describe('AuthService unit', () => {
  it('loads only user and profile fields needed by getMe', async () => {
    const userFindUnique = jest.fn().mockResolvedValue({
      id: 'user-me',
      displayName: 'User Me',
      verified: true,
      online: false,
      profile: {
        city: 'Москва',
        area: 'Покровка',
      },
    });
    const service = new AuthService(
      {
        client: {
          user: {
            findUnique: userFindUnique,
          },
        },
      } as any,
      {} as any,
    );

    await expect(service.getMe('user-me')).resolves.toEqual({
      id: 'user-me',
      displayName: 'User Me',
      verified: true,
      online: false,
      city: 'Москва',
      area: 'Покровка',
    });
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-me' },
      select: {
        id: true,
        displayName: true,
        verified: true,
        online: true,
        profile: {
          select: {
            area: true,
            city: true,
          },
        },
      },
    });
  });

  it('starts existing phone user lookup while OTP delivery is still loading', async () => {
    let resolveDelivery!: (value: { provider: 'webhook'; localCodeHint: null }) => void;
    const deliver = jest.fn(
      () =>
        new Promise<{ provider: 'webhook'; localCodeHint: null }>((resolve) => {
          resolveDelivery = resolve;
        }),
    );
    const userFindUnique = jest.fn().mockResolvedValue({ id: 'user-existing' });
    const challengeCreate = jest.fn().mockResolvedValue({ id: 'challenge-1' });
    const auditCreate = jest.fn().mockResolvedValue({});
    const client = {
      phoneOtpChallenge: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: challengeCreate,
      },
      user: {
        findUnique: userFindUnique,
      },
      authAuditEvent: {
        create: auditCreate,
      },
    };
    const phoneOtpService = {
      hashRequestKey: jest.fn().mockReturnValue(null),
      createPayload: jest.fn().mockReturnValue({
        code: '1234',
        codeHash: 'code-hash',
        codeSalt: 'code-salt',
        expiresAt: new Date(Date.now() + 60_000),
      }),
      deliver,
    };
    const service = new AuthService({ client } as any, phoneOtpService as any);

    const resultPromise = service.requestPhoneCode('+7 999 000 00 00', {
      requestId: 'req-1',
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(deliver).toHaveBeenCalledTimes(1);
    expect(userFindUnique).toHaveBeenCalledTimes(1);
    expect(challengeCreate).not.toHaveBeenCalled();

    resolveDelivery({ provider: 'webhook', localCodeHint: null });

    await expect(resultPromise).resolves.toMatchObject({
      challengeId: 'challenge-1',
    });
    expect(challengeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-existing',
          phoneNumber: '+79990000000',
        }),
      }),
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: 'phone_otp',
          kind: 'start',
          result: 'issued',
          requestId: 'req-1',
          userId: 'user-existing',
        }),
      }),
    );
  });
});
