import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { PaymentsService } from '../services/payments.service';
import { SubscriptionService } from '../services/subscription.service';

@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly paymentsService: PaymentsService,
  ) {}

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
    if (!this.paymentsService.isEnabled()) {
      return this.subscriptionService.subscribe(currentUser.userId, body);
    }
    const plan = typeof body.plan === 'string' ? body.plan : '';
    return this.paymentsService.initPayment(currentUser.userId, {
      productKind: 'subscription',
      productId: plan,
    });
  }

  @Post('restore')
  restore(@CurrentUser() currentUser: { userId: string }) {
    return this.subscriptionService.restore(currentUser.userId);
  }
}
