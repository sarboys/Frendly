import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { HostService } from '../services/host.service';

@Controller('host')
export class HostController {
  constructor(private readonly hostService: HostService) {}

  @Get('dashboard')
  getDashboard(
    @CurrentUser() currentUser: { userId: string },
    @Query('eventsCursor') eventsCursor?: string,
    @Query('eventsLimit') eventsLimit?: string,
    @Query('requestsCursor') requestsCursor?: string,
    @Query('requestsLimit') requestsLimit?: string,
  ) {
    return this.hostService.getDashboard(currentUser.userId, {
      eventsCursor,
      eventsLimit: eventsLimit == null ? undefined : Number(eventsLimit),
      requestsCursor,
      requestsLimit: requestsLimit == null ? undefined : Number(requestsLimit),
    });
  }

  @Get('events/:eventId')
  getHostedEvent(
    @CurrentUser() currentUser: { userId: string },
    @Param('eventId') eventId: string,
  ) {
    return this.hostService.getHostedEvent(currentUser.userId, eventId);
  }

  @Post('requests/:requestId/approve')
  approveRequest(
    @CurrentUser() currentUser: { userId: string },
    @Param('requestId') requestId: string,
  ) {
    return this.hostService.approveRequest(currentUser.userId, requestId);
  }

  @Post('requests/:requestId/reject')
  rejectRequest(
    @CurrentUser() currentUser: { userId: string },
    @Param('requestId') requestId: string,
  ) {
    return this.hostService.rejectRequest(currentUser.userId, requestId);
  }

  @Post('events/:eventId/check-in')
  manualCheckIn(
    @CurrentUser() currentUser: { userId: string },
    @Param('eventId') eventId: string,
    @Body() body: { userId?: string },
  ) {
    return this.hostService.manualCheckIn(currentUser.userId, eventId, body.userId ?? '');
  }

  @Post('events/:eventId/live/start')
  startLive(
    @CurrentUser() currentUser: { userId: string },
    @Param('eventId') eventId: string,
  ) {
    return this.hostService.startLive(currentUser.userId, eventId);
  }

  @Post('events/:eventId/live/finish')
  finishLive(
    @CurrentUser() currentUser: { userId: string },
    @Param('eventId') eventId: string,
  ) {
    return this.hostService.finishLive(currentUser.userId, eventId);
  }
}
