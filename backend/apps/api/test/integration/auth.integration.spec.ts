import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiAppModule } from '../../src/app.module';

jest.setTimeout(30000);

describe('auth dev login', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ApiAppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns access and refresh token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({})
      .expect(201);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
  });

  it('requests and verifies phone otp in local mode', async () => {
    const requestResponse = await request(app.getHttpServer())
      .post('/auth/phone/request')
      .send({ phoneNumber: '+7 999 123 45 67' })
      .expect(201);

    expect(requestResponse.body.challengeId).toEqual(expect.any(String));
    expect(requestResponse.body.localCodeHint).toBe('1111');

    const verifyResponse = await request(app.getHttpServer())
      .post('/auth/phone/verify')
      .send({
        challengeId: requestResponse.body.challengeId,
        code: '1111',
      })
      .expect(201);

    expect(verifyResponse.body.userId).toEqual(expect.any(String));
    expect(verifyResponse.body.accessToken).toEqual(expect.any(String));
    expect(verifyResponse.body.refreshToken).toEqual(expect.any(String));
  });
});
