import {
  calculatePlayerTotals,
  calculateRoundTotal,
  drawCardScoreSeats,
  validatePlayerNames,
  validateRoundScores,
} from '../cardScore';

const players = [
  { id: 'a', name: 'An' },
  { id: 'b', name: 'Bình' },
  { id: 'c', name: 'Chi' },
];

it('validates 2–8 distinct named players after trimming', () => {
  expect(validatePlayerNames(['An', ' Bình '])).toBeNull();
  expect(validatePlayerNames(['An'])).toContain('ít nhất 2');
  expect(validatePlayerNames(['An', ' An '])).toContain('trùng');
  expect(validatePlayerNames(['An', ''])).toContain('tên');
  expect(
    validatePlayerNames(Array.from({ length: 9 }, (_, i) => `P${i}`)),
  ).toContain('tối đa');
});

it('derives totals from editable signed round scores', () => {
  const rounds = [
    { id: 'r1', createdAt: 1, scores: { a: 10, b: -5, c: 0 } },
    { id: 'r2', createdAt: 2, scores: { a: -3, b: 12, c: -2 } },
  ];
  expect(calculatePlayerTotals(players, rounds)).toEqual({ a: 7, b: 7, c: -2 });
  expect(calculateRoundTotal(players, rounds[0])).toBe(5);
  expect(
    calculateRoundTotal(players.slice(0, 2), {
      id: 'balanced',
      createdAt: 3,
      scores: { a: 9, b: -9 },
    }),
  ).toBe(0);
  expect(validateRoundScores(['a', 'b'], { a: '-20', b: '+3' })).toEqual({
    scores: { a: -20, b: 3 },
  });
  expect(validateRoundScores(['a'], { a: '1.5' })).toHaveProperty('error');
  expect(validateRoundScores(['a'], { a: '' })).toHaveProperty('error');
});

it('draws each seat once and sets the first drawn player as dealer', () => {
  const draw = drawCardScoreSeats(players, () => 0);
  expect(draw.seatOrder).toEqual(['b', 'c', 'a']);
  expect(draw.dealerPlayerId).toBe(draw.seatOrder[0]);
  expect(new Set(draw.seatOrder)).toEqual(new Set(players.map(({ id }) => id)));
});
