import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_ROUTE } from './auth.guard';

export const Public = () => SetMetadata(IS_PUBLIC_ROUTE, true);
