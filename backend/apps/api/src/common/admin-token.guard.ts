import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { verifyAdminAccessToken } from '@big-break/database';
import { ApiError } from './api-error';
import { RequestWithContext } from './request-context';
import { PrismaService } from '../services/prisma.service';

@Injectable()
export class AdminTokenGuard implements CanActivate {
  constructor(private readonly prismaService: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const expectedToken = process.env.ADMIN_API_TOKEN;
    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const accessToken = this.accessTokenFromRequest(request);

    if (accessToken) {
      let payload;
      try {
        payload = verifyAdminAccessToken(accessToken);
      } catch {
        throw new ApiError(401, 'admin_invalid_access_token', 'Admin access token is invalid');
      }

      const session = await (this.prismaService.client as any).adminSession.findUnique({
        where: { id: payload.sessionId },
        include: { adminUser: true },
      });

      if (
        !session ||
        session.adminUserId !== payload.adminUserId ||
        session.revokedAt != null ||
        session.adminUser?.status !== 'active'
      ) {
        throw new ApiError(401, 'admin_stale_access_token', 'Admin access token is stale');
      }

      request.context.adminUserId = payload.adminUserId;
      request.context.adminSessionId = payload.sessionId;
      request.context.adminAuthMode = 'session';
      return true;
    }

    const rawToken = request.headers['x-admin-token'];
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

    if (!expectedToken || !token || !safeEqual(token, expectedToken)) {
      throw new ApiError(403, 'admin_forbidden', 'Admin access is forbidden');
    }

    request.context.adminAuthMode = 'legacy_token';
    return true;
  }

  private accessTokenFromRequest(request: RequestWithContext) {
    const rawHeader = request.headers.authorization;
    if (rawHeader?.startsWith('Bearer ')) {
      return rawHeader.slice('Bearer '.length);
    }
    return parseCookie(request.headers.cookie ?? '').frendly_admin_access ?? null;
  }
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookie(header: string) {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        if (index === -1) {
          return [part, ''];
        }
        return [part.slice(0, index), safeDecode(part.slice(index + 1))];
      }),
  );
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}
