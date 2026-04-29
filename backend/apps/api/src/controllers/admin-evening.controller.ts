import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Admin } from '../common/admin.decorator';
import { AdminEveningRouteService } from '../services/admin-evening-route.service';
import { AdminVenueService } from '../services/admin-venue.service';

@Admin()
@Controller('admin/evening')
export class AdminEveningController {
  constructor(
    private readonly adminVenueService: AdminVenueService,
    private readonly adminRouteService: AdminEveningRouteService,
  ) {}

  @Get('route-templates')
  listRouteTemplates(@Query() query: Record<string, unknown>) {
    return this.adminRouteService.listTemplates(query);
  }

  @Post('route-templates')
  createRouteTemplate(@Body() body: Record<string, unknown>) {
    return this.adminRouteService.createTemplate(body);
  }

  @Get('route-templates/:templateId')
  getRouteTemplate(@Param('templateId') templateId: string) {
    return this.adminRouteService.getTemplate(templateId);
  }

  @Patch('route-templates/:templateId')
  updateRouteTemplate(
    @Param('templateId') templateId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminRouteService.updateTemplate(templateId, body);
  }

  @Post('route-templates/:templateId/publish')
  publishRouteTemplate(@Param('templateId') templateId: string) {
    return this.adminRouteService.publishTemplate(templateId);
  }

  @Post('route-templates/:templateId/archive')
  archiveRouteTemplate(@Param('templateId') templateId: string) {
    return this.adminRouteService.archiveTemplate(templateId);
  }

  @Post('route-templates/:templateId/revisions')
  createRouteRevision(
    @Param('templateId') templateId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminRouteService.createRevision(templateId, body);
  }

  @Get('partners')
  listPartners(@Query() query: Record<string, unknown>) {
    return this.adminVenueService.listPartners(query);
  }

  @Post('partners')
  createPartner(@Body() body: Record<string, unknown>) {
    return this.adminVenueService.createPartner(body);
  }

  @Patch('partners/:partnerId')
  updatePartner(
    @Param('partnerId') partnerId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminVenueService.updatePartner(partnerId, body);
  }

  @Get('venues')
  listVenues(@Query() query: Record<string, unknown>) {
    return this.adminVenueService.listVenues(query);
  }

  @Post('venues')
  createVenue(@Body() body: Record<string, unknown>) {
    return this.adminVenueService.createVenue(body);
  }

  @Patch('venues/:venueId')
  updateVenue(
    @Param('venueId') venueId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminVenueService.updateVenue(venueId, body);
  }

  @Get('offers')
  listOffers(@Query() query: Record<string, unknown>) {
    return this.adminVenueService.listOffers(query);
  }

  @Post('offers')
  createOffer(@Body() body: Record<string, unknown>) {
    return this.adminVenueService.createOffer(body);
  }

  @Patch('offers/:offerId')
  updateOffer(
    @Param('offerId') offerId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminVenueService.updateOffer(offerId, body);
  }
}
