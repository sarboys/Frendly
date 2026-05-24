import { Injectable } from '@nestjs/common';
import {
  VenueGeocoderClient,
  type VenueGeocodeInput,
  type VenueGeocodeResult,
} from '@big-break/database';

export type { VenueGeocodeInput, VenueGeocodeResult };

@Injectable()
export class VenueGeocoderService {
  private readonly client = new VenueGeocoderClient();

  geocode(input: VenueGeocodeInput): Promise<VenueGeocodeResult | null> {
    return this.client.geocode(input);
  }
}
