import assert from 'node:assert/strict';
import test from 'node:test';
import {
  newPhomGame,
  playPhom,
  timeoutPhom,
  viewPhom,
} from '../game-access/phom.mjs';
import {
  DEFAULT_PHOM_CONFIG,
  validatePhomConfig,
} from '../game-access/phom-scoring.mjs';

const card = (r, s = 0) => ((r + 10) % 13) * 4 + s;
const options = { tai: false, send: true, uDen: true };
const config = (patch = {}) => ({
  ...DEFAULT_PHOM_CONFIG,
  options: { ...options, ...patch },
});
const act = (g, uid, phomAction, extra = {}) =>
  playPhom(g, uid, { phomAction, ...extra }, 1_000);
function game(patch = {}) {
  return newPhomGame(
    ['a', 'b'],
    Array.from({ length: 52 }, (_, i) => i),
    0,
    config(patch),
  );
}
function finalEat(tai) {
  const g = game({ tai });
  const [a, b] = g.players;
  Object.assign(a, {
    hand: [card(2, 3), card(11, 3)],
    melds: [[card(8), card(9), card(10)]],
    laid: true,
    laidOrder: 0,
    turns: 4,
    discards: [card(5)],
  });
  Object.assign(b, {
    hand: [card(3), card(4), card(13, 3), card(1, 1)],
    turns: 3,
  });
  Object.assign(g, {
    turn: 'b',
    step: 'draw',
    laidCount: 1,
    lastDiscard: { uid: 'a', card: card(5), chot: true },
  });
  return g;
}
test('accepts strict boolean options, preserves legacy config and rejects partial/unknown values', () => {
  assert.deepEqual(
    validatePhomConfig(DEFAULT_PHOM_CONFIG),
    DEFAULT_PHOM_CONFIG,
  );
  assert.deepEqual(validatePhomConfig(config()), config());
  for (const invalid of [
    null,
    {},
    { ...options, tai: 1 },
    { ...options, send: 'false' },
    { ...options, extra: true },
  ])
    assert.throws(
      () => validatePhomConfig({ ...DEFAULT_PHOM_CONFIG, options: invalid }),
      /invalid-input/,
    );
});
test('send disabled rejects an otherwise legal send without mutating input', () => {
  const g = game({ send: false });
  Object.assign(g, { turn: 'b', step: 'discard' });
  Object.assign(g.players[0], {
    melds: [[card(3), card(4), card(5)]],
    laid: true,
    laidOrder: 0,
  });
  Object.assign(g.players[1], {
    hand: [card(6), card(13, 3)],
    melds: [[card(8), card(8, 1), card(8, 2)]],
    laid: true,
    laidOrder: 1,
  });
  const before = structuredClone(g);
  assert.throws(
    () =>
      act(g, 'b', 'send', { cards: [card(6)], targetUid: 'a', meldIndex: 0 }),
    /invalid-action/,
  );
  assert.deepEqual(g, before);
});
test('uDen disabled only disables replay liability, keeping mandatory feed-three debt and eat fees', () => {
  for (const feedThree of [false, true]) {
    const g = game({ tai: true, uDen: false });
    g.players.push({ ...structuredClone(g.players[0]), uid: 'c' });
    Object.assign(g, {
      turn: 'b',
      step: 'discard',
      fees: [{ from: 'a', to: 'b', kind: 'eat', amount: 1 }],
    });
    g.players[1].replayPayerUid = 'c';
    g.players[1].hand = [
      card(3),
      card(4),
      card(5),
      card(7, 1),
      card(8, 1),
      card(9, 1),
      card(11, 2),
      card(12, 2),
      card(13, 2),
      card(2, 3),
    ];
    if (feedThree)
      g.eats = [card(3), card(7, 1), card(11, 2)].map((c) => ({
        from: 'a',
        to: 'b',
        card: c,
      }));
    const won = act(g, 'b', 'u');
    assert.equal(won.penaltyUid, feedThree ? 'a' : null);
    assert.deepEqual(
      won.result.ranking.map((p) => [p.uid, p.moneyDelta]).sort(),
      [
        ['a', feedThree ? -11 : -6],
        ['b', 11],
        ['c', feedThree ? 0 : -5],
      ],
    );
    assert.equal(
      won.result.ranking.some((p) => p.labels.includes('den')),
      feedThree,
    );
  }
});
test('tai reopens the discarder in the lay round and keeps original laid melds/order', () => {
  for (const tai of [false, true]) {
    let g = act(finalEat(tai), 'b', 'eat');
    assert.equal(g.players[0].turns, tai ? 3 : 4);
    g = act(g, 'b', 'lay');
    g = act(g, 'b', 'discard', { cards: [card(13, 3)] });
    assert.equal(g.status, tai ? 'playing' : 'finished');
    if (tai) {
      assert.equal(g.turn, 'a');
      g.stock = [card(6, 2)];
      g = timeoutPhom(g, g.deadline);
      assert.equal(g.status, 'finished');
      assert.deepEqual(g.players[0].melds, [[card(8), card(9), card(10)]]);
      assert.equal(g.players[0].laidOrder, 0);
      assert.equal(
        g.result.ranking.reduce((s, p) => s + p.moneyDelta, 0),
        0,
      );
    }
  }
});
test('tai does not reopen turns before the lay round', () => {
  const g = finalEat(true);
  Object.assign(g.players[0], {
    laid: false,
    laidOrder: null,
    melds: [],
    turns: 2,
  });
  Object.assign(g, {
    laidCount: 0,
    lastDiscard: { ...g.lastDiscard, chot: false },
  });
  assert.equal(act(g, 'b', 'eat').players[0].turns, 2);
});
test('a reopened player can eat and lay an additional meld while retaining earlier eaten cards in laid melds', () => {
  const g = finalEat(true);
  const [a, b] = g.players;
  Object.assign(a, {
    turns: 3,
    hand: [card(3), card(4), card(13, 3), card(1, 1)],
    eaten: [card(8)],
  });
  Object.assign(b, { turns: 4, discards: [card(5)], laid: true, laidOrder: 1 });
  Object.assign(g, {
    turn: 'a',
    laidCount: 2,
    lastDiscard: { uid: 'b', card: card(5), chot: true },
  });
  let next = act(g, 'a', 'eat');
  assert.equal(next.step, 'lay');
  next = act(next, 'a', 'lay');
  assert.deepEqual(next.players[0].melds, [
    [card(8), card(9), card(10)],
    [card(3), card(4), card(5)],
  ]);
  assert.equal(next.players[0].laidOrder, 0);
  assert.equal(next.laidCount, 2);
  assert.equal(viewPhom(next, 'a').canU, false);
});
test('tai permits first-laid player to send to another player who has since laid', () => {
  const g = finalEat(true);
  Object.assign(g, { turn: 'a', step: 'discard' });
  Object.assign(g.players[0], { hand: [card(6), card(13, 3)], turns: 3 });
  Object.assign(g.players[1], {
    melds: [[card(3), card(4), card(5)]],
    laid: true,
    laidOrder: 1,
  });
  const sent = act(g, 'a', 'send', {
    cards: [card(6)],
    targetUid: 'b',
    meldIndex: 0,
  });
  assert.ok(sent.players[1].melds[0].includes(card(6)));
  assert.equal(sent.players[0].laidOrder, 0);
});
test('all options finish real 2–4 player deals with chained eats, timeouts, conserved cards and zero-sum scores', () => {
  let reopened = 0;
  for (let size = 2; size <= 4; size++)
    for (let seed = 1; seed <= 32; seed++) {
      let rng = seed;
      const random = () => (rng = (rng * 1664525 + 1013904223) >>> 0);
      const deck = Array.from({ length: 52 }, (_, i) => i);
      for (let i = 51; i > 0; i--) {
        const j = random() % (i + 1);
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      let g = newPhomGame(
        ['a', 'b', 'c', 'd'].slice(0, size),
        deck,
        0,
        config({ tai: !!(seed & 1), send: !!(seed & 2), uDen: !!(seed & 4) }),
      );
      for (let step = 0; g.status === 'playing' && step < 140; step++) {
        const view = viewPhom(g, g.turn);
        if (view.canEat && random() % 3 !== 0) {
          const from = g.players.find((p) => p.uid === g.lastDiscard.uid),
            turns = from.turns;
          g = act(g, g.turn, 'eat');
          if (g.players.find((p) => p.uid === from.uid).turns < turns)
            reopened++;
        } else g = timeoutPhom(g, g.deadline);
        const all = [
          ...g.stock,
          ...g.players.flatMap((p) => [
            ...p.hand,
            ...p.discards,
            ...p.melds.flat(),
          ]),
        ];
        assert.equal(all.length, 52);
        assert.equal(new Set(all).size, 52);
        for (const p of g.players) {
          assert.ok(p.turns >= 0 && p.turns <= 4);
          assert.ok(p.discards.length <= 4);
          assert.ok(p.hand.length <= 10);
          assert.ok(p.melds.length <= 3);
          assert.ok(p.eaten.length <= 3);
        }
      }
      assert.equal(g.status, 'finished', `size=${size},seed=${seed}`);
      assert.equal(
        g.result.ranking.reduce((s, p) => s + p.moneyDelta, 0),
        0,
      );
    }
  assert.ok(reopened > 0, 'reopened turns must be exercised');
});
