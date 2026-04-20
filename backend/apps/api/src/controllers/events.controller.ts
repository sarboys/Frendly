import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { EventsService } from '../services/events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  listEvents(
    @CurrentUser() currentUser: { userId: string },
    @Query('filter') filter?: string,
    @Query('q') q?: string,
    @Query('lifestyle') lifestyle?: string,
    @Query('price') price?: string,
    @Query('gender') gender?: string,
    @Query('access') access?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.eventsService.listEvents(currentUser.userId, {
      filter,
      q,
      lifestyle,
      price,
      gender,
      access,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':eventId')
  getEvent(@CurrentUser() currentUser: { userId: string }, @Param('eventId') eventId: string) {
    return this.eventsService.getEventDetail(currentUser.userId, eventId);
  }

  @Post(':eventId/join')
  joinEvent(@CurrentUser() currentUser: { userId: string }, @Param('eventId') eventId: string) {
    return this.eventsService.joinEvent(currentUser.userId, eventId);
  }

  @Post(':eventId/join-request')
  createJoinRequest(
    @CurrentUser() currentUser: { userId: string },
    @Param('eventId') eventId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.eventsService.createJoinRequest(currentUser.userId, eventId, body);
  }

  @Delete(':eventId/join-request')
  cancelJoinRequest(
    @CurrentUser() currentUser: { userId: string },
    @Param('eventId') eventId: string,
  ) {
    return this.eventsService.cancelJoinRequest(currentUser.userId, eventId);
  }

  @Post()
  createEvent(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.eventsService.createEvent(currentUser.userId, body);
  }

  @Delete(':eventId/join')
  leaveEvent(@CurrentUser() currentUser: { userId: string }, @Param('eventId') eventId: string) {
    return this.eventsService.leaveEvent(currentUser.userId, eventId);
  }

  @Get(':eventId/check-in')
  getCheckIn(
    @CurrentUser() currentUser: { userId: string },
    @Param('eventId') eventId: string,
  ) {
    return this.eventsService.getCheckIn(currentUser.userId, eventId);
  }

  @Post(':eventId/check-in/confirm')
  confirmCheckIn(
    @CurrentUser() currentUser: { userId: string },
    @Param('eventId') eventId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.eventsService.confirmCheckIn(currentUser.userId, eventId, body);
  }

  @Get(':eventId/live')
  getLive(
    @CurrentUser() currentUser: { userId: string },
    @Param('eventId') eventId: string,
  ) {
    return this.eventsService.getLiveMeetup(currentUser.userId, eventId);
  }

  @Get(':eventId/after-party')
  getAfterParty(
    @CurrentUser() currentUser: { userId: string },
    @Param('eventId') eventId: string,
  ) {
    return this.eventsService.getAfterParty(currentUser.userId, eventId);
  }

  @Post(':eventId/feedback')
  saveFeedback(
    @CurrentUser() currentUser: { userId: string },
    @Param('eventId') eventId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.eventsService.saveFeedback(currentUser.userId, eventId, body);
  }
}
