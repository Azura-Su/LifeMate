import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameHandler } from '../game-access/handler.mjs';

test('kick rejects malformed version and match identifiers before database access', async () => {
  let calls = 0;
  const handler = createGameHandler({
    verifyIdentity: async () => ({ uid: 'owner', authTime: 100 }),
    rpc: async () => {
      calls++;
      throw Error('unexpected-rpc');
    },
  });
  const input = {
    type: 'kick',
    clientVersion: 2,
    sessionId: '11111111-1111-4111-8111-111111111111',
    actionId: '22222222-2222-4222-8222-222222222222',
    roomId: '33333333-3333-4333-8333-333333333333',
    expectedVersion: 1,
    matchId: null,
    targetUid: 'member',
  };
  for (const invalid of [
    { expectedVersion: 0 },
    { expectedVersion: -1 },
    { expectedVersion: 1.5 },
    { expectedVersion: '1' },
    { expectedVersion: null },
    { expectedVersion: Number.MAX_SAFE_INTEGER + 1 },
    { matchId: 'not-a-uuid' },
  ]) {
    const response = await handler(
      new Request('https://test.invalid', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer synthetic',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...input, ...invalid }),
      }),
    );
    assert.equal(response.status, 400, JSON.stringify(invalid));
    assert.deepEqual(await response.json(), { error: 'invalid-input' });
  }
  assert.equal(calls, 0);
});
