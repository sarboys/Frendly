import { Injectable, Logger } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { ApiError } from '../common/api-error';

export type SocialAuthProvider = 'google' | 'yandex';

export interface VerifiedSocialIdentity {
  provider: SocialAuthProvider;
  providerUserId: string;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
  avatarUrl?: string;
}

interface YandexTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface YandexUserInfoResponse {
  id?: string;
  client_id?: string;
  login?: string;
  default_email?: string;
  emails?: string[];
  real_name?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  default_avatar_id?: string;
}

@Injectable()
export class SocialIdentityVerifier {
  private readonly logger = new Logger(SocialIdentityVerifier.name);
  private readonly googleClient = new OAuth2Client();

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

  async verifyYandexAuthCode(params: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<VerifiedSocialIdentity> {
    const clientId = this.yandexClientId();
    if (!clientId) {
      throw new ApiError(
        503,
        'yandex_auth_unavailable',
        'Yandex auth is not configured',
      );
    }
    this.assertYandexRedirectUri(params.redirectUri);

    const token = await this.exchangeYandexCodeForToken({
      clientId,
      code: params.code,
      codeVerifier: params.codeVerifier,
    });
    const info = await this.fetchYandexUserInfo(token.access_token!);

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
      displayName: this.pickYandexDisplayName(info),
      avatarUrl: this.yandexAvatarUrl(info.default_avatar_id),
    };
  }

  private async exchangeYandexCodeForToken(params: {
    clientId: string;
    code: string;
    codeVerifier: string;
  }): Promise<YandexTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      client_id: params.clientId,
      code_verifier: params.codeVerifier,
    });
    const clientSecret = this.yandexClientSecret();
    if (clientSecret) {
      body.set('client_secret', clientSecret);
    }

    const response = await this.fetchWithTimeout(
      'https://oauth.yandex.com/token',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );
    const json = (await response.json()) as YandexTokenResponse;

    if (!response.ok || !json.access_token) {
      throw new ApiError(
        401,
        'invalid_yandex_code',
        'Yandex auth code is invalid',
        {
          providerStatus: response.status,
          providerError: json.error,
        },
      );
    }

    return json;
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

  private yandexClientSecret() {
    return (process.env.YANDEX_OAUTH_CLIENT_SECRET ?? '').trim();
  }

  private providerTimeoutMs() {
    const raw = Number(process.env.SOCIAL_AUTH_PROVIDER_TIMEOUT_MS);
    if (Number.isFinite(raw) && raw >= 1000 && raw <= 15000) {
      return raw;
    }
    return 5000;
  }

  private assertYandexRedirectUri(redirectUri: string) {
    const configured = (process.env.YANDEX_OAUTH_REDIRECT_URIS ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (configured.length === 0 || configured.includes(redirectUri)) {
      return;
    }

    throw new ApiError(
      400,
      'invalid_yandex_redirect_uri',
      'Yandex redirect URI is invalid',
    );
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
}
