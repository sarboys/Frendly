import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { MatchesService } from '../services/matches.service';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  listMatches(@CurrentUser() currentUser: { userId: string }) {
    return this.matchesService.listMatches(currentUser.userId);
  }
}
