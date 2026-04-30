import { Injectable } from '@nestjs/common';
import {
  signAdminAccessToken,
  signAdminRefreshToken,
  verifyAdminRefreshToken,
} from '@big-break/database';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;
const ADMIN_STATUSES = new Set(['active', 'suspended']);

type AdminRecord = {
  id: string;
  email: string;
  displayName: string;
  role: 'owner' | 'operator' | 'analyst';
  status: string;
};

export type AdminTokenPair = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AdminAuthService {
  constructor(private readonly prismaService: PrismaService) {}

  static hashPasswordForTest(password: string) {
    return hashPassword(password);
  }

  async login(body: Record<string, unknown>) {
    const email = this.parseEmail(body.email);
    const password = this.requiredText(body.password, 'admin_password_required');
    const adminUser = await this.findAdminForLogin(email, password);

    if (!adminUser || !(await verifyPassword(password, adminUser.passwordHash))) {
      throw new ApiError(401, 'admin_invalid_credentials', 'Email or password is invalid');
    }

    if (adminUser.status === 'suspended') {
      throw new ApiError(403, 'admin_suspended', 'Admin account is suspended');
    }
    if (!ADMIN_STATUSES.has(adminUser.status)) {
      throw new ApiError(403, 'admin_inactive', 'Admin account is inactive');
    }

    const tokens = await this.createTokenPair(adminUser.id);
    await (this.prismaService.client as any).adminUser.update({
      where: { id: adminUser.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      admin: this.mapAdmin(adminUser),
      tokens,
    };
  }

  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = verifyAdminRefreshToken(refreshToken);
    } catch {
      throw new ApiError(401, 'admin_invalid_refresh_token', 'Refresh token is invalid');
    }

    const session = await (this.prismaService.client as any).adminSession.findUnique({
      where: { id: payload.sessionId },
      include: { adminUser: true },
    });

    if (
      !session ||
      session.adminUserId !== payload.adminUserId ||
      session.refreshTokenId !== payload.refreshTokenId ||
      session.revokedAt != null
    ) {
      throw new ApiError(401, 'admin_stale_refresh_token', 'Refresh token is stale');
    }

    if (session.adminUser.status !== 'active') {
      throw new ApiError(403, 'admin_inactive', 'Admin account is inactive');
    }

    const refreshTokenId = randomUUID();
    const updated = await (this.prismaService.client as any).adminSession.update({
      where: { id: session.id },
      data: {
        refreshTokenId,
        lastUsedAt: new Date(),
      },
      include: {
        adminUser: true,
      },
    });

    return {
      admin: this.mapAdmin(updated.adminUser),
      tokens: this.signTokens(updated.adminUserId, updated.id, refreshTokenId),
    };
  }

  async logout(refreshToken: string) {
    let payload;
    try {
      payload = verifyAdminRefreshToken(refreshToken);
    } catch {
      return { ok: true };
    }

    await (this.prismaService.client as any).adminSession.updateMany({
      where: {
        id: payload.sessionId,
        adminUserId: payload.adminUserId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return { ok: true };
  }

  async getMe(adminUserId: string) {
    const adminUser = await (this.prismaService.client as any).adminUser.findUnique({
      where: { id: adminUserId },
    });
    if (!adminUser || adminUser.status !== 'active') {
      throw new ApiError(404, 'admin_not_found', 'Admin not found');
    }
    return { admin: this.mapAdmin(adminUser) };
  }

  async createTokenPairForTest(adminUserId: string) {
    return this.createTokenPair(adminUserId);
  }

  private async findAdminForLogin(email: string, password: string) {
    const existing = await (this.prismaService.client as any).adminUser.findUnique({
      where: { email },
    });
    if (existing) {
      return existing;
    }

    const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
    const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    if (!bootstrapEmail || !bootstrapPassword || email !== bootstrapEmail || password !== bootstrapPassword) {
      return null;
    }

    const count = await (this.prismaService.client as any).adminUser.count();
    if (count !== 0) {
      return null;
    }

    return (this.prismaService.client as any).adminUser.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        displayName: process.env.ADMIN_BOOTSTRAP_NAME?.trim() || 'Frendly Admin',
        role: 'owner',
        status: 'active',
      },
    });
  }

  private async createTokenPair(adminUserId: string): Promise<AdminTokenPair> {
    const refreshTokenId = randomUUID();
    const session = await (this.prismaService.client as any).adminSession.create({
      data: {
        adminUserId,
        refreshTokenId,
      },
    });

    return this.signTokens(adminUserId, session.id, refreshTokenId);
  }

  private signTokens(
    adminUserId: string,
    sessionId: string,
    refreshTokenId: string,
  ): AdminTokenPair {
    return {
      accessToken: signAdminAccessToken(adminUserId, sessionId),
      refreshToken: signAdminRefreshToken(adminUserId, sessionId, refreshTokenId),
    };
  }

  private parseEmail(value: unknown) {
    const email = this.requiredText(value, 'admin_email_required').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError(400, 'admin_email_invalid', 'Email is invalid');
    }
    return email;
  }

  private requiredText(value: unknown, code: string) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new ApiError(400, code, 'Required admin field is missing');
    }
    return value.trim();
  }

  private mapAdmin(adminUser: AdminRecord) {
    return {
      id: adminUser.id,
      email: adminUser.email,
      displayName: adminUser.displayName,
      role: adminUser.role,
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
  return expectedKey.length === actualKey.length && timingSafeEqual(expectedKey, actualKey);
}
