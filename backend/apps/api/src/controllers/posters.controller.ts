import { Controller, Get, Param, Query } from '@nestjs/common';
import { PostersService } from '../services/posters.service';

@Controller('posters')
export class PostersController {
  constructor(private readonly postersService: PostersService) {}

  @Get()
  listPosters(
    @Query('city') city?: string,
    @Query('category') category?: string,
    @Query('q') q?: string,
    @Query('featured') featured?: string,
    @Query('date') date?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.postersService.listPosters({
      city,
      category,
      q,
      featured,
      date,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':posterId')
  getPoster(@Param('posterId') posterId: string) {
    return this.postersService.getPosterDetail(posterId);
  }
}
