import { normalizeDuplicateSlashesInPath } from '../../src/common/normalize-request-url';

describe('normalizeDuplicateSlashesInPath', () => {
  it('collapses duplicate slashes before query params', () => {
    expect(
      normalizeDuplicateSlashesInPath(
        '//affiche/images?key=external-content%2Fitem.jpg',
      ),
    ).toBe('/affiche/images?key=external-content%2Fitem.jpg');
  });

  it('keeps query value slashes untouched', () => {
    expect(
      normalizeDuplicateSlashesInPath(
        '/affiche/images?url=https%3A%2F%2Fmedia.ticketland.ru%2Fimage.jpg',
      ),
    ).toBe(
      '/affiche/images?url=https%3A%2F%2Fmedia.ticketland.ru%2Fimage.jpg',
    );
  });
});
