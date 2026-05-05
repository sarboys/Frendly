import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Response } from 'express';
import { RequestWithContext } from './request-context';

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_.:-]{1,128}$/;

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: RequestWithContext, res: Response, next: NextFunction) {
    const rawRequestId = Array.isArray(req.headers['x-request-id'])
      ? req.headers['x-request-id'][0]
      : req.headers['x-request-id'];
    const requestId =
      typeof rawRequestId === 'string' && REQUEST_ID_PATTERN.test(rawRequestId)
        ? rawRequestId
        : randomUUID();
    req.context = { requestId };
    res.setHeader('x-request-id', requestId);
    next();
  }
}
