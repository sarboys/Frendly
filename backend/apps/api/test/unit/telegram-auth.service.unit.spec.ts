import { hashTelegramCode } from '@big-break/database';
import { TelegramAuthService } from '../../src/services/telegram-auth.service';

describe('TelegramAuthService unit', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.TELEGRAM_AUTH_ENABLED = 'true';
    process.env.TELEGRAM_BOT_USERNAME = 'frendly_test_bot';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('increments invalid code attempts atomically and closes the session on the last attempt', async () => {
    const codeSalt = 'telegram-code-salt';
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const auditCreate = jest.fn().mockResolvedValue({});
    const service = new TelegramAuthService(
      {
        client: {
          telegramLoginSession: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'row-1',
              loginSessionId: 'login-1',
              status: 'code_issued',
              telegramUserId: 'tg-1',
              chatId: 'chat-1',
              phoneNumber: '+79990000000',
              codeSalt,
              codeHash: hashTelegramCode('1234', codeSalt),
              codeLookup: 'lookup-1',
              attemptCount: 4,
              consumedAt: null,
              expiresAt: new Date(Date.now() + 60_000),
            }),
            updateMany,
          },
          authAuditEvent: {
            create: auditCreate,
          },
        },
      } as any,
      {} as any,
    );

    await expect(
      service.verify('login-1', '0000', {
        requestId: 'req-1',
      }),
    ).rejects.toMatchObject({
      statusCode: 429,
      code: 'telegram_auth_rate_limited',
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'row-1',
        status: 'code_issued',
        consumedAt: null,
      },
      data: expect.objectContaining({
        attemptCount: {
          increment: 1,
        },
        status: 'failed',
        consumedAt: expect.any(Date),
      }),
    });
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: 'telegram',
          kind: 'verify',
          result: 'rate_limited',
          requestId: 'req-1',
        }),
      }),
    );
  });
});
