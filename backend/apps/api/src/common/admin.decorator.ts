import { applyDecorators, UseGuards } from '@nestjs/common';
import { AdminTokenGuard } from './admin-token.guard';
import { Public } from './public.decorator';

export const Admin = () => applyDecorators(Public(), UseGuards(AdminTokenGuard));
