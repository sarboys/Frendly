import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  TELEGRAM_AUTH_CODE_LENGTH,
  TELEGRAM_AUTH_MAX_ATTEMPTS,
  TELEGRAM_AUTH_TTL_MS,
  buildTelegramBotUrl,
  generateTelegramStartToken,
  getTelegramAuthConfig,
  hashTelegramCode,
  hashTelegramCodeLookup,
  maskPhoneNumber,
} from '@big-break/database';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { AuthService } from './auth.service';
import { PrismaService } from './prisma.service';

type DbClient = PrismaClient | Prisma.TransactionClient;

interface AuthRequestMeta {
  startToken?: string;
  requestId: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class TelegramAuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async start(meta: AuthRequestMeta) {
    const config = this.getRequiredConfig();
    const botUsername = config.botUsername!;
    const expiresAt = new Date(Date.now() + TELEGRAM_AUTH_TTL_MS);
    const startToken = meta.startToken ?? generateTelegramStartToken();
    const existingSession = await this.prismaService.client.telegramLoginSession.findUnique({
      where: { startToken },
    });

    if (existingSession) {
      if (
        existingSession.consumedAt != null ||
        existingSession.expiresAt.getTime() <= Date.now() ||
        existingSession.status === 'failed'
      ) {
        await this.writeAuditEvent(this.prismaService.client, {
          provider: 'telegram',
          kind: 'start',
          result: 'rejected',
          requestId: meta.requestId,
          loginSessionId: existingSession.loginSessionId,
          telegramUserId: existingSession.telegramUserId ?? undefined,
          maskedPhone: existingSession.phoneNumber
            ? maskPhoneNumber(existingSession.phoneNumber)
            : undefined,
          ip: meta.ip,
          userAgent: meta.userAgent,
          metadata: {
            reused: true,
            reason: 'inactive_session',
          },
        });
        throw new ApiError(
          400,
          'invalid_telegram_login_session',
          'Telegram login session is invalid',
        );
      }

      await this.writeAuditEvent(this.prismaService.client, {
        provider: 'telegram',
        kind: 'start',
        result: 'issued',
        requestId: meta.requestId,
        loginSessionId: existingSession.loginSessionId,
        telegramUserId: existingSession.telegramUserId ?? undefined,
        maskedPhone: existingSession.phoneNumber
          ? maskPhoneNumber(existingSession.phoneNumber)
          : undefined,
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: {
          codeLength: TELEGRAM_AUTH_CODE_LENGTH,
          reused: true,
        },
      });

      return {
        loginSessionId: existingSession.loginSessionId,
        botUrl: buildTelegramBotUrl(botUsername, startToken),
        expiresAt: existingSession.expiresAt,
        codeLength: TELEGRAM_AUTH_CODE_LENGTH,
      };
    }

    const loginSessionId = randomUUID();

    await this.prismaService.client.telegramLoginSession.create({
      data: {
        loginSessionId,
        startToken,
        status: 'pending_bot',
        expiresAt,
      },
    });

    await this.writeAuditEvent(this.prismaService.client, {
      provider: 'telegram',
      kind: 'start',
      result: 'issued',
      requestId: meta.requestId,
      loginSessionId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: {
        codeLength: TELEGRAM_AUTH_CODE_LENGTH,
        reused: false,
      },
    });

    return {
      loginSessionId,
      botUrl: buildTelegramBotUrl(botUsername, startToken),
      expiresAt,
      codeLength: TELEGRAM_AUTH_CODE_LENGTH,
    };
  }

  async verify(
    code: string,
    meta: AuthRequestMeta,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    userId: string;
    isNewUser: boolean;
  }> {
    this.getRequiredConfig();
    const prisma = this.prismaService.client;
    const now = new Date();
    const codeLookup = hashTelegramCodeLookup(code);
    const sessions = await prisma.telegramLoginSession.findMany({
      where: {
        codeLookup,
        status: 'code_issued',
        consumedAt: null,
        expiresAt: {
          gt: now,
        },
      },
    });

    if (sessions.length === 0) {
      await this.writeAuditEvent(prisma, {
        provider: 'telegram',
        kind: 'verify',
        result: 'rejected',
        requestId: meta.requestId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new ApiError(
        400,
        'invalid_telegram_code',
        'Telegram code is invalid',
      );
    }

    if (sessions.length > 1) {
      await this.writeAuditEvent(prisma, {
        provider: 'telegram',
        kind: 'verify',
        result: 'conflict',
        requestId: meta.requestId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: {
          duplicateCodeLookup: true,
        },
      });
      throw new ApiError(
        409,
        'telegram_auth_conflict',
        'Telegram auth resolves to different users',
      );
    }

    const session = sessions[0]!;

    if (
      !session.telegramUserId ||
      !session.chatId ||
      !session.phoneNumber ||
      !session.codeSalt ||
      !session.codeHash ||
      !session.codeLookup
    ) {
      await this.writeAuditEvent(prisma, {
        provider: 'telegram',
        kind: 'verify',
        result: 'rejected',
        requestId: meta.requestId,
        loginSessionId: session.loginSessionId,
        telegramUserId: session.telegramUserId ?? undefined,
        maskedPhone: session.phoneNumber ? maskPhoneNumber(session.phoneNumber) : undefined,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new ApiError(
        400,
        'invalid_telegram_code',
        'Telegram code is invalid',
      );
    }

    const expectedHash = hashTelegramCode(code, session.codeSalt);
    if (expectedHash !== session.codeHash) {
      const nextAttemptCount = session.attemptCount + 1;
      const limited = nextAttemptCount >= TELEGRAM_AUTH_MAX_ATTEMPTS;

      await prisma.telegramLoginSession.update({
        where: { id: session.id },
        data: {
          attemptCount: nextAttemptCount,
          consumedAt: limited ? now : undefined,
          status: limited ? 'failed' : undefined,
        },
      });

      await this.writeAuditEvent(prisma, {
        provider: 'telegram',
        kind: 'verify',
        result: limited ? 'rate_limited' : 'rejected',
        requestId: meta.requestId,
        loginSessionId: session.loginSessionId,
        telegramUserId: session.telegramUserId,
        maskedPhone: maskPhoneNumber(session.phoneNumber),
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      throw new ApiError(
        limited ? 429 : 400,
        limited ? 'telegram_auth_rate_limited' : 'invalid_telegram_code',
        limited ? 'Telegram auth is rate limited' : 'Telegram code is invalid',
      );
    }

    const existingTelegramAccount = await prisma.telegramAccount.findUnique({
      where: { telegramUserId: session.telegramUserId },
      include: {
        user: true,
      },
    });
    const existingPhoneUser = await prisma.user.findUnique({
      where: { phoneNumber: session.phoneNumber },
    });

    if (
      existingTelegramAccount &&
      existingPhoneUser &&
      existingTelegramAccount.userId !== existingPhoneUser.id
    ) {
      await prisma.telegramLoginSession.update({
        where: { id: session.id },
        data: {
          status: 'failed',
          consumedAt: now,
        },
      });

      await this.writeAuditEvent(prisma, {
        provider: 'telegram',
        kind: 'verify',
        result: 'conflict',
        requestId: meta.requestId,
        loginSessionId: session.loginSessionId,
        telegramUserId: session.telegramUserId,
        maskedPhone: maskPhoneNumber(session.phoneNumber),
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      throw new ApiError(
        409,
        'telegram_auth_conflict',
        'Telegram auth resolves to different users',
      );
    }

    return prisma.$transaction(async (tx) => {
      const resolvedUser = existingTelegramAccount?.user;
      const resolvedByPhone = existingPhoneUser
        ? { user: existingPhoneUser, isNewUser: false }
        : await this.authService.findOrCreateUserByPhoneNumber(session.phoneNumber!, tx);
      const user = resolvedUser ?? resolvedByPhone.user;
      const isNewUser = resolvedUser ? false : resolvedByPhone.isNewUser;

      const consumeResult = await tx.telegramLoginSession.updateMany({
        where: {
          id: session.id,
          status: 'code_issued',
          consumedAt: null,
        },
        data: {
          status: 'consumed',
          consumedAt: now,
        },
      });

      if (consumeResult.count === 0) {
        throw new ApiError(
          400,
          'invalid_telegram_login_session',
          'Telegram login session is invalid',
        );
      }

      await tx.telegramAccount.upsert({
        where: { telegramUserId: session.telegramUserId! },
        create: {
          userId: user.id,
          telegramUserId: session.telegramUserId!,
          chatId: session.chatId!,
          username: session.username,
          firstName: session.firstName,
          lastName: session.lastName,
          lastLoginAt: now,
        },
        update: {
          userId: user.id,
          chatId: session.chatId!,
          username: session.username,
          firstName: session.firstName,
          lastName: session.lastName,
          lastLoginAt: now,
        },
      });

      const createdSession = await this.authService.createSessionRecord(user.id, tx);

      await this.writeAuditEvent(tx, {
        provider: 'telegram',
        kind: 'verify',
        result: 'success',
        requestId: meta.requestId,
        userId: user.id,
        telegramUserId: session.telegramUserId!,
        loginSessionId: session.loginSessionId,
        sessionId: createdSession.sessionId,
        maskedPhone: maskPhoneNumber(session.phoneNumber!),
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: {
          isNewUser,
        },
      });

      return {
        ...createdSession.tokens,
        userId: user.id,
        isNewUser,
      };
    });
  }

  private getRequiredConfig() {
    const config = getTelegramAuthConfig();
    if (!config.enabled || !config.botToken || !config.botUsername) {
      throw new ApiError(
        503,
        'telegram_auth_unavailable',
        'Telegram auth delivery is unavailable',
      );
    }

    return config;
  }

  private toJsonValue(value?: Record<string, unknown>) {
    if (value == null) {
      return undefined;
    }

    return value as Prisma.InputJsonValue;
  }

  private async writeAuditEvent(
    prisma: DbClient,
    params: {
      provider: 'telegram';
      kind: 'start' | 'verify';
      result: 'issued' | 'success' | 'rejected' | 'conflict' | 'rate_limited';
      requestId: string;
      userId?: string;
      telegramUserId?: string;
      loginSessionId?: string;
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
        telegramUserId: params.telegramUserId,
        loginSessionId: params.loginSessionId,
        sessionId: params.sessionId,
        maskedPhone: params.maskedPhone,
        ip: params.ip,
        userAgent: params.userAgent,
        metadata: this.toJsonValue(params.metadata),
      },
    });
  }
}
