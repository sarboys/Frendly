import { SettingsService } from '../../src/services/settings.service';

describe('SettingsService unit', () => {
  const originalTestingAccess = process.env.ENABLE_TESTING_ACCESS;
  const settingsRow = {
    allowLocation: false,
    allowPush: true,
    allowContacts: false,
    autoSharePlans: false,
    hideExactLocation: true,
    quietHours: false,
    showAge: true,
    discoverable: true,
    darkMode: false,
  };

  afterEach(() => {
    if (originalTestingAccess == null) {
      delete process.env.ENABLE_TESTING_ACCESS;
    } else {
      process.env.ENABLE_TESTING_ACCESS = originalTestingAccess;
    }
  });

  it('loads only response fields for current settings', async () => {
    const upsert = jest.fn().mockResolvedValue(settingsRow);
    const service = new SettingsService({
      client: {
        userSettings: {
          upsert,
        },
      },
    } as any);

    await expect(service.getSettings('user-me')).resolves.toEqual(settingsRow);
    expect(upsert).toHaveBeenCalledWith({
      where: { userId: 'user-me' },
      update: {},
      create: {
        userId: 'user-me',
      },
      select: {
        allowLocation: true,
        allowPush: true,
        allowContacts: true,
        autoSharePlans: true,
        hideExactLocation: true,
        quietHours: true,
        showAge: true,
        discoverable: true,
        darkMode: true,
      },
    });
  });

  it('returns only response fields after updating settings', async () => {
    const upsert = jest.fn().mockResolvedValue(settingsRow);
    const service = new SettingsService({
      client: {
        userSettings: {
          upsert,
        },
      },
    } as any);

    await expect(
      service.updateSettings('user-me', {
        allowPush: true,
      }),
    ).resolves.toEqual(settingsRow);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-me' },
        select: {
          allowLocation: true,
          allowPush: true,
          allowContacts: true,
          autoSharePlans: true,
          hideExactLocation: true,
          quietHours: true,
          showAge: true,
          discoverable: true,
          darkMode: true,
        },
      }),
    );
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
