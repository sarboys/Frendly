import { Injectable, Logger } from '@nestjs/common';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { ApiError } from '../common/api-error';

export const PHONE_OTP_CODE_LENGTH = 4;
export const PHONE_OTP_TTL_MS = 10 * 60 * 1000;
export const PHONE_OTP_COOLDOWN_MS = 42 * 1000;
export const PHONE_OTP_MAX_ATTEMPTS = 5;
export const PHONE_OTP_REQUEST_WINDOW_MS = 10 * 60 * 1000;
export const PHONE_OTP_MAX_REQUESTS_PER_CONTEXT = 5;
export const PHONE_OTP_DELIVERY_TIMEOUT_MS = 5000;

interface PhoneOtpRequestMeta {
  requestId?: string;
  ip?: string;
  userAgent?: string;
}

interface PhoneOtpPayload {
  code: string;
  codeSalt: string;
  codeHash: string;
  expiresAt: Date;
}

interface PhoneOtpDeliveryResult {
  provider: 'dev' | 'webhook';
  localCodeHint: string | null;
}

@Injectable()
export class PhoneOtpService {
  private readonly logger = new Logger(PhoneOtpService.name);

  createPayload(now = new Date()): PhoneOtpPayload {
    const codeSalt = randomBytes(16).toString('hex');
    const code = this.deriveCodeFromSalt(codeSalt);
    return {
      code,
      codeSalt,
      codeHash: this.hashCode(code, codeSalt),
      expiresAt: new Date(now.getTime() + PHONE_OTP_TTL_MS),
    };
  }

  verifyCode(code: string, codeSalt: string, codeHash: string): boolean {
    if (!new RegExp(`^\\d{${PHONE_OTP_CODE_LENGTH}}$`).test(code)) {
      return false;
    }

    const nextHash = this.hashCode(code, codeSalt);
    const expected = Buffer.from(codeHash, 'hex');
    const actual = Buffer.from(nextHash, 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  localCodeHint(codeSalt: string): string | null {
    if (!this.isDevOtpEnabled()) {
      return null;
    }

    return this.deriveCodeFromSalt(codeSalt);
  }

  async deliver(
    phoneNumber: string,
    code: string,
    meta: PhoneOtpRequestMeta,
  ): Promise<PhoneOtpDeliveryResult> {
    if (this.isDevOtpEnabled()) {
      this.logger.log(
        `Accepted phone OTP delivery: requestId=${this.requestId(meta)} provider=dev`,
      );
      return {
        provider: 'dev',
        localCodeHint: code,
      };
    }

    const webhookUrl = process.env.PHONE_OTP_DELIVERY_WEBHOOK_URL?.trim();
    if (webhookUrl) {
      await this.deliverViaWebhook(webhookUrl, phoneNumber, code, meta);
      return {
        provider: 'webhook',
        localCodeHint: null,
      };
    }

    this.logger.warn(
      `Phone OTP delivery unavailable: requestId=${this.requestId(meta)} provider=none`,
    );
    throw new ApiError(
      503,
      'phone_auth_unavailable',
      'Phone auth delivery is unavailable',
    );
  }

  hashRequestKey(meta: PhoneOtpRequestMeta): string | null {
    const ip = meta.ip?.trim();
    if (!ip) {
      return null;
    }

    const userAgent = meta.userAgent?.trim().slice(0, 160) ?? '';
    return createHmac('sha256', this.secret())
      .update(`${ip}:${userAgent}`)
      .digest('hex');
  }

  private async deliverViaWebhook(
    webhookUrl: string,
    phoneNumber: string,
    code: string,
    meta: PhoneOtpRequestMeta,
  ) {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    const token = process.env.PHONE_OTP_DELIVERY_WEBHOOK_TOKEN?.trim();
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }

    let response: Response;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.deliveryTimeoutMs(),
    );
    timeout.unref?.();

    try {
      response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          phoneNumber,
          code,
          codeLength: PHONE_OTP_CODE_LENGTH,
          expiresInSeconds: Math.floor(PHONE_OTP_TTL_MS / 1000),
        }),
      });
    } catch (error) {
      this.logger.error(
        `Phone OTP webhook delivery failed: requestId=${this.requestId(meta)} reason=request_error`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ApiError(
        503,
        'phone_auth_delivery_failed',
        'Phone auth delivery failed',
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      this.logger.error(
        `Phone OTP webhook delivery failed: requestId=${this.requestId(meta)} status=${response.status}`,
      );
      throw new ApiError(
        503,
        'phone_auth_delivery_failed',
        'Phone auth delivery failed',
      );
    }

    this.logger.log(
      `Accepted phone OTP delivery: requestId=${this.requestId(meta)} provider=webhook`,
    );
  }

  private deriveCodeFromSalt(codeSalt: string): string {
    const digest = createHmac('sha256', this.secret()).update(codeSalt).digest();
    const value = digest.readUInt32BE(0) % 10 ** PHONE_OTP_CODE_LENGTH;
    return value.toString().padStart(PHONE_OTP_CODE_LENGTH, '0');
  }

  private hashCode(code: string, codeSalt: string): string {
    return createHash('sha256')
      .update(`${codeSalt}:${code}:${this.secret()}`)
      .digest('hex');
  }

  private isDevOtpEnabled() {
    return process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_OTP === 'true';
  }

  private deliveryTimeoutMs() {
    const configured = Number(process.env.PHONE_OTP_DELIVERY_TIMEOUT_MS);
    if (Number.isFinite(configured) && configured > 0) {
      return Math.trunc(configured);
    }
    return PHONE_OTP_DELIVERY_TIMEOUT_MS;
  }

  private secret() {
    return (
      process.env.PHONE_OTP_SECRET?.trim() ||
      process.env.JWT_REFRESH_SECRET?.trim() ||
      'dev-phone-otp-secret'
    );
  }

  private requestId(meta: PhoneOtpRequestMeta) {
    return meta.requestId ?? 'unknown';
  }
}
