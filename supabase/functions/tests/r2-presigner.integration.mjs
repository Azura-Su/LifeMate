// Offline integration check against the exact packages pinned in memory-access/deno.json.
// Install those packages in a temporary folder and set R2_SDK_TEST_MODULES to its node_modules.
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import https from 'node:https';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
const require = createRequire(
  `${process.env.R2_SDK_TEST_MODULES}/package.json`,
);
const source = (
  await readFile(new URL('../memory-access/r2.mjs', import.meta.url), 'utf8')
)
  .replaceAll(
    "'@aws-sdk/client-s3'",
    JSON.stringify(pathToFileURL(require.resolve('@aws-sdk/client-s3')).href),
  )
  .replaceAll(
    "'@aws-sdk/s3-request-presigner'",
    JSON.stringify(
      pathToFileURL(require.resolve('@aws-sdk/s3-request-presigner')).href,
    ),
  );
const mappedSource = source.replaceAll(
  "'@smithy/fetch-http-handler'",
  JSON.stringify(
    pathToFileURL(require.resolve('@smithy/fetch-http-handler')).href,
  ),
);
const { createR2Storage } = await import(
  `data:text/javascript;base64,${Buffer.from(mappedSource).toString('base64')}`
);
const r2 = createR2Storage({
  accountId: 'a'.repeat(32),
  bucket: 'test-memories',
  accessKeyId: 'offline-test',
  secretAccessKey: 'offline-test',
});
test('real presigner signs immutable native PUT headers without an empty-body checksum', async () => {
  const url = new URL(
    await r2('upload', 'private/alice/one/photo.heic', 15728640),
  );
  assert.equal(url.pathname, '/test-memories/private/alice/one/photo.heic');
  assert.equal(url.searchParams.get('X-Amz-Expires'), '120');
  assert.deepEqual(url.searchParams.get('X-Amz-SignedHeaders').split(';'), [
    'content-length',
    'content-type',
    'host',
    'if-none-match',
  ]);
  assert.equal(url.searchParams.has('x-amz-checksum-crc32'), false);
  assert.equal(url.searchParams.has('x-amz-sdk-checksum-algorithm'), false);
  await assert.rejects(r2('upload', 'private/alice/one/photo.jpg', 15728641));
  await assert.rejects(r2('upload', 'private/alice/../bob/photo.jpg', 100));
});
test('shared PUT retains the 2MiB JPEG policy and mutable retries', async () => {
  const url = new URL(
    await r2('upload', 'shared/alice/one/photo.jpg', 2097152),
  );
  assert.equal(
    url.searchParams.get('X-Amz-SignedHeaders').includes('if-none-match'),
    false,
  );
  await assert.rejects(r2('upload', 'shared/alice/one/photo.jpg', 2097153));
});

test('uses web fetch for bodyless R2 HEAD, distinguishes missing objects from errors', async (t) => {
  t.mock.method(https, 'request', () => {
    throw Error('Node HTTP transport must not be used in Edge');
  });
  t.mock.method(http, 'request', () => {
    throw Error('Node HTTP transport must not be used in Edge');
  });
  const requests = [];
  let status = 200;
  t.mock.method(globalThis, 'fetch', async (request) => {
    requests.push(request);
    return new Response(null, {
      status,
      headers:
        status === 200
          ? { 'content-length': '100', 'content-type': 'image/jpeg' }
          : {},
    });
  });
  assert.deepEqual(await r2('head', 'private/alice/one/photo.jpg'), {
    sizeBytes: 100,
    contentType: 'image/jpeg',
  });
  assert.equal(requests[0].method, 'HEAD');
  status = 404;
  assert.equal(await r2('head', 'private/alice/one/photo.jpg'), null);
  status = 503;
  await assert.rejects(r2('head', 'private/alice/one/photo.jpg'));
});
test('shared copy and delete keep working over web fetch', async (t) => {
  t.mock.method(https, 'request', () => {
    throw Error('Node HTTP transport must not be used in Edge');
  });
  const methods = [];
  t.mock.method(globalThis, 'fetch', async (input) => {
    const url =
      typeof input === 'string' || input instanceof URL
        ? String(input)
        : input.url;
    if (url.startsWith('https://example.supabase.co/'))
      return new Response(new Uint8Array([255, 216, 255, 217]), {
        headers: { 'content-length': '4' },
      });
    methods.push(input.method);
    if (input.method === 'PUT') {
      assert.equal((await input.arrayBuffer()).byteLength, 4);
      assert.equal(input.headers.get('if-none-match'), '*');
      assert.equal(
        input.headers.get('x-amz-meta-lifemate-reservation'),
        '00000000-0000-4000-8000-000000000001',
      );
      return new Response(null, { status: 200 });
    }
    return new Response(null, { status: 204 });
  });
  assert.equal(
    await r2(
      'copy',
      'shared/alice/one/photo.jpg',
      'https://example.supabase.co/storage/v1/object/sign/lifemate-memories/shared/alice/one/photo.jpg?token=test',
      '00000000-0000-4000-8000-000000000001',
    ),
    4,
  );
  await r2('delete', 'shared/alice/one/photo.jpg');
  assert.deepEqual(methods, ['PUT', 'DELETE']);
});

const migrationToken = '00000000-0000-4000-8000-000000000001';
const legacySource =
  'https://example.supabase.co/storage/v1/object/sign/lifemate-memories/shared/alice/one/photo.jpg?token=test';
test('migration uses an atomic conditional PUT and cannot overwrite a newer R2 object', async (t) => {
  const newer = new Uint8Array([255, 216, 2, 255, 217]);
  let destination = newer;
  t.mock.method(globalThis, 'fetch', async (input) => {
    if (String(input).startsWith('https://example.supabase.co/'))
      return new Response(new Uint8Array([255, 216, 1, 255, 217]));
    if (input.method === 'PUT') {
      if (input.headers.get('if-none-match') === '*')
        return new Response(null, { status: 412 });
      destination = new Uint8Array(await input.arrayBuffer());
      return new Response(null);
    }
    if (input.method === 'HEAD')
      return new Response(null, {
        headers: {
          'content-length': '5',
          'content-type': 'image/jpeg',
          'x-amz-meta-lifemate-reservation': 'another-reservation',
        },
      });
    return new Response(destination);
  });
  await assert.rejects(
    r2('copy', 'shared/alice/one/photo.jpg', legacySource, migrationToken),
  );
  assert.deepEqual(destination, newer);
});

test('migration can retry a completed conditional copy using its stable reservation proof', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input) => {
    if (String(input).startsWith('https://example.supabase.co/'))
      return new Response(new Uint8Array([255, 216, 255, 217]));
    if (input.method === 'PUT') return new Response(null, { status: 412 });
    if (input.method === 'HEAD')
      return new Response(null, {
        headers: {
          'content-length': '4',
          'content-type': 'image/jpeg',
          'x-amz-meta-lifemate-reservation': migrationToken,
        },
      });
    assert.fail('matching proof must not require a second object download');
  });
  assert.equal(
    await r2(
      'copy',
      'shared/alice/one/photo.jpg',
      legacySource,
      migrationToken,
    ),
    4,
  );
});

test('pre-rollout copy recovery compares bytes, rejecting a same-size different image', async (t) => {
  let different = false;
  t.mock.method(globalThis, 'fetch', async (input) => {
    if (String(input).startsWith('https://example.supabase.co/'))
      return new Response(new Uint8Array([255, 216, 1, 255, 217]));
    if (input.method === 'PUT') return new Response(null, { status: 412 });
    if (input.method === 'HEAD')
      return new Response(null, {
        headers: {
          'content-length': '5',
          'content-type': 'image/jpeg',
          etag: '"legacy-etag"',
        },
      });
    assert.equal(input.method, 'GET');
    assert.equal(input.headers.get('if-match'), '"legacy-etag"');
    return new Response(
      new Uint8Array([255, 216, different ? 2 : 1, 255, 217]),
    );
  });
  assert.equal(
    await r2(
      'copy',
      'shared/alice/one/photo.jpg',
      legacySource,
      migrationToken,
    ),
    5,
  );
  different = true;
  await assert.rejects(
    r2('copy', 'shared/alice/one/photo.jpg', legacySource, migrationToken),
  );
});
