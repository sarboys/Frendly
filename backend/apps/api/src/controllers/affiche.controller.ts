import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../common/public.decorator';
import { AfficheService } from '../services/affiche.service';

@Public()
@Controller('affiche')
export class AfficheController {
  constructor(private readonly afficheService: AfficheService) {}

  @Get('events')
  listEvents(@Query() query: Record<string, unknown>) {
    return this.afficheService.listEvents(query);
  }

  @Get('events/:eventId')
  getEvent(@Param('eventId') eventId: string) {
    return this.afficheService.getEvent(eventId);
  }

  @Get('images')
  async getImage(
    @Query('key') key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const image = await this.afficheService.getImageRedirect(key);
    response.setHeader('Cache-Control', image.cacheControl);
    response.redirect(307, image.redirectUrl);
  }
}
