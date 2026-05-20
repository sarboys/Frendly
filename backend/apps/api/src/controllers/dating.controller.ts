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
    @Query('gender') gender?: string,
    @Query('interests') interests?: string | string[],
    @Query('verifiedOnly') verifiedOnly?: string,
    @Query('onlineOnly') onlineOnly?: string,
    @Query('newThisWeekOnly') newThisWeekOnly?: string,
  ) {
    return this.datingService.listDiscover(currentUser.userId, {
      cursor,
      limit: parseOptionalNumber(limit),
      ageMin: parseOptionalNumber(ageMin),
      ageMax: parseOptionalNumber(ageMax),
      radiusKm: parseOptionalNumber(radiusKm),
      gender: parseDatingGender(gender),
      interests: parseQueryList(interests),
      verifiedOnly: parseOptionalBoolean(verifiedOnly),
      onlineOnly: parseOptionalBoolean(onlineOnly),
      newThisWeekOnly: parseOptionalBoolean(newThisWeekOnly),
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

  @Get('limits')
  getLimits(@CurrentUser() currentUser: { userId: string }) {
    return this.datingService.getLimits(currentUser.userId);
  }

  @Post('actions')
  recordAction(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.datingService.recordAction(currentUser.userId, body);
  }

  @Post('rewind')
  rewind(@CurrentUser() currentUser: { userId: string }) {
    return this.datingService.rewindLastPass(currentUser.userId);
  }
}

function parseOptionalNumber(value?: string) {
  if (value == null || value.trim().length === 0) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalBoolean(value?: string) {
  if (value == null || value.trim().length === 0) {
    return undefined;
  }
  return value === 'true' || value === '1';
}

function parseDatingGender(value?: string) {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'male' || normalized === 'female'
    ? normalized
    : undefined;
}

function parseQueryList(value?: string | string[]) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return values
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
