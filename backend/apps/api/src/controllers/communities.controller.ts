import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
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
    @Query('q') q?: string,
    @Query('topics') topics?: string,
    @Query('privacy') privacy?: string,
    @Query('sort') sort?: string,
  ) {
    return this.communitiesService.listCommunities(currentUser.userId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
      q,
      topics,
      privacy,
      sort,
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

  @Post(':communityId/join')
  joinCommunity(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.communitiesService.joinCommunity(
      currentUser.userId,
      communityId,
    );
  }

  @Post(':communityId/join-request')
  createJoinRequest(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.communitiesService.createJoinRequest(
      currentUser.userId,
      communityId,
      body,
    );
  }

  @Delete(':communityId/join-request')
  cancelJoinRequest(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.communitiesService.cancelJoinRequest(
      currentUser.userId,
      communityId,
    );
  }

  @Get(':communityId/admin/overview')
  adminOverview(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.communitiesService.listAdminOverview(
      currentUser.userId,
      communityId,
    );
  }

  @Get(':communityId/admin/members')
  adminMembers(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.communitiesService.listAdminMembers(
      currentUser.userId,
      communityId,
    );
  }

  @Patch(':communityId/admin/members/:memberId/role')
  adminMemberRole(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
    @Param('memberId') memberId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.communitiesService.updateAdminMemberRole(
      currentUser.userId,
      communityId,
      memberId,
      body,
    );
  }

  @Delete(':communityId/admin/members/:memberId')
  adminRemoveMember(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.communitiesService.removeAdminMember(
      currentUser.userId,
      communityId,
      memberId,
    );
  }

  @Get(':communityId/admin/join-requests')
  adminJoinRequests(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.communitiesService.listJoinRequests(
      currentUser.userId,
      communityId,
    );
  }

  @Post(':communityId/admin/join-requests/:requestId/approve')
  adminApproveJoinRequest(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.communitiesService.reviewJoinRequest(
      currentUser.userId,
      communityId,
      requestId,
      'approved',
    );
  }

  @Post(':communityId/admin/join-requests/:requestId/reject')
  adminRejectJoinRequest(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.communitiesService.reviewJoinRequest(
      currentUser.userId,
      communityId,
      requestId,
      'rejected',
    );
  }

  @Get(':communityId/admin/news')
  adminNews(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.communitiesService.listAdminNews(
      currentUser.userId,
      communityId,
    );
  }

  @Post(':communityId/admin/news')
  adminCreateNews(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.communitiesService.createAdminNews(
      currentUser.userId,
      communityId,
      body,
    );
  }

  @Patch(':communityId/admin/news/:newsId')
  adminUpdateNews(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
    @Param('newsId') newsId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.communitiesService.updateAdminNews(
      currentUser.userId,
      communityId,
      newsId,
      body,
    );
  }

  @Delete(':communityId/admin/news/:newsId')
  adminDeleteNews(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
    @Param('newsId') newsId: string,
  ) {
    return this.communitiesService.deleteAdminNews(
      currentUser.userId,
      communityId,
      newsId,
    );
  }

  @Get(':communityId/admin/meetups')
  adminMeetups(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.communitiesService.listAdminMeetups(
      currentUser.userId,
      communityId,
    );
  }

  @Delete(':communityId/admin/meetups/:eventId')
  adminCancelMeetup(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.communitiesService.cancelAdminMeetup(
      currentUser.userId,
      communityId,
      eventId,
    );
  }

  @Patch(':communityId/admin/settings')
  adminSettings(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.communitiesService.updateAdminSettings(
      currentUser.userId,
      communityId,
      body,
    );
  }

  @Post(':communityId/admin/archive')
  adminArchive(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.communitiesService.archiveAdminCommunity(
      currentUser.userId,
      communityId,
    );
  }

  @Post(':communityId/admin/transfer-owner')
  adminTransferOwner(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.communitiesService.transferAdminOwnership(
      currentUser.userId,
      communityId,
      body,
    );
  }

  @Delete(':communityId/join')
  leaveCommunity(
    @CurrentUser() currentUser: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.communitiesService.leaveCommunity(
      currentUser.userId,
      communityId,
    );
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
