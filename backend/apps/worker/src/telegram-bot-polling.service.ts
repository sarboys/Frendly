import {
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  TELEGRAM_AUTH_CONTACT_COOLDOWN_MS,
  TELEGRAM_AUTH_TTL_MS,
  TELEGRAM_BOT_STATE_ID,
  createTelegramCodePayload,
  deriveTelegramCodeFromSalt,
  getTelegramAuthConfig,
  hashTelegramCodeLookup,
} from '@big-break/database';
import { PrismaService } from './prisma.service';

type FetchLike = typeof fetch;

type TelegramMessage = {
  text?: string;
  chat?: {
    id: number;
    type: string;
  };
  from?: {
    id: number;
    is_bot: boolean;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  contact?: {
    user_id?: number;
    phone_number?: string;
  };
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

@Injectable()
export class TelegramBotPollingService implements OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private initialized = false;
  private started = false;
  private polling = false;
  private backoffMs = 0;
  private fetchImpl: FetchLike = fetch;

  constructor(private readonly prismaService: PrismaService) {}

  setFetchImpl(fetchImpl: FetchLike) {
    this.fetchImpl = fetchImpl;
  }

  async start() {
    if (!this.isEnabled()) {
      return;
    }

    if (this.started) {
      return;
    }

    this.started = true;
    await this.ensureInitialized();
    this.scheduleNext(this.getPollIntervalMs());
  }

  async onModuleDestroy() {
    this.started = false;
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  async pollOnce() {
    if (!this.isEnabled() || this.polling) {
      return;
    }

    this.polling = true;
    try {
      await this.ensureInitialized();
      const state = await this.prismaService.client.telegramBotState.findUnique({
        where: { id: TELEGRAM_BOT_STATE_ID },
      });
      const offset = state?.lastUpdateId != null ? Number(state.lastUpdateId) + 1 : undefined;
      const updates = await this.callTelegram<TelegramUpdate[]>('getUpdates', {
        timeout: 0,
        ...(offset == null ? {} : { offset }),
      });

      let lastUpdateId = state?.lastUpdateId ?? null;
      for (const update of updates) {
        await this.handleUpdate(update);
        lastUpdateId = BigInt(update.update_id);
      }

      if (lastUpdateId !== state?.lastUpdateId) {
        await this.prismaService.client.telegramBotState.update({
          where: { id: TELEGRAM_BOT_STATE_ID },
          data: {
            lastUpdateId,
          },
        });
      }
    } finally {
      this.polling = false;
    }
  }

  private async ensureInitialized() {
    if (!this.isEnabled() || this.initialized) {
      return;
    }

    await this.prismaService.client.telegramBotState.upsert({
      where: { id: TELEGRAM_BOT_STATE_ID },
      create: {
        id: TELEGRAM_BOT_STATE_ID,
      },
      update: {},
    });

    await this.callTelegram('deleteWebhook', {
      drop_pending_updates: false,
    });

    this.initialized = true;
  }

  private scheduleNext(delayMs: number) {
    if (!this.started) {
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(async () => {
      try {
        await this.pollOnce();
        this.backoffMs = 0;
        this.scheduleNext(this.getPollIntervalMs());
      } catch {
        this.backoffMs = this.backoffMs === 0
          ? this.getPollIntervalMs()
          : Math.min(this.backoffMs * 2, 30_000);
        this.scheduleNext(this.backoffMs);
      }
    }, delayMs);
  }

  private async handleUpdate(update: TelegramUpdate) {
    const message = update.message;
    if (!message?.chat || message.chat.type !== 'private' || !message.from || message.from.is_bot) {
      return;
    }

    if (typeof message.text === 'string' && message.text.startsWith('/start')) {
      await this.handleStartCommand(message);
      return;
    }

    if (message.contact) {
      await this.handleContact(message);
    }
  }

  private async handleStartCommand(message: TelegramMessage) {
    const chat = message.chat!;
    const payload = message.text?.trim().split(/\s+/)[1] ?? '';
    if (payload.length === 0) {
      await this.handlePlainStart(message);
      return;
    }

    const startToken = this.extractStartToken(payload);
    if (!startToken) {
      await this.sendMessage(
        chat.id,
        'Ссылка входа невалидна. Вернись в приложение и начни вход заново.',
      );
      return;
    }

    await this.handleDeepLinkStart(message, startToken);
  }

  private async handlePlainStart(message: TelegramMessage) {
    const linkedAccount = await this.findLinkedAccount(`${message.from!.id}`);
    if (linkedAccount?.user?.phoneNumber != null) {
      const existingSession = await this.prismaService.client.telegramLoginSession.findFirst({
        where: {
          telegramUserId: `${message.from!.id}`,
          chatId: `${message.chat!.id}`,
          consumedAt: null,
          expiresAt: {
            gt: new Date(),
          },
          status: {
            in: ['code_issued'],
          },
        },
      });

      await this.issueCodeForSession(
        existingSession?.id ??
            (
              await this.prismaService.client.telegramLoginSession.create({
                data: {
                  loginSessionId: randomUUID(),
                  startToken: randomUUID(),
                  status: 'pending_bot',
                  telegramUserId: `${message.from!.id}`,
                  chatId: `${message.chat!.id}`,
                  username: message.from?.username,
                  firstName: message.from?.first_name,
                  lastName: message.from?.last_name,
                  expiresAt: new Date(Date.now() + TELEGRAM_AUTH_TTL_MS),
                },
              })
            ).id,
        linkedAccount.user.phoneNumber,
        message,
      );
      return;
    }

    const session = await this.prismaService.client.telegramLoginSession.findFirst({
      where: {
        telegramUserId: `${message.from!.id}`,
        chatId: `${message.chat!.id}`,
        consumedAt: null,
        expiresAt: {
          gt: new Date(),
        },
        status: {
          in: ['awaiting_contact'],
        },
      },
    });

    if (!session) {
      await this.prismaService.client.telegramLoginSession.create({
        data: {
          loginSessionId: randomUUID(),
          startToken: randomUUID(),
          status: 'awaiting_contact',
          telegramUserId: `${message.from!.id}`,
          chatId: `${message.chat!.id}`,
          username: message.from?.username,
          firstName: message.from?.first_name,
          lastName: message.from?.last_name,
          expiresAt: new Date(Date.now() + TELEGRAM_AUTH_TTL_MS),
        },
      });
    }
    await this.sendContactPrompt(message.chat!.id);
  }

  private async handleDeepLinkStart(message: TelegramMessage, startToken: string) {
    const chat = message.chat!;

    const incomingTelegramUserId = `${message.from!.id}`;
    const session = await this.prismaService.client.telegramLoginSession.findUnique({
      where: { startToken },
    });

    if (!session) {
      await this.prismaService.client.telegramLoginSession.create({
        data: {
          loginSessionId: randomUUID(),
          startToken,
          status: 'awaiting_contact',
          telegramUserId: incomingTelegramUserId,
          chatId: `${chat.id}`,
          username: message.from?.username,
          firstName: message.from?.first_name,
          lastName: message.from?.last_name,
          expiresAt: new Date(Date.now() + TELEGRAM_AUTH_TTL_MS),
        },
      });

      const linkedAccount = await this.findLinkedAccount(incomingTelegramUserId);
      if (linkedAccount?.user?.phoneNumber != null) {
        const createdSession = await this.prismaService.client.telegramLoginSession.findUnique({
          where: { startToken },
        });
        if (createdSession) {
          await this.issueCodeForSession(
            createdSession.id,
            linkedAccount.user.phoneNumber,
            message,
          );
        }
      } else {
        await this.sendContactPrompt(chat.id);
      }
      return;
    }

    if (session.telegramUserId != null && session.telegramUserId !== incomingTelegramUserId) {
      await this.sendMessage(
        chat.id,
        'Эта ссылка уже открыта в другом аккаунте Telegram. Вернись в приложение и начни вход заново.',
      );
      return;
    }

    if (
      session.consumedAt != null ||
      session.expiresAt.getTime() <= Date.now() ||
      session.status === 'failed'
    ) {
      await this.sendMessage(
        chat.id,
        'Эта ссылка уже устарела. Вернись в приложение и начни вход заново.',
      );
      return;
    }

    const linkedAccount = await this.findLinkedAccount(incomingTelegramUserId);
    const updatedSession = await this.prismaService.client.telegramLoginSession.update({
      where: { id: session.id },
      data: {
        status:
            linkedAccount?.user?.phoneNumber != null ? 'pending_bot' : 'awaiting_contact',
        telegramUserId: incomingTelegramUserId,
        chatId: `${chat.id}`,
        username: message.from?.username,
        firstName: message.from?.first_name,
        lastName: message.from?.last_name,
      },
    });

    if (linkedAccount?.user?.phoneNumber != null) {
      await this.issueCodeForSession(
        updatedSession.id,
        linkedAccount.user.phoneNumber,
        message,
      );
      return;
    }

    await this.sendContactPrompt(chat.id);
  }

  private async handleContact(message: TelegramMessage) {
    const chat = message.chat!;
    const telegramUserId = `${message.from!.id}`;
    const chatId = `${chat.id}`;
    const contactUserId = message.contact?.user_id;
    if (contactUserId == null || `${contactUserId}` !== telegramUserId) {
      return;
    }

    const normalizedPhone = this.normalizePhone(message.contact?.phone_number ?? '');
    if (!normalizedPhone) {
      return;
    }

    const session = await this.prismaService.client.telegramLoginSession.findFirst({
      where: {
        telegramUserId,
        chatId,
        consumedAt: null,
        expiresAt: {
          gt: new Date(),
        },
        status: {
          in: ['awaiting_contact', 'code_issued'],
        },
      },
    });
    if (!session) {
      return;
    }

    const now = new Date();
    const shouldReuseCode =
      session.status === 'code_issued' &&
      session.codeSalt != null &&
      session.codeHash != null &&
      session.codeLookup != null &&
      session.lastCodeIssuedAt != null &&
      now.getTime() - session.lastCodeIssuedAt.getTime() < TELEGRAM_AUTH_CONTACT_COOLDOWN_MS;

    if (shouldReuseCode) {
      await this.sendMessage(
        chat.id,
        `Код для входа: ${deriveTelegramCodeFromSalt(session.codeSalt!)}\nВведи его в приложении.`,
        {
          remove_keyboard: true,
        },
      );
      return;
    }

    await this.issueCodeForSession(session.id, normalizedPhone, message);
  }

  private extractStartToken(payload: string) {
    if (!payload.startsWith('login_')) {
      return '';
    }

    return payload.slice('login_'.length);
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

  private async sendMessage(chatId: number, text: string, replyMarkup?: Record<string, unknown>) {
    await this.callTelegram('sendMessage', {
      chat_id: chatId,
      text,
      ...(replyMarkup == null ? {} : { reply_markup: replyMarkup }),
    });
  }

  private async sendContactPrompt(chatId: number) {
    await this.sendMessage(chatId, 'Поделись номером телефона, чтобы получить код для входа.', {
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
    });
  }

  private async issueCodeForSession(
    sessionId: string,
    phoneNumber: string,
    message: TelegramMessage,
  ) {
    const currentSession = await this.prismaService.client.telegramLoginSession.findUnique({
      where: { id: sessionId },
    });
    const now = new Date();

    if (
      currentSession?.status === 'code_issued' &&
      currentSession.codeSalt != null &&
      currentSession.codeHash != null &&
      currentSession.codeLookup != null &&
      currentSession.lastCodeIssuedAt != null &&
      currentSession.phoneNumber === phoneNumber &&
      now.getTime() - currentSession.lastCodeIssuedAt.getTime() < TELEGRAM_AUTH_CONTACT_COOLDOWN_MS
    ) {
      await this.sendMessage(
        message.chat!.id,
        `Код для входа: ${deriveTelegramCodeFromSalt(currentSession.codeSalt)}\nВведи его в приложении.`,
        {
          remove_keyboard: true,
        },
      );
      return;
    }

    const codePayload = await this.createUniqueCodePayload(sessionId);

    await this.prismaService.client.telegramLoginSession.update({
      where: { id: sessionId },
      data: {
        status: 'code_issued',
        telegramUserId: `${message.from!.id}`,
        chatId: `${message.chat!.id}`,
        username: message.from?.username,
        firstName: message.from?.first_name,
        lastName: message.from?.last_name,
        phoneNumber,
        codeSalt: codePayload.salt,
        codeHash: codePayload.hash,
        codeLookup: codePayload.codeLookup,
        attemptCount: 0,
        lastCodeIssuedAt: now,
      },
    });

    await this.sendMessage(
      message.chat!.id,
      `Код для входа: ${codePayload.code}\nВведи его в приложении.`,
      {
        remove_keyboard: true,
      },
    );
  }

  private async createUniqueCodePayload(sessionId: string) {
    const expiresAt = new Date();
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const payload = createTelegramCodePayload();
      const codeLookup = hashTelegramCodeLookup(payload.code);
      const existing = await this.prismaService.client.telegramLoginSession.findFirst({
        where: {
          codeLookup,
          status: {
            in: ['code_issued'],
          },
          consumedAt: null,
          expiresAt: {
            gt: expiresAt,
          },
          id: {
            not: sessionId,
          },
        },
      });

      if (!existing) {
        return {
          ...payload,
          codeLookup,
        };
      }
    }

    throw new Error('telegram_code_space_exhausted');
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

  private async callTelegram<T = unknown>(method: string, payload: Record<string, unknown>) {
    const token = getTelegramAuthConfig().botToken;
    if (!token) {
      throw new Error('telegram_bot_token_missing');
    }

    const response = await this.fetchImpl(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      throw new Error(`telegram_http_${method}`);
    }

    const body = (await response.json()) as {
      ok?: boolean;
      result?: T;
    };
    if (!body?.ok) {
      throw new Error(`telegram_api_${method}`);
    }

    return (body.result ?? []) as T;
  }

  private isEnabled() {
    const config = getTelegramAuthConfig();
    return config.enabled && Boolean(config.botToken);
  }

  private getPollIntervalMs() {
    return getTelegramAuthConfig().pollIntervalMs;
  }
}
