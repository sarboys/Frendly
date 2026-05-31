import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyAccessToken } from '@big-break/database';
import { ApiError } from './api-error';
import { RequestWithContext } from './request-context';
import { PrismaService } from '../services/prisma.service';

export const IS_PUBLIC_ROUTE = 'isPublicRoute';
const AUTH_SESSION_CACHE_TTL_MS = 5000;
const AUTH_SESSION_CACHE_MAX_ENTRIES = 5000;

type AuthSessionSnapshot = {
  userId: string;
  revokedAt: Date | null;
  user: {
    status: string;
  };
};

type CachedAuthSession = AuthSessionSnapshot & {
  expiresAt: number;
};

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private readonly sessionCache = new Map<string, CachedAuthSession>();
  private readonly pendingSessionLoads = new Map<
    string,
    Promise<AuthSessionSnapshot | null>
  >();

  constructor(
    private readonly reflector: Reflector,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const rawHeader = request.headers.authorization;

    if (!rawHeader?.startsWith('Bearer ')) {
      throw new ApiError(401, 'auth_required', 'Missing bearer token');
    }

    const token = rawHeader.slice('Bearer '.length);
    let payload;

    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      this.logger.warn(
        `Rejected access token: requestId=${request.context.requestId} reason=invalid_payload`,
      );
      throw new ApiError(401, 'invalid_access_token', 'Access token is invalid');
    }

    const session = await this.loadSession(payload.sessionId);

    if (!session || session.userId !== payload.userId || session.revokedAt != null) {
      this.logger.warn(
        `Rejected access token: requestId=${request.context.requestId} userId=${payload.userId} sessionId=${payload.sessionId} reason=stale_session`,
      );
      throw new ApiError(401, 'stale_access_token', 'Access token is stale');
    }
    if (session.user.status === 'suspended') {
      throw new ApiError(403, 'user_suspended', 'User account is suspended');
    }

    request.context.userId = payload.userId;
    request.context.sessionId = payload.sessionId;

    return true;
  }

  private async loadSession(sessionId: string): Promise<AuthSessionSnapshot | null> {
    const now = Date.now();
    const cached = this.sessionCache.get(sessionId);
    if (cached != null) {
      if (cached.expiresAt > now) {
        return cached;
      }

      this.sessionCache.delete(sessionId);
    }

    const pending = this.pendingSessionLoads.get(sessionId);
    if (pending != null) {
      return pending;
    }

    const loading = this.loadFreshSession(sessionId)
      .finally(() => {
        this.pendingSessionLoads.delete(sessionId);
      });
    this.pendingSessionLoads.set(sessionId, loading);

    return loading;
  }

  private async loadFreshSession(sessionId: string): Promise<AuthSessionSnapshot | null> {
    const session = await this.prismaService.client.session.findUnique({
      where: { id: sessionId },
      select: {
        userId: true,
        revokedAt: true,
        user: {
          select: {
            status: true,
          },
        },
      },
    });

    if (
      session != null &&
      session.revokedAt == null &&
      session.user.status !== 'suspended'
    ) {
      this.storeSession(sessionId, session);
    }

    return session;
  }

  private storeSession(sessionId: string, session: AuthSessionSnapshot) {
    if (this.sessionCache.size >= AUTH_SESSION_CACHE_MAX_ENTRIES) {
      const firstKey = this.sessionCache.keys().next().value;
      if (firstKey != null) {
        this.sessionCache.delete(firstKey);
      }
    }

    this.sessionCache.set(sessionId, {
      ...session,
      expiresAt: Date.now() + AUTH_SESSION_CACHE_TTL_MS,
    });
  }
}
