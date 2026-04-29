import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { EveningRouteTemplateService } from '../services/evening-route-template.service';
import { EveningService } from '../services/evening.service';
import { PartnerOfferCodeService } from '../services/partner-offer-code.service';

@Controller('evening')
export class EveningController {
  constructor(
    private readonly eveningService: EveningService,
    private readonly routeTemplateService: EveningRouteTemplateService,
    private readonly partnerOfferCodeService: PartnerOfferCodeService,
  ) {}

  @Get('options')
  getOptions() {
    return this.eveningService.getOptions();
  }

  @Get('route-templates')
  listRouteTemplates(
    @CurrentUser() currentUser: { userId: string },
    @Query() query: Record<string, unknown>,
  ) {
    return this.routeTemplateService.listRouteTemplates(
      query,
      currentUser.userId,
    );
  }

  @Get('route-templates/:templateId')
  getRouteTemplate(
    @CurrentUser() currentUser: { userId: string },
    @Param('templateId') templateId: string,
  ) {
    return this.routeTemplateService.getRouteTemplate(
      currentUser.userId,
      templateId,
    );
  }

  @Get('route-templates/:templateId/sessions')
  listRouteTemplateSessions(
    @Param('templateId') templateId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.routeTemplateService.listTemplateSessions(templateId, query);
  }

  @Post('route-templates/:templateId/sessions')
  createRouteTemplateSession(
    @CurrentUser() currentUser: { userId: string },
    @Param('templateId') templateId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.routeTemplateService.createSessionFromTemplate(
      currentUser.userId,
      templateId,
      body,
    );
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

  @Get('sessions')
  listSessions(
    @CurrentUser() currentUser: { userId: string },
    @Query() query: Record<string, unknown>,
  ) {
    return this.eveningService.listSessions(currentUser.userId, query);
  }

  @Get('sessions/:sessionId')
  getSession(
    @CurrentUser() currentUser: { userId: string },
    @Param('sessionId') sessionId: string,
  ) {
    return this.eveningService.getSession(currentUser.userId, sessionId);
  }

  @Post('sessions/:sessionId/start')
  startSession(
    @CurrentUser() currentUser: { userId: string },
    @Param('sessionId') sessionId: string,
  ) {
    return this.eveningService.startSession(currentUser.userId, sessionId);
  }

  @Post('sessions/:sessionId/join')
  joinSession(
    @CurrentUser() currentUser: { userId: string },
    @Param('sessionId') sessionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.eveningService.joinSession(currentUser.userId, sessionId, body);
  }

  @Post('sessions/:sessionId/join-request')
  requestJoinSession(
    @CurrentUser() currentUser: { userId: string },
    @Param('sessionId') sessionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.eveningService.joinSession(currentUser.userId, sessionId, {
      ...body,
      privacyAction: 'request',
    });
  }

  @Post('sessions/:sessionId/join-requests/:requestId/approve')
  approveJoinRequest(
    @CurrentUser() currentUser: { userId: string },
    @Param('sessionId') sessionId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.eveningService.approveJoinRequest(
      currentUser.userId,
      sessionId,
      requestId,
    );
  }

  @Post('sessions/:sessionId/join-requests/:requestId/reject')
  rejectJoinRequest(
    @CurrentUser() currentUser: { userId: string },
    @Param('sessionId') sessionId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.eveningService.rejectJoinRequest(
      currentUser.userId,
      sessionId,
      requestId,
    );
  }

  @Post('sessions/:sessionId/steps/:stepId/check-in')
  checkInStep(
    @CurrentUser() currentUser: { userId: string },
    @Param('sessionId') sessionId: string,
    @Param('stepId') stepId: string,
  ) {
    return this.eveningService.checkInStep(
      currentUser.userId,
      sessionId,
      stepId,
    );
  }

  @Post('sessions/:sessionId/steps/:stepId/offers/:offerId/code')
  issuePartnerOfferCode(
    @CurrentUser() currentUser: { userId: string },
    @Param('sessionId') sessionId: string,
    @Param('stepId') stepId: string,
    @Param('offerId') offerId: string,
  ) {
    return this.partnerOfferCodeService.issueCode(
      currentUser.userId,
      sessionId,
      stepId,
      offerId,
    );
  }

  @Get('offer-codes/:codeId')
  getPartnerOfferCode(
    @CurrentUser() currentUser: { userId: string },
    @Param('codeId') codeId: string,
  ) {
    return this.partnerOfferCodeService.getCodeStatus(
      currentUser.userId,
      codeId,
    );
  }

  @Post('sessions/:sessionId/steps/:stepId/advance')
  advanceStep(
    @CurrentUser() currentUser: { userId: string },
    @Param('sessionId') sessionId: string,
    @Param('stepId') stepId: string,
  ) {
    return this.eveningService.advanceStep(
      currentUser.userId,
      sessionId,
      stepId,
    );
  }

  @Post('sessions/:sessionId/steps/:stepId/skip')
  skipStep(
    @CurrentUser() currentUser: { userId: string },
    @Param('sessionId') sessionId: string,
    @Param('stepId') stepId: string,
  ) {
    return this.eveningService.skipStep(
      currentUser.userId,
      sessionId,
      stepId,
    );
  }

  @Post('sessions/:sessionId/finish')
  finishSession(
    @CurrentUser() currentUser: { userId: string },
    @Param('sessionId') sessionId: string,
  ) {
    return this.eveningService.finishSession(currentUser.userId, sessionId);
  }

  @Get('sessions/:sessionId/after-party')
  getAfterParty(
    @CurrentUser() currentUser: { userId: string },
    @Param('sessionId') sessionId: string,
  ) {
    return this.eveningService.getAfterParty(currentUser.userId, sessionId);
  }

  @Post('sessions/:sessionId/after-party/feedback')
  saveAfterPartyFeedback(
    @CurrentUser() currentUser: { userId: string },
    @Param('sessionId') sessionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.eveningService.saveAfterPartyFeedback(
      currentUser.userId,
      sessionId,
      body,
    );
  }

  @Post('sessions/:sessionId/after-party/photos')
  addAfterPartyPhoto(
    @CurrentUser() currentUser: { userId: string },
    @Param('sessionId') sessionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.eveningService.addAfterPartyPhoto(
      currentUser.userId,
      sessionId,
      body,
    );
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
