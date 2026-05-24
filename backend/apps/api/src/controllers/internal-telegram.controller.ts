import { Body, Controller, Headers, Logger, Post, Req } from '@nestjs/common';
import { TelegramDispatchRequest } from '@big-break/contracts';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { Public } from '../common/public.decorator';
import { RequestWithContext } from '../common/request-context';
import { ApiError } from '../common/api-error';
import { SupportService } from '../services/support.service';
import { TelegramAuthService } from '../services/telegram-auth.service';

class InternalTelegramDispatchRequest implements TelegramDispatchRequest {
  @IsString()
  @IsIn(['start', 'contact', 'support_start', 'support_message', 'support_reply'])
  kind!: TelegramDispatchRequest['kind'];

  @IsString()
  telegramUserId!: string;

  @IsString()
  chatId!: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  startToken?: string;

  @IsOptional()
  @IsString()
  startPayload?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  messageId?: string;

  @IsOptional()
  @IsString()
  replyToMessageId?: string;

  @IsOptional()
  @IsString()
  replyToText?: string;
}

@Controller('internal/telegram')
export class InternalTelegramController {
  private readonly logger = new Logger(InternalTelegramController.name);

  constructor(
    private readonly telegramAuthService: TelegramAuthService,
    private readonly supportService: SupportService,
  ) {}

  @Public()
  @Post('dispatch')
  dispatch(
    @Body() body: InternalTelegramDispatchRequest,
    @Headers('x-telegram-internal-secret') secret: string | undefined,
    @Req() request: RequestWithContext,
  ) {
    if (!this.isValidSecret(secret)) {
      this.logger.warn(
        `Rejected internal Telegram dispatch: requestId=${request.context.requestId} reason=invalid_secret`,
      );
      throw new ApiError(401, 'invalid_internal_secret', 'Internal secret is invalid');
    }

    const meta = {
      requestId: request.context.requestId,
      ip: request.ip,
      userAgent: request.get('user-agent') ?? undefined,
    };

    if (
      body.kind === 'support_start' ||
      body.kind === 'support_message' ||
      body.kind === 'support_reply'
    ) {
      return this.supportService.handleTelegramDispatch(body);
    }

    return this.telegramAuthService.dispatch(body, meta);
  }

  private isValidSecret(secret: string | undefined) {
    const isProduction = process.env.NODE_ENV === 'production';
    const configured = process.env.TELEGRAM_INTERNAL_SECRET?.trim();
    const fallback = process.env.TELEGRAM_BOT_TOKEN?.trim();

    if (!secret || secret.trim().length == 0) {
      return false;
    }

    if (configured) {
      return secret === configured;
    }

    return !isProduction && secret === fallback;
  }
}
