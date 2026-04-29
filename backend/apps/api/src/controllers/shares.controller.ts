import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { Public } from '../common/public.decorator';
import { SharesService } from '../services/shares.service';

@Controller()
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Post('shares')
  createShare(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.sharesService.createShare(currentUser.userId, body);
  }

  @Public()
  @Get('public/shares/:slug')
  getPublicShare(@Param('slug') slug: string) {
    return this.sharesService.getPublicShare(slug);
  }
}
