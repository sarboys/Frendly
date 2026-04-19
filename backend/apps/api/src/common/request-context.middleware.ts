import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Response } from 'express';
import { RequestWithContext } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: RequestWithContext, res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    req.context = { requestId };
    res.setHeader('x-request-id', requestId);
    next();
  }
}
