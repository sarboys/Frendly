import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { SafetyService } from '../services/safety.service';

@Controller()
export class SafetyController {
  constructor(private readonly safetyService: SafetyService) {}

  @Get('safety/me')
  getSafety(@CurrentUser() currentUser: { userId: string }) {
    return this.safetyService.getSafety(currentUser.userId);
  }

  @Put('safety/me')
  updateSafety(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.safetyService.updateSafety(currentUser.userId, body);
  }

  @Get('safety/trusted-contacts')
  listTrustedContacts(@CurrentUser() currentUser: { userId: string }) {
    return this.safetyService.listTrustedContacts(currentUser.userId);
  }

  @Post('safety/trusted-contacts')
  createTrustedContact(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.safetyService.createTrustedContact(currentUser.userId, body);
  }

  @Get('reports/me')
  listReports(@CurrentUser() currentUser: { userId: string }) {
    return this.safetyService.listReports(currentUser.userId);
  }

  @Post('reports')
  createReport(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.safetyService.createReport(currentUser.userId, body);
  }

  @Get('blocks')
  listBlocks(@CurrentUser() currentUser: { userId: string }) {
    return this.safetyService.listBlocks(currentUser.userId);
  }

  @Post('blocks')
  createBlock(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.safetyService.createBlock(currentUser.userId, body);
  }

  @Post('safety/sos')
  createSos(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.safetyService.createSos(currentUser.userId, body);
  }
}
