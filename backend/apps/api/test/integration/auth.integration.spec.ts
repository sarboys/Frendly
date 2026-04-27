import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { ApiAppModule } from '../../src/app.module';
import { PrismaService } from '../../src/services/prisma.service';

jest.setTimeout(30000);

describe('auth flows', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let phoneCounter = 0;
  let telegramCounter = 0;
  let otpRequestCounter = 0;
  const phoneSeed = Number(`${Date.now()}`.slice(-7));
  const telegramSeed = `${Date.now()}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ApiAppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = moduleRef.get(PrismaService).client;
  });

  afterAll(async () => {
    await app.close();
  });

  const nextPhoneNumber = () =>
    `+7999${String((phoneSeed + ++phoneCounter) % 10_000_000).padStart(7, '0')}`;
  const nextTelegramUserId = () => `tg-user-${telegramSeed}-${++telegramCounter}`;

  const hashTelegramCode = (code: string, salt: string) =>
    createHash('sha256').update(`${salt}:${code}`).digest('hex');

  const requestPhoneCode = async (phoneNumber = nextPhoneNumber()) => {
    const response = await request(app.getHttpServer())
      .post('/auth/phone/request')
      .set('user-agent', `jest-auth-${++otpRequestCounter}`)
      .send({ phoneNumber })
      .expect(201);

    return {
      phoneNumber,
      body: response.body,
    };
  };

  const verifyPhoneCode = async (challengeId: string, code: string) => {
    return request(app.getHttpServer())
      .post('/auth/phone/verify')
      .send({ challengeId, code });
  };

  const dispatchTelegram = async (body: Record<string, unknown>) => {
    return request(app.getHttpServer())
      .post('/internal/telegram/dispatch')
      .set('x-telegram-internal-secret', process.env.TELEGRAM_INTERNAL_SECRET ?? '')
      .send(body);
  };

  const loginWithPhone = async (phoneNumber = nextPhoneNumber()) => {
    const challengeResponse = await requestPhoneCode(phoneNumber);
    const verifyResponse = await verifyPhoneCode(
      challengeResponse.body.challengeId,
      challengeResponse.body.localCodeHint,
    );

    expect(verifyResponse.status).toBe(201);
    expect(verifyResponse.body.userId).toEqual(expect.any(String));
    expect(verifyResponse.body.accessToken).toEqual(expect.any(String));
    expect(verifyResponse.body.refreshToken).toEqual(expect.any(String));

    return verifyResponse.body as {
      userId: string;
      accessToken: string;
      refreshToken: string;
    };
  };

  const createTelegramLoginSession = async ({
    loginSessionId = `login-${randomUUID()}`,
    startToken = `start-${randomUUID()}`,
    telegramUserId = nextTelegramUserId(),
    chatId = `chat-${randomUUID()}`,
    phoneNumber = nextPhoneNumber(),
    code = '6543',
    status = 'code_issued',
    expiresAt = new Date(Date.now() + 10 * 60 * 1000),
    attemptCount = 0,
    consumedAt = null,
    lastCodeIssuedAt = new Date(),
  }: {
    loginSessionId?: string;
    startToken?: string;
    telegramUserId?: string;
    chatId?: string;
    phoneNumber?: string;
    code?: string;
    status?: string;
    expiresAt?: Date;
    attemptCount?: number;
    consumedAt?: Date | null;
    lastCodeIssuedAt?: Date;
  } = {}) => {
    const codeSalt = `salt-${randomUUID()}`;

    await (prisma as any).telegramLoginSession.create({
      data: {
        loginSessionId,
        startToken,
        status,
        telegramUserId,
        chatId,
        phoneNumber,
        codeSalt,
        codeHash: hashTelegramCode(code, codeSalt),
        codeLookup: createHash('sha256')
          .update(`telegram-code-lookup:${code}`)
          .digest('hex'),
        attemptCount,
        expiresAt,
        consumedAt,
        lastCodeIssuedAt,
      },
    });

    return {
      loginSessionId,
      startToken,
      telegramUserId,
      phoneNumber,
      chatId,
      code,
    };
  };

  afterEach(async () => {
    await (prisma as any).authAuditEvent.deleteMany();
    await (prisma as any).telegramLoginSession.deleteMany();
    await (prisma as any).telegramAccount.deleteMany();

    process.env.ENABLE_DEV_AUTH = 'true';
    process.env.ENABLE_DEV_OTP = 'true';
    process.env.ENABLE_TEST_PHONE_SHORTCUTS = 'true';
    process.env.TELEGRAM_AUTH_ENABLED = 'true';
    process.env.TELEGRAM_BOT_TOKEN = 'test-telegram-bot-token';
    process.env.TELEGRAM_BOT_USERNAME = 'frendly_auth_test_bot';
    process.env.TELEGRAM_POLL_INTERVAL_MS = '1500';
    process.env.TELEGRAM_INTERNAL_SECRET = 'test-internal-secret';
  });

  it('returns access and refresh token for dev login when dev auth is enabled', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({})
      .expect(201);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
  });

  it('rejects dev login when dev auth is disabled', async () => {
    process.env.ENABLE_DEV_AUTH = 'false';

    const response = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({ userId: 'user-me' });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('dev_auth_disabled');
  });

  it('logs into seeded shortcut phone without otp even when dev auth is disabled', async () => {
    process.env.ENABLE_DEV_AUTH = 'false';

    const response = await request(app.getHttpServer())
      .post('/auth/phone/test-login')
      .send({ phoneNumber: '+7 111 111 11 11' })
      .expect(201);

    expect(response.body.userId).toBe('user-me');
    expect(response.body.isNewUser).toBe(false);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
  });

  it('recreates missing test shortcut user and returns onboarding flow signal',
      async () => {
    process.env.ENABLE_DEV_AUTH = 'false';

    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: 'user-dima' },
          { phoneNumber: '+76666666666' },
        ],
      },
    });

    try {
      const response = await request(app.getHttpServer())
        .post('/auth/phone/test-login')
        .send({ phoneNumber: '+7 666 666 66 66' })
        .expect(201);

      expect(response.body.userId).toEqual(expect.any(String));
      expect(response.body.userId).not.toBe('user-dima');
      expect(response.body.isNewUser).toBe(true);
      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.refreshToken).toEqual(expect.any(String));

      const recreatedUser = await prisma.user.findUnique({
        where: { phoneNumber: '+76666666666' },
        include: {
          onboarding: true,
          profile: true,
          settings: true,
        },
      });

      expect(recreatedUser?.id).toBe(response.body.userId);
      expect(recreatedUser?.onboarding?.interests).toEqual([]);
      expect(recreatedUser?.profile?.city).toBeNull();
      expect(recreatedUser?.settings?.allowLocation).toBe(false);
    } finally {
      await prisma.user.deleteMany({
        where: { phoneNumber: '+76666666666' },
      });
    }
  });

  it('requests phone otp with local code hint only in dev otp mode', async () => {
    const firstRequest = await requestPhoneCode();
    const secondRequest = await requestPhoneCode(firstRequest.phoneNumber);

    expect(firstRequest.body.challengeId).toEqual(expect.any(String));
    expect(firstRequest.body.maskedPhone).toContain('***');
    expect(firstRequest.body.resendAfterSeconds).toBe(42);
    expect(firstRequest.body.localCodeHint).toMatch(/^\d{4}$/);
    expect(secondRequest.body.challengeId).toBe(firstRequest.body.challengeId);
    expect(secondRequest.body.resendAfterSeconds).toBeGreaterThan(0);
    expect(secondRequest.body.localCodeHint).toMatch(/^\d{4}$/);
  });

  it('returns phone auth unavailable when dev otp mode is disabled', async () => {
    process.env.ENABLE_DEV_OTP = 'false';

    const response = await request(app.getHttpServer())
      .post('/auth/phone/request')
      .set('user-agent', `jest-auth-${++otpRequestCounter}`)
      .send({ phoneNumber: nextPhoneNumber() });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('phone_auth_unavailable');
  });

  it('logs into existing seeded account by phone and creates a new user for unknown phone', async () => {
    const seededChallenge = await requestPhoneCode('+7 111 111 11 11');
    const seededVerifyResponse = await verifyPhoneCode(
      seededChallenge.body.challengeId,
      seededChallenge.body.localCodeHint,
    );

    expect(seededVerifyResponse.status).toBe(201);
    expect(seededVerifyResponse.body.userId).toBe('user-me');
    expect(seededVerifyResponse.body.isNewUser).toBe(false);

    const freshPhoneNumber =
      '+7998' +
      (Date.now() % 10000000).toString().padStart(7, '0');
    const freshChallenge = await requestPhoneCode(freshPhoneNumber);
    const freshVerifyResponse = await verifyPhoneCode(
      freshChallenge.body.challengeId,
      freshChallenge.body.localCodeHint,
    );

    expect(freshVerifyResponse.status).toBe(201);
    expect(freshVerifyResponse.body.userId).toEqual(expect.any(String));
    expect(freshVerifyResponse.body.userId).not.toBe('user-me');
    expect(freshVerifyResponse.body.isNewUser).toBe(true);

    const createdUser = await prisma.user.findUnique({
      where: { phoneNumber: freshPhoneNumber },
      include: {
        profile: true,
        onboarding: true,
        settings: true,
      },
    });

    expect(createdUser?.id).toBe(freshVerifyResponse.body.userId);
    expect(createdUser?.displayName).toMatch(/^Пользователь /);
    expect(createdUser?.profile?.city).toBeNull();
    expect(createdUser?.profile?.area).toBeNull();
    expect(createdUser?.onboarding?.city).toBeNull();
    expect(createdUser?.onboarding?.area).toBeNull();
    expect(createdUser?.onboarding?.intent).toBeNull();
    expect(createdUser?.onboarding?.vibe).toBeNull();
    expect(createdUser?.onboarding?.interests).toEqual([]);
    expect(createdUser?.settings?.allowLocation).toBe(false);
    expect(createdUser?.settings?.allowPush).toBe(false);
    expect(createdUser?.settings?.allowContacts).toBe(false);
  });

  it('rejects wrong otp code', async () => {
    const challengeResponse = await requestPhoneCode();
    const response = await verifyPhoneCode(challengeResponse.body.challengeId, '0000');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('invalid_otp_code');
  });

  it('allows otp retry after one wrong code attempt', async () => {
    const challengeResponse = await requestPhoneCode();

    const wrongResponse = await verifyPhoneCode(challengeResponse.body.challengeId, '0000');
    expect(wrongResponse.status).toBe(400);
    expect(wrongResponse.body.code).toBe('invalid_otp_code');

    const retryResponse = await verifyPhoneCode(
      challengeResponse.body.challengeId,
      challengeResponse.body.localCodeHint,
    );
    expect(retryResponse.status).toBe(201);
    expect(retryResponse.body.accessToken).toEqual(expect.any(String));
  });

  it('rejects expired otp challenge', async () => {
    const challengeResponse = await requestPhoneCode();

    await prisma.phoneOtpChallenge.update({
      where: { id: challengeResponse.body.challengeId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const response = await verifyPhoneCode(
      challengeResponse.body.challengeId,
      challengeResponse.body.localCodeHint,
    );

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('invalid_otp_challenge');
  });

  it('rejects reused otp challenge', async () => {
    const challengeResponse = await requestPhoneCode();

    const firstVerifyResponse = await verifyPhoneCode(
      challengeResponse.body.challengeId,
      challengeResponse.body.localCodeHint,
    );

    expect(firstVerifyResponse.status).toBe(201);

    const reusedResponse = await verifyPhoneCode(
      challengeResponse.body.challengeId,
      challengeResponse.body.localCodeHint,
    );

    expect(reusedResponse.status).toBe(400);
    expect(reusedResponse.body.code).toBe('invalid_otp_challenge');
  });

  it('starts telegram auth session and returns bot deep link', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/telegram/start')
      .send({})
      .expect(201);

    expect(response.body.loginSessionId).toEqual(expect.any(String));
    expect(response.body.botUrl).toMatch(
      /^https:\/\/t\.me\/frendly_auth_test_bot\?start=login_/,
    );
    expect(response.body.codeLength).toBe(4);
    expect(Date.parse(response.body.expiresAt)).toBeGreaterThan(Date.now());

    const session = await (prisma as any).telegramLoginSession.findUnique({
      where: { loginSessionId: response.body.loginSessionId },
    });

    expect(session).toEqual(
      expect.objectContaining({
        loginSessionId: response.body.loginSessionId,
        status: 'pending_bot',
      }),
    );
  });

  it('dispatches contact prompt for first telegram start without linked account', async () => {
    const response = await dispatchTelegram({
      kind: 'start',
      telegramUserId: nextTelegramUserId(),
      chatId: `chat-${randomUUID()}`,
      firstName: 'Ира',
    });

    expect(response.status).toBe(201);

    expect(response.body.actions).toHaveLength(1);
    expect(response.body.actions[0]).toEqual(
      expect.objectContaining({
        type: 'send_message',
        text: expect.stringContaining('Поделись номером телефона'),
      }),
    );
  });

  it('dispatches login code for linked telegram user on plain start', async () => {
    const telegramUserId = nextTelegramUserId();
    await (prisma as any).telegramAccount.create({
      data: {
        userId: 'user-me',
        telegramUserId,
        chatId: `chat-${randomUUID()}`,
        username: 'linked_user',
        firstName: 'Лена',
      },
    });

    const response = await dispatchTelegram({
      kind: 'start',
      telegramUserId,
      chatId: `chat-${randomUUID()}`,
      firstName: 'Лена',
    });

    expect(response.status).toBe(201);

    expect(response.body.actions).toHaveLength(1);
    expect(response.body.actions[0].text).toMatch(/Код для входа: \d{4}/);
  });

  it('accepts telegram bot token as fallback internal secret', async () => {
    delete process.env.TELEGRAM_INTERNAL_SECRET;

    const response = await request(app.getHttpServer())
      .post('/internal/telegram/dispatch')
      .set('x-telegram-internal-secret', process.env.TELEGRAM_BOT_TOKEN!)
      .send({
        kind: 'start',
        telegramUserId: nextTelegramUserId(),
        chatId: `chat-${randomUUID()}`,
      });

    expect(response.status).toBe(201);
  });

  it('reuses active telegram session for the same start token', async () => {
    const startToken = `start-${randomUUID()}`;

    const firstResponse = await request(app.getHttpServer())
      .post('/auth/telegram/start')
      .send({ startToken })
      .expect(201);

    const secondResponse = await request(app.getHttpServer())
      .post('/auth/telegram/start')
      .send({ startToken })
      .expect(201);

    expect(secondResponse.body.loginSessionId).toBe(firstResponse.body.loginSessionId);
    expect(secondResponse.body.botUrl).toBe(firstResponse.body.botUrl);

    const sessions = await (prisma as any).telegramLoginSession.findMany({
      where: { startToken },
    });

    expect(sessions).toHaveLength(1);
  });

  it('returns worker-created telegram session for the same start token', async () => {
    const startToken = `start-${randomUUID()}`;
    const loginSessionId = `login-${randomUUID()}`;

    await (prisma as any).telegramLoginSession.create({
      data: {
        loginSessionId,
        startToken,
        status: 'awaiting_contact',
        telegramUserId: nextTelegramUserId(),
        chatId: `chat-${randomUUID()}`,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const response = await request(app.getHttpServer())
      .post('/auth/telegram/start')
      .send({ startToken })
      .expect(201);

    expect(response.body.loginSessionId).toBe(loginSessionId);
    expect(response.body.botUrl).toContain(`login_${startToken}`);
  });

  it('verifies telegram code after bot created the session before api start', async () => {
    const startToken = `start-${randomUUID()}`;
    const session = await createTelegramLoginSession({
      startToken,
      status: 'code_issued',
      telegramUserId: nextTelegramUserId(),
    });

    const startResponse = await request(app.getHttpServer())
      .post('/auth/telegram/start')
      .send({ startToken })
      .expect(201);

    expect(startResponse.body.loginSessionId).toBe(session.loginSessionId);

    const verifyResponse = await request(app.getHttpServer())
      .post('/auth/telegram/verify')
      .send({
        loginSessionId: session.loginSessionId,
        code: session.code,
      })
      .expect(201);

    expect(verifyResponse.body.userId).toEqual(expect.any(String));
    expect(verifyResponse.body.accessToken).toEqual(expect.any(String));
  });

  it('rejects telegram verify while contact is still missing', async () => {
    const startResponse = await request(app.getHttpServer())
      .post('/auth/telegram/start')
      .send({})
      .expect(201);

    const verifyResponse = await request(app.getHttpServer())
      .post('/auth/telegram/verify')
      .send({
        loginSessionId: startResponse.body.loginSessionId,
        code: '6543',
      });

    expect(verifyResponse.status).toBe(400);
    expect(verifyResponse.body.code).toBe('invalid_telegram_login_session');
  });

  it('rejects telegram code that does not match any active session', async () => {
    const session = await createTelegramLoginSession();

    const response = await request(app.getHttpServer())
      .post('/auth/telegram/verify')
      .send({
        loginSessionId: session.loginSessionId,
        code: '0000',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('invalid_telegram_code');
  });

  it('rejects expired telegram auth session', async () => {
    const session = await createTelegramLoginSession({
      expiresAt: new Date(Date.now() - 60_000),
    });

    const response = await request(app.getHttpServer())
      .post('/auth/telegram/verify')
      .send({
        loginSessionId: session.loginSessionId,
        code: session.code,
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('invalid_telegram_login_session');
  });

  it('logs into existing user by telegram phone and creates telegram link', async () => {
    const session = await createTelegramLoginSession({
      telegramUserId: nextTelegramUserId(),
      phoneNumber: '+71111111111',
    });

    const response = await request(app.getHttpServer())
      .post('/auth/telegram/verify')
      .send({
        loginSessionId: session.loginSessionId,
        code: session.code,
      })
      .expect(201);

    expect(response.body.userId).toBe('user-me');
    expect(response.body.isNewUser).toBe(false);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));

    const telegramAccount = await (prisma as any).telegramAccount.findUnique({
      where: { telegramUserId: session.telegramUserId },
    });

    expect(telegramAccount.userId).toBe('user-me');
  });

  it('creates a new user and telegram account for unknown phone', async () => {
    const session = await createTelegramLoginSession({
      telegramUserId: nextTelegramUserId(),
      phoneNumber: nextPhoneNumber(),
    });

    const response = await request(app.getHttpServer())
      .post('/auth/telegram/verify')
      .send({
        loginSessionId: session.loginSessionId,
        code: session.code,
      })
      .expect(201);

    expect(response.body.userId).toEqual(expect.any(String));
    expect(response.body.isNewUser).toBe(true);

    const createdUser = await prisma.user.findUnique({
      where: { phoneNumber: session.phoneNumber },
    });
    const telegramAccount = await (prisma as any).telegramAccount.findUnique({
      where: { telegramUserId: session.telegramUserId },
    });

    expect(createdUser?.id).toBe(response.body.userId);
    expect(telegramAccount.userId).toBe(response.body.userId);
  });

  it('fails closed when telegram id and phone resolve to different users', async () => {
    const telegramUserId = nextTelegramUserId();

    await (prisma as any).telegramAccount.create({
      data: {
        userId: 'user-anya',
        telegramUserId,
        chatId: `chat-${randomUUID()}`,
        username: 'anya_linked',
        firstName: 'Аня',
      },
    });

    const session = await createTelegramLoginSession({
      telegramUserId,
      phoneNumber: '+71111111111',
    });

    const response = await request(app.getHttpServer())
      .post('/auth/telegram/verify')
      .send({
        loginSessionId: session.loginSessionId,
        code: session.code,
      });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('telegram_auth_conflict');
  });

  it('writes telegram auth audit trail without raw secrets', async () => {
    const session = await createTelegramLoginSession({
      telegramUserId: nextTelegramUserId(),
      code: '8439',
    });

    const response = await request(app.getHttpServer())
      .post('/auth/telegram/verify')
      .set('user-agent', 'jest-telegram-auth')
      .send({
        loginSessionId: session.loginSessionId,
        code: session.code,
      })
      .expect(201);

    const auditEvents = await (prisma as any).authAuditEvent.findMany({
      where: { loginSessionId: session.loginSessionId },
      orderBy: { createdAt: 'asc' },
    });

    expect(auditEvents.length).toBeGreaterThan(0);
    expect(auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'telegram',
          loginSessionId: session.loginSessionId,
        }),
      ]),
    );

    const serialized = JSON.stringify(auditEvents);
    expect(serialized).not.toContain(session.code);
    expect(serialized).not.toContain(response.body.accessToken);
    expect(serialized).not.toContain(response.body.refreshToken);
    expect(serialized).not.toContain(process.env.TELEGRAM_BOT_TOKEN!);
  });

  it('verifies the selected telegram session when another session has the same code', async () => {
    const sharedCode = '1111';

    const selectedSession = await createTelegramLoginSession({
      loginSessionId: `login-${randomUUID()}`,
      telegramUserId: nextTelegramUserId(),
      phoneNumber: nextPhoneNumber(),
      code: sharedCode,
    });
    await createTelegramLoginSession({
      loginSessionId: `login-${randomUUID()}`,
      telegramUserId: nextTelegramUserId(),
      phoneNumber: nextPhoneNumber(),
      code: sharedCode,
    });

    const response = await request(app.getHttpServer())
      .post('/auth/telegram/verify')
      .send({
        loginSessionId: selectedSession.loginSessionId,
        code: sharedCode,
      })
      .expect(201);

    expect(response.body.userId).toEqual(expect.any(String));
    expect(response.body.accessToken).toEqual(expect.any(String));
  });

  it('refreshes session and returns a working access token', async () => {
    const session = await loginWithPhone();

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(201);

    const meResponse = await request(app.getHttpServer())
      .get('/me')
      .set('authorization', `Bearer ${refreshResponse.body.accessToken}`)
      .expect(200);

    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));
    expect(refreshResponse.body.refreshToken).toEqual(expect.any(String));
    expect(refreshResponse.body.refreshToken).not.toBe(session.refreshToken);
    expect(meResponse.body.id).toBe(session.userId);
  });

  it('rejects invalid refresh token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'not-a-real-refresh-token' });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('invalid_refresh_token');
  });

  it('rejects refresh for a revoked session', async () => {
    const session = await loginWithPhone();

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('authorization', `Bearer ${session.accessToken}`)
      .send({})
      .expect(201);

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken });

    expect(refreshResponse.status).toBe(401);
    expect(refreshResponse.body.code).toBe('invalid_refresh_token');
  });

  it('rejects stale access token after logout on me and profile endpoints', async () => {
    const session = await loginWithPhone();

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('authorization', `Bearer ${session.accessToken}`)
      .send({})
      .expect(201);

    const meResponse = await request(app.getHttpServer())
      .get('/me')
      .set('authorization', `Bearer ${session.accessToken}`);

    const profileResponse = await request(app.getHttpServer())
      .get('/profile/me')
      .set('authorization', `Bearer ${session.accessToken}`);

    expect(meResponse.status).toBe(401);
    expect(meResponse.body.code).toBe('stale_access_token');
    expect(profileResponse.status).toBe(401);
    expect(profileResponse.body.code).toBe('stale_access_token');
  });
});
