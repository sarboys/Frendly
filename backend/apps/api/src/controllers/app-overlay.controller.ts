import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AppOverlayService } from '../services/app-overlay.service';

@Controller('app/overlay')
export class AppOverlayController {
  constructor(private readonly appOverlayService: AppOverlayService) {}

  @Get()
  getOverlay(
    @CurrentUser() currentUser: { userId: string },
    @Query('platform') platform?: string,
    @Query('buildNumber') buildNumber?: string,
  ) {
    return this.appOverlayService.resolveOverlay(currentUser.userId, {
      platform,
      buildNumber,
    });
  }

  @Post('events')
  recordOverlayEvent(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.appOverlayService.recordEvent(currentUser.userId, body);
  }
}
