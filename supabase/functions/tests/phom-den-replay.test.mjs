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
import { updateRoom, roomSnapshot } from '../game-access/rooms.mjs';
import { advanceExpiredRoom } from '../game-access/worker.mjs';

const card = (rank, suit = 0) => ((rank + 10) % 13) * 4 + suit;
const deck = Array.from({ length: 52 }, (_, i) => i);
const options = { tai: true, send: true, uDen: true };
const config = (patch = {}) => ({
  ...DEFAULT_PHOM_CONFIG,
  u: 5,
  uTron: 11,
  den: 7,
  options: { ...options, ...patch },
});
const act = (game, uid, phomAction, extra = {}) =>
  playPhom(game, uid, { phomAction, ...extra }, 1_000);
const player = (game, uid) => game.players.find((p) => p.uid === uid);
const delta = (game, uid) =>
  game.result.ranking.find((p) => p.uid === uid).moneyDelta;

function replayFixture(patch = {}) {
  const game = newPhomGame(['b', 'a', 'c'], deck, 0, config(patch));
  Object.assign(player(game, 'b'), {
    hand: [card(11, 1), card(12, 1)],
    melds: [[card(8), card(9), card(10)]],
    discards: [card(5)],
    laid: true,
    laidOrder: 0,
    turns: 4,
  });
  Object.assign(player(game, 'a'), {
    hand: [card(3), card(4), card(13, 3), card(1, 1)],
    melds: [],
    discards: [],
    laid: false,
    laidOrder: null,
    turns: 3,
  });
  Object.assign(player(game, 'c'), {
    hand: [card(1, 3)],
    melds: [[card(6, 1), card(7, 1), card(8, 1)]],
    discards: [],
    laid: true,
    laidOrder: 1,
    turns: 3,
  });
  Object.assign(game, {
    turn: 'a',
    step: 'draw',
    laidCount: 2,
    lastDiscard: { uid: 'b', card: card(5), chot: true },
    stock: [card(7, 2), card(13, 1)],
  });
  return game;
}

function eatChot(game) {
  let next = act(game, 'a', 'eat');
  next = act(next, 'a', 'lay');
  return act(next, 'a', 'discard', { cards: [card(13, 3)] });
}

function toReplay(game) {
  let next = eatChot(game);
  next = act(next, 'c', 'draw');
  return act(next, 'c', 'discard', { cards: [card(7, 2)] });
}

for (const tai of [false, true])
  for (const uDen of [false, true])
    test(`feeding three always pays for the table (tai=${tai}, uDen=${uDen})`, () => {
      const game = newPhomGame(
        ['a', 'b', 'c', 'd'],
        deck,
        0,
        config({ tai, uDen }),
      );
      Object.assign(game, { turn: 'b', step: 'discard' });
      const b = player(game, 'b');
      b.hand = [
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
      b.eaten = [card(3), card(7, 1), card(11, 2)];
      game.eats = b.eaten.map((card) => ({
        from: 'a',
        to: 'b',
        card,
        chot: false,
      }));
      game.fees = [{ from: 'a', to: 'b', kind: 'eat', amount: 2 }];
      const before = structuredClone(game);
      const won = act(game, 'b', 'u');
      assert.equal(won.penaltyUid, 'a');
      assert.equal(delta(won, 'a'), -23);
      assert.equal(delta(won, 'b'), 23);
      assert.equal(delta(won, 'c'), 0);
      assert.equal(delta(won, 'd'), 0);
      assert.equal(
        won.result.ranking.reduce((sum, p) => sum + p.moneyDelta, 0),
        0,
      );
      assert.deepEqual(game, before);
    });

test('the eater pays when the actual reopened player wins by drawing, laying, or timeout', () => {
  for (const method of ['u', 'lay', 'timeout']) {
    let game = toReplay(replayFixture());
    assert.equal(game.turn, 'b');
    game =
      method === 'timeout'
        ? timeoutPhom(game, game.deadline)
        : act(act(game, 'b', 'draw'), 'b', method);
    assert.equal(game.penaltyUid, 'a', method);
    assert.equal(delta(game, 'a'), -10);
    assert.equal(delta(game, 'b'), 10);
    assert.equal(delta(game, 'c'), 0);
  }
});

test('a replay win after eating another chot retains the cause of the winner own extra turn', () => {
  let game = eatChot(replayFixture());
  game.stock = [card(13, 1)];
  game = act(game, 'c', 'draw');
  game = act(game, 'c', 'discard', { cards: [card(13, 1)] });
  game = act(game, 'b', 'eat');
  game = act(game, 'b', 'u');
  assert.equal(game.penaltyUid, 'a');
  assert.equal(delta(game, 'c'), -DEFAULT_PHOM_CONFIG.chot);
  assert.equal(delta(game, 'a'), -10);
});

test('replay debt survives sending until the reopened player wins', () => {
  const input = replayFixture();
  player(input, 'b').hand = [card(6)];
  input.stock = [card(7, 2), card(7)];
  let game = act(toReplay(input), 'b', 'draw');
  game = act(game, 'b', 'send', {
    cards: [card(6)],
    targetUid: 'a',
    meldIndex: 0,
  });
  game = act(game, 'b', 'send', {
    cards: [card(7)],
    targetUid: 'a',
    meldIndex: 0,
  });
  assert.equal(game.status, 'finished');
  assert.equal(game.penaltyUid, 'a');
});

test('replay debt is still applied to automatic u after the final discard', () => {
  const input = replayFixture();
  player(input, 'b').hand.push(card(2, 2));
  let game = act(toReplay(input), 'b', 'draw');
  game = act(game, 'b', 'lay');
  game = act(game, 'b', 'discard', { cards: [card(2, 2)] });
  assert.equal(game.status, 'finished');
  assert.equal(game.penaltyUid, 'a');
});

test('eating a chot does not pay for an unrelated player u in their normal turn', () => {
  const input = replayFixture();
  player(input, 'c').hand = [card(10, 3), card(11, 3), card(12, 3)];
  const won = act(eatChot(input), 'c', 'u');
  assert.equal(won.penaltyUid, null);
  assert.equal(
    delta(won, 'b'),
    -DEFAULT_PHOM_CONFIG.u - DEFAULT_PHOM_CONFIG.chot,
  );
  assert.equal(
    delta(won, 'a'),
    -DEFAULT_PHOM_CONFIG.u + DEFAULT_PHOM_CONFIG.chot,
  );
});

test('turning off replay liability leaves each opponent paying normal u and preserves chot fees', () => {
  const won = act(
    act(toReplay(replayFixture({ uDen: false })), 'b', 'draw'),
    'b',
    'u',
  );
  assert.equal(won.penaltyUid, null);
  assert.equal(delta(won, 'a'), -1);
  assert.equal(delta(won, 'b'), 6);
  assert.equal(delta(won, 'c'), -5);
});

test('legacy last-chot metadata never invents a causal replay debt', () => {
  const game = newPhomGame(['a', 'b', 'c'], deck, 0, config());
  Object.assign(game, { turn: 'b', step: 'discard', chotEater: 'a' });
  player(game, 'b').hand = [
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
  const won = act(game, 'b', 'u');
  assert.equal(won.penaltyUid, null);
});

test('the responsible eater cannot be charged a later u after forfeiting', () => {
  let game = toReplay(replayFixture());
  game = forfeitPhomPlayers(game, ['a'], 1_001);
  const won = act(act(game, 'b', 'draw'), 'b', 'u');
  assert.equal(won.penaltyUid, null);
  assert.equal(delta(won, 'a'), 0);
  assert.equal(delta(won, 'c'), -DEFAULT_PHOM_CONFIG.u);
});

test('replay provenance survives serialization and is absent from public snapshots', () => {
  const replay = toReplay(replayFixture());
  const restored = JSON.parse(JSON.stringify(replay));
  const view = viewPhom(restored, 'a', true);
  assert.ok(view.players.every((p) => !('replayPayerUid' in p)));
  const won = act(act(restored, 'b', 'draw'), 'b', 'u');
  assert.equal(won.penaltyUid, 'a');
});

test('mandatory three-card feeding takes precedence over a different eater responsible for replay', () => {
  const input = replayFixture();
  input.players.push({
    ...structuredClone(player(input, 'c')),
    uid: 'd',
    hand: [card(2, 3)],
    turns: 4,
  });
  player(input, 'b').eaten = [card(8), card(11, 1)];
  input.eats = [card(8), card(11, 1), card(13, 1)].map((card) => ({
    from: 'd',
    to: 'b',
    card,
    chot: false,
  }));
  const won = act(act(toReplay(input), 'b', 'draw'), 'b', 'u');
  assert.equal(won.penaltyUid, 'd');
  assert.equal(delta(won, 'd'), -21);
  assert.equal(delta(won, 'a'), DEFAULT_PHOM_CONFIG.chot);
});

test('a nonwinning replay discard consumes its debt before the round ends', () => {
  let game = toReplay(replayFixture());
  game.stock = [card(2, 2)];
  game = act(game, 'b', 'draw');
  game = act(game, 'b', 'discard', { cards: [card(2, 2)] });
  assert.equal(game.status, 'finished');
  assert.equal(game.penaltyUid, null);
  assert.equal('replayPayerUid' in player(game, 'b'), false);
});

test('forfeiting the reopened player consumes their pending replay debt', () => {
  const game = eatChot(replayFixture());
  const left = forfeitPhomPlayers(game, ['b'], 1_001);
  assert.equal('replayPayerUid' in player(left, 'b'), false);
  assert.equal(player(left, 'b').forfeited, true);
});

test('a subsequent chot reopens a new turn with the new eater as its cause', () => {
  const input = replayFixture();
  player(input, 'b').replayPayerUid = 'c';
  const reopened = act(input, 'a', 'eat');
  assert.equal(player(reopened, 'b').replayPayerUid, 'a');
});

test('a zero den rate preserves the mandatory liable player label without moving points', () => {
  const input = replayFixture();
  input.config.den = 0;
  const won = act(act(toReplay(input), 'b', 'draw'), 'b', 'u');
  assert.equal(won.penaltyUid, 'a');
  assert.equal(delta(won, 'a'), 4);
  assert.equal(delta(won, 'b'), -4);
  assert.ok(
    won.result.ranking.find((p) => p.uid === 'a').labels.includes('den'),
  );
});

function roomFor(game) {
  return {
    gameKind: 'phom',
    phomConfig: game.config,
    phase: 'playing',
    host: 'b',
    ownerUid: 'b',
    game,
    members: game.players.map((p) => ({
      uid: p.uid,
      name: p.uid,
      wins: 0,
      balance: 0,
      ready: false,
    })),
  };
}

test('room actions retain replay provenance and settle balances once without exposing it', () => {
  let state = roomFor(toReplay(replayFixture()));
  state = JSON.parse(JSON.stringify(state));
  const record = {
    id: 'room',
    code: 'ABCDEFGH',
    version: 5,
    epoch: 'epoch',
    match_id: 'match',
    state,
  };
  const snapshot = roomSnapshot(record, 'a', true, 1_000, true, 8);
  assert.ok(!JSON.stringify(snapshot).includes('replayPayerUid'));
  state = updateRoom(state, 'b', { type: 'play', phomAction: 'draw' }, 1_000);
  state = updateRoom(state, 'b', { type: 'play', phomAction: 'u' }, 1_001);
  assert.equal(state.game.penaltyUid, 'a');
  assert.equal(state.members.find((p) => p.uid === 'b').balance, 10);
  assert.equal(state.scoreMembers.find((p) => p.uid === 'a').balance, -10);
  const again = advanceExpiredRoom({ state, expired: [] }, 2_000).state;
  assert.deepEqual(again.members, state.members);
  assert.deepEqual(again.game.result, state.game.result);
});

test('worker timeout uses the same causal debt and immutable match config after JSON persistence', () => {
  const state = roomFor(toReplay(replayFixture()));
  state.nextPhomConfig = config({ tai: false, uDen: false });
  state.nextPhomConfig.den = 999;
  const persisted = JSON.parse(JSON.stringify(state));
  const next = advanceExpiredRoom(
    { state: persisted, expired: [] },
    persisted.game.deadline,
  ).state;
  assert.equal(next.game.penaltyUid, 'a');
  assert.equal(delta(next.game, 'a'), -10);
  assert.equal(next.members.find((p) => p.uid === 'b').balance, 10);
  assert.deepEqual(state.game, persisted.game);
  const again = advanceExpiredRoom({ state: next, expired: [] }, 100_000).state;
  assert.deepEqual(again.members, next.members);
});
