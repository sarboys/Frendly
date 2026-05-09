import { TEST_ACCOUNT_PHONE_NUMBERS } from '../../src/test-accounts';
import { buildTestAccountsSeedPlan } from '../../prisma/seed-test-accounts';

describe('test accounts seed plan', () => {
  const plan = buildTestAccountsSeedPlan(new Date('2026-05-09T09:00:00.000Z'));

  it('creates exactly the ten supported test phones', () => {
    expect(plan.accounts.map((account) => account.phoneNumber)).toEqual(
      TEST_ACCOUNT_PHONE_NUMBERS,
    );
  });

  it('splits account genders evenly', () => {
    expect(plan.accounts.filter((account) => account.gender === 'male')).toHaveLength(5);
    expect(plan.accounts.filter((account) => account.gender === 'female')).toHaveLength(5);
  });

  it('attaches two gender-specific photos to every user', () => {
    for (const account of plan.accounts) {
      expect(account.photos).toHaveLength(2);
      expect(account.photos.every((photo) => photo.gender === account.gender)).toBe(true);
    }
  });

  it('creates active Frendly Plus subscriptions for every user', () => {
    expect(plan.accounts.every((account) => account.subscription.status === 'active'))
      .toBe(true);
  });

  it('creates three hosted Moscow meetups per user for today, tomorrow and after tomorrow', () => {
    expect(plan.accounts.flatMap((account) => account.events)).toHaveLength(30);

    for (const account of plan.accounts) {
      expect(account.events.map((event) => event.moscowDayOffset)).toEqual([0, 1, 2]);
      expect(account.events.every((event) => event.city === 'Москва')).toBe(true);
    }
  });

  it('creates clubs for a few account owners', () => {
    const clubs = plan.accounts.flatMap((account) => account.clubs);

    expect(clubs).toHaveLength(3);
    expect(clubs.map((club) => club.ownerUserId)).toEqual([
      'test-user-0000000000',
      'test-user-3333333333',
      'test-user-6666666666',
    ]);
  });
});
