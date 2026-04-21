import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
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
    @Res({ passthrough: true }) response: Response,
  ) {
    const media = await this.mediaService.getAsset(assetId);
    response.setHeader('Content-Type', media.mimeType);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return new StreamableFile(media.bytes);
  }
}
