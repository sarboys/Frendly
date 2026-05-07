import { StreamableFile } from '@nestjs/common';
import { PassThrough, Readable } from 'node:stream';
import { AfficheController } from '../../src/controllers/affiche.controller';

describe('AfficheController', () => {
  it('returns a StreamableFile for proxied affiche images', async () => {
    const service = {
      getImage: jest.fn().mockResolvedValue({
        stream: Readable.from(['image-bytes']),
        mimeType: 'image/jpeg',
        contentLength: 11,
        cacheControl: 'public, max-age=86400, stale-while-revalidate=604800',
        etag: 'W/"affiche-image-test"',
      }),
    };
    const response = new PassThrough() as any;
    response.setHeader = jest.fn();
    response.status = jest.fn().mockReturnValue(response);
    response.end = jest.fn();
    response.destroy = jest.fn();
    const controller = new AfficheController(service as any);

    const result = await controller.getImage(
      'external-content/item.jpg',
      undefined,
      undefined,
      response,
    );

    expect(result).toBeInstanceOf(StreamableFile);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Length', 11);
  });
});
