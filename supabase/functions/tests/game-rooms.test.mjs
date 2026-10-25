import assert from 'node:assert/strict';
import test from 'node:test';
import {
  finishRoom,
  updateRoom,
  roomSnapshot,
  shouldStartRematch,
} from '../game-access/rooms.mjs';
import { newTienLenGame } from '../game-access/tienlen.mjs';
import { ensureRealtimeRole } from '../game-access/realtimeIdentity.mjs';
import { createGameHandler } from '../game-access/handler.mjs';
import { advanceExpiredRoom } from '../game-access/worker.mjs';
import { DEFAULT_PHOM_CONFIG } from '../game-access/phom-scoring.mjs';

const members = [
  { uid: 'a', name: 'An', ready: true, wins: 0 },
  { uid: 'b', name: 'Bình', ready: true, wins: 0 },
];
const lobby = () => ({
  phase: 'lobby',
  host: 'a',
  members: structuredClone(members),
  game: null,
});
const dragon = Array.from({ length: 13 }, (_, i) => i * 4);
const others = Array.from({ length: 52 }, (_, i) => i).filter(
  (c) => !dragon.includes(c),
);
const deck = dragon.flatMap((c, i) => [c, others[i]]).concat(others.slice(13));

test('North and Sâm settle one point per remaining card, zero-sum', () => {
  for (const gameKind of ['north', 'sam']) {
    const players = [
      { uid: 'a', hand: [], played: 13 },
      { uid: 'b', hand: [4, 8], played: 11 },
      { uid: 'c', hand: [12], played: 12 },
    ];
    const ranking = [
      { uid: 'a', rank: 1, labels: [] },
      { uid: 'b', rank: 2, labels: [] },
      { uid: 'c', rank: 3, labels: [] },
    ];
    const prior = {
      gameKind,
      phase: 'playing',
      members: ['a', 'b', 'c'].map((uid) => ({ uid, name: uid })),
      scoreMembers: ['a', 'b', 'c'].map((uid) => ({ uid, name: uid, balance: 0, wins: 0 })),
      game: { status: 'finished', players, result: { ranking } },
    };
    const settled = finishRoom(prior, structuredClone(prior));
    assert.deepEqual(
      settled.game.result.ranking.map((result) => result.moneyDelta),
      [3, -2, -1],
    );
    assert.equal(
      settled.game.result.ranking.reduce((sum, result) => sum + result.moneyDelta, 0),
      0,
    );
  }
});

test('North and Sâm apply the saved points-per-card rate without changing zero-sum', () => {
  for (const gameKind of ['north', 'sam']) {
    const prior = {
      gameKind,
      variantConfig: { pointsPerCard: 4 },
      phase: 'playing',
      members: ['a', 'b', 'c'].map((uid) => ({ uid, name: uid })),
      scoreMembers: ['a', 'b', 'c'].map((uid) => ({ uid, name: uid, balance: 0, wins: 0 })),
      game: {
        status: 'finished',
        players: [
          { uid: 'a', hand: [], played: 13 },
          { uid: 'b', hand: [4, 8], played: 11 },
          { uid: 'c', hand: [12], played: 12 },
        ],
        result: {
          ranking: [
            { uid: 'a', rank: 1, labels: [] },
            { uid: 'b', rank: 2, labels: [] },
            { uid: 'c', rank: 3, labels: [] },
          ],
        },
      },
    };
    const settled = finishRoom(prior, structuredClone(prior));
    assert.deepEqual(
      settled.game.result.ranking.map((result) => result.moneyDelta),
      [12, -8, -4],
    );
    assert.equal(
      settled.game.result.ranking.reduce((sum, result) => sum + result.moneyDelta, 0),
      0,
    );
  }
});

test('North v2 settles remaining 2 bonuses and single-2 cut fees through the room scorer', () => {
  const prior = {
    gameKind: 'north',
    variantConfig: {
      rulesVersion: 'north-v2',
      pointsPerCard: 1,
      remainingTwoPoints: 2,
      cutTwoPoints: 3,
    },
    phase: 'playing',
    members: ['a', 'b', 'c'].map((uid) => ({ uid, name: uid })),
    scoreMembers: ['a', 'b', 'c'].map((uid) => ({ uid, name: uid, balance: 0, wins: 0 })),
    game: {
      status: 'finished',
      players: [
        { uid: 'a', hand: [], played: 13 },
        { uid: 'b', hand: [48, 4], played: 11 },
        { uid: 'c', hand: [51, 8], played: 11 },
      ],
      cutTwoEvents: [{ from: 'b', to: 'c', count: 1 }],
      result: {
        ranking: [
          { uid: 'a', rank: 1, labels: [] },
          { uid: 'b', rank: 2, labels: [] },
          { uid: 'c', rank: 3, labels: [] },
        ],
      },
    },
  };
  const settled = finishRoom(prior, structuredClone(prior));
  assert.deepEqual(
    settled.game.result.ranking.map((result) => result.moneyDelta),
    [8, -7, -1],
  );
  assert.equal(
    settled.game.result.ranking.reduce((sum, result) => sum + result.moneyDelta, 0),
    0,
  );
});

test('Sâm v2 settles báo thành công as a fixed per-opponent award without a second hand score', () => {
  const prior = {
    gameKind: 'sam',
    variantConfig: { rulesVersion: 'sam-v2', pointsPerCard: 1, samCallPoints: 20 },
    phase: 'playing',
    members: ['a', 'b', 'c'].map((uid) => ({ uid, name: uid })),
    scoreMembers: ['a', 'b', 'c'].map((uid) => ({ uid, name: uid, balance: 0, wins: 0 })),
    game: {
      status: 'finished',
      samOutcome: 'success',
      samCallRecipients: ['b', 'c'],
      callUid: 'a',
      players: [
        { uid: 'a', hand: [], played: 10 },
        { uid: 'b', hand: [1, 2], played: 8 },
        { uid: 'c', hand: [5], played: 9 },
      ],
      result: {
        reason: 'sam-success',
        ranking: [
          { uid: 'a', rank: 1, labels: [] },
          { uid: 'b', rank: 2, labels: [] },
          { uid: 'c', rank: 3, labels: [] },
        ],
      },
    },
  };
  const settled = finishRoom(prior, structuredClone(prior));
  assert.deepEqual(
    settled.game.result.ranking.map((result) => result.moneyDelta),
    [40, -20, -20],
  );
});

test('Sâm v2 keeps the frozen failed-report roster and adds the regular remaining-card score', () => {
  const prior = {
    gameKind: 'sam',
    variantConfig: { rulesVersion: 'sam-v2', pointsPerCard: 1, samCallPoints: 20 },
    phase: 'playing',
    members: ['a', 'b', 'c'].map((uid) => ({ uid, name: uid })),
    scoreMembers: ['a', 'b', 'c'].map((uid) => ({ uid, name: uid, balance: 0, wins: 0 })),
    game: {
      status: 'finished',
      samOutcome: 'failed',
      samCallRecipients: ['a', 'c'],
      callUid: 'b',
      players: [
        { uid: 'a', hand: [], played: 10 },
        { uid: 'b', hand: [1, 2], played: 8 },
        { uid: 'c', hand: [5], played: 9 },
      ],
      result: {
        reason: 'played-out',
        ranking: [
          { uid: 'a', rank: 1, labels: [] },
          { uid: 'b', rank: 2, labels: [] },
          { uid: 'c', rank: 3, labels: [] },
        ],
      },
    },
  };
  const settled = finishRoom(prior, structuredClone(prior));
  assert.deepEqual(
    settled.game.result.ranking.map((result) => result.moneyDelta),
    [23, -42, 19],
  );
  assert.equal(
    settled.game.result.ranking.reduce((sum, result) => sum + result.moneyDelta, 0),
    0,
  );
});

test('Tấn scores the last player by their remaining hand, zero-sum', () => {
  const prior = {
    gameKind: 'tan',
    phase: 'playing',
    members: ['a', 'b', 'c'].map((uid) => ({ uid, name: uid })),
    scoreMembers: ['a', 'b', 'c'].map((uid) => ({ uid, name: uid, balance: 0, wins: 0 })),
    game: {
      status: 'finished',
      players: [
        { uid: 'a', hand: [], played: 8 },
        { uid: 'b', hand: [], played: 8 },
        { uid: 'c', hand: [12, 16], played: 4 },
      ],
      result: {
        ranking: [
          { uid: 'a', rank: 1, labels: [] },
          { uid: 'b', rank: 2, labels: [] },
          { uid: 'c', rank: 3, labels: [] },
        ],
      },
    },
  };
  const settled = finishRoom(prior, structuredClone(prior));
  assert.deepEqual(
    settled.game.result.ranking.map((result) => result.moneyDelta),
    [2, 2, -4],
  );
  assert.equal(
    settled.game.result.ranking.reduce((sum, result) => sum + result.moneyDelta, 0),
    0,
  );
});

test('Tấn applies its saved points-per-card rate and keeps forfeits at zero', () => {
  const prior = {
    gameKind: 'tan',
    variantConfig: { pointsPerCard: 3 },
    phase: 'playing',
    members: ['a', 'b', 'c'].map((uid) => ({ uid, name: uid })),
    scoreMembers: ['a', 'b', 'c'].map((uid) => ({ uid, name: uid, balance: 0, wins: 0 })),
    game: {
      status: 'finished',
      players: [
        { uid: 'a', hand: [], played: 8 },
        { uid: 'b', hand: [12, 16], played: 6 },
        { uid: 'c', hand: [1], played: 7 },
      ],
      result: {
        ranking: [
          { uid: 'a', rank: 1, labels: [] },
          { uid: 'b', rank: 2, labels: [] },
          { uid: 'c', rank: 3, labels: ['forfeit'] },
        ],
      },
    },
  };
  const settled = finishRoom(prior, structuredClone(prior));
  assert.deepEqual(
    settled.game.result.ranking.map((result) => result.moneyDelta),
    [6, -6, 0],
  );
  assert.equal(
    settled.game.result.ranking.reduce((sum, result) => sum + result.moneyDelta, 0),
    0,
  );
});

for (const gameKind of ['south', 'phom', 'north', 'sam', 'tan']) {
  test(`${gameKind} preserves names of players who departed before the final forfeit`, () => {
    let state = {
      ...lobby(),
      gameKind,
      phomConfig: DEFAULT_PHOM_CONFIG,
      amountPerCard: 2,
      members: [
        ...structuredClone(members),
        { uid: 'c', name: 'Chi', ready: true, wins: 0 },
      ],
    };
    state = updateRoom(
      state,
      'a',
      { type: 'start' },
      0,
      Array.from({ length: 52 }, (_, i) => i),
    );
    assert.equal(state.phase, 'playing');
    state = updateRoom(state, 'b', { type: 'leave' }, 1);
    state = updateRoom(state, 'c', { type: 'leave' }, 2);
    assert.equal(state.phase, 'finished');
    assert.equal(
      state.game.result.ranking.find((p) => p.uid === 'b').name,
      'Bình',
    );
    assert.equal(
      state.game.result.ranking.find((p) => p.uid === 'c').name,
      'Chi',
    );
    assert.equal(
      state.game.result.ranking.reduce((sum, p) => sum + p.moneyDelta, 0),
      0,
    );
  });
}

test('Sam room dispatches the report phase through game-action and preserves its rules kind', () => {
  let state = {
    ...lobby(),
    gameKind: 'sam',
    variantConfig: { rulesVersion: 'sam-v2', pointsPerCard: 1, samCallPoints: 20 },
    members: structuredClone(members),
  };
  state = updateRoom(state, 'a', { type: 'start' }, 0, deck);
  assert.equal(state.game.step, 'report-sam');
  assert.equal(state.game.rulesVersion, 'sam-v2');
  state = updateRoom(
    state,
    'a',
    { type: 'game-action', gameAction: { type: 'call-sam' } },
    1,
  );
  assert.equal(state.game.step, 'play');
  assert.equal(state.game.callUid, 'a');
  assert.deepEqual(state.game.samCallRecipients, ['b']);
  assert.throws(
    () => updateRoom(state, 'b', { type: 'play', cards: [1] }, 2),
    /invalid-action/,
  );
  const snapshot = roomSnapshot(
    {
      id: '11111111-1111-4111-8111-111111111111',
      code: 'ABCDEFGH',
      version: 1,
      epoch: '22222222-2222-4222-8222-222222222222',
      match_id: null,
      state,
    },
    'a',
    true,
    2,
  );
  assert.equal(snapshot.room.gameKind, 'sam');
  assert.equal(snapshot.room.game.step, 'play');
});

test('Tấn scores an all-out draw as zero for everyone', () => {
  const prior = {
    gameKind: 'tan',
    phase: 'playing',
    members: ['a', 'b'].map((uid) => ({ uid, name: uid, wins: 0 })),
    scoreMembers: ['a', 'b'].map((uid) => ({ uid, name: uid, balance: 0, wins: 0 })),
    game: {
      status: 'finished',
      players: [
        { uid: 'a', hand: [], played: 8 },
        { uid: 'b', hand: [], played: 8 },
      ],
      result: {
        reason: 'all-out',
        ranking: [
          { uid: 'a', rank: 1, labels: [] },
          { uid: 'b', rank: 2, labels: [] },
        ],
      },
    },
  };
  const settled = finishRoom(prior, structuredClone(prior));
  assert.deepEqual(
    settled.game.result.ranking.map((result) => result.moneyDelta),
    [0, 0],
  );
  assert.equal(settled.scoreMembers.every((player) => player.wins === 0), true);
});

test('Tấn does not reward forfeited players as if they had emptied their hands', () => {
  const prior = {
    gameKind: 'tan',
    phase: 'playing',
    members: ['a', 'b', 'c'].map((uid) => ({ uid, name: uid, wins: 0 })),
    scoreMembers: ['a', 'b', 'c'].map((uid) => ({ uid, name: uid, balance: 0, wins: 0 })),
    game: {
      status: 'finished',
      players: [
        { uid: 'a', hand: Array.from({ length: 8 }, (_, i) => i), played: 0 },
        { uid: 'b', hand: Array.from({ length: 6 }, (_, i) => i + 8), played: 2 },
        { uid: 'c', hand: Array.from({ length: 3 }, (_, i) => i + 14), played: 5 },
      ],
      result: {
        reason: 'forfeit',
        ranking: [
          { uid: 'c', rank: 1, labels: [] },
          { uid: 'b', rank: 2, labels: ['forfeit'] },
          { uid: 'a', rank: 3, labels: ['forfeit'] },
        ],
      },
    },
  };
  const settled = finishRoom(prior, structuredClone(prior));
  assert.deepEqual(
    settled.game.result.ranking.map((result) => result.moneyDelta),
    [0, 0, 0],
  );
  assert.equal(
    settled.game.result.ranking.reduce((sum, result) => sum + result.moneyDelta, 0),
    0,
  );
});

test('result names use the current anonymized score roster after erasure', () => {
  let state = {
    ...lobby(),
    members: [
      ...structuredClone(members),
      { uid: 'c', name: 'Chi', ready: true, wins: 0 },
    ],
  };
  state = updateRoom(
    state,
    'a',
    { type: 'start' },
    0,
    Array.from({ length: 52 }, (_, i) => i),
  );
  state = updateRoom(state, 'b', { type: 'leave' }, 1);
  state.scoreMembers.find((p) => p.uid === 'b').name = 'Người chơi đã xóa';
  state = updateRoom(state, 'c', { type: 'leave' }, 2);
  assert.equal(
    state.game.result.ranking.find((p) => p.uid === 'b').name,
    'Người chơi đã xóa',
  );
});

test('joining preserves the readiness of players already waiting', () => {
  const waiting = { ...lobby(), members: [structuredClone(members[0])] };
  const joined = updateRoom(waiting, 'b', { type: 'join', name: 'Bình' }, 100);
  assert.deepEqual(
    joined.members.map((p) => [p.uid, p.ready]),
    [
      ['a', true],
      ['b', false],
    ],
  );
  const started = updateRoom(
    joined,
    'b',
    { type: 'ready', ready: true },
    200,
    deck,
  );
  assert.ok(['playing', 'finished'].includes(started.phase));
  assert.equal(waiting.members[0].ready, true);
});

test('starting an instant-win lobby scores once and finished players ready explicitly', () => {
  const finished = updateRoom(lobby(), 'a', { type: 'start' }, 100, deck);
  assert.equal(finished.phase, 'finished');
  assert.equal(finished.members[0].wins, 1);
  const ready = updateRoom(finished, 'a', { type: 'ready', ready: true }, 200);
  assert.equal(ready.members[0].ready, true);
  assert.equal(ready.members[0].wins, 1);
  assert.equal(ready.phase, 'finished');
});

test('the final explicit ready starts and settles a rematch, including an instant win', () => {
  let state = updateRoom(lobby(), 'a', { type: 'start' }, 100, deck);
  assert.equal(state.phase, 'finished');
  const priorWins = state.scoreMembers.find(
    (player) => player.uid === 'a',
  ).wins;

  state = updateRoom(state, 'a', { type: 'ready', ready: true }, 200);
  assert.equal(state.phase, 'finished');
  assert.equal(
    shouldStartRematch(state, 'b', { type: 'ready', ready: true }),
    true,
  );

  state = updateRoom(state, 'b', { type: 'ready', ready: true }, 300, deck);
  assert.equal(state.phase, 'finished'); // deterministic deck is an instant win
  assert.equal(state.game.status, 'finished');
  assert.equal(
    state.members.every((player) => !player.ready),
    true,
  );
  assert.equal(
    state.scoreMembers.find((player) => player.uid === 'a').wins,
    priorWins + 1,
  );
  assert.throws(
    () => updateRoom(state, 'a', { type: 'start' }, 400, deck),
    /not-ready/,
  );
});

test('a rematch waits until every current member is ready', () => {
  const finished = updateRoom(lobby(), 'a', { type: 'start' }, 100, deck);
  const hostReady = updateRoom(
    finished,
    'a',
    { type: 'ready', ready: true },
    200,
  );
  assert.equal(hostReady.phase, 'finished');
  assert.equal(hostReady.members[0].ready, true);
  assert.equal(hostReady.members[1].ready, false);
  assert.equal(
    shouldStartRematch(hostReady, 'b', { type: 'ready', ready: true }),
    true,
  );
  assert.equal(
    shouldStartRematch(hostReady, 'a', { type: 'ready', ready: false }),
    false,
  );
  assert.equal(
    shouldStartRematch({ ...hostReady, members: [hostReady.members[0]] }, 'a', {
      type: 'ready',
      ready: true,
    }),
    false,
  );
});

test('host can start only after every other seated player is ready', () => {
  const notReady = lobby();
  notReady.members[1].ready = false;
  assert.throws(
    () => updateRoom(notReady, 'a', { type: 'start' }, 100, deck),
    /not-ready/,
  );
  const started = updateRoom(lobby(), 'a', { type: 'start' }, 100, deck);
  assert.ok(['playing', 'finished'].includes(started.phase));
  const hostUnready = lobby();
  hostUnready.members[0].ready = false;
  assert.ok(
    ['playing', 'finished'].includes(
      updateRoom(hostUnready, 'a', { type: 'start' }, 100, deck).phase,
    ),
  );
});

test('only the current room owner can reopen an empty lobby', () => {
  const initial = lobby();
  const hostLeft = updateRoom(initial, 'a', { type: 'leave' }, 100);
  assert.equal(hostLeft.host, 'b');
  const empty = updateRoom(hostLeft, 'b', { type: 'leave' }, 150);

  assert.equal(empty.phase, 'lobby');
  assert.equal(empty.host, null);
  assert.equal(empty.ownerUid, 'a');

  assert.throws(
    () => updateRoom(empty, 'c', { type: 'join', name: 'Chi' }, 250),
    /room-not-found/,
  );

  const ownerReturns = updateRoom(
    empty,
    'a',
    { type: 'reopen', name: 'An' },
    300,
  );
  assert.equal(ownerReturns.host, 'a');
  assert.equal(ownerReturns.ownerUid, 'a');
  assert.equal(ownerReturns.phase, 'lobby');
  assert.deepEqual(
    ownerReturns.members.map(({ uid }) => uid),
    ['a'],
  );
});

test('the current room owner may transfer ownership to a seated player', () => {
  const state = { ...lobby(), ownerUid: 'a' };
  const transferred = updateRoom(
    state,
    'a',
    { type: 'transfer-owner', targetUid: 'b' },
    100,
  );

  assert.equal(transferred.ownerUid, 'b');
  assert.equal(transferred.host, 'b');
  assert.throws(
    () =>
      updateRoom(
        transferred,
        'a',
        { type: 'transfer-owner', targetUid: 'a' },
        200,
      ),
    /not-owner/,
  );
});

test('reopening an expired room keeps its identity and prior score members', () => {
  const expired = {
    ...lobby(),
    ownerUid: 'a',
    phase: 'closed',
    host: null,
    members: [],
    scoreMembers: [
      { ...members[0], balance: 3 },
      { ...members[1], balance: -3 },
    ],
  };

  assert.throws(
    () => updateRoom(expired, 'b', { type: 'reopen', name: 'Bình' }, 100),
    /not-owner/,
  );
  const reopened = updateRoom(
    expired,
    'a',
    { type: 'reopen', name: 'An' },
    100,
  );
  assert.equal(reopened.phase, 'lobby');
  assert.equal(reopened.ownerUid, 'a');
  assert.deepEqual(reopened.members, [
    { uid: 'a', name: 'An', ready: false, wins: 0, balance: 3 },
  ]);
  assert.equal(reopened.scoreMembers[1].balance, -3);
});

test('worker lease cleanup retains an empty lobby until its room expires', () => {
  const hostLeft = updateRoom(lobby(), 'a', { type: 'leave' }, 100);
  const emptyLobby = updateRoom(hostLeft, 'b', { type: 'leave' }, 150);
  const record = {
    state: emptyLobby,
    expired: ['a'],
    expires_at: new Date(10000).toISOString(),
  };

  const leaseExpired = advanceExpiredRoom(record, 200);
  assert.equal(leaseExpired.state.phase, 'lobby');
  assert.equal(leaseExpired.state.host, null);

  const roomExpired = advanceExpiredRoom(record, 10000);
  assert.equal(roomExpired.state.phase, 'lobby');
  assert.equal(roomExpired.state.ownerUid, 'a');
  assert.equal(roomExpired.state.members.length, 0);
});

test('the first match starts when every lobby member is ready', () => {
  const waiting = lobby();
  waiting.members.forEach((member) => {
    member.ready = false;
  });

  const hostReady = updateRoom(
    waiting,
    'a',
    { type: 'ready', ready: true },
    100,
  );
  assert.equal(hostReady.phase, 'lobby');
  assert.equal(hostReady.members[0].ready, true);
  assert.equal(hostReady.members[1].ready, false);

  const started = updateRoom(
    hostReady,
    'b',
    { type: 'ready', ready: true },
    200,
    deck,
  );
  assert.ok(['playing', 'finished'].includes(started.phase));
  assert.equal(started.game.status, 'finished'); // deterministic deck is an instant win
  assert.equal(
    started.members.every((member) => !member.ready),
    true,
  );
});

test('only the original owner can reopen a finished room after every player leaves', () => {
  const initial = lobby();
  initial.amountPerCard = 1;
  let state = updateRoom(initial, 'a', { type: 'start' }, 100, deck);
  const priorTotals = Object.fromEntries(
    state.scoreMembers.map((member) => [
      member.uid,
      { wins: member.wins, balance: member.balance },
    ]),
  );
  state = updateRoom(state, 'a', { type: 'leave' }, 200);
  state = updateRoom(state, 'b', { type: 'leave' }, 300);

  assert.equal(state.phase, 'finished');
  assert.equal(state.members.length, 0);

  assert.throws(
    () => updateRoom(state, 'c', { type: 'join', name: 'Chi' }, 400),
    /room-not-found/,
  );

  state = updateRoom(state, 'a', { type: 'join', name: 'An' }, 400);
  assert.equal(state.phase, 'finished');
  assert.equal(state.host, 'a');
  assert.deepEqual(
    state.members.map((member) => member.uid),
    ['a'],
  );

  state = updateRoom(state, 'c', { type: 'join', name: 'Chi' }, 500);
  assert.deepEqual(
    {
      wins: state.members.find((member) => member.uid === 'a').wins,
      balance: state.members.find((member) => member.uid === 'a').balance,
    },
    priorTotals.a,
  );
  assert.deepEqual(
    {
      wins: state.scoreMembers.find((member) => member.uid === 'b').wins,
      balance: state.scoreMembers.find((member) => member.uid === 'b').balance,
    },
    priorTotals.b,
  );
});

test('finished rooms survive seat and room expiry for owner reactivation', () => {
  const state = updateRoom(lobby(), 'a', { type: 'start' }, 100, deck);
  const record = {
    state,
    expired: ['a', 'b'],
    expires_at: new Date(10000).toISOString(),
  };
  const expiredSeats = advanceExpiredRoom(record, 200);
  assert.equal(expiredSeats.state.phase, 'finished');
  assert.equal(expiredSeats.state.members.length, 0);
  assert.equal(
    updateRoom(expiredSeats.state, 'a', { type: 'join', name: 'An' }, 300).host,
    'a',
  );
  assert.equal(advanceExpiredRoom(record, 10000).state.phase, 'finished');
});

test('room expiry settles an already completed winner and keeps the room', () => {
  const state = updateRoom(lobby(), 'a', { type: 'start' }, 100, deck);
  state.game.finishOrder = ['a'];
  state.game.players.find((player) => player.uid === 'a').hand = [];
  state.members.push({ uid: 'c', name: 'Chi', ready: false, wins: 0 });
  state.game.players.push({ uid: 'c', hand: [] });
  const settled = advanceExpiredRoom(
    {
      state,
      expired: ['b'],
      expires_at: new Date(1000).toISOString(),
    },
    2000,
  );

  assert.equal(settled.state.phase, 'finished');
  assert.equal(settled.state.game.status, 'finished');
  assert.equal(settled.state.game.result.ranking[0].uid, 'a');
  assert.equal(
    settled.state.scoreMembers.find(({ uid }) => uid === 'a').wins,
    1,
  );
});

test('snapshot uses explicit privacy projection, including members joining after a match', () => {
  const state = lobby();
  state.game = newTienLenGame(['a', 'b'], deck, 100);
  const record = {
    id: 'id',
    code: 'ABCDEFGH',
    version: 1,
    epoch: 'epoch',
    match_id: 'match',
    state,
  };
  const legacyValue = roomSnapshot(record, 'a', true, 100);
  assert.equal('ownerUid' in legacyValue.room, false);
  assert.equal('balance' in legacyValue.room.members[0], false);
  const value = roomSnapshot(record, 'a', true, 100, true);
  assert.equal(value.room.ownerUid, 'a');
  assert.ok(!JSON.stringify(value).includes('stock'));
  assert.ok(!value.room.game.players.some((p) => 'hand' in p));
  state.members.push({ uid: 'c', name: 'Chi', ready: false, wins: 0 });
  assert.equal(roomSnapshot(record, 'c', true, 100).room.game, null);
  assert.throws(
    () => roomSnapshot(record, 'outsider', true, 100),
    /not-member/,
  );
});

test('variant snapshots keep legacy fields on protocol 10 and expose v2 profiles only on protocol 11', () => {
  const state = {
    ...lobby(),
    gameKind: 'north',
    variantConfig: { pointsPerCard: 3 },
    nextVariantConfig: { pointsPerCard: 5 },
  };
  const record = {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'ABCDEFGH',
    version: 1,
    epoch: '22222222-2222-4222-8222-222222222222',
    match_id: null,
    state,
  };
  const oldClient = roomSnapshot(record, 'a', true, 0, false, 9);
  const currentClient = roomSnapshot(record, 'a', true, 0, false, 10);
  assert.equal(oldClient.room.variantConfig, undefined);
  assert.equal(oldClient.room.nextVariantConfig, undefined);
  assert.deepEqual(currentClient.room.nextVariantConfig, { pointsPerCard: 5 });
  const v2Record = {
    ...record,
    state: {
      ...state,
      variantConfig: {
        rulesVersion: 'north-v2',
        pointsPerCard: 1,
        remainingTwoPoints: 2,
        cutTwoPoints: 3,
      },
      nextVariantConfig: {
        rulesVersion: 'north-v2',
        pointsPerCard: 3,
        remainingTwoPoints: 4,
        cutTwoPoints: 5,
      },
    },
  };
  assert.deepEqual(
    roomSnapshot(v2Record, 'a', true, 0, false, 10).room.nextVariantConfig,
    { pointsPerCard: 3 },
  );
  assert.deepEqual(
    roomSnapshot(v2Record, 'a', true, 0, false, 11).room.variantConfig,
    v2Record.state.variantConfig,
  );
  assert.deepEqual(
    roomSnapshot(v2Record, 'a', true, 0, false, 11).room.nextVariantConfig,
    v2Record.state.nextVariantConfig,
  );
});

test('starting a new variant match promotes the saved next config', () => {
  const state = {
    ...lobby(),
    host: 'a',
    gameKind: 'north',
    variantConfig: { pointsPerCard: 2 },
    nextVariantConfig: {
      rulesVersion: 'north-v2',
      pointsPerCard: 7,
      remainingTwoPoints: 4,
      cutTwoPoints: 5,
    },
    members: [
      { uid: 'a', name: 'An', ready: true, wins: 0 },
      { uid: 'b', name: 'Bình', ready: true, wins: 0 },
    ],
  };
  const started = updateRoom(state, 'a', { type: 'start' }, 0, deck);
  assert.deepEqual(started.variantConfig, {
    rulesVersion: 'north-v2',
    pointsPerCard: 7,
    remainingTwoPoints: 4,
    cutTwoPoints: 5,
  });
  assert.equal(started.game.rulesVersion, 'north-v2');
});

test('the final ready action starts the saved North and Sâm v2 engines', () => {
  const profiles = {
    north: {
      rulesVersion: 'north-v2',
      pointsPerCard: 1,
      remainingTwoPoints: 2,
      cutTwoPoints: 3,
    },
    sam: { rulesVersion: 'sam-v2', pointsPerCard: 1, samCallPoints: 20 },
  };
  for (const [gameKind, variantConfig] of Object.entries(profiles)) {
    const waiting = {
      ...lobby(),
      gameKind,
      variantConfig,
      members: structuredClone(members),
    };
    waiting.members[1].ready = false;
    const started = updateRoom(
      waiting,
      'b',
      { type: 'ready', ready: true },
      100,
      deck,
    );
    assert.equal(started.game.rulesVersion, variantConfig.rulesVersion);
    assert.equal(started.phase, 'playing');
  }
});

test('realtime claims preserve other claims, skip repeat updates and reject revoked live identities', async () => {
  let updates = 0;
  const google = {
    lookup: async () => ({ localId: 'a', customAttributes: '{"admin":true}' }),
    setCustomClaims: async (uid, claims) => {
      assert.equal(uid, 'a');
      assert.deepEqual(claims, { admin: true, role: 'authenticated' });
      updates++;
    },
  };
  assert.equal(
    await ensureRealtimeRole({ uid: 'a', authTime: 100 }, google),
    true,
  );
  assert.equal(updates, 1);
  google.lookup = async () => ({
    localId: 'a',
    customAttributes: '{"admin":true,"role":"authenticated"}',
  });
  assert.equal(
    await ensureRealtimeRole({ uid: 'a', authTime: 100 }, google),
    false,
  );
  assert.equal(updates, 1);
  google.lookup = async () => ({ localId: 'a', validSince: '101' });
  await assert.rejects(
    ensureRealtimeRole({ uid: 'a', authTime: 100 }, google),
    /invalid-session/,
  );
});

test('handler rejects invalid tokens, browser origins and overposted identities', async () => {
  let valid = true,
    called = 0;
  const handler = createGameHandler({
    verifyIdentity: async () => {
      if (!valid) throw Error('bad token');
      return { uid: 'a', authTime: 100 };
    },
    rpc: async () => {
      called++;
      return { room: null, now: 100 };
    },
  });
  const body = {
    type: 'sync',
    sessionId: '11111111-1111-4111-8111-111111111111',
  };
  const req = (input, headers = {}) =>
    new Request('https://test.invalid', {
      method: 'POST',
      headers: {
        authorization: 'Bearer token',
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(input),
    });
  assert.equal(
    (await handler(req(body, { origin: 'https://evil.invalid' }))).status,
    405,
  );
  assert.equal((await handler(req({ ...body, uid: 'b' }))).status, 400);
  valid = false;
  assert.equal((await handler(req(body))).status, 401);
  assert.equal(called, 0);
});

test('delayed room commands cannot mutate a replacement room with the same version and match', async () => {
  const oldRoom = '11111111-1111-4111-8111-111111111111';
  let commits = 0;
  const handler = createGameHandler({
    verifyIdentity: async () => ({ uid: 'a', authTime: 100 }),
    rpc: async (name) => {
      if (name === 'lifemate_game_receipt') return null;
      if (name === 'lifemate_game_read')
        return {
          room: {
            id: '22222222-2222-4222-8222-222222222222',
            version: 1,
            match_id: null,
            state: lobby(),
          },
          now: 100,
        };
      commits++;
      throw Error('unexpected commit');
    },
  });
  for (const type of ['ready', 'leave']) {
    const response = await handler(
      new Request('https://test.invalid', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          sessionId: oldRoom,
          actionId: crypto.randomUUID(),
          roomId: oldRoom,
          expectedVersion: 1,
          matchId: null,
          ...(type === 'ready' ? { ready: true } : {}),
        }),
      }),
    );
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'room-conflict' });
  }
  assert.equal(commits, 0);
});

test('uses the committed room snapshot for ready actions without a second read', async () => {
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const id = '22222222-2222-4222-8222-222222222222';
  const epoch = '33333333-3333-4333-8333-333333333333';
  const actionId = crypto.randomUUID();
  let reads = 0;
  const before = {
    id,
    code: 'ABCDEFGH',
    version: 1,
    epoch,
    match_id: null,
    state: lobby(),
  };
  before.state.members[1].ready = false;
  let receipts = 0;
  const handler = createGameHandler({
    verifyIdentity: async () => ({ uid: 'b', authTime: 100 }),
    rpc: async (name) => {
      if (name === 'lifemate_game_receipt') {
        receipts++;
        return null;
      }
      if (name === 'lifemate_game_read') {
        reads++;
        return { room: before, now: 100 };
      }
      if (name === 'lifemate_game_commit') {
        const state = structuredClone(before.state);
        state.members[1].ready = true;
        return {
          ack: { roomId: id, version: 2 },
          record: { ...before, version: 2, state },
          controller: true,
          now: 200,
        };
      }
      throw Error(`unexpected rpc: ${name}`);
    },
  });
  const response = await handler(
    new Request('https://test.invalid', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'ready',
        sessionId,
        actionId,
        roomId: id,
        expectedVersion: 1,
        matchId: null,
        ready: true,
      }),
    }),
  );

  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.room.version, 2);
  assert.equal(result.room.members[1].ready, true);
  assert.deepEqual(result.ack, { roomId: id, version: 2 });
  assert.equal(reads, 1);
  assert.equal(receipts, 1);
});

test('a ready action returns before avatar signing finishes', async () => {
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const id = '22222222-2222-4222-8222-222222222222';
  const epoch = '33333333-3333-4333-8333-333333333333';
  const actionId = crypto.randomUUID();
  const before = {
    id,
    code: 'ABCDEFGH',
    version: 1,
    epoch,
    match_id: null,
    state: lobby(),
  };
  before.state.members[1].ready = false;
  let resolveAvatar;
  const pendingAvatar = new Promise((resolve) => {
    resolveAvatar = resolve;
  });
  let startAvatar;
  const avatarStarted = new Promise((resolve) => {
    startAvatar = resolve;
  });
  const backgroundTasks = [];
  const handler = createGameHandler({
    verifyIdentity: async () => ({ uid: 'b', authTime: 100 }),
    waitUntil: (promise) => backgroundTasks.push(promise),
    avatarStorage: () => {
      startAvatar();
      return pendingAvatar;
    },
    rpc: async (name) => {
      if (name === 'lifemate_game_receipt') return null;
      if (name === 'lifemate_game_read') return { room: before, now: 100 };
      if (name === 'lifemate_game_commit') {
        const state = structuredClone(before.state);
        state.members[1].ready = true;
        return {
          ack: { roomId: id, version: 2 },
          record: { ...before, version: 2, state },
          controller: true,
          now: 200,
        };
      }
      throw Error(`unexpected rpc: ${name}`);
    },
  });
  const responsePromise = handler(
    new Request('https://test.invalid', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'ready',
        clientVersion: 2,
        sessionId,
        actionId,
        roomId: id,
        expectedVersion: 1,
        matchId: null,
        ready: true,
      }),
    }),
  );
  let settled = false;
  void responsePromise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );

  await avatarStarted;
  const earlyResponse = await Promise.race([
    responsePromise,
    new Promise((resolve) => setTimeout(() => resolve(null), 0)),
  ]);
  const returnedBeforeAvatar = earlyResponse !== null;
  resolveAvatar('https://example.invalid/avatar');
  const response = earlyResponse ?? (await responsePromise);
  await Promise.all(backgroundTasks);

  assert.equal(returnedBeforeAvatar, true);
  assert.equal(settled, true);
  assert.equal(backgroundTasks.length, 2);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.room.members[1].avatarUrl, null);
  assert.equal(result.room.members[1].ready, true);
});

test('a concurrent duplicate ready rechecks its receipt only after the room moved', async () => {
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const id = '22222222-2222-4222-8222-222222222222';
  const epoch = '33333333-3333-4333-8333-333333333333';
  const matchId = '44444444-4444-4444-8444-444444444444';
  const actionId = crypto.randomUUID();
  let receipts = 0;
  let reads = 0;
  let commits = 0;
  const moved = {
    id,
    code: 'ABCDEFGH',
    version: 2,
    epoch,
    match_id: matchId,
    state: { ...lobby(), phase: 'playing' },
  };
  const ack = { roomId: id, version: 2 };
  const handler = createGameHandler({
    verifyIdentity: async () => ({ uid: 'b', authTime: 100 }),
    rpc: async (name) => {
      if (name === 'lifemate_game_receipt')
        return ++receipts === 1 ? null : ack;
      if (name === 'lifemate_game_read') {
        reads++;
        return { room: moved, now: 200 };
      }
      if (name === 'lifemate_game_commit') commits++;
      throw Error(`unexpected rpc: ${name}`);
    },
  });
  const response = await handler(
    new Request('https://test.invalid', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'ready',
        sessionId,
        actionId,
        roomId: id,
        expectedVersion: 1,
        matchId: null,
        ready: true,
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).ack, ack);
  assert.equal(receipts, 2);
  assert.equal(reads, 2);
  assert.equal(commits, 0);
});

test('commits the final rematch-ready action as a new match transaction', async () => {
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const id = '22222222-2222-4222-8222-222222222222';
  const oldMatchId = '33333333-3333-4333-8333-333333333333';
  const newMatchId = '44444444-4444-4444-8444-444444444444';
  const finished = updateRoom(lobby(), 'a', { type: 'start' }, 100, deck);
  finished.members[0].ready = true;
  const before = {
    id,
    code: 'ABCDEFGH',
    version: 2,
    epoch: '55555555-5555-4555-8555-555555555555',
    match_id: oldMatchId,
    state: finished,
  };
  let commitKind;
  const handler = createGameHandler({
    verifyIdentity: async () => ({ uid: 'b', authTime: 100 }),
    deck: () => deck,
    rpc: async (name, params) => {
      if (name === 'lifemate_game_receipt') return null;
      if (name === 'lifemate_game_read') return { room: before, now: 200 };
      if (name === 'lifemate_game_commit') {
        commitKind = params.p_kind;
        return {
          ack: { roomId: id, version: 3 },
          record: {
            ...before,
            version: 3,
            match_id: newMatchId,
            state: params.p_state,
          },
          controller: true,
          now: 300,
        };
      }
      throw Error(`unexpected rpc: ${name}`);
    },
  });
  const response = await handler(
    new Request('https://test.invalid', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'ready',
        sessionId,
        actionId: crypto.randomUUID(),
        roomId: id,
        expectedVersion: 2,
        matchId: oldMatchId,
        ready: true,
      }),
    }),
  );

  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(commitKind, 'start');
  assert.equal(result.room.matchId, newMatchId);
  assert.ok(['playing', 'finished'].includes(result.room.phase));
  assert.equal(
    result.room.members.every((player) => !player.ready),
    true,
  );
});

test('HTTP final-ready starts v2 and the returned client can immediately make its first move', async () => {
  const profiles = [
    [
      'north',
      {
        rulesVersion: 'north-v2',
        pointsPerCard: 1,
        remainingTwoPoints: 2,
        cutTwoPoints: 3,
      },
    ],
    [
      'sam',
      { rulesVersion: 'sam-v2', pointsPerCard: 1, samCallPoints: 20 },
    ],
  ];

  for (const [gameKind, variantConfig] of profiles) {
    const id = crypto.randomUUID();
    const epoch = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    let uid = 'b';
    let record = {
      id,
      code: 'ABCDEFGH',
      version: 1,
      epoch,
      match_id: null,
      state: {
        ...lobby(),
        gameKind,
        variantConfig,
        members: structuredClone(members),
      },
    };
    record.state.members[1].ready = false;
    const handler = createGameHandler({
      verifyIdentity: async () => ({ uid, authTime: 100 }),
      deck: () => deck,
      rpc: async (name, params = {}) => {
        if (name === 'lifemate_game_receipt') return null;
        if (name === 'lifemate_game_read') return { room: record, now: 100 };
        if (name === 'lifemate_game_commit') {
          record = {
            ...record,
            version: record.version + 1,
            match_id:
              params.p_kind === 'start' ? crypto.randomUUID() : record.match_id,
            state: params.p_state,
          };
          return {
            ack: { roomId: id, version: record.version },
            record,
            controller: true,
            now: 200,
          };
        }
        throw Error(`unexpected rpc: ${name}`);
      },
    });
    const send = async (body) =>
      handler(
        new Request('https://test.invalid/game-access', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer test',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientVersion: 11,
            sessionId,
            actionId: crypto.randomUUID(),
            roomId: id,
            expectedVersion: record.version,
            matchId: record.match_id,
            ...body,
          }),
        }),
      );

    const ready = await send({ type: 'ready', ready: true });
    assert.equal(ready.status, 200, `${gameKind}: ${await ready.clone().text()}`);
    let result = await ready.json();
    assert.equal(result.room.phase, 'playing');
    assert.equal(result.room.game.rulesVersion, variantConfig.rulesVersion);

    uid = record.state.game.turn;
    const firstMove =
      gameKind === 'north'
        ? await send({
            type: 'play',
            cards: [
              record.state.game.players
                .find((player) => player.uid === uid)
                .hand.find((card) => card === record.state.game.openingCard),
            ],
          })
        : await send({
            type: 'game-action',
            gameAction: { type: 'call-sam' },
          });
    assert.equal(firstMove.status, 200, `${gameKind}: ${await firstMove.clone().text()}`);
    result = await firstMove.json();
    assert.equal(result.room.game.rulesVersion, variantConfig.rulesVersion);
    assert.equal(
      gameKind === 'north' ? result.room.game.table.uid : result.room.game.step,
      gameKind === 'north' ? uid : 'play',
    );
  }
});

test('revocation during a streamed body is checked again before database work', async () => {
  let count = 0,
    called = 0,
    feed;
  let firstVerified;
  const verified = new Promise((resolve) => {
    firstVerified = resolve;
  });
  const handler = createGameHandler({
    verifyIdentity: async () => {
      if (++count === 1) {
        firstVerified();
        return { uid: 'a', authTime: 100 };
      }
      throw Error('revoked');
    },
    rpc: async () => {
      called++;
    },
  });
  const stream = new ReadableStream({
    start(controller) {
      feed = controller;
    },
  });
  const response = handler(
    new Request('https://test.invalid', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: stream,
      duplex: 'half',
    }),
  );
  await verified;
  feed.enqueue(
    new TextEncoder().encode(
      JSON.stringify({
        type: 'sync',
        sessionId: '11111111-1111-4111-8111-111111111111',
      }),
    ),
  );
  feed.close();
  assert.equal((await response).status, 401);
  assert.equal(called, 0);
});
