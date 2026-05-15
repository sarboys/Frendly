import { Controller, Get, Query } from '@nestjs/common';
import { PlacesService } from '../services/places.service';

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get('search')
  searchPlaces(
    @Query('q') q?: string,
    @Query('city') city?: string,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
    @Query('limit') limit?: string,
  ) {
    return this.placesService.searchPlaces({
      q: q ?? '',
      city,
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('promos')
  listPlacePromos(
    @Query('city') city?: string,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
  ) {
    return this.placesService.listPlacePromos({
      city,
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
      limit: limit ? Number(limit) : undefined,
      category,
    });
  }
}
