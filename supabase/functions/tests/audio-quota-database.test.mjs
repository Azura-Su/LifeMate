import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const originalSql = await readFile(
  new URL(
    '../../migrations/202610090001_audio_account_quota.sql',
    import.meta.url,
  ),
  'utf8',
);
const retentionSql = await readFile(
  new URL(
    '../../migrations/20261021055132_audio_upload_reservation_retention.sql',
    import.meta.url,
  ),
  'utf8',
);
const MAX_FILE = 50 * 1024 * 1024;
const path = (id) => `audio/u1/${id}/${id}.mp3`;

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema storage;
    create table storage.objects (bucket_id text, name text, metadata jsonb, primary key(bucket_id, name));
  `);
  await db.exec(originalSql);
  await db.exec(retentionSql);
  return db;
}

async function reserve(db, id) {
  return (
    await db.query(
      'select public.reserve_lifemate_audio_upload($1,$2,$3) as allowed',
      ['u1', path(id), MAX_FILE],
    )
  ).rows[0].allowed;
}
async function confirm(db, id) {
  return (
    await db.query(
      'select public.confirm_lifemate_audio_upload($1,$2) as confirmed',
      ['u1', path(id)],
    )
  ).rows[0].confirmed;
}
async function release(db, id) {
  await db.query('select public.release_lifemate_audio_upload($1,$2)', [
    'u1',
    path(id),
  ]);
}
async function object(db, id, size) {
  await db.query(
    `insert into storage.objects values('lifemate-audio',$1,$2::jsonb)
    on conflict(bucket_id,name) do update set metadata=excluded.metadata`,
    [path(id), JSON.stringify({ size })],
  );
}

test('deleting absent objects does not free capacity for still-valid upload tokens', async () => {
  const db = await setup();
  try {
    for (let i = 0; i < 20; i++) {
      assert.equal(await reserve(db, `song-${i}`), true);
      // DELETE succeeds even before a client has used its signed upload URL.
      await release(db, `song-${i}`);
    }
    assert.equal(await reserve(db, 'extra'), false);
    // Those URLs can still upload later; their maximum sizes were already counted.
    for (let i = 0; i < 20; i++) await object(db, `song-${i}`, MAX_FILE);
    assert.equal(await reserve(db, 'extra'), false);
  } finally {
    await db.close();
  }
});

test('confirming small uploads cannot free capacity while overwrite tokens remain valid', async () => {
  const db = await setup();
  try {
    for (let i = 0; i < 20; i++) {
      const id = `song-${i}`;
      assert.equal(await reserve(db, id), true);
      await object(db, id, 1);
      assert.equal(await confirm(db, id), true);
    }
    assert.equal(await reserve(db, 'extra'), false);
    for (let i = 0; i < 20; i++) await object(db, `song-${i}`, MAX_FILE);
    assert.equal(await reserve(db, 'extra'), false);
  } finally {
    await db.close();
  }
});

test('a delayed confirm preserves a newer maximum reservation and its expiry', async () => {
  const db = await setup();
  try {
    await reserve(db, 'song');
    await object(db, 'song', 1);
    await db.exec(
      `update public.lifemate_audio_upload_reservations set expires_at=now()-interval '1 second'`,
    );
    assert.equal(await reserve(db, 'song'), true);
    const before = (
      await db.query('select * from public.lifemate_audio_upload_reservations')
    ).rows[0];
    assert.equal(await confirm(db, 'song'), true);
    const after = (
      await db.query('select * from public.lifemate_audio_upload_reservations')
    ).rows[0];
    assert.equal(Number(after.size_bytes), MAX_FILE);
    assert.ok(new Date(after.expires_at) >= new Date(before.expires_at));
    await release(db, 'song');
    assert.equal(
      (
        await db.query(
          'select count(*) as n from public.lifemate_audio_upload_reservations',
        )
      ).rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});

test('expired absent reservations are reclaimed but real objects still count', async () => {
  const db = await setup();
  try {
    for (let i = 0; i < 20; i++) await reserve(db, `song-${i}`);
    assert.equal(await reserve(db, 'extra'), false);
    await db.query(
      `update public.lifemate_audio_upload_reservations set expires_at=now()-interval '1 second' where object_path=$1`,
      [path('song-0')],
    );
    await release(db, 'song-0');
    assert.equal(await reserve(db, 'extra'), true);
    for (let i = 1; i < 20; i++) await object(db, `song-${i}`, MAX_FILE);
    await object(db, 'extra', MAX_FILE);
    await db.exec(
      `update public.lifemate_audio_upload_reservations set expires_at=now()-interval '1 second'`,
    );
    assert.equal(await reserve(db, 'another'), false);
  } finally {
    await db.close();
  }
});

test('confirmation after token expiry may use actual size and missing objects stay unconfirmed', async () => {
  const db = await setup();
  try {
    await reserve(db, 'song');
    assert.equal(await confirm(db, 'song'), false);
    await object(db, 'song', 1);
    await db.exec(
      `update public.lifemate_audio_upload_reservations set expires_at=now()-interval '1 second'`,
    );
    assert.equal(await confirm(db, 'song'), true);
    assert.equal(
      Number(
        (
          await db.query(
            'select size_bytes from public.lifemate_audio_upload_reservations',
          )
        ).rows[0].size_bytes,
      ),
      1,
    );
  } finally {
    await db.close();
  }
});

test('quota RPCs remain service-only and do not release another owner reservation', async () => {
  const db = await setup();
  try {
    await reserve(db, 'song');
    await db.query('select public.release_lifemate_audio_upload($1,$2)', [
      'u2',
      path('song'),
    ]);
    assert.equal(
      (
        await db.query(
          'select count(*) as n from public.lifemate_audio_upload_reservations',
        )
      ).rows[0].n,
      1,
    );
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(
        db.query('select public.release_lifemate_audio_upload($1,$2)', [
          'u1',
          path('song'),
        ]),
        /permission denied/,
      );
      await assert.rejects(
        db.query('select public.confirm_lifemate_audio_upload($1,$2)', [
          'u1',
          path('song'),
        ]),
        /permission denied/,
      );
      await db.exec('reset role');
    }
  } finally {
    await db.close();
  }
});
