import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ApiAppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(ApiAppModule);
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
      whitelist: false,
      transform: true,
    }),
  );
  await app.listen(Number(process.env.PORT ?? 3000));
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
