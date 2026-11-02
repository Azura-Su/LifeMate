import assert from 'node:assert/strict';
import test from 'node:test';
import { actSam, newSamGame, viewSam } from '../game-access/sam.mjs';
import { settleSamVariant } from '../game-access/variant-scoring.mjs';
import { newTanGame, viewTan } from '../game-access/tan.mjs';
import { newTienLenGame } from '../game-access/tienlen.mjs';
import { newTienLenNorthGame } from '../game-access/tienlen-north.mjs';
import { updateRoom } from '../game-access/rooms.mjs';

const deck = Array.from({ length: 52 }, (_, i) => i);
const ids = (count) => Array.from({ length: count }, (_, i) => `p${i}`);

test('Sâm deals five private ten-card hands and leaves two unused cards', () => {
  const game = newSamGame(ids(5), deck, 100);
  assert.deepEqual(
    game.players.map((p) => p.hand.length),
    [10, 10, 10, 10, 10],
  );
  assert.equal(new Set(game.players.flatMap((p) => p.hand)).size, 50);
  assert.equal(game.stock.length, 2);
  assert.equal(new Set(game.reportOrder).size, 5);
  assert.equal(viewSam(game, 'p4').players.length, 5);
  assert.throws(() => newSamGame(ids(6), deck, 100), /invalid-deal/);
});

test('Tấn deals five/six eight-card hands and retains the last trump in stock', () => {
  for (const count of [5, 6]) {
    const game = newTanGame(ids(count), deck, 100);
    assert.ok(game.players.every((p) => p.hand.length === 8));
    assert.equal(new Set(game.players.flatMap((p) => p.hand)).size, count * 8);
    assert.equal(viewTan(game, 'p0').stockCount, 52 - count * 8);
    assert.equal(game.trumpCard, deck[count * 8]);
  }
  assert.throws(() => newTanGame(ids(7), deck, 100), /invalid-deal/);
});

test('room capacity is specific to the game, and existing members can rejoin a full room', () => {
  for (const [gameKind, capacity] of [
    ['south', 4],
    ['north', 4],
    ['phom', 4],
    ['sam', 5],
    ['tan', 6],
  ]) {
    const members = ids(capacity - 1).map((uid) => ({
      uid,
      name: uid,
      ready: false,
    }));
    const room = { gameKind, host: 'p0', members, phase: 'lobby', game: null };
    const joined = updateRoom(
      room,
      'last',
      { type: 'join', name: 'Last' },
      100,
    );
    assert.equal(joined.members.length, capacity);
    assert.throws(
      () => updateRoom(joined, 'extra', { type: 'join', name: 'Extra' }, 100),
      /room-full/,
    );
    assert.equal(
      updateRoom(joined, 'last', { type: 'join', name: 'Last' }, 100).members
        .length,
      capacity,
    );
  }
  assert.throws(() => newTienLenGame(ids(5), deck, 100), /invalid-deal/);
  assert.throws(() => newTienLenNorthGame(ids(5), deck, 100), /invalid-deal/);
});

test('a five-player successful Sâm call settles against all four opponents, zero-sum', () => {
  const winning = Array.from({ length: 10 }, (_, i) => i * 4);
  const rest = deck.filter((card) => !winning.includes(card));
  const dealt = winning
    .flatMap((card, i) => [card, ...rest.slice(i * 4, i * 4 + 4)])
    .concat(rest.slice(40));
  const config = {
    rulesVersion: 'sam-v2',
    pointsPerCard: 1,
    samCallPoints: 20,
  };
  let game = newSamGame(ids(5), dealt, 100, null, config);
  game = actSam(game, 'p0', { type: 'call-sam' }, 101);
  assert.equal(game.samCallRecipients.length, 4);
  game = actSam(game, 'p0', { type: 'play', cards: winning }, 102);
  assert.equal(game.status, 'finished');
  settleSamVariant(game, config);
  assert.equal(game.result.ranking.find((p) => p.uid === 'p0').moneyDelta, 80);
  assert.ok(
    game.result.ranking
      .filter((p) => p.uid !== 'p0')
      .every((p) => p.moneyDelta === -20),
  );
  assert.equal(
    game.result.ranking.reduce((sum, p) => sum + p.moneyDelta, 0),
    0,
  );
});
