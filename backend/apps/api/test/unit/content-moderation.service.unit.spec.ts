import { ContentModerationService } from '../../src/services/content-moderation.service';

describe('ContentModerationService unit', () => {
  const service = new ContentModerationService();

  it('detects blocked RU and EN bad content categories', () => {
    expect(service.check('Можно купить наркотики')).toEqual({
      reason: 'drugs',
    });
    expect(service.check('Встреча с cocaine')).toEqual({
      reason: 'drugs',
    });
  });

  it('allows normal meetup copy with similar safe words', () => {
    expect(service.check('Убийственный вечер стендапа и ужин')).toBeNull();
    expect(service.check('Встреча для новых друзей в кофейне')).toBeNull();
  });
});
