import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { CommunitiesService } from '../services/communities.service';

@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Get()
  listCommunities(
    @CurrentUser() currentUser: { userId: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.communitiesService.listCommunities(currentUser.userId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':communityId/media')
  listCommunityMedia(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.communitiesService.listCommunityMedia(
      currentUser.userId,
      communityId,
      {
        cursor,
        limit: limit ? Number(limit) : undefined,
      },
    );
  }

  @Get(':communityId')
  getCommunity(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.communitiesService.getCommunity(currentUser.userId, communityId);
  }

  @Post(':communityId/news')
  createCommunityNews(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.communitiesService.createCommunityNews(
      currentUser.userId,
      communityId,
      body,
    );
  }

  @Post()
  createCommunity(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.communitiesService.createCommunity(
      currentUser.userId,
      body,
      idempotencyKey,
    );
  }
}
