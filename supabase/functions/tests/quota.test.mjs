import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAudioQuota } from '../audio-access/quota.mjs';

test('accepts a 204 response from the void release RPC', async () => {
  const quota = createAudioQuota(
    'https://lifematetest.supabase.co',
    'server-secret',
    async () => new Response(null, { status: 204 }),
  );

  await assert.doesNotReject(() =>
    quota.releaseUpload('u1', 'audio/u1/a/a.mp3'),
  );
});
