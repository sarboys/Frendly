import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { StoriesService } from '../services/stories.service';

@Controller('events/:eventId/stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Get()
  listStories(
    @CurrentUser() currentUser: { userId: string },
    @Param('eventId') eventId: string,
  ) {
    return this.storiesService.listStories(currentUser.userId, eventId);
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
