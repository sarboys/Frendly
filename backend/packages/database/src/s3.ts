import { GetObjectCommand, S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface S3Config {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicEndpoint: string;
}

export interface PresignedUploadInput {
  objectKey: string;
  contentType: string;
}

export const PRESIGNED_DOWNLOAD_TTL_SECONDS = 300;
const DEFAULT_S3_ENDPOINT = 'https://s3.cloud.ru';
const DEFAULT_S3_REGION = 'ru-central-1';
const DEFAULT_S3_BUCKET = 'frendly';
const DEFAULT_S3_PUBLIC_ENDPOINT = 'https://global.s3.cloud.ru';
const REQUIRED_S3_ENV_KEYS = ['S3_ACCESS_KEY', 'S3_SECRET_KEY'] as const;

export function getS3Config(): S3Config {
  const missingKeys = REQUIRED_S3_ENV_KEYS.filter((key) => !process.env[key]);

  if (missingKeys.length > 0) {
    throw new Error(`Missing required S3 env: ${missingKeys.join(', ')}`);
  }

  return {
    endpoint: process.env.S3_ENDPOINT ?? DEFAULT_S3_ENDPOINT,
    region: process.env.S3_REGION ?? DEFAULT_S3_REGION,
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
    bucket: process.env.S3_BUCKET ?? DEFAULT_S3_BUCKET,
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT ?? DEFAULT_S3_PUBLIC_ENDPOINT,
  };
}

export function createS3Client(): S3Client {
  const config = getS3Config();

  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function createPublicS3Client(): S3Client {
  const config = getS3Config();

  return new S3Client({
    endpoint: config.publicEndpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export async function createPresignedUpload(input: PresignedUploadInput) {
  const config = getS3Config();
  const client = createPublicS3Client();
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.objectKey,
    ContentType: input.contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 });

  return {
    uploadUrl,
    objectKey: input.objectKey,
    headers: {
      'content-type': input.contentType,
    },
  };
}

export async function createPresignedDownload(objectKey: string) {
  const config = getS3Config();
  const client = createPublicS3Client();
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: objectKey,
  });

  return {
    url: await getSignedUrl(client, command, {
      expiresIn: PRESIGNED_DOWNLOAD_TTL_SECONDS,
    }),
    expiresAt: new Date(Date.now() + PRESIGNED_DOWNLOAD_TTL_SECONDS * 1000),
  };
}

export function buildPublicAssetUrl(objectKey: string): string {
  const config = getS3Config();
  return `${config.publicEndpoint}/${config.bucket}/${objectKey}`;
}

export function buildMediaProxyPath(assetId: string): string {
  return `/media/${assetId}`;
}
