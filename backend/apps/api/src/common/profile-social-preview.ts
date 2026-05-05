import type { ProfileSocialDto } from '@big-break/contracts';
import { ProfileReactionKind } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

type ProfileSocialClient = Pick<
  PrismaClient,
  'userFollow' | 'profileReaction'
>;

export function emptyProfileSocialPreview(): ProfileSocialDto {
  return {
    followers: 0,
    likes: 0,
    superLikes: 0,
    iFollow: false,
    iLike: false,
    iSuper: false,
  };
}

export async function loadProfileSocialPreviews(
  client: ProfileSocialClient,
  currentUserId: string,
  targetUserIds: readonly (string | null | undefined)[],
): Promise<Map<string, ProfileSocialDto>> {
  const targetIds = Array.from(
    new Set(
      targetUserIds.filter(
        (userId): userId is string =>
          typeof userId === 'string' && userId.length > 0,
      ),
    ),
  );

  const result = new Map<string, ProfileSocialDto>();
  for (const targetId of targetIds) {
    result.set(targetId, emptyProfileSocialPreview());
  }

  if (targetIds.length === 0) {
    return result;
  }

  const activeTargetIds = targetIds.filter(
    (targetId) => targetId !== currentUserId,
  );
  const [
    followerCounts,
    reactionCounts,
    activeFollows,
    activeReactions,
  ] = await Promise.all([
    client.userFollow.groupBy({
      by: ['targetUserId'],
      where: { targetUserId: { in: targetIds } },
      _count: { _all: true },
    }),
    client.profileReaction.groupBy({
      by: ['targetUserId', 'kind'],
      where: {
        targetUserId: { in: targetIds },
        kind: {
          in: [ProfileReactionKind.like, ProfileReactionKind.super_like],
        },
      },
      _count: { _all: true },
    }),
    activeTargetIds.length === 0
      ? Promise.resolve([])
      : client.userFollow.findMany({
          where: {
            followerUserId: currentUserId,
            targetUserId: { in: activeTargetIds },
          },
          select: { targetUserId: true },
        }),
    activeTargetIds.length === 0
      ? Promise.resolve([])
      : client.profileReaction.findMany({
          where: {
            actorUserId: currentUserId,
            targetUserId: { in: activeTargetIds },
            kind: {
              in: [ProfileReactionKind.like, ProfileReactionKind.super_like],
            },
          },
          select: { targetUserId: true, kind: true },
        }),
  ]);

  for (const entry of followerCounts) {
    const preview = result.get(entry.targetUserId);
    if (preview == null) {
      continue;
    }
    preview.followers = entry._count._all;
  }

  for (const entry of reactionCounts) {
    const preview = result.get(entry.targetUserId);
    if (preview == null) {
      continue;
    }
    if (entry.kind === ProfileReactionKind.like) {
      preview.likes = entry._count._all;
    } else if (entry.kind === ProfileReactionKind.super_like) {
      preview.superLikes = entry._count._all;
    }
  }

  for (const entry of activeFollows) {
    const preview = result.get(entry.targetUserId);
    if (preview != null) {
      preview.iFollow = true;
    }
  }

  for (const entry of activeReactions) {
    const preview = result.get(entry.targetUserId);
    if (preview == null) {
      continue;
    }
    if (entry.kind === ProfileReactionKind.like) {
      preview.iLike = true;
    } else if (entry.kind === ProfileReactionKind.super_like) {
      preview.iSuper = true;
    }
  }

  return result;
}
