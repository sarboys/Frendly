import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { DropsService } from '../services/drops.service';

@Controller('drops')
export class DropsController {
  constructor(private readonly dropsService: DropsService) {}

  @Get('home')
  getHome(@CurrentUser() currentUser: { userId: string }) {
    return this.dropsService.getHome(currentUser.userId);
  }

  @Get('tasks')
  getTasks(@CurrentUser() currentUser: { userId: string }) {
    return this.dropsService.getTasks(currentUser.userId);
  }

  @Get('tickets/history')
  getTicketHistory(
    @CurrentUser() currentUser: { userId: string },
    @Query('month') month?: string,
  ) {
    return this.dropsService.listHistory(currentUser.userId, { month });
  }

  @Post('tasks/verification/claim')
  claimVerification(@CurrentUser() currentUser: { userId: string }) {
    return this.dropsService.claimVerification(currentUser.userId);
  }

  @Post('tasks/daily-login/claim')
  claimDailyLogin(@CurrentUser() currentUser: { userId: string }) {
    return this.dropsService.claimDailyLogin(currentUser.userId);
  }

  @Post('referral-link/create')
  createReferralLink(@CurrentUser() currentUser: { userId: string }) {
    return this.dropsService.createReferralLink(currentUser.userId);
  }

  @Get(':dropId')
  getDrop(
    @CurrentUser() currentUser: { userId: string },
    @Param('dropId') dropId: string,
  ) {
    return this.dropsService.getDrop(currentUser.userId, dropId);
  }

  @Post(':dropId/tickets/apply')
  applyTickets(
    @CurrentUser() currentUser: { userId: string },
    @Param('dropId') dropId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.dropsService.applyTickets(
      currentUser.userId,
      dropId,
      Number(body.ticketCount),
    );
  }
}
