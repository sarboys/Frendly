import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_USER_CLEANUP_DATASETS } from '../../prisma/delete-app-users';

describe('app user cleanup script', () => {
  it('covers app users and related user data', () => {
    expect(APP_USER_CLEANUP_DATASETS).toEqual(
      expect.arrayContaining([
        'users',
        'profiles',
        'settings',
        'onboarding',
        'verifications',
        'sessions',
        'phoneOtpChallenges',
        'authAuditEvents',
        'pushTokens',
        'subscriptions',
        'paymentOrders',
        'tokenWallets',
        'tokenLedgerEntries',
        'tokenPromotions',
        'datingActions',
        'datingUsageEvents',
        'profileReactions',
        'follows',
        'eventFavorites',
        'trustedContacts',
        'safetySosAlerts',
        'userReports',
        'userBlocks',
        'events',
        'communities',
        'chats',
        'messages',
        'mediaAssets',
        'dropTickets',
        'dropRewardEvents',
        'dropWinners',
        'dropReferrals',
        'dropRestrictions',
        'eveningSessions',
      ]),
    );
  });

  it('does not target preserved system and partner data', () => {
    expect(APP_USER_CLEANUP_DATASETS).not.toEqual(
      expect.arrayContaining([
        'adminUsers',
        'adminSessions',
        'partners',
        'partnerAccounts',
        'venues',
        'partnerOffers',
        'subscriptionCatalog',
        'externalContentItems',
        'appVersionPolicies',
        'appPopupCampaigns',
      ]),
    );
  });

  it('exposes a package command with an explicit destructive name', () => {
    const packageJsonPath = join(__dirname, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    expect(packageJson.scripts['db:delete:app-users']).toBe(
      'ts-node -r tsconfig-paths/register --project tsconfig.json prisma/delete-app-users.ts delete-app-users',
    );
  });
});
