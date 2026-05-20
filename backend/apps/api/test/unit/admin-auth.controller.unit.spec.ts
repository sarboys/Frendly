import { AdminAuthController } from '../../src/controllers/admin-auth.controller';

describe('AdminAuthController unit', () => {
  it('sets admin auth cookies for one day', async () => {
    const controller = new AdminAuthController({
      login: jest.fn().mockResolvedValue({
        admin: {
          id: 'admin-1',
          email: 'root@frendly.tech',
          displayName: 'Root',
          role: 'owner',
        },
        tokens: {
          accessToken: 'admin-access-token',
          refreshToken: 'admin-refresh-token',
        },
      }),
    } as any);
    const response = {
      cookie: jest.fn(),
    };

    await controller.login({ email: 'root@frendly.tech', password: 'secret' }, response as any);

    expect(response.cookie).toHaveBeenNthCalledWith(
      1,
      'frendly_admin_access',
      'admin-access-token',
      expect.objectContaining({ maxAge: 24 * 60 * 60 * 1000 }),
    );
    expect(response.cookie).toHaveBeenNthCalledWith(
      2,
      'frendly_admin_refresh',
      'admin-refresh-token',
      expect.objectContaining({ maxAge: 24 * 60 * 60 * 1000 }),
    );
  });
});
