import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithContext } from './request-context';

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithContext>();
  return {
    userId: request.context.userId!,
    sessionId: request.context.sessionId,
  };
});
