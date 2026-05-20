import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Admin } from '../common/admin.decorator';
import { DropsService } from '../services/drops.service';

@Admin()
@Controller('admin/drops')
export class AdminDropsController {
  constructor(private readonly dropsService: DropsService) {}

  @Get()
  listDrops() {
    return this.dropsService.listAdminDrops();
  }

  @Post()
  createDrop(@Body() body: Record<string, unknown>) {
    return this.dropsService.createDrop(body);
  }

  @Patch(':dropId')
  updateDrop(
    @Param('dropId') dropId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.dropsService.updateDrop(dropId, body);
  }

  @Post(':dropId/activate')
  activateDrop(@Param('dropId') dropId: string) {
    return this.dropsService.activateDrop(dropId);
  }

  @Post(':dropId/cancel')
  cancelDrop(
    @Param('dropId') dropId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.dropsService.cancelDrop(
      dropId,
      typeof body.reason === 'string' ? body.reason : null,
    );
  }

  @Post(':dropId/draw')
  runDraw(
    @Param('dropId') dropId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.dropsService.runDraw(dropId, body);
  }

  @Get('reward-events/list')
  listRewards(@Query('userId') userId?: string) {
    return this.dropsService.listRewardEvents(userId);
  }

  @Get('users/:userId/tickets')
  listUserTickets(@Param('userId') userId: string) {
    return this.dropsService.listUserTickets(userId);
  }

  @Get(':dropId/participants')
  listParticipants(@Param('dropId') dropId: string) {
    return this.dropsService.listDropParticipants(dropId);
  }

  @Get(':dropId/tickets')
  listTickets(@Param('dropId') dropId: string) {
    return this.dropsService.listDropTickets(dropId);
  }

  @Post('users/:userId/manual-grant')
  manualGrant(
    @Param('userId') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.dropsService.manualGrant(userId, body);
  }

  @Post('tickets/:ticketId/cancel')
  cancelTicket(
    @Param('ticketId') ticketId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.dropsService.cancelTicket(ticketId, body);
  }

  @Post('users/:userId/freeze')
  freezeUser(
    @Param('userId') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.dropsService.freezeUser(userId, body);
  }

  @Post('users/:userId/unfreeze')
  unfreezeUser(@Param('userId') userId: string) {
    return this.dropsService.unfreezeUser(userId);
  }

  @Post('winners/:winnerId/choose-reserve')
  chooseReserveWinner(
    @Param('winnerId') winnerId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.dropsService.chooseReserveWinner(winnerId, body);
  }

  @Post('winners/:winnerId/:action')
  updateWinner(
    @Param('winnerId') winnerId: string,
    @Param('action') action: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.dropsService.updateWinner(winnerId, action, body);
  }
}
