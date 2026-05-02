import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { OnboardingService } from '../services/onboarding.service';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('me')
  getOnboarding(
    @CurrentUser() currentUser: { userId: string; sessionId?: string },
  ) {
    return this.onboardingService.getOnboarding(
      currentUser.userId,
      currentUser.sessionId,
    );
  }

  @Put('me')
  updateOnboarding(
    @CurrentUser() currentUser: { userId: string; sessionId?: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.onboardingService.updateOnboarding(
      currentUser.userId,
      currentUser.sessionId,
      body,
    );
  }

  @Post('contact/check')
  checkContact(
    @CurrentUser() currentUser: { userId: string; sessionId?: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.onboardingService.checkContactAvailability(
      currentUser.userId,
      currentUser.sessionId,
      body,
    );
  }
}
