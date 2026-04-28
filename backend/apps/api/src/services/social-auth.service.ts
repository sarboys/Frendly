import { Injectable, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { AuthService } from './auth.service';
import { PrismaService } from './prisma.service';
import {
  SocialAuthProvider,
  SocialIdentityVerifier,
  VerifiedSocialIdentity,
} from './social-identity-verifier.service';

type DbClient = PrismaClient | Prisma.TransactionClient;

interface AuthRequestMeta {
  requestId?: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class SocialAuthService {
  private readonly logger = new Logger(SocialAuthService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly authService: AuthService,
    private readonly identityVerifier: SocialIdentityVerifier,
  ) {}

  async verifyGoogleIdToken(idToken: string, meta: AuthRequestMeta = {}) {
    const trimmed = idToken.trim();
    if (!trimmed) {
      throw new ApiError(
        400,
        'invalid_google_token',
        'Google token is required',
      );
    }

    const identity = await this.identityVerifier.verifyGoogleIdToken(trimmed);
    return this.createAppSession(identity, meta);
  }

  async verifyYandexAuthCode(
    params: {
      code: string;
      codeVerifier: string;
      redirectUri: string;
    },
    meta: AuthRequestMeta = {},
  ) {
    const code = params.code.trim();
    const codeVerifier = params.codeVerifier.trim();
    const redirectUri = params.redirectUri.trim();
    if (!code || !codeVerifier || !redirectUri) {
      throw new ApiError(
        400,
        'invalid_yandex_code',
        'Yandex auth code is required',
      );
    }

    const identity = await this.identityVerifier.verifyYandexAuthCode({
      code,
      codeVerifier,
      redirectUri,
    });
    return this.createAppSession(identity, meta);
  }

  private async createAppSession(
    identity: VerifiedSocialIdentity,
    meta: AuthRequestMeta,
  ) {
    try {
      return await this.prismaService.client.$transaction(async (tx) => {
        const normalizedEmail = this.normalizedTrustedEmail(identity);
        const existingAccount = await tx.externalAuthAccount.findUnique({
          where: {
            provider_providerUserId: {
              provider: identity.provider,
              providerUserId: identity.providerUserId,
            },
          },
          include: { user: true },
        });

        const userResult = existingAccount
          ? {
              user: await this.refreshExistingAccount(
                tx,
                existingAccount.userId,
                identity,
                normalizedEmail,
              ),
              isNewUser: false,
            }
          : await this.createOrLinkUser(tx, identity, normalizedEmail);

        const session = await this.authService.createSessionRecord(
          userResult.user.id,
          identity.provider,
          tx,
        );
        await this.writeAuditEvent(tx, {
          provider: identity.provider,
          result: 'success',
          requestId: this.requestId(meta),
          userId: userResult.user.id,
          sessionId: session.sessionId,
          providerUserId: identity.providerUserId,
          isNewUser: userResult.isNewUser,
        });

        return {
          ...session.tokens,
          userId: userResult.user.id,
          isNewUser: userResult.isNewUser,
        };
      });
    } catch (error) {
      if (error instanceof ApiError) {
        await this.writeAuditEvent(this.prismaService.client, {
          provider: identity.provider,
          result: error.statusCode === 409 ? 'conflict' : 'rejected',
          requestId: this.requestId(meta),
          providerUserId: identity.providerUserId,
          reason: error.code,
        });
      } else {
        this.logger.error(
          `Unexpected ${identity.provider} auth failure: requestId=${this.requestId(meta)}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
      throw error;
    }
  }

  private async refreshExistingAccount(
    tx: Prisma.TransactionClient,
    userId: string,
    identity: VerifiedSocialIdentity,
    normalizedEmail?: string,
  ) {
    await tx.externalAuthAccount.update({
      where: {
        provider_providerUserId: {
          provider: identity.provider,
          providerUserId: identity.providerUserId,
        },
      },
      data: {
        email: normalizedEmail,
        displayName: this.clean(identity.displayName),
        avatarUrl: this.clean(identity.avatarUrl),
      },
    });

    if (normalizedEmail) {
      await this.attachEmailIfEmpty(tx, userId, normalizedEmail);
    }

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new ApiError(500, 'auth_user_not_found', 'User not found');
    }
    return user;
  }

  private async createOrLinkUser(
    tx: Prisma.TransactionClient,
    identity: VerifiedSocialIdentity,
    normalizedEmail?: string,
  ) {
    const canLinkByEmail =
      identity.provider === 'google' &&
      identity.emailVerified === true &&
      normalizedEmail != null;
    const existingUser = canLinkByEmail
      ? await tx.user.findUnique({ where: { email: normalizedEmail } })
      : null;

    if (existingUser) {
      await this.createExternalAuthAccount(
        tx,
        existingUser.id,
        identity,
        normalizedEmail,
      );
      return { user: existingUser, isNewUser: false };
    }

    const user = await this.createUser(tx, identity, normalizedEmail);
    await this.createExternalAuthAccount(tx, user.id, identity, normalizedEmail);
    return { user, isNewUser: true };
  }

  private async createUser(
    tx: Prisma.TransactionClient,
    identity: VerifiedSocialIdentity,
    normalizedEmail?: string,
  ) {
    try {
      return await tx.user.create({
        data: {
          id: `user-${randomUUID()}`,
          displayName: this.displayName(identity),
          email: normalizedEmail,
          profile: {
            create: {
              avatarUrl: this.clean(identity.avatarUrl),
            },
          },
          onboarding: {
            create: { interests: [] },
          },
          settings: {
            create: {
              allowLocation: false,
              allowPush: false,
              allowContacts: false,
              autoSharePlans: false,
              hideExactLocation: false,
              quietHours: false,
              showAge: true,
              discoverable: true,
              darkMode: false,
            },
          },
          verification: {
            create: {},
          },
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ApiError(
          409,
          'external_auth_email_conflict',
          'External auth email is already used',
        );
      }
      throw error;
    }
  }

  private async createExternalAuthAccount(
    tx: Prisma.TransactionClient,
    userId: string,
    identity: VerifiedSocialIdentity,
    normalizedEmail?: string,
  ) {
    try {
      await tx.externalAuthAccount.create({
        data: {
          provider: identity.provider,
          providerUserId: identity.providerUserId,
          userId,
          email: normalizedEmail,
          displayName: this.clean(identity.displayName),
          avatarUrl: this.clean(identity.avatarUrl),
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const account = await tx.externalAuthAccount.findUnique({
          where: {
            provider_providerUserId: {
              provider: identity.provider,
              providerUserId: identity.providerUserId,
            },
          },
        });
        if (account?.userId === userId) {
          return;
        }
        throw new ApiError(
          409,
          'external_auth_conflict',
          'External auth account is already linked',
        );
      }
      throw error;
    }
  }

  private async attachEmailIfEmpty(
    tx: Prisma.TransactionClient,
    userId: string,
    normalizedEmail: string,
  ) {
    try {
      await tx.user.updateMany({
        where: {
          id: userId,
          email: null,
        },
        data: {
          email: normalizedEmail,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        return;
      }
      throw error;
    }
  }

  private normalizedTrustedEmail(identity: VerifiedSocialIdentity) {
    const email = this.clean(identity.email)?.toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return undefined;
    }
    if (identity.provider === 'google' && identity.emailVerified !== true) {
      return undefined;
    }
    return email;
  }

  private displayName(identity: VerifiedSocialIdentity) {
    return (
      this.clean(identity.displayName) ??
      this.clean(identity.email)?.split('@')[0] ??
      `${identity.provider} user`
    );
  }

  private clean(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private requestId(meta: AuthRequestMeta) {
    return meta.requestId ?? 'unknown';
  }

  private async writeAuditEvent(
    prisma: DbClient,
    params: {
      provider: SocialAuthProvider;
      result: 'success' | 'rejected' | 'conflict';
      requestId: string;
      userId?: string;
      sessionId?: string;
      providerUserId?: string;
      isNewUser?: boolean;
      reason?: string;
    },
  ) {
    await prisma.authAuditEvent.create({
      data: {
        provider: params.provider,
        kind: 'verify',
        result: params.result,
        requestId: params.requestId,
        userId: params.userId,
        sessionId: params.sessionId,
        metadata: {
          providerUserId: params.providerUserId,
          isNewUser: params.isNewUser,
          reason: params.reason,
        },
      },
    });
  }
}
