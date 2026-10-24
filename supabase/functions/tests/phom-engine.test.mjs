import assert from 'node:assert/strict';
import test from 'node:test';
import {
  newPhomGame,
  playPhom,
  timeoutPhom,
  forfeitPhomPlayers,
  viewPhom,
} from '../game-access/phom.mjs';
import { DEFAULT_PHOM_CONFIG } from '../game-access/phom-scoring.mjs';
const card = (r, s = 0) => ((r + 10) % 13) * 4 + s;
const deck = Array.from({ length: 52 }, (_, i) => i);
const act = (game, uid, phomAction, extra = {}) =>
  playPhom(game, uid, { type: 'play', phomAction, ...extra }, 1_000);
function fixture(hand, extra = {}) {
  const game = newPhomGame(['a', 'b'], deck, 0, DEFAULT_PHOM_CONFIG);
  game.players[1].hand = hand;
  game.players[1].eaten = [];
  game.turn = 'b';
  game.step = 'draw';
  game.lastDiscard = { uid: 'a', card: card(5), chot: false };
  game.players[0].discards = [card(5)];
  return Object.assign(game, extra);
}
test('deals 9/10, hides all stock/other hands, preserves immutable input', () => {
  const game = newPhomGame(
    ['a', 'b', 'c', 'd'],
    deck,
    0,
    DEFAULT_PHOM_CONFIG,
    'b',
  );
  assert.equal(game.turn, 'b');
  assert.deepEqual(
    game.players.map((p) => p.hand.length),
    [9, 10, 9, 9],
  );
  assert.equal(game.stock.length, 15);
  const view = viewPhom(game, 'a');
  assert.equal(view.rulesVersion, 'phom-v1');
  assert.equal(view.stockCount, 15);
  assert.ok(!('stock' in view));
  assert.ok(view.players.every((p) => !('hand' in p)));
  assert.throws(() => viewPhom(game, 'x'), /not-member/);
  const before = structuredClone(game);
  act(game, 'b', 'discard', { cards: [game.players[1].hand[0]] });
  assert.deepEqual(game, before);
  assert.throws(() => act(game, 'a', 'draw'), /not-turn/);
});
test('eat must create independent phỏm, charges chốt, cannot discard eaten cards', () => {
  const game = fixture([
    card(3),
    card(4),
    card(8, 1),
    card(9, 1),
    card(11, 2),
    card(12, 2),
    card(1, 3),
    card(6, 3),
    card(10, 3),
  ]);
  game.lastDiscard.chot = true;
  const next = act(game, 'b', 'eat');
  assert.equal(next.players[0].discards.length, 0);
  assert.ok(next.players[1].eaten.includes(card(5)));
  assert.deepEqual(next.fees, [
    { from: 'a', to: 'b', kind: 'chot', amount: 4 },
  ]);
  assert.throws(
    () => act(next, 'b', 'discard', { cards: [card(5)] }),
    /invalid-combination/,
  );
  assert.throws(
    () => act(next, 'b', 'discard', { cards: [card(3)] }),
    /invalid-combination/,
  );
  assert.throws(
    () => act(fixture([card(2), card(7), card(10)]), 'b', 'eat'),
    /invalid-combination/,
  );
});
test('final turn requires lay; sending only to an earlier meld supports ù gửi', () => {
  const game = fixture(
    [card(8), card(8, 1), card(8, 2), card(6), card(13, 3)],
    { step: 'lay' },
  );
  const a = game.players[0],
    b = game.players[1];
  a.melds = [[card(3), card(4), card(5)]];
  a.laid = true;
  a.laidOrder = 0;
  game.laidCount = 1;
  b.turns = 3;
  assert.throws(
    () => act(game, 'b', 'discard', { cards: [card(13, 3)] }),
    /invalid-action/,
  );
  const laid = act(game, 'b', 'lay');
  assert.equal(laid.step, 'discard');
  const sent = act(laid, 'b', 'send', {
    cards: [card(6)],
    targetUid: 'a',
    meldIndex: 0,
  });
  assert.ok(sent.players[0].melds[0].includes(card(6)));
  assert.equal(viewPhom(sent, 'b').canU, true);
  const won = act(sent, 'b', 'u');
  assert.equal(won.result.reason, 'u');
  assert.equal(won.result.ranking[0].uid, 'b');
  assert.equal(
    act(sent, 'b', 'discard', { cards: [card(13, 3)] }).result.reason,
    'u',
  );
});
test('móm cannot send, invalid targets/melds fail and player cannot skip drawing', () => {
  const game = fixture([card(3), card(6), card(10)], { step: 'discard' });
  game.players[1].laid = true;
  game.players[1].laidOrder = 1;
  assert.throws(
    () =>
      act(game, 'b', 'send', {
        cards: [card(3)],
        targetUid: 'a',
        meldIndex: 0,
      }),
    /invalid-combination/,
  );
  assert.throws(
    () =>
      act(fixture([card(3), card(4)]), 'b', 'discard', { cards: [card(3)] }),
    /invalid-action/,
  );
  assert.throws(() => act(game, 'b', 'u'), /invalid-combination/);
});
test('batch forfeits cancel all and settle one survivor exactly once', () => {
  const game = newPhomGame(['a', 'b', 'c'], deck, 0, DEFAULT_PHOM_CONFIG);
  const cancelled = forfeitPhomPlayers(game, ['a', 'b', 'c'], 1);
  assert.equal(cancelled.status, 'cancelled');
  assert.deepEqual(cancelled.result.ranking, []);
  const finished = forfeitPhomPlayers(game, ['a', 'b'], 1);
  assert.equal(finished.result.ranking[0].uid, 'c');
  assert.equal(finished.result.ranking[0].moneyDelta, 8);
  assert.deepEqual(forfeitPhomPlayers(finished, ['c'], 2), finished);
});
test('timeout can finish 2–4 player games, conserving every card and zero sum', () => {
  for (let size = 2; size <= 4; size++)
    for (let seed = 0; seed < 8; seed++) {
      const shuffled = [...deck];
      let rng = seed + 1;
      for (let i = 51; i > 0; i--) {
        rng = (rng * 1664525 + 1013904223) >>> 0;
        const j = rng % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      let game = newPhomGame(
        ['a', 'b', 'c', 'd'].slice(0, size),
        shuffled,
        0,
        DEFAULT_PHOM_CONFIG,
      );
      for (let step = 0; game.status === 'playing' && step < 30; step++) {
        assert.equal(timeoutPhom(game, game.deadline - 1), null);
        game = timeoutPhom(game, game.deadline);
        const all = [
          ...game.stock,
          ...game.players.flatMap((p) => [
            ...p.hand,
            ...p.discards,
            ...p.melds.flat(),
          ]),
        ];
        assert.equal(all.length, 52);
        assert.equal(new Set(all).size, 52);
      }
      assert.equal(game.status, 'finished');
      assert.equal(
        game.result.ranking.reduce((s, p) => s + p.moneyDelta, 0),
        0,
      );
    }
});

test('timeout discards the highest deadwood without breaking a high set', () => {
  const kings = [card(13), card(13, 1), card(13, 2)];
  const game = fixture(
    [
      ...kings,
      card(11),
      card(1, 1),
      card(2, 2),
      card(4, 1),
      card(6, 2),
      card(8, 3),
      card(10, 2),
    ],
    { step: 'discard' },
  );
  const next = timeoutPhom(game, game.deadline);
  assert.ok(kings.every((c) => next.players[1].hand.includes(c)));
  assert.equal(next.lastDiscard.card, card(11));
});
test('engine selects feed-three liability before chốt and excludes forfeited payers', () => {
  const hand = [
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
  const game = fixture(hand, { step: 'discard' });
  game.players.push({
    uid: 'c',
    hand: [card(6, 3)],
    eaten: [],
    melds: [],
    discards: [],
    turns: 0,
    laid: false,
    laidOrder: null,
    forfeited: false,
  });
  game.players[1].eaten = [card(3), card(7, 1), card(11, 2)];
  game.eats = game.players[1].eaten.map((card) => ({
    from: 'a',
    to: 'b',
    card,
    chot: false,
  }));
  game.chotEater = 'c';
  assert.equal(act(game, 'b', 'u').penaltyUid, 'a');
  game.eats.pop();
  game.players[1].eaten.pop();
  assert.equal(act(game, 'b', 'u').penaltyUid, 'c');
  game.players[2].forfeited = true;
  const result = act(game, 'b', 'u');
  assert.equal(result.penaltyUid, null);
  assert.equal(
    result.result.ranking.find((p) => p.uid === 'c').moneyDelta,
    -DEFAULT_PHOM_CONFIG.forfeit,
  );
});
