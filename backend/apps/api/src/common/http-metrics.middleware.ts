import { appMetrics } from '@big-break/database';
import type { NextFunction, Request, Response } from 'express';

type RouteLike = {
  path?: unknown;
};

const statusClassOf = (statusCode: number) => `${Math.floor(statusCode / 100)}xx`;

const routePathOf = (request: Request) => {
  const route = (request as Request & { route?: RouteLike }).route;
  const routePath = route?.path;
  if (typeof routePath === 'string') {
    return `${request.baseUrl ?? ''}${routePath}`;
  }
  if (Array.isArray(routePath) && typeof routePath[0] === 'string') {
    return `${request.baseUrl ?? ''}${routePath[0]}`;
  }
  const fallbackUrl = request.path || request.url || 'unknown';
  return fallbackUrl.split('?')[0] || 'unknown';
};

const payloadBytesOf = (response: Response) => {
  const contentLength = response.getHeader('content-length');
  if (typeof contentLength === 'number') {
    return Number.isFinite(contentLength) && contentLength >= 0 ? contentLength : null;
  }
  if (typeof contentLength === 'string') {
    const parsed = Number(contentLength);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
};

export const createHttpMetricsMiddleware =
  (service: string) => (request: Request, response: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();

    response.once('finish', () => {
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      const labels = {
        service,
        method: request.method,
        endpoint: routePathOf(request),
        status_class: statusClassOf(response.statusCode),
      };

      appMetrics.httpRequestDurationSeconds.observe(labels, durationSeconds);

      const payloadBytes = payloadBytesOf(response);
      if (payloadBytes != null) {
        appMetrics.httpResponsePayloadBytes.observe(labels, payloadBytes);
      }
    });

    next();
  };
