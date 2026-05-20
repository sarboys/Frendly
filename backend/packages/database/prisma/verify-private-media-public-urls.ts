import { PrismaClient } from '@prisma/client';
import { verifyPrivateMediaPublicUrls } from '../src/private-media-public-url-backfill';

const prisma = new PrismaClient();

async function main() {
  const report = await verifyPrivateMediaPublicUrls(prisma);
  if (report.ok) {
    console.log('[private-media-public-url-verify] ok stalePublicUrlCount=0');
    return;
  }

  console.error(
    `[private-media-public-url-verify] failed stalePublicUrlCount=${report.stalePublicUrlCount}`,
  );
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('[private-media-public-url-verify] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
