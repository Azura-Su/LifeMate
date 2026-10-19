import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHandler as createAudioHandler } from '../audio-access/handler.mjs';
import { createHandler as createMemoryHandler } from '../memory-access/handler.mjs';
import { ACCESS_TABLE, withAccountAccess } from '../_shared/accountAccess.mjs';

for (const kind of ['audio', 'memory']) {
  for (const change of ['disabled', 'deleting', 'deleted', 'revoked']) {
    test(`${kind} rejects an account revoked while the request body is still arriving: ${change}`, async () => {
      let status = 'active';
      let validSince = 0;
      let verified;
      const authorized = new Promise((resolve) => {
        verified = resolve;
      });
      const effects = [];
      const database = async (table) => {
        if (table === ACCESS_TABLE)
          return [{ status, valid_since: validSince }];
        effects.push(table);
        return [];
      };
      const gate = withAccountAccess(
        async () => ({
          uid: 'alice',
          email: 'alice@example.com',
          emailVerified: true,
          authTime: 100,
        }),
        database,
        true,
      );
      const verify = async (token) => {
        const identity = await gate(token);
        verified();
        return identity;
      };
      const handler =
        kind === 'audio'
          ? createAudioHandler({
              verifyToken: async (token) => (await verify(token)).uid,
              signObject: async () => {
                effects.push('sign');
                return 'https://example.invalid/signed';
              },
              reserveUpload: async () => {
                effects.push('reserve');
                return true;
              },
              confirmUpload: async () => {
                effects.push('confirm');
                return true;
              },
              releaseUpload: async () => {
                effects.push('release');
              },
            })
          : createMemoryHandler({
              verifyIdentity: verify,
              database,
              storage: async () => {
                effects.push('storage');
              },
              r2: async () => {
                effects.push('r2');
              },
            });
      const input =
        kind === 'audio'
          ? {
              action: 'upload',
              id: 'song',
              fileName: 'song.mp3',
              mimeType: 'audio/mpeg',
              sizeBytes: 1000,
            }
          : { action: 'state', displayName: 'Alice' };
      const stream = new ReadableStream({
        async start(controller) {
          await authorized;
          if (change === 'revoked') validSince = 101;
          else status = change;
          controller.enqueue(new TextEncoder().encode(JSON.stringify(input)));
          controller.close();
        },
      });
      const response = await handler(
        new Request('https://example.invalid', {
          method: 'POST',
          headers: { authorization: 'Bearer token' },
          body: stream,
          duplex: 'half',
        }),
      );
      assert.equal(response.status, 401);
      assert.deepEqual(effects, []);
    });
  }
  test(`${kind} rejects identity changes between initial and final verification`, async () => {
    let calls = 0;
    const effects = [];
    const verify = async () => ({
      uid: ++calls === 1 ? 'alice' : 'bob',
      emailVerified: true,
    });
    const handler =
      kind === 'audio'
        ? createAudioHandler({
            verifyToken: async () => (await verify()).uid,
            signObject: async () => {
              effects.push('sign');
              return '';
            },
            reserveUpload: async () => true,
            confirmUpload: async () => true,
            releaseUpload: async () => {},
          })
        : createMemoryHandler({
            verifyIdentity: verify,
            database: async () => {
              effects.push('database');
              return [];
            },
            storage: async () => {},
            r2: async () => {},
          });
    const response = await handler(
      new Request('https://example.invalid', {
        method: 'POST',
        headers: { authorization: 'Bearer token' },
        body: JSON.stringify(
          kind === 'audio'
            ? {
                action: 'download',
                id: 'song',
                fileName: 'song.mp3',
                mimeType: 'audio/mpeg',
                sizeBytes: 1000,
              }
            : { action: 'state', displayName: 'Alice' },
        ),
      }),
    );
    assert.equal(response.status, 401);
    assert.deepEqual(effects, []);
  });
}

test('memory uses the refreshed email verification before accessing shared data', async () => {
  let calls = 0;
  let effects = 0;
  const handler = createMemoryHandler({
    verifyIdentity: async () => ({
      uid: 'alice',
      emailVerified: ++calls === 1,
    }),
    database: async () => {
      effects++;
      return [];
    },
    storage: async () => {},
    r2: async () => {},
  });
  const response = await handler(
    new Request('https://example.invalid', {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify({ action: 'state', displayName: 'Alice' }),
    }),
  );
  assert.equal(response.status, 403);
  assert.equal(effects, 0);
});
