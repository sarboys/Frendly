import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { DevLoginRequest } from '@big-break/contracts';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';
import { ApiError } from '../common/api-error';
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

  @IsBoolean()
  acceptedTerms!: boolean;
}

class PhoneVerifyRequest {
  @IsString()
  @IsNotEmpty()
  challengeId!: string;

  @IsString()
  @Matches(/^\d{4}$/)
  code!: string;

  @IsBoolean()
  acceptedTerms!: boolean;
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

  @IsBoolean()
  acceptedTerms!: boolean;
}

class TelegramStartRequest {
  @IsOptional()
  @IsString()
  startToken?: string;

  @IsBoolean()
  acceptedTerms!: boolean;
}

class GoogleVerifyRequest {
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @IsBoolean()
  acceptedTerms!: boolean;
}

class YandexVerifyRequest {
  @IsString()
  @IsNotEmpty()
  oauthToken!: string;

  @IsBoolean()
  acceptedTerms!: boolean;
}

class AppleVerifyRequest {
  @IsString()
  @IsNotEmpty()
  identityToken!: string;

  @IsOptional()
  @IsString()
  authorizationCode?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsBoolean()
  acceptedTerms!: boolean;
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
    this.assertAcceptedTerms(body.acceptedTerms);
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
    this.assertAcceptedTerms(body.acceptedTerms);
    return this.authService.verifyPhoneCode(body.challengeId, body.code, {
      requestId: request.context.requestId,
      ip: request.ip,
      userAgent: request.get('user-agent') ?? undefined,
    });
  }

  @Public()
  @Post('auth/phone/test-login')
  loginWithTestPhoneShortcut(@Body() body: PhoneCodeRequest) {
    this.assertAcceptedTerms(body.acceptedTerms);
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
    this.assertAcceptedTerms(body.acceptedTerms);
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
    this.assertAcceptedTerms(body.acceptedTerms);
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
    this.assertAcceptedTerms(body.acceptedTerms);
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
    this.assertAcceptedTerms(body.acceptedTerms);
    return this.socialAuthService.verifyYandexOAuthToken(
      body.oauthToken,
      {
        requestId: request.context.requestId,
        ip: request.ip,
        userAgent: request.get('user-agent') ?? undefined,
      },
    );
  }

  @Public()
  @Post('auth/apple/verify')
  verifyAppleAuth(
    @Body() body: AppleVerifyRequest,
    @Req() request: RequestWithContext,
  ) {
    this.assertAcceptedTerms(body.acceptedTerms);
    return this.socialAuthService.verifyAppleIdentityToken(
      body.identityToken,
      { displayName: body.fullName },
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

  private assertAcceptedTerms(acceptedTerms: boolean) {
    if (acceptedTerms !== true) {
      throw new ApiError(
        400,
        'terms_not_accepted',
        'Terms must be accepted before login',
      );
    }
  }
}
