import { Injectable } from '@nestjs/common';
import { TokenPair } from '@big-break/contracts';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '@big-break/database';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prismaService: PrismaService) {}

  async createDevSession(userId = 'user-me'): Promise<TokenPair> {
    await this.ensureUser(userId, { displayName: 'Dev User' });
    return this.createSession(userId);
  }

  async requestPhoneCode(phoneNumber: string) {
    const normalized = this.normalizePhone(phoneNumber);
    if (normalized.length < 11) {
      throw new ApiError(400, 'invalid_phone_number', 'Phone number is invalid');
    }

    const existingUser = await this.prismaService.client.user.findUnique({
      where: { phoneNumber: normalized },
      select: { id: true },
    });

    const challenge = await this.prismaService.client.phoneOtpChallenge.create({
      data: {
        userId: existingUser?.id,
        phoneNumber: normalized,
        code: '1111',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    return {
      challengeId: challenge.id,
      maskedPhone: `${normalized.substring(0, 2)} *** *** ${normalized.substring(normalized.length - 2)}`,
      resendAfterSeconds: 42,
      localCodeHint: '1111',
    };
  }

  async verifyPhoneCode(challengeId: string, code: string): Promise<TokenPair & { userId: string }> {
    const challenge = await this.prismaService.client.phoneOtpChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge || challenge.consumedAt != null || challenge.expiresAt.getTime() < Date.now()) {
      throw new ApiError(400, 'invalid_otp_challenge', 'OTP challenge is invalid');
    }

    if (challenge.code !== code) {
      throw new ApiError(400, 'invalid_otp_code', 'OTP code is invalid');
    }

    let user = await this.prismaService.client.user.findUnique({
      where: { phoneNumber: challenge.phoneNumber },
    });

    if (!user) {
      const userId = `user-${randomUUID()}`;
      await this.ensureUser(userId, {
        displayName: 'Новый пользователь',
        phoneNumber: challenge.phoneNumber,
      });
      user = await this.prismaService.client.user.findUnique({
        where: { id: userId },
      });
    }

    if (!user) {
      throw new ApiError(500, 'auth_user_create_failed', 'Could not create user');
    }

    await this.prismaService.client.phoneOtpChallenge.update({
      where: { id: challengeId },
      data: {
        consumedAt: new Date(),
        userId: user.id,
      },
    });

    const tokens = await this.createSession(user.id);
    return {
      ...tokens,
      userId: user.id,
    };
  }

  async refreshSession(refreshToken: string): Promise<TokenPair> {
    const payload = verifyRefreshToken(refreshToken);
    const prisma = this.prismaService.client;
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
    });

    if (!session || session.revokedAt || session.refreshTokenId !== payload.refreshTokenId) {
      throw new ApiError(401, 'invalid_refresh_token', 'Refresh token is invalid');
    }

    const nextRefreshTokenId = randomUUID();
    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenId: nextRefreshTokenId,
        lastUsedAt: new Date(),
      },
    });

    return {
      accessToken: signAccessToken(session.userId, session.id),
      refreshToken: signRefreshToken(session.userId, session.id, nextRefreshTokenId),
    };
  }

  async logout(sessionId?: string) {
    if (!sessionId) {
      return { ok: true };
    }

    await this.prismaService.client.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { ok: true };
  }

  async getMe(userId: string) {
    const user = await this.prismaService.client.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new ApiError(404, 'user_not_found', 'User not found');
    }

    return {
      id: user.id,
      displayName: user.displayName,
      verified: user.verified,
      online: user.online,
      area: user.profile?.area ?? null,
      city: user.profile?.city ?? null,
    };
  }

  private async ensureUser(
    userId: string,
    params: {
      displayName: string;
      phoneNumber?: string;
    },
  ) {
    const prisma = this.prismaService.client;
    const existing = await prisma.user.findUnique({ where: { id: userId } });

    if (existing) {
      return existing;
    }

    return prisma.user.create({
      data: {
        id: userId,
        displayName: params.displayName,
        phoneNumber: params.phoneNumber,
        profile: {
          create: {
            city: 'Москва',
            area: 'Центр',
          },
        },
        onboarding: {
          create: {
            interests: [],
          },
        },
        settings: {
          create: {},
        },
        verification: {
          create: {},
        },
      },
    });
  }

  private async createSession(userId: string): Promise<TokenPair> {
    const sessionId = randomUUID();
    const refreshTokenId = randomUUID();

    await this.prismaService.client.session.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenId,
      },
    });

    return {
      accessToken: signAccessToken(userId, sessionId),
      refreshToken: signRefreshToken(userId, sessionId, refreshTokenId),
    };
  }

  private normalizePhone(raw: string) {
    return raw.replace(/[^\d+]/g, '');
  }
}
