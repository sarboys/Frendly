import { ContentVenueGeocoderService } from '../../src/content/content-venue-geocoder.service';
import {
  VenueGeocoderClient,
  VenueGeocoderHttpError,
} from '@big-break/database';

const originalApiKey = process.env.YANDEX_GEOCODER_API_KEY;
const originalContentApiKey = process.env.CONTENT_GEOCODER_API_KEY;
const originalTimeout = process.env.CONTENT_GEOCODER_TIMEOUT_MS;
const originalNominatimEnabled = process.env.NOMINATIM_GEOCODER_ENABLED;
const originalNominatimBaseUrl = process.env.NOMINATIM_BASE_URL;
const originalNominatimUserAgent = process.env.NOMINATIM_USER_AGENT;
const originalNominatimRateLimit = process.env.NOMINATIM_RATE_LIMIT_MS;

describe('ContentVenueGeocoderService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    VenueGeocoderClient.resetNominatimStateForTests();
    restoreEnv('YANDEX_GEOCODER_API_KEY', originalApiKey);
    restoreEnv('CONTENT_GEOCODER_API_KEY', originalContentApiKey);
    restoreEnv('CONTENT_GEOCODER_TIMEOUT_MS', originalTimeout);
    restoreEnv('NOMINATIM_GEOCODER_ENABLED', originalNominatimEnabled);
    restoreEnv('NOMINATIM_BASE_URL', originalNominatimBaseUrl);
    restoreEnv('NOMINATIM_USER_AGENT', originalNominatimUserAgent);
    restoreEnv('NOMINATIM_RATE_LIMIT_MS', originalNominatimRateLimit);
  });

  it('returns high confidence coordinates inside the city bbox', async () => {
    process.env.YANDEX_GEOCODER_API_KEY = 'test-key';
    process.env.CONTENT_GEOCODER_TIMEOUT_MS = '1000';
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(yandexPayload({
      pos: '37.6173 55.7558',
      text: 'Москва, Тверская улица, 1',
      precision: 'exact',
      kind: 'house',
    })) as any);

    const result = await new ContentVenueGeocoderService().geocode({
      city: 'Москва',
      venueName: null,
      address: 'Тверская улица, 1',
    });

    expect(result).toMatchObject({
      address: 'Москва, Тверская улица, 1',
      lat: 55.7558,
      lng: 37.6173,
      provider: 'yandex',
      precision: 'exact',
      kind: 'house',
    });
  });

  it('rejects venue-name geocode when the result is only a street', async () => {
    process.env.YANDEX_GEOCODER_API_KEY = 'test-key';
    process.env.CONTENT_GEOCODER_TIMEOUT_MS = '1000';
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(yandexPayload({
      pos: '37.6173 55.7558',
      text: 'Москва, Тверская улица',
      precision: 'exact',
      kind: 'street',
    })) as any);

    const result = await new ContentVenueGeocoderService().geocode({
      city: 'Москва',
      venueName: 'Клуб с похожим названием',
      address: null,
    });

    expect(result).toBeNull();
  });

  it('returns Nominatim venue coordinates and metadata', async () => {
    enableNominatim();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([
      nominatimPayload({
        name: 'Клуб Алексея Козлова',
        displayName: 'Клуб Алексея Козлова, Москва, Россия',
        lat: '55.7577583',
        lon: '37.6336463',
        category: 'amenity',
        type: 'nightclub',
        osmType: 'way',
        osmId: 12345,
        importance: 0.42,
      }),
    ]) as any);

    const result = await new ContentVenueGeocoderService().geocode({
      city: 'Москва',
      venueName: 'Клуб Алексея Козлова',
      address: null,
    });

    expect(result).toMatchObject({
      address: 'Клуб Алексея Козлова, Москва, Россия',
      lat: 55.7577583,
      lng: 37.6336463,
      provider: 'nominatim',
      query: 'Москва, Клуб Алексея Козлова',
      osmType: 'way',
      osmId: 12345,
      category: 'amenity',
      kind: 'nightclub',
      type: 'nightclub',
      importance: 0.42,
      displayName: 'Клуб Алексея Козлова, Москва, Россия',
    });
  });

  it.each([
    ['street', { category: 'highway', type: 'residential', addresstype: 'road' }],
    ['district', { category: 'boundary', type: 'administrative', addresstype: 'district' }],
    ['locality', { category: 'place', type: 'locality', addresstype: 'locality' }],
  ])('rejects Nominatim %s results', async (_label, rejected) => {
    enableNominatim();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([
      nominatimPayload({
        name: 'Клуб Алексея Козлова',
        displayName: 'Клуб Алексея Козлова, Москва, Россия',
        lat: '55.7577583',
        lon: '37.6336463',
        ...rejected,
      }),
    ]) as any);

    const result = await new ContentVenueGeocoderService().geocode({
      city: 'Москва',
      venueName: `Клуб Алексея Козлова ${_label}`,
      address: null,
    });

    expect(result).toBeNull();
  });

  it.each([
    ['theatre'],
    ['nightclub'],
    ['restaurant'],
  ])('accepts Nominatim amenity=%s results', async (type) => {
    enableNominatim();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([
      nominatimPayload({
        name: 'Jam Club',
        displayName: `Jam Club, Москва, Россия`,
        lat: '55.7684211',
        lon: '37.6316762',
        category: 'amenity',
        type,
      }),
    ]) as any);

    const result = await new ContentVenueGeocoderService().geocode({
      city: 'Москва',
      venueName: `Jam Club ${type}`,
      address: null,
    });

    expect(result).toEqual(expect.objectContaining({
      provider: 'nominatim',
      category: 'amenity',
      type,
    }));
  });

  it('caches repeated Nominatim city and venue queries', async () => {
    enableNominatim();
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([
      nominatimPayload({
        name: 'Jam Club',
        displayName: 'Jam Club, Москва, Россия',
        lat: '55.7684211',
        lon: '37.6316762',
        category: 'amenity',
        type: 'restaurant',
      }),
    ]) as any);
    const service = new ContentVenueGeocoderService();

    await service.geocode({ city: 'Москва', venueName: 'Jam Club', address: null });
    await service.geocode({ city: 'Москва', venueName: 'Jam Club', address: null });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not call public Nominatim faster than the configured rate limit', async () => {
    enableNominatim({ rateLimitMs: '1200' });
    jest.useFakeTimers();
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([
      nominatimPayload({
        name: 'Jam Club',
        displayName: 'Jam Club, Москва, Россия',
        lat: '55.7684211',
        lon: '37.6316762',
        category: 'amenity',
        type: 'restaurant',
      }),
    ]) as any);
    const service = new ContentVenueGeocoderService();

    await service.geocode({ city: 'Москва', venueName: 'Jam Club', address: null });
    const second = service.geocode({ city: 'Москва', venueName: 'Клуб Алексея Козлова', address: null });
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1199);
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    await second;

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([403, 429])('throws a limit error for Nominatim %s responses', async (statusCode) => {
    enableNominatim();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: statusCode,
      json: async () => ({}),
    } as unknown as Response);

    await expect(new ContentVenueGeocoderService().geocodeOrThrow({
      city: 'Москва',
      venueName: 'Jam Club',
      address: null,
    })).rejects.toEqual(new VenueGeocoderHttpError(statusCode));
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value == null) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload,
  } as unknown as Response;
}

function yandexPayload(input: {
  pos: string;
  text: string;
  precision: string;
  kind: string;
}) {
  return {
    response: {
      GeoObjectCollection: {
        featureMember: [
          {
            GeoObject: {
              Point: { pos: input.pos },
              metaDataProperty: {
                GeocoderMetaData: {
                  text: input.text,
                  precision: input.precision,
                  kind: input.kind,
                },
              },
            },
          },
        ],
      },
    },
  };
}

function enableNominatim(overrides: { rateLimitMs?: string } = {}) {
  delete process.env.YANDEX_GEOCODER_API_KEY;
  delete process.env.CONTENT_GEOCODER_API_KEY;
  process.env.NOMINATIM_GEOCODER_ENABLED = 'true';
  process.env.NOMINATIM_BASE_URL = 'https://nominatim.test/search';
  process.env.NOMINATIM_USER_AGENT = 'Frendly/1.0 test@example.com';
  process.env.NOMINATIM_RATE_LIMIT_MS = overrides.rateLimitMs ?? '0';
}

function nominatimPayload(input: {
  name: string;
  displayName: string;
  lat: string;
  lon: string;
  category: string;
  type: string;
  addresstype?: string;
  osmType?: string;
  osmId?: number;
  importance?: number;
}) {
  return {
    place_id: 1,
    osm_type: input.osmType ?? 'node',
    osm_id: input.osmId ?? 1,
    lat: input.lat,
    lon: input.lon,
    category: input.category,
    type: input.type,
    addresstype: input.addresstype ?? 'amenity',
    name: input.name,
    display_name: input.displayName,
    importance: input.importance ?? 0.5,
  };
}
