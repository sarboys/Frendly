import { Injectable, Logger } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { createPublicKey, verify as verifySignature } from 'node:crypto';
import { ApiError } from '../common/api-error';

export type SocialAuthProvider = 'google' | 'yandex' | 'apple';

export interface VerifiedSocialIdentity {
  provider: SocialAuthProvider;
  providerUserId: string;
  email?: string;
  emailVerified?: boolean;
  phoneNumber?: string;
  displayName?: string;
  avatarUrl?: string;
}

interface YandexUserInfoResponse {
  id?: string;
  client_id?: string;
  login?: string;
  default_email?: string;
  emails?: string[];
  default_phone?: {
    id?: number;
    number?: string;
  };
  real_name?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  default_avatar_id?: string;
}

interface AppleJwtHeader {
  alg?: string;
  kid?: string;
}

interface AppleIdentityTokenPayload {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  exp?: number;
  iat?: number;
}

interface AppleJwk {
  kid?: string;
  alg?: string;
  use?: string;
  kty?: string;
  n?: string;
  e?: string;
}

interface AppleJwksResponse {
  keys?: AppleJwk[];
}

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_JWKS_CACHE_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class SocialIdentityVerifier {
  private readonly logger = new Logger(SocialIdentityVerifier.name);
  private readonly googleClient = new OAuth2Client();
  private appleKeysCache?: { expiresAt: number; keys: AppleJwk[] };

  async verifyGoogleIdToken(idToken: string): Promise<VerifiedSocialIdentity> {
    const clientIds = this.googleClientIds();
    if (clientIds.length === 0) {
      throw new ApiError(
        503,
        'google_auth_unavailable',
        'Google auth is not configured',
      );
    }

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: clientIds,
      });
      const payload = ticket.getPayload();
      const providerUserId = payload?.sub;

      if (!providerUserId) {
        throw new ApiError(
          401,
          'invalid_google_token',
          'Google token is invalid',
        );
      }

      const emailVerified = payload.email_verified === true;
      return {
        provider: 'google',
        providerUserId,
        email: emailVerified ? payload.email : undefined,
        emailVerified,
        displayName: payload.name ?? undefined,
        avatarUrl: payload.picture ?? undefined,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      this.logger.warn('Rejected Google id token');
      throw new ApiError(
        401,
        'invalid_google_token',
        'Google token is invalid',
      );
    }
  }

  async verifyYandexOAuthToken(
    oauthToken: string,
  ): Promise<VerifiedSocialIdentity> {
    const clientId = this.yandexClientId();
    if (!clientId) {
      throw new ApiError(
        503,
        'yandex_auth_unavailable',
        'Yandex auth is not configured',
      );
    }

    const info = await this.fetchYandexUserInfo(oauthToken);

    if (!info.id || info.client_id !== clientId) {
      throw new ApiError(
        401,
        'invalid_yandex_token',
        'Yandex token is invalid',
      );
    }

    return {
      provider: 'yandex',
      providerUserId: info.id,
      email: this.pickYandexEmail(info),
      phoneNumber: info.default_phone?.number,
      displayName: this.pickYandexDisplayName(info),
      avatarUrl: this.yandexAvatarUrl(info.default_avatar_id),
    };
  }

  async verifyAppleIdentityToken(
    identityToken: string,
    params: { displayName?: string } = {},
  ): Promise<VerifiedSocialIdentity> {
    const audiences = this.appleAudiences();
    if (audiences.length === 0) {
      throw new ApiError(
        503,
        'apple_auth_unavailable',
        'Apple auth is not configured',
      );
    }

    const parsed = this.parseAppleIdentityToken(identityToken);
    if (parsed.header.alg !== 'RS256' || !parsed.header.kid) {
      throw new ApiError(
        401,
        'invalid_apple_token',
        'Apple token is invalid',
      );
    }

    const key = await this.appleJwkForKid(parsed.header.kid);
    if (!key) {
      throw new ApiError(
        401,
        'invalid_apple_token',
        'Apple token is invalid',
      );
    }

    const publicKey = createPublicKey({
      key: key as any,
      format: 'jwk',
    });
    const validSignature = verifySignature(
      'RSA-SHA256',
      Buffer.from(parsed.signingInput),
      publicKey,
      Buffer.from(parsed.signature, 'base64url'),
    );
    if (!validSignature) {
      throw new ApiError(
        401,
        'invalid_apple_token',
        'Apple token is invalid',
      );
    }

    this.assertApplePayload(parsed.payload, audiences);
    return {
      provider: 'apple',
      providerUserId: parsed.payload.sub!,
      email: this.isAppleEmailVerified(parsed.payload)
        ? parsed.payload.email
        : undefined,
      emailVerified: this.isAppleEmailVerified(parsed.payload),
      displayName: this.clean(params.displayName),
    };
  }

  private async fetchYandexUserInfo(
    accessToken: string,
  ): Promise<YandexUserInfoResponse> {
    const response = await this.fetchWithTimeout(
      'https://login.yandex.ru/info?format=json',
      {
        headers: {
          authorization: `OAuth ${accessToken}`,
        },
      },
    );
    const json = (await response.json()) as YandexUserInfoResponse;

    if (!response.ok) {
      throw new ApiError(
        401,
        'invalid_yandex_token',
        'Yandex token is invalid',
        { providerStatus: response.status },
      );
    }

    return json;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.providerTimeoutMs(),
    );
    timeout.unref?.();

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(
        503,
        'social_auth_provider_unavailable',
        'Social auth provider is unavailable',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseAppleIdentityToken(identityToken: string) {
    const parts = identityToken.trim().split('.');
    if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
      throw new ApiError(
        401,
        'invalid_apple_token',
        'Apple token is invalid',
      );
    }

    const [headerPart, payloadPart, signaturePart] = parts as [
      string,
      string,
      string,
    ];
    try {
      return {
        header: JSON.parse(
          Buffer.from(headerPart, 'base64url').toString('utf8'),
        ) as AppleJwtHeader,
        payload: JSON.parse(
          Buffer.from(payloadPart, 'base64url').toString('utf8'),
        ) as AppleIdentityTokenPayload,
        signingInput: `${headerPart}.${payloadPart}`,
        signature: signaturePart,
      };
    } catch {
      throw new ApiError(
        401,
        'invalid_apple_token',
        'Apple token is invalid',
      );
    }
  }

  private async appleJwkForKid(kid: string) {
    let keys = await this.appleJwks();
    let key = keys.find(
      (key) => key.kid === kid && key.kty === 'RSA' && key.use === 'sig',
    );
    if (!key) {
      this.appleKeysCache = undefined;
      keys = await this.appleJwks();
      key = keys.find(
        (key) => key.kid === kid && key.kty === 'RSA' && key.use === 'sig',
      );
    }
    return key;
  }

  private async appleJwks() {
    const cached = this.appleKeysCache;
    if (cached && cached.expiresAt > Date.now()) {
      return cached.keys;
    }

    const response = await this.fetchWithTimeout(APPLE_KEYS_URL, {});
    if (!response.ok) {
      throw new ApiError(
        503,
        'social_auth_provider_unavailable',
        'Social auth provider is unavailable',
      );
    }
    const json = (await response.json()) as AppleJwksResponse;
    const keys = Array.isArray(json.keys) ? json.keys : [];
    this.appleKeysCache = {
      expiresAt: Date.now() + APPLE_JWKS_CACHE_MS,
      keys,
    };
    return keys;
  }

  private assertApplePayload(
    payload: AppleIdentityTokenPayload,
    audiences: string[],
  ) {
    const now = Math.floor(Date.now() / 1000);
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (
      payload.iss !== APPLE_ISSUER ||
      !payload.sub ||
      !aud.some((item) => item != null && audiences.includes(item)) ||
      typeof payload.exp !== 'number' ||
      payload.exp <= now ||
      (typeof payload.iat === 'number' && payload.iat > now + 300)
    ) {
      throw new ApiError(
        401,
        'invalid_apple_token',
        'Apple token is invalid',
      );
    }
  }

  private googleClientIds() {
    const raw =
      process.env.GOOGLE_OAUTH_CLIENT_IDS ??
      process.env.GOOGLE_WEB_CLIENT_ID ??
      process.env.GOOGLE_OAUTH_CLIENT_ID ??
      '';
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private yandexClientId() {
    return (
      process.env.YANDEX_OAUTH_CLIENT_ID ??
      process.env.YANDEX_CLIENT_ID ??
      ''
    ).trim();
  }

  private appleAudiences() {
    const raw =
      process.env.APPLE_SIGN_IN_AUDIENCES ??
      process.env.APPLE_BUNDLE_ID ??
      process.env.IOS_BUNDLE_ID ??
      '';
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private providerTimeoutMs() {
    const raw = Number(process.env.SOCIAL_AUTH_PROVIDER_TIMEOUT_MS);
    if (Number.isFinite(raw) && raw >= 1000 && raw <= 15000) {
      return raw;
    }
    return 5000;
  }

  private pickYandexEmail(info: YandexUserInfoResponse) {
    return info.default_email ?? info.emails?.[0];
  }

  private pickYandexDisplayName(info: YandexUserInfoResponse) {
    const parts = [info.first_name, info.last_name].filter(Boolean);
    return info.real_name ?? info.display_name ?? parts.join(' ') ?? info.login;
  }

  private yandexAvatarUrl(avatarId?: string) {
    if (!avatarId || avatarId === '0/0-0') {
      return undefined;
    }
    return `https://avatars.yandex.net/get-yapic/${avatarId}/islands-200`;
  }

  private isAppleEmailVerified(payload: AppleIdentityTokenPayload) {
    return (
      payload.email != null &&
      (payload.email_verified === true || payload.email_verified === 'true')
    );
  }

  private clean(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }
}
