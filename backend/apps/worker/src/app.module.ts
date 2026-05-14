import { Module } from '@nestjs/common';
import { OpenRouterClient } from '@big-break/database';
import { ContentImportService } from './content/content-import.service';
import { ContentImageMirrorService } from './content/content-image-mirror.service';
import { ContentNormalizerService } from './content/content-normalizer.service';
import { ExternalSourceRegistry } from './content/external-source.registry';
import { RouteDraftGenerationService } from './content/route-draft-generation.service';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';
import { PrismaService } from './prisma.service';
import { WorkerService } from './worker.service';

@Module({
  controllers: [HealthController, MetricsController],
  providers: [
    PrismaService,
    ContentImageMirrorService,
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
