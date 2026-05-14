import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { appMetrics, renderAppMetrics } from '../../src/metrics';
import { createPresignedDownload, createPresignedUpload } from '../../src/s3';

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
  'METRICS_SERVICE_NAME',
] as const;

describe('s3 metrics', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    appMetrics.reset();
    for (const key of S3_ENV_KEYS) {
      delete process.env[key];
    }
    process.env.S3_ACCESS_KEY = 'tenant-id:key-id';
    process.env.S3_SECRET_KEY = 'secret';
    process.env.METRICS_SERVICE_NAME = 'api';
    jest.clearAllMocks();
  });

  afterAll(() => {
    for (const key of S3_ENV_KEYS) {
      delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('records presigned upload and download operations without object key labels', async () => {
    await createPresignedUpload({
      objectKey: 'avatars/user-me/photo.png',
      contentType: 'image/png',
    });
    await createPresignedDownload('avatars/user-me/photo.png');

    const text = await renderAppMetrics();

    expect(getSignedUrl).toHaveBeenCalledTimes(2);
    expect(text).toContain('frendly_s3_operation_total');
    expect(text).toContain('operation="presign_upload"');
    expect(text).toContain('operation="presign_download"');
    expect(text).toContain('service="api"');
    expect(text).not.toContain('avatars/user-me/photo.png');
  });
});
