import { Controller, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/public.decorator';
import { PartnerOfferCodeService } from '../services/partner-offer-code.service';

@Controller('public/offer-codes')
export class PublicCodeController {
  constructor(private readonly partnerOfferCodeService: PartnerOfferCodeService) {}

  @Public()
  @Post(':code/activate')
  activateOfferCode(@Param('code') code: string, @Req() request: Request) {
    return this.partnerOfferCodeService.activateCode(code, {
      ip: this.requestIp(request),
      userAgent: this.userAgent(request),
    });
  }

  private requestIp(request: Request) {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0]?.trim() ?? null;
    }
    if (Array.isArray(forwarded) && forwarded[0]) {
      return forwarded[0].split(',')[0]?.trim() ?? null;
    }
    return request.ip ?? request.socket.remoteAddress ?? null;
  }

  private userAgent(request: Request) {
    const value = request.headers['user-agent'];
    return Array.isArray(value) ? value[0] ?? null : value ?? null;
  }
}
