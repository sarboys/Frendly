import { buildPublicAssetUrl, getS3Config } from '../../src/s3';

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
