import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ChatAppModule } from './app.module';
import { ChatServerService } from './chat-server.service';

async function bootstrap() {
  const app = await NestFactory.create(ChatAppModule);
  const chatServer = app.get(ChatServerService);
  chatServer.attach(app.getHttpServer());
  await app.listen(Number(process.env.PORT ?? 3001));
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
