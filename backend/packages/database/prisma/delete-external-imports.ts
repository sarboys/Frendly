import { PrismaClient } from '@prisma/client';

export const EXTERNAL_IMPORT_CLEANUP_DATASETS = [
  'eventsSourceExternalContentLinks',
  'generatedRouteDraftSteps',
  'generatedRouteReviewDrafts',
  'generatedRouteDraftBatches',
  'externalContentItems',
  'externalImportRuns',
  'externalContentSources',
] as const;

type CountResult = { count: number };

type ExternalImportCleanupResult = {
  counts: Record<string, number>;
};

export async function deleteExternalImports(
  prisma: PrismaClient,
): Promise<ExternalImportCleanupResult> {
  const counts: Record<string, number> = {};
  const collect = async (key: string, action: Promise<CountResult>) => {
    counts[key] = (await action).count;
  };
  const count = async (key: string, action: Promise<number>) => {
    counts[key] = await action;
  };

  await collect(
    'eventsSourceExternalContentLinks',
    prisma.event.updateMany({
      where: { sourceExternalContentItemId: { not: null } },
      data: { sourceExternalContentItemId: null },
    }),
  );

  await count('generatedRouteDraftSteps', prisma.generatedRouteDraftStep.count());
  await count('generatedRouteReviewDrafts', prisma.generatedRouteReviewDraft.count());
  await collect(
    'generatedRouteDraftBatches',
    prisma.generatedRouteDraftBatch.deleteMany({}),
  );

  await collect('externalContentItems', prisma.externalContentItem.deleteMany({}));
  await collect('externalImportRuns', prisma.externalImportRun.deleteMany({}));
  await collect('externalContentSources', prisma.externalContentSource.deleteMany({}));

  return { counts };
}

async function main() {
  const command = process.argv[2] ?? '';
  if (command !== 'delete-external-imports') {
    throw new Error(
      `Unknown command "${command}". Use delete-external-imports.`,
    );
  }

  const prisma = new PrismaClient();

  try {
    const result = await deleteExternalImports(prisma);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
