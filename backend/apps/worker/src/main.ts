import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WorkerAppModule } from './app.module';
import { WorkerService } from './worker.service';

async function bootstrap() {
  const app = await NestFactory.create(WorkerAppModule);
  app.get(WorkerService).start();
  await app.listen(Number(process.env.PORT ?? 3002));
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
