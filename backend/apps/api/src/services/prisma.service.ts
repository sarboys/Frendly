import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { bindPrismaMetrics, getPrismaClient } from '@big-break/database';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient = bindPrismaMetrics(getPrismaClient(), 'api');

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
