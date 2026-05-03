import { MediaService } from '../../src/services/media.service';
import { signAccessToken } from '@big-break/database';

async function readStream(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];

  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
}

describe('MediaService', () => {
  afterEach(() => {
    delete process.env.MEDIA_PROXY_STREAMING_ENABLED;
  });

  it('serves suffix byte ranges from the end of inline media', async () => {
    const payload = Buffer.from('0123456789').toString('base64');
    const client = {
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'asset-1',
          status: 'ready',
          ownerId: 'user-owner',
          kind: 'avatar',
          chatId: null,
          bucket: 'media',
          objectKey: 'avatars/user-owner/avatar.jpg',
          publicUrl: `data:text/plain;base64,${payload}`,
          mimeType: 'text/plain',
          byteSize: 10,
        }),
      },
    };
    const service = new MediaService({ client } as any);

    const media = await service.getAsset('asset-1', 'bytes=-4');
    const streamMedia = media as any;

    expect(streamMedia.contentLength).toBe(4);
    expect(streamMedia.contentRange).toBe('bytes 6-9/10');
    await expect(readStream(streamMedia.stream)).resolves.toBe('6789');
  });

  it('clamps oversized byte range ends to the asset size', async () => {
    const payload = Buffer.from('0123456789').toString('base64');
    const client = {
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'asset-1',
          status: 'ready',
          ownerId: 'user-owner',
          kind: 'avatar',
          chatId: null,
          bucket: 'media',
          objectKey: 'avatars/user-owner/avatar.jpg',
          publicUrl: `data:text/plain;base64,${payload}`,
          mimeType: 'text/plain',
          byteSize: 10,
        }),
      },
    };
    const service = new MediaService({ client } as any);

    const media = await service.getAsset('asset-1', 'bytes=6-999999');
    const streamMedia = media as any;

    expect(streamMedia.contentLength).toBe(4);
    expect(streamMedia.contentRange).toBe('bytes 6-9/10');
    await expect(readStream(streamMedia.stream)).resolves.toBe('6789');
  });

  it('redirects private S3 media to a signed url by default', async () => {
    const s3Send = jest.fn();
    const client = {
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'asset-1',
          status: 'ready',
          ownerId: 'user-owner',
          kind: 'chat_voice',
          chatId: null,
          bucket: 'media',
          objectKey: 'chat-attachments/user-owner/voice.m4a',
          publicUrl: null,
          mimeType: 'audio/mp4',
          byteSize: 100,
        }),
      },
      session: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 'user-owner',
          revokedAt: null,
        }),
      },
    };
    const service = new MediaService({ client } as any);
    (service as any).s3 = { send: s3Send };

    const media = await service.getAsset(
      'asset-1',
      undefined,
      `Bearer ${signAccessToken('user-owner', 'session-1')}`,
    );

    expect(media).toEqual(
      expect.objectContaining({
        redirectUrl: expect.stringContaining('X-Amz-Signature='),
        cacheControl: 'private, max-age=300',
      }),
    );
    expect(s3Send).not.toHaveBeenCalled();
  });

  it('denies direct chat media download when the peer is blocked', async () => {
    const client = {
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'asset-1',
          status: 'ready',
          ownerId: 'user-owner',
          kind: 'chat_attachment',
          chatId: 'chat-1',
          objectKey: 'chat-attachments/user-owner/file.pdf',
          publicUrl: null,
          mimeType: 'application/pdf',
          byteSize: 100,
        }),
      },
      chatMember: {
        findUnique: jest.fn().mockResolvedValue({ id: 'member-1' }),
      },
      userBlock: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'user-viewer',
            blockedUserId: 'user-owner',
          },
        ]),
      },
    };
    const service = new MediaService({ client } as any);

    await expect(
      service.getDownloadUrl('user-viewer', 'asset-1'),
    ).rejects.toMatchObject({
      code: 'media_forbidden',
    });
  });

  it('starts block lookup while chat media membership is still loading', async () => {
    let resolveMembership!: (value: any) => void;
    const chatMemberFindUnique = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveMembership = resolve;
        }),
    );
    const userBlockFindMany = jest.fn().mockResolvedValue([]);
    const service = new MediaService({
      client: {
        chatMember: {
          findUnique: chatMemberFindUnique,
        },
        userBlock: {
          findMany: userBlockFindMany,
        },
      },
    } as any);

    const resultPromise = (service as any).resolveAssetAccess(
      {
        id: 'asset-1',
        ownerId: 'user-owner',
        kind: 'chat_attachment',
        chatId: 'chat-1',
      },
      'user-viewer',
    );

    await new Promise((resolve) => setImmediate(resolve));

    expect(chatMemberFindUnique).toHaveBeenCalledTimes(1);
    expect(userBlockFindMany).toHaveBeenCalledTimes(1);

    resolveMembership({
      chat: {
        kind: 'direct',
        event: null,
      },
    });

    await expect(resultPromise).resolves.toEqual({ visibility: 'private' });
  });

  it('denies story media download when the story author is blocked', async () => {
    const client = {
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'asset-1',
          status: 'ready',
          ownerId: 'user-owner',
          kind: 'story_media',
          chatId: null,
          objectKey: 'stories/user-owner/story.png',
          publicUrl: null,
          mimeType: 'image/png',
          byteSize: 100,
        }),
      },
      eventStory: {
        findFirst: jest.fn().mockResolvedValue({
          eventId: 'event-1',
          event: {
            hostId: 'host-1',
          },
        }),
      },
      eventParticipant: {
        findUnique: jest.fn().mockResolvedValue({ id: 'participant-1' }),
      },
      userBlock: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'user-viewer',
            blockedUserId: 'user-owner',
          },
        ]),
      },
    };
    const service = new MediaService({ client } as any);

    await expect(
      service.getDownloadUrl('user-viewer', 'asset-1'),
    ).rejects.toMatchObject({
      code: 'media_forbidden',
    });
  });

  it('checks story media participation in the story lookup', async () => {
    const eventStoryFindFirst = jest.fn().mockResolvedValue({
      eventId: 'event-1',
      event: {
        hostId: 'host-1',
      },
    });
    const eventParticipantFindUnique = jest.fn();
    const service = new MediaService({
      client: {
        eventStory: {
          findFirst: eventStoryFindFirst,
        },
        eventParticipant: {
          findUnique: eventParticipantFindUnique,
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as any);

    await expect(
      (service as any).resolveAssetAccess(
        {
          id: 'asset-1',
          ownerId: 'user-owner',
          kind: 'story_media',
          chatId: null,
        },
        'user-viewer',
      ),
    ).resolves.toEqual({ visibility: 'private' });

    expect(eventStoryFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          mediaAssetId: 'asset-1',
          event: {
            participants: {
              some: {
                userId: 'user-viewer',
              },
            },
          },
        },
      }),
    );
    expect(eventParticipantFindUnique).not.toHaveBeenCalled();
  });
});
