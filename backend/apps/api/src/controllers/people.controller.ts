import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { PeopleService } from '../services/people.service';

@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Get()
  listPeople(
    @CurrentUser() currentUser: { userId: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.peopleService.listPeople(currentUser.userId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':userId')
  getPerson(
    @CurrentUser() currentUser: { userId: string },
    @Param('userId') userId: string,
  ) {
    return this.peopleService.getPersonProfile(currentUser.userId, userId);
  }

  @Post(':userId/direct-chat')
  createDirectChat(@CurrentUser() currentUser: { userId: string }, @Param('userId') userId: string) {
    return this.peopleService.createOrGetDirectChat(currentUser.userId, userId);
  }
}
