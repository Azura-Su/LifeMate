import assert from 'node:assert/strict';
import test from 'node:test';
import { updateRoom, roomSnapshot } from '../game-access/rooms.mjs';
import { newTienLenGame } from '../game-access/tienlen.mjs';
import { ensureRealtimeRole } from '../game-access/realtimeIdentity.mjs';
import { createGameHandler } from '../game-access/handler.mjs';

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

test('starting an instant-win game scores once and terminal lobby can ready for the next match', () => {
  const finished = updateRoom(lobby(), 'a', { type: 'start' }, 100, deck);
  assert.equal(finished.phase, 'finished');
  assert.equal(finished.members[0].wins, 1);
  const ready = updateRoom(finished, 'a', { type: 'ready', ready: true }, 200);
  assert.equal(ready.members[0].ready, true);
  assert.equal(ready.members[0].wins, 1);
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
  const value = roomSnapshot(record, 'a', true, 100);
  assert.ok(!JSON.stringify(value).includes('stock'));
  assert.ok(!value.room.game.players.some((p) => 'hand' in p));
  state.members.push({ uid: 'c', name: 'Chi', ready: false, wins: 0 });
  assert.equal(roomSnapshot(record, 'c', true, 100).room.game, null);
  assert.throws(
    () => roomSnapshot(record, 'outsider', true, 100),
    /not-member/,
  );
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
