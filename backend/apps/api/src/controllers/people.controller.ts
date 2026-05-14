import { Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
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
    @Query('q') q?: string,
  ) {
    return this.peopleService.listPeople(currentUser.userId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
      q,
    });
  }

  @Get('following')
  listFollowing(
    @CurrentUser() currentUser: { userId: string },
    @Query('eventId') eventId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    return this.peopleService.listFollowing(currentUser.userId, {
      eventId,
      cursor,
      limit: limit ? Number(limit) : undefined,
      q,
    });
  }

  @Get(':userId')
  getPerson(
    @CurrentUser() currentUser: { userId: string },
    @Param('userId') userId: string,
  ) {
    return this.peopleService.getPersonProfile(currentUser.userId, userId);
  }

  @Get(':userId/social')
  getSocial(
    @CurrentUser() currentUser: { userId: string },
    @Param('userId') userId: string,
  ) {
    return this.peopleService.getProfileSocial(currentUser.userId, userId);
  }

  @Put(':userId/follow')
  follow(
    @CurrentUser() currentUser: { userId: string },
    @Param('userId') userId: string,
  ) {
    return this.peopleService.setFollow(currentUser.userId, userId, true);
  }

  @Delete(':userId/follow')
  unfollow(
    @CurrentUser() currentUser: { userId: string },
    @Param('userId') userId: string,
  ) {
    return this.peopleService.setFollow(currentUser.userId, userId, false);
  }

  @Put(':userId/reactions/:kind')
  setReaction(
    @CurrentUser() currentUser: { userId: string },
    @Param('userId') userId: string,
    @Param('kind') kind: string,
  ) {
    return this.peopleService.setProfileReaction(
      currentUser.userId,
      userId,
      this.peopleService.normalizeProfileReactionKind(kind),
      true,
    );
  }

  @Delete(':userId/reactions/:kind')
  removeReaction(
    @CurrentUser() currentUser: { userId: string },
    @Param('userId') userId: string,
    @Param('kind') kind: string,
  ) {
    return this.peopleService.setProfileReaction(
      currentUser.userId,
      userId,
      this.peopleService.normalizeProfileReactionKind(kind),
      false,
    );
  }

  @Post(':userId/direct-chat')
  createDirectChat(@CurrentUser() currentUser: { userId: string }, @Param('userId') userId: string) {
    return this.peopleService.createOrGetDirectChat(currentUser.userId, userId);
  }
}
