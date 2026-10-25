import { getPhomEatHint } from '../phomCards';

it.each([
  { hand: [28, 31, 0, 4], eaten: [], discard: 29, pair: [28, 31] },
  { hand: [44, 48], eaten: [], discard: 0, pair: [44, 48] },
  { hand: [36, 40], eaten: [], discard: 44, pair: [] },
  { hand: [0, 4], eaten: [], discard: 13, pair: [] },
  { hand: [28, 31], eaten: [28], discard: 29, pair: [] },
  { hand: [28, 31], eaten: [0], discard: 29, pair: [28, 31] },
  {
    hand: [0, 4, 8, 16, 20, 24, 28, 32, 36],
    eaten: [0],
    discard: 12,
    pair: [16, 20],
  },
  {
    hand: [0, 4, 8, 16, 20, 24, 28, 31, 44],
    eaten: [0, 16],
    discard: 29,
    pair: [28, 31],
  },
  { hand: [0, 4, 8, 28, 31], eaten: [0, 28], discard: 29, pair: [] },
])(
  'suggests $pair for $discard while preserving previous eaten cards',
  ({ hand, eaten, discard, pair }) => {
    const before = JSON.stringify({ hand, eaten });
    expect(
      getPhomEatHint(Object.freeze(hand), Object.freeze(eaten), discard),
    ).toEqual(pair);
    expect(JSON.stringify({ hand, eaten })).toBe(before);
  },
);
