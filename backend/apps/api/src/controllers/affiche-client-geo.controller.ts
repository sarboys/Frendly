import { Body, Controller, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AfficheService } from '../services/affiche.service';

@Controller('affiche')
export class AfficheClientGeoController {
  constructor(private readonly afficheService: AfficheService) {}

  @Post('events/:eventId/client-geo')
  saveClientGeo(
    @CurrentUser() currentUser: { userId: string; sessionId?: string },
    @Param('eventId') eventId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.afficheService.saveClientGeo(
      eventId,
      currentUser.userId,
      currentUser.sessionId,
      body,
    );
  }
}
