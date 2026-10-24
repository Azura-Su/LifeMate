import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isPhom,
  findPhomLayout,
  phomPoint,
} from '../game-access/phom-melds.mjs';
import {
  DEFAULT_PHOM_CONFIG,
  validatePhomConfig,
  settlePhom,
} from '../game-access/phom-scoring.mjs';

const card = (r, suit = 0) => ((r + 10) % 13) * 4 + suit;
test('Phỏm uses ace low, distinct cards, sets and same-suit runs', () => {
  assert.equal(isPhom([card(1), card(2), card(3)]), true);
  assert.equal(isPhom([card(12), card(13), card(1)]), false);
  assert.equal(isPhom([card(5), card(5, 1), card(5, 2), card(5, 3)]), true);
  assert.equal(isPhom([card(5), card(5), card(5, 2)]), false);
  assert.equal(isPhom([card(5), card(6, 1), card(7)]), false);
  assert.equal(phomPoint(card(13)), 13);
});
test('layout finds disjoint optimal phỏm while retaining each eaten card in its own meld', () => {
  const hand = [
    card(3),
    card(4),
    card(5),
    card(5, 1),
    card(5, 2),
    card(5, 3),
    card(6),
    card(7),
    card(9, 3),
  ];
  const layout = findPhomLayout(hand, [card(3), card(5, 1)]);
  assert.ok(layout);
  assert.equal(layout.points, 9);
  assert.equal(layout.melds.length, 2);
  assert.equal(new Set(layout.melds.flat()).size, 8);
  assert.equal(
    findPhomLayout([card(3), card(4), card(5)], [card(3), card(4)]),
    null,
  );
});
test('all rates are independent, allow zero and reject missing/extra/unsafe input', () => {
  assert.deepEqual(
    validatePhomConfig({ ...DEFAULT_PHOM_CONFIG, second: 0, u: 123 }),
    { ...DEFAULT_PHOM_CONFIG, second: 0, u: 123 },
  );
  for (const value of [-1, 1.5, 1_000_000_001, '1', null])
    assert.throws(
      () => validatePhomConfig({ ...DEFAULT_PHOM_CONFIG, chot: value }),
      /invalid-input/,
    );
  assert.throws(
    () => validatePhomConfig({ ...DEFAULT_PHOM_CONFIG, admin: true }),
    /invalid-input/,
  );
  const missing = { ...DEFAULT_PHOM_CONFIG };
  delete missing.eat;
  assert.throws(() => validatePhomConfig(missing), /invalid-input/);
});
const players = () => [
  {
    uid: 'a',
    hand: [card(1)],
    melds: [[card(3), card(4), card(5)]],
    laidOrder: 0,
  },
  {
    uid: 'b',
    hand: [card(7)],
    melds: [[card(6), card(7), card(8)]],
    laidOrder: 1,
  },
  {
    uid: 'c',
    hand: [card(8)],
    melds: [[card(9), card(10), card(11)]],
    laidOrder: 2,
  },
  { uid: 'd', hand: [card(1)], melds: [], laidOrder: 3 },
];
test('normal settlement uses configured places, móm and eat/chốt with zero sum', () => {
  const rates = {
    ...DEFAULT_PHOM_CONFIG,
    second: 10,
    third: 20,
    last: 30,
    mom: 40,
  };
  const ranking = settlePhom(
    {
      players: players(),
      fees: [{ from: 'a', to: 'b', kind: 'chot', amount: 4 }],
    },
    rates,
  );
  assert.deepEqual(
    ranking.map((p) => [p.uid, p.moneyDelta]),
    [
      ['a', 66],
      ['b', -6],
      ['c', -20],
      ['d', -40],
    ],
  );
  assert.equal(
    ranking.reduce((s, p) => s + p.moneyDelta, 0),
    0,
  );
  const all = players().map((p) => ({ ...p, melds: [] }));
  assert.deepEqual(
    settlePhom({ players: all, fees: [] }, rates).map((p) => p.uid),
    ['a', 'b', 'c', 'd'],
  );
});
test('ù, ù tròn and đền use separate rates and forfeits never pay twice', () => {
  const rates = {
    ...DEFAULT_PHOM_CONFIG,
    u: 7,
    uTron: 11,
    den: 13,
    forfeit: 17,
  };
  const game = {
    players: players(),
    fees: [],
    winnerUid: 'b',
    winKind: 'u',
    penaltyUid: null,
  };
  assert.deepEqual(
    settlePhom(game, rates).map((p) => p.moneyDelta),
    [21, -7, -7, -7],
  );
  game.winKind = 'u-tron';
  assert.equal(settlePhom(game, rates)[0].moneyDelta, 33);
  game.penaltyUid = 'c';
  game.players[3].forfeited = true;
  const result = settlePhom(game, rates);
  assert.equal(result.find((p) => p.uid === 'c').moneyDelta, -26);
  assert.equal(result.find((p) => p.uid === 'd').moneyDelta, -17);
  assert.equal(result.find((p) => p.uid === 'b').moneyDelta, 43);
  assert.equal(
    result.reduce((s, p) => s + p.moneyDelta, 0),
    0,
  );
});
