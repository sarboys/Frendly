import { ChatsController } from '../../src/controllers/chats.controller';

describe('ChatsController unit', () => {
  it('lists community chats through the cached chat list path', async () => {
    const response = {
      setHeader: jest.fn(),
    } as any;
    const chatsService = {
      listChatsWithCache: jest.fn().mockResolvedValue({
        etag: 'W/"community-chats"',
        response: {
          items: [
            {
              id: 'chat-1',
              kind: 'community',
              communityId: 'community-1',
            },
          ],
        },
      }),
    } as any;
    const controller = new ChatsController(chatsService);

    const result = await controller.listCommunityChats(
      { userId: 'user-me' },
      undefined,
      '20',
      undefined,
      response,
    );

    expect(chatsService.listChatsWithCache).toHaveBeenCalledWith(
      'user-me',
      'community',
      {
        cursor: undefined,
        limit: 20,
      },
      undefined,
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'ETag',
      'W/"community-chats"',
    );
    expect(result).toEqual({
      items: [
        {
          id: 'chat-1',
          kind: 'community',
          communityId: 'community-1',
        },
      ],
    });
  });

  it('returns a 304 chat list response without ending the Express response manually', async () => {
    const response = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
    } as any;
    const chatsService = {
      listChatsWithCache: jest.fn().mockResolvedValue({
        etag: 'W/"community-chats"',
        notModified: true,
      }),
    } as any;
    const controller = new ChatsController(chatsService);

    const result = await controller.listCommunityChats(
      { userId: 'user-me' },
      undefined,
      '20',
      'W/"community-chats"',
      response,
    );

    expect(response.status).toHaveBeenCalledWith(304);
    expect(response.end).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
