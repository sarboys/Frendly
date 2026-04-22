import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AfterDarkService } from '../services/after-dark.service';

@Controller('after-dark')
export class AfterDarkController {
  constructor(private readonly afterDarkService: AfterDarkService) {}

  @Get('access')
  getAccess(@CurrentUser() currentUser: { userId: string }) {
    return this.afterDarkService.getAccess(currentUser.userId);
  }

  @Post('unlock')
  unlock(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.afterDarkService.unlock(currentUser.userId, body);
  }

  @Get('events')
  listEvents(
    @CurrentUser() currentUser: { userId: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.afterDarkService.listEvents(currentUser.userId, {
      cursor,
      limit: limit == null ? undefined : Number(limit),
    });
  }

  @Get('events/:eventId')
  getEvent(
    @CurrentUser() currentUser: { userId: string },
    @Param('eventId') eventId: string,
  ) {
    return this.afterDarkService.getEventDetail(currentUser.userId, eventId);
  }

  @Post('events/:eventId/join')
  joinEvent(
    @CurrentUser() currentUser: { userId: string },
    @Param('eventId') eventId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.afterDarkService.joinEvent(currentUser.userId, eventId, body);
  }
}
