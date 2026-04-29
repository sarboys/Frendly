import { AdminTokenGuard } from '../../src/common/admin-token.guard';

describe('AdminTokenGuard unit', () => {
  const originalToken = process.env.ADMIN_API_TOKEN;

  afterEach(() => {
    if (originalToken == null) {
      delete process.env.ADMIN_API_TOKEN;
    } else {
      process.env.ADMIN_API_TOKEN = originalToken;
    }
  });

  it('rejects a request without an admin token header', () => {
    process.env.ADMIN_API_TOKEN = 'secret-token';
    const guard = new AdminTokenGuard();

    expect(() => guard.canActivate(contextWithToken(undefined))).toThrow(
      expect.objectContaining({
        statusCode: 403,
        code: 'admin_forbidden',
      }),
    );
  });

  it('rejects a request with the wrong admin token', () => {
    process.env.ADMIN_API_TOKEN = 'secret-token';
    const guard = new AdminTokenGuard();

    expect(() => guard.canActivate(contextWithToken('wrong-token'))).toThrow(
      expect.objectContaining({
        statusCode: 403,
        code: 'admin_forbidden',
      }),
    );
  });

  it('accepts a request with the configured admin token', () => {
    process.env.ADMIN_API_TOKEN = 'secret-token';
    const guard = new AdminTokenGuard();

    expect(guard.canActivate(contextWithToken('secret-token'))).toBe(true);
  });
});

function contextWithToken(token: string | undefined) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: token == null ? {} : { 'x-admin-token': token },
      }),
    }),
  } as any;
}
