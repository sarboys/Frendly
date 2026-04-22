import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { MatchesService } from '../services/matches.service';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  listMatches(
    @CurrentUser() currentUser: { userId: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.matchesService.listMatches(currentUser.userId, {
      cursor,
      limit: limit == null ? undefined : Number(limit),
    });
  }
}
