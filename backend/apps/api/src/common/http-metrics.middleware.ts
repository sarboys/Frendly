import { appMetrics } from '@big-break/database';
import type { NextFunction, Request, Response } from 'express';

type RouteLike = {
  path?: unknown;
};

type ErrorPayloadLike = {
  code?: unknown;
};

const unmatchedEndpoint = 'unmatched';
const noErrorCode = 'none';
const unknownErrorCode = 'unknown';
const safeErrorCodePattern = /^[a-zA-Z0-9_.:-]{1,80}$/;

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
  return unmatchedEndpoint;
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

const safeErrorCodeOf = (value: unknown) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return safeErrorCodePattern.test(trimmed) ? trimmed : null;
};

const errorCodeFromPayload = (payload: unknown) => {
  if (payload == null || typeof payload !== 'object') {
    return null;
  }
  return safeErrorCodeOf((payload as ErrorPayloadLike).code);
};

const errorCodeLabelOf = (statusCode: number, errorCode: string | null) => {
  if (statusCode < 400) {
    return noErrorCode;
  }
  return errorCode ?? unknownErrorCode;
};

export const createHttpMetricsMiddleware =
  (service: string) => (request: Request, response: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();
    let capturedErrorCode: string | null = null;

    const originalJson = response.json;
    response.json = function jsonWithMetrics(this: Response, payload?: unknown) {
      capturedErrorCode = errorCodeFromPayload(payload) ?? capturedErrorCode;
      return originalJson.call(this, payload);
    } as typeof response.json;

    response.once('finish', () => {
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      const labels = {
        service,
        method: request.method,
        endpoint: routePathOf(request),
        status_class: statusClassOf(response.statusCode),
        status_code: String(response.statusCode),
        error_code: errorCodeLabelOf(response.statusCode, capturedErrorCode),
      };

      appMetrics.httpRequestDurationSeconds.observe(labels, durationSeconds);

      const payloadBytes = payloadBytesOf(response);
      if (payloadBytes != null) {
        appMetrics.httpResponsePayloadBytes.observe(labels, payloadBytes);
      }
    });

    next();
  };
