import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { VerificationService } from '../services/verification.service';

@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get('me')
  getVerification(@CurrentUser() currentUser: { userId: string }) {
    return this.verificationService.getVerification(currentUser.userId);
  }

  @Post('submit')
  submitVerification(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.verificationService.submitVerification(currentUser.userId, body);
  }
}
