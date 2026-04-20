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
      const registrationPreset = this.buildRegistrationPreset(challenge.phoneNumber);
      await this.ensureUser(userId, {
        displayName: registrationPreset.displayName,
        phoneNumber: challenge.phoneNumber,
        profile: registrationPreset.profile,
        onboarding: registrationPreset.onboarding,
        settings: registrationPreset.settings,
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
  ) {
    const prisma = this.prismaService.client;
    const existing = await prisma.user.findUnique({ where: { id: userId } });

    if (existing) {
      return existing;
    }

    if (params.phoneNumber) {
      const existingByPhone = await prisma.user.findUnique({
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

    return prisma.user.create({
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
    const digits = raw.replace(/\D/g, '');

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
