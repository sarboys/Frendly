import { UploadsService } from '../../src/services/uploads.service';

describe('UploadsService', () => {
  it('returns an existing chat upload asset when complete is retried', async () => {
    const client = {
      chatMember: {
        findUnique: jest.fn().mockResolvedValue({ chatId: 'p1', userId: 'user-me' }),
      },
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'asset-existing',
          ownerId: 'user-me',
          kind: 'chat_voice',
          status: 'ready',
          objectKey: 'chat-attachments/user-me/voice.m4a',
          mimeType: 'audio/mp4',
          byteSize: 2048,
          durationMs: 9000,
          waveform: [0.2, 0.6],
          chatId: 'p1',
        }),
        create: jest.fn().mockResolvedValue({
          id: 'asset-new',
          status: 'ready',
        }),
      },
    };
    const service = new UploadsService(
      { client } as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.completeChatAttachmentUpload('user-me', {
        chatId: 'p1',
        kind: 'chat_voice',
        objectKey: 'chat-attachments/user-me/voice.m4a',
        mimeType: 'audio/mp4',
        byteSize: 2048,
        fileName: 'voice.m4a',
        durationMs: 9000,
        waveform: [0.2, 0.6],
      }),
    ).resolves.toEqual({
      assetId: 'asset-existing',
      status: 'ready',
    });
    expect(client.mediaAsset.create).not.toHaveBeenCalled();
  });

  it('starts existing chat upload asset lookup while membership check is still loading', async () => {
    let resolveMembership!: (value: { chatId: string; userId: string }) => void;
    const chatMemberFindUnique = jest.fn(
      () =>
        new Promise<{ chatId: string; userId: string }>((resolve) => {
          resolveMembership = resolve;
        }),
    );
    const mediaFindUnique = jest.fn().mockResolvedValue({
      id: 'asset-existing',
      ownerId: 'user-me',
      kind: 'chat_voice',
      status: 'ready',
      objectKey: 'chat-attachments/user-me/voice.m4a',
      mimeType: 'audio/mp4',
      byteSize: 2048,
      durationMs: 9000,
      waveform: [0.2, 0.6],
      chatId: 'p1',
    });
    const client = {
      chatMember: {
        findUnique: chatMemberFindUnique,
      },
      mediaAsset: {
        findUnique: mediaFindUnique,
        create: jest.fn(),
      },
    };
    const service = new UploadsService(
      { client } as any,
      {} as any,
      {} as any,
    );

    const resultPromise = service.completeChatAttachmentUpload('user-me', {
      chatId: 'p1',
      kind: 'chat_voice',
      objectKey: 'chat-attachments/user-me/voice.m4a',
      mimeType: 'audio/mp4',
      byteSize: 2048,
      fileName: 'voice.m4a',
      durationMs: 9000,
      waveform: [0.2, 0.6],
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(chatMemberFindUnique).toHaveBeenCalledWith({
      where: {
        chatId_userId: {
          chatId: 'p1',
          userId: 'user-me',
        },
      },
      select: {
        chatId: true,
        userId: true,
      },
    });
    expect(mediaFindUnique).toHaveBeenCalledTimes(1);

    resolveMembership({ chatId: 'p1', userId: 'user-me' });

    await expect(resultPromise).resolves.toEqual({
      assetId: 'asset-existing',
      status: 'ready',
    });
  });

  it('creates chat direct upload assets with only response fields', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'asset-new',
      status: 'ready',
    });
    const client = {
      chatMember: {
        findUnique: jest.fn().mockResolvedValue({
          chatId: 'p1',
          userId: 'user-me',
        }),
      },
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue(null),
        create,
      },
    };
    const service = new UploadsService(
      { client } as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.completeChatAttachmentUpload('user-me', {
        chatId: 'p1',
        objectKey: 'chat-attachments/user-me/file.png',
        mimeType: 'image/png',
        byteSize: 2048,
        fileName: 'file.png',
      }),
    ).resolves.toEqual({
      assetId: 'asset-new',
      status: 'ready',
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          status: true,
        },
      }),
    );
  });

  it('returns an existing story upload asset when complete is retried', async () => {
    const client = {
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'story-asset-existing',
          ownerId: 'user-me',
          kind: 'story_media',
          status: 'ready',
          objectKey: 'stories/user-me/story.png',
          mimeType: 'image/png',
          byteSize: 2048,
        }),
        create: jest.fn().mockResolvedValue({
          id: 'story-asset-new',
          status: 'ready',
        }),
      },
      eventStory: {
        findUnique: jest.fn().mockResolvedValue({
          eventId: 'event-1',
        }),
      },
    };
    const storiesService = {
      assertStoryParticipant: jest.fn().mockResolvedValue(undefined),
    };
    const service = new UploadsService(
      { client } as any,
      {} as any,
      storiesService as any,
    );

    await expect(
      service.completeStoryMediaUpload('user-me', {
        eventId: 'event-1',
        objectKey: 'stories/user-me/story.png',
        mimeType: 'image/png',
        byteSize: 2048,
        fileName: 'story.png',
      }),
    ).resolves.toEqual({
      assetId: 'story-asset-existing',
      status: 'ready',
      eventId: 'event-1',
    });
    expect(client.mediaAsset.create).not.toHaveBeenCalled();
  });

  it('starts existing story asset lookup while participant check is still loading', async () => {
    let resolveParticipant!: () => void;
    const assertStoryParticipant = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveParticipant = resolve;
        }),
    );
    const mediaFindUnique = jest.fn().mockResolvedValue({
      id: 'story-asset-existing',
      ownerId: 'user-me',
      kind: 'story_media',
      status: 'ready',
      objectKey: 'stories/user-me/story.png',
      mimeType: 'image/png',
      byteSize: 2048,
    });
    const eventStoryFindUnique = jest.fn().mockResolvedValue({
      eventId: 'event-1',
    });
    const client = {
      mediaAsset: {
        findUnique: mediaFindUnique,
        create: jest.fn(),
      },
      eventStory: {
        findUnique: eventStoryFindUnique,
      },
    };
    const service = new UploadsService(
      { client } as any,
      {} as any,
      { assertStoryParticipant } as any,
    );

    const resultPromise = service.completeStoryMediaUpload('user-me', {
      eventId: 'event-1',
      objectKey: 'stories/user-me/story.png',
      mimeType: 'image/png',
      byteSize: 2048,
      fileName: 'story.png',
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(assertStoryParticipant).toHaveBeenCalledTimes(1);
    expect(mediaFindUnique).toHaveBeenCalledTimes(1);
    expect(eventStoryFindUnique).not.toHaveBeenCalled();

    resolveParticipant();

    await expect(resultPromise).resolves.toEqual({
      assetId: 'story-asset-existing',
      status: 'ready',
      eventId: 'event-1',
    });
  });

  it('rejects existing story upload assets already attached to another event', async () => {
    const client = {
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'story-asset-existing',
          ownerId: 'user-me',
          kind: 'story_media',
          status: 'ready',
          objectKey: 'stories/user-me/story.png',
          mimeType: 'image/png',
          byteSize: 2048,
        }),
        create: jest.fn(),
      },
      eventStory: {
        findUnique: jest.fn().mockResolvedValue({
          eventId: 'event-old',
        }),
      },
    };
    const storiesService = {
      assertStoryParticipant: jest.fn().mockResolvedValue(undefined),
    };
    const service = new UploadsService(
      { client } as any,
      {} as any,
      storiesService as any,
    );

    await expect(
      service.completeStoryMediaUpload('user-me', {
        eventId: 'event-new',
        objectKey: 'stories/user-me/story.png',
        mimeType: 'image/png',
        byteSize: 2048,
        fileName: 'story.png',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'upload_object_conflict',
    });
    expect(client.mediaAsset.create).not.toHaveBeenCalled();
  });

  it('rejects empty story media direct completes', async () => {
    const client = {
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'story-asset-new',
          status: 'ready',
        }),
      },
    };
    const storiesService = {
      assertStoryParticipant: jest.fn().mockResolvedValue(undefined),
    };
    const service = new UploadsService(
      { client } as any,
      {} as any,
      storiesService as any,
    );

    await expect(
      service.completeStoryMediaUpload('user-me', {
        eventId: 'event-1',
        objectKey: 'stories/user-me/story.png',
        mimeType: 'image/png',
        byteSize: 0,
        fileName: 'story.png',
      }),
    ).rejects.toMatchObject({
      code: 'invalid_story_media_size',
    });
    expect(client.mediaAsset.create).not.toHaveBeenCalled();
  });

  it('creates story direct upload assets with only response fields', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'story-asset-new',
      status: 'ready',
    });
    const storiesService = {
      assertStoryParticipant: jest.fn().mockResolvedValue(undefined),
    };
    const client = {
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue(null),
        create,
      },
    };
    const service = new UploadsService(
      { client } as any,
      {} as any,
      storiesService as any,
    );

    await expect(
      service.completeStoryMediaUpload('user-me', {
        eventId: 'event-1',
        objectKey: 'stories/user-me/story.png',
        mimeType: 'image/png',
        byteSize: 2048,
        fileName: 'story.png',
      }),
    ).resolves.toEqual({
      assetId: 'story-asset-new',
      status: 'ready',
      eventId: 'event-1',
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          status: true,
        },
      }),
    );
  });

  it('rejects empty chat voice direct completes', async () => {
    const client = {
      chatMember: {
        findUnique: jest.fn().mockResolvedValue({ chatId: 'p1', userId: 'user-me' }),
      },
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'asset-new',
          status: 'ready',
        }),
      },
    };
    const service = new UploadsService(
      { client } as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.completeChatAttachmentUpload('user-me', {
        chatId: 'p1',
        kind: 'chat_voice',
        objectKey: 'chat-attachments/user-me/voice.m4a',
        mimeType: 'audio/mp4',
        byteSize: 0,
        fileName: 'voice.m4a',
        durationMs: 9000,
        waveform: [0.2, 0.6],
      }),
    ).rejects.toMatchObject({
      code: 'invalid_chat_voice_size',
    });
    expect(client.mediaAsset.create).not.toHaveBeenCalled();
  });

  it('rejects chat attachment file uploads without a file', async () => {
    const client = {
      chatMember: {
        findUnique: jest.fn().mockResolvedValue({ chatId: 'p1', userId: 'user-me' }),
      },
    };
    const service = new UploadsService(
      { client } as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.uploadChatAttachmentFile('user-me', { chatId: 'p1' }, undefined as any),
    ).rejects.toMatchObject({
      code: 'media_file_required',
    });
  });

  it('creates chat attachment file assets with only response fields', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'asset-new',
      status: 'ready',
      publicUrl: 'https://cdn.test/chat-attachments/user-me/file.png',
    });
    const client = {
      chatMember: {
        findUnique: jest.fn().mockResolvedValue({
          chatId: 'p1',
          userId: 'user-me',
        }),
      },
      mediaAsset: {
        create,
      },
    };
    const service = new UploadsService(
      { client } as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.uploadChatAttachmentFile(
        'user-me',
        { chatId: 'p1' },
        {
          originalname: 'file.png',
          mimetype: 'image/png',
          size: 2048,
          buffer: Buffer.from('file'),
        } as Express.Multer.File,
      ),
    ).resolves.toEqual({
      assetId: 'asset-new',
      status: 'ready',
      url: 'https://cdn.test/chat-attachments/user-me/file.png',
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          status: true,
          publicUrl: true,
        },
      }),
    );
  });

  it('rejects story media file uploads without a file', async () => {
    const client = {};
    const storiesService = {
      assertStoryParticipant: jest.fn().mockResolvedValue(undefined),
    };
    const service = new UploadsService(
      { client } as any,
      {} as any,
      storiesService as any,
    );

    await expect(
      service.uploadStoryMediaFile(
        'user-me',
        { eventId: 'event-1' },
        undefined as any,
      ),
    ).rejects.toMatchObject({
      code: 'media_file_required',
    });
  });

  it('creates story media file assets with only response fields', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'story-asset-new',
      status: 'ready',
    });
    const storiesService = {
      assertStoryParticipant: jest.fn().mockResolvedValue(undefined),
    };
    const service = new UploadsService(
      {
        client: {
          mediaAsset: {
            create,
          },
        },
      } as any,
      {} as any,
      storiesService as any,
    );

    await expect(
      service.uploadStoryMediaFile(
        'user-me',
        { eventId: 'event-1' },
        {
          originalname: 'story.png',
          mimetype: 'image/png',
          size: 2048,
          buffer: Buffer.from('story'),
        } as Express.Multer.File,
      ),
    ).resolves.toEqual({
      assetId: 'story-asset-new',
      status: 'ready',
      eventId: 'event-1',
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          status: true,
        },
      }),
    );
  });
});
