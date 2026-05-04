import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { AfficheService } from '../services/affiche.service';

@Public()
@Controller('affiche')
export class AfficheController {
  constructor(private readonly afficheService: AfficheService) {}

  @Get('events')
  listEvents(@Query() query: Record<string, unknown>) {
    return this.afficheService.listEvents(query);
  }

  @Get('events/:eventId')
  getEvent(@Param('eventId') eventId: string) {
    return this.afficheService.getEvent(eventId);
  }
}
