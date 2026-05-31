import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyAccessToken } from '@big-break/database';
import { ApiError } from './api-error';
import { RequestWithContext } from './request-context';
import { PrismaService } from '../services/prisma.service';
import { RedisCacheService } from '../services/redis-cache.service';

export const IS_PUBLIC_ROUTE = 'isPublicRoute';
const AUTH_SESSION_CACHE_SECONDS = 5;
const AUTH_SESSION_LOCAL_CACHE_MAX_ENTRIES = 10000;

type AuthSessionSnapshot = {
  userId: string;
  revokedAt: Date | null;
  user: {
    status: string;
  };
};

type AuthSessionCacheEntry = {
  expiresAt: number;
  value: AuthSessionSnapshot;
};

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private readonly pendingSessionLoads = new Map<
    string,
    Promise<AuthSessionSnapshot | null>
  >();
  private readonly localSessionCache = new Map<string, AuthSessionCacheEntry>();

  constructor(
    private readonly reflector: Reflector,
    private readonly prismaService: PrismaService,
    @Optional() private readonly redisCache?: RedisCacheService,
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
    const cacheKey = this.sessionCacheKey(sessionId);
    const local = this.getLocalSession(cacheKey);
    if (local != null) {
      return local;
    }

    const cached = await this.redisCache?.getJson<AuthSessionSnapshot>(cacheKey);
    if (cached != null) {
      this.setLocalSession(cacheKey, cached);
      return cached;
    }

    const pending = this.pendingSessionLoads.get(sessionId);
    if (pending != null) {
      return pending;
    }

    const loading = this.loadFreshSession(sessionId)
      .then(async (session) => {
        if (
          session != null &&
          session.revokedAt == null &&
          session.user.status !== 'suspended'
        ) {
          await this.redisCache?.setJson(
            cacheKey,
            session,
            AUTH_SESSION_CACHE_SECONDS,
          );
          this.setLocalSession(cacheKey, session);
        }

        return session;
      })
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

    return session;
  }

  private sessionCacheKey(sessionId: string) {
    return ['api', 'auth-session', 'v1', sessionId].join(':');
  }

  private getLocalSession(cacheKey: string) {
    const entry = this.localSessionCache.get(cacheKey);
    if (entry == null) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.localSessionCache.delete(cacheKey);
      return null;
    }
    return entry.value;
  }

  private setLocalSession(cacheKey: string, session: AuthSessionSnapshot) {
    if (this.localSessionCache.size >= AUTH_SESSION_LOCAL_CACHE_MAX_ENTRIES) {
      const oldestKey = this.localSessionCache.keys().next().value;
      if (oldestKey) {
        this.localSessionCache.delete(oldestKey);
      }
    }
    this.localSessionCache.set(cacheKey, {
      expiresAt: Date.now() + AUTH_SESSION_CACHE_SECONDS * 1000,
      value: session,
    });
  }
}
