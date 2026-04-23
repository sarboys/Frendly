import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const testPhoneNumbers = [
  '+71111111111',
  '+72222222222',
  '+73333333333',
  '+74444444444',
  '+75555555555',
  '+76666666666',
] as const;

async function main() {
  const users = await prisma.user.findMany({
    where: {
      phoneNumber: {
        in: [...testPhoneNumbers],
      },
    },
    select: {
      id: true,
      phoneNumber: true,
      displayName: true,
    },
  });

  const userIds = users.map((user) => user.id);

  const hostedEventIds = userIds.length
    ? (
        await prisma.event.findMany({
          where: {
            hostId: {
              in: userIds,
            },
          },
          select: {
            id: true,
          },
        })
      ).map((event) => event.id)
    : [];

  const chatIds =
    userIds.length || hostedEventIds.length
      ? (
          await prisma.chat.findMany({
            where: {
              OR: [
                ifNonEmpty(userIds, (ids) => ({
                  members: {
                    some: {
                      userId: {
                        in: ids,
                      },
                    },
                  },
                })),
                ifNonEmpty(hostedEventIds, (ids) => ({
                  eventId: {
                    in: ids,
                  },
                })),
                ifNonEmpty(hostedEventIds, (ids) => ({
                  sourceEventId: {
                    in: ids,
                  },
                })),
              ].filter(Boolean) as Array<Record<string, unknown>>,
            },
            select: {
              id: true,
            },
          })
        ).map((chat) => chat.id)
      : [];

  const notificationsToDelete =
    userIds.length || hostedEventIds.length || chatIds.length
      ? await prisma.notification.findMany({
          where: {
            OR: [
              ifNonEmpty(userIds, (ids) => ({
                userId: {
                  in: ids,
                },
              })),
              ifNonEmpty(userIds, (ids) => ({
                actorUserId: {
                  in: ids,
                },
              })),
              ifNonEmpty(chatIds, (ids) => ({
                chatId: {
                  in: ids,
                },
              })),
              ifNonEmpty(hostedEventIds, (ids) => ({
                eventId: {
                  in: ids,
                },
              })),
            ].filter(Boolean) as Array<Record<string, unknown>>,
          },
          select: {
            id: true,
          },
        })
      : [];

  const notificationIds = notificationsToDelete.map(
    (notification) => notification.id,
  );

  if (notificationIds.length > 0) {
    await prisma.$executeRawUnsafe(
      'DELETE FROM "OutboxEvent" WHERE payload->>\'notificationId\' = ANY($1)',
      notificationIds,
    );
  }

  if (notificationIds.length > 0) {
    await prisma.notification.deleteMany({
      where: {
        id: {
          in: notificationIds,
        },
      },
    });
  }

  if (chatIds.length > 0) {
    await prisma.chat.deleteMany({
      where: {
        id: {
          in: chatIds,
        },
      },
    });
  }

  if (hostedEventIds.length > 0) {
    await prisma.event.deleteMany({
      where: {
        id: {
          in: hostedEventIds,
        },
      },
    });
  }

  await prisma.telegramLoginSession.deleteMany({
    where: {
      phoneNumber: {
        in: [...testPhoneNumbers],
      },
    },
  });

  await prisma.phoneOtpChallenge.deleteMany({
    where: {
      OR: [
        {
          phoneNumber: {
            in: [...testPhoneNumbers],
          },
        },
        ifNonEmpty(userIds, (ids) => ({
          userId: {
            in: ids,
          },
        })),
      ].filter(Boolean) as Array<Record<string, unknown>>,
    },
  });

  if (userIds.length > 0) {
    await prisma.authAuditEvent.deleteMany({
      where: {
        userId: {
          in: userIds,
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: userIds,
        },
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        deletedUsers: users,
        deletedHostedEventCount: hostedEventIds.length,
        deletedChatCount: chatIds.length,
        deletedNotificationCount: notificationIds.length,
      },
      null,
      2,
    ),
  );
}

function ifNonEmpty<T>(
  values: readonly T[],
  build: (items: readonly T[]) => Record<string, unknown>,
) {
  if (values.length == 0) {
    return null;
  }

  return build(values);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
