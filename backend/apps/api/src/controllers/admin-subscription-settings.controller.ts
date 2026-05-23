import { Body, Controller, Get, Put } from '@nestjs/common';
import { Admin } from '../common/admin.decorator';
import { SubscriptionService } from '../services/subscription.service';

@Admin()
@Controller('admin/subscription-settings')
export class AdminSubscriptionSettingsController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  getSettings() {
    return this.subscriptionService.getAdminCatalog();
  }

  @Put()
  updateSettings(@Body() body: Record<string, unknown>) {
    return this.subscriptionService.updateAdminCatalog(body);
  }
}
