import { verifyS3UploadCors } from '../src/s3-cors-verifier';

async function main() {
  const result = await verifyS3UploadCors();
  if (result.ok) {
    console.log('[s3-upload-cors] ok');
    return;
  }

  console.error(
    [
      '[s3-upload-cors] failed',
      `hasPutRule=${result.hasPutRule}`,
      `missingHeaders=${result.missingHeaders.join(',') || 'none'}`,
    ].join(' '),
  );
  process.exitCode = 1;
}

main().catch((error) => {
  console.error('[s3-upload-cors] failed', error);
  process.exitCode = 1;
});
