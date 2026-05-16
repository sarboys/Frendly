import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { DatingService } from '../services/dating.service';

@Controller('dating')
export class DatingController {
  constructor(private readonly datingService: DatingService) {}

  @Get('discover')
  listDiscover(
    @CurrentUser() currentUser: { userId: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('ageMin') ageMin?: string,
    @Query('ageMax') ageMax?: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('interests') interests?: string | string[],
  ) {
    return this.datingService.listDiscover(currentUser.userId, {
      cursor,
      limit: parseOptionalNumber(limit),
      ageMin: parseOptionalNumber(ageMin),
      ageMax: parseOptionalNumber(ageMax),
      radiusKm: parseOptionalNumber(radiusKm),
      interests: parseQueryList(interests),
    });
  }

  @Get('likes')
  listLikes(
    @CurrentUser() currentUser: { userId: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.datingService.listLikes(currentUser.userId, {
      cursor,
      limit: limit == null ? undefined : Number(limit),
    });
  }

  @Post('actions')
  recordAction(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.datingService.recordAction(currentUser.userId, body);
  }
}

function parseOptionalNumber(value?: string) {
  if (value == null || value.trim().length === 0) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseQueryList(value?: string | string[]) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return values
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
