import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Admin } from '../common/admin.decorator';
import { AdminAfficheService } from '../services/admin-affiche.service';

@Admin()
@Controller('admin/affiche')
export class AdminAfficheController {
  constructor(private readonly adminAfficheService: AdminAfficheService) {}

  @Get('posters')
  listPosters(@Query() query: Record<string, unknown>) {
    return this.adminAfficheService.listPosters(query);
  }

  @Post('posters')
  createPoster(@Body() body: Record<string, unknown>) {
    return this.adminAfficheService.createPoster(body);
  }

  @Get('posters/:posterId')
  getPoster(@Param('posterId') posterId: string) {
    return this.adminAfficheService.getPoster(posterId);
  }

  @Patch('posters/:posterId')
  updatePoster(
    @Param('posterId') posterId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminAfficheService.updatePoster(posterId, body);
  }

  @Post('posters/:posterId/:action')
  posterAction(
    @Param('posterId') posterId: string,
    @Param('action') action: string,
  ) {
    return this.adminAfficheService.posterAction(posterId, action);
  }

  @Get('content-items')
  listContentItems(@Query() query: Record<string, unknown>) {
    return this.adminAfficheService.listContentItems(query);
  }

  @Get('content-items/:itemId')
  getContentItem(@Param('itemId') itemId: string) {
    return this.adminAfficheService.getContentItem(itemId);
  }

  @Patch('content-items/:itemId')
  updateContentItem(
    @Param('itemId') itemId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminAfficheService.updateContentItem(itemId, body);
  }

  @Post('content-items/:itemId/:action')
  contentItemAction(
    @Param('itemId') itemId: string,
    @Param('action') action: string,
  ) {
    return this.adminAfficheService.contentItemAction(itemId, action);
  }
}
