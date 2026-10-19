import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHandler } from '../memory-access/handler.mjs';

function world(uid = 'alice', photo = null) {
  const calls = [];
  const handler = createHandler({
    verifyIdentity: async () => ({ uid, emailVerified: false }),
    database: async () =>
      assert.fail('private photos must not touch social data'),
    r2: async (...args) => {
      calls.push(args);
      return args[0] === 'head' ? photo : 'https://signed.example/photo';
    },
  });
  return {
    calls,
    send: async (input) =>
      handler(
        new Request('https://example.com', {
          method: 'POST',
          headers: {
            authorization: 'Bearer session',
            'content-type': 'application/json',
          },
          body: JSON.stringify(input),
        }),
      ),
  };
}
const input = {
  action: 'private-upload',
  id: 'one',
  fileName: 'original.heic',
  sizeBytes: 100,
};
test('unverified owners upload originals to their private R2 prefix without social side effects', async () => {
  const w = world();
  const response = await w.send(input);
  assert.equal(response.status, 200);
  assert.equal(
    (await response.json()).uploadUrl,
    'https://signed.example/photo',
  );
  assert.deepEqual(w.calls, [
    ['head', 'private/alice/one/original.heic'],
    ['upload', 'private/alice/one/original.heic', 100],
  ]);
});
test('private photos validate exact inputs, size and path and never accept a caller UID', async () => {
  for (const bad of [
    { ...input, ownerUid: 'bob' },
    { ...input, fileName: '../photo.jpg' },
    { ...input, id: '../bob' },
    { ...input, sizeBytes: 15728641 },
    { ...input, sizeBytes: 0 },
    { ...input, fileName: 'photo.exe' },
  ]) {
    const w = world();
    assert.equal((await w.send(bad)).status, 400);
    assert.equal(w.calls.length, 0);
  }
});
test('only a missing R2 object allows legacy fallback; failures remain failures', async () => {
  const w = world();
  const response = await w.send({
    action: 'private-download',
    id: 'one',
    fileName: 'photo.jpg',
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { photo: null });
  assert.deepEqual(w.calls, [['head', 'private/alice/one/photo.jpg']]);
});
test('existing private objects are immutable and confirmed against expected size and MIME', async () => {
  const w = world('alice', { sizeBytes: 100, contentType: 'image/heic' });
  const response = await w.send(input);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { photo: { sizeBytes: 100 } });
  assert.equal(w.calls.length, 1);
  const mismatch = world('alice', { sizeBytes: 99, contentType: 'image/heic' });
  assert.equal((await mismatch.send(input)).status, 409);
});
test('foreign owners only receive URLs for their own token UID', async () => {
  const w = world('bob', { sizeBytes: 100, contentType: 'image/heic' });
  const response = await w.send({
    action: 'private-download',
    id: 'one',
    fileName: 'original.heic',
  });
  assert.equal(response.status, 200);
  assert.deepEqual(w.calls, [
    ['head', 'private/bob/one/original.heic'],
    ['download', 'private/bob/one/original.heic'],
  ]);
});
test('private storage failures do not masquerade as missing legacy objects', async () => {
  const handler = createHandler({
    verifyIdentity: async () => ({ uid: 'alice', emailVerified: false }),
    r2: async () => {
      throw Error('offline');
    },
  });
  const response = await handler(
    new Request('https://example.com', {
      method: 'POST',
      headers: { authorization: 'Bearer session' },
      body: JSON.stringify({
        action: 'private-download',
        id: 'one',
        fileName: 'photo.jpg',
      }),
    }),
  );
  assert.equal(response.status, 503);
});

test('revocation during the request denies private signing', async () => {
  let checks = 0;
  const handler = createHandler({
    verifyIdentity: async () => {
      if (++checks > 1) throw Error('revoked');
      return { uid: 'alice', emailVerified: false };
    },
    r2: async () => assert.fail('must not access R2 after revocation'),
  });
  const response = await handler(
    new Request('https://example.com', {
      method: 'POST',
      headers: { authorization: 'Bearer session' },
      body: JSON.stringify(input),
    }),
  );
  assert.equal(response.status, 401);
});
