import {
  buildPublicAssetUrl,
  createPresignedUpload,
  getS3Config,
  objectKeyFromPublicAssetUrl,
} from '../../src/s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/upload'),
}));

const S3_ENV_KEYS = [
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'S3_BUCKET',
  'S3_PUBLIC_ENDPOINT',
  'S3_CDN_ENDPOINT',
] as const;

describe('getS3Config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    for (const key of S3_ENV_KEYS) {
      delete process.env[key];
    }

    Object.assign(process.env, originalEnv);
    jest.clearAllMocks();
  });

  it('requires Cloud S3 credentials', () => {
    for (const key of S3_ENV_KEYS) {
      delete process.env[key];
    }

    expect(() => getS3Config()).toThrow(
      'Missing required S3 env: S3_ACCESS_KEY, S3_SECRET_KEY',
    );
  });

  it('uses Cloud S3 defaults when only credentials are provided', () => {
    for (const key of S3_ENV_KEYS) {
      delete process.env[key];
    }

    process.env.S3_ACCESS_KEY = 'tenant-id:key-id';
    process.env.S3_SECRET_KEY = 'secret';

    expect(getS3Config()).toEqual({
      endpoint: 'https://s3.cloud.ru',
      region: 'ru-central-1',
      accessKeyId: 'tenant-id:key-id',
      secretAccessKey: 'secret',
      bucket: 'frendly',
      publicEndpoint: 'https://global.s3.cloud.ru',
      cdnEndpoint: 'https://global.s3.cloud.ru',
    });
  });

  it('uses a separate CDN endpoint for public asset URLs', () => {
    for (const key of S3_ENV_KEYS) {
      delete process.env[key];
    }

    process.env.S3_ACCESS_KEY = 'tenant-id:key-id';
    process.env.S3_SECRET_KEY = 'secret';
    process.env.S3_PUBLIC_ENDPOINT = 'https://s3.twcstorage.ru';
    process.env.S3_CDN_ENDPOINT = 'https://cdn.frendly.tech';

    expect(getS3Config()).toMatchObject({
      publicEndpoint: 'https://s3.twcstorage.ru',
      cdnEndpoint: 'https://cdn.frendly.tech',
    });
  });

  it('builds public asset URLs from the CDN endpoint without the bucket prefix', () => {
    for (const key of S3_ENV_KEYS) {
      delete process.env[key];
    }

    process.env.S3_ACCESS_KEY = 'tenant-id:key-id';
    process.env.S3_SECRET_KEY = 'secret';
    process.env.S3_BUCKET = 'frendly-backet';
    process.env.S3_PUBLIC_ENDPOINT = 'https://s3.twcstorage.ru';
    process.env.S3_CDN_ENDPOINT = 'https://cdn.frendly.tech';

    expect(buildPublicAssetUrl('avatars/user-me/photo.png')).toBe(
      'https://cdn.frendly.tech/avatars/user-me/photo.png',
    );
  });

  it('normalizes trailing slashes in public asset URL endpoints', () => {
    for (const key of S3_ENV_KEYS) {
      delete process.env[key];
    }

    process.env.S3_ACCESS_KEY = 'tenant-id:key-id';
    process.env.S3_SECRET_KEY = 'secret';
    process.env.S3_BUCKET = 'frendly-backet';
    process.env.S3_PUBLIC_ENDPOINT = 'https://s3.twcstorage.ru/';
    process.env.S3_CDN_ENDPOINT = 'https://cdn.frendly.tech/';

    expect(buildPublicAssetUrl('avatars/user-me/photo.png')).toBe(
      'https://cdn.frendly.tech/avatars/user-me/photo.png',
    );

    process.env.S3_CDN_ENDPOINT = '';

    expect(buildPublicAssetUrl('avatars/user-me/photo.png')).toBe(
      'https://s3.twcstorage.ru/frendly-backet/avatars/user-me/photo.png',
    );
  });

  it('encodes public asset object key path segments', () => {
    for (const key of S3_ENV_KEYS) {
      delete process.env[key];
    }

    process.env.S3_ACCESS_KEY = 'tenant-id:key-id';
    process.env.S3_SECRET_KEY = 'secret';
    process.env.S3_BUCKET = 'frendly-backet';
    process.env.S3_CDN_ENDPOINT = 'https://cdn.frendly.tech';

    expect(buildPublicAssetUrl('avatars/user-me/мое фото #1.jpg')).toBe(
      'https://cdn.frendly.tech/avatars/user-me/%D0%BC%D0%BE%D0%B5%20%D1%84%D0%BE%D1%82%D0%BE%20%231.jpg',
    );
  });

  it('signs presigned uploads with cache control and returns the required header', async () => {
    for (const key of S3_ENV_KEYS) {
      delete process.env[key];
    }

    process.env.S3_ACCESS_KEY = 'tenant-id:key-id';
    process.env.S3_SECRET_KEY = 'secret';
    process.env.S3_BUCKET = 'frendly-backet';

    await expect(
      createPresignedUpload({
        objectKey: 'avatars/user-me/photo.png',
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000, immutable',
      }),
    ).resolves.toEqual({
      uploadUrl: 'https://signed.example/upload',
      objectKey: 'avatars/user-me/photo.png',
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });

    const signedCommand = (getSignedUrl as jest.Mock).mock.calls[0]?.[1];
    expect(signedCommand.input).toMatchObject({
      Bucket: 'frendly-backet',
      Key: 'avatars/user-me/photo.png',
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000, immutable',
    });
  });

  it('extracts object keys from configured CDN URLs', () => {
    for (const key of S3_ENV_KEYS) {
      delete process.env[key];
    }

    process.env.S3_ACCESS_KEY = 'tenant-id:key-id';
    process.env.S3_SECRET_KEY = 'secret';
    process.env.S3_BUCKET = 'frendly-backet';
    process.env.S3_PUBLIC_ENDPOINT = 'https://s3.twcstorage.ru';
    process.env.S3_CDN_ENDPOINT = 'https://cdn.frendly.tech';

    expect(
      objectKeyFromPublicAssetUrl(
        'https://cdn.frendly.tech/external-content/advcake_ticketland/image.jpg',
      ),
    ).toBe('external-content/advcake_ticketland/image.jpg');
  });

  it('extracts object keys from public S3 URLs with bucket prefix', () => {
    for (const key of S3_ENV_KEYS) {
      delete process.env[key];
    }

    process.env.S3_ACCESS_KEY = 'tenant-id:key-id';
    process.env.S3_SECRET_KEY = 'secret';
    process.env.S3_BUCKET = 'frendly-backet';
    process.env.S3_PUBLIC_ENDPOINT = 'https://s3.twcstorage.ru';
    process.env.S3_CDN_ENDPOINT = '';

    expect(
      objectKeyFromPublicAssetUrl(
        'https://s3.twcstorage.ru/frendly-backet/external-content/advcake_ticketland/image.jpg',
      ),
    ).toBe('external-content/advcake_ticketland/image.jpg');
  });

  it('ignores an empty CDN endpoint', () => {
    for (const key of S3_ENV_KEYS) {
      delete process.env[key];
    }

    process.env.S3_ACCESS_KEY = 'tenant-id:key-id';
    process.env.S3_SECRET_KEY = 'secret';
    process.env.S3_PUBLIC_ENDPOINT = 'https://s3.twcstorage.ru';
    process.env.S3_CDN_ENDPOINT = '';

    expect(getS3Config()).toMatchObject({
      publicEndpoint: 'https://s3.twcstorage.ru',
      cdnEndpoint: 'https://s3.twcstorage.ru',
    });
  });

  it('requires an explicit bucket in production', () => {
    for (const key of S3_ENV_KEYS) {
      delete process.env[key];
    }

    process.env.NODE_ENV = 'production';
    process.env.S3_ACCESS_KEY = 'tenant-id:key-id';
    process.env.S3_SECRET_KEY = 'secret';

    expect(() => getS3Config()).toThrow(
      'Missing required S3 env: S3_BUCKET',
    );
  });
});
