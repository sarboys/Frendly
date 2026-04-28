import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { DevLoginRequest } from '@big-break/contracts';
import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';
import { CurrentUser } from '../common/current-user.decorator';
import { Public } from '../common/public.decorator';
import { RequestWithContext } from '../common/request-context';
import { AuthService } from '../services/auth.service';
import { SocialAuthService } from '../services/social-auth.service';
import { TelegramAuthService } from '../services/telegram-auth.service';

class DevLoginRequestBody implements DevLoginRequest {
  @IsOptional()
  @IsString()
  userId?: string;
}

class PhoneCodeRequest {
  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;
}

class PhoneVerifyRequest {
  @IsString()
  @IsNotEmpty()
  challengeId!: string;

  @IsString()
  @Matches(/^\d{4}$/)
  code!: string;
}

class RefreshRequest {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

class TelegramVerifyRequest {
  @IsString()
  @IsNotEmpty()
  loginSessionId!: string;

  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/)
  code!: string;
}

class TelegramStartRequest {
  @IsOptional()
  @IsString()
  startToken?: string;
}

class GoogleVerifyRequest {
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}

class YandexVerifyRequest {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  codeVerifier!: string;

  @IsString()
  @IsNotEmpty()
  redirectUri!: string;
}

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly socialAuthService: SocialAuthService,
    private readonly telegramAuthService: TelegramAuthService,
  ) {}

  @Public()
  @Post('auth/dev/login')
  login(@Body() body: DevLoginRequestBody) {
    return this.authService.createDevSession(body.userId);
  }

  @Public()
  @Post('auth/phone/request')
  requestPhoneCode(
    @Body() body: PhoneCodeRequest,
    @Req() request: RequestWithContext,
  ) {
    return this.authService.requestPhoneCode(body.phoneNumber, {
      requestId: request.context.requestId,
      ip: request.ip,
      userAgent: request.get('user-agent') ?? undefined,
    });
  }

  @Public()
  @Post('auth/phone/verify')
  verifyPhoneCode(
    @Body() body: PhoneVerifyRequest,
    @Req() request: RequestWithContext,
  ) {
    return this.authService.verifyPhoneCode(body.challengeId, body.code, {
      requestId: request.context.requestId,
      ip: request.ip,
      userAgent: request.get('user-agent') ?? undefined,
    });
  }

  @Public()
  @Post('auth/phone/test-login')
  loginWithTestPhoneShortcut(@Body() body: PhoneCodeRequest) {
    return this.authService.loginWithTestPhoneShortcut(body.phoneNumber);
  }

  @Public()
  @Post('auth/refresh')
  refresh(@Body() body: RefreshRequest, @Req() request: RequestWithContext) {
    return this.authService.refreshSession(body.refreshToken, {
      requestId: request.context.requestId,
      ip: request.ip,
      userAgent: request.get('user-agent') ?? undefined,
    });
  }

  @Public()
  @Post('auth/telegram/start')
  startTelegramAuth(
    @Body() body: TelegramStartRequest,
    @Req() request: RequestWithContext,
  ) {
    return this.telegramAuthService.start({
      startToken: body.startToken?.trim() || undefined,
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

  @Public()
  @Post('auth/google/verify')
  verifyGoogleAuth(
    @Body() body: GoogleVerifyRequest,
    @Req() request: RequestWithContext,
  ) {
    return this.socialAuthService.verifyGoogleIdToken(body.idToken, {
      requestId: request.context.requestId,
      ip: request.ip,
      userAgent: request.get('user-agent') ?? undefined,
    });
  }

  @Public()
  @Post('auth/yandex/verify')
  verifyYandexAuth(
    @Body() body: YandexVerifyRequest,
    @Req() request: RequestWithContext,
  ) {
    return this.socialAuthService.verifyYandexAuthCode(
      {
        code: body.code,
        codeVerifier: body.codeVerifier,
        redirectUri: body.redirectUri,
      },
      {
        requestId: request.context.requestId,
        ip: request.ip,
        userAgent: request.get('user-agent') ?? undefined,
      },
    );
  }

  @Post('auth/logout')
  logout(
    @CurrentUser() currentUser: { userId: string; sessionId?: string },
    @Req() request: RequestWithContext,
  ) {
    return this.authService.logout(currentUser.sessionId, {
      requestId: request.context.requestId,
      ip: request.ip,
      userAgent: request.get('user-agent') ?? undefined,
    });
  }

  @Get('me')
  me(@CurrentUser() currentUser: { userId: string }) {
    return this.authService.getMe(currentUser.userId);
  }
}
