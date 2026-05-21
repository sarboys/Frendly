import { Controller, Get, Headers, Param, Res, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/current-user.decorator';
import { Public } from '../common/public.decorator';
import { MediaService } from '../services/media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get(':assetId/variants/:variantKey/download-url')
  getVariantDownloadUrl(
    @CurrentUser() currentUser: { userId: string },
    @Param('assetId') assetId: string,
    @Param('variantKey') variantKey: string,
  ) {
    return this.mediaService.getVariantDownloadUrl(
      currentUser.userId,
      assetId,
      variantKey,
    );
  }

  @Get(':assetId/download-url')
  getDownloadUrl(
    @CurrentUser() currentUser: { userId: string },
    @Param('assetId') assetId: string,
  ) {
    return this.mediaService.getDownloadUrl(currentUser.userId, assetId);
  }

  @Public()
  @Get(':assetId/variants/:variantKey')
  async getVariant(
    @Param('assetId') assetId: string,
    @Param('variantKey') variantKey: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Headers('if-modified-since') ifModifiedSince: string | undefined,
    @Headers('authorization') authorizationHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const media = await this.mediaService.getVariant(
      assetId,
      variantKey,
      authorizationHeader,
      ifNoneMatch,
      ifModifiedSince,
    );
    response.setHeader('Cache-Control', media.cacheControl);
    response.setHeader('ETag', media.etag);
    response.setHeader('Last-Modified', media.lastModified);
    if (media.cacheControl.startsWith('private')) {
      response.setHeader('Vary', 'Authorization');
    }

    if ('notModified' in media) {
      response.status(304).end();
      return;
    }

    if ('redirectUrl' in media) {
      response.redirect(307, media.redirectUrl);
      return;
    }

    response.setHeader('Content-Type', media.mimeType);
    response.setHeader('Content-Length', String(media.contentLength));
    return new StreamableFile(media.stream);
  }

  @Public()
  @Get(':assetId')
  async getMedia(
    @Param('assetId') assetId: string,
    @Headers('range') rangeHeader: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Headers('if-modified-since') ifModifiedSince: string | undefined,
    @Headers('authorization') authorizationHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const media = await this.mediaService.getAsset(
      assetId,
      rangeHeader,
      authorizationHeader,
      ifNoneMatch,
      ifModifiedSince,
    );
    response.setHeader('Cache-Control', media.cacheControl);
    response.setHeader('ETag', media.etag);
    response.setHeader('Last-Modified', media.lastModified);
    if (media.cacheControl.startsWith('private')) {
      response.setHeader('Vary', 'Authorization');
    }

    if ('notModified' in media) {
      response.status(304).end();
      return;
    }

    if ('redirectUrl' in media) {
      response.redirect(307, media.redirectUrl);
      return;
    }

    response.setHeader('Content-Type', media.mimeType);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Length', String(media.contentLength));
    if (media.contentRange != null) {
      response.status(206);
      response.setHeader('Content-Range', media.contentRange);
    }
    return new StreamableFile(media.stream);
  }
}
