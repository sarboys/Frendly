import { PrismaClient } from '@prisma/client';

export const APP_USER_CLEANUP_DATASETS = [
  'users',
  'profiles',
  'settings',
  'onboarding',
  'verifications',
  'sessions',
  'telegramAccounts',
  'externalAuthAccounts',
  'telegramLoginSessions',
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
  'eventJoinRequests',
  'eventParticipants',
  'eventAttendances',
  'eventLiveStates',
  'eventFeedbacks',
  'eventStories',
  'communities',
  'communityJoinRequests',
  'chats',
  'messages',
  'messageAttachments',
  'mediaAssets',
  'profilePhotos',
  'notifications',
  'dropTickets',
  'dropRewardEvents',
  'dropWinners',
  'dropReferrals',
  'dropRestrictions',
  'seasonRewardClaims',
  'eveningSessions',
  'eveningAiRouteDrafts',
  'eveningAnalyticsEvents',
  'publicShares',
  'userEveningStepActions',
  'eveningSessionParticipants',
  'eveningSessionJoinRequests',
  'eveningSessionStepStates',
  'eveningStepCheckIns',
  'eveningAfterPartyFeedbacks',
  'eveningAfterPartyPhotos',
  'partnerOfferCodes',
  'appPopupTargets',
] as const;

type CountResult = { count: number };

type AppUserCleanupResult = {
  deletedUsers: Array<{
    id: string;
    phoneNumber: string | null;
    displayName: string;
  }>;
  counts: Record<string, number>;
};

export async function deleteAppUsers(
  prisma: PrismaClient,
): Promise<AppUserCleanupResult> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      phoneNumber: true,
      displayName: true,
    },
  });
  const userIds = users.map((user) => user.id);

  const counts: Record<string, number> = {};
  const collect = async (key: string, action: Promise<CountResult>) => {
    counts[key] = (await action).count;
  };

  await collect('dropWinners', prisma.dropWinner.deleteMany({}));
  await collect('dropTickets', prisma.dropTicket.deleteMany({}));
  await collect('dropRewardEvents', prisma.dropRewardEvent.deleteMany({}));
  await collect('dropReferrals', prisma.dropReferral.deleteMany({}));
  await collect('dropRestrictions', prisma.dropUserRestriction.deleteMany({}));
  await collect('seasonRewardClaims', prisma.userSeasonRewardClaim.deleteMany({}));
  await collect('appPopupTargets', prisma.appPopupTargetUser.deleteMany({}));

  await collect('partnerOfferCodes', prisma.partnerOfferCode.deleteMany({}));
  await collect('eveningAfterPartyPhotos', prisma.eveningAfterPartyPhoto.deleteMany({}));
  await collect(
    'eveningAfterPartyFeedbacks',
    prisma.eveningAfterPartyFeedback.deleteMany({}),
  );
  await collect('eveningStepCheckIns', prisma.eveningStepCheckIn.deleteMany({}));
  await collect('eveningSessionStepStates', prisma.eveningSessionStepState.deleteMany({}));
  await collect(
    'eveningSessionJoinRequests',
    prisma.eveningSessionJoinRequest.deleteMany({}),
  );
  await collect(
    'eveningSessionParticipants',
    prisma.eveningSessionParticipant.deleteMany({}),
  );
  await collect('eveningSessions', prisma.eveningSession.deleteMany({}));
  await collect('userEveningStepActions', prisma.userEveningStepAction.deleteMany({}));
  await collect('eveningAiRouteDrafts', prisma.eveningAiRouteDraft.deleteMany({}));
  await collect(
    'eveningAnalyticsEvents',
    prisma.eveningAnalyticsEvent.deleteMany({
      where: {
        OR: [
          { userId: { not: null } },
          { sessionId: { not: null } },
        ],
      },
    }),
  );

  await collect('publicShares', prisma.publicShare.deleteMany({}));
  await collect('tokenPromotions', prisma.tokenPromotion.deleteMany({}));
  await collect('tokenLedgerEntries', prisma.tokenLedgerEntry.deleteMany({}));
  await collect('paymentOrders', prisma.paymentOrder.deleteMany({}));
  await collect('tokenWallets', prisma.tokenWallet.deleteMany({}));
  await collect('subscriptions', prisma.userSubscription.deleteMany({}));

  await collect('datingActions', prisma.datingAction.deleteMany({}));
  await collect('datingUsageEvents', prisma.datingUsageEvent.deleteMany({}));
  await collect('profileReactions', prisma.profileReaction.deleteMany({}));
  await collect('follows', prisma.userFollow.deleteMany({}));
  await collect('eventFavorites', prisma.eventFavorite.deleteMany({}));
  await collect('trustedContacts', prisma.trustedContact.deleteMany({}));
  await collect('safetySosAlerts', prisma.safetySosAlert.deleteMany({}));
  await collect('userReports', prisma.userReport.deleteMany({}));
  await collect('userBlocks', prisma.userBlock.deleteMany({}));
  await collect('pushTokens', prisma.pushToken.deleteMany({}));

  await collect('messageAttachments', prisma.messageAttachment.deleteMany({}));
  await collect('messages', prisma.message.deleteMany({}));
  await collect('realtimeEvents', prisma.realtimeEvent.deleteMany({}));
  await collect('notifications', prisma.notification.deleteMany({}));

  await collect('communityJoinRequests', prisma.communityJoinRequest.deleteMany({}));
  await collect('communities', prisma.community.deleteMany({}));
  await collect('chats', prisma.chat.deleteMany({}));

  await collect('eventStories', prisma.eventStory.deleteMany({}));
  await collect('eventFeedbacks', prisma.eventFeedback.deleteMany({}));
  await collect('eventLiveStates', prisma.eventLiveState.deleteMany({}));
  await collect('eventAttendances', prisma.eventAttendance.deleteMany({}));
  await collect('eventJoinRequests', prisma.eventJoinRequest.deleteMany({}));
  await collect('eventParticipants', prisma.eventParticipant.deleteMany({}));
  await collect('events', prisma.event.deleteMany({}));

  await prisma.profile.updateMany({
    where: userIds.length > 0 ? { userId: { in: userIds } } : { userId: '__none__' },
    data: {
      avatarAssetId: null,
      avatarUrl: null,
    },
  });

  await collect('profilePhotos', prisma.profilePhoto.deleteMany({}));
  await collect('verifications', prisma.userVerification.deleteMany({}));
  await collect('profiles', prisma.profile.deleteMany({}));
  await collect('mediaAssets', prisma.mediaAsset.deleteMany({}));
  await collect('settings', prisma.userSettings.deleteMany({}));
  await collect('onboarding', prisma.onboardingPreferences.deleteMany({}));

  await collect('telegramLoginSessions', prisma.telegramLoginSession.deleteMany({}));
  await collect('phoneOtpChallenges', prisma.phoneOtpChallenge.deleteMany({}));
  await collect('authAuditEvents', prisma.authAuditEvent.deleteMany({}));
  await collect('telegramAccounts', prisma.telegramAccount.deleteMany({}));
  await collect('externalAuthAccounts', prisma.externalAuthAccount.deleteMany({}));
  await collect('sessions', prisma.session.deleteMany({}));

  await collect(
    'users',
    prisma.user.deleteMany({
      where:
        userIds.length > 0 ? { id: { in: userIds } } : { id: '__none__' },
    }),
  );

  return {
    deletedUsers: users,
    counts,
  };
}

async function main() {
  const command = process.argv[2] ?? '';
  if (command !== 'delete-app-users') {
    throw new Error(
      `Unknown command "${command}". Use delete-app-users.`,
    );
  }

  const prisma = new PrismaClient();

  try {
    const result = await deleteAppUsers(prisma);
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
