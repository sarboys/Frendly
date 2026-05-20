import { analyzeS3UploadCorsRules } from '../../src/s3-cors-verifier';

describe('analyzeS3UploadCorsRules', () => {
  it('accepts a PUT rule that allows content-type and cache-control headers', () => {
    expect(
      analyzeS3UploadCorsRules([
        {
          AllowedMethods: ['GET', 'PUT'],
          AllowedHeaders: ['content-type', 'cache-control'],
          AllowedOrigins: ['https://frendly.tech'],
        },
      ]),
    ).toEqual({
      ok: true,
      missingHeaders: [],
      hasPutRule: true,
    });
  });

  it('reports missing cache-control header for presigned uploads', () => {
    expect(
      analyzeS3UploadCorsRules([
        {
          AllowedMethods: ['PUT'],
          AllowedHeaders: ['content-type'],
          AllowedOrigins: ['https://frendly.tech'],
        },
      ]),
    ).toEqual({
      ok: false,
      missingHeaders: ['cache-control'],
      hasPutRule: true,
    });
  });

  it('accepts wildcard upload headers', () => {
    expect(
      analyzeS3UploadCorsRules([
        {
          AllowedMethods: ['PUT'],
          AllowedHeaders: ['*'],
          AllowedOrigins: ['*'],
        },
      ]),
    ).toEqual({
      ok: true,
      missingHeaders: [],
      hasPutRule: true,
    });
  });

  it('requires one PUT rule to allow all upload headers', () => {
    expect(
      analyzeS3UploadCorsRules([
        {
          AllowedMethods: ['PUT'],
          AllowedHeaders: ['content-type'],
          AllowedOrigins: ['https://frendly.tech'],
        },
        {
          AllowedMethods: ['PUT'],
          AllowedHeaders: ['cache-control'],
          AllowedOrigins: ['https://admin.frendly.tech'],
        },
      ]),
    ).toEqual({
      ok: false,
      missingHeaders: ['cache-control'],
      hasPutRule: true,
    });
  });
});
