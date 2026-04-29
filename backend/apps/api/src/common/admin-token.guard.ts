import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ApiError } from './api-error';

@Injectable()
export class AdminTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expectedToken = process.env.ADMIN_API_TOKEN;
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const rawToken = request.headers['x-admin-token'];
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

    if (!expectedToken || token !== expectedToken) {
      throw new ApiError(403, 'admin_forbidden', 'Admin access is forbidden');
    }

    return true;
  }
}
