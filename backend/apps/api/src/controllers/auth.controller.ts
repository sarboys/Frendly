import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { DevLoginRequest } from '@big-break/contracts';
import { IsString, Length } from 'class-validator';
import { CurrentUser } from '../common/current-user.decorator';
import { Public } from '../common/public.decorator';
import { RequestWithContext } from '../common/request-context';
import { AuthService } from '../services/auth.service';
import { TelegramAuthService } from '../services/telegram-auth.service';

class TelegramVerifyRequest {
  @IsString()
  loginSessionId!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly telegramAuthService: TelegramAuthService,
  ) {}

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

  @Public()
  @Post('auth/telegram/start')
  startTelegramAuth(@Req() request: RequestWithContext) {
    return this.telegramAuthService.start({
      requestId: request.context.requestId,
      ip: request.ip,
      userAgent: request.get('user-agent') ?? undefined,
    });
  }

  @Public()
  @Post('auth/telegram/verify')
  verifyTelegramAuth(
    @Body() body: TelegramVerifyRequest,
    @Req() request: RequestWithContext,
  ) {
    return this.telegramAuthService.verify(body.loginSessionId, body.code, {
      requestId: request.context.requestId,
      ip: request.ip,
      userAgent: request.get('user-agent') ?? undefined,
    });
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
