import {
  buildSeededTestAccountIds,
  TEST_ACCOUNT_PHONE_NUMBERS,
  isSeededTestAccountPhoneNumber,
} from '../../src/test-accounts';

describe('test account helpers', () => {
  it('keeps exactly ten repeated-digit Russian test phones', () => {
    expect(TEST_ACCOUNT_PHONE_NUMBERS).toEqual([
      '+70000000000',
      '+71111111111',
      '+72222222222',
      '+73333333333',
      '+74444444444',
      '+75555555555',
      '+76666666666',
      '+77777777777',
      '+78888888888',
      '+79999999999',
    ]);
  });

  it('matches only the seeded test account phone set', () => {
    expect(isSeededTestAccountPhoneNumber('+70000000000')).toBe(true);
    expect(isSeededTestAccountPhoneNumber('+79999999999')).toBe(true);
    expect(isSeededTestAccountPhoneNumber('+79876543210')).toBe(false);
  });

  it('builds stable ids from phone suffixes', () => {
    expect(buildSeededTestAccountIds().slice(0, 2)).toEqual([
      'test-user-0000000000',
      'test-user-1111111111',
    ]);
  });
});
