import { applyDecorators, UseGuards, UseInterceptors } from '@nestjs/common';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { AdminTokenGuard } from './admin-token.guard';
import { Public } from './public.decorator';

export const Admin = () =>
  applyDecorators(Public(), UseGuards(AdminTokenGuard), UseInterceptors(AdminAuditInterceptor));
