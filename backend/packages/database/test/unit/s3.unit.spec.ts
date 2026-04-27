import { getS3Config } from '../../src/s3';

const S3_ENV_KEYS = [
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'S3_BUCKET',
  'S3_PUBLIC_ENDPOINT',
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
    });
  });
});
