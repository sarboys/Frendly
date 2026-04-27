import { MediaService } from '../../src/services/media.service';

async function readStream(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];

  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
}

describe('MediaService', () => {
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

    expect(media.contentLength).toBe(4);
    expect(media.contentRange).toBe('bytes 6-9/10');
    await expect(readStream(media.stream)).resolves.toBe('6789');
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

    expect(media.contentLength).toBe(4);
    expect(media.contentRange).toBe('bytes 6-9/10');
    await expect(readStream(media.stream)).resolves.toBe('6789');
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
});
