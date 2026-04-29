import { Injectable, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { TokenPair } from '@big-break/contracts';
import {
  maskPhoneNumber,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '@big-break/database';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../common/api-error';
import {
  PHONE_OTP_COOLDOWN_MS,
  PHONE_OTP_MAX_ATTEMPTS,
  PHONE_OTP_MAX_REQUESTS_PER_CONTEXT,
  PHONE_OTP_REQUEST_WINDOW_MS,
  PhoneOtpService,
} from './phone-otp.service';
import { PrismaService } from './prisma.service';

type DbClient = PrismaClient | Prisma.TransactionClient;
type AuthSessionProvider =
  | 'dev'
  | 'phone_otp'
  | 'session'
  | 'telegram'
  | 'google'
  | 'yandex';

interface AuthRequestMeta {
  requestId?: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly phoneOtpService: PhoneOtpService,
  ) {}

  private static readonly testPhoneShortcutNumbers = new Set<string>([
    '+71111111111',
    '+72222222222',
    '+73333333333',
    '+74444444444',
    '+75555555555',
    '+76666666666',
    '+77777777777',
  ]);

  async createDevSession(userId = 'user-me'): Promise<TokenPair> {
    if (!this.isDevAuthEnabled()) {
      throw new ApiError(404, 'dev_auth_disabled', 'Dev auth is disabled');
    }

    await this.ensureUser(userId, { displayName: 'Dev User' });
    const session = await this.createSessionRecord(userId, 'dev');
    return session.tokens;
  }

  async requestPhoneCode(phoneNumber: string, meta: AuthRequestMeta = {}) {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    if (!normalized) {
      await this.writeAuditEvent(this.prismaService.client, {
        provider: 'phone_otp',
        kind: 'start',
        result: 'rejected',
        requestId: this.requestId(meta),
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { reason: 'invalid_phone_number' },
      });
      throw new ApiError(400, 'invalid_phone_number', 'Phone number is invalid');
    }

    const maskedPhone = maskPhoneNumber(normalized);
    const now = new Date();
    const requestKeyHash = this.phoneOtpService.hashRequestKey(meta);
    const activeChallenge = await this.prismaService.client.phoneOtpChallenge.findFirst({
      where: {
        phoneNumber: normalized,
        consumedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeChallenge) {
      const lastIssuedAt = activeChallenge.lastIssuedAt ?? activeChallenge.createdAt;
      const retryAfterMs = PHONE_OTP_COOLDOWN_MS - (now.getTime() - lastIssuedAt.getTime());
      if (retryAfterMs > 0) {
        const resendAfterSeconds = Math.ceil(retryAfterMs / 1000);
        this.logger.warn(
          `Phone OTP cooldown: requestId=${this.requestId(meta)} phone=${maskedPhone} retryAfterSeconds=${resendAfterSeconds}`,
        );
        await this.writeAuditEvent(this.prismaService.client, {
          provider: 'phone_otp',
          kind: 'start',
          result: 'rate_limited',
          requestId: this.requestId(meta),
          maskedPhone,
          ip: meta.ip,
          userAgent: meta.userAgent,
          metadata: {
            reason: 'cooldown',
            retryAfterSeconds: resendAfterSeconds,
          },
        });
        return {
          challengeId: activeChallenge.id,
          maskedPhone,
          resendAfterSeconds,
          localCodeHint: this.phoneOtpService.localCodeHint(activeChallenge.codeSalt),
        };
      }
    }

    if (requestKeyHash) {
      const recentRequests = await this.prismaService.client.phoneOtpChallenge.count({
        where: {
          requestKeyHash,
          createdAt: {
            gt: new Date(now.getTime() - PHONE_OTP_REQUEST_WINDOW_MS),
          },
        },
      });

      if (recentRequests >= PHONE_OTP_MAX_REQUESTS_PER_CONTEXT) {
        this.logger.warn(
          `Phone OTP request rate limited: requestId=${this.requestId(meta)} phone=${maskedPhone}`,
        );
        await this.writeAuditEvent(this.prismaService.client, {
          provider: 'phone_otp',
          kind: 'start',
          result: 'rate_limited',
          requestId: this.requestId(meta),
          maskedPhone,
          ip: meta.ip,
          userAgent: meta.userAgent,
          metadata: { reason: 'request_context_limit' },
        });
        throw new ApiError(
          429,
          'phone_otp_rate_limited',
          'Phone auth is rate limited',
        );
      }
    }

    const payload = this.phoneOtpService.createPayload(now);
    const [delivery, existingUser] = await Promise.all([
      this.phoneOtpService.deliver(normalized, payload.code, meta),
      this.prismaService.client.user.findUnique({
        where: { phoneNumber: normalized },
        select: { id: true },
      }),
    ]);

    const challenge = activeChallenge
      ? await this.prismaService.client.phoneOtpChallenge.update({
          where: { id: activeChallenge.id },
          data: {
            userId: existingUser?.id,
            codeHash: payload.codeHash,
            codeSalt: payload.codeSalt,
            requestKeyHash,
            attemptCount: 0,
            lastAttemptAt: null,
            lastIssuedAt: now,
            expiresAt: payload.expiresAt,
          },
        })
      : await this.prismaService.client.phoneOtpChallenge.create({
          data: {
            userId: existingUser?.id,
            phoneNumber: normalized,
            codeHash: payload.codeHash,
            codeSalt: payload.codeSalt,
            requestKeyHash,
            lastIssuedAt: now,
            expiresAt: payload.expiresAt,
          },
        });

    this.logger.log(
      `Issued phone OTP challenge: requestId=${this.requestId(meta)} phone=${maskedPhone} provider=${delivery.provider} reused=${activeChallenge != null}`,
    );
    await this.writeAuditEvent(this.prismaService.client, {
      provider: 'phone_otp',
      kind: 'start',
      result: 'issued',
      requestId: this.requestId(meta),
      userId: existingUser?.id,
      maskedPhone,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: {
        provider: delivery.provider,
        reused: activeChallenge != null,
      },
    });

    return {
      challengeId: challenge.id,
      maskedPhone,
      resendAfterSeconds: Math.ceil(PHONE_OTP_COOLDOWN_MS / 1000),
      localCodeHint: delivery.localCodeHint,
    };
  }

  async verifyPhoneCode(
    challengeId: string,
    code: string,
    meta: AuthRequestMeta = {},
  ): Promise<TokenPair & { userId: string; isNewUser: boolean }> {
    try {
      return await this.prismaService.client.$transaction(async (tx) => {
        const now = new Date();
        const challenge = await tx.phoneOtpChallenge.findUnique({
          where: { id: challengeId },
        });

        if (
          !challenge ||
          challenge.consumedAt != null ||
          challenge.expiresAt.getTime() <= now.getTime()
        ) {
          this.logger.warn(
            `Rejected phone OTP verify: requestId=${this.requestId(meta)} reason=invalid_challenge challengeId=${challengeId}`,
          );
          await this.writeAuditEvent(tx, {
            provider: 'phone_otp',
            kind: 'verify',
            result: 'rejected',
            requestId: this.requestId(meta),
            ip: meta.ip,
            userAgent: meta.userAgent,
            metadata: { reason: 'invalid_challenge' },
          });
          throw new ApiError(400, 'invalid_otp_challenge', 'OTP challenge is invalid');
        }

        const maskedPhone = maskPhoneNumber(challenge.phoneNumber);
        if (challenge.attemptCount >= PHONE_OTP_MAX_ATTEMPTS) {
          await tx.phoneOtpChallenge.updateMany({
            where: {
              id: challenge.id,
              consumedAt: null,
            },
            data: {
              consumedAt: now,
              lastAttemptAt: now,
            },
          });
          this.logger.warn(
            `Phone OTP verify rate limited: requestId=${this.requestId(meta)} phone=${maskedPhone}`,
          );
          await this.writeAuditEvent(tx, {
            provider: 'phone_otp',
            kind: 'verify',
            result: 'rate_limited',
            requestId: this.requestId(meta),
            maskedPhone,
            ip: meta.ip,
            userAgent: meta.userAgent,
            metadata: { reason: 'max_attempts' },
          });
          throw new ApiError(
            429,
            'phone_otp_rate_limited',
            'Phone auth is rate limited',
          );
        }

        if (!this.phoneOtpService.verifyCode(code, challenge.codeSalt, challenge.codeHash)) {
          const nextAttemptCount = challenge.attemptCount + 1;
          const limited = nextAttemptCount >= PHONE_OTP_MAX_ATTEMPTS;
          await tx.phoneOtpChallenge.updateMany({
            where: {
              id: challenge.id,
              consumedAt: null,
            },
            data: {
              attemptCount: {
                increment: 1,
              },
              lastAttemptAt: now,
              consumedAt: limited ? now : undefined,
            },
          });
          this.logger.warn(
            `Rejected phone OTP verify: requestId=${this.requestId(meta)} phone=${maskedPhone} reason=invalid_code attempts=${nextAttemptCount}`,
          );
          await this.writeAuditEvent(tx, {
            provider: 'phone_otp',
            kind: 'verify',
            result: limited ? 'rate_limited' : 'rejected',
            requestId: this.requestId(meta),
            maskedPhone,
            ip: meta.ip,
            userAgent: meta.userAgent,
            metadata: {
              reason: limited ? 'max_attempts' : 'invalid_code',
              attemptCount: nextAttemptCount,
            },
          });
          throw new ApiError(
            limited ? 429 : 400,
            limited ? 'phone_otp_rate_limited' : 'invalid_otp_code',
            limited ? 'Phone auth is rate limited' : 'OTP code is invalid',
          );
        }

        const consumeResult = await tx.phoneOtpChallenge.updateMany({
          where: {
            id: challenge.id,
            consumedAt: null,
            expiresAt: {
              gt: now,
            },
          },
          data: {
            consumedAt: now,
            lastAttemptAt: now,
            attemptCount: {
              increment: 1,
            },
          },
        });

        if (consumeResult.count === 0) {
          this.logger.warn(
            `Rejected phone OTP verify: requestId=${this.requestId(meta)} phone=${maskedPhone} reason=claim_failed`,
          );
          await this.writeAuditEvent(tx, {
            provider: 'phone_otp',
            kind: 'verify',
            result: 'rejected',
            requestId: this.requestId(meta),
            maskedPhone,
            ip: meta.ip,
            userAgent: meta.userAgent,
            metadata: { reason: 'claim_failed' },
          });
          throw new ApiError(400, 'invalid_otp_challenge', 'OTP challenge is invalid');
        }

        const { user, isNewUser } = await this.findOrCreateUserByPhoneNumber(
          challenge.phoneNumber,
          tx,
        );
        await tx.phoneOtpChallenge.update({
          where: { id: challenge.id },
          data: { userId: user.id },
        });
        const session = await this.createSessionRecord(user.id, 'phone_otp', tx);
        this.logger.debug(
          `Verified phone OTP: requestId=${this.requestId(meta)} phone=${maskedPhone} userId=${user.id} sessionId=${session.sessionId}`,
        );
        await this.writeAuditEvent(tx, {
          provider: 'phone_otp',
          kind: 'verify',
          result: 'success',
          requestId: this.requestId(meta),
          userId: user.id,
          sessionId: session.sessionId,
          maskedPhone,
          ip: meta.ip,
          userAgent: meta.userAgent,
          metadata: { isNewUser },
        });

        return {
          ...session.tokens,
          userId: user.id,
          isNewUser,
        };
      });
    } catch (error) {
      if (!(error instanceof ApiError)) {
        this.logger.error(
          `Unexpected phone OTP verify failure: requestId=${this.requestId(meta)} challengeId=${challengeId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
      throw error;
    }
  }

  async loginWithTestPhoneShortcut(phoneNumber: string) {
    const normalized = this.normalizePhone(phoneNumber);
    if (!normalized) {
      throw new ApiError(400, 'invalid_phone_number', 'Phone number is invalid');
    }

    if (!this.isTestPhoneShortcutEnabled()) {
      this.logger.warn(
        `Rejected test phone shortcut: phone=${maskPhoneNumber(normalized)} reason=disabled`,
      );
      throw new ApiError(
        404,
        'test_phone_shortcut_disabled',
        'Test phone shortcut is disabled',
      );
    }

    if (!AuthService.testPhoneShortcutNumbers.has(normalized)) {
      this.logger.warn(
        `Rejected test phone shortcut: phone=${maskPhoneNumber(normalized)} reason=not_configured`,
      );
      throw new ApiError(
        404,
        'test_phone_shortcut_not_found',
        'Test phone shortcut is not available',
      );
    }

    const { user, isNewUser } = await this.findOrCreateUserByPhoneNumber(
      normalized,
    );

    const session = await this.createSessionRecord(user.id, 'phone_otp');
    this.logger.log(
      `Issued test phone shortcut session: phone=${maskPhoneNumber(normalized)} userId=${user.id} isNewUser=${isNewUser}`,
    );
    return {
      ...session.tokens,
      userId: user.id,
      isNewUser,
    };
  }

  async refreshSession(
    refreshToken: string,
    meta: AuthRequestMeta = {},
  ): Promise<TokenPair> {
    let payload;

    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      this.logger.warn(
        `Rejected refresh token: requestId=${this.requestId(meta)} reason=invalid_payload`,
      );
      await this.writeAuditEvent(this.prismaService.client, {
        provider: 'session',
        kind: 'refresh',
        result: 'rejected',
        requestId: this.requestId(meta),
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { reason: 'invalid_payload' },
      });
      throw new ApiError(401, 'invalid_refresh_token', 'Refresh token is invalid');
    }

    const prisma = this.prismaService.client;
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
    });

    if (
      !session ||
      session.userId !== payload.userId ||
      session.revokedAt ||
      session.refreshTokenId !== payload.refreshTokenId
    ) {
      this.logger.warn(
        `Rejected refresh token: requestId=${this.requestId(meta)} userId=${payload.userId} sessionId=${payload.sessionId} reason=stale_session`,
      );
      await this.writeAuditEvent(this.prismaService.client, {
        provider: 'session',
        kind: 'refresh',
        result: 'rejected',
        requestId: this.requestId(meta),
        userId: payload.userId,
        sessionId: payload.sessionId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { reason: 'stale_session' },
      });
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
      this.logger.warn(
        `Rejected refresh token: requestId=${this.requestId(meta)} userId=${session.userId} sessionId=${session.id} reason=rotation_conflict`,
      );
      await this.writeAuditEvent(this.prismaService.client, {
        provider: 'session',
        kind: 'refresh',
        result: 'rejected',
        requestId: this.requestId(meta),
        userId: session.userId,
        sessionId: session.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { reason: 'rotation_conflict' },
      });
      throw new ApiError(401, 'invalid_refresh_token', 'Refresh token is invalid');
    }

    this.logger.log(
      `Rotated refresh token: requestId=${this.requestId(meta)} userId=${session.userId} sessionId=${session.id}`,
    );
    await this.writeAuditEvent(this.prismaService.client, {
      provider: 'session',
      kind: 'refresh',
      result: 'success',
      requestId: this.requestId(meta),
      userId: session.userId,
      sessionId: session.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      accessToken: signAccessToken(session.userId, session.id),
      refreshToken: signRefreshToken(session.userId, session.id, nextRefreshTokenId),
    };
  }

  async logout(sessionId?: string, meta: AuthRequestMeta = {}) {
    if (!sessionId) {
      this.logger.warn(
        `Logout without session: requestId=${this.requestId(meta)}`,
      );
      return { ok: true };
    }

    const result = await this.prismaService.client.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.logger.log(
      `Logout session revoke: requestId=${this.requestId(meta)} sessionId=${sessionId} revoked=${result.count}`,
    );
    await this.writeAuditEvent(this.prismaService.client, {
      provider: 'session',
      kind: 'logout',
      result: result.count > 0 ? 'revoked' : 'success',
      requestId: this.requestId(meta),
      sessionId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: {
        alreadyRevoked: result.count === 0,
      },
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
      try {
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
      } catch (error) {
        if (!this.isUniqueConstraintError(error)) {
          throw error;
        }
        isNewUser = false;
        this.logger.warn(
          `Concurrent phone registration resolved through existing user: phone=${maskPhoneNumber(phoneNumber)}`,
        );
      }
      user = await client.user.findUnique({
        where: { phoneNumber },
      });
    }

    if (!user) {
      throw new ApiError(500, 'auth_user_create_failed', 'Could not create user');
    }

    return { user, isNewUser };
  }

  async createSessionRecord(
    userId: string,
    provider: AuthSessionProvider = 'session',
    prisma?: DbClient,
  ) {
    const sessionId = randomUUID();
    const refreshTokenId = randomUUID();
    const client = prisma ?? this.prismaService.client;

    await client.session.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenId,
        provider,
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

  private async writeAuditEvent(
    prisma: DbClient,
    params: {
      provider: AuthSessionProvider;
      kind: 'start' | 'verify' | 'refresh' | 'logout';
      result: 'issued' | 'success' | 'rejected' | 'conflict' | 'rate_limited' | 'revoked';
      requestId: string;
      userId?: string;
      sessionId?: string;
      maskedPhone?: string;
      ip?: string;
      userAgent?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    await prisma.authAuditEvent.create({
      data: {
        provider: params.provider,
        kind: params.kind,
        result: params.result,
        requestId: params.requestId,
        userId: params.userId,
        sessionId: params.sessionId,
        maskedPhone: params.maskedPhone,
        ip: params.ip,
        userAgent: params.userAgent,
        metadata: this.toJsonValue(params.metadata),
      },
    });
  }

  private toJsonValue(value?: Record<string, unknown>) {
    if (value == null) {
      return undefined;
    }

    return value as Prisma.InputJsonValue;
  }

  private requestId(meta: AuthRequestMeta) {
    return meta.requestId ?? 'unknown';
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  normalizePhoneNumber(raw: string) {
    return this.normalizePhone(raw);
  }

  async getMe(userId: string) {
    const user = await this.prismaService.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        verified: true,
        online: true,
        profile: {
          select: {
            area: true,
            city: true,
          },
        },
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
        gender?: 'male' | 'female';
        city?: string;
        area?: string;
        bio?: string;
        vibe?: string;
      };
      onboarding?: {
        intent?: string;
        gender?: 'male' | 'female';
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
      gender: params.profile?.gender,
      city: params.profile?.city,
      area: params.profile?.area,
      bio: params.profile?.bio,
      vibe: params.profile?.vibe,
    };

    const onboardingPreset = {
      intent: params.onboarding?.intent,
      gender: params.onboarding?.gender ?? profilePreset.gender,
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
            gender: profilePreset.gender,
            city: profilePreset.city,
            area: profilePreset.area,
            bio: profilePreset.bio,
            vibe: profilePreset.vibe,
          },
        },
        onboarding: {
          create: {
            intent: onboardingPreset.intent,
            gender: onboardingPreset.gender,
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

  private isTestPhoneShortcutEnabled() {
    return process.env.ENABLE_TEST_PHONE_SHORTCUTS === 'true';
  }

  private buildRegistrationPreset(phoneNumber: string) {
    const digits = phoneNumber.replace(/\D/g, '');
    const suffix = digits.slice(-4);

    return {
      displayName: `Пользователь ${suffix}`,
      profile: {},
      onboarding: {
        interests: [],
      },
      settings: {
        allowLocation: false,
        allowPush: false,
        allowContacts: false,
        autoSharePlans: false,
        hideExactLocation: false,
        quietHours: false,
        showAge: true,
        discoverable: true,
        darkMode: false,
      },
    };
  }
}
