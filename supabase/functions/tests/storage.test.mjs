import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStorageSigner } from '../audio-access/storage.mjs';

const origin = 'https://lifematetest.supabase.co';
const path = 'audio/u1/a/a.mp3';
for (const action of ['upload', 'download']) {
  test(`signs a ${action} URL for the private bucket using the Storage REST contract`, async () => {
    const endpoint = action === 'upload' ? 'object/upload/sign' : 'object/sign';
    const relative = `/${endpoint}/lifemate-audio/${path}?token=test`;
    const signer = createStorageSigner(
      origin,
      'server-secret',
      async (url, options) => {
        assert.equal(
          url,
          `${origin}/storage/v1/${endpoint}/lifemate-audio/${path}`,
        );
        assert.equal(options.redirect, 'error');
        assert.deepEqual(
          JSON.parse(options.body),
          action === 'upload' ? {} : { expiresIn: 300 },
        );
        return Response.json(
          action === 'upload' ? { url: relative } : { signedURL: relative },
        );
      },
    );
    assert.equal(await signer(action, path), `${origin}/storage/v1${relative}`);
  });
}
test('deletes one authorized object through the Storage API', async () => {
  const signer = createStorageSigner(
    origin,
    'server-secret',
    async (url, options) => {
      assert.equal(url, `${origin}/storage/v1/object/lifemate-audio/${path}`);
      assert.equal(options.method, 'DELETE');
      assert.equal(options.headers.Authorization, 'Bearer server-secret');
      return new Response('', { status: 200 });
    },
  );
  assert.equal(await signer('delete', path), undefined);
});
test('treats a missing object as already deleted but rejects other failures', async () => {
  for (const response of [
    new Response('', { status: 404 }),
    new Response('Object not found', { status: 400 }),
  ]) {
    const signer = createStorageSigner(origin, 'secret', async () => response);
    assert.equal(await signer('delete', path), undefined);
  }
  const failed = createStorageSigner(
    origin,
    'secret',
    async () => new Response('', { status: 500 }),
  );
  await assert.rejects(() => failed('delete', path));
});
test('rejects upstream failure and any signed URL outside the requested object', async () => {
  for (const response of [
    new Response('', { status: 500 }),
    Response.json({ url: 'https://attacker.test/file' }),
    Response.json({
      url: '/object/upload/sign/lifemate-audio/audio/other/a/a.mp3?token=test',
    }),
  ]) {
    const signer = createStorageSigner(origin, 'secret', async () => response);
    await assert.rejects(() => signer('upload', path));
  }
});
