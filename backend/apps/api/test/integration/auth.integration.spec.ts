import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { ApiAppModule } from '../../src/app.module';
import { PrismaService } from '../../src/services/prisma.service';

jest.setTimeout(30000);

describe('auth flows', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let phoneCounter = 0;

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

  const nextPhoneNumber = () => `+7999${String(++phoneCounter).padStart(7, '0')}`;

  const requestPhoneCode = async (phoneNumber = nextPhoneNumber()) => {
    const response = await request(app.getHttpServer())
      .post('/auth/phone/request')
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

  afterEach(() => {
    process.env.ENABLE_DEV_AUTH = 'true';
    process.env.ENABLE_DEV_OTP = 'true';
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

  it('requests phone otp with local code hint only in dev otp mode', async () => {
    const firstRequest = await requestPhoneCode();
    const secondRequest = await requestPhoneCode(firstRequest.phoneNumber);

    expect(firstRequest.body.challengeId).toEqual(expect.any(String));
    expect(firstRequest.body.maskedPhone).toContain('***');
    expect(firstRequest.body.resendAfterSeconds).toBe(42);
    expect(firstRequest.body.localCodeHint).toMatch(/^\d{4}$/);
    expect(secondRequest.body.challengeId).not.toBe(firstRequest.body.challengeId);
    expect(secondRequest.body.localCodeHint).toMatch(/^\d{4}$/);
  });

  it('returns phone auth unavailable when dev otp mode is disabled', async () => {
    process.env.ENABLE_DEV_OTP = 'false';

    const response = await request(app.getHttpServer())
      .post('/auth/phone/request')
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
    });

    expect(createdUser?.id).toBe(freshVerifyResponse.body.userId);
    expect(createdUser?.displayName).toMatch(/^Пользователь /);
  });

  it('rejects wrong otp code', async () => {
    const challengeResponse = await requestPhoneCode();
    const response = await verifyPhoneCode(challengeResponse.body.challengeId, '0000');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('invalid_otp_code');
  });

  it('invalidates otp challenge after wrong code attempt', async () => {
    const challengeResponse = await requestPhoneCode();

    const wrongResponse = await verifyPhoneCode(challengeResponse.body.challengeId, '0000');
    expect(wrongResponse.status).toBe(400);
    expect(wrongResponse.body.code).toBe('invalid_otp_code');

    const retryResponse = await verifyPhoneCode(
      challengeResponse.body.challengeId,
      challengeResponse.body.localCodeHint,
    );
    expect(retryResponse.status).toBe(400);
    expect(retryResponse.body.code).toBe('invalid_otp_challenge');
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
