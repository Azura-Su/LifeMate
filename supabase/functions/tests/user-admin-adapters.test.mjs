import test from 'node:test';
import assert from 'node:assert/strict';
import { exportPKCS8, generateKeyPair } from 'jose';
import { createGoogleAdmin } from '../user-admin/google.mjs';
import { createObjectCleanup } from '../user-admin/objects.mjs';
const config = async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  return JSON.stringify({
    project_id: 'baseapp-dd227',
    client_email: 'cleanup@baseapp-dd227.iam.gserviceaccount.com',
    private_key: await exportPKCS8(privateKey),
  });
};
test('Firestore sweeps nonexistent UID parents, repeats first page safely, stays under UID', async () => {
  const calls = [];
  let docs = Array.from({ length: 51 }, (_, i) => `d${i}`);
  const request = async (url, options) => {
    url = String(url);
    calls.push([url, options.method]);
    if (url === 'https://oauth2.googleapis.com/token')
      return Response.json({ access_token: 'not-logged', expires_in: 3600 });
    if (options.method === 'DELETE') {
      docs = docs.filter((id) => !url.endsWith(`/tracks/${id}`));
      return new Response(null, { status: 204 });
    }
    if (url.includes('/audioLibraries/target/tracks?'))
      return Response.json({
        documents: docs.slice(0, 50).map((id) => ({
          name: `projects/baseapp-dd227/databases/(default)/documents/audioLibraries/target/tracks/${id}`,
        })),
        ...(docs.length > 50 ? { nextPageToken: 'next' } : {}),
      });
    return Response.json({});
  };
  const google = createGoogleAdmin(
    await config(),
    'baseapp-dd227.appspot.com',
    request,
  );
  assert.equal(await google.clearFirestore('target', () => true), false);
  assert.equal(docs.length, 1);
  assert.equal(await google.clearFirestore('target', () => true), true);
  assert.equal(docs.length, 0);
  assert.ok(
    calls.some(([url]) => url.includes('/memoryAccounts/target/items?')),
  );
  assert.ok(
    calls.some(([url]) => url.includes('/petAccounts/target/state?')),
  );

  assert.ok(
    calls.some(
      ([url, method]) =>
        url.endsWith('/financeAccounts/target') && method === 'DELETE',
    ),
  );
  assert.ok(
    calls
      .filter(([url]) => url.includes('firestore.googleapis'))
      .every(([url]) => url.includes('/target')),
  );
});
test('Google storage pagination and errors cannot claim completion', async () => {
  const deleted = [];
  let fail = false;
  const request = async (url, options) => {
    url = String(url);
    if (url.includes('oauth2'))
      return Response.json({ access_token: 'not-logged', expires_in: 3600 });
    if (options.method === 'DELETE') {
      deleted.push(url);
      return fail
        ? new Response('{}', { status: 503 })
        : new Response(null, { status: 204 });
    }
    return Response.json({
      items: [{ name: 'audio/target/track/track.mp3' }],
      nextPageToken: 'more',
    });
  };
  const google = createGoogleAdmin(
    await config(),
    'baseapp-dd227.appspot.com',
    request,
  );
  assert.equal(await google.clearStorage('target', () => true), false);
  assert.ok(deleted[0].endsWith('/audio%2Ftarget%2Ftrack%2Ftrack.mp3'));
  fail = true;
  await assert.rejects(google.clearStorage('target', () => true));
});
test('Supabase folders and R2 use exact UID prefix; failed deletes retry', async () => {
  const deleted = [];
  let fail = false;
  const r2 = {
    list: async (prefix) => ({
      Contents: [{ Key: `${prefix}m/photo.jpg` }],
      IsTruncated: true,
    }),
    remove: async (objects) => {
      deleted.push(...objects.map((o) => o.Key));
      if (fail) throw Error('R2 offline');
    },
  };
  const cleanup = createObjectCleanup(
    { url: 'https://example.supabase.co', serviceKey: 'not-logged', r2 },
    async (url, options) => {
      const body = JSON.parse(options.body);
      if (options.method === 'DELETE') {
        deleted.push(...body.prefixes);
        return Response.json([]);
      }
      assert.ok(
        body.prefix.startsWith('profiles/target/') ||
          body.prefix.startsWith('audio/target/') ||
          body.prefix.startsWith('shared/target/'),
      );
      return Response.json(
        body.prefix === 'profiles/target/'
          ? [{ id: 'avatar-id', name: 'avatar.jpg' }]
          : body.prefix.endsWith('/track/')
            ? [{ id: 'object-id', name: 'track.mp3' }]
            : body.prefix === 'audio/target/'
              ? [{ id: null, name: 'track' }]
              : [],
      );
    },
  );
  assert.equal(await cleanup('target', () => true), false);
  assert.deepEqual(deleted, [
    'audio/target/track/track.mp3',
    'profiles/target/avatar.jpg',
    'shared/target/m/photo.jpg',
  ]);
  fail = true;
  await assert.rejects(cleanup('target', () => true));
  await assert.rejects(cleanup('../other', () => true));
});
test('refuses provider objects outside requested UID, even if provider returns them', async () => {
  const cleanup = createObjectCleanup(
    {
      url: 'https://example.supabase.co',
      serviceKey: 'not-logged',
      r2: {
        list: async () => ({ Contents: [{ Key: 'shared/other/m/photo.jpg' }] }),
        remove: async () => assert.fail('must not delete'),
      },
    },
    async () => Response.json([]),
  );
  await assert.rejects(
    cleanup('target', () => true),
    /Unsafe R2 prefix/,
  );
});

test('Google cleanup deletes original private memory photos under the exact UID prefix', async () => {
  const removed = [];
  const request = async (url, options) => {
    url = String(url);
    if (url.includes('oauth2'))
      return Response.json({ access_token: 'not-logged', expires_in: 3600 });
    if (options.method === 'DELETE') {
      removed.push(url);
      return new Response(null, { status: 204 });
    }
    const prefix = new URL(url).searchParams.get('prefix');
    return Response.json({
      items:
        prefix === 'memories/target/'
          ? [{ name: 'memories/target/one/photo.jpg' }]
          : [],
    });
  };
  const google = createGoogleAdmin(
    await config(),
    'baseapp-dd227.appspot.com',
    request,
  );
  assert.equal(await google.clearStorage('target', () => true), true);
  assert.equal(removed.length, 1);
  assert.ok(removed[0].endsWith('/memories%2Ftarget%2Fone%2Fphoto.jpg'));
});

test('account cleanup retries private R2 pages and only completes after both prefixes are empty', async () => {
  const removed = [];
  let privatePage = 0;
  const prefixes = [];
  const cleanup = createObjectCleanup(
    {
      url: 'https://example.supabase.co',
      serviceKey: 'not-logged',
      r2: {
        list: async (prefix) => {
          prefixes.push(prefix);
          if (prefix.startsWith('shared/'))
            return { Contents: [], IsTruncated: false };
          privatePage++;
          return {
            Contents: [{ Key: `${prefix}one/photo-${privatePage}.jpg` }],
            IsTruncated: privatePage === 1,
          };
        },
        remove: async (objects) => removed.push(...objects.map((o) => o.Key)),
      },
    },
    async () => Response.json([]),
  );
  assert.equal(await cleanup('target', () => true), false);
  assert.equal(await cleanup('target', () => true), true);
  assert.deepEqual(prefixes, [
    'shared/target/',
    'private/target/',
    'shared/target/',
    'private/target/',
  ]);
  assert.deepEqual(removed, [
    'private/target/one/photo-1.jpg',
    'private/target/one/photo-2.jpg',
  ]);
});
