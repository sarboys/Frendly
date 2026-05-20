import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Admin } from '../common/admin.decorator';
import { VerificationService } from '../services/verification.service';

@Admin()
@Controller('admin/verification')
export class AdminVerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get()
  listVerifications(@Query() query: Record<string, unknown>) {
    return this.verificationService.listAdminVerifications(query);
  }

  @Get(':userId')
  getVerification(@Param('userId') userId: string) {
    return this.verificationService.getAdminVerification(userId);
  }

  @Post(':userId/approve')
  approveVerification(@Param('userId') userId: string) {
    return this.verificationService.approveVerification(userId);
  }

  @Post(':userId/return')
  returnVerification(
    @Param('userId') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.verificationService.returnVerification(userId, body);
  }
}
