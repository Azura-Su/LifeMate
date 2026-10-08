import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createFirebaseVerifier } from '../audio-access/firebaseAuth.mjs';
import { createHandler } from '../audio-access/handler.mjs';

let key, verifyToken;
before(async () => {
  key = await generateKeyPair('RS256');
  const jwk = await exportJWK(key.publicKey);
  verifyToken = createFirebaseVerifier(
    'baseapp-dd227',
    createLocalJWKSet({ keys: [{ ...jwk, kid: 'test' }] }),
  );
});
async function token(overrides = {}, signingKey = key.privateKey) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: 'owner-1',
    aud: 'baseapp-dd227',
    iss: 'https://securetoken.google.com/baseapp-dd227',
    iat: now - 1,
    exp: now + 3600,
    auth_time: now - 10,
    ...overrides,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .sign(signingKey);
}
const body = {
  action: 'upload',
  id: 'song-1',
  fileName: 'song-1.mp3',
  mimeType: 'audio/mpeg',
  sizeBytes: 1000,
};
async function request(data = body, jwt) {
  return new Request('https://project.supabase.co/functions/v1/audio-access', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${jwt ?? (await token())}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}
test('accepts a signed Firebase token from the configured project', async () => {
  assert.equal(await verifyToken(await token()), 'owner-1');
});
for (const claims of [
  { aud: 'other-project' },
  { iss: 'https://attacker.test' },
  { exp: 1 },
  { iat: 9999999999 },
  { auth_time: 9999999999 },
  { auth_time: undefined },
  { sub: '' },
  { sub: '../other' },
]) {
  test(`rejects invalid Firebase claims ${JSON.stringify(claims)}`, async () => {
    await assert.rejects(() => token(claims).then(verifyToken));
  });
}
test('rejects a valid-looking token signed by someone else', async () => {
  const attacker = await generateKeyPair('RS256');
  await assert.rejects(() => token({}, attacker.privateKey).then(verifyToken));
});
test('derives paths from verified UID for both upload and download', async () => {
  const signed = [];
  const handler = createHandler({
    verifyToken,
    signObject: async (action, path) => {
      signed.push([action, path]);
      return 'https://project.supabase.co/signed';
    },
  });
  for (const action of ['upload', 'download']) {
    const response = await handler(await request({ ...body, action }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.deepEqual(signed, [
    ['upload', 'audio/owner-1/song-1/song-1.mp3'],
    ['download', 'audio/owner-1/song-1/song-1.mp3'],
  ]);
});
test('deletes only the authenticated user object without returning a URL', async () => {
  const deleted = [];
  const handler = createHandler({
    verifyToken,
    signObject: async (action, path) => {
      deleted.push([action, path]);
      return undefined;
    },
  });
  const response = await handler(await request({ ...body, action: 'delete' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });
  assert.deepEqual(deleted, [['delete', 'audio/owner-1/song-1/song-1.mp3']]);
});
test('deletes existing audio without requiring upload MIME or size metadata', async () => {
  const deleted = [];
  const handler = createHandler({
    verifyToken,
    signObject: async (action, path) => {
      deleted.push([action, path]);
    },
  });
  const response = await handler(
    await request({
      action: 'delete',
      id: body.id,
      fileName: body.fileName,
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });
  assert.deepEqual(deleted, [['delete', 'audio/owner-1/song-1/song-1.mp3']]);
});
test('never signs when auth is absent, forged or input tries another owner/path', async () => {
  let calls = 0;
  const handler = createHandler({
    verifyToken,
    signObject: () => {
      calls++;
      throw Error('must not sign');
    },
  });
  assert.equal((await handler(await request(body, 'forged'))).status, 401);
  assert.equal(
    (await handler(new Request('https://example.test', { method: 'POST' })))
      .status,
    401,
  );
  for (const invalid of [
    { ownerId: 'victim' },
    { path: 'audio/victim/song.mp3' },
    { id: '../victim' },
    { fileName: 'other.mp3' },
    { mimeType: 'video/mp4' },
    { sizeBytes: 52428801 },
    { sizeBytes: 0 },
    { action: 'remove' },
  ]) {
    assert.equal(
      (await handler(await request({ ...body, ...invalid }))).status,
      400,
    );
  }
  assert.equal(calls, 0);
});
test('does not expose upstream errors or credentials', async () => {
  const handler = createHandler({
    verifyToken,
    signObject: () => {
      throw Error('secret_key');
    },
  });
  const response = await handler(await request());
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes('secret_key'), false);
});
