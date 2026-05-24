import { SupportService } from '../../src/services/support.service';

describe('SupportService unit', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      TELEGRAM_AUTH_ENABLED: 'true',
      TELEGRAM_BOT_USERNAME: 'frendly_support_bot',
      TELEGRAM_SUPPORT_GROUP_CHAT_ID: '-100123',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('creates a short support link without exposing the user id', async () => {
    const create = jest.fn().mockResolvedValue({});
    const service = new SupportService({
      client: {
        telegramSupportToken: {
          create,
        },
      },
    } as any);

    const response = await service.startTelegramSupport('user-1');

    expect(response.botUrl).toMatch(/^https:\/\/t\.me\/frendly_support_bot\?start=support_/);
    expect(response.botUrl).not.toContain('user-1');
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
  });

  it('links telegram chat to the user when support start token is valid', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const upsert = jest.fn().mockResolvedValue({});
    const service = new SupportService({
      client: {
        telegramSupportToken: {
          findUnique: jest.fn().mockResolvedValue({
            tokenHash: 'hash-1',
            userId: 'user-1',
            expiresAt: new Date(Date.now() + 60_000),
            consumedAt: null,
          }),
          updateMany,
        },
        telegramSupportSession: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          upsert,
        },
      },
    } as any);

    const actions = await service.handleTelegramDispatch({
      kind: 'support_start',
      telegramUserId: 'tg-1',
      chatId: 'chat-1',
      username: 'lena',
      firstName: 'Lena',
      startPayload: 'support_token-1',
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: expect.any(String),
        consumedAt: null,
        expiresAt: {
          gt: expect.any(Date),
        },
      },
      data: { consumedAt: expect.any(Date) },
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        create: expect.objectContaining({
          userId: 'user-1',
          telegramUserId: 'tg-1',
          chatId: 'chat-1',
        }),
      }),
    );
    expect(actions).toEqual([
      expect.objectContaining({
        type: 'send_message',
        text: 'Напишите вопрос, мы ответим здесь.',
      }),
    ]);
  });

  it('forwards a user support message to the configured support group', async () => {
    const service = new SupportService({
      client: {
        telegramSupportSession: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'session-1',
            userId: 'user-1',
            telegramUserId: 'tg-1',
            chatId: 'chat-1',
            user: {
              id: 'user-1',
              displayName: 'Лена',
              phoneNumber: '+79990000000',
              email: 'lena@example.com',
            },
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      },
    } as any);

    const actions = await service.handleTelegramDispatch({
      kind: 'support_message',
      telegramUserId: 'tg-1',
      chatId: 'chat-1',
      text: 'Не открывается встреча',
    });

    expect(actions).toEqual([
      expect.objectContaining({
        type: 'send_message',
        chatId: '-100123',
        text: expect.stringContaining('Не открывается встреча'),
      }),
    ]);
    expect(actions[0]!.text).toContain('User ID: user-1');
    expect(actions[0]!.text).toContain('Лена');
  });

  it('routes operator reply from support group back to the user telegram chat', async () => {
    const service = new SupportService({
      client: {
        telegramSupportSession: {
          findFirst: jest.fn().mockResolvedValue({
            userId: 'user-1',
            chatId: 'chat-1',
            status: 'active',
          }),
        },
      },
    } as any);

    const actions = await service.handleTelegramDispatch({
      kind: 'support_reply',
      telegramUserId: 'operator-1',
      chatId: '-100123',
      text: 'Попробуйте обновить экран',
      replyToText: 'Frendly support\nUser ID: user-1\nMessage: Не открывается встреча',
    });

    expect(actions).toEqual([
      {
        type: 'send_message',
        chatId: 'chat-1',
        text: 'Попробуйте обновить экран',
      },
    ]);
  });
});
