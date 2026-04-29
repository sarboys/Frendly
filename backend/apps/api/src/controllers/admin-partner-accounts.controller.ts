import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Admin } from '../common/admin.decorator';
import { PartnerAuthService } from '../services/partner-auth.service';

@Admin()
@Controller('admin/partner-accounts')
export class AdminPartnerAccountsController {
  constructor(private readonly partnerAuthService: PartnerAuthService) {}

  @Get()
  listAccounts(@Query() query: Record<string, unknown>) {
    return this.partnerAuthService.listAccounts(query);
  }

  @Post(':accountId/approve')
  approveAccount(
    @Param('accountId') accountId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnerAuthService.approveAccount(accountId, body);
  }

  @Post(':accountId/reject')
  rejectAccount(
    @Param('accountId') accountId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnerAuthService.rejectAccount(accountId, body);
  }

  @Post(':accountId/suspend')
  suspendAccount(
    @Param('accountId') accountId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnerAuthService.suspendAccount(accountId, body);
  }
}
