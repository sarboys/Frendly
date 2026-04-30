import { AdminTokenGuard } from '../../src/common/admin-token.guard';
import { signAdminAccessToken } from '@big-break/database';

describe('AdminTokenGuard unit', () => {
  const originalToken = process.env.ADMIN_API_TOKEN;

  afterEach(() => {
    if (originalToken == null) {
      delete process.env.ADMIN_API_TOKEN;
    } else {
      process.env.ADMIN_API_TOKEN = originalToken;
    }
  });

  it('rejects a request without an admin token header or cookie', async () => {
    process.env.ADMIN_API_TOKEN = 'secret-token';
    const guard = new AdminTokenGuard({ client: {} } as any);

    await expect(guard.canActivate(contextWithHeaders({}))).rejects.toMatchObject(
      expect.objectContaining({
        statusCode: 403,
        code: 'admin_forbidden',
      }),
    );
  });

  it('rejects a request with the wrong admin token', async () => {
    process.env.ADMIN_API_TOKEN = 'secret-token';
    const guard = new AdminTokenGuard({ client: {} } as any);

    await expect(
      guard.canActivate(contextWithHeaders({ 'x-admin-token': 'wrong-token' })),
    ).rejects.toMatchObject(
      expect.objectContaining({
        statusCode: 403,
        code: 'admin_forbidden',
      }),
    );
  });

  it('accepts a request with the configured legacy admin token', async () => {
    process.env.ADMIN_API_TOKEN = 'secret-token';
    const guard = new AdminTokenGuard({ client: {} } as any);

    await expect(
      guard.canActivate(contextWithHeaders({ 'x-admin-token': 'secret-token' })),
    ).resolves.toBe(true);
  });

  it('accepts an admin access token from an httpOnly cookie', async () => {
    const token = signAdminAccessToken('admin-1', 'admin-session-1');
    const guard = new AdminTokenGuard({
      client: {
        adminSession: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'admin-session-1',
            adminUserId: 'admin-1',
            revokedAt: null,
            adminUser: { status: 'active' },
          }),
        },
      },
    } as any);
    const request = {
      headers: {
        cookie: `frendly_admin_access=${token}`,
      },
      context: { requestId: 'request-1' },
    };

    await expect(guard.canActivate(contextWithRequest(request))).resolves.toBe(true);
    expect(request.context).toMatchObject({
      adminUserId: 'admin-1',
      adminSessionId: 'admin-session-1',
    });
  });
});

function contextWithHeaders(headers: Record<string, string>) {
  return contextWithRequest({
    headers,
    context: { requestId: 'request-1' },
  });
}

function contextWithRequest(request: any) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any;
}
