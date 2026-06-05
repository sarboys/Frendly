import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { Public } from '../common/public.decorator';
import { CheckoutService } from '../services/checkout.service';

@Controller()
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('checkout/sessions')
  createSession(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.checkoutService.createSession(currentUser.userId, body);
  }

  @Public()
  @Get('public/checkout/:token')
  getPublicSession(@Param('token') token: string) {
    return this.checkoutService.getPublicSession(token);
  }

  @Public()
  @Post('public/checkout/:token/payments/init')
  initPayment(
    @Param('token') token: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.checkoutService.initPayment(token, body);
  }

  @Public()
  @Get('public/checkout/:token/payments/:orderId')
  checkPayment(
    @Param('token') token: string,
    @Param('orderId') orderId: string,
  ) {
    return this.checkoutService.checkPayment(token, orderId);
  }
}
