import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '@big-break/database';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient = getPrismaClient();

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
