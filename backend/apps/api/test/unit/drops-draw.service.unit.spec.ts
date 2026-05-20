import { DropsDrawService } from '../../src/services/drops-draw.service';

describe('DropsDrawService unit', () => {
  it('orders tickets deterministically from seed, drop and ticket code', () => {
    const tickets = [
      { id: 'ticket-1', code: 'A8F92', userId: 'user-1' },
      { id: 'ticket-2', code: 'C19K2', userId: 'user-2' },
      { id: 'ticket-3', code: 'P7L01', userId: 'user-3' },
    ];

    const first = DropsDrawService.orderTicketsForDraw(
      'secret-seed',
      'drop-1',
      tickets,
    );
    const second = DropsDrawService.orderTicketsForDraw(
      'secret-seed',
      'drop-1',
      [...tickets].reverse(),
    );

    expect(first).toEqual(second);
    expect(first.map((ticket: { id: string }) => ticket.id)).toEqual([
      'ticket-1',
      'ticket-3',
      'ticket-2',
    ]);
  });

  it('builds a public seed hash without exposing the secret seed', () => {
    expect(DropsDrawService.hashSeed('secret-seed')).toBe(
      '46015ded33413621dacd04c2b7d0e87458df7cdaea6354298e504f5f5f50308d',
    );
  });
});
