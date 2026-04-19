import { Body, Controller, Get, Post } from '@nestjs/common';
import { DevLoginRequest } from '@big-break/contracts';
import { CurrentUser } from '../common/current-user.decorator';
import { Public } from '../common/public.decorator';
import { AuthService } from '../services/auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('auth/dev/login')
  login(@Body() body: DevLoginRequest) {
    return this.authService.createDevSession(body.userId);
  }

  @Public()
  @Post('auth/phone/request')
  requestPhoneCode(@Body() body: { phoneNumber?: string }) {
    return this.authService.requestPhoneCode(body.phoneNumber ?? '');
  }

  @Public()
  @Post('auth/phone/verify')
  verifyPhoneCode(@Body() body: { challengeId?: string; code?: string }) {
    return this.authService.verifyPhoneCode(body.challengeId ?? '', body.code ?? '');
  }

  @Public()
  @Post('auth/refresh')
  refresh(@Body() body: { refreshToken?: string }) {
    return this.authService.refreshSession(body.refreshToken ?? '');
  }

  @Post('auth/logout')
  logout(@CurrentUser() currentUser: { userId: string; sessionId?: string }) {
    return this.authService.logout(currentUser.sessionId);
  }

  @Get('me')
  me(@CurrentUser() currentUser: { userId: string }) {
    return this.authService.getMe(currentUser.userId);
  }
}
