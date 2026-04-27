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
});
