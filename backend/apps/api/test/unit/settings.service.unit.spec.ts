import { SettingsService } from '../../src/services/settings.service';

describe('SettingsService unit', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalTestingAccess = process.env.ENABLE_TESTING_ACCESS;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalTestingAccess == null) {
      delete process.env.ENABLE_TESTING_ACCESS;
    } else {
      process.env.ENABLE_TESTING_ACCESS = originalTestingAccess;
    }
  });

  it('allows testing access in non-production without an env flag', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.ENABLE_TESTING_ACCESS;

    const client = {
      $transaction: jest.fn(async (callback: any) =>
        callback({
          userSubscription: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            create: jest.fn().mockResolvedValue({}),
          },
          userSettings: {
            upsert: jest.fn().mockResolvedValue({}),
          },
        }),
      ),
    };
    const service = new SettingsService({ client } as any);

    await expect(
      service.updateTestingAccess('user-me', {
        frendlyPlusEnabled: true,
        afterDarkEnabled: false,
      }),
    ).resolves.toMatchObject({
      frendlyPlusEnabled: true,
      afterDarkEnabled: false,
    });
  });
});
