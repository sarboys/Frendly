import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { Public } from '../common/public.decorator';
import { PaymentsService } from '../services/payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('catalog')
  getCatalog() {
    return this.paymentsService.getCatalog();
  }

  @Post('init')
  initPayment(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.paymentsService.initPayment(currentUser.userId, body);
  }

  @Post(':orderId/check')
  checkPayment(
    @CurrentUser() currentUser: { userId: string },
    @Param('orderId') orderId: string,
  ) {
    return this.paymentsService.checkPayment(currentUser.userId, orderId);
  }

  @Public()
  @Post('tbank/webhook')
  @HttpCode(200)
  tbankWebhook(@Body() body: Record<string, unknown>) {
    return this.paymentsService.handleTbankWebhook(body);
  }
}
