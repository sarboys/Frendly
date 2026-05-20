import { GetBucketCorsCommand } from '@aws-sdk/client-s3';
import { createS3Client, createS3RequestOptions, getS3Config } from './s3';

export type S3UploadCorsRule = {
  AllowedMethods?: string[];
  AllowedHeaders?: string[];
  AllowedOrigins?: string[];
};

export type S3UploadCorsAnalysis = {
  ok: boolean;
  missingHeaders: string[];
  hasPutRule: boolean;
};

const REQUIRED_UPLOAD_HEADERS = ['content-type', 'cache-control'] as const;

export function analyzeS3UploadCorsRules(
  rules: S3UploadCorsRule[] | null | undefined,
): S3UploadCorsAnalysis {
  const putRules = (rules ?? []).filter((rule) =>
    hasCorsValue(rule.AllowedMethods, 'PUT'),
  );
  const bestMissingHeaders = putRules
    .map((rule) => missingUploadHeaders(rule))
    .sort((left, right) => left.length - right.length)[0];
  const missingHeaders = bestMissingHeaders ?? [...REQUIRED_UPLOAD_HEADERS];

  return {
    ok: putRules.length > 0 && missingHeaders.length === 0,
    missingHeaders,
    hasPutRule: putRules.length > 0,
  };
}

export async function verifyS3UploadCors(): Promise<S3UploadCorsAnalysis> {
  const config = getS3Config();
  const client = createS3Client();
  const result = await client.send(
    new GetBucketCorsCommand({
      Bucket: config.bucket,
    }),
    createS3RequestOptions(),
  );

  return analyzeS3UploadCorsRules(result.CORSRules);
}

function hasCorsValue(values: string[] | undefined, expected: string) {
  return (values ?? []).some(
    (value) => value.toLowerCase() === expected.toLowerCase(),
  );
}

function missingUploadHeaders(rule: S3UploadCorsRule) {
  if (hasCorsValue(rule.AllowedHeaders, '*')) {
    return [];
  }

  const allowedHeaders = new Set(
    (rule.AllowedHeaders ?? []).map((header) => header.toLowerCase()),
  );
  return REQUIRED_UPLOAD_HEADERS.filter((header) => !allowedHeaders.has(header));
}
