import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { TelegramRelayAppModule } from './app.module';
import { TelegramRelayService } from './telegram-relay.service';

async function bootstrap() {
  const app = await NestFactory.create(TelegramRelayAppModule);
  await app.get(TelegramRelayService).start();
  await app.listen(Number(process.env.PORT ?? 3003));
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
