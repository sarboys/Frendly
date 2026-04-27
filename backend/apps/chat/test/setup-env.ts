process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/big_break';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.S3_ENDPOINT ??= 'https://s3.cloud.ru';
process.env.S3_REGION ??= 'ru-central-1';
process.env.S3_ACCESS_KEY ??= 'test-tenant:test-key';
process.env.S3_SECRET_KEY ??= 'test-secret';
process.env.S3_BUCKET ??= 'frendly-test';
process.env.S3_PUBLIC_ENDPOINT ??= 'https://global.s3.cloud.ru';
process.env.JWT_ACCESS_SECRET ??= 'dev-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'dev-refresh-secret';
process.env.JWT_ACCESS_TTL ??= '15m';
process.env.JWT_REFRESH_TTL ??= '30d';
process.env.PUSH_PROVIDER ??= 'fake';
