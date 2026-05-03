import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { SearchService } from '../services/search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  groupedSearch(
    @CurrentUser() currentUser: { userId: string },
    @Query() query: Record<string, unknown>,
  ) {
    return this.searchService.groupedSearch(currentUser.userId, query);
  }
}
