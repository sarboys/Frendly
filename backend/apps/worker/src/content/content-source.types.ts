export type ExternalSourceCode = 'kudago' | 'timepad' | 'overpass' | 'advcake_ticketland' | 'tomesto';

export type ExternalPriceMode = 'free' | 'paid' | 'unknown';

export type ExternalRawItem = {
  sourceCode: ExternalSourceCode;
  sourceItemId: string;
  sourceUrl?: string | null;
  contentKind: 'place' | 'event';
  city: string;
  timezone: string;
  title: string;
  description?: string | null;
  category?: string | null;
  tags?: string[];
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  priceFrom?: number | null;
  currency?: string | null;
  venueName?: string | null;
  imageUrl?: string | null;
  actionUrl?: string | null;
  actionKind?: string | null;
  priceMode?: ExternalPriceMode | null;
  isAffiliate?: boolean | null;
  sourceProvider?: string | null;
  placeKind?: string | null;
  lastSeenAt?: Date | null;
  raw: unknown;
};

export type NormalizedExternalContentItem = {
  sourceCode: ExternalSourceCode;
  sourceItemId: string;
  sourceUrl: string | null;
  contentKind: 'place' | 'event';
  city: string;
  timezone: string;
  area: string | null;
  title: string;
  shortSummary: string | null;
  category: string;
  tags: string[];
  address: string | null;
  lat: number | null;
  lng: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  priceFrom: number | null;
  currency: string | null;
  venueName: string | null;
  imageUrl: string | null;
  actionUrl: string | null;
  actionKind: string | null;
  priceMode: ExternalPriceMode;
  isAffiliate: boolean;
  sourceProvider: string | null;
  placeKind: string | null;
  lastSeenAt: Date | null;
  raw: unknown;
  normalizedHash: string;
  expiresAt: Date | null;
};

export type ExternalSourceFetchInput = {
  city: string;
  cityCode: string;
  from: Date;
  to: Date;
  signal: AbortSignal;
};

export interface ExternalSourceAdapter {
  code: ExternalSourceCode;
  fetchItems(input: ExternalSourceFetchInput): Promise<ExternalRawItem[]>;
  fetchBatches?(input: ExternalSourceFetchInput): AsyncIterable<ExternalRawItem[]>;
}

export type ExternalSourceInfo = {
  code: ExternalSourceCode;
  name: string;
  kind: string;
  baseUrl: string;
  config?: Record<string, string | number | boolean | null>;
};
