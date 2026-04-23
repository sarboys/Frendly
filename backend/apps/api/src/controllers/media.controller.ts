import { Controller, Get, Headers, Param, Res, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/current-user.decorator';
import { Public } from '../common/public.decorator';
import { MediaService } from '../services/media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get(':assetId/download-url')
  getDownloadUrl(
    @CurrentUser() currentUser: { userId: string },
    @Param('assetId') assetId: string,
  ) {
    return this.mediaService.getDownloadUrl(currentUser.userId, assetId);
  }

  @Public()
  @Get(':assetId')
  async getMedia(
    @Param('assetId') assetId: string,
    @Headers('range') rangeHeader: string | undefined,
    @Headers('authorization') authorizationHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const media = await this.mediaService.getAsset(
      assetId,
      rangeHeader,
      authorizationHeader,
    );
    response.setHeader('Content-Type', media.mimeType);
    response.setHeader('Cache-Control', media.cacheControl);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Length', String(media.contentLength));
    if (media.contentRange != null) {
      response.status(206);
      response.setHeader('Content-Range', media.contentRange);
    }
    return new StreamableFile(media.stream);
  }
}
