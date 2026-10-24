import assert from 'node:assert/strict';
import test from 'node:test';
import { updateRoom, roomSnapshot } from '../game-access/rooms.mjs';
import { advanceExpiredRoom } from '../game-access/worker.mjs';
import { DEFAULT_PHOM_CONFIG } from '../game-access/phom-scoring.mjs';
const deck = Array.from({ length: 52 }, (_, i) => i);
const lobby = () => ({
  gameKind: 'phom',
  phomConfig: { ...DEFAULT_PHOM_CONFIG, forfeit: 23 },
  phase: 'lobby',
  host: 'a',
  ownerUid: 'a',
  members: ['a', 'b', 'c'].map((uid) => ({
    uid,
    name: uid,
    ready: uid !== 'c',
    wins: 0,
    balance: 0,
  })),
  game: null,
});
test('room autostarts Phỏm and snapshot retains config without revealing opponent hands', () => {
  const input = lobby(),
    state = updateRoom(input, 'c', { type: 'ready', ready: true }, 0, deck);
  assert.equal(state.game.rulesVersion, 'phom-v1');
  assert.equal(state.game.players[0].hand.length, 10);
  const snapshot = roomSnapshot(
    {
      id: 'room',
      code: 'ABCDEFGH',
      version: 2,
      epoch: 'e',
      match_id: 'm',
      state,
    },
    'a',
    true,
    0,
    true,
  );
  assert.equal(snapshot.room.gameKind, 'phom');
  assert.equal(snapshot.room.phomConfig.forfeit, 23);
  assert.ok(snapshot.room.game.players.every((p) => !('hand' in p)));
  assert.equal(snapshot.room.game.hand.length, 10);
  assert.equal(input.game, null);
});
test('Phỏm kick/leave settles once with its own rates and worker batch never invents a winner', () => {
  const started = updateRoom(
    lobby(),
    'c',
    { type: 'ready', ready: true },
    0,
    deck,
  );
  const first = updateRoom(started, 'a', { type: 'kick', targetUid: 'b' }, 1);
  const finished = updateRoom(first, 'c', { type: 'leave' }, 2);
  assert.equal(finished.game.status, 'finished');
  assert.equal(finished.members[0].balance, 46);
  assert.equal(finished.scoreMembers.find((p) => p.uid === 'b').balance, -23);
  assert.equal(finished.scoreMembers.find((p) => p.uid === 'c').balance, -23);
  const cancelled = advanceExpiredRoom(
    { state: started, expired: ['a', 'b', 'c'] },
    1,
  ).state;
  assert.equal(cancelled.game.status, 'cancelled');
  assert.ok(cancelled.scoreMembers.every((p) => p.balance === 0));
  const next = advanceExpiredRoom(
    { state: started, expired: [] },
    started.game.deadline,
  ).state;
  assert.equal(next.game.rulesVersion, 'phom-v1');
  assert.equal(next.game.turn, 'b');
});

test('Phỏm next-round rates promote only at first deal and automatic rematch', () => {
  const state = lobby();
  state.nextPhomConfig = { ...DEFAULT_PHOM_CONFIG, u: 999, forfeit: 77 };
  for (const action of [{ type: 'start' }, { type: 'ready', ready: true }]) {
    const current = structuredClone(state);
    current.members.forEach((p) => {
      p.ready = true;
    });
    if (action.type === 'ready') current.phase = 'finished';
    const next = updateRoom(current, 'a', action, 0, deck);
    assert.deepEqual(next.phomConfig, state.nextPhomConfig);
    assert.deepEqual(next.game.config, state.nextPhomConfig);
    assert.equal(state.phomConfig.forfeit, 23);
    assert.deepEqual(next.nextPhomConfig, state.nextPhomConfig);
  }
});

test('pending Phỏm rates never affect active forfeits, fees, timeout or cancellation', () => {
  const state = updateRoom(
    lobby(),
    'c',
    { type: 'ready', ready: true },
    0,
    deck,
  );
  const game = structuredClone(state.game);
  state.nextPhomConfig = {
    ...DEFAULT_PHOM_CONFIG,
    forfeit: 999,
    eat: 999,
    chot: 999,
  };
  const ended = advanceExpiredRoom({ state, expired: ['b', 'c'] }, 1).state;
  assert.deepEqual(
    ended.game.result.ranking.map((r) => r.moneyDelta),
    [46, -23, -23],
  );
  assert.deepEqual(state.game, game);
  const timed = advanceExpiredRoom(
    { state, expired: [] },
    state.game.deadline,
  ).state;
  assert.deepEqual(timed.phomConfig, state.phomConfig);
  assert.deepEqual(timed.game.config, game.config);
  const cancelled = advanceExpiredRoom(
    { state, expired: ['a', 'b', 'c'] },
    1,
  ).state;
  assert.ok(cancelled.scoreMembers.every((p) => p.balance === 0));
});
