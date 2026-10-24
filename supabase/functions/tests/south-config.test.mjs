import assert from 'node:assert/strict';
import test from 'node:test';
import {
  newTienLenGame,
  playTienLen,
  forfeitTienLenPlayers,
  viewTienLen,
  timeoutTienLen,
} from '../game-access/tienlen.mjs';
import {
  settleConfiguredSouth,
  validateSouthConfig,
} from '../game-access/tienlen-scoring.mjs';
import { updateRoom } from '../game-access/rooms.mjs';

const config = { finishMode: 'first-winner', cutTwoAmount: 7 };
function fixture(hands, extra = {}) {
  return {
    rulesVersion: 'south-v2',
    southConfig: config,
    cutTwoFees: [],
    status: 'playing',
    players: hands.map((hand, i) => ({ uid: `p${i}`, hand, played: 1 })),
    turn: 'p0',
    openingCard: null,
    table: null,
    passed: [],
    finishOrder: [],
    forfeited: [],
    cong: [],
    playedCards: [],
    stock: [],
    deadline: 40000,
    result: null,
    ...extra,
  };
}
test('configured South pins settings while default games retain the legacy projection', () => {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  const old = newTienLenGame(['a', 'b'], deck, 0);
  assert.equal(old.rulesVersion, 'south-v1');
  assert.equal('southConfig' in viewTienLen(old, 'a'), false);
  const next = newTienLenGame(['a', 'b'], deck, 0, null, config);
  assert.equal(next.rulesVersion, 'south-v2');
  assert.deepEqual(next.southConfig, config);
  assert.deepEqual(viewTienLen(next, 'a').southConfig, config);
  assert.notEqual(next.southConfig, config);
});
test('first-winner stops immediately, ties remaining players and preserves all private hands', () => {
  const game = fixture([[0], [4, 8], [12, 16], [20, 24]]);
  const result = playTienLen(game, 'p0', { type: 'play', cards: [0] }, 1);
  assert.equal(result.status, 'finished');
  assert.equal(result.result.reason, 'first-winner');
  assert.deepEqual(
    result.result.ranking.map((p) => p.rank),
    [1, 2, 2, 2],
  );
  assert.deepEqual(
    result.players.map((p) => p.hand.length),
    [0, 2, 2, 2],
  );
  assert.equal(game.players[0].hand.length, 1);
  assert.equal(
    viewTienLen(result, 'p1').players.some((p) => 'hand' in p),
    false,
  );
});
test('continue mode still plays after the first finish and default zero fees do not alter it', () => {
  const game = fixture([[0], [4, 8], [12]], {
    southConfig: { finishMode: 'continue', cutTwoAmount: 3 },
  });
  const next = playTienLen(game, 'p0', { type: 'play', cards: [0] }, 1);
  assert.equal(next.status, 'playing');
  assert.deepEqual(next.finishOrder, ['p0']);
});
test('winning chop charges each two once before closing the round and room adds fees to card penalties', () => {
  const game = fixture(
    [
      [0, 1, 2, 3],
      [8, 12],
      [16, 20],
    ],
    { table: { uid: 'p1', cards: [50, 51] }, playedCards: [50, 51] },
  );
  const next = playTienLen(
    game,
    'p0',
    { type: 'play', cards: [0, 1, 2, 3] },
    1,
  );
  assert.equal(next.status, 'finished');
  assert.deepEqual(next.cutTwoFees, [
    { from: 'p1', to: 'p0', count: 2, amount: 14 },
  ]);
  const room = {
    phase: 'playing',
    host: 'p0',
    ownerUid: 'p0',
    southConfig: config,
    amountPerCard: 5,
    members: game.players.map((p) => ({
      uid: p.uid,
      name: p.uid,
      ready: false,
      wins: 0,
      balance: 0,
    })),
    game,
  };
  const settled = updateRoom(
    room,
    'p0',
    { type: 'play', cards: [0, 1, 2, 3] },
    1,
  );
  assert.deepEqual(
    settled.game.result.ranking.map((p) => p.moneyDelta),
    [34, -24, -10],
  );
  assert.equal(
    settled.members.reduce((s, p) => s + p.balance, 0),
    0,
  );
  assert.ok(
    settled.game.result.ranking[1].breakdown.some(
      (b) => b.kind === 'cut-two' && b.amount === -14,
    ),
  );
});
test('a four-pair interrupt charges three twos, but a higher two and a bomb-over-bomb do not', () => {
  const cards = [0, 1, 4, 5, 8, 9, 12, 13];
  const game = fixture(
    [
      [...cards, 20],
      [24, 28],
      [32, 36],
    ],
    { turn: 'p2', passed: ['p0'], table: { uid: 'p1', cards: [49, 50, 51] } },
  );
  const next = playTienLen(game, 'p0', { type: 'play', cards }, 1);
  assert.deepEqual(next.cutTwoFees, [
    { from: 'p1', to: 'p0', count: 3, amount: 21 },
  ]);
  assert.deepEqual(
    playTienLen(
      fixture([[51, 0], [4]], { table: { uid: 'p1', cards: [48] } }),
      'p0',
      { type: 'play', cards: [51] },
      1,
    ).cutTwoFees,
    [],
  );
  assert.deepEqual(
    playTienLen(
      fixture([[...cards, 20], [24]], {
        table: { uid: 'p1', cards: [16, 17, 18, 19] },
      }),
      'p0',
      { type: 'play', cards },
      1,
    ).cutTwoFees,
    [],
  );
});
test('chop fees include an already finished player and cancel with an all-disconnected round', () => {
  const game = fixture([[0, 1, 2, 3, 8], [], [12, 16]], {
    southConfig: { finishMode: 'continue', cutTwoAmount: 7 },
    finishOrder: ['p1'],
    table: { uid: 'p1', cards: [51] },
  });
  const chopped = playTienLen(
    game,
    'p0',
    { type: 'play', cards: [0, 1, 2, 3] },
    1,
  );
  assert.equal(chopped.cutTwoFees[0].from, 'p1');
  const active = fixture([[0], [4]], {
    cutTwoFees: [{ from: 'p0', to: 'p1', count: 1, amount: 7 }],
  });
  const cancelled = forfeitTienLenPlayers(active, ['p0', 'p1'], 1);
  assert.equal(cancelled.status, 'cancelled');
  assert.deepEqual(cancelled.result.ranking, []);
});

test('configured modes complete 2–4 player timeout games without losing or revealing cards', () => {
  for (const finishMode of ['continue', 'first-winner'])
    for (const count of [2, 3, 4]) {
      const deck = Array.from({ length: 52 }, (_, i) =>
        i < 48 ? (i % 4) * 12 + Math.floor(i / 4) : i,
      );
      let game = newTienLenGame(
        Array.from({ length: count }, (_, i) => `p${i}`),
        deck,
        0,
        null,
        { finishMode, cutTwoAmount: 7 },
      );
      let turns = 0;
      while (game.status === 'playing') {
        assert.ok(++turns < 1000);
        game = timeoutTienLen(game, game.deadline);
        const cards = [
          ...game.stock,
          ...game.playedCards,
          ...game.players.flatMap((p) => p.hand),
        ];
        assert.equal(cards.length, 52);
        assert.equal(new Set(cards).size, 52);
      }
      settleConfiguredSouth(game, 5);
      assert.equal(
        game.result.ranking.reduce((s, p) => s + p.moneyDelta, 0),
        0,
      );
    }
});
test('fees can outweigh the card penalty for a loser and a prior winner pays for a cut', () => {
  const game = fixture([[], [4], [8]], {
    southConfig: { finishMode: 'continue', cutTwoAmount: 50 },
    finishOrder: ['p0'],
    cutTwoFees: [{ from: 'p0', to: 'p1', count: 1, amount: 50 }],
  });
  game.result = {
    ranking: [
      { uid: 'p0', rank: 1, labels: [], remainingCards: 0 },
      { uid: 'p1', rank: 2, labels: [], remainingCards: 1 },
      { uid: 'p2', rank: 3, labels: [], remainingCards: 1 },
    ],
  };
  settleConfiguredSouth(game, 5);
  assert.deepEqual(
    game.result.ranking.map((p) => p.moneyDelta),
    [-40, 45, -5],
  );
  for (const invalid of [
    null,
    [],
    {},
    { ...config, cutTwoAmount: -1 },
    { ...config, cutTwoAmount: 1.5 },
    { ...config, cutTwoAmount: 1e9 + 1 },
    { ...config, unknown: 1 },
  ])
    assert.throws(() => validateSouthConfig(invalid), /invalid-input/);
});

test('next-round South settings are promoted only when dealing, including default and instant finish', () => {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (const nextConfig of [
    config,
    { finishMode: 'continue', cutTwoAmount: 0 },
  ]) {
    const state = {
      host: 'p0',
      ownerUid: 'p0',
      phase: 'lobby',
      amountPerCard: 3,
      southConfig: config,
      nextSouthRules: { amountPerCard: 99, southConfig: nextConfig },
      members: ['p0', 'p1'].map((uid) => ({
        uid,
        name: uid,
        ready: true,
        wins: 0,
      })),
      game: null,
    };
    const started = updateRoom(state, 'p0', { type: 'start' }, 1, deck);
    assert.equal(started.amountPerCard, 99);
    assert.equal(
      started.game.rulesVersion,
      nextConfig.finishMode === 'continue' ? 'south-v1' : 'south-v2',
    );
    assert.deepEqual(
      started.southConfig,
      nextConfig.finishMode === 'continue' ? undefined : nextConfig,
    );
    assert.deepEqual(started.nextSouthRules, state.nextSouthRules);
    assert.equal(state.amountPerCard, 3);
    const rematch = updateRoom(
      { ...state, phase: 'finished' },
      'p0',
      { type: 'ready', ready: true },
      1,
      deck,
    );
    assert.equal(rematch.amountPerCard, 99);
    assert.equal(rematch.game.rulesVersion, started.game.rulesVersion);
  }
  // Four twos guarantee an instant finish at deal time.
  const a = [48, 49, 50, 51, 0, 4, 8, 12, 16, 20, 24, 28, 32];
  const b = deck.filter((c) => !a.includes(c)).slice(0, 13);
  const instantDeck = a.flatMap((c, i) => [c, b[i]]);
  instantDeck.push(...deck.filter((c) => !instantDeck.includes(c)));
  const state = {
    host: 'p0',
    phase: 'lobby',
    amountPerCard: 3,
    nextSouthRules: { amountPerCard: 9, southConfig: config },
    members: ['p0', 'p1'].map((uid) => ({
      uid,
      name: uid,
      ready: true,
      wins: 0,
    })),
    game: null,
  };
  const result = updateRoom(state, 'p0', { type: 'start' }, 1, instantDeck);
  assert.equal(result.phase, 'finished');
  assert.deepEqual(
    result.game.result.ranking.map((p) => p.moneyDelta),
    [117, -117],
  );
});

test('pending rules never change ongoing settlement, forfeit or timeout', () => {
  const state = {
    host: 'p0',
    phase: 'playing',
    amountPerCard: 3,
    southConfig: config,
    nextSouthRules: {
      amountPerCard: 999,
      southConfig: { finishMode: 'continue', cutTwoAmount: 999 },
    },
    members: ['p0', 'p1'].map((uid) => ({
      uid,
      name: uid,
      ready: false,
      wins: 0,
    })),
    game: fixture([[0], [4, 8]]),
  };
  const finished = updateRoom(state, 'p0', { type: 'play', cards: [0] }, 1);
  assert.deepEqual(
    finished.game.result.ranking.map((p) => p.moneyDelta),
    [6, -6],
  );
  const forfeited = updateRoom(state, 'p1', { type: 'leave' }, 1);
  assert.deepEqual(
    forfeited.game.result.ranking.map((p) => p.moneyDelta),
    [6, -6],
  );
  assert.equal(state.amountPerCard, 3);
});
