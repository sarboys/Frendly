import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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

export function getS3Config(): S3Config {
  return {
    endpoint: process.env.S3_ENDPOINT ?? 'http://minio:9000',
    region: process.env.S3_REGION ?? 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
    bucket: process.env.S3_BUCKET ?? 'big-break',
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT ?? 'http://localhost:9000',
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

export function buildPublicAssetUrl(objectKey: string): string {
  const config = getS3Config();
  return `${config.publicEndpoint}/${config.bucket}/${objectKey}`;
}
