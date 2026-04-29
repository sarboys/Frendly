import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Admin } from '../common/admin.decorator';
import { AdminVenueService } from '../services/admin-venue.service';

@Admin()
@Controller('admin/evening')
export class AdminEveningController {
  constructor(private readonly adminVenueService: AdminVenueService) {}

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
