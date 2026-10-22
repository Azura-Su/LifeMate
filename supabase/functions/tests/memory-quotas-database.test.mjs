import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const schema = (
  await readFile(
    new URL(
      '../../migrations/202610130001_memory_sharing.sql',
      import.meta.url,
    ),
    'utf8',
  )
).split('insert into storage.buckets')[0];
const migration = await readFile(
  new URL(
    '../../migrations/20261022185328_memory_invite_quota_transactions.sql',
    import.meta.url,
  ),
  'utf8',
);
async function setup() {
  const db = new PGlite();
  await db.exec(
    'create role anon; create role authenticated; create role service_role bypassrls;',
  );
  await db.exec(schema);
  await db.exec(migration);
  return db;
}
async function profile(db, uid, email = `${uid}@example.com`) {
  await db.query(
    'insert into public.lifemate_memory_profiles(uid,email,display_name) values($1,$2,$1)',
    [uid, email],
  );
}
async function invite(db, uid, email) {
  return (
    await db.query(
      'select public.invite_lifemate_memory_friend($1,$2) result',
      [uid, email],
    )
  ).rows[0].result;
}
async function count(db, table, where = 'true', args = []) {
  return Number(
    (
      await db.query(
        `select count(*) n from public.${table} where ${where}`,
        args,
      )
    ).rows[0].n,
  );
}

test('invite RPC consumes at most 20 daily attempts and mixed outgoing slots', async () => {
  const db = await setup();
  try {
    await profile(db, 'sender');
    for (let i = 0; i < 12; i++) await profile(db, `target-${i}`);
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        invite(
          db,
          'sender',
          i < 12 ? `target-${i}@example.com` : `unknown-${i}@example.com`,
        ),
      ),
    );
    assert.equal(results.filter((r) => r.limited).length, 5);
    assert.equal(await count(db, 'lifemate_memory_invite_attempts'), 20);
    assert.equal(
      (await count(db, 'lifemate_memory_friend_requests')) +
        (await count(db, 'lifemate_memory_email_invites')),
      20,
    );
    await db.query(
      "update public.lifemate_memory_invite_attempts set created_at=now()-interval '25 hours'",
    );
    assert.equal(
      (await invite(db, 'sender', 'another@example.com')).limited,
      false,
    );
    assert.equal(
      (await count(db, 'lifemate_memory_friend_requests')) +
        (await count(db, 'lifemate_memory_email_invites')),
      20,
    );
  } finally {
    await db.close();
  }
});

test('recipient inbox cap is shared by direct invitations and deferred email claims', async () => {
  const db = await setup();
  try {
    for (let i = 0; i < 25; i++) await profile(db, `sender-${i}`);
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        invite(db, `sender-${i}`, 'target@example.com'),
      ),
    );
    await profile(db, 'target');
    await Promise.all([
      db.query('select public.claim_lifemate_memory_email_invites($1,$2)', [
        'target',
        'target@example.com',
      ]),
      ...Array.from({ length: 5 }, (_, i) =>
        invite(db, `sender-${i + 20}`, 'target@example.com'),
      ),
    ]);
    assert.equal(
      await count(db, 'lifemate_memory_friend_requests', 'target_uid=$1', [
        'target',
      ]),
      20,
    );
    assert.equal(await count(db, 'lifemate_memory_email_invites'), 0);
    assert.equal(
      (await invite(db, 'sender-0', 'target@example.com')).limited,
      false,
    );
    assert.equal(await count(db, 'lifemate_memory_friend_requests'), 20);
  } finally {
    await db.close();
  }
});

test('accept serializes both participants and rejects new friends at the boundary', async () => {
  const db = await setup();
  try {
    await profile(db, 'target');
    for (let i = 0; i < 102; i++) {
      const uid = `friend-${String(i).padStart(3, '0')}`;
      await profile(db, uid);
      if (i < 99)
        await db.query(
          'insert into public.lifemate_memory_friendships(left_uid,right_uid) values($1,$2)',
          [uid, 'target'],
        );
      else
        await db.query(
          'insert into public.lifemate_memory_friend_requests(requester_uid,target_uid) values($1,$2)',
          [uid, 'target'],
        );
    }
    const results = await Promise.all(
      [99, 100, 101].map((i) =>
        db.query(
          'select public.accept_lifemate_memory_friend_request($1,$2) accepted',
          ['target', `friend-${i}`],
        ),
      ),
    );
    assert.equal(results.filter((r) => r.rows[0].accepted).length, 1);
    assert.equal(await count(db, 'lifemate_memory_friendships'), 100);
    assert.equal(await count(db, 'lifemate_memory_friend_requests'), 2);
    // The requester cap is enforced even when the accepting UID has space.
    await profile(db, 'spare');
    await db.query(
      'insert into public.lifemate_memory_friend_requests(requester_uid,target_uid) values($1,$2)',
      ['target', 'spare'],
    );
    const result = await db.query(
      'select public.accept_lifemate_memory_friend_request($1,$2) accepted',
      ['spare', 'target'],
    );
    assert.equal(result.rows[0].accepted, false);
    assert.equal(await count(db, 'lifemate_memory_friendships'), 100);
  } finally {
    await db.close();
  }
});

test('quota RPCs stay service-only and claims retain invitations while the inbox is full', async () => {
  const db = await setup();
  try {
    for (const signature of [
      'public.invite_lifemate_memory_friend(text,text)',
      'public.accept_lifemate_memory_friend_request(text,text)',
      'public.claim_lifemate_memory_email_invites(text,text)',
      'public.lifemate_memory_quota_lock(text[])',
    ])
      for (const role of ['anon', 'authenticated']) {
        const allowed = (
          await db.query("select has_function_privilege($1,$2,'EXECUTE') ok", [
            role,
            signature,
          ])
        ).rows[0].ok;
        assert.equal(allowed, false);
      }
    await profile(db, 'target');
    for (let i = 0; i < 21; i++) {
      const uid = `sender-${i}`;
      await profile(db, uid);
      if (i < 20)
        await db.query(
          'insert into public.lifemate_memory_friend_requests(requester_uid,target_uid) values($1,$2)',
          [uid, 'target'],
        );
      else
        await db.query(
          'insert into public.lifemate_memory_email_invites(requester_uid,target_email) values($1,$2)',
          [uid, 'target@example.com'],
        );
    }
    await db.query('select public.claim_lifemate_memory_email_invites($1,$2)', [
      'target',
      'target@example.com',
    ]);
    assert.equal(await count(db, 'lifemate_memory_email_invites'), 1);
    await db.query(
      "delete from public.lifemate_memory_friend_requests where requester_uid='sender-0'",
    );
    await db.query('select public.claim_lifemate_memory_email_invites($1,$2)', [
      'target',
      'target@example.com',
    ]);
    assert.equal(await count(db, 'lifemate_memory_email_invites'), 0);
    assert.equal(await count(db, 'lifemate_memory_friend_requests'), 20);
  } finally {
    await db.close();
  }
});
