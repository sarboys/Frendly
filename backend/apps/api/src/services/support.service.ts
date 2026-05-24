import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { TelegramDispatchAction, TelegramDispatchRequest } from '@big-break/contracts';
import {
  TELEGRAM_SUPPORT_TOKEN_TTL_MS,
  buildTelegramSupportBotUrl,
  normalizeTelegramBotUsername,
} from '@big-break/database';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

@Injectable()
export class SupportService {
  constructor(private readonly prismaService: PrismaService) {}

  async startTelegramSupport(userId: string) {
    const botUsername = this.getSupportBotUsername();
    const token = randomBytes(24).toString('hex');
    const tokenHash = this.hashSupportToken(token);

    await this.prismaService.client.telegramSupportToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt: new Date(Date.now() + TELEGRAM_SUPPORT_TOKEN_TTL_MS),
      },
    });

    return {
      botUrl: buildTelegramSupportBotUrl(botUsername, token),
    };
  }

  async handleTelegramDispatch(
    input: TelegramDispatchRequest,
  ): Promise<TelegramDispatchAction[]> {
    switch (input.kind) {
      case 'support_start':
        return this.handleSupportStart(input);
      case 'support_message':
        return this.handleSupportMessage(input);
      case 'support_reply':
        return this.handleSupportReply(input);
      default:
        return [];
    }
  }

  private async handleSupportStart(
    input: TelegramDispatchRequest,
  ): Promise<TelegramDispatchAction[]> {
    const token = this.extractSupportToken(input.startPayload);
    if (!token) {
      return [
        this.buildSendMessageAction(
          'Ссылка поддержки устарела. Открой поддержку в приложении еще раз.',
        ),
      ];
    }

    const tokenHash = this.hashSupportToken(token);
    const supportToken = await this.prismaService.client.telegramSupportToken.findUnique({
      where: { tokenHash },
    });
    if (
      !supportToken ||
      supportToken.consumedAt != null ||
      supportToken.expiresAt.getTime() <= Date.now()
    ) {
      return [
        this.buildSendMessageAction(
          'Ссылка поддержки устарела. Открой поддержку в приложении еще раз.',
        ),
      ];
    }

    const now = new Date();
    const consumeResult = await this.prismaService.client.telegramSupportToken.updateMany({
      where: {
        tokenHash,
        consumedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: { consumedAt: now },
    });
    if (consumeResult.count === 0) {
      return [
        this.buildSendMessageAction(
          'Ссылка поддержки устарела. Открой поддержку в приложении еще раз.',
        ),
      ];
    }

    await this.prismaService.client.telegramSupportSession.updateMany({
      where: {
        telegramUserId: input.telegramUserId,
        chatId: input.chatId,
        status: 'active',
        userId: {
          not: supportToken.userId,
        },
      },
      data: {
        status: 'replaced',
      },
    });
    await this.prismaService.client.telegramSupportSession.upsert({
      where: { userId: supportToken.userId },
      create: {
        userId: supportToken.userId,
        telegramUserId: input.telegramUserId,
        chatId: input.chatId,
        username: input.username,
        firstName: input.firstName,
        lastName: input.lastName,
        status: 'active',
      },
      update: {
        telegramUserId: input.telegramUserId,
        chatId: input.chatId,
        username: input.username,
        firstName: input.firstName,
        lastName: input.lastName,
        status: 'active',
      },
    });

    return [this.buildSendMessageAction('Напишите вопрос, мы ответим здесь.')];
  }

  private async handleSupportMessage(
    input: TelegramDispatchRequest,
  ): Promise<TelegramDispatchAction[]> {
    const text = input.text?.trim();
    if (!text) {
      return [];
    }

    const session = await this.prismaService.client.telegramSupportSession.findFirst({
      where: {
        telegramUserId: input.telegramUserId,
        chatId: input.chatId,
        status: 'active',
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            phoneNumber: true,
            email: true,
          },
        },
      },
    });
    if (!session) {
      return [
        this.buildSendMessageAction(
          'Открой поддержку в приложении, чтобы мы связали Telegram с аккаунтом Frendly.',
        ),
      ];
    }

    const supportGroupChatId = this.getSupportGroupChatId();
    if (!supportGroupChatId) {
      return [
        this.buildSendMessageAction(
          'Поддержка временно недоступна. Попробуйте позже.',
        ),
      ];
    }

    await this.prismaService.client.telegramSupportSession.update({
      where: { id: session.id },
      data: { lastMessageAt: new Date() },
    });

    return [
      this.buildSendMessageAction(
        this.buildSupportGroupMessage(session.user, input, text),
        undefined,
        supportGroupChatId,
      ),
    ];
  }

  private async handleSupportReply(
    input: TelegramDispatchRequest,
  ): Promise<TelegramDispatchAction[]> {
    const text = input.text?.trim();
    const userId = this.extractUserIdFromSupportCard(input.replyToText);
    const supportGroupChatId = this.getSupportGroupChatId();
    if (!text || !userId || !supportGroupChatId || input.chatId !== supportGroupChatId) {
      return [];
    }

    const session = await this.prismaService.client.telegramSupportSession.findFirst({
      where: {
        userId,
        status: 'active',
      },
    });
    if (!session) {
      return [];
    }

    return [this.buildSendMessageAction(text, undefined, session.chatId)];
  }

  private buildSupportGroupMessage(
    user: {
      id: string;
      displayName: string;
      phoneNumber: string | null;
      email: string | null;
    },
    input: TelegramDispatchRequest,
    text: string,
  ) {
    const telegramName = input.username ? `@${input.username}` : 'не указан';
    return [
      'Frendly support',
      `User ID: ${user.id}`,
      `Имя: ${user.displayName}`,
      `Телефон: ${user.phoneNumber ?? 'не указан'}`,
      `Email: ${user.email ?? 'не указан'}`,
      `Telegram: ${telegramName}`,
      '',
      'Message:',
      text,
    ].join('\n');
  }

  private extractSupportToken(payload?: string) {
    const trimmed = payload?.trim() ?? '';
    if (!trimmed.startsWith('support_')) {
      return undefined;
    }

    const token = trimmed.slice('support_'.length);
    return token.length > 0 ? token : undefined;
  }

  private extractUserIdFromSupportCard(text?: string) {
    const match = text?.match(/^User ID:\s*(\S+)/m);
    return match?.[1];
  }

  private buildSendMessageAction(
    text: string,
    replyMarkup?: Record<string, unknown>,
    chatId?: string,
  ): TelegramDispatchAction {
    return {
      type: 'send_message',
      ...(chatId == null ? {} : { chatId }),
      text,
      ...(replyMarkup == null ? {} : { replyMarkup }),
    };
  }

  private getSupportBotUsername() {
    const username =
      normalizeTelegramBotUsername(process.env.TELEGRAM_SUPPORT_BOT_USERNAME) ??
      normalizeTelegramBotUsername(process.env.TELEGRAM_BOT_USERNAME);
    const enabled =
      process.env.TELEGRAM_SUPPORT_ENABLED === 'true' ||
      process.env.TELEGRAM_AUTH_ENABLED === 'true';
    if (!enabled || !username) {
      throw new ApiError(
        503,
        'telegram_support_unavailable',
        'Telegram support is unavailable',
      );
    }

    return username;
  }

  private getSupportGroupChatId() {
    return process.env.TELEGRAM_SUPPORT_GROUP_CHAT_ID?.trim();
  }

  private hashSupportToken(token: string) {
    return createHash('sha256').update(`telegram-support:${token}`).digest('hex');
  }
}
