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
      const uploadError = this.mapUploadFileSizeError(exception, request);
      if (uploadError) {
        const payload: ApiErrorPayload = {
          code: uploadError.code,
          message: uploadError.message,
          requestId,
        };
        response.status(uploadError.statusCode).json(payload);
        return;
      }

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
      message: 'Internal server error',
      requestId,
    };

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(payload);
  }

  private mapUploadFileSizeError(
    exception: HttpException,
    request: Request,
  ): { statusCode: number; code: string; message: string } | null {
    if (exception.getStatus() !== HttpStatus.PAYLOAD_TOO_LARGE) {
      return null;
    }

    const path = request.path ?? request.url;
    if (path === '/uploads/chat-attachment/file') {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'chat_attachment_too_large',
        message: 'Attachment is too large',
      };
    }

    return null;
  }
}
