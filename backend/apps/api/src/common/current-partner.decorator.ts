import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithContext } from './request-context';

export const CurrentPartner = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithContext>();
  return {
    partnerAccountId: request.context.partnerAccountId!,
    partnerId: request.context.partnerId ?? null,
    sessionId: request.context.sessionId,
  };
});
