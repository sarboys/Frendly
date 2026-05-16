import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const demoUserIds = [
  'user-me',
  'user-anya',
  'user-mark',
  'user-liza',
  'user-dima',
  'user-sonya',
  'user-oleg',
];

const demoEventIds = [
  'e1',
  'e2',
  'e3',
  'e4',
  'e5',
  'ad1',
  'ad2',
  'ad3',
  'ad4',
  'ad5',
  'ad6',
  'ad7',
  'ad8',
];

const demoRouteIds = [
  'r-cozy-circle',
  'r-date-noir',
  'r-wild-night',
  'r-quiet-soul',
  'r-afterdark',
  'route-frendly-test-evening-v1',
];

const demoRouteTemplateIds = [
  ...demoRouteIds.map((routeId) => `route-template-${routeId}`),
  'route-template-frendly-test-evening',
];

const demoEveningSessionIds = [
  'evening-session-r-cozy-circle',
  'evening-session-r-date-noir',
  'evening-session-r-wild-night',
  'evening-session-r-quiet-soul',
  'evening-session-r-afterdark',
];

const demoChatIds = [
  'mc1',
  'mc2',
  'mc3',
  'mc4',
  'mc5',
  'mc-ad1',
  'mc-ad2',
  'mc-ad3',
  'mc-ad4',
  'mc-ad5',
  'mc-ad6',
  'mc-ad7',
  'mc-ad8',
  'evening-chat-r-cozy-circle',
  'evening-chat-r-date-noir',
  'evening-chat-r-wild-night',
  'evening-chat-r-quiet-soul',
  'evening-chat-r-afterdark',
  'p1',
  'p2',
  'p3',
  'community-c1-chat',
  'community-c2-chat',
  'community-c3-chat',
];

const demoCommunityIds = ['c1', 'c2', 'c3'];
const demoPartnerIds = ['partner-frendly-test'];
const demoVenueIds = ['venue-frendly-test-cafe', 'venue-frendly-test-gallery'];
const demoOfferIds = ['offer-frendly-test-dessert'];
const demoNotificationIds = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'];

async function main() {
  const result: Record<string, number> = {};

  async function collect(
    key: string,
    action: Promise<{ count: number }>,
  ): Promise<void> {
    result[key] = (await action).count;
  }

  await collect(
    'realtimeEvents',
    prisma.realtimeEvent.deleteMany({
      where: {
        chatId: { in: demoChatIds },
      },
    }),
  );
  await collect(
    'notifications',
    prisma.notification.deleteMany({
      where: {
        OR: [
          { id: { in: demoNotificationIds } },
          { userId: { in: demoUserIds } },
          { actorUserId: { in: demoUserIds } },
          { chatId: { in: demoChatIds } },
          { eventId: { in: demoEventIds } },
        ],
      },
    }),
  );

  await collect(
    'eveningAnalyticsEvents',
    prisma.eveningAnalyticsEvent.deleteMany({
      where: {
        OR: [
          { routeId: { in: demoRouteIds } },
          { sessionId: { in: demoEveningSessionIds } },
          { userId: { in: demoUserIds } },
        ],
      },
    }),
  );
  await collect(
    'partnerOfferCodes',
    prisma.partnerOfferCode.deleteMany({
      where: {
        OR: [
          { userId: { in: demoUserIds } },
          { partnerId: { in: demoPartnerIds } },
          { offerId: { in: demoOfferIds } },
        ],
      },
    }),
  );
  await collect(
    'eveningSessions',
    prisma.eveningSession.deleteMany({
      where: {
        OR: [
          { id: { in: demoEveningSessionIds } },
          { routeId: { in: demoRouteIds } },
          { hostUserId: { in: demoUserIds } },
          { chatId: { in: demoChatIds } },
        ],
      },
    }),
  );
  await collect(
    'userEveningStepActions',
    prisma.userEveningStepAction.deleteMany({
      where: {
        OR: [{ userId: { in: demoUserIds } }, { routeId: { in: demoRouteIds } }],
      },
    }),
  );

  await prisma.eveningRouteTemplate.updateMany({
    where: { id: { in: demoRouteTemplateIds } },
    data: { currentRouteId: null },
  });
  await collect(
    'eveningRoutes',
    prisma.eveningRoute.deleteMany({
      where: { id: { in: demoRouteIds } },
    }),
  );
  await collect(
    'eveningRouteTemplates',
    prisma.eveningRouteTemplate.deleteMany({
      where: { id: { in: demoRouteTemplateIds } },
    }),
  );

  await collect(
    'communities',
    prisma.community.deleteMany({
      where: { id: { in: demoCommunityIds } },
    }),
  );
  await collect(
    'chats',
    prisma.chat.deleteMany({
      where: { id: { in: demoChatIds } },
    }),
  );
  await collect(
    'events',
    prisma.event.deleteMany({
      where: {
        OR: [{ id: { in: demoEventIds } }, { hostId: { in: demoUserIds } }],
      },
    }),
  );
  await collect(
    'partnerOffers',
    prisma.partnerOffer.deleteMany({
      where: { id: { in: demoOfferIds } },
    }),
  );
  await collect(
    'venues',
    prisma.venue.deleteMany({
      where: { id: { in: demoVenueIds } },
    }),
  );
  await collect(
    'partners',
    prisma.partner.deleteMany({
      where: { id: { in: demoPartnerIds } },
    }),
  );

  await collect(
    'users',
    prisma.user.deleteMany({
      where: { id: { in: demoUserIds } },
    }),
  );
  await collect(
    'mediaAssets',
    prisma.mediaAsset.deleteMany({
      where: {
        OR: [{ objectKey: { startsWith: 'seeded/' } }, { bucket: 'seeded' }],
      },
    }),
  );

  console.log(
    JSON.stringify(
      {
        message: 'Demo seed cleanup finished. No demo data was inserted.',
        deleted: result,
      },
      null,
      2,
    ),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
