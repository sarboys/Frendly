import { shiftSeedDate, shiftSeedDatesIntoFuture } from '../../src/seed-dates';

describe('seed date helpers', () => {
  it('keeps seeded upcoming dates ahead of the current day', () => {
    const offsetMs = shiftSeedDatesIntoFuture(
      new Date('2026-05-03T00:00:00.000Z'),
    );

    expect(shiftSeedDate(new Date('2026-04-19T20:00:00.000Z'), offsetMs).getTime())
      .toBeGreaterThan(new Date('2026-05-03T00:00:00.000Z').getTime());
  });
});
