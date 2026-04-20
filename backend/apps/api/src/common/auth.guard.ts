import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyAccessToken } from '@big-break/database';
import { ApiError } from './api-error';
import { RequestWithContext } from './request-context';
import { PrismaService } from '../services/prisma.service';

export const IS_PUBLIC_ROUTE = 'isPublicRoute';

@Injectable()
export class AuthGuard implements CanActivate {
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
    } catch {
      throw new ApiError(401, 'invalid_access_token', 'Access token is invalid');
    }

    const session = await this.prismaService.client.session.findUnique({
      where: { id: payload.sessionId },
      select: {
        userId: true,
        revokedAt: true,
      },
    });

    if (!session || session.userId !== payload.userId || session.revokedAt != null) {
      throw new ApiError(401, 'stale_access_token', 'Access token is stale');
    }

    request.context.userId = payload.userId;
    request.context.sessionId = payload.sessionId;

    return true;
  }
}
