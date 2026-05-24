import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXTERNAL_IMPORT_CLEANUP_DATASETS } from '../../prisma/delete-external-imports';

describe('external import cleanup script', () => {
  it('covers imported source data and generated review drafts', () => {
    expect(EXTERNAL_IMPORT_CLEANUP_DATASETS).toEqual(
      expect.arrayContaining([
        'eventsSourceExternalContentLinks',
        'generatedRouteDraftSteps',
        'generatedRouteReviewDrafts',
        'generatedRouteDraftBatches',
        'externalContentItems',
        'externalImportRuns',
        'externalContentSources',
      ]),
    );
  });

  it('does not target user, partner or published route data', () => {
    expect(EXTERNAL_IMPORT_CLEANUP_DATASETS).not.toEqual(
      expect.arrayContaining([
        'users',
        'profiles',
        'events',
        'partners',
        'partnerAccounts',
        'venues',
        'partnerOffers',
        'eveningRouteTemplates',
        'eveningRoutes',
        'mediaAssets',
      ]),
    );
  });

  it('exposes a package command with an explicit destructive name', () => {
    const packageJsonPath = join(__dirname, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    expect(packageJson.scripts['db:delete:external-imports']).toBe(
      'ts-node -r tsconfig-paths/register --project tsconfig.json prisma/delete-external-imports.ts delete-external-imports',
    );
  });
});
