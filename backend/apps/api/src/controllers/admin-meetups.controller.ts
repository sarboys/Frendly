import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Admin } from '../common/admin.decorator';
import { AdminMeetupsService } from '../services/admin-meetups.service';

@Admin()
@Controller('admin/meetups')
export class AdminMeetupsController {
  constructor(private readonly adminMeetupsService: AdminMeetupsService) {}

  @Get()
  listMeetups(@Query() query: Record<string, unknown>) {
    return this.adminMeetupsService.listMeetups(query);
  }

  @Post()
  createMeetup(@Body() body: Record<string, unknown>) {
    return this.adminMeetupsService.createMeetup(body);
  }

  @Get(':meetupId')
  getMeetup(@Param('meetupId') meetupId: string) {
    return this.adminMeetupsService.getMeetup(meetupId);
  }

  @Patch(':meetupId')
  updateMeetup(
    @Param('meetupId') meetupId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminMeetupsService.updateMeetup(meetupId, body);
  }

  @Post(':meetupId/cancel')
  cancelMeetup(
    @Param('meetupId') meetupId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminMeetupsService.cancelMeetup(meetupId, body);
  }

  @Post(':meetupId/restore')
  restoreMeetup(@Param('meetupId') meetupId: string) {
    return this.adminMeetupsService.restoreMeetup(meetupId);
  }

  @Get(':meetupId/participants')
  listParticipants(
    @Param('meetupId') meetupId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.adminMeetupsService.listParticipants(meetupId, query);
  }

  @Post(':meetupId/participants/:participantId/remove')
  removeParticipant(
    @Param('meetupId') meetupId: string,
    @Param('participantId') participantId: string,
  ) {
    return this.adminMeetupsService.removeParticipant(meetupId, participantId);
  }

  @Get(':meetupId/join-requests')
  listJoinRequests(
    @Param('meetupId') meetupId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.adminMeetupsService.listJoinRequests(meetupId, query);
  }

  @Post(':meetupId/join-requests/:requestId/approve')
  approveJoinRequest(
    @Param('meetupId') meetupId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.adminMeetupsService.reviewJoinRequest(meetupId, requestId, 'approved');
  }

  @Post(':meetupId/join-requests/:requestId/reject')
  rejectJoinRequest(
    @Param('meetupId') meetupId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.adminMeetupsService.reviewJoinRequest(meetupId, requestId, 'rejected');
  }
}
