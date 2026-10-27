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
  settlePhom,
} from '../game-access/phom-scoring.mjs';

const card = (rank, suit = 0) => ((rank + 10) % 13) * 4 + suit;
const deck = Array.from({ length: 52 }, (_, index) => index);
const ranking = (game) =>
  settlePhom(game, DEFAULT_PHOM_CONFIG).map((p) => p.uid);
const act = (game, uid, phomAction, extra = {}) =>
  playPhom(game, uid, { phomAction, ...extra }, 1_000);

test('replayed móm finishes behind the móm player who discarded last earlier', () => {
  const hands = [
    [
      [1, 0],
      [2, 1],
      [4, 2],
      [5, 3],
      [7, 0],
      [8, 1],
      [10, 2],
      [11, 3],
      [12, 0],
      [13, 3],
    ],
    [
      [13, 0],
      [13, 1],
      [2, 0],
      [3, 2],
      [5, 0],
      [7, 3],
      [9, 1],
      [10, 3],
      [12, 2],
    ],
    [
      [1, 1],
      [2, 2],
      [4, 3],
      [5, 1],
      [7, 2],
      [8, 3],
      [10, 0],
      [11, 1],
      [12, 3],
    ],
    [
      [3, 0],
      [4, 0],
      [5, 2],
      [6, 0],
      [6, 1],
      [6, 2],
      [8, 0],
      [9, 2],
      [11, 0],
    ],
  ].map((hand) => hand.map(([rank, suit]) => card(rank, suit)));
  const used = new Set(hands.flat());
  assert.equal(used.size, 37);
  const rest = deck.filter((value) => !used.has(value));
  let game = newPhomGame(['a', 'b', 'c', 'd'], deck, 0, {
    ...DEFAULT_PHOM_CONFIG,
    options: { tai: true, send: false, uDen: true },
  });
  game.players.forEach((player, index) =>
    Object.assign(player, {
      hand: hands[index],
      discards: rest.slice(index * 3, index * 3 + 3),
      turns: 3,
    }),
  );
  Object.assign(game, { step: 'lay', stock: rest.slice(12) });
  const before = structuredClone(game);

  game = act(game, 'a', 'lay');
  game = act(game, 'a', 'discard', { cards: [card(13, 3)] });
  game = act(game, 'b', 'eat');
  game = act(game, 'b', 'lay');
  game = act(game, 'b', 'discard', { cards: [card(12, 2)] });
  for (const uid of ['c', 'd', 'a']) {
    assert.equal(game.turn, uid);
    game = timeoutPhom(game, game.deadline);
  }

  assert.equal(game.status, 'finished');
  assert.deepEqual(
    game.result.ranking.map((p) => p.uid),
    ['d', 'b', 'c', 'a'],
  );
  assert.equal(
    game.result.ranking.reduce((sum, p) => sum + p.moneyDelta, 0),
    0,
  );
  const physical = game.players
    .flatMap((p) => [...p.hand, ...p.melds.flat(), ...p.discards])
    .concat(game.stock);
  assert.deepEqual(
    physical.sort((a, b) => a - b),
    deck,
  );
  assert.equal(before.players[0].laid, false);
  assert.equal(before.result, null);
  assert.ok(
    game.players[0].lastDiscardOrder > game.players[2].lastDiscardOrder,
  );
  assert.ok(
    viewPhom(game, 'a', true).players.every((p) => !('lastDiscardOrder' in p)),
  );
});

const mixedPlayers = () => [
  {
    uid: 'a',
    hand: [card(1)],
    melds: [[card(3), card(4), card(5)]],
    laidOrder: 0,
    lastDiscardOrder: 15,
  },
  { uid: 'b', hand: [card(8)], melds: [], laidOrder: 1, lastDiscardOrder: 17 },
  { uid: 'c', hand: [card(9)], melds: [], laidOrder: 2, lastDiscardOrder: 16 },
];

test('mixed móm ties use final discards but equal non-móm points keep the initial lay order', () => {
  const players = mixedPlayers();
  assert.deepEqual(ranking({ players }), ['a', 'c', 'b']);
  players[1].melds = [[card(6), card(7), card(8)]];
  players[2].melds = [[card(9), card(10), card(11)]];
  players[1].hand = [card(7, 1)];
  players[2].hand = [card(7, 2)];
  assert.deepEqual(ranking({ players }), ['a', 'b', 'c']);
});

test('all-móm keeps the original lay order even if a forfeited player had phỏm', () => {
  const players = mixedPlayers().map((p) => ({ ...p, melds: [] }));
  assert.deepEqual(ranking({ players }), ['a', 'b', 'c']);
  players[0].melds = [[card(3), card(4), card(5)]];
  players[0].forfeited = true;
  assert.deepEqual(ranking({ players }), ['b', 'c', 'a']);
});

test('legacy playing state without discard metadata keeps a deterministic lay-order fallback', () => {
  const players = mixedPlayers();
  players.forEach((p) => delete p.lastDiscardOrder);
  assert.deepEqual(ranking({ players }), ['a', 'b', 'c']);
  players[1].lastDiscardOrder = 17;
  assert.deepEqual(ranking({ players }), ['a', 'c', 'b']);
});
