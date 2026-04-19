import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { SubscriptionService } from '../services/subscription.service';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('plans')
  getPlans() {
    return this.subscriptionService.getPlans();
  }

  @Get('me')
  getCurrent(@CurrentUser() currentUser: { userId: string }) {
    return this.subscriptionService.getCurrent(currentUser.userId);
  }

  @Post('subscribe')
  subscribe(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.subscriptionService.subscribe(currentUser.userId, body);
  }

  @Post('restore')
  restore(@CurrentUser() currentUser: { userId: string }) {
    return this.subscriptionService.restore(currentUser.userId);
  }
}
