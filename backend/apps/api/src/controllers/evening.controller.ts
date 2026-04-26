import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { EveningService } from '../services/evening.service';

@Controller('evening')
export class EveningController {
  constructor(private readonly eveningService: EveningService) {}

  @Get('options')
  getOptions() {
    return this.eveningService.getOptions();
  }

  @Post('routes/resolve')
  resolveRoute(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.eveningService.resolveRoute(currentUser.userId, body);
  }

  @Get('routes/:routeId')
  getRoute(
    @CurrentUser() currentUser: { userId: string },
    @Param('routeId') routeId: string,
  ) {
    return this.eveningService.getRoute(currentUser.userId, routeId);
  }

  @Post('routes/:routeId/launch')
  launchRoute(
    @CurrentUser() currentUser: { userId: string },
    @Param('routeId') routeId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.eveningService.launchRoute(currentUser.userId, routeId, body);
  }

  @Post('routes/:routeId/finish')
  finishRoute(
    @CurrentUser() currentUser: { userId: string },
    @Param('routeId') routeId: string,
  ) {
    return this.eveningService.finishRoute(currentUser.userId, routeId);
  }

  @Post('routes/:routeId/steps/:stepId/perk/use')
  markPerkUsed(
    @CurrentUser() currentUser: { userId: string },
    @Param('routeId') routeId: string,
    @Param('stepId') stepId: string,
  ) {
    return this.eveningService.markPerkUsed(currentUser.userId, routeId, stepId);
  }

  @Post('routes/:routeId/steps/:stepId/ticket/buy')
  markTicketBought(
    @CurrentUser() currentUser: { userId: string },
    @Param('routeId') routeId: string,
    @Param('stepId') stepId: string,
  ) {
    return this.eveningService.markTicketBought(currentUser.userId, routeId, stepId);
  }

  @Post('routes/:routeId/steps/:stepId/share-chat')
  shareStepToChat(
    @CurrentUser() currentUser: { userId: string },
    @Param('routeId') routeId: string,
    @Param('stepId') stepId: string,
  ) {
    return this.eveningService.shareStepToChat(currentUser.userId, routeId, stepId);
  }
}
