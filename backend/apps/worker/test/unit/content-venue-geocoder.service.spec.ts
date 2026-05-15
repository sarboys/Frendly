import { ContentVenueGeocoderService } from '../../src/content/content-venue-geocoder.service';

const originalApiKey = process.env.YANDEX_GEOCODER_API_KEY;
const originalContentApiKey = process.env.CONTENT_GEOCODER_API_KEY;
const originalTimeout = process.env.CONTENT_GEOCODER_TIMEOUT_MS;

describe('ContentVenueGeocoderService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    restoreEnv('YANDEX_GEOCODER_API_KEY', originalApiKey);
    restoreEnv('CONTENT_GEOCODER_API_KEY', originalContentApiKey);
    restoreEnv('CONTENT_GEOCODER_TIMEOUT_MS', originalTimeout);
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
