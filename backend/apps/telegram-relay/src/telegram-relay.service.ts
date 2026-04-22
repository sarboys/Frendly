import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  TelegramDispatchAction,
  TelegramDispatchRequest,
  TelegramDispatchResponse,
} from '@big-break/contracts';

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

type TelegramApiEnvelope<T> = {
  ok?: boolean;
  result?: T;
};

@Injectable()
export class TelegramRelayService implements OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private started = false;
  private initialized = false;
  private polling = false;
  private backoffMs = 0;
  private lastUpdateId?: number;
  private fetchImpl: FetchLike = fetch;

  setFetchImpl(fetchImpl: FetchLike) {
    this.fetchImpl = fetchImpl;
  }

  async start() {
    if (!this.isEnabled() || this.started) {
      return;
    }

    this.started = true;
    await this.loadState();
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
      const updates = await this.callTelegram<TelegramUpdate[]>('getUpdates', {
        timeout: 0,
        ...(this.lastUpdateId == null ? {} : { offset: this.lastUpdateId + 1 }),
      });

      let nextUpdateId = this.lastUpdateId;
      for (const update of updates) {
        await this.handleUpdate(update);
        nextUpdateId = update.update_id;
      }

      if (nextUpdateId != null && nextUpdateId !== this.lastUpdateId) {
        this.lastUpdateId = nextUpdateId;
        await this.saveState();
      }
    } finally {
      this.polling = false;
    }
  }

  private async ensureInitialized() {
    if (this.initialized) {
      return;
    }

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
        this.backoffMs =
          this.backoffMs === 0
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
      const rawPayload = message.text.trim().split(/\s+/)[1] ?? '';
      const request: TelegramDispatchRequest = {
        kind: 'start',
        telegramUserId: `${message.from.id}`,
        chatId: `${message.chat.id}`,
        username: message.from.username,
        firstName: message.from.first_name,
        lastName: message.from.last_name,
        ...(rawPayload.length === 0 ? {} : { startPayload: rawPayload }),
        ...(rawPayload.startsWith('login_')
          ? { startToken: rawPayload.slice('login_'.length) }
          : {}),
      };
      const response = await this.dispatchToBackend(request);
      await this.executeActions(message.chat.id, response.actions);
      return;
    }

    if (message.contact) {
      const request: TelegramDispatchRequest = {
        kind: 'contact',
        telegramUserId: `${message.from.id}`,
        chatId: `${message.chat.id}`,
        username: message.from.username,
        firstName: message.from.first_name,
        lastName: message.from.last_name,
        phoneNumber: message.contact.phone_number,
      };
      const response = await this.dispatchToBackend(request);
      await this.executeActions(message.chat.id, response.actions);
    }
  }

  private async dispatchToBackend(
    request: TelegramDispatchRequest,
  ): Promise<TelegramDispatchResponse> {
    const response = await this.fetchImpl(
      `${this.getBackendUrl()}/internal/telegram/dispatch`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-telegram-internal-secret': this.getInternalSecret(),
        },
        body: JSON.stringify(request),
      },
    );

    if (!response.ok) {
      throw new Error(`telegram_backend_${response.status}`);
    }

    return (await response.json()) as TelegramDispatchResponse;
  }

  private async executeActions(chatId: number, actions: TelegramDispatchAction[]) {
    for (const action of actions) {
      if (action.type === 'send_message') {
        await this.callTelegram('sendMessage', {
          chat_id: chatId,
          text: action.text,
          ...(action.replyMarkup == null ? {} : { reply_markup: action.replyMarkup }),
        });
      }
    }
  }

  private async callTelegram<T = unknown>(method: string, payload: Record<string, unknown>) {
    const response = await this.fetchImpl(
      `https://api.telegram.org/bot${this.getBotToken()}/${method}`,
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

    const body = (await response.json()) as TelegramApiEnvelope<T>;
    if (!body.ok) {
      throw new Error(`telegram_api_${method}`);
    }

    return (body.result ?? []) as T;
  }

  private async loadState() {
    const statePath = this.getStatePath();
    try {
      const raw = await fs.readFile(statePath, 'utf8');
      const parsed = JSON.parse(raw) as { lastUpdateId?: number };
      this.lastUpdateId =
        typeof parsed.lastUpdateId === 'number' ? parsed.lastUpdateId : undefined;
    } catch {
      this.lastUpdateId = undefined;
    }
  }

  private async saveState() {
    const statePath = this.getStatePath();
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(
      statePath,
      JSON.stringify({ lastUpdateId: this.lastUpdateId }),
      'utf8',
    );
  }

  private getBotToken() {
    const value = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!value) {
      throw new Error('telegram_bot_token_missing');
    }
    return value;
  }

  private getBackendUrl() {
    const value = process.env.TELEGRAM_BACKEND_URL?.trim();
    if (!value) {
      throw new Error('telegram_backend_url_missing');
    }
    return value.replace(/\/+$/, '');
  }

  private getInternalSecret() {
    const value = process.env.TELEGRAM_INTERNAL_SECRET?.trim();
    if (!value) {
      throw new Error('telegram_internal_secret_missing');
    }
    return value;
  }

  private getPollIntervalMs() {
    const raw = Number(process.env.TELEGRAM_POLL_INTERVAL_MS ?? '1500');
    return Number.isFinite(raw) ? Math.max(1000, Math.min(Math.trunc(raw), 30_000)) : 1500;
  }

  private getStatePath() {
    return process.env.TELEGRAM_RELAY_STATE_PATH?.trim() || '/data/telegram-relay-state.json';
  }

  private isEnabled() {
    return process.env.TELEGRAM_AUTH_ENABLED === 'true';
  }
}
