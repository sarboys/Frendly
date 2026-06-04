import { Injectable } from '@nestjs/common';
import {
  AppStoreServerAPIClient,
  Environment,
} from '@apple/app-store-server-library';
import { ApiError } from '../common/api-error';

type VerifyAppleTransactionInput = {
  transactionId?: string | null;
  verificationData?: string | null;
};

export type VerifiedAppleTransaction = {
  transactionId: string;
  productId: string;
  environment: string;
  raw: Record<string, unknown>;
};

@Injectable()
export class AppleInAppPurchaseService {
  async verifyTransaction(
    input: VerifyAppleTransactionInput,
  ): Promise<VerifiedAppleTransaction> {
    const transactionId = this.cleanText(input.transactionId) ??
      this.transactionIdFromJws(input.verificationData);
    if (!transactionId) {
      throw new ApiError(
        400,
        'apple_iap_transaction_missing',
        'Apple transaction id is missing',
      );
    }

    const response = await this.client().getTransactionInfo(transactionId);
    const signedTransactionInfo =
      typeof response?.signedTransactionInfo === 'string'
        ? response.signedTransactionInfo
        : null;
    if (!signedTransactionInfo) {
      throw new ApiError(
        502,
        'apple_iap_transaction_missing',
        'Apple transaction info is missing',
      );
    }

    const raw = this.decodeJwsPayload(signedTransactionInfo);
    const productId = this.cleanText(raw.productId);
    if (!productId) {
      throw new ApiError(
        502,
        'apple_iap_product_missing',
        'Apple product id is missing',
      );
    }

    return {
      transactionId: this.cleanText(raw.transactionId) ?? transactionId,
      productId,
      environment:
        this.cleanText(raw.environment) ?? this.appleEnvironmentName(),
      raw,
    };
  }

  private client() {
    const privateKey = this.privateKey();
    const keyId = this.requiredEnv('APPLE_IAP_KEY_ID');
    const issuerId = this.requiredEnv('APPLE_IAP_ISSUER_ID');
    const bundleId = this.requiredEnv('APPLE_IAP_BUNDLE_ID');
    return new AppStoreServerAPIClient(
      privateKey,
      keyId,
      issuerId,
      bundleId,
      this.appleEnvironment(),
    );
  }

  private appleEnvironment() {
    return this.appleEnvironmentName() === 'Production'
      ? Environment.PRODUCTION
      : Environment.SANDBOX;
  }

  private appleEnvironmentName() {
    return process.env.APPLE_IAP_ENVIRONMENT?.trim().toLowerCase() ===
      'production'
      ? 'Production'
      : 'Sandbox';
  }

  private privateKey() {
    return this.requiredEnv('APPLE_IAP_PRIVATE_KEY').replace(/\\n/g, '\n');
  }

  private requiredEnv(name: string) {
    const value = process.env[name]?.trim();
    if (!value) {
      throw new ApiError(
        503,
        'apple_iap_disabled',
        `${name} is not configured`,
      );
    }
    return value;
  }

  private transactionIdFromJws(value?: string | null) {
    const payload = this.tryDecodeJwsPayload(value);
    return this.cleanText(payload?.transactionId);
  }

  private decodeJwsPayload(value: string) {
    const payload = this.tryDecodeJwsPayload(value);
    if (payload == null) {
      throw new ApiError(
        502,
        'apple_iap_payload_invalid',
        'Apple transaction payload is invalid',
      );
    }
    return payload;
  }

  private tryDecodeJwsPayload(value?: string | null) {
    const parts = value?.split('.') ?? [];
    if (parts.length < 2) {
      return null;
    }
    try {
      const normalized = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(
        normalized.length + ((4 - (normalized.length % 4)) % 4),
        '=',
      );
      return JSON.parse(
        Buffer.from(padded, 'base64').toString('utf8'),
      ) as Record<string, unknown>;
    } catch (_) {
      return null;
    }
  }

  private cleanText(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}
