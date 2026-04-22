import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { TelegramRelayService } from './telegram-relay.service';

@Module({
  controllers: [HealthController],
  providers: [TelegramRelayService],
})
export class TelegramRelayAppModule {}
