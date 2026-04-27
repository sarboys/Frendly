interface UserBlockPair {
  userId: string;
  blockedUserId: string;
}

interface UserBlockLookupClient {
  userBlock: {
    findMany(args: {
      where: {
        OR: Array<
          | { userId: string }
          | { blockedUserId: string }
        >;
      };
      select: {
        userId: true;
        blockedUserId: true;
      };
    }): Promise<UserBlockPair[]>;
  };
}

export async function getBlockedUserIds(
  client: UserBlockLookupClient,
  userId: string,
) {
  const blocks = await client.userBlock.findMany({
    where: {
      OR: [
        { userId },
        { blockedUserId: userId },
      ],
    },
    select: {
      userId: true,
      blockedUserId: true,
    },
  });

  const blockedUserIds = new Set<string>();
  for (const block of blocks) {
    if (block.userId === userId) {
      blockedUserIds.add(block.blockedUserId);
    }
    if (block.blockedUserId === userId) {
      blockedUserIds.add(block.userId);
    }
  }

  return blockedUserIds;
}
