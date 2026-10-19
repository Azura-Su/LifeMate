import assert from 'node:assert/strict';
import test from 'node:test';
import { shuffledDeck } from '../game-access/cards.mjs';
import {
  classify,
  canBeat,
  newTienLenGame,
  playTienLen,
  forfeitTienLen,
  forfeitTienLenPlayers,
  timeoutTienLen,
  viewTienLen,
} from '../game-access/tienlen.mjs';

function fixture(hands, extra = {}) {
  return {
    rulesVersion: 'south-v1',
    status: 'playing',
    players: hands.map((hand, i) => ({ uid: `p${i}`, hand, played: 0 })),
    turn: 'p0',
    openingCard: null,
    table: null,
    passed: [],
    finishOrder: [],
    forfeited: [],
    playedCards: [],
    stock: [],
    deadline: 30000,
    result: null,
    ...extra,
  };
}

test('shuffle uses entropy, preserves the deck and rejects biased out-of-range samples', () => {
  const deck = shuffledDeck((bytes) => bytes.fill(0));
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck).size, 52);
  assert.deepEqual(
    [...deck].sort((a, b) => a - b),
    Array.from({ length: 52 }, (_, i) => i),
  );
  let count = 0;
  const rejected = shuffledDeck((bytes) => {
    bytes.fill(count++ === 0 ? 0xffffffff : 0);
  });
  assert.equal(new Set(rejected).size, 52);
  assert.ok(count > 51);
});

test('combinations reject duplicates, invalid cards, wrapped straights and twos in runs', () => {
  for (const cards of [
    [0, 0],
    [-1],
    [52],
    [0.5],
    [0, 4, 48],
    [44, 48, 0],
    [0, 8, 12],
    [],
  ])
    assert.equal(classify(cards), null, JSON.stringify(cards));
  assert.equal(classify([0, 1]).kind, 'pair');
  assert.equal(classify([0, 1, 2]).kind, 'triple');
  assert.equal(classify([0, 1, 2, 3]).kind, 'quad');
  assert.equal(classify([0, 5, 10]).kind, 'straight');
  assert.equal(classify([0, 1, 4, 5, 8, 9]).kind, 'pairs');
});

test('comparison requires same type/length unless a permitted bomb cuts', () => {
  assert.ok(canBeat([1], [0]));
  assert.ok(!canBeat([0], [1]));
  assert.ok(!canBeat([4, 5], [0]));
  assert.ok(!canBeat([4, 8, 12, 16], [0, 4, 8]));
  const three = [0, 1, 4, 5, 8, 9],
    four = [...three, 12, 13],
    quad = [16, 17, 18, 19];
  assert.ok(canBeat(three, [51]));
  assert.ok(!canBeat(three, [50, 51]));
  assert.ok(canBeat(quad, [50, 51]));
  assert.ok(canBeat(four, [49, 50, 51]));
  assert.ok(canBeat(quad, three));
  assert.ok(canBeat(four, quad));
  assert.ok(!canBeat(four, [12]));
});

test('deal gives 13 private cards and opens on smallest dealt when 3 spades is absent', () => {
  const first = [1, 4, 5, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44];
  const second = [2, 3, 6, 7, 9, 10, 11, 13, 14, 15, 17, 18, 19];
  const deck = first.flatMap((c, i) => [c, second[i]]);
  deck.push(
    ...Array.from({ length: 52 }, (_, i) => i).filter((c) => !deck.includes(c)),
  );
  const game = newTienLenGame(['a', 'b'], deck, 100);
  assert.equal(game.players[0].hand.length, 13);
  assert.equal(game.players[1].hand.length, 13);
  assert.equal(game.stock.length, 26);
  assert.equal(game.openingCard, 1);
  assert.equal(game.turn, 'a');
  const view = viewTienLen(game, 'a');
  assert.equal(view.hand.length, 13);
  assert.ok(view.players.every((p) => !('hand' in p)));
  assert.ok(!('stock' in view));
  assert.throws(() => viewTienLen(game, 'outsider'), /member/);
});

test('opening must contain opening card and invalid actions do not mutate input', () => {
  const game = fixture(
    [
      [0, 4],
      [1, 5],
    ],
    { openingCard: 0 },
  );
  const before = structuredClone(game);
  assert.throws(
    () => playTienLen(game, 'p0', { type: 'play', cards: [4] }, 100),
    /opening/,
  );
  assert.throws(
    () => playTienLen(game, 'p1', { type: 'play', cards: [1] }, 100),
    /turn/,
  );
  assert.throws(
    () => playTienLen(game, 'p0', { type: 'play', cards: [2] }, 100),
    /ownership/,
  );
  assert.throws(() => playTienLen(game, 'p0', { type: 'pass' }, 100), /pass/);
  assert.deepEqual(game, before);
});

test('passed players stay out until the trick resets', () => {
  let game = fixture([
    [0, 12],
    [4, 16],
    [8, 20],
  ]);
  game = playTienLen(game, 'p0', { type: 'play', cards: [0] }, 100);
  game = playTienLen(game, 'p1', { type: 'pass' }, 200);
  game = playTienLen(game, 'p2', { type: 'play', cards: [8] }, 300);
  assert.equal(game.turn, 'p0');
  assert.throws(
    () => playTienLen(game, 'p1', { type: 'play', cards: [16] }, 400),
    /turn/,
  );
  game = playTienLen(game, 'p0', { type: 'pass' }, 400);
  assert.equal(game.table, null);
  assert.equal(game.turn, 'p2');
  assert.deepEqual(game.passed, []);
});

test('the next live player opens when the unbeaten trick owner has finished', () => {
  let game = fixture([[0], [4, 16], [8, 20]]);
  game = playTienLen(game, 'p0', { type: 'play', cards: [0] }, 100);
  game = playTienLen(game, 'p1', { type: 'pass' }, 200);
  game = playTienLen(game, 'p2', { type: 'pass' }, 300);
  assert.equal(game.turn, 'p1');
  assert.equal(game.table, null);
  assert.deepEqual(game.finishOrder, ['p0']);
});

test('four consecutive pairs can cut out of turn after passing, clearing the pass set', () => {
  const four = [0, 1, 4, 5, 8, 9, 12, 13];
  const game = fixture(
    [
      [16, 20],
      [24, 28],
      [...four, 32],
    ],
    {
      table: { uid: 'p1', cards: [51] },
      passed: ['p2'],
      turn: 'p0',
    },
  );
  const next = playTienLen(game, 'p2', { type: 'play', cards: four }, 100);
  assert.equal(next.table.uid, 'p2');
  assert.equal(next.turn, 'p0');
  assert.deepEqual(next.passed, []);
  assert.throws(
    () =>
      playTienLen(
        { ...game, table: { uid: 'p1', cards: [36] } },
        'p2',
        { type: 'play', cards: four },
        100,
      ),
    /turn/,
  );
});

test('finishes with the last player ranked, including a legal final two', () => {
  const game = fixture([[51], [0, 4]]);
  const next = playTienLen(game, 'p0', { type: 'play', cards: [51] }, 100);
  assert.equal(next.status, 'finished');
  assert.deepEqual(
    next.result.ranking.map((x) => [x.uid, x.rank]),
    [
      ['p0', 1],
      ['p1', 2],
    ],
  );
  assert.equal(next.turn, null);
});

test('forfeiting cannot make the leaver win and handles the current trick owner', () => {
  let game = fixture([
    [0, 4],
    [8, 12],
    [16, 20],
  ]);
  game = forfeitTienLen(game, 'p1', 100);
  assert.equal(game.status, 'playing');
  game = forfeitTienLen(game, 'p0', 200);
  assert.equal(game.status, 'finished');
  assert.deepEqual(
    game.result.ranking.map((x) => x.uid),
    ['p2', 'p0', 'p1'],
  );
  assert.throws(
    () => playTienLen(game, 'p2', { type: 'play', cards: [16] }, 300),
    /finished/,
  );
});

test('timeouts use legal moves and fresh deadlines rather than replaying overdue turns', () => {
  const game = fixture(
    [
      [4, 8],
      [0, 12],
    ],
    { openingCard: 4, deadline: 100 },
  );
  assert.equal(timeoutTienLen(game, 99), null);
  const next = timeoutTienLen(game, 90000);
  assert.deepEqual(next.table.cards, [4]);
  assert.equal(next.deadline, 120000);
  assert.equal(timeoutTienLen(next, 90001), null);
});

test('forfeiting the opener transfers the opening card to the smallest live hand', () => {
  const game = fixture(
    [
      [0, 24],
      [12, 16],
      [4, 20],
    ],
    { openingCard: 0 },
  );
  const next = forfeitTienLen(game, 'p0', 100);
  assert.equal(next.openingCard, 4);
  assert.equal(next.turn, 'p2');
  assert.deepEqual(timeoutTienLen(next, next.deadline).table.cards, [4]);
});

test('simultaneous disconnection expiry cancels rather than awarding a random win', () => {
  const next = forfeitTienLenPlayers(fixture([[0], [4]]), ['p0', 'p1'], 100);
  assert.equal(next.status, 'cancelled');
  assert.deepEqual(next.result.ranking, []);
  assert.equal(next.result.reason, 'all-disconnected');
});

test('a forfeit does not hide the last live loser remaining-card labels', () => {
  const next = forfeitTienLen(
    fixture([[], [51], [4]], { finishOrder: ['p0'], turn: 'p1' }),
    'p2',
    100,
  );
  assert.ok(
    next.result.ranking
      .find((p) => p.uid === 'p1')
      .labels.includes('remaining-twos'),
  );
});

test('instant wins use declared priority and do not rank untouched hands arbitrarily', () => {
  const dragon = Array.from({ length: 13 }, (_, i) => i * 4);
  const others = Array.from({ length: 52 }, (_, i) => i).filter(
    (x) => !dragon.includes(x),
  );
  const deck = [];
  for (let i = 0; i < 13; i++) deck.push(dragon[i], others[i]);
  deck.push(...others.slice(13));
  const game = newTienLenGame(['a', 'b'], deck, 100);
  assert.equal(game.status, 'finished');
  assert.equal(game.result.reason, 'dragon');
  assert.equal(game.result.ranking[0].uid, 'a');
});

test('random legal timeout games terminate and conserve all 52 unique cards', () => {
  for (let sample = 0; sample < 30; sample++) {
    let seed = sample + 1;
    const entropy = (bytes) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      bytes.fill(seed);
    };
    let game = newTienLenGame(['a', 'b', 'c', 'd'], shuffledDeck(entropy), 100);
    for (let step = 0; game.status === 'playing' && step < 600; step++) {
      game = timeoutTienLen(game, game.deadline);
      const cards = [
        ...game.stock,
        ...game.playedCards,
        ...game.players.flatMap((p) => p.hand),
      ];
      assert.equal(cards.length, 52);
      assert.equal(new Set(cards).size, 52);
    }
    assert.equal(game.status, 'finished');
    assert.equal(game.result.ranking.length, 4);
  }
});
