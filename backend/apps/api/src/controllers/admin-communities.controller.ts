import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Admin } from '../common/admin.decorator';
import { AdminCommunitiesService } from '../services/admin-communities.service';

@Admin()
@Controller('admin/communities')
export class AdminCommunitiesController {
  constructor(private readonly adminCommunitiesService: AdminCommunitiesService) {}

  @Get()
  listCommunities(@Query() query: Record<string, unknown>) {
    return this.adminCommunitiesService.listCommunities(query);
  }

  @Post()
  createCommunity(@Body() body: Record<string, unknown>) {
    return this.adminCommunitiesService.createCommunity(body);
  }

  @Get(':communityId')
  getCommunity(@Param('communityId') communityId: string) {
    return this.adminCommunitiesService.getCommunity(communityId);
  }

  @Patch(':communityId')
  updateCommunity(
    @Param('communityId') communityId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminCommunitiesService.updateCommunity(communityId, body);
  }

  @Post(':communityId/archive')
  archiveCommunity(@Param('communityId') communityId: string) {
    return this.adminCommunitiesService.archiveCommunity(communityId);
  }

  @Post(':communityId/restore')
  restoreCommunity(@Param('communityId') communityId: string) {
    return this.adminCommunitiesService.restoreCommunity(communityId);
  }

  @Get(':communityId/members')
  listMembers(
    @Param('communityId') communityId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.adminCommunitiesService.listMembers(communityId, query);
  }

  @Post(':communityId/members/:memberId/remove')
  removeMember(
    @Param('communityId') communityId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.adminCommunitiesService.removeMember(communityId, memberId);
  }

  @Patch(':communityId/members/:memberId/role')
  updateMemberRole(
    @Param('communityId') communityId: string,
    @Param('memberId') memberId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminCommunitiesService.updateMemberRole(communityId, memberId, body);
  }

  @Get(':communityId/news')
  listNews(
    @Param('communityId') communityId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.adminCommunitiesService.listNews(communityId, query);
  }

  @Post(':communityId/news')
  createNews(
    @Param('communityId') communityId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminCommunitiesService.createNews(communityId, body);
  }

  @Patch(':communityId/news/:newsId')
  updateNews(
    @Param('communityId') communityId: string,
    @Param('newsId') newsId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminCommunitiesService.updateNews(communityId, newsId, body);
  }

  @Delete(':communityId/news/:newsId')
  deleteNews(
    @Param('communityId') communityId: string,
    @Param('newsId') newsId: string,
  ) {
    return this.adminCommunitiesService.deleteNews(communityId, newsId);
  }

  @Get(':communityId/media')
  listMedia(
    @Param('communityId') communityId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.adminCommunitiesService.listMedia(communityId, query);
  }

  @Post(':communityId/media')
  createMedia(
    @Param('communityId') communityId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminCommunitiesService.createMedia(communityId, body);
  }

  @Patch(':communityId/media/:mediaId')
  updateMedia(
    @Param('communityId') communityId: string,
    @Param('mediaId') mediaId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminCommunitiesService.updateMedia(communityId, mediaId, body);
  }

  @Delete(':communityId/media/:mediaId')
  deleteMedia(
    @Param('communityId') communityId: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.adminCommunitiesService.deleteMedia(communityId, mediaId);
  }
}
