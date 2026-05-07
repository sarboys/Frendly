import { Controller, Get, Headers, Param, Query, Res, StreamableFile } from '@nestjs/common';
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
    @Query('url') url: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const image = await this.afficheService.getImage(key, url, ifNoneMatch);
    response.setHeader('Cache-Control', image.cacheControl);
    response.setHeader('ETag', image.etag);
    if ('notModified' in image) {
      response.status(304).end();
      return;
    }

    response.setHeader('Content-Type', image.mimeType);
    if (image.contentLength != null) {
      response.setHeader('Content-Length', image.contentLength);
    }
    return new StreamableFile(image.stream);
  }
}
