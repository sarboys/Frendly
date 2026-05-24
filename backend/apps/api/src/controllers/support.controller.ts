import { Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { SupportService } from '../services/support.service';

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('telegram/start')
  startTelegramSupport(@CurrentUser() currentUser: { userId: string }) {
    return this.supportService.startTelegramSupport(currentUser.userId);
  }
}
