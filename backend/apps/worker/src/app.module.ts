import { Module } from '@nestjs/common';
import { OpenRouterClient } from '@big-break/database';
import { ContentImportService } from './content/content-import.service';
import { ContentNormalizerService } from './content/content-normalizer.service';
import { ExternalSourceRegistry } from './content/external-source.registry';
import { RouteDraftGenerationService } from './content/route-draft-generation.service';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { WorkerService } from './worker.service';

@Module({
  controllers: [HealthController],
  providers: [
    PrismaService,
    ContentNormalizerService,
    ExternalSourceRegistry,
    ContentImportService,
    RouteDraftGenerationService,
    {
      provide: OpenRouterClient,
      useFactory: () => new OpenRouterClient(),
    },
    WorkerService,
  ],
})
export class WorkerAppModule {}
