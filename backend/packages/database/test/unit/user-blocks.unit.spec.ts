import { getBlockedUserIds } from '../../src/user-blocks';

describe('getBlockedUserIds', () => {
  it('returns users blocked by either side of the relationship', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        userId: 'user-me',
        blockedUserId: 'user-blocked-by-me',
      },
      {
        userId: 'user-who-blocked-me',
        blockedUserId: 'user-me',
      },
    ]);

    const result = await getBlockedUserIds({ userBlock: { findMany } }, 'user-me');

    expect(result).toEqual(
      new Set(['user-blocked-by-me', 'user-who-blocked-me']),
    );
    expect(findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: 'user-me' },
          { blockedUserId: 'user-me' },
        ],
      },
      select: {
        userId: true,
        blockedUserId: true,
      },
    });
  });
});
