import {
  TELEGRAM_BOT_STATE_ID,
  deriveTelegramCodeFromSalt,
  hashTelegramCode,
  hashTelegramCodeLookup,
} from '@big-break/database';
import { TelegramBotPollingService } from '../../src/telegram-bot-polling.service';

type SessionRecord = {
  id: string;
  loginSessionId: string;
  startToken: string;
  status: string;
  telegramUserId: string | null;
  chatId: string | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber: string | null;
  codeSalt: string | null;
  codeHash: string | null;
  codeLookup?: string | null;
  attemptCount: number;
  expiresAt: Date;
  consumedAt: Date | null;
  lastCodeIssuedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type TelegramAccountRecord = {
  userId: string;
  telegramUserId: string;
  chatId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  user?: {
    id: string;
    phoneNumber: string | null;
  };
};

function telegramOk(result: unknown) {
  return Promise.resolve({
    ok: true,
    json: async () => ({
      ok: true,
      result,
    }),
  });
}

function buildPrismaMock(
  initialSessions: SessionRecord[] = [],
  lastUpdateId?: bigint | null,
  telegramAccounts: TelegramAccountRecord[] = [],
) {
  const sessions = new Map(initialSessions.map((session) => [session.id, { ...session }]));
  const state = {
    id: TELEGRAM_BOT_STATE_ID,
    lastUpdateId: lastUpdateId ?? null,
  };

  const prismaService = {
    client: {
      telegramBotState: {
        upsert: jest.fn(async () => state),
        findUnique: jest.fn(async () => state),
        update: jest.fn(async ({ data }: { data: { lastUpdateId?: bigint | null } }) => {
          state.lastUpdateId = data.lastUpdateId ?? null;
          return state;
        }),
      },
      telegramLoginSession: {
        findUnique: jest.fn(
          async ({
            where,
          }: {
            where: { startToken?: string; loginSessionId?: string };
          }) => {
            if (where.startToken) {
              return [...sessions.values()].find((item) => item.startToken === where.startToken) ?? null;
            }

            if (where.loginSessionId) {
              return [...sessions.values()].find((item) => item.loginSessionId === where.loginSessionId) ?? null;
            }

            return null;
          },
        ),
        findFirst: jest.fn(
          async ({
            where,
          }: {
            where: {
              codeLookup?: string;
              telegramUserId?: string;
              chatId?: string;
              consumedAt?: null;
              expiresAt?: { gt: Date };
              status?: { in: string[] };
              id?: { not?: string };
            };
          }) => {
            return (
              [...sessions.values()]
                .filter((item) => where.codeLookup == null || item.codeLookup === where.codeLookup)
                .filter((item) => where.telegramUserId == null || item.telegramUserId === where.telegramUserId)
                .filter((item) => where.chatId == null || item.chatId === where.chatId)
                .filter((item) => where.consumedAt !== null ? true : item.consumedAt == null)
                .filter((item) => where.expiresAt == null || item.expiresAt.getTime() > where.expiresAt.gt.getTime())
                .filter((item) => where.status?.in.includes(item.status) ?? true)
                .filter((item) => where.id?.not == null || item.id !== where.id?.not)
                .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0] ?? null
            );
          },
        ),
        create: jest.fn(
          async ({
            data,
          }: {
            data: Partial<SessionRecord>;
          }) => {
            const created = buildSession({
              ...data,
              id: data.id ?? `created-${sessions.size + 1}`,
              loginSessionId: data.loginSessionId ?? `login-${sessions.size + 1}`,
              startToken: data.startToken ?? `start-${sessions.size + 1}`,
              status: data.status ?? 'pending_bot',
            });
            sessions.set(created.id, created);
            return created;
          },
        ),
        update: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Partial<SessionRecord>;
          }) => {
            const session = sessions.get(where.id);
            if (!session) {
              throw new Error(`Missing session ${where.id}`);
            }
            Object.assign(session, data, { updatedAt: new Date() });
            sessions.set(where.id, session);
            return session;
          },
        ),
        updateMany: jest.fn(
          async ({
            where,
            data,
          }: {
            where: {
              id?: string;
              startToken?: string;
              status?: string;
              consumedAt?: null;
            };
            data: Partial<SessionRecord>;
          }) => {
            const matched = [...sessions.values()].filter((item) => {
              if (where.id && item.id !== where.id) {
                return false;
              }
              if (where.startToken && item.startToken !== where.startToken) {
                return false;
              }
              if (where.status && item.status !== where.status) {
                return false;
              }
              if (where.consumedAt === null && item.consumedAt != null) {
                return false;
              }
              return true;
            });

            for (const session of matched) {
              Object.assign(session, data, { updatedAt: new Date() });
              sessions.set(session.id, session);
            }

            return { count: matched.length };
          },
        ),
      },
      telegramAccount: {
        findUnique: jest.fn(
          async ({
            where,
          }: {
            where: { telegramUserId: string };
          }) => {
            return (
              telegramAccounts.find(
              (item) => item.telegramUserId === where.telegramUserId,
              ) ?? null
            );
          },
        ),
      },
    },
  } as any;

  return {
    prismaService,
    sessions,
    state,
  };
}

function buildSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  const now = new Date();
  return {
    id: overrides.id ?? 'session-1',
    loginSessionId: overrides.loginSessionId ?? 'login-1',
    startToken: overrides.startToken ?? 'start-1',
    status: overrides.status ?? 'pending_bot',
    telegramUserId: overrides.telegramUserId ?? null,
    chatId: overrides.chatId ?? null,
    username: overrides.username ?? null,
    firstName: overrides.firstName ?? null,
    lastName: overrides.lastName ?? null,
    phoneNumber: overrides.phoneNumber ?? null,
    codeSalt: overrides.codeSalt ?? null,
    codeHash: overrides.codeHash ?? null,
    codeLookup: (overrides as any).codeLookup ?? null,
    attemptCount: overrides.attemptCount ?? 0,
    expiresAt: overrides.expiresAt ?? new Date(now.getTime() + 10 * 60 * 1000),
    consumedAt: overrides.consumedAt ?? null,
    lastCodeIssuedAt: overrides.lastCodeIssuedAt ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

describe('telegram bot polling', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env = {
      ...originalEnv,
      TELEGRAM_AUTH_ENABLED: 'true',
      TELEGRAM_BOT_TOKEN: 'bot-token',
      TELEGRAM_BOT_USERNAME: 'frendly_auth_bot',
      TELEGRAM_POLL_INTERVAL_MS: '1500',
    };
  });

  afterEach(async () => {
    jest.useRealTimers();
    process.env = originalEnv;
  });

  it('calls deleteWebhook on start in polling mode', async () => {
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() => telegramOk(true))
      .mockImplementationOnce(() => telegramOk([]));
    const { prismaService } = buildPrismaMock();
    const service = new TelegramBotPollingService(prismaService);
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

  it('does not activate session for invalid start token', async () => {
    const session = buildSession({
      id: 'session-1',
      startToken: 'good-token',
      status: 'pending_bot',
    });
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() => telegramOk(true))
      .mockImplementationOnce(() =>
        telegramOk([
          {
            update_id: 1,
            message: {
              message_id: 1,
              text: '/start login_bad-token',
              chat: { id: 55, type: 'private' },
              from: { id: 77, is_bot: false, username: 'bad', first_name: 'Bad' },
            },
          },
        ]),
      )
      .mockImplementation(() => telegramOk(true));
    const { prismaService, sessions } = buildPrismaMock([session]);
    const service = new TelegramBotPollingService(prismaService);
    service.setFetchImpl(fetchMock as any);

    await service.pollOnce();

    expect(sessions.get('session-1')?.status).toBe('pending_bot');
  });

  it('creates stub session when bot gets start token before api start', async () => {
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() => telegramOk(true))
      .mockImplementationOnce(() =>
        telegramOk([
          {
            update_id: 1,
            message: {
              message_id: 10,
              text: '/start login_worker-first-token',
              chat: { id: 55, type: 'private' },
              from: {
                id: 77,
                is_bot: false,
                username: 'worker_first',
                first_name: 'Worker',
              },
            },
          },
        ]),
      )
      .mockImplementationOnce(() => telegramOk(true));
    const { prismaService, sessions } = buildPrismaMock();
    const service = new TelegramBotPollingService(prismaService);
    service.setFetchImpl(fetchMock as any);

    await service.pollOnce();

    const created = [...sessions.values()].find(
      (item) => item.startToken == 'worker-first-token',
    );
    expect(created).toBeDefined();
    expect(created?.status).toBe('awaiting_contact');
    expect(created?.telegramUserId).toBe('77');
    expect(created?.chatId).toBe('55');
  });

  it('sends explicit message for bad start token format', async () => {
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() => telegramOk(true))
      .mockImplementationOnce(() =>
        telegramOk([
          {
            update_id: 1,
            message: {
              message_id: 11,
              text: '/start wrong_payload',
              chat: { id: 55, type: 'private' },
              from: { id: 77, is_bot: false, first_name: 'Bad' },
            },
          },
        ]),
      )
      .mockImplementationOnce(() => telegramOk(true));
    const { prismaService } = buildPrismaMock();
    const service = new TelegramBotPollingService(prismaService);
    service.setFetchImpl(fetchMock as any);

    await service.pollOnce();

    const sendMessageCall = fetchMock.mock.calls.find(([url]) =>
      `${url}`.includes('/sendMessage'),
    );
    expect(sendMessageCall?.[1]?.body).toContain('начни вход заново');
  });

  it('sends explicit conflict message when another telegram user reuses the same start token', async () => {
    const session = buildSession({
      id: 'session-1',
      startToken: 'conflict-token',
      status: 'awaiting_contact',
      telegramUserId: '123',
      chatId: '10',
    });
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() => telegramOk(true))
      .mockImplementationOnce(() =>
        telegramOk([
          {
            update_id: 1,
            message: {
              message_id: 12,
              text: '/start login_conflict-token',
              chat: { id: 99, type: 'private' },
              from: { id: 999, is_bot: false, first_name: 'Conflict' },
            },
          },
        ]),
      )
      .mockImplementationOnce(() => telegramOk(true));
    const { prismaService, sessions } = buildPrismaMock([session]);
    const service = new TelegramBotPollingService(prismaService);
    service.setFetchImpl(fetchMock as any);

    await service.pollOnce();

    expect(sessions.get('session-1')?.chatId).toBe('10');
    const sendMessageCall = fetchMock.mock.calls.find(([url]) =>
      `${url}`.includes('/sendMessage'),
    );
    expect(sendMessageCall?.[1]?.body).toContain('другом аккаунте Telegram');
  });

  it('sends code immediately on plain start for linked telegram user', async () => {
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() => telegramOk(true))
      .mockImplementationOnce(() =>
        telegramOk([
          {
            update_id: 1,
            message: {
              message_id: 13,
              text: '/start',
              chat: { id: 77, type: 'private' },
              from: {
                id: 123,
                is_bot: false,
                username: 'linked',
                first_name: 'Linked',
              },
            },
          },
        ]),
      )
      .mockImplementationOnce(() => telegramOk(true));
    const linkedAccount = {
      userId: 'user-me',
      telegramUserId: '123',
      chatId: '77',
      user: {
        id: 'user-me',
        phoneNumber: '+79991234567',
      },
    };
    const { prismaService, sessions } = buildPrismaMock([], null, [linkedAccount]);
    const service = new TelegramBotPollingService(prismaService);
    service.setFetchImpl(fetchMock as any);

    await service.pollOnce();

    const created = [...sessions.values()][0];
    expect(created?.status).toBe('code_issued');
    expect(created?.phoneNumber).toBe('+79991234567');
    const sendMessageCall = fetchMock.mock.calls.find(([url]) =>
      `${url}`.includes('/sendMessage'),
    );
    expect(sendMessageCall?.[1]?.body).toContain('Код для входа');
  });

  it('requests contact on plain start for user without telegram link', async () => {
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() => telegramOk(true))
      .mockImplementationOnce(() =>
        telegramOk([
          {
            update_id: 1,
            message: {
              message_id: 14,
              text: '/start',
              chat: { id: 88, type: 'private' },
              from: {
                id: 456,
                is_bot: false,
                first_name: 'New',
              },
            },
          },
        ]),
      )
      .mockImplementationOnce(() => telegramOk(true));
    const { prismaService, sessions } = buildPrismaMock();
    const service = new TelegramBotPollingService(prismaService);
    service.setFetchImpl(fetchMock as any);

    await service.pollOnce();

    const created = [...sessions.values()][0];
    expect(created?.status).toBe('awaiting_contact');
    const sendMessageCall = fetchMock.mock.calls.find(([url]) =>
      `${url}`.includes('/sendMessage'),
    );
    expect(sendMessageCall?.[1]?.body).toContain('Поделись номером телефона');
  });

  it('ignores contact from another telegram user', async () => {
    const session = buildSession({
      id: 'session-1',
      status: 'awaiting_contact',
      telegramUserId: '123',
      chatId: '10',
    });
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() => telegramOk(true))
      .mockImplementationOnce(() =>
        telegramOk([
          {
            update_id: 1,
            message: {
              message_id: 2,
              chat: { id: 99, type: 'private' },
              from: { id: 999, is_bot: false, first_name: 'Other' },
              contact: {
                user_id: 999,
                phone_number: '9991234567',
              },
            },
          },
        ]),
      );
    const { prismaService, sessions } = buildPrismaMock([session]);
    const service = new TelegramBotPollingService(prismaService);
    service.setFetchImpl(fetchMock as any);

    await service.pollOnce();

    expect(sessions.get('session-1')?.status).toBe('awaiting_contact');
    expect(sessions.get('session-1')?.codeHash).toBeNull();
  });

  it('issues code after valid contact from the same user', async () => {
    const session = buildSession({
      id: 'session-1',
      status: 'awaiting_contact',
      telegramUserId: '123',
      chatId: '10',
    });
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() => telegramOk(true))
      .mockImplementationOnce(() =>
        telegramOk([
          {
            update_id: 1,
            message: {
              message_id: 3,
              chat: { id: 10, type: 'private' },
              from: { id: 123, is_bot: false, username: 'same', first_name: 'Same' },
              contact: {
                user_id: 123,
                phone_number: '9991234567',
              },
            },
          },
        ]),
      )
      .mockImplementationOnce(() => telegramOk(true));
    const { prismaService, sessions } = buildPrismaMock([session]);
    const service = new TelegramBotPollingService(prismaService);
    service.setFetchImpl(fetchMock as any);

    await service.pollOnce();

    const updated = sessions.get('session-1');
    expect(updated?.status).toBe('code_issued');
    expect(updated?.phoneNumber).toBe('+79991234567');
    expect(updated?.codeSalt).toEqual(expect.any(String));
    expect(updated?.codeHash).toEqual(expect.any(String));
    expect(updated?.lastCodeIssuedAt).toEqual(expect.any(Date));
  });

  it('reuses the same active code inside cooldown window', async () => {
    const codeSalt = 'reuse-salt';
    const expectedCode = deriveTelegramCodeFromSalt(codeSalt);
    const session = buildSession({
      id: 'session-1',
      status: 'code_issued',
      telegramUserId: '123',
      chatId: '10',
      phoneNumber: '+79991234567',
      codeSalt,
      codeHash: hashTelegramCode(expectedCode, codeSalt),
      codeLookup: hashTelegramCodeLookup(expectedCode),
      lastCodeIssuedAt: new Date(),
    });
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() => telegramOk(true))
      .mockImplementationOnce(() =>
        telegramOk([
          {
            update_id: 1,
            message: {
              message_id: 4,
              chat: { id: 10, type: 'private' },
              from: { id: 123, is_bot: false, first_name: 'Same' },
              contact: {
                user_id: 123,
                phone_number: '9991234567',
              },
            },
          },
        ]),
      )
      .mockImplementationOnce(() => telegramOk(true));
    const { prismaService, sessions } = buildPrismaMock([session]);
    const service = new TelegramBotPollingService(prismaService);
    service.setFetchImpl(fetchMock as any);

    await service.pollOnce();

    const updated = sessions.get('session-1');
    expect(updated?.codeSalt).toBe(codeSalt);
    expect(updated?.codeHash).toBe(hashTelegramCode(expectedCode, codeSalt));

    const sendMessageCall = fetchMock.mock.calls.find(([url]) =>
      `${url}`.includes('/sendMessage'),
    );
    expect(sendMessageCall?.[1]?.body).toContain(expectedCode);
  });

  it('persists last update offset across service restart', async () => {
    const fetchFirst = jest
      .fn()
      .mockImplementationOnce(() => telegramOk(true))
      .mockImplementationOnce(() => telegramOk([{ update_id: 105 }]));
    const shared = buildPrismaMock([], 101n);
    const firstService = new TelegramBotPollingService(
      shared.prismaService,
    );
    firstService.setFetchImpl(fetchFirst as any);

    await firstService.pollOnce();

    const firstGetUpdates = fetchFirst.mock.calls.find(([url]) =>
      `${url}`.includes('/getUpdates'),
    );
    expect(firstGetUpdates?.[1]?.body).toContain('"offset":102');
    expect(shared.state.lastUpdateId).toBe(105n);

    const fetchSecond = jest
      .fn()
      .mockImplementationOnce(() => telegramOk(true))
      .mockImplementationOnce(() => telegramOk([]));
    const secondService = new TelegramBotPollingService(
      shared.prismaService,
    );
    secondService.setFetchImpl(fetchSecond as any);

    await secondService.pollOnce();

    const secondGetUpdates = fetchSecond.mock.calls.find(([url]) =>
      `${url}`.includes('/getUpdates'),
    );
    expect(secondGetUpdates?.[1]?.body).toContain('"offset":106');
  });
});
