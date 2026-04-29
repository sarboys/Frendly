import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentPartner } from '../common/current-partner.decorator';
import { PartnerAuthGuard } from '../common/partner-auth.guard';
import { Public } from '../common/public.decorator';
import { PartnerPortalService } from '../services/partner-portal.service';

type CurrentPartnerDto = {
  partnerAccountId: string;
  partnerId: string | null;
};

@Public()
@UseGuards(PartnerAuthGuard)
@Controller('partner/portal')
export class PartnerPortalController {
  constructor(private readonly partnerPortalService: PartnerPortalService) {}

  @Get('meetups')
  listMeetups(@CurrentPartner() current: CurrentPartnerDto, @Query() query: Record<string, unknown>) {
    return this.partnerPortalService.listMeetups(current, this.queryWithNumberLimit(query));
  }

  @Post('meetups')
  createMeetup(@CurrentPartner() current: CurrentPartnerDto, @Body() body: Record<string, unknown>) {
    return this.partnerPortalService.createMeetup(current, body);
  }

  @Get('meetups/:meetupId')
  getMeetup(@CurrentPartner() current: CurrentPartnerDto, @Param('meetupId') meetupId: string) {
    return this.partnerPortalService.getMeetup(current, meetupId);
  }

  @Patch('meetups/:meetupId')
  updateMeetup(
    @CurrentPartner() current: CurrentPartnerDto,
    @Param('meetupId') meetupId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnerPortalService.updateMeetup(current, meetupId, body);
  }

  @Post('meetups/:meetupId/cancel')
  cancelMeetup(
    @CurrentPartner() current: CurrentPartnerDto,
    @Param('meetupId') meetupId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnerPortalService.cancelMeetup(current, meetupId, body);
  }

  @Get('meetups/:meetupId/participants')
  listMeetupParticipants(
    @CurrentPartner() current: CurrentPartnerDto,
    @Param('meetupId') meetupId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.partnerPortalService.listMeetupParticipants(
      current,
      meetupId,
      this.queryWithNumberLimit(query),
    );
  }

  @Get('meetups/:meetupId/join-requests')
  listMeetupJoinRequests(
    @CurrentPartner() current: CurrentPartnerDto,
    @Param('meetupId') meetupId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.partnerPortalService.listMeetupJoinRequests(
      current,
      meetupId,
      this.queryWithNumberLimit(query),
    );
  }

  @Post('meetups/:meetupId/join-requests/:requestId/approve')
  approveMeetupJoinRequest(
    @CurrentPartner() current: CurrentPartnerDto,
    @Param('meetupId') meetupId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.partnerPortalService.reviewMeetupJoinRequest(
      current,
      meetupId,
      requestId,
      'approved',
    );
  }

  @Post('meetups/:meetupId/join-requests/:requestId/reject')
  rejectMeetupJoinRequest(
    @CurrentPartner() current: CurrentPartnerDto,
    @Param('meetupId') meetupId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.partnerPortalService.reviewMeetupJoinRequest(
      current,
      meetupId,
      requestId,
      'rejected',
    );
  }

  @Get('communities')
  listCommunities(@CurrentPartner() current: CurrentPartnerDto, @Query() query: Record<string, unknown>) {
    return this.partnerPortalService.listCommunities(current, this.queryWithNumberLimit(query));
  }

  @Post('communities')
  createCommunity(@CurrentPartner() current: CurrentPartnerDto, @Body() body: Record<string, unknown>) {
    return this.partnerPortalService.createCommunity(current, body);
  }

  @Get('communities/:communityId')
  getCommunity(
    @CurrentPartner() current: CurrentPartnerDto,
    @Param('communityId') communityId: string,
  ) {
    return this.partnerPortalService.getCommunity(current, communityId);
  }

  @Patch('communities/:communityId')
  updateCommunity(
    @CurrentPartner() current: CurrentPartnerDto,
    @Param('communityId') communityId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnerPortalService.updateCommunity(current, communityId, body);
  }

  @Post('communities/:communityId/archive')
  archiveCommunity(
    @CurrentPartner() current: CurrentPartnerDto,
    @Param('communityId') communityId: string,
  ) {
    return this.partnerPortalService.archiveCommunity(current, communityId);
  }

  @Post('communities/:communityId/news')
  createCommunityNews(
    @CurrentPartner() current: CurrentPartnerDto,
    @Param('communityId') communityId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnerPortalService.createCommunityNews(current, communityId, body);
  }

  @Patch('communities/:communityId/news/:newsId')
  updateCommunityNews(
    @CurrentPartner() current: CurrentPartnerDto,
    @Param('communityId') communityId: string,
    @Param('newsId') newsId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnerPortalService.updateCommunityNews(current, communityId, newsId, body);
  }

  @Delete('communities/:communityId/news/:newsId')
  deleteCommunityNews(
    @CurrentPartner() current: CurrentPartnerDto,
    @Param('communityId') communityId: string,
    @Param('newsId') newsId: string,
  ) {
    return this.partnerPortalService.deleteCommunityNews(current, communityId, newsId);
  }

  @Post('communities/:communityId/media')
  createCommunityMedia(
    @CurrentPartner() current: CurrentPartnerDto,
    @Param('communityId') communityId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnerPortalService.createCommunityMedia(current, communityId, body);
  }

  @Patch('communities/:communityId/media/:mediaId')
  updateCommunityMedia(
    @CurrentPartner() current: CurrentPartnerDto,
    @Param('communityId') communityId: string,
    @Param('mediaId') mediaId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnerPortalService.updateCommunityMedia(current, communityId, mediaId, body);
  }

  @Delete('communities/:communityId/media/:mediaId')
  deleteCommunityMedia(
    @CurrentPartner() current: CurrentPartnerDto,
    @Param('communityId') communityId: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.partnerPortalService.deleteCommunityMedia(current, communityId, mediaId);
  }

  @Get('posters')
  listPosters(@CurrentPartner() current: CurrentPartnerDto, @Query() query: Record<string, unknown>) {
    return this.partnerPortalService.listPosters(current, this.queryWithNumberLimit(query));
  }

  @Post('posters')
  createPoster(@CurrentPartner() current: CurrentPartnerDto, @Body() body: Record<string, unknown>) {
    return this.partnerPortalService.createPoster(current, body);
  }

  @Get('posters/:posterId')
  getPoster(@CurrentPartner() current: CurrentPartnerDto, @Param('posterId') posterId: string) {
    return this.partnerPortalService.getPoster(current, posterId);
  }

  @Patch('posters/:posterId')
  updatePoster(
    @CurrentPartner() current: CurrentPartnerDto,
    @Param('posterId') posterId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnerPortalService.updatePoster(current, posterId, body);
  }

  @Post('posters/:posterId/submit')
  submitPoster(@CurrentPartner() current: CurrentPartnerDto, @Param('posterId') posterId: string) {
    return this.partnerPortalService.submitPoster(current, posterId);
  }

  @Post('posters/:posterId/archive')
  archivePoster(@CurrentPartner() current: CurrentPartnerDto, @Param('posterId') posterId: string) {
    return this.partnerPortalService.archivePoster(current, posterId);
  }

  @Get('featured-requests')
  listFeaturedRequests(
    @CurrentPartner() current: CurrentPartnerDto,
    @Query() query: Record<string, unknown>,
  ) {
    return this.partnerPortalService.listFeaturedRequests(current, this.queryWithNumberLimit(query));
  }

  @Post('featured-requests')
  createFeaturedRequest(
    @CurrentPartner() current: CurrentPartnerDto,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnerPortalService.createFeaturedRequest(current, body);
  }

  @Get('featured-requests/:requestId')
  getFeaturedRequest(
    @CurrentPartner() current: CurrentPartnerDto,
    @Param('requestId') requestId: string,
  ) {
    return this.partnerPortalService.getFeaturedRequest(current, requestId);
  }

  @Patch('featured-requests/:requestId')
  updateFeaturedRequest(
    @CurrentPartner() current: CurrentPartnerDto,
    @Param('requestId') requestId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnerPortalService.updateFeaturedRequest(current, requestId, body);
  }

  @Post('featured-requests/:requestId/submit')
  submitFeaturedRequest(
    @CurrentPartner() current: CurrentPartnerDto,
    @Param('requestId') requestId: string,
  ) {
    return this.partnerPortalService.submitFeaturedRequest(current, requestId);
  }

  @Post('featured-requests/:requestId/archive')
  archiveFeaturedRequest(
    @CurrentPartner() current: CurrentPartnerDto,
    @Param('requestId') requestId: string,
  ) {
    return this.partnerPortalService.archiveFeaturedRequest(current, requestId);
  }

  private queryWithNumberLimit(query: Record<string, unknown>) {
    return {
      ...query,
      limit: query.limit == null ? undefined : Number(query.limit),
    };
  }
}
