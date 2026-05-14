import { Module } from '@nestjs/common';
import { ChatServerService } from './chat-server.service';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [HealthController, MetricsController],
  providers: [ChatServerService, PrismaService],
})
export class ChatAppModule {}
