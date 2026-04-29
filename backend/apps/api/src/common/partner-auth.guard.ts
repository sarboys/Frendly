import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { verifyPartnerAccessToken } from '@big-break/database';
import { ApiError } from './api-error';
import { RequestWithContext } from './request-context';
import { PrismaService } from '../services/prisma.service';

@Injectable()
export class PartnerAuthGuard implements CanActivate {
  private readonly logger = new Logger(PartnerAuthGuard.name);

  constructor(private readonly prismaService: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const rawHeader = request.headers.authorization;

    if (!rawHeader?.startsWith('Bearer ')) {
      throw new ApiError(401, 'partner_auth_required', 'Missing partner bearer token');
    }

    const token = rawHeader.slice('Bearer '.length);
    let payload;
    try {
      payload = verifyPartnerAccessToken(token);
    } catch {
      this.logger.warn(
        `Rejected partner access token: requestId=${request.context.requestId} reason=invalid_payload`,
      );
      throw new ApiError(401, 'partner_invalid_access_token', 'Partner access token is invalid');
    }

    const session = await this.prismaService.client.partnerSession.findUnique({
      where: { id: payload.sessionId },
      include: {
        partnerAccount: true,
      },
    });

    if (
      !session ||
      session.partnerAccountId !== payload.partnerAccountId ||
      session.revokedAt != null
    ) {
      throw new ApiError(401, 'partner_stale_access_token', 'Partner access token is stale');
    }

    if (session.partnerAccount.status === 'suspended') {
      throw new ApiError(403, 'partner_account_suspended', 'Partner account is suspended');
    }

    request.context.sessionId = session.id;
    request.context.partnerAccountId = session.partnerAccountId;
    request.context.partnerId = session.partnerAccount.partnerId ?? undefined;

    return true;
  }
}
