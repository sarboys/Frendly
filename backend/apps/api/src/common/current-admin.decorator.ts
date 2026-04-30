import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithContext } from './request-context';

export const CurrentAdmin = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithContext>();
  return {
    adminUserId: request.context.adminUserId!,
    adminSessionId: request.context.adminSessionId,
    authMode: request.context.adminAuthMode,
  };
});
