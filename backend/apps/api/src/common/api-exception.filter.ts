import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { ApiErrorPayload } from '@big-break/contracts';
import { Request, Response } from 'express';
import { ApiError } from './api-error';
import { RequestWithContext } from './request-context';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithContext>();

    const requestId = request.context?.requestId ?? 'unknown-request';

    if (exception instanceof ApiError) {
      const payload: ApiErrorPayload = {
        code: exception.code,
        message: exception.message,
        details: exception.details,
        requestId,
      };
      response.status(exception.statusCode).json(payload);
      return;
    }

    if (exception instanceof HttpException) {
      const payload: ApiErrorPayload = {
        code: 'http_error',
        message: exception.message,
        details: exception.getResponse(),
        requestId,
      };
      response.status(exception.getStatus()).json(payload);
      return;
    }

    const payload: ApiErrorPayload = {
      code: 'internal_error',
      message: exception instanceof Error ? exception.message : 'Internal server error',
      requestId,
    };

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(payload);
  }
}
