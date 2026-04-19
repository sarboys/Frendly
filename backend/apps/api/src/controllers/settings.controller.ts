import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { SettingsService } from '../services/settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('me')
  getSettings(@CurrentUser() currentUser: { userId: string }) {
    return this.settingsService.getSettings(currentUser.userId);
  }

  @Put('me')
  updateSettings(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.settingsService.updateSettings(currentUser.userId, body);
  }
}
