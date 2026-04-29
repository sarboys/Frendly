import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentPartner } from '../common/current-partner.decorator';
import { PartnerAuthGuard } from '../common/partner-auth.guard';
import { Public } from '../common/public.decorator';
import { PartnerAuthService } from '../services/partner-auth.service';

@Controller('partner')
export class PartnerAuthController {
  constructor(private readonly partnerAuthService: PartnerAuthService) {}

  @Public()
  @Post('auth/register')
  register(@Body() body: Record<string, unknown>) {
    return this.partnerAuthService.register(body);
  }

  @Public()
  @Post('auth/login')
  login(@Body() body: Record<string, unknown>) {
    return this.partnerAuthService.login(body);
  }

  @Public()
  @Post('auth/refresh')
  refresh(@Body() body: Record<string, unknown>) {
    return this.partnerAuthService.refresh(String(body.refreshToken ?? ''));
  }

  @Public()
  @Post('auth/logout')
  logout(@Body() body: Record<string, unknown>) {
    return this.partnerAuthService.logout(String(body.refreshToken ?? ''));
  }

  @Public()
  @UseGuards(PartnerAuthGuard)
  @Get('me')
  me(@CurrentPartner() currentPartner: { partnerAccountId: string }) {
    return this.partnerAuthService.getMe(currentPartner.partnerAccountId);
  }
}
