import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { OnboardingService } from '../services/onboarding.service';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('me')
  getOnboarding(@CurrentUser() currentUser: { userId: string }) {
    return this.onboardingService.getOnboarding(currentUser.userId);
  }

  @Put('me')
  updateOnboarding(@CurrentUser() currentUser: { userId: string }, @Body() body: Record<string, unknown>) {
    return this.onboardingService.updateOnboarding(currentUser.userId, body);
  }
}
