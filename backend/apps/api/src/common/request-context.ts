import { Request } from 'express';

export interface RequestContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  partnerAccountId?: string;
  partnerId?: string;
}

export interface RequestWithContext extends Request {
  context: RequestContext;
}
