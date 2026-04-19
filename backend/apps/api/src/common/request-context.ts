import { Request } from 'express';

export interface RequestContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
}

export interface RequestWithContext extends Request {
  context: RequestContext;
}
