import { signAccessToken } from '@big-break/database';
import { lastValueFrom, of } from 'rxjs';
import { AdminAuditInterceptor } from '../../src/common/admin-audit.interceptor';
import { AuthGuard } from '../../src/common/auth.guard';

describe('Admin security unit', () => {
  it('records admin audit event with method, path, status and admin id', async () => {
    const create = jest.fn().mockResolvedValue({});
    const interceptor = new AdminAuditInterceptor({
      client: { adminAuditEvent: { create } },
    } as any);
    const request = {
      method: 'POST',
      route: { path: '/admin/users/:userId/suspend' },
      path: '/admin/users/user-1/suspend',
      originalUrl: '/admin/users/user-1/suspend',
      url: '/admin/users/user-1/suspend',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('vitest-agent'),
      context: {
        adminUserId: 'admin-1',
        adminSessionId: 'admin-session-1',
        requestId: 'request-1',
        adminAuthMode: 'cookie',
      },
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ statusCode: 201 }),
      }),
    } as any;

    await lastValueFrom(interceptor.intercept(context, { handle: () => of({ ok: true }) } as any));

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: 'admin-1',
        sessionId: 'admin-session-1',
        action: 'POST /admin/users/:userId/suspend',
        method: 'POST',
        path: '/admin/users/user-1/suspend',
        statusCode: 201,
        requestId: 'request-1',
      }),
    });
  });

  it('rejects suspended users on protected API requests', async () => {
    const token = signAccessToken('user-1', 'session-1');
    const guard = new AuthGuard(
      { getAllAndOverride: jest.fn().mockReturnValue(false) } as any,
      {
        client: {
          session: {
            findUnique: jest.fn().mockResolvedValue({
              userId: 'user-1',
              revokedAt: null,
              user: { status: 'suspended' },
            }),
          },
        },
      } as any,
    );

    await expect(guard.canActivate(contextWithBearer(token))).rejects.toMatchObject({
      statusCode: 403,
      code: 'user_suspended',
    });
  });

  it('caches active API sessions for repeated protected requests', async () => {
    const token = signAccessToken('user-1', 'session-1');
    const cache = new Map<string, unknown>();
    const findUnique = jest.fn().mockResolvedValue({
      userId: 'user-1',
      revokedAt: null,
      user: { status: 'active' },
    });
    const redisCache = {
      getJson: jest.fn(async (key: string) => cache.get(key) ?? null),
      setJson: jest.fn(async (key: string, value: unknown) => {
        cache.set(key, value);
      }),
    };
    const guard = new AuthGuard(
      { getAllAndOverride: jest.fn().mockReturnValue(false) } as any,
      {
        client: {
          session: {
            findUnique,
          },
        },
      } as any,
      redisCache as any,
    );

    await expect(guard.canActivate(contextWithBearer(token))).resolves.toBe(true);
    await expect(guard.canActivate(contextWithBearer(token))).resolves.toBe(true);

    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(redisCache.getJson).toHaveBeenCalledTimes(1);
    expect(redisCache.setJson).toHaveBeenCalledTimes(1);
  });
});

function contextWithBearer(token: string) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { authorization: `Bearer ${token}` },
        context: { requestId: 'request-1' },
      }),
    }),
  } as any;
}
