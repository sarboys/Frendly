import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { StoriesService } from '../services/stories.service';

@Controller('events/:eventId/stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Get()
  listStories(
    @CurrentUser() currentUser: { userId: string },
    @Param('eventId') eventId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.storiesService.listStories(currentUser.userId, eventId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post()
  createStory(
    @CurrentUser() currentUser: { userId: string },
    @Param('eventId') eventId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.storiesService.createStory(currentUser.userId, eventId, body);
  }
}
