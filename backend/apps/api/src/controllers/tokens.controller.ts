import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { TokensService } from '../services/tokens.service';

@Controller('tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get('wallet')
  getWallet(@CurrentUser() currentUser: { userId: string }) {
    return this.tokensService.getWallet(currentUser.userId);
  }

  @Post('promotions')
  createPromotion(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.tokensService.createPromotion(currentUser.userId, body);
  }
}
