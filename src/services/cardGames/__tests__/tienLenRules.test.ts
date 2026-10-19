import type { TienLenView } from '../../../types/cardGame';
import {
  canBeatTienLen,
  canPlayTienLenSelection,
  classifyTienLen,
} from '../tienLenRules';

const game = (patch: Partial<TienLenView> = {}): TienLenView => ({
  rulesVersion: 'south-v1',
  status: 'playing',
  hand: [4, 5, 8, 9, 12, 13, 16, 17, 20, 21],
  players: [
    { uid: 'a', count: 10, finished: false, forfeited: false },
    { uid: 'b', count: 12, finished: false, forfeited: false },
  ],
  turn: 'a',
  table: { uid: 'b', cards: [0] },
  passed: [],
  openingCard: null,
  deadline: Date.now() + 30_000,
  result: null,
  ...patch,
});

it('classifies every south-v1 combination and rejects malformed sets', () => {
  expect(classifyTienLen([0])).toMatchObject({ kind: 'single' });
  expect(classifyTienLen([0, 1])).toMatchObject({ kind: 'pair' });
  expect(classifyTienLen([0, 1, 2])).toMatchObject({ kind: 'triple' });
  expect(classifyTienLen([0, 1, 2, 3])).toMatchObject({ kind: 'quad' });
  expect(classifyTienLen([0, 5, 10])).toMatchObject({ kind: 'straight' });
  expect(classifyTienLen([0, 1, 4, 5, 8, 9])).toMatchObject({
    kind: 'pairs',
  });
  expect(classifyTienLen([0, 0])).toBeNull();
  expect(classifyTienLen([0, 4, 48])).toBeNull();
  expect(classifyTienLen([4, 5, 8])).toBeNull();
});

it('matches same-size plays and the configured bomb hierarchy', () => {
  const threePairs = [0, 1, 4, 5, 8, 9];
  const fourPairs = [...threePairs, 12, 13];
  const quad = [16, 17, 18, 19];
  expect(canBeatTienLen([4], [0])).toBe(true);
  expect(canBeatTienLen([4, 5], [0])).toBe(false);
  expect(canBeatTienLen(threePairs, [51])).toBe(true);
  expect(canBeatTienLen(threePairs, [50, 51])).toBe(false);
  expect(canBeatTienLen(quad, [50, 51])).toBe(true);
  expect(canBeatTienLen(fourPairs, quad)).toBe(true);
  expect(canBeatTienLen(fourPairs, [12])).toBe(false);
});

it('only enables selections that the server can accept in the current state', () => {
  const current = game();
  expect(canPlayTienLenSelection([4], current, 'a')).toBe(true);
  expect(canPlayTienLenSelection([4, 5], current, 'a')).toBe(false);
  expect(canPlayTienLenSelection([0], current, 'a')).toBe(false);
  expect(canPlayTienLenSelection([4, 6], current, 'a')).toBe(false);
  expect(
    canPlayTienLenSelection(
      [4],
      game({ table: null, openingCard: 5 }),
      'a',
    ),
  ).toBe(false);
  expect(
    canPlayTienLenSelection(
      [4, 5],
      game({ table: null, openingCard: 5 }),
      'a',
    ),
  ).toBe(true);
});

it('allows an out-of-turn interrupt only for a legal four-pair cut', () => {
  const fourPairs = [4, 5, 8, 9, 12, 13, 16, 17];
  const waiting = game({
    hand: [...fourPairs, 20, 21],
    turn: 'b',
    table: { uid: 'b', cards: [51] },
    passed: ['a'],
  });
  expect(canPlayTienLenSelection(fourPairs, waiting, 'a')).toBe(true);
  expect(
    canPlayTienLenSelection([4, 5, 8, 9, 12, 13, 16, 20], waiting, 'a'),
  ).toBe(false);
  expect(canPlayTienLenSelection([20], waiting, 'a')).toBe(false);
});
