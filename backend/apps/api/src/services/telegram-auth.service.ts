import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  TelegramDispatchAction,
  TelegramDispatchRequest,
  TelegramDispatchResponse,
} from '@big-break/contracts';
import {
  TELEGRAM_AUTH_CONTACT_COOLDOWN_MS,
  TELEGRAM_AUTH_CODE_LENGTH,
  TELEGRAM_AUTH_MAX_ATTEMPTS,
  TELEGRAM_AUTH_TTL_MS,
  buildTelegramBotUrl,
  createTelegramCodePayload,
  deriveTelegramCodeFromSalt,
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

const TELEGRAM_CODE_ADVISORY_LOCK = 9223370;

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
    loginSessionId: string,
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
    const session = await prisma.telegramLoginSession.findUnique({
      where: { loginSessionId },
    });

    if (
      !session ||
      session.status !== 'code_issued' ||
      session.consumedAt != null ||
      session.expiresAt.getTime() <= now.getTime()
    ) {
      await this.writeAuditEvent(prisma, {
        provider: 'telegram',
        kind: 'verify',
        result: 'rejected',
        requestId: meta.requestId,
        loginSessionId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: {
          reason: 'invalid_login_session',
        },
      });
      throw new ApiError(
        400,
        'invalid_telegram_login_session',
        'Telegram login session is invalid',
      );
    }

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

    if (session.attemptCount >= TELEGRAM_AUTH_MAX_ATTEMPTS) {
      await prisma.telegramLoginSession.updateMany({
        where: {
          id: session.id,
          consumedAt: null,
        },
        data: {
          consumedAt: now,
          status: 'failed',
        },
      });
      await this.writeAuditEvent(prisma, {
        provider: 'telegram',
        kind: 'verify',
        result: 'rate_limited',
        requestId: meta.requestId,
        loginSessionId: session.loginSessionId,
        telegramUserId: session.telegramUserId,
        maskedPhone: maskPhoneNumber(session.phoneNumber),
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: {
          reason: 'max_attempts',
        },
      });
      throw new ApiError(
        429,
        'telegram_auth_rate_limited',
        'Telegram auth is rate limited',
      );
    }

    const expectedHash = hashTelegramCode(code, session.codeSalt);
    if (expectedHash !== session.codeHash) {
      const nextAttemptCount = session.attemptCount + 1;
      const limited = nextAttemptCount >= TELEGRAM_AUTH_MAX_ATTEMPTS;

      const attemptUpdate = await prisma.telegramLoginSession.updateMany({
        where: {
          id: session.id,
          status: 'code_issued',
          consumedAt: null,
        },
        data: {
          attemptCount: {
            increment: 1,
          },
          ...(limited
            ? {
                consumedAt: now,
                status: 'failed' as const,
              }
            : {}),
        },
      });
      if (attemptUpdate.count === 0) {
        throw new ApiError(
          400,
          'invalid_telegram_login_session',
          'Telegram login session is invalid',
        );
      }

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
        metadata: {
          reason: limited ? 'max_attempts' : 'invalid_code',
          attemptCount: nextAttemptCount,
        },
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

      const createdSession = await this.authService.createSessionRecord(
        user.id,
        'telegram',
        tx,
      );

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

  async dispatch(
    input: TelegramDispatchRequest,
    meta: AuthRequestMeta,
  ): Promise<TelegramDispatchResponse> {
    const telegramUserId = input.telegramUserId.trim();
    const chatId = input.chatId.trim();

    if (telegramUserId.length === 0 || chatId.length === 0) {
      throw new ApiError(400, 'invalid_telegram_dispatch', 'Telegram dispatch is invalid');
    }

    if (input.kind === 'contact') {
      return {
        actions: await this.handleContactDispatch(
          {
            ...input,
            telegramUserId,
            chatId,
          },
          meta,
        ),
      };
    }

    return {
      actions: await this.handleStartDispatch(
        {
          ...input,
          telegramUserId,
          chatId,
        },
        meta,
      ),
    };
  }

  private getRequiredConfig() {
    const config = getTelegramAuthConfig();
    if (!config.enabled || !config.botUsername) {
      throw new ApiError(
        503,
        'telegram_auth_unavailable',
        'Telegram auth delivery is unavailable',
      );
    }

    return config;
  }

  private async handleStartDispatch(
    input: TelegramDispatchRequest,
    meta: AuthRequestMeta,
  ): Promise<TelegramDispatchAction[]> {
    const rawPayload = input.startPayload?.trim() ?? '';
    if (rawPayload.length > 0 && !rawPayload.startsWith('login_')) {
      return [
        this.buildSendMessageAction(
          'Ссылка входа невалидна. Вернись в приложение и начни вход заново.',
        ),
      ];
    }

    if (input.startToken?.trim()) {
      return this.handleDeepLinkStartDispatch(
        {
          ...input,
          startToken: input.startToken.trim(),
        },
        meta,
      );
    }

    return this.handlePlainStartDispatch(input, meta);
  }

  private async handlePlainStartDispatch(
    input: TelegramDispatchRequest,
    meta: AuthRequestMeta,
  ): Promise<TelegramDispatchAction[]> {
    const linkedAccount = await this.findLinkedAccount(input.telegramUserId);
    if (linkedAccount?.user?.phoneNumber) {
      const existingSession = await this.prismaService.client.telegramLoginSession.findFirst({
        where: {
          telegramUserId: input.telegramUserId,
          consumedAt: null,
          expiresAt: {
            gt: new Date(),
          },
          status: {
            in: ['code_issued'],
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      const sessionId = existingSession?.id ??
        (
          await this.prismaService.client.telegramLoginSession.create({
            data: {
              loginSessionId: randomUUID(),
              startToken: randomUUID(),
              status: 'pending_bot',
              telegramUserId: input.telegramUserId,
              chatId: input.chatId,
              username: input.username,
              firstName: input.firstName,
              lastName: input.lastName,
              expiresAt: new Date(Date.now() + TELEGRAM_AUTH_TTL_MS),
            },
          })
        ).id;

      return [
        await this.issueCodeForSession(
          sessionId,
          linkedAccount.user.phoneNumber,
          input,
          meta,
        ),
      ];
    }

    const session = await this.prismaService.client.telegramLoginSession.findFirst({
      where: {
        telegramUserId: input.telegramUserId,
        consumedAt: null,
        expiresAt: {
          gt: new Date(),
        },
        status: {
          in: ['awaiting_contact'],
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!session) {
      await this.prismaService.client.telegramLoginSession.create({
        data: {
          loginSessionId: randomUUID(),
          startToken: randomUUID(),
          status: 'awaiting_contact',
          telegramUserId: input.telegramUserId,
          chatId: input.chatId,
          username: input.username,
          firstName: input.firstName,
          lastName: input.lastName,
          expiresAt: new Date(Date.now() + TELEGRAM_AUTH_TTL_MS),
        },
      });
    }

    return [this.buildContactPromptAction()];
  }

  private async handleDeepLinkStartDispatch(
    input: TelegramDispatchRequest,
    meta: AuthRequestMeta,
  ): Promise<TelegramDispatchAction[]> {
    const session = await this.prismaService.client.telegramLoginSession.findUnique({
      where: { startToken: input.startToken! },
    });

    if (!session) {
      const linkedAccount = await this.findLinkedAccount(input.telegramUserId);
      const createdSession = await this.prismaService.client.telegramLoginSession.create({
        data: {
          loginSessionId: randomUUID(),
          startToken: input.startToken!,
          status: linkedAccount?.user?.phoneNumber ? 'pending_bot' : 'awaiting_contact',
          telegramUserId: input.telegramUserId,
          chatId: input.chatId,
          username: input.username,
          firstName: input.firstName,
          lastName: input.lastName,
          expiresAt: new Date(Date.now() + TELEGRAM_AUTH_TTL_MS),
        },
      });

      if (linkedAccount?.user?.phoneNumber) {
        return [
          await this.issueCodeForSession(
            createdSession.id,
            linkedAccount.user.phoneNumber,
            input,
            meta,
          ),
        ];
      }

      return [this.buildContactPromptAction()];
    }

    if (session.telegramUserId != null && session.telegramUserId !== input.telegramUserId) {
      return [
        this.buildSendMessageAction(
          'Эта ссылка уже открыта в другом аккаунте Telegram. Вернись в приложение и начни вход заново.',
        ),
      ];
    }

    if (
      session.consumedAt != null ||
      session.expiresAt.getTime() <= Date.now() ||
      session.status === 'failed'
    ) {
      return [
        this.buildSendMessageAction(
          'Эта ссылка уже устарела. Вернись в приложение и начни вход заново.',
        ),
      ];
    }

    const linkedAccount = await this.findLinkedAccount(input.telegramUserId);
    const updatedSession = await this.prismaService.client.telegramLoginSession.update({
      where: { id: session.id },
      data: {
        status: linkedAccount?.user?.phoneNumber ? 'pending_bot' : 'awaiting_contact',
        telegramUserId: input.telegramUserId,
        chatId: input.chatId,
        username: input.username,
        firstName: input.firstName,
        lastName: input.lastName,
      },
    });

    if (linkedAccount?.user?.phoneNumber) {
      return [
        await this.issueCodeForSession(
          updatedSession.id,
          linkedAccount.user.phoneNumber,
          input,
          meta,
        ),
      ];
    }

    return [this.buildContactPromptAction()];
  }

  private async handleContactDispatch(
    input: TelegramDispatchRequest,
    meta: AuthRequestMeta,
  ): Promise<TelegramDispatchAction[]> {
    const normalizedPhone = this.authService.normalizePhoneNumber(input.phoneNumber ?? '');
    if (!normalizedPhone) {
      return [
        this.buildSendMessageAction(
          'Не удалось прочитать номер. Нажми /start и попробуй еще раз.',
        ),
      ];
    }

    const session = await this.prismaService.client.telegramLoginSession.findFirst({
      where: {
        telegramUserId: input.telegramUserId,
        chatId: input.chatId,
        consumedAt: null,
        expiresAt: {
          gt: new Date(),
        },
        status: {
          in: ['awaiting_contact', 'code_issued'],
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!session) {
      return [
        this.buildSendMessageAction(
          'Сначала нажми /start, потом поделись номером телефона.',
        ),
      ];
    }

    return [
      await this.issueCodeForSession(
        session.id,
        normalizedPhone,
        input,
        meta,
      ),
    ];
  }

  private async issueCodeForSession(
    sessionId: string,
    phoneNumber: string,
    input: TelegramDispatchRequest,
    meta: AuthRequestMeta,
  ): Promise<TelegramDispatchAction> {
    return this.prismaService.client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${TELEGRAM_CODE_ADVISORY_LOCK})`);

      const currentSession = await tx.telegramLoginSession.findUnique({
        where: { id: sessionId },
      });
      if (!currentSession) {
        throw new ApiError(404, 'telegram_session_not_found', 'Telegram session not found');
      }

      const now = new Date();
      if (
        currentSession.status === 'code_issued' &&
        currentSession.codeSalt != null &&
        currentSession.codeHash != null &&
        currentSession.codeLookup != null &&
        currentSession.lastCodeIssuedAt != null &&
        currentSession.phoneNumber === phoneNumber &&
        now.getTime() - currentSession.lastCodeIssuedAt.getTime() < TELEGRAM_AUTH_CONTACT_COOLDOWN_MS
      ) {
        const code = deriveTelegramCodeFromSalt(currentSession.codeSalt);
        return this.buildSendCodeAction(code);
      }

      for (let attempt = 0; attempt < 32; attempt += 1) {
        const payload = createTelegramCodePayload();
        const codeLookup = hashTelegramCodeLookup(payload.code);
        const existing = await tx.telegramLoginSession.findFirst({
          where: {
            id: {
              not: sessionId,
            },
            codeLookup,
            status: {
              in: ['code_issued'],
            },
            consumedAt: null,
            expiresAt: {
              gt: now,
            },
          },
        });

        if (existing) {
          continue;
        }

        await tx.telegramLoginSession.update({
          where: { id: sessionId },
          data: {
            status: 'code_issued',
            telegramUserId: input.telegramUserId,
            chatId: input.chatId,
            username: input.username,
            firstName: input.firstName,
            lastName: input.lastName,
            phoneNumber,
            codeSalt: payload.salt,
            codeHash: payload.hash,
            codeLookup,
            attemptCount: 0,
            lastCodeIssuedAt: now,
          },
        });

        await this.writeAuditEvent(tx, {
          provider: 'telegram',
          kind: 'start',
          result: 'issued',
          requestId: meta.requestId,
          loginSessionId: currentSession.loginSessionId,
          telegramUserId: input.telegramUserId,
          maskedPhone: maskPhoneNumber(phoneNumber),
          ip: meta.ip,
          userAgent: meta.userAgent,
          metadata: {
            codeLength: TELEGRAM_AUTH_CODE_LENGTH,
            dispatchKind: input.kind,
          },
        });

        return this.buildSendCodeAction(payload.code);
      }

      throw new ApiError(
        503,
        'telegram_auth_rate_limited',
        'Telegram auth is rate limited',
      );
    });
  }

  private async findLinkedAccount(telegramUserId: string) {
    return this.prismaService.client.telegramAccount.findUnique({
      where: { telegramUserId },
      include: {
        user: {
          select: {
            id: true,
            phoneNumber: true,
          },
        },
      },
    });
  }

  private buildSendCodeAction(code: string): TelegramDispatchAction {
    return this.buildSendMessageAction(
      `Код для входа: ${code}\nВведи его в приложении.`,
      {
        remove_keyboard: true,
      },
    );
  }

  private buildContactPromptAction(): TelegramDispatchAction {
    return this.buildSendMessageAction(
      'Поделись номером телефона, чтобы получить код для входа.',
      {
        keyboard: [
          [
            {
              text: 'Поделиться контактом',
              request_contact: true,
            },
          ],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    );
  }

  private buildSendMessageAction(
    text: string,
    replyMarkup?: Record<string, unknown>,
  ): TelegramDispatchAction {
    return {
      type: 'send_message',
      text,
      replyMarkup,
    };
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
