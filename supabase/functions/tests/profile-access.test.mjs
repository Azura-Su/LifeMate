import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileHandler } from '../profile-access/handler.mjs';
import { createAvatarStorage } from '../profile-access/storage.mjs';

const jpeg = new Uint8Array([255, 216, 255, 224, 1, 2, 255, 217]);
function fixture() {
  const calls = [];
  let checks = 0;
  const handler = createProfileHandler({
    verifyIdentity: async () => {
      checks++;
      return { uid: 'owner', authTime: 100 };
    },
    storage: async (...args) => {
      calls.push(args);
      return args[0] === 'remove' ? null : 'https://example.supabase.co/photo';
    },
  });
  return {
    calls,
    get checks() {
      return checks;
    },
    post: (body, type = 'application/json') =>
      handler(
        new Request('https://example.com', {
          method: 'POST',
          headers: { Authorization: 'Bearer signed', 'Content-Type': type },
          body: type === 'application/json' ? JSON.stringify(body) : body,
        }),
      ),
  };
}
test('own avatar upload rechecks access, key derives from identity only', async () => {
  const f = fixture();
  const response = await f.post(jpeg, 'image/jpeg');
  assert.equal(response.status, 200);
  assert.equal(f.checks, 2);
  assert.equal(f.calls[0][0], 'upload');
  assert.equal(f.calls[0][1], 'profiles/owner/avatar.jpg');
});
test('JSON permits only reading or removing own avatar', async () => {
  const f = fixture();
  assert.equal(
    (await f.post({ action: 'avatar-url', uid: 'other' })).status,
    400,
  );
  assert.equal((await f.post({ action: 'remove-avatar' })).status, 200);
  assert.deepEqual(f.calls, [['remove', 'profiles/owner/avatar.jpg']]);
});
test('denies disabled/revoked identity even if access changes while body is read', async () => {
  let checks = 0;
  const storage = () => assert.fail('must not touch storage');
  const handler = createProfileHandler({
    verifyIdentity: async () => {
      if (++checks > 1) throw Error('revoked');
      return { uid: 'owner' };
    },
    storage,
  });
  const response = await handler(
    new Request('https://example.com', {
      method: 'POST',
      headers: { Authorization: 'Bearer signed', 'Content-Type': 'image/jpeg' },
      body: jpeg,
    }),
  );
  assert.equal(response.status, 401);
});
test('rejects oversized and non-JPEG uploads without storage changes', async () => {
  const f = fixture();
  assert.equal(
    (await f.post(new Uint8Array(524289), 'image/jpeg')).status,
    413,
  );
  assert.equal(
    (await f.post(new Uint8Array([1, 2, 3, 4]), 'image/jpeg')).status,
    415,
  );
  assert.equal((await f.post(jpeg, 'image/png')).status, 415);
  assert.deepEqual(f.calls, []);
});
test('storage returns null only for missing avatar; validates signed URL path', async () => {
  const config = {
    url: 'https://example.supabase.co',
    serviceKey: 'private-not-logged',
  };
  let response = () =>
    Response.json(
      { error: 'not_found', message: 'Object not found' },
      { status: 400 },
    );
  const storage = createAvatarStorage(config, async () => response());
  assert.equal(await storage('read', 'profiles/owner/avatar.jpg'), null);
  assert.equal(await storage('remove', 'profiles/owner/avatar.jpg'), null);
  response = () =>
    Response.json({ error: 'permission denied' }, { status: 403 });
  await assert.rejects(storage('read', 'profiles/owner/avatar.jpg'));
  response = () =>
    Response.json({
      signedURL:
        '/object/sign/lifemate-avatars/profiles/other/avatar.jpg?token=x',
    });
  await assert.rejects(storage('read', 'profiles/owner/avatar.jpg'));
});
