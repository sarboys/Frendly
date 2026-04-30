import { Request } from 'express';

export interface RequestContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  partnerAccountId?: string;
  partnerId?: string;
  adminUserId?: string;
  adminSessionId?: string;
  adminAuthMode?: 'session' | 'legacy_token';
}

export interface RequestWithContext extends Request {
  context: RequestContext;
}
