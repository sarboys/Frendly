import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RequestWithContext } from './request-context';
import { PrismaService } from '../services/prisma.service';

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly prismaService: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const response = context.switchToHttp().getResponse<{ statusCode?: number }>();
    return next.handle().pipe(
      tap({
        next: () => this.record(request, response.statusCode ?? 200),
        error: (error) => this.record(request, error?.statusCode ?? error?.status ?? 500),
      }),
    );
  }

  private record(request: RequestWithContext, statusCode: number) {
    void (this.prismaService.client as any).adminAuditEvent
      ?.create({
        data: {
          adminUserId: request.context.adminUserId ?? null,
          sessionId: request.context.adminSessionId ?? null,
          action: `${request.method} ${request.route?.path ?? request.path}`,
          method: request.method,
          path: request.originalUrl ?? request.url,
          statusCode,
          requestId: request.context.requestId,
          ip: request.ip,
          userAgent: request.get('user-agent') ?? null,
          metadata: {
            authMode: request.context.adminAuthMode ?? null,
          },
        },
      })
      .catch(() => undefined);
  }
}
