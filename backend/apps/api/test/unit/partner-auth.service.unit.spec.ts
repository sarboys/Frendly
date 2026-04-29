import { verifyPartnerRefreshToken } from '@big-break/database';
import { PartnerAuthService } from '../../src/services/partner-auth.service';

describe('PartnerAuthService unit', () => {
  it('registers a pending partner account with normalized email and hashed password', async () => {
    const create = jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'account-1',
        ...data,
        partnerId: null,
        reviewNote: null,
        lastLoginAt: null,
        createdAt: new Date('2026-04-29T10:00:00.000Z'),
        updatedAt: new Date('2026-04-29T10:00:00.000Z'),
      }),
    );
    const service = new PartnerAuthService({
      client: {
        partnerAccount: {
          findUnique: jest.fn().mockResolvedValue(null),
          create,
        },
      },
    } as any);

    const result = await service.register({
      organizationName: '  Roof Group  ',
      taxId: ' 7707083893 ',
      city: ' Москва ',
      contactName: ' Анна ',
      phone: '+7 999 111-22-33',
      email: ' OWNER@ROOF.EXAMPLE ',
      password: 'strong-password',
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'owner@roof.example',
        status: 'pending',
        organizationName: 'Roof Group',
        taxId: '7707083893',
        city: 'Москва',
        contactName: 'Анна',
        phone: '+7 999 111-22-33',
      }),
    });
    expect(create.mock.calls[0][0].data.passwordHash).not.toBe('strong-password');
    expect(result).toMatchObject({
      account: {
        id: 'account-1',
        email: 'owner@roof.example',
        status: 'pending',
        partnerId: null,
      },
    });
  });

  it('rejects invalid tax id during registration', async () => {
    const service = new PartnerAuthService({ client: {} } as any);

    await expect(
      service.register({
        organizationName: 'Roof Group',
        taxId: '12345',
        city: 'Москва',
        contactName: 'Анна',
        phone: '+7 999 111-22-33',
        email: 'owner@roof.example',
        password: 'strong-password',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'partner_invalid_tax_id',
    });
  });

  it('rejects duplicate registration email', async () => {
    const service = new PartnerAuthService({
      client: {
        partnerAccount: {
          findUnique: jest.fn().mockResolvedValue({ id: 'existing-account' }),
        },
      },
    } as any);

    await expect(
      service.register({
        organizationName: 'Roof Group',
        taxId: '7707083893',
        city: 'Москва',
        contactName: 'Анна',
        phone: '+7 999 111-22-33',
        email: 'owner@roof.example',
        password: 'strong-password',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'partner_email_exists',
    });
  });

  it('logs in a pending account and returns its pending status', async () => {
    const sessionCreate = jest.fn().mockResolvedValue({
      id: 'partner-session-1',
      refreshTokenId: 'refresh-1',
    });
    const accountUpdate = jest.fn().mockImplementation(({ where }) =>
      Promise.resolve({ id: where.id }),
    );
    const service = new PartnerAuthService({
      client: {
        partnerAccount: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'account-1',
            email: 'owner@roof.example',
            status: 'pending',
            partnerId: null,
            organizationName: 'Roof Group',
            taxId: '7707083893',
            city: 'Москва',
            contactName: 'Анна',
            phone: '+7 999 111-22-33',
            role: 'owner',
            reviewNote: null,
            passwordHash: await PartnerAuthService.hashPasswordForTest('strong-password'),
          }),
          update: accountUpdate,
        },
        partnerSession: {
          create: sessionCreate,
        },
      },
    } as any);

    const result = await service.login({
      email: 'OWNER@ROOF.EXAMPLE',
      password: 'strong-password',
    });

    expect(sessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        partnerAccountId: 'account-1',
      }),
    });
    expect(accountUpdate).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      data: expect.objectContaining({
        lastLoginAt: expect.any(Date),
      }),
    });
    expect(result.account.status).toBe('pending');
    expect(result.tokens.accessToken).toEqual(expect.any(String));
    expect(result.tokens.refreshToken).toEqual(expect.any(String));
  });

  it('rotates partner refresh tokens', async () => {
    const refreshToken = await new PartnerAuthService({
      client: {
        partnerSession: {
          create: jest.fn().mockResolvedValue({
            id: 'partner-session-1',
            refreshTokenId: 'refresh-old',
          }),
        },
      },
    } as any).createTokenPairForTest('account-1');
    const oldRefreshId = verifyPartnerRefreshToken(refreshToken.refreshToken).refreshTokenId;
    const sessionUpdate = jest.fn().mockResolvedValue({
      id: 'partner-session-1',
      refreshTokenId: 'refresh-new',
      revokedAt: null,
      partnerAccountId: 'account-1',
      partnerAccount: {
        id: 'account-1',
        email: 'owner@roof.example',
        status: 'approved',
        partnerId: 'partner-1',
        organizationName: 'Roof Group',
        taxId: '7707083893',
        city: 'Москва',
        contactName: 'Анна',
        phone: '+7 999 111-22-33',
        role: 'owner',
        reviewNote: null,
      },
    });
    const service = new PartnerAuthService({
      client: {
        partnerSession: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'partner-session-1',
            partnerAccountId: 'account-1',
            refreshTokenId: oldRefreshId,
            revokedAt: null,
            partnerAccount: {
              id: 'account-1',
              email: 'owner@roof.example',
              status: 'approved',
              partnerId: 'partner-1',
              organizationName: 'Roof Group',
              taxId: '7707083893',
              city: 'Москва',
              contactName: 'Анна',
              phone: '+7 999 111-22-33',
              role: 'owner',
              reviewNote: null,
            },
          }),
          update: sessionUpdate,
        },
      },
    } as any);

    const result = await service.refresh(refreshToken.refreshToken);
    const newRefreshId = verifyPartnerRefreshToken(result.tokens.refreshToken).refreshTokenId;

    expect(newRefreshId).not.toBe(oldRefreshId);
    expect(sessionUpdate).toHaveBeenCalledWith({
      where: { id: 'partner-session-1' },
      data: {
        refreshTokenId: expect.any(String),
        lastUsedAt: expect.any(Date),
      },
      include: {
        partnerAccount: true,
      },
    });
  });

  it('approves a pending account by creating a partner and binding it to the account', async () => {
    const tx = {
      partnerAccount: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'account-1',
          email: 'owner@roof.example',
          status: 'pending',
          partnerId: null,
          organizationName: 'Roof Group',
          taxId: '7707083893',
          city: 'Москва',
          contactName: 'Анна',
          phone: '+7 999 111-22-33',
          role: 'owner',
          reviewNote: null,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'account-1',
          email: 'owner@roof.example',
          status: 'approved',
          partnerId: 'partner-1',
          organizationName: 'Roof Group',
          taxId: '7707083893',
          city: 'Москва',
          contactName: 'Анна',
          phone: '+7 999 111-22-33',
          role: 'owner',
          reviewNote: null,
        }),
      },
      partner: {
        create: jest.fn().mockResolvedValue({ id: 'partner-1' }),
      },
    };
    const service = new PartnerAuthService({
      client: {
        $transaction: jest.fn((callback) => callback(tx)),
      },
    } as any);

    await service.approveAccount('account-1', {});

    expect(tx.partner.create).toHaveBeenCalledWith({
      data: {
        name: 'Roof Group',
        taxId: '7707083893',
        city: 'Москва',
        status: 'active',
        contact: 'Анна · +7 999 111-22-33 · owner@roof.example',
        notes: null,
      },
      select: { id: true },
    });
    expect(tx.partnerAccount.update).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      data: {
        partnerId: 'partner-1',
        status: 'approved',
        reviewNote: null,
      },
    });
  });
});
