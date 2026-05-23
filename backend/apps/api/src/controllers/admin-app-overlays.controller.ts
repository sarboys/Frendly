import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Admin } from '../common/admin.decorator';
import { AppOverlayService } from '../services/app-overlay.service';

@Admin()
@Controller('admin/app-overlays')
export class AdminAppOverlaysController {
  constructor(private readonly appOverlayService: AppOverlayService) {}

  @Get('campaigns')
  listCampaigns(@Query() query: Record<string, unknown>) {
    return this.appOverlayService.listCampaigns(query);
  }

  @Post('campaigns')
  createCampaign(@Body() body: Record<string, unknown>) {
    return this.appOverlayService.createCampaign(body);
  }

  @Patch('campaigns/:campaignId')
  updateCampaign(
    @Param('campaignId') campaignId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.appOverlayService.updateCampaign(campaignId, body);
  }

  @Post('campaigns/:campaignId/activate')
  activateCampaign(@Param('campaignId') campaignId: string) {
    return this.appOverlayService.setCampaignStatus(campaignId, 'active');
  }

  @Post('campaigns/:campaignId/pause')
  pauseCampaign(@Param('campaignId') campaignId: string) {
    return this.appOverlayService.setCampaignStatus(campaignId, 'paused');
  }

  @Post('campaigns/:campaignId/archive')
  archiveCampaign(@Param('campaignId') campaignId: string) {
    return this.appOverlayService.setCampaignStatus(campaignId, 'archived');
  }

  @Get('version-policies')
  listVersionPolicies() {
    return this.appOverlayService.listVersionPolicies();
  }

  @Patch('version-policies/:platform')
  updateVersionPolicy(
    @Param('platform') platform: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.appOverlayService.upsertVersionPolicy(platform, body);
  }
}
