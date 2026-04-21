import { Controller, Get, Headers, Param, Res, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../common/public.decorator';
import { MediaService } from '../services/media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Public()
  @Get(':assetId')
  async getMedia(
    @Param('assetId') assetId: string,
    @Headers('range') rangeHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const media = await this.mediaService.getAsset(assetId, rangeHeader);
    response.setHeader('Content-Type', media.mimeType);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Length', String(media.contentLength));
    if (media.contentRange != null) {
      response.status(206);
      response.setHeader('Content-Range', media.contentRange);
    }
    return new StreamableFile(media.stream);
  }
}
