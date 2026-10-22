import type { CardGameRoom } from '../../../types/cardGame';
import {
  getConfirmedPasses,
  getHandStackLayout,
  getSecondsRemaining,
} from '../cardTableMotion';

const before: CardGameRoom = {
  id: 'motion-room',
  code: 'ABCDEFGH',
  version: 8,
  epoch: 'epoch',
  matchId: 'motion-match',
  phase: 'playing',
  host: 'a',
  controller: true,
  topic: 'topic',
  members: [
    { uid: 'a', name: 'An', ready: false, wins: 0 },
    { uid: 'b', name: 'Bình', ready: false, wins: 0 },
  ],
  game: {
    rulesVersion: 'south-v1',
    status: 'playing',
    hand: [4, 5],
    players: [
      { uid: 'a', count: 2, finished: false, forfeited: false },
      { uid: 'b', count: 3, finished: false, forfeited: false },
    ],
    turn: 'a',
    table: { uid: 'b', cards: [0] },
    passed: [],
    openingCard: null,
    deadline: 40000,
    result: null,
  },
};
const cleared: CardGameRoom = {
  ...before,
  version: 9,
  game: {
    ...before.game!,
    table: null,
    passed: [],
    turn: 'b',
    deadline: 80000,
  },
};

it('recognizes the confirmed final pass even when the server resets passed', () => {
  expect(getConfirmedPasses(before, cleared)).toEqual(['a']);
  expect(getConfirmedPasses(cleared, cleared)).toEqual([]);
});

it('does not infer a pass after missing snapshots, a new match, or a forfeit', () => {
  expect(getConfirmedPasses(before, { ...cleared, version: 10 })).toEqual([]);
  expect(
    getConfirmedPasses(before, { ...cleared, matchId: 'another' }),
  ).toEqual([]);
  expect(getConfirmedPasses(null, cleared)).toEqual([]);
  expect(
    getConfirmedPasses(before, {
      ...cleared,
      game: {
        ...cleared.game!,
        players: cleared.game!.players.map((p) =>
          p.uid === 'a' ? { ...p, forfeited: true } : p,
        ),
      },
    }),
  ).toEqual([]);
  expect(
    getConfirmedPasses(before, {
      ...cleared,
      game: { ...cleared.game!, players: [...cleared.game!.players].reverse() },
    }),
  ).toEqual([]);
});

it('keeps every newly confirmed passer when several snapshots were coalesced', () => {
  const four = {
    ...before,
    game: {
      ...before.game!,
      players: [
        ...before.game!.players,
        { uid: 'c', count: 3, finished: false, forfeited: false },
        { uid: 'd', count: 3, finished: false, forfeited: false },
      ],
    },
  };
  expect(
    getConfirmedPasses(four, {
      ...four,
      version: 11,
      game: { ...four.game!, passed: ['a', 'c'] },
    }),
  ).toEqual(['a', 'c']);
});

it.each([280, 300, 344, 420])(
  'fits 13 cards inside a %i point hand slot',
  (width) => {
    const layout = getHandStackLayout(width, 13);
    expect(layout.cardWidth * 13 - layout.overlap * 12).toBeLessThanOrEqual(
      width,
    );
    expect(layout.compact).toBe(width < 344);
  },
);

it('keeps a short hand spaced and centered by its container', () => {
  expect(getHandStackLayout(350, 3).overlap).toBe(0);
});

it('uses the fresh server clock even before the next local render tick', () => {
  expect(getSecondsRemaining(70000, 50000, 10000, 9000)).toBe(20);
  expect(getSecondsRemaining(70000, 50000, 10000, 13500)).toBe(17);
  expect(getSecondsRemaining(70000, 50000, 10000, 40000)).toBe(0);
});
