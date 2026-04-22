import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { DatingService } from '../services/dating.service';

@Controller('dating')
export class DatingController {
  constructor(private readonly datingService: DatingService) {}

  @Get('discover')
  listDiscover(
    @CurrentUser() currentUser: { userId: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.datingService.listDiscover(currentUser.userId, {
      cursor,
      limit: limit == null ? undefined : Number(limit),
    });
  }

  @Get('likes')
  listLikes(
    @CurrentUser() currentUser: { userId: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.datingService.listLikes(currentUser.userId, {
      cursor,
      limit: limit == null ? undefined : Number(limit),
    });
  }

  @Post('actions')
  recordAction(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.datingService.recordAction(currentUser.userId, body);
  }
}
