import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateScoreDocument,
  validateScorePatch,
} from '../game-access/scores.mjs';
import { createGameHandler } from '../game-access/handler.mjs';
const doc = () => ({
  title: 'Bàn',
  players: [
    { id: 'a', name: 'An' },
    { id: 'b', name: 'Bình' },
  ],
  seatOrder: ['a', 'b'],
  dealerPlayerId: 'a',
  rounds: [{ id: 'round-1', createdAt: 1, scores: { a: 10, b: -10 } }],
  status: 'active',
});
test('score documents reject spoofed authority, duplicate identities, unsafe scores and hidden fields', () => {
  assert.deepEqual(validateScoreDocument(doc()), doc());
  for (const mutate of [
    (d) => (d.ownerUid = 'b'),
    (d) => (d.audit = []),
    (d) => d.players.push(d.players[0]),
    (d) => d.rounds.push(d.rounds[0]),
    (d) => (d.rounds[0].scores.a = Number.MAX_SAFE_INTEGER + 1),
    (d) => (d.rounds[0].scores.outsider = 1),
    (d) => (d.players[0].name = '\u0000An'),
    (d) => (d.seatOrder = ['a', 'a']),
  ]) {
    const value = doc();
    mutate(value);
    assert.throws(() => validateScoreDocument(value), /invalid-input/);
  }
});
test('score routes use the freshly verified identity and bypass gameplay receipt/snapshot paths', async () => {
  const calls = [];
  const handler = createGameHandler({
    verifyIdentity: async () => ({ uid: 'a', authTime: 1 }),
    rpc: async (name, args) => {
      calls.push({ name, args });
      return name.endsWith('_list')
        ? { tables: [] }
        : { match: {}, canEdit: true };
    },
  });
  const input = {
    type: 'score-write',
    sessionId: '11111111-1111-4111-8111-111111111111',
    tableId: '22222222-2222-4222-8222-222222222222',
    actionId: '33333333-3333-4333-8333-333333333333',
    expectedVersion: 1,
    operation: 'save',
    document: doc(),
  };
  const response = await handler(
    new Request('https://game.invalid', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'lifemate_game_score_write');
  assert.equal(calls[0].args.p_uid, 'a');
  const invalid = await handler(
    new Request('https://game.invalid', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...input, document: { ...doc(), ownerUid: 'a' } }),
    }),
  );
  assert.equal(invalid.status, 400);
  assert.equal(calls.length, 1);
  const restore = await handler(
    new Request('https://game.invalid', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...input, operation: 'restore', document: null }),
    }),
  );
  assert.equal(restore.status, 400);
  assert.equal(calls.length, 1);
});

test('score patch validator bounds deltas and rejects authority, overlap and invalid scores', () => {
  const { rounds, ...settings } = doc();
  const patch = { settings, upsertRounds: rounds, deleteRoundIds: [] };
  assert.deepEqual(validateScorePatch(patch), patch);
  for (const bad of [
    { ...patch, ownerUid: 'b' },
    { ...patch, settings: { ...settings, ownerUid: 'b' } },
    { ...patch, settings: { ...settings, rounds } },
    {
      ...patch,
      upsertRounds: Array.from({ length: 101 }, (_, i) => ({
        ...rounds[0],
        id: `r-${i}`,
      })),
    },
    { ...patch, deleteRoundIds: ['round-1'] },
    { ...patch, deleteRoundIds: ['x', 'x'] },
    { ...patch, deleteRoundIds: ['../bad'] },
    { ...patch, upsertRounds: [{ ...rounds[0], scores: { outsider: 1 } }] },
  ])
    assert.throws(() => validateScorePatch(bad), /invalid-input/);
});
