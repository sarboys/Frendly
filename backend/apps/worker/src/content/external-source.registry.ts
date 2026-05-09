import { AdvCakeTicketlandAdapter } from './advcake-ticketland.adapter';
import { Injectable } from '@nestjs/common';
import { KudaGoAdapter } from './kudago.adapter';
import { OverpassAdapter } from './overpass.adapter';
import { TimepadAdapter } from './timepad.adapter';
import { TomestoAdapter } from './tomesto.adapter';
import type {
  ExternalSourceAdapter,
  ExternalSourceCode,
  ExternalSourceInfo,
} from './content-source.types';

const SOURCE_INFO: Record<ExternalSourceCode, ExternalSourceInfo> = {
  kudago: {
    code: 'kudago',
    name: 'KudaGo',
    kind: 'events_places',
    baseUrl: process.env.KUDAGO_BASE_URL ?? 'https://kudago.com/public-api/v1.4',
  },
  timepad: {
    code: 'timepad',
    name: 'Timepad',
    kind: 'events',
    baseUrl: process.env.TIMEPAD_BASE_URL ?? 'https://api.timepad.ru/v1',
  },
  overpass: {
    code: 'overpass',
    name: 'OSM Overpass',
    kind: 'places',
    baseUrl: process.env.OVERPASS_BASE_URL ?? 'https://overpass-api.de/api/interpreter',
  },
  advcake_ticketland: {
    code: 'advcake_ticketland',
    name: 'AdvCake Ticketland / MTS Live',
    kind: 'affiliate_events',
    baseUrl: process.env.ADVCAKE_BASE_URL ?? 'https://api.advcake.com',
    config: {
      offerId: process.env.ADVCAKE_TICKETLAND_OFFER_ID ?? '663',
      websites: process.env.ADVCAKE_TICKETLAND_WEBSITES ?? 'ticketland.ru,live.mts.ru',
      feedFormat: process.env.ADVCAKE_FEED_FORMAT ?? 'yml',
    },
  },
  // Tomesto stays opt-in because the catalog import needs a legal or partner rollout.
  // It is Moscow-only and is intentionally absent from default CONTENT_IMPORT_SOURCES.
  tomesto: {
    code: 'tomesto',
    name: 'ТоМесто',
    kind: 'affiliate_places_events_promos',
    baseUrl: process.env.TOMESTO_BASE_URL ?? 'https://tomesto.ru',
    config: {
      moscowOnly: true,
      defaultEnabled: false,
      importImages: process.env.TOMESTO_IMPORT_IMAGES === 'true',
      publicEventsEnabled: process.env.TOMESTO_PUBLIC_EVENTS_ENABLED === 'true',
      requestDelayMs: process.env.TOMESTO_REQUEST_DELAY_MS ?? '1000',
      maxPages: process.env.TOMESTO_MAX_PAGES ?? '200',
      windowDays: process.env.TOMESTO_WINDOW_DAYS ?? '30',
    },
  },
};

@Injectable()
export class ExternalSourceRegistry {
  private readonly adapters: Record<ExternalSourceCode, ExternalSourceAdapter>;

  constructor() {
    this.adapters = {
      kudago: new KudaGoAdapter(),
      timepad: new TimepadAdapter(),
      overpass: new OverpassAdapter(),
      advcake_ticketland: new AdvCakeTicketlandAdapter(),
      tomesto: new TomestoAdapter(),
    };
  }

  getInfo(code: ExternalSourceCode) {
    return SOURCE_INFO[code];
  }

  getAdapter(code: ExternalSourceCode) {
    return this.adapters[code];
  }

  getAdapters(codes?: ExternalSourceCode[]) {
    const enabled = codes ?? (Object.keys(this.adapters) as ExternalSourceCode[]);
    return enabled.map((code) => this.adapters[code]).filter(Boolean);
  }

  getSources() {
    return Object.values(SOURCE_INFO);
  }
}
