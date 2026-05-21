const putObjectCalls: Array<{ Key: string; Body: Buffer; ContentType: string }> = [];

jest.mock('@big-break/database', () => ({
  buildPublicAssetUrl: jest.fn((key: string) => `/media/${key}`),
  createS3RequestOptions: jest.fn(() => ({})),
  getS3Config: jest.fn(() => ({ bucket: 'bucket' })),
}));

import sharp from 'sharp';
import {
  PROFILE_IMAGE_VARIANT_SPECS,
  createImageVariants,
} from '../../src/media/image-variants';

describe('image variants', () => {
  beforeEach(() => {
    putObjectCalls.length = 0;
  });

  it('creates profile variants with avatar crop and long-edge resized public images', async () => {
    const sourceBytes = await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: '#c55a11',
      },
    })
      .jpeg()
      .toBuffer();
    const s3 = {
      send: jest.fn(async (command: { input: { Key: string; Body: Buffer; ContentType: string } }) => {
        putObjectCalls.push(command.input);
        return {};
      }),
    };

    const variants = await createImageVariants({
      s3: s3 as any,
      sourceBytes,
      sourceObjectKey: 'avatars/user/photo.jpg',
      specs: PROFILE_IMAGE_VARIANT_SPECS,
    });

    expect(Object.keys(variants)).toEqual([
      'avatar',
      'thumb',
      'card',
      'hero',
      'fullscreen',
    ]);
    expect(variants.avatar).toEqual(
      expect.objectContaining({
        url: '/media/avatars/user/photo__avatar.webp',
        width: 320,
        height: 320,
        mimeType: 'image/webp',
      }),
    );
    expect(variants.thumb).toEqual(
      expect.objectContaining({ width: 480, height: 320 }),
    );
    expect(variants.card).toEqual(
      expect.objectContaining({ width: 900, height: 600 }),
    );
    expect(variants.hero).toEqual(
      expect.objectContaining({ width: 1200, height: 800 }),
    );
    expect(variants.fullscreen).toEqual(
      expect.objectContaining({ width: 1200, height: 800 }),
    );
    expect(putObjectCalls).toHaveLength(5);
    for (const call of putObjectCalls) {
      const metadata = await sharp(call.Body).metadata();
      const key = call.Key.match(/__(.+)\.webp$/)?.[1];
      const variant = (variants as Record<string, any>)[key!];
      expect(metadata.width).toBe(variant.width);
      expect(metadata.height).toBe(variant.height);
      expect(call.ContentType).toBe('image/webp');
    }
  });
});
