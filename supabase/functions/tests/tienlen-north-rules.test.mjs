import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canBeatNorth,
  classifyNorth,
  isNorthOpeningPlay,
  newTienLenNorthGame,
  playTienLenNorth,
  timeoutTienLenNorth,
  forfeitTienLenNorthPlayers,
  viewTienLenNorth,
} from '../game-access/tienlen-north.mjs';

test('North combinations enforce same-color pairs and same-suit runs', () => {
  assert.equal(classifyNorth([0]).kind, 'single');
  assert.equal(classifyNorth([0, 1]).kind, 'pair');
  assert.equal(classifyNorth([0, 2]), null);
  assert.equal(classifyNorth([0, 1, 2]).kind, 'triple');
  assert.equal(classifyNorth([0, 1, 2, 3]).kind, 'quad');
  assert.equal(classifyNorth([4, 8, 12]).kind, 'straight');
  assert.equal(classifyNorth([4, 9, 12]), null);
  assert.equal(classifyNorth([40, 44, 48]), null, '2 cannot enter a straight');
  assert.equal(classifyNorth([0, 4, 12, 16]), null);
});

test('North follows the led kind and its color/suit constraint', () => {
  assert.equal(canBeatNorth([8], [0]), true, 'higher single, same suit');
  assert.equal(canBeatNorth([9], [0]), false, 'higher single, wrong suit');
  assert.equal(canBeatNorth([4, 5], [0, 1]), true, 'higher pair, same color');
  assert.equal(canBeatNorth([6, 7], [0, 1]), false, 'pair changes color');
  assert.equal(canBeatNorth([4, 8, 12], [8, 12, 16]), false);
  assert.equal(canBeatNorth([8, 12, 16], [4, 8, 12]), true);
  assert.equal(canBeatNorth([8, 12, 16], [4, 9, 12]), false);
});

test('North twos compare by suit and a four of a kind cuts a single two', () => {
  assert.equal(canBeatNorth([51], [48]), true, '2♥ beats 2♠');
  assert.equal(canBeatNorth([48], [51]), false, '2♠ does not beat 2♥');
  assert.equal(canBeatNorth([49], [40]), true, 'any 2 beats a non-2 single');
  assert.equal(canBeatNorth([4, 5, 6, 7], [51]), true);
  assert.equal(canBeatNorth([4, 5, 6, 7], [44]), false, 'quad does not cut an ace');
  assert.equal(canBeatNorth([8, 9, 10, 11], [4, 5, 6, 7]), true);
});

test('North v2 records one cut fee event for quad over a single 2, not quad over quad', () => {
  const againstTwo = {
    rulesVersion: 'north-v2',
    status: 'playing',
    players: [
      { uid: 'a', hand: [4, 5, 6, 7, 8], played: 0 },
      { uid: 'b', hand: [51], played: 1 },
    ],
    turn: 'a',
    openingCard: null,
    table: { uid: 'b', cards: [48] },
    passed: [],
    finishOrder: [],
    forfeited: [],
    playedCards: [48],
    cutTwoEvents: [],
    stock: [],
    deadline: 40_000,
    result: null,
  };
  const cut = playTienLenNorth(
    againstTwo,
    'a',
    { type: 'play', cards: [4, 5, 6, 7] },
    1,
  );
  assert.deepEqual(cut.cutTwoEvents, [{ from: 'b', to: 'a', count: 1 }]);

  const againstQuad = {
    ...cut,
    players: [
      { uid: 'a', hand: [8, 9, 10, 11], played: 4 },
      { uid: 'b', hand: [4, 5, 6, 7], played: 4 },
    ],
    turn: 'a',
    table: { uid: 'b', cards: [4, 5, 6, 7] },
    finishOrder: [],
  };
  const higherQuad = playTienLenNorth(
    againstQuad,
    'a',
    { type: 'play', cards: [8, 9, 10, 11] },
    2,
  );
  assert.deepEqual(higherQuad.cutTwoEvents, cut.cutTwoEvents);
});

test('the opening play must be valid and contain the opening card', () => {
  const play = [0, 4, 8];
  assert.equal(isNorthOpeningPlay(play, 0), true);
  assert.equal(isNorthOpeningPlay([4, 8, 12], 0), false);
  assert.equal(isNorthOpeningPlay([0, 4], 0), false);
  assert.deepEqual(play, [0, 4, 8], 'classification does not mutate the hand');
});

test('North deal opens with 3♠ and snapshots hide opponents hands and the stock', () => {
  const game = newTienLenNorthGame(['a', 'b', 'c', 'd'], [...Array(52).keys()], 0);
  assert.deepEqual(game.players.map((player) => player.hand.length), [13, 13, 13, 13]);
  assert.equal(game.openingCard, 0);
  assert.equal(game.turn, 'a');
  const view = viewTienLenNorth(game, 'a');
  assert.equal(view.rulesVersion, 'north-v1');
  assert.equal(view.hand.length, 13);
  assert.ok(view.players.every((player) => !('hand' in player)));
  assert.ok(!('stock' in view));
  assert.throws(() => viewTienLenNorth(game, 'outsider'), /not-member/);
});

test('North rematch falls back to the opening card when prior winner left', () => {
  const game = newTienLenNorthGame(
    ['b', 'c'],
    [...Array(52).keys()],
    100,
    'a',
  );
  assert.equal(game.openingCard, 0);
  assert.equal(game.turn, 'b');
});

test('North opening move includes the lowest card and invalid moves do not mutate state', () => {
  const game = newTienLenNorthGame(['a', 'b'], [...Array(52).keys()], 0);
  const before = structuredClone(game);
  assert.throws(
    () => playTienLenNorth(game, 'a', { type: 'play', cards: [4] }, 100),
    /opening-card/,
  );
  assert.throws(
    () => playTienLenNorth(game, 'b', { type: 'play', cards: [13] }, 100),
    /wrong-turn/,
  );
  assert.deepEqual(game, before);
});

test('North pass closes a trick and the last player leads again', () => {
  const deal = [...Array(52).keys()];
  [deal[1], deal[16]] = [deal[16], deal[1]];
  let game = newTienLenNorthGame(['a', 'b'], deal, 0);
  game = playTienLenNorth(game, 'a', { type: 'play', cards: [0] }, 100);
  game = playTienLenNorth(game, 'b', { type: 'play', cards: [16] }, 200);
  game = playTienLenNorth(game, 'a', { type: 'pass' }, 300);
  assert.equal(game.table, null);
  assert.equal(game.turn, 'b');
  assert.deepEqual(game.passed, []);
});

test('North transfers the next lead when the trick owner finished their hand', () => {
  const game = {
    rulesVersion: 'north-v1',
    status: 'playing',
    players: [
      { uid: 'a', hand: [], played: 1 },
      { uid: 'b', hand: [8], played: 0 },
      { uid: 'c', hand: [12], played: 0 },
    ],
    turn: 'c',
    openingCard: null,
    table: { uid: 'a', cards: [4] },
    passed: ['b'],
    finishOrder: ['a'],
    forfeited: [],
    playedCards: [4],
    stock: [],
    deadline: 30000,
    result: null,
  };
  const next = playTienLenNorth(game, 'c', { type: 'pass' }, 500);
  assert.equal(next.table, null);
  assert.equal(next.turn, 'b');
  assert.deepEqual(next.passed, []);
});

test('North records finish order and final result without exposing opponents hands', () => {
  const game = {
    rulesVersion: 'north-v1',
    status: 'playing',
    players: [
      { uid: 'a', hand: [0], played: 0 },
      { uid: 'b', hand: [4], played: 0 },
    ],
    turn: 'a',
    openingCard: 0,
    table: null,
    passed: [],
    finishOrder: [],
    forfeited: [],
    playedCards: [],
    stock: [],
    deadline: 30000,
    result: null,
  };
  const firstOut = playTienLenNorth(game, 'a', { type: 'play', cards: [0] }, 100);
  assert.equal(firstOut.status, 'finished');
  assert.deepEqual(firstOut.finishOrder, ['a']);
  assert.deepEqual(
    firstOut.result.ranking.map((entry) => [entry.uid, entry.rank]),
    [
      ['a', 1],
      ['b', 2],
    ],
  );
});

test('North timeout passes a response or leads the required opening card', () => {
  const game = newTienLenNorthGame(['a', 'b'], [...Array(52).keys()], 0);
  assert.equal(timeoutTienLenNorth(game, game.deadline - 1), null);
  assert.equal(timeoutTienLenNorth(game, game.deadline).table.cards[0], 0);
  const response = {
    ...game,
    turn: 'b',
    openingCard: null,
    table: { uid: 'a', cards: [0] },
    deadline: 100,
  };
  const passed = timeoutTienLenNorth(response, 100);
  assert.equal(passed.table, null);
  assert.equal(passed.turn, 'a');
});

test('North forfeits are batched and all disconnected cancels the match', () => {
  const game = newTienLenNorthGame(['a', 'b', 'c'], [...Array(52).keys()], 0);
  const cancelled = forfeitTienLenNorthPlayers(game, ['a', 'b', 'c'], 1);
  assert.equal(cancelled.status, 'cancelled');
  assert.deepEqual(cancelled.result.ranking, []);
  assert.equal(forfeitTienLenNorthPlayers(cancelled, ['a'], 2).status, 'cancelled');
});

test('North timeout games conserve all cards and finish for 2–4 players', () => {
  for (let size = 2; size <= 4; size++)
    for (let seed = 1; seed <= 3; seed++) {
      const deck = [...Array(52).keys()];
      let random = seed;
      for (let i = deck.length - 1; i > 0; i--) {
        random = (random * 1664525 + 1013904223) >>> 0;
        const j = random % (i + 1);
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      let game = newTienLenNorthGame(
        ['a', 'b', 'c', 'd'].slice(0, size),
        deck,
        0,
      );
      for (let step = 0; game.status === 'playing' && step < 160; step++) {
        assert.equal(timeoutTienLenNorth(game, game.deadline - 1), null);
        game = timeoutTienLenNorth(game, game.deadline);
        const allCards = [
          ...game.stock,
          ...game.players.flatMap((player) => player.hand),
          ...game.playedCards,
        ];
        assert.equal(allCards.length, 52);
        assert.equal(new Set(allCards).size, 52);
      }
      assert.equal(game.status, 'finished');
      assert.equal(game.result.ranking.length, size);
    }
});
