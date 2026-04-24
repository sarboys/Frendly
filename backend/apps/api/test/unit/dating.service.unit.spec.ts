import { DatingService } from '../../src/services/dating.service';

describe('DatingService unit', () => {
  it('does not load all prior dating actions before discover query', async () => {
    const datingActionFindMany = jest.fn().mockImplementation(() => {
      throw new Error('should not load all prior dating actions');
    });
    const userFindMany = jest.fn().mockResolvedValue([]);
    const service = new DatingService(
      {
        client: {
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'user-me',
              onboarding: {
                interests: [],
              },
            }),
            findMany: userFindMany,
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          datingAction: {
            findMany: datingActionFindMany,
          },
        },
      } as any,
      {} as any,
      {
        hasPremiumAccess: jest.fn().mockResolvedValue(true),
      } as any,
    );

    await expect(service.listDiscover('user-me')).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    expect(datingActionFindMany).not.toHaveBeenCalled();
    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          datingActionsReceived: {
            none: {
              actorUserId: 'user-me',
            },
          },
        }),
      }),
    );
  });
});
