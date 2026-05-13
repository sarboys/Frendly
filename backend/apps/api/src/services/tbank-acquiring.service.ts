import { Injectable, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ApiError } from '../common/api-error';

type TbankConfig = {
  terminalKey?: string;
  password?: string;
  apiUrl?: string;
  timeoutMs?: number;
};

type FetchLike = (url: string, init: RequestInit) => Promise<{
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
}>;

export type TbankInitPaymentPayload = {
  Amount: number;
  OrderId: string;
  Description: string;
  NotificationURL: string;
  SuccessURL: string;
  FailURL: string;
  PayType: 'O';
  Receipt?: Record<string, unknown>;
};

export type TbankResponse = {
  Success?: boolean;
  ErrorCode?: string;
  Message?: string;
  Details?: string;
  Status?: string;
  PaymentId?: string;
  PaymentURL?: string;
  Amount?: number | string;
  OrderId?: string;
  TerminalKey?: string;
};

@Injectable()
export class TbankAcquiringService {
  private readonly terminalKey: string;
  private readonly password: string;
  private readonly apiUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(
    @Optional() config: TbankConfig = {},
    @Optional() fetchImpl: FetchLike = fetch as FetchLike,
  ) {
    this.terminalKey = (config.terminalKey ?? process.env.TBANK_TERMINAL_KEY ?? '').trim();
    this.password = (config.password ?? process.env.TBANK_PASSWORD ?? '').trim();
    this.apiUrl = (config.apiUrl ?? process.env.TBANK_API_URL ?? 'https://securepay.tinkoff.ru')
      .trim()
      .replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? positiveInt(process.env.TBANK_TIMEOUT_MS) ?? 7000;
    this.fetchImpl = fetchImpl;
  }

  isEnabled() {
    return (
      process.env.PAYMENTS_TBANK_ENABLED === 'true' &&
      this.terminalKey !== '' &&
      this.password !== ''
    );
  }

  getTerminalKey() {
    return this.terminalKey;
  }

  buildToken(payload: Record<string, unknown>) {
    const tokenPayload: Record<string, string> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (key === 'Token' || key === 'DATA' || key === 'Receipt') {
        continue;
      }
      if (value == null || typeof value === 'object') {
        continue;
      }
      tokenPayload[key] = String(value);
    }
    tokenPayload.Password = this.password;

    const raw = Object.keys(tokenPayload)
      .sort()
      .map((key) => tokenPayload[key] ?? '')
      .join('');

    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  async initPayment(payload: TbankInitPaymentPayload): Promise<TbankResponse> {
    return this.post('/v2/Init', payload);
  }

  async getState(paymentId: string): Promise<TbankResponse> {
    return this.post('/v2/GetState', {
      PaymentId: paymentId,
    });
  }

  private async post(path: string, payload: Record<string, unknown>): Promise<TbankResponse> {
    if (!this.isEnabled()) {
      throw new ApiError(503, 'tbank_disabled', 'T-Bank payments are disabled');
    }

    const body = {
      TerminalKey: this.terminalKey,
      ...payload,
    };
    const signedBody = {
      ...body,
      Token: this.buildToken(body),
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.apiUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(signedBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ApiError(502, 'tbank_http_error', 'T-Bank request failed', {
          status: response.status,
        });
      }

      const json = (await response.json()) as TbankResponse;
      if (json.Success === false) {
        throw new ApiError(502, 'tbank_error', 'T-Bank returned an error', {
          errorCode: json.ErrorCode,
          message: json.Message,
          details: json.Details,
        });
      }
      return json;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(502, 'tbank_request_failed', 'T-Bank request failed');
    } finally {
      clearTimeout(timeout);
    }
  }
}

function positiveInt(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
