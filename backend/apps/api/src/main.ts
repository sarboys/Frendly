import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ApiAppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { createHttpMetricsMiddleware } from './common/http-metrics.middleware';
import { normalizeDuplicateSlashesInPath } from './common/normalize-request-url';

async function bootstrap() {
  const app = await NestFactory.create(ApiAppModule);
  app.enableShutdownHooks();
  app.use((request: Request, _response: Response, next: NextFunction) => {
    request.url = normalizeDuplicateSlashesInPath(request.url) ?? request.url;
    next();
  });
  app.use(createHttpMetricsMiddleware('api'));
  const corsOrigin = process.env.CORS_ORIGIN
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (corsOrigin && corsOrigin.length > 0) {
    app.enableCors({
      origin: corsOrigin,
      credentials: true,
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.listen(Number(process.env.PORT ?? 3000));
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
