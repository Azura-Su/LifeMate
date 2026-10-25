import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canDefendTan,
  newTanGame,
  actTan,
  timeoutTan,
  viewTan,
  forfeitTanPlayers,
} from '../game-access/tan.mjs';

const fullDeck = () => Array.from({ length: 52 }, (_, index) => index);

function gameWithHands(hands, stock = [40, 41, 42, 43, 44, 45, 46, 47, 48]) {
  const requestedHands = hands.map((hand) => [...hand]);
  const paddedHands = hands.map((hand) => [...hand]);
  const used = new Set(hands.flat());
  for (const hand of paddedHands)
    while (hand.length < 8) {
      const card = [...Array(52).keys()].find((candidate) => !used.has(candidate));
      used.add(card);
      hand.push(card);
    }
  const upcard = [...Array(52).keys()].find((card) => !used.has(card));
  used.add(upcard);
  const rest = [...Array(52).keys()].filter((card) => !used.has(card));
  const deck = paddedHands[0].flatMap((_, index) => paddedHands.flatMap((hand) => [hand[index]]));
  const ordered = [...deck, upcard, ...rest];
  const state = newTanGame(hands.map((_, index) => `p${index}`), ordered, 0);
  for (const [index, hand] of requestedHands.entries())
    if (hand.length !== 8) state.players[index].hand = hand;
  state.stock = stock.filter((card) => !hands.flat().includes(card) && card !== upcard);
  state.trumpCard = upcard;
  state.trumpSuit = upcard % 4;
  return state;
}

test('deals eight cards, keeps the face-up trump as the final draw, and hides stock/hands', () => {
  const state = newTanGame(['a', 'b', 'c'], fullDeck(), 0);
  assert.equal(state.players.every((player) => player.hand.length === 8), true);
  assert.equal(state.stock.length, 27);
  assert.equal(state.trumpCard, 24);
  assert.equal(state.trumpSuit, 0);
  const view = viewTan(state, 'b');
  assert.equal(view.hand.length, 8);
  assert.equal('stock' in view, false);
  assert.equal(view.trumpCard, state.trumpCard);
  assert.equal(view.stockCount, 28);
});

test('two-player Tấn snapshot counts the face-up trump with the 35-card stock', () => {
  const state = newTanGame(['a', 'b'], fullDeck(), 0);
  assert.equal(state.stock.length, 35);
  assert.equal(state.trumpCard, 16);
  assert.equal(viewTan(state, 'a').stockCount, 36);
});

test('defense uses a higher card of same suit or any trump; trump only yields to higher trump', () => {
  assert.equal(canDefendTan(4, 0, 3), true);
  assert.equal(canDefendTan(5, 0, 3), false);
  assert.equal(canDefendTan(3, 0, 3), true);
  assert.equal(canDefendTan(3, 7, 3), false);
  assert.equal(canDefendTan(11, 7, 3), true);
  assert.equal(canDefendTan(0, 12, 3), false);
  assert.equal(canDefendTan(48, 0, 3), false); // 2 is low, not high
  assert.equal(canDefendTan(0, 48, 3), true); // 3 beats 2 in the same suit
});

test('any non-defender can add a matching rank; attack size is capped by defender hand', () => {
  const state = gameWithHands([
    [0, 8, 12, 16, 20, 24, 28, 32],
    [4, 6],
    [1, 9, 13, 17, 21, 25, 29, 33],
  ]);
  state.defenderUid = 'p1';
  state.maxAttackCards = 2;
  let next = actTan(state, 'p0', { type: 'attack', card: 0 }, 1);
  assert.equal(next.turn, 'p2');
  next = actTan(next, 'p2', { type: 'attack', card: 1 }, 2);
  assert.equal(next.turn, 'p0');
  assert.throws(
    () => actTan(next, 'p0', { type: 'attack', card: 8 }, 3),
    /attack-limit/,
  );
  next = actTan(next, 'p0', { type: 'pass-attack' }, 3);
  next = actTan(next, 'p2', { type: 'pass-attack' }, 4);
  assert.equal(next.step, 'defend');
  assert.equal(next.turn, 'p1');
});

test('successful defense discards cards, refills attacker first and defender last, then defender attacks', () => {
  const state = gameWithHands([
    [0, 8, 12, 16, 20, 24, 28, 32],
    [4, 6, 10, 14, 18, 22, 26, 30],
  ], [36, 37, 38, 39, 40, 41, 42, 43, 44]);
  let next = actTan(state, 'p0', { type: 'attack', card: 0 }, 1);
  next = actTan(next, 'p0', { type: 'pass-attack' }, 2);
  assert.equal(next.step, 'defend');
  next = actTan(next, 'p1', { type: 'defend', index: 0, card: 4 }, 3);
  assert.equal(next.step, 'attack');
  next = actTan(next, 'p0', { type: 'pass-attack' }, 4);
  assert.equal(next.step, 'attack');
  assert.equal(next.attackerUid, 'p1');
  assert.equal(next.defenderUid, 'p0');
  assert.equal(next.turn, 'p1');
  assert.equal(next.players[0].hand.length, 8);
  assert.equal(next.players[1].hand.length, 8);
  assert.deepEqual(next.players[0].hand.slice(-1), [36]);
  assert.deepEqual(next.players[1].hand.slice(-1), [37]);
  assert.equal(next.table.length, 0);
});

test('attack may use a rank exposed by a defense card', () => {
  const state = gameWithHands([
    [0, 5, 8, 12, 16, 20, 24, 28],
    [4, 6, 10, 14, 18, 22, 26, 30],
  ]);
  let next = actTan(state, 'p0', { type: 'attack', card: 0 }, 1);
  next = actTan(next, 'p0', { type: 'pass-attack' }, 2);
  next = actTan(next, 'p1', { type: 'defend', index: 0, card: 4 }, 3);
  assert.equal(next.turn, 'p0');
  next = actTan(next, 'p0', { type: 'attack', card: 5 }, 4);
  assert.equal(next.table.length, 2);
  assert.equal(next.table[1].attackCard, 5);
});

test('taking collects every attack and defense card; next attack moves clockwise after defender', () => {
  const state = gameWithHands([
    [0, 8, 12, 16, 20, 24, 28, 32],
    [4, 6, 10, 14, 18, 22, 26, 30],
    [1, 9, 13, 17, 21, 25, 29, 33],
  ]);
  state.defenderUid = 'p1';
  state.maxAttackCards = 2;
  let next = actTan(state, 'p0', { type: 'attack', card: 0 }, 1);
  next = actTan(next, 'p2', { type: 'attack', card: 1 }, 2);
  next = actTan(next, 'p0', { type: 'pass-attack' }, 3);
  next = actTan(next, 'p2', { type: 'pass-attack' }, 4);
  assert.equal(next.step, 'defend');
  next = actTan(next, 'p1', { type: 'take' }, 5);
  assert.equal(next.step, 'attack');
  assert.equal(next.attackerUid, 'p2');
  assert.equal(next.turn, 'p2');
  assert.ok(next.players[1].hand.includes(0));
  assert.ok(next.players[1].hand.includes(1));
  assert.equal(next.table.length, 0);
});

test('last player with cards loses when the stock is empty', () => {
  const state = gameWithHands([
    [0, 8, 12, 16, 20, 24, 28, 32],
    [4, 6, 10, 14, 18, 22, 26, 30],
  ], []);
  state.players[0].hand = [0];
  state.players[1].hand = [4, 6];
  state.stock = [];
  state.trumpCard = null;
  let next = actTan(state, 'p0', { type: 'attack', card: 0 }, 1);
  assert.equal(next.step, 'defend');
  next = actTan(next, 'p1', { type: 'defend', index: 0, card: 4 }, 2);
  assert.equal(next.status, 'finished');
  assert.deepEqual(next.result.ranking.map((entry) => entry.uid), ['p0', 'p1']);
  assert.equal(next.result.ranking[1].remainingCards, 1);
});

test('an expired empty-table attack automatically opens with one card', () => {
  const state = gameWithHands([
    [0, 8, 12, 16, 20, 24, 28, 32],
    [4, 6, 10, 14, 18, 22, 26, 30],
  ]);
  state.deadline = 10;
  const timed = timeoutTan(state, 10);
  assert.equal(timed.step, 'attack');
  assert.equal(timed.table.length, 1);
  assert.equal(timed.table[0].attackCard, 0);
  assert.equal(timed.players[0].hand.includes(0), false);
});

test('a departing defender takes the bout, remaining players refill, and a new bout begins', () => {
  let state = newTanGame(['a', 'b', 'c'], fullDeck(), 0);
  const attackCard = state.players[0].hand[0];
  state = actTan(state, 'a', { type: 'attack', card: attackCard }, 1);
  const stockBefore = state.stock.length + (state.trumpCard === null ? 0 : 1);
  state = forfeitTanPlayers(state, ['b'], 2);
  assert.equal(state.status, 'playing');
  assert.equal(state.players[1].hand.includes(attackCard), true);
  assert.equal(state.forfeited.includes('b'), true);
  assert.equal(state.players[0].hand.length, 8);
  assert.equal(state.table.length, 0);
  assert.equal(state.stock.length + (state.trumpCard === null ? 0 : 1), stockBefore - 1);
  assert.equal(state.step, 'attack');
  assert.equal(state.attackerUid, 'c');
});

test('all players forfeiting cancels the match instead of recording an all-out draw', () => {
  const state = newTanGame(['a', 'b'], fullDeck(), 0);
  const cancelled = forfeitTanPlayers(state, ['a', 'b'], 1);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.result.reason, 'all-disconnected');
  assert.deepEqual(cancelled.result.ranking, []);
});

test('forfeiting the remaining players after a natural escape preserves the finished player as winner', () => {
  const state = gameWithHands([[0], [4, 12], [8]], []);
  state.players[0].hand = [0];
  state.players[1].hand = [4, 12];
  state.players[2].hand = [8];
  state.stock = [];
  state.trumpCard = null;
  let next = actTan(state, 'p0', { type: 'attack', card: 0 }, 1);
  next = actTan(next, 'p2', { type: 'pass-attack' }, 2);
  next = actTan(next, 'p1', { type: 'defend', index: 0, card: 4 }, 3);
  next = actTan(next, 'p2', { type: 'pass-attack' }, 4);
  assert.deepEqual(next.finishOrder, ['p0']);
  const ended = forfeitTanPlayers(next, ['p1', 'p2'], 5);
  assert.equal(ended.status, 'finished');
  assert.equal(ended.result.reason, 'forfeit');
  assert.equal(ended.result.ranking[0].uid, 'p0');
});

test('empty-hand finish order follows who played their last card first in the bout', () => {
  const state = gameWithHands([[4], [8], [0]], []);
  state.players[0].hand = [4];
  state.players[1].hand = [8];
  state.players[2].hand = [0];
  state.stock = [];
  state.trumpCard = null;
  state.attackerUid = 'p2';
  state.defenderUid = 'p0';
  state.turn = 'p2';
  state.maxAttackCards = 1;
  let next = actTan(state, 'p2', { type: 'attack', card: 0 }, 1);
  next = actTan(next, 'p1', { type: 'pass-attack' }, 2);
  next = actTan(next, 'p0', { type: 'defend', index: 0, card: 4 }, 3);
  next = actTan(next, 'p1', { type: 'pass-attack' }, 4);
  assert.equal(next.status, 'finished');
  assert.deepEqual(next.finishOrder, ['p2', 'p0']);
  assert.deepEqual(next.result.ranking.map((entry) => entry.uid), ['p2', 'p0', 'p1']);
});

test('automatic legal playthroughs conserve all 52 cards and finish for 2–4 players', () => {
  for (let count = 2; count <= 4; count++) {
    for (let sample = 1; sample <= 2; sample++) {
      let seed = count * 100 + sample;
      const random = (max) => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed % max;
      };
      const deck = fullDeck();
      for (let i = deck.length - 1; i > 0; i--) {
        const j = random(i + 1);
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      let state = newTanGame(Array.from({ length: count }, (_, i) => `p${i}`), deck, 0);
      const assertConserved = () => {
        const cards = [
          ...state.players.flatMap((player) => player.hand),
          ...state.stock,
          ...(state.trumpCard === null ? [] : [state.trumpCard]),
          ...state.table.flatMap((entry) =>
            entry.defenseCard === null
              ? [entry.attackCard]
              : [entry.attackCard, entry.defenseCard],
          ),
          ...state.discardPile,
        ];
        assert.equal(cards.length, 52);
        assert.equal(new Set(cards).size, 52);
      };
      let step = 0;
      while (state.status === 'playing' && step < 1600) {
        const uid = state.turn;
        const player = state.players.find((candidate) => candidate.uid === uid);
        let action;
        if (state.step === 'attack') {
          const ranks = new Set(
            state.table.flatMap((entry) =>
              entry.defenseCard === null
                ? [Math.floor(entry.attackCard / 4)]
                : [Math.floor(entry.attackCard / 4), Math.floor(entry.defenseCard / 4)],
            ),
          );
          const matching = player.hand.find((card) => ranks.has(Math.floor(card / 4)));
          action =
            !state.table.length ||
            (state.table.length < state.maxAttackCards &&
              matching !== undefined &&
              step % 3 === 0)
              ? { type: 'attack', card: state.table.length ? matching : player.hand[0] }
              : { type: 'pass-attack' };
        } else {
          const index = state.table.findIndex(
            (entry) =>
              entry.defenseCard === null &&
              player.hand.some((card) => canDefendTan(card, entry.attackCard, state.trumpSuit)),
          );
          if (index >= 0) {
            const attackCard = state.table[index].attackCard;
            const card = player.hand.find((candidate) =>
              canDefendTan(candidate, attackCard, state.trumpSuit),
            );
            action = { type: 'defend', index, card };
          } else action = { type: 'take' };
        }
        state = actTan(state, uid, action, ++step);
        assertConserved();
      }
      assert.equal(state.status, 'finished', `players=${count}, sample=${sample}`);
      assertConserved();
    }
  }
});
