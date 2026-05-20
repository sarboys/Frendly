import {
  signAccessToken,
  signAdminAccessToken,
  signAdminRefreshToken,
  verifyAccessToken,
  verifyAdminAccessToken,
  verifyAdminRefreshToken,
} from '../../src/auth-tokens';

describe('auth token TTLs', () => {
  const originalJwtAccessTtl = process.env.JWT_ACCESS_TTL;
  const originalAdminJwtAccessTtl = process.env.ADMIN_JWT_ACCESS_TTL;
  const originalAdminJwtRefreshTtl = process.env.ADMIN_JWT_REFRESH_TTL;

  afterEach(() => {
    restoreEnv('JWT_ACCESS_TTL', originalJwtAccessTtl);
    restoreEnv('ADMIN_JWT_ACCESS_TTL', originalAdminJwtAccessTtl);
    restoreEnv('ADMIN_JWT_REFRESH_TTL', originalAdminJwtRefreshTtl);
  });

  it('keeps regular access TTL separate from one-day admin TTL', () => {
    process.env.JWT_ACCESS_TTL = '5m';
    delete process.env.ADMIN_JWT_ACCESS_TTL;

    const userPayload = verifyAccessToken(signAccessToken('user-1', 'session-1'));
    const adminPayload = verifyAdminAccessToken(signAdminAccessToken('admin-1', 'admin-session-1'));

    expect(tokenLifetimeSeconds(userPayload)).toBe(5 * 60);
    expect(tokenLifetimeSeconds(adminPayload)).toBe(24 * 60 * 60);
  });

  it('uses one day for admin refresh tokens by default', () => {
    delete process.env.ADMIN_JWT_REFRESH_TTL;

    const payload = verifyAdminRefreshToken(
      signAdminRefreshToken('admin-1', 'admin-session-1', 'refresh-1'),
    );

    expect(tokenLifetimeSeconds(payload)).toBe(24 * 60 * 60);
  });
});

function tokenLifetimeSeconds(payload: { iat?: number; exp?: number }) {
  expect(payload.iat).toEqual(expect.any(Number));
  expect(payload.exp).toEqual(expect.any(Number));
  return payload.exp! - payload.iat!;
}

function restoreEnv(key: string, value: string | undefined) {
  if (value == null) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
