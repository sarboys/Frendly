import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Admin } from '../common/admin.decorator';
import { AdminAfficheService } from '../services/admin-affiche.service';

@Admin()
@Controller('admin/affiche')
export class AdminAfficheController {
  constructor(private readonly adminAfficheService: AdminAfficheService) {}

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
