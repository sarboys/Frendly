import { Injectable } from '@nestjs/common';
import {
  signPartnerAccessToken,
  signPartnerRefreshToken,
  verifyPartnerRefreshToken,
} from '@big-break/database';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;
const PARTNER_ACCOUNT_STATUSES = new Set(['pending', 'approved', 'rejected', 'suspended']);

type PartnerAccountRecord = {
  id: string;
  email: string;
  status: string;
  partnerId: string | null;
  organizationName: string;
  taxId: string;
  city: string;
  contactName: string;
  phone: string;
  role: string;
  reviewNote: string | null;
};

export type PartnerTokenPair = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class PartnerAuthService {
  constructor(private readonly prismaService: PrismaService) {}

  static hashPasswordForTest(password: string) {
    return hashPassword(password);
  }

  async register(body: Record<string, unknown>) {
    const input = this.parseRegistrationInput(body);
    const existing = await this.prismaService.client.partnerAccount.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existing) {
      throw new ApiError(409, 'partner_email_exists', 'Partner email already exists');
    }

    const account = await this.prismaService.client.partnerAccount.create({
      data: {
        ...input,
        status: 'pending',
        passwordHash: await hashPassword(input.password),
      },
    });

    return { account: this.mapAccount(account) };
  }

  async login(body: Record<string, unknown>) {
    const email = this.parseEmail(body.email);
    const password = this.requiredText(body.password, 'partner_password_required');
    const account = await this.prismaService.client.partnerAccount.findUnique({
      where: { email },
    });

    if (!account || !(await verifyPassword(password, account.passwordHash))) {
      throw new ApiError(401, 'partner_invalid_credentials', 'Email or password is invalid');
    }

    if (account.status === 'suspended') {
      throw new ApiError(403, 'partner_account_suspended', 'Partner account is suspended');
    }

    const tokens = await this.createTokenPair(account.id);
    await this.prismaService.client.partnerAccount.update({
      where: { id: account.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      account: this.mapAccount(account),
      tokens,
    };
  }

  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = verifyPartnerRefreshToken(refreshToken);
    } catch {
      throw new ApiError(401, 'partner_invalid_refresh_token', 'Refresh token is invalid');
    }

    const session = await this.prismaService.client.partnerSession.findUnique({
      where: { id: payload.sessionId },
      include: { partnerAccount: true },
    });

    if (
      !session ||
      session.partnerAccountId !== payload.partnerAccountId ||
      session.refreshTokenId !== payload.refreshTokenId ||
      session.revokedAt != null
    ) {
      throw new ApiError(401, 'partner_stale_refresh_token', 'Refresh token is stale');
    }

    if (session.partnerAccount.status === 'suspended') {
      throw new ApiError(403, 'partner_account_suspended', 'Partner account is suspended');
    }

    const refreshTokenId = randomUUID();
    const updated = await this.prismaService.client.partnerSession.update({
      where: { id: session.id },
      data: {
        refreshTokenId,
        lastUsedAt: new Date(),
      },
      include: {
        partnerAccount: true,
      },
    });

    return {
      account: this.mapAccount(updated.partnerAccount),
      tokens: this.signTokens(updated.partnerAccountId, updated.id, refreshTokenId),
    };
  }

  async logout(refreshToken: string) {
    let payload;
    try {
      payload = verifyPartnerRefreshToken(refreshToken);
    } catch {
      return { ok: true };
    }

    await this.prismaService.client.partnerSession.updateMany({
      where: {
        id: payload.sessionId,
        partnerAccountId: payload.partnerAccountId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { ok: true };
  }

  async getMe(partnerAccountId: string) {
    const account = await this.prismaService.client.partnerAccount.findUnique({
      where: { id: partnerAccountId },
    });

    if (!account) {
      throw new ApiError(404, 'partner_account_not_found', 'Partner account not found');
    }

    return { account: this.mapAccount(account) };
  }

  async listAccounts(query: Record<string, unknown> = {}) {
    const status = this.optionalText(query.status);
    const accounts = await this.prismaService.client.partnerAccount.findMany({
      where: {
        ...(status ? { status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: this.parseLimit(query.limit),
    });

    return { items: accounts.map((account) => this.mapAccount(account)) };
  }

  async approveAccount(accountId: string, body: Record<string, unknown>) {
    return this.prismaService.client.$transaction(async (tx) => {
      const account = await tx.partnerAccount.findUnique({
        where: { id: accountId },
      });
      if (!account) {
        throw new ApiError(404, 'partner_account_not_found', 'Partner account not found');
      }

      const requestedPartnerId = this.optionalText(body.partnerId);
      const partner = requestedPartnerId
        ? await tx.partner.findUnique({
            where: { id: requestedPartnerId },
            select: { id: true },
          })
        : await tx.partner.create({
            data: {
              name: account.organizationName,
              taxId: account.taxId,
              city: account.city,
              status: 'active',
              contact: `${account.contactName} · ${account.phone} · ${account.email}`,
              notes: null,
            },
            select: { id: true },
          });

      if (!partner) {
        throw new ApiError(404, 'partner_not_found', 'Partner not found');
      }

      const updated = await tx.partnerAccount.update({
        where: { id: account.id },
        data: {
          partnerId: partner.id,
          status: 'approved',
          reviewNote: null,
        },
      });

      return { account: this.mapAccount(updated) };
    });
  }

  async rejectAccount(accountId: string, body: Record<string, unknown>) {
    const account = await this.prismaService.client.partnerAccount.update({
      where: { id: accountId },
      data: {
        status: 'rejected',
        reviewNote: this.optionalText(body.reviewNote),
      },
    });
    await this.revokeAccountSessions(accountId);
    return { account: this.mapAccount(account) };
  }

  async suspendAccount(accountId: string, body: Record<string, unknown>) {
    const account = await this.prismaService.client.partnerAccount.update({
      where: { id: accountId },
      data: {
        status: 'suspended',
        reviewNote: this.optionalText(body.reviewNote),
      },
    });
    await this.revokeAccountSessions(accountId);
    return { account: this.mapAccount(account) };
  }

  async createTokenPairForTest(partnerAccountId: string) {
    return this.createTokenPair(partnerAccountId);
  }

  private async createTokenPair(partnerAccountId: string): Promise<PartnerTokenPair> {
    const refreshTokenId = randomUUID();
    const session = await this.prismaService.client.partnerSession.create({
      data: {
        partnerAccountId,
        refreshTokenId,
      },
    });

    return this.signTokens(partnerAccountId, session.id, refreshTokenId);
  }

  private signTokens(
    partnerAccountId: string,
    sessionId: string,
    refreshTokenId: string,
  ): PartnerTokenPair {
    return {
      accessToken: signPartnerAccessToken(partnerAccountId, sessionId),
      refreshToken: signPartnerRefreshToken(partnerAccountId, sessionId, refreshTokenId),
    };
  }

  private parseRegistrationInput(body: Record<string, unknown>) {
    const email = this.parseEmail(body.email);
    const taxId = this.parseTaxId(body.taxId);
    const password = this.requiredText(body.password, 'partner_password_required');
    if (password.length < 8) {
      throw new ApiError(400, 'partner_password_too_short', 'Password is too short');
    }

    return {
      email,
      password,
      organizationName: this.requiredText(
        body.organizationName,
        'partner_organization_name_required',
      ),
      taxId,
      city: this.requiredText(body.city, 'partner_city_required'),
      contactName: this.requiredText(body.contactName, 'partner_contact_name_required'),
      phone: this.requiredText(body.phone, 'partner_phone_required'),
    };
  }

  private parseEmail(value: unknown) {
    const email = this.requiredText(value, 'partner_email_required').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError(400, 'partner_email_invalid', 'Email is invalid');
    }
    return email;
  }

  private parseTaxId(value: unknown) {
    const taxId = this.requiredText(value, 'partner_tax_id_required').replace(/\D/g, '');
    if (!/^\d{10}$/.test(taxId) && !/^\d{12}$/.test(taxId)) {
      throw new ApiError(400, 'partner_invalid_tax_id', 'Partner tax id is invalid');
    }
    return taxId;
  }

  private requiredText(value: unknown, code: string) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new ApiError(400, code, 'Required partner field is missing');
    }
    return value.trim();
  }

  private optionalText(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  private parseLimit(value: unknown) {
    const limit = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(limit)) {
      return 50;
    }
    return Math.max(1, Math.min(Math.trunc(limit), 100));
  }

  private async revokeAccountSessions(partnerAccountId: string) {
    await this.prismaService.client.partnerSession.updateMany({
      where: {
        partnerAccountId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  private mapAccount(account: PartnerAccountRecord) {
    const status = PARTNER_ACCOUNT_STATUSES.has(account.status)
      ? account.status
      : 'pending';
    return {
      id: account.id,
      email: account.email,
      status,
      partnerId: account.partnerId,
      organizationName: account.organizationName,
      taxId: account.taxId,
      city: account.city,
      contactName: account.contactName,
      phone: account.phone,
      role: account.role,
      reviewNote: account.reviewNote,
    };
  }
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('base64url');
  const derivedKey = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString('base64url')}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [, salt, encodedKey] = storedHash.split('$');
  if (!salt || !encodedKey) {
    return false;
  }

  const expectedKey = Buffer.from(encodedKey, 'base64url');
  const actualKey = (await scrypt(password, salt, expectedKey.length)) as Buffer;
  return (
    expectedKey.length === actualKey.length &&
    timingSafeEqual(expectedKey, actualKey)
  );
}
