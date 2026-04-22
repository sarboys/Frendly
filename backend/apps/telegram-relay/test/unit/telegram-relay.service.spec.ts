import { TelegramRelayService } from '../../src/telegram-relay.service';

function telegramOk(result: unknown) {
  return Promise.resolve({
    ok: true,
    json: async () => ({
      ok: true,
      result,
    }),
  });
}

function backendOk(actions: unknown[]) {
  return Promise.resolve({
    ok: true,
    json: async () => ({
      actions,
    }),
  });
}

describe('telegram relay service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      TELEGRAM_AUTH_ENABLED: 'true',
      TELEGRAM_BOT_TOKEN: 'bot-token',
      TELEGRAM_BOT_USERNAME: 'frendly_code_bot',
      TELEGRAM_BACKEND_URL: 'http://backend.internal',
      TELEGRAM_INTERNAL_SECRET: 'shared-secret',
      TELEGRAM_POLL_INTERVAL_MS: '1500',
      TELEGRAM_RELAY_STATE_PATH: '/tmp/telegram-relay-state-test.json',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('calls deleteWebhook on start', async () => {
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() => telegramOk(true))
      .mockImplementationOnce(() => telegramOk([]));
    const service = new TelegramRelayService();
    service.setFetchImpl(fetchMock as any);

    await service.start();
    await service.onModuleDestroy();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/deleteWebhook'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('dispatches start update to backend', async () => {
    const fetchMock = jest.fn((url: string) => {
      if (url.includes('/deleteWebhook')) {
        return telegramOk(true);
      }
      if (url.includes('/getUpdates')) {
        return telegramOk([
          {
            update_id: 10,
            message: {
              message_id: 1,
              text: '/start login_start-token',
              chat: { id: 44, type: 'private' },
              from: {
                id: 55,
                is_bot: false,
                username: 'linked',
                first_name: 'Lena',
              },
            },
          },
        ]);
      }
      if (url.includes('/internal/telegram/dispatch')) {
        return backendOk([]);
      }
      return telegramOk(true);
    });

    const service = new TelegramRelayService();
    service.setFetchImpl(fetchMock as any);

    await service.pollOnce();

    const backendCall = fetchMock.mock.calls.find(([url]) =>
      `${url}`.includes('/internal/telegram/dispatch'),
    ) as [string, RequestInit] | undefined;
    expect(backendCall?.[1]?.headers).toEqual(
      expect.objectContaining({
        'x-telegram-internal-secret': 'shared-secret',
      }),
    );
    expect(String(backendCall?.[1]?.body)).toContain('"kind":"start"');
    expect(String(backendCall?.[1]?.body)).toContain('"startToken":"start-token"');
  });

  it('dispatches contact update to backend', async () => {
    const fetchMock = jest.fn((url: string) => {
      if (url.includes('/deleteWebhook')) {
        return telegramOk(true);
      }
      if (url.includes('/getUpdates')) {
        return telegramOk([
          {
            update_id: 11,
            message: {
              message_id: 2,
              chat: { id: 44, type: 'private' },
              from: {
                id: 55,
                is_bot: false,
                first_name: 'Lena',
              },
              contact: {
                user_id: 55,
                phone_number: '9991234567',
              },
            },
          },
        ]);
      }
      if (url.includes('/internal/telegram/dispatch')) {
        return backendOk([]);
      }
      return telegramOk(true);
    });

    const service = new TelegramRelayService();
    service.setFetchImpl(fetchMock as any);

    await service.pollOnce();

    const backendCall = fetchMock.mock.calls.find(([url]) =>
      `${url}`.includes('/internal/telegram/dispatch'),
    ) as [string, RequestInit] | undefined;
    expect(String(backendCall?.[1]?.body)).toContain('"kind":"contact"');
    expect(String(backendCall?.[1]?.body)).toContain('"phoneNumber":"9991234567"');
  });

  it('executes send_message actions through Telegram API', async () => {
    const fetchMock = jest.fn((url: string) => {
      if (url.includes('/deleteWebhook')) {
        return telegramOk(true);
      }
      if (url.includes('/getUpdates')) {
        return telegramOk([
          {
            update_id: 12,
            message: {
              message_id: 3,
              text: '/start',
              chat: { id: 44, type: 'private' },
              from: {
                id: 55,
                is_bot: false,
                first_name: 'Lena',
              },
            },
          },
        ]);
      }
      if (url.includes('/internal/telegram/dispatch')) {
        return backendOk([
          {
            type: 'send_message',
            text: 'Код для входа: 1234',
            replyMarkup: {
              remove_keyboard: true,
            },
          },
        ]);
      }
      return telegramOk(true);
    });

    const service = new TelegramRelayService();
    service.setFetchImpl(fetchMock as any);

    await service.pollOnce();

    const sendMessageCall = fetchMock.mock.calls.find(([url]) =>
      `${url}`.includes('/sendMessage'),
    ) as [string, RequestInit] | undefined;
    expect(String(sendMessageCall?.[1]?.body)).toContain('Код для входа: 1234');
    expect(String(sendMessageCall?.[1]?.body)).toContain('"remove_keyboard":true');
  });
});
