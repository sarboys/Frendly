import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { TokenPair } from '@big-break/contracts';
import {
  maskPhoneNumber,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '@big-break/database';
import { randomInt, randomUUID } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

type DbClient = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class AuthService {
  constructor(private readonly prismaService: PrismaService) {}

  async createDevSession(userId = 'user-me'): Promise<TokenPair> {
    if (!this.isDevAuthEnabled()) {
      throw new ApiError(404, 'dev_auth_disabled', 'Dev auth is disabled');
    }

    await this.ensureUser(userId, { displayName: 'Dev User' });
    const session = await this.createSessionRecord(userId);
    return session.tokens;
  }

  async requestPhoneCode(phoneNumber: string) {
    if (!this.isDevOtpEnabled()) {
      throw new ApiError(
        503,
        'phone_auth_unavailable',
        'Phone auth delivery is unavailable',
      );
    }

    const normalized = this.normalizePhoneNumber(phoneNumber);
    if (!normalized) {
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
        code: this.generateDevOtpCode(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    return {
      challengeId: challenge.id,
      maskedPhone: maskPhoneNumber(normalized),
      resendAfterSeconds: 42,
      localCodeHint: challenge.code,
    };
  }

  async verifyPhoneCode(
    challengeId: string,
    code: string,
  ): Promise<TokenPair & { userId: string; isNewUser: boolean }> {
    const challenge = await this.prismaService.client.phoneOtpChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge || challenge.consumedAt != null || challenge.expiresAt.getTime() < Date.now()) {
      throw new ApiError(400, 'invalid_otp_challenge', 'OTP challenge is invalid');
    }

    if (challenge.code !== code) {
      await this.prismaService.client.phoneOtpChallenge.updateMany({
        where: {
          id: challengeId,
          consumedAt: null,
        },
        data: {
          expiresAt: new Date(Date.now() - 1000),
        },
      });
      throw new ApiError(400, 'invalid_otp_code', 'OTP code is invalid');
    }

    const { user, isNewUser } = await this.findOrCreateUserByPhoneNumber(
      challenge.phoneNumber,
    );

    if (!user) {
      throw new ApiError(500, 'auth_user_create_failed', 'Could not create user');
    }

    const consumedAt = new Date();
    const consumeResult = await this.prismaService.client.phoneOtpChallenge.updateMany({
      where: {
        id: challengeId,
        code,
        consumedAt: null,
        expiresAt: {
          gt: consumedAt,
        },
      },
      data: {
        consumedAt,
        userId: user.id,
      },
    });

    if (consumeResult.count === 0) {
      throw new ApiError(400, 'invalid_otp_challenge', 'OTP challenge is invalid');
    }

    const session = await this.createSessionRecord(user.id);
    return {
      ...session.tokens,
      userId: user.id,
      isNewUser,
    };
  }

  async refreshSession(refreshToken: string): Promise<TokenPair> {
    let payload;

    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new ApiError(401, 'invalid_refresh_token', 'Refresh token is invalid');
    }

    const prisma = this.prismaService.client;
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
    });

    if (!session || session.revokedAt || session.refreshTokenId !== payload.refreshTokenId) {
      throw new ApiError(401, 'invalid_refresh_token', 'Refresh token is invalid');
    }

    const nextRefreshTokenId = randomUUID();
    const updated = await prisma.session.updateMany({
      where: {
        id: session.id,
        revokedAt: null,
        refreshTokenId: payload.refreshTokenId,
      },
      data: {
        refreshTokenId: nextRefreshTokenId,
        lastUsedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      throw new ApiError(401, 'invalid_refresh_token', 'Refresh token is invalid');
    }

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

  async findOrCreateUserByPhoneNumber(phoneNumber: string, prisma?: DbClient) {
    const client = prisma ?? this.prismaService.client;
    let user = await client.user.findUnique({
      where: { phoneNumber },
    });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const userId = `user-${randomUUID()}`;
      const registrationPreset = this.buildRegistrationPreset(phoneNumber);
      await this.ensureUser(
        userId,
        {
          displayName: registrationPreset.displayName,
          phoneNumber,
          profile: registrationPreset.profile,
          onboarding: registrationPreset.onboarding,
          settings: registrationPreset.settings,
        },
        client,
      );
      user = await client.user.findUnique({
        where: { id: userId },
      });
    }

    if (!user) {
      throw new ApiError(500, 'auth_user_create_failed', 'Could not create user');
    }

    return { user, isNewUser };
  }

  async createSessionRecord(userId: string, prisma?: DbClient) {
    const sessionId = randomUUID();
    const refreshTokenId = randomUUID();
    const client = prisma ?? this.prismaService.client;

    await client.session.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenId,
      },
    });

    return {
      sessionId,
      refreshTokenId,
      tokens: {
        accessToken: signAccessToken(userId, sessionId),
        refreshToken: signRefreshToken(userId, sessionId, refreshTokenId),
      },
    };
  }

  normalizePhoneNumber(raw: string) {
    return this.normalizePhone(raw);
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
      profile?: {
        city?: string;
        area?: string;
        bio?: string;
        vibe?: string;
      };
      onboarding?: {
        intent?: string;
        city?: string;
        area?: string;
        interests?: string[];
        vibe?: string;
      };
      settings?: {
        allowLocation?: boolean;
        allowPush?: boolean;
        allowContacts?: boolean;
        autoSharePlans?: boolean;
        hideExactLocation?: boolean;
        quietHours?: boolean;
        showAge?: boolean;
        discoverable?: boolean;
        darkMode?: boolean;
      };
    },
    prisma?: DbClient,
  ) {
    const client = prisma ?? this.prismaService.client;
    const existing = await client.user.findUnique({ where: { id: userId } });

    if (existing) {
      return existing;
    }

    if (params.phoneNumber) {
      const existingByPhone = await client.user.findUnique({
        where: { phoneNumber: params.phoneNumber },
      });

      if (existingByPhone) {
        return existingByPhone;
      }
    }

    const profilePreset = {
      city: params.profile?.city ?? 'Москва',
      area: params.profile?.area ?? 'Центр',
      bio: params.profile?.bio,
      vibe: params.profile?.vibe,
    };

    const onboardingPreset = {
      intent: params.onboarding?.intent,
      city: params.onboarding?.city ?? profilePreset.city,
      area: params.onboarding?.area ?? profilePreset.area,
      interests: params.onboarding?.interests ?? [],
      vibe: params.onboarding?.vibe ?? profilePreset.vibe,
    };

    return client.user.create({
      data: {
        id: userId,
        displayName: params.displayName,
        phoneNumber: params.phoneNumber,
        profile: {
          create: {
            city: profilePreset.city,
            area: profilePreset.area,
            bio: profilePreset.bio,
            vibe: profilePreset.vibe,
          },
        },
        onboarding: {
          create: {
            intent: onboardingPreset.intent,
            city: onboardingPreset.city,
            area: onboardingPreset.area,
            interests: onboardingPreset.interests,
            vibe: onboardingPreset.vibe,
          },
        },
        settings: {
          create: params.settings ?? {},
        },
        verification: {
          create: {},
        },
      },
    });
  }

  private normalizePhone(raw: string) {
    const digits = raw.replace(/\D/g, '');

    if (digits.length === 12 && digits.startsWith('375')) {
      return `+${digits}`;
    }

    if (digits.length === 10) {
      return `+7${digits}`;
    }

    if (digits.length === 11 && digits.startsWith('8')) {
      return `+7${digits.slice(1)}`;
    }

    if (digits.length === 11 && digits.startsWith('7')) {
      return `+${digits}`;
    }

    return '';
  }

  private isDevAuthEnabled() {
    return process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_AUTH === 'true';
  }

  private isDevOtpEnabled() {
    return process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_OTP === 'true';
  }

  private generateDevOtpCode() {
    return `${randomInt(1000, 10000)}`;
  }

  private buildRegistrationPreset(phoneNumber: string) {
    const digits = phoneNumber.replace(/\D/g, '');
    const hash = digits
      .split('')
      .reduce((acc, digit) => acc + Number(digit), 0);

    const cities = ['Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург'];
    const areas = ['Центр', 'Покровка', 'Патрики', 'Замоскворечье'];
    const vibes = ['Спокойно', 'Уютно', 'Активно', 'Легко'];
    const intents = ['both', 'friendship', 'dating', 'both'];
    const interestSets = [
      ['Кофе', 'Кино', 'Прогулки'],
      ['Настолки', 'Бары', 'Книги'],
      ['Бег', 'Велик', 'Кино'],
      ['Театр', 'Готовка', 'Кофе'],
    ];

    const city = cities[hash % cities.length];
    const area = areas[hash % areas.length];
    const vibe = vibes[hash % vibes.length];
    const intent = intents[hash % intents.length];
    const interests = interestSets[hash % interestSets.length];
    const suffix = digits.slice(-4);

    return {
      displayName: `Пользователь ${suffix}`,
      profile: {
        city,
        area,
        bio: `Новый аккаунт с номером ${suffix}.`,
        vibe,
      },
      onboarding: {
        intent,
        city,
        area,
        interests,
        vibe,
      },
      settings: {
        allowLocation: hash % 2 === 0,
        allowPush: true,
        allowContacts: hash % 3 === 0,
        autoSharePlans: hash % 2 !== 0,
        hideExactLocation: hash % 4 === 0,
        quietHours: hash % 5 === 0,
        showAge: true,
        discoverable: true,
        darkMode: hash % 2 === 1,
      },
    };
  }
}
