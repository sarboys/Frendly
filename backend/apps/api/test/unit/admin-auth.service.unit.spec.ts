import { verifyAdminRefreshToken } from '@big-break/database';
import { AdminAuthService } from '../../src/services/admin-auth.service';

describe('AdminAuthService unit', () => {
  it('logs in an active admin and creates a session', async () => {
    const sessionCreate = jest.fn().mockResolvedValue({
      id: 'admin-session-1',
      refreshTokenId: 'refresh-1',
    });
    const adminUpdate = jest.fn().mockResolvedValue({ id: 'admin-1' });
    const service = new AdminAuthService({
      client: {
        adminUser: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'admin-1',
            email: 'root@frendly.tech',
            displayName: 'Root',
            role: 'owner',
            status: 'active',
            passwordHash: await AdminAuthService.hashPasswordForTest('strong-password'),
          }),
          update: adminUpdate,
        },
        adminSession: {
          create: sessionCreate,
        },
      },
    } as any);

    const result = await service.login({
      email: ' ROOT@FRENDLY.TECH ',
      password: 'strong-password',
    });

    expect(sessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: 'admin-1',
      }),
    });
    expect(adminUpdate).toHaveBeenCalledWith({
      where: { id: 'admin-1' },
      data: { lastLoginAt: expect.any(Date) },
    });
    expect(result.admin).toEqual({
      id: 'admin-1',
      email: 'root@frendly.tech',
      displayName: 'Root',
      role: 'owner',
    });
    expect(result.tokens.accessToken).toEqual(expect.any(String));
    expect(result.tokens.refreshToken).toEqual(expect.any(String));
  });

  it('rejects a suspended admin before creating a session', async () => {
    const sessionCreate = jest.fn();
    const service = new AdminAuthService({
      client: {
        adminUser: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'admin-1',
            email: 'root@frendly.tech',
            displayName: 'Root',
            role: 'owner',
            status: 'suspended',
            passwordHash: await AdminAuthService.hashPasswordForTest('strong-password'),
          }),
        },
        adminSession: {
          create: sessionCreate,
        },
      },
    } as any);

    await expect(
      service.login({ email: 'root@frendly.tech', password: 'strong-password' }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'admin_suspended',
    });
    expect(sessionCreate).not.toHaveBeenCalled();
  });

  it('rotates admin refresh tokens', async () => {
    const tokens = await new AdminAuthService({
      client: {
        adminSession: {
          create: jest.fn().mockResolvedValue({
            id: 'admin-session-1',
            refreshTokenId: 'refresh-old',
          }),
        },
      },
    } as any).createTokenPairForTest('admin-1');
    const oldRefreshId = verifyAdminRefreshToken(tokens.refreshToken).refreshTokenId;
    const sessionUpdate = jest.fn().mockResolvedValue({
      id: 'admin-session-1',
      adminUserId: 'admin-1',
      refreshTokenId: 'refresh-new',
      revokedAt: null,
      adminUser: {
        id: 'admin-1',
        email: 'root@frendly.tech',
        displayName: 'Root',
        role: 'owner',
        status: 'active',
      },
    });
    const service = new AdminAuthService({
      client: {
        adminSession: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'admin-session-1',
            adminUserId: 'admin-1',
            refreshTokenId: oldRefreshId,
            revokedAt: null,
            adminUser: {
              id: 'admin-1',
              email: 'root@frendly.tech',
              displayName: 'Root',
              role: 'owner',
              status: 'active',
            },
          }),
          update: sessionUpdate,
        },
      },
    } as any);

    const result = await service.refresh(tokens.refreshToken);
    const newRefreshId = verifyAdminRefreshToken(result.tokens.refreshToken).refreshTokenId;

    expect(newRefreshId).not.toBe(oldRefreshId);
    expect(sessionUpdate).toHaveBeenCalledWith({
      where: { id: 'admin-session-1' },
      data: {
        refreshTokenId: expect.any(String),
        lastUsedAt: expect.any(Date),
      },
      include: {
        adminUser: true,
      },
    });
  });
});
