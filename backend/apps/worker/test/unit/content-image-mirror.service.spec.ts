import { ContentImageMirrorService } from '../../src/content/content-image-mirror.service';

const mockS3Send = jest.fn();
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

jest.mock('@big-break/database', () => ({
  buildPublicAssetUrl: (objectKey: string) =>
    `https://cdn.frendly.tech/${objectKey}`,
  createS3Client: () => ({
    send: mockS3Send,
  }),
  createS3RequestOptions: () => ({}),
  getS3Config: () => ({
    bucket: 'frendly-backet',
    cdnEndpoint: 'https://cdn.frendly.tech',
    publicEndpoint: 'https://s3.twcstorage.ru',
  }),
}));

describe('ContentImageMirrorService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockS3Send.mockReset();
    delete process.env.CONTENT_IMPORT_IMAGE_RETRY_DELAY_MS;
  });

  it('downloads the nested Ticketland image instead of the scaling URL', async () => {
    process.env.CONTENT_IMPORT_IMAGE_RETRY_DELAY_MS = '1';
    mockS3Send.mockRejectedValueOnce(new Error('missing')).mockResolvedValue({});
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('image-bytes', {
        status: 200,
        headers: {
          'content-type': 'image/jpeg',
          'content-length': '11',
        },
      }) as any,
    );
    const service = new ContentImageMirrorService();

    const result = await service.mirrorImageUrl({
      sourceCode: 'advcake_ticketland',
      sourceItemId: 'offer-1',
      imageUrl:
        'https://api.live.mts.ru/web-api/v3/image-scaling/?ScalingFactor=4&Url=https%3A%2F%2Fmedia.ticketland.ru%2Fimage.jpg',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://media.ticketland.ru/image.jpg',
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: expect.stringContaining('image/'),
          'user-agent': expect.stringContaining('FrendlyContentImporter'),
        }),
      }),
    );
    expect(result).toMatch(
      /^https:\/\/cdn\.frendly\.tech\/external-content\/advcake_ticketland\/offer-1-/,
    );
  });

  it('retries transient image download failures', async () => {
    process.env.CONTENT_IMPORT_IMAGE_RETRY_DELAY_MS = '1';
    mockS3Send.mockRejectedValueOnce(new Error('missing')).mockResolvedValue({});
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce(
        new Response('image-bytes', {
          status: 200,
          headers: {
            'content-type': 'image/webp',
            'content-length': '11',
          },
        }) as any,
      );
    const service = new ContentImageMirrorService();

    const result = await service.mirrorImageUrl({
      sourceCode: 'kudago',
      sourceItemId: 'event-1',
      imageUrl: 'https://static.kudago.com/image.webp',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result).toMatch(
      /^https:\/\/cdn\.frendly\.tech\/external-content\/kudago\/event-1-/,
    );
  });

  it('returns rail, card and hero variants for imported event images', async () => {
    process.env.CONTENT_IMPORT_IMAGE_RETRY_DELAY_MS = '1';
    mockS3Send.mockRejectedValueOnce(new Error('missing')).mockResolvedValue({});
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(tinyPng, {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': `${tinyPng.byteLength}`,
        },
      }) as any,
    );
    const service = new ContentImageMirrorService();

    const result = await service.mirrorExternalImage({
      sourceCode: 'kudago',
      sourceItemId: 'event-variants',
      imageUrl: 'https://static.kudago.com/image.png',
    } as any);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.imageUrl).toMatch(
      /^https:\/\/cdn\.frendly\.tech\/external-content\/kudago\/event-variants-/,
    );
    expect(result.imageVariants).toMatchObject({
      rail: {
        url: expect.stringContaining('__rail.webp'),
        mimeType: 'image/webp',
        byteSize: expect.any(Number),
      },
      card: {
        url: expect.stringContaining('__card.webp'),
        mimeType: 'image/webp',
      },
      hero: {
        url: expect.stringContaining('__hero.webp'),
        mimeType: 'image/webp',
      },
    });
  });
});
