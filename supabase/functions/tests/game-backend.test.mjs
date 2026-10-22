import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameBackend } from '../game-access/backend.mjs';
import { createGameHandler } from '../game-access/handler.mjs';

for (const [message, status] of [
  ['room-expired', 409],
  ['room-deleted', 410],
  ['room-not-finished', 409],
  ['room-not-expired', 409],
  ['not-owner', 403],
]) {
  test(`RPC ${message} reaches the client as ${status} instead of a retryable service outage`, async () => {
    const rpc = createGameBackend(
      'https://example.supabase.co',
      'test-key',
      async () => Response.json({ code: 'P0001', message }, { status: 400 }),
    );
    const handler = createGameHandler({
      verifyIdentity: async () => ({ uid: 'a', authTime: 1 }),
      rpc,
    });
    const result = await handler(
      new Request('https://example.invalid/game-access', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          type: 'room-status',
          clientVersion: 2,
          roomId: '22222222-2222-4222-8222-222222222222',
          sessionId: '11111111-1111-4111-8111-111111111111',
        }),
      }),
    );
    assert.equal(result.status, status);
    assert.deepEqual(await result.json(), { error: message });
  });
}

test('unknown database errors stay generic and do not expose internals', async () => {
  const rpc = createGameBackend(
    'https://example.supabase.co',
    'test-key',
    async () =>
      Response.json(
        { code: 'P0001', message: 'private database details' },
        { status: 500 },
      ),
  );
  await assert.rejects(rpc('lifemate_game_read'), {
    message: 'game-unavailable',
  });
});
