import { SettingsService } from '../../src/services/settings.service';

describe('SettingsService unit', () => {
  const originalTestingAccess = process.env.ENABLE_TESTING_ACCESS;

  afterEach(() => {
    if (originalTestingAccess == null) {
      delete process.env.ENABLE_TESTING_ACCESS;
    } else {
      process.env.ENABLE_TESTING_ACCESS = originalTestingAccess;
    }
  });

  it('rejects testing access without an explicit env flag', async () => {
    delete process.env.ENABLE_TESTING_ACCESS;
    const service = new SettingsService({ client: {} } as any);

    await expect(
      service.updateTestingAccess('user-me', {
        frendlyPlusEnabled: true,
        afterDarkEnabled: false,
      }),
    ).rejects.toMatchObject({
      code: 'testing_access_disabled',
    });
  });

  it('allows testing access with an explicit env flag', async () => {
    process.env.ENABLE_TESTING_ACCESS = 'true';

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
