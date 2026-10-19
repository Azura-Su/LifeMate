import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { advanceExpiredRoom } from '../game-access/worker.mjs';
import { createGameHandler } from '../game-access/handler.mjs';

const sql = await readFile(
  new URL('../../migrations/202610190003_card_game_rooms.sql', import.meta.url),
  'utf8',
);
const workerSql = await readFile(
  new URL(
    '../../migrations/202610190004_card_game_deadlines.sql',
    import.meta.url,
  ),
  'utf8',
);
const closedCleanupSql = await readFile(
  new URL(
    '../../migrations/202610190005_card_game_closed_cleanup.sql',
    import.meta.url,
  ),
  'utf8',
);
const uid = 'game-a',
  other = 'game-b';
const session = '11111111-1111-4111-8111-111111111111';
const action = '22222222-2222-4222-8222-222222222222';
const room = '33333333-3333-4333-8333-333333333333';
const epoch = '44444444-4444-4444-8444-444444444444';
const authTime = Math.floor(Date.now() / 1000);

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table public.lifemate_account_access(uid text primary key,status text not null default 'active',valid_since bigint not null default 0);
    create schema realtime; create schema auth;
    create table realtime.messages(topic text, extension text);
    alter table realtime.messages enable row level security;
    create table public.test_game_hints(payload jsonb,event text,topic text,private boolean);
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as
      'insert into public.test_game_hints values($1,$2,$3,$4)';
    create function realtime.topic() returns text language sql as
      'select current_setting(''test.topic'',true)';
    create function auth.jwt() returns jsonb language sql as
      'select coalesce(nullif(current_setting(''request.jwt.claims'',true),''''),''{}'')::jsonb';
  `);
  await db.exec(sql);
  await db.exec(workerSql);
  await db.exec(closedCleanupSql);
  await db.exec("update public.lifemate_game_config set mode='open'");
  return db;
}

test('nonexistent room attempts persist their throttle counter', async () => {
  const db = await setup();
  try {
    for (let i = 0; i < 15; i++)
      assert.deepEqual(
        await rpc(db, 'lifemate_game_find', [uid, authTime, 'ZZZZZZZZ']),
        { error: 'room-not-found' },
      );
    await assert.rejects(
      rpc(db, 'lifemate_game_find', [uid, authTime, 'ZZZZZZZZ']),
      /rate-limited/,
    );
  } finally {
    await db.close();
  }
});

test('explicit room closure retains receipts for at least 24 hours', async () => {
  const db = await setup();
  try {
    await create(db);
    await rpc(db, 'lifemate_game_commit', [
      uid,
      authTime,
      session,
      crypto.randomUUID(),
      'leave',
      room,
      1,
      null,
      'leave',
      { phase: 'closed', members: [], host: null, game: null },
    ]);
    const { rows } = await db.query(
      'select extract(epoch from expires_at-now())::integer as seconds from public.lifemate_game_rooms where id=$1',
      [room],
    );
    assert.ok(rows[0].seconds >= 86400 - 1);
  } finally {
    await db.close();
  }
});

test('a delayed takeover cannot take control after its seat moved to another room', async () => {
  const db = await setup();
  try {
    await create(db);
    await rpc(db, 'lifemate_game_commit', [
      uid,
      authTime,
      session,
      crypto.randomUUID(),
      'leave',
      room,
      1,
      null,
      'leave',
      { phase: 'closed', members: [], host: null, game: null },
    ]);
    const nextRoom = crypto.randomUUID(),
      nextSession = crypto.randomUUID();
    await rpc(db, 'lifemate_game_create', [
      uid,
      authTime,
      nextSession,
      crypto.randomUUID(),
      'new',
      nextRoom,
      'BCDEFGHJ',
      'An',
    ]);
    await assert.rejects(
      rpc(db, 'lifemate_game_takeover', [uid, authTime, session, room]),
      /not-member/,
    );
    const current = await rpc(db, 'lifemate_game_read', [
      uid,
      authTime,
      nextSession,
      false,
    ]);
    assert.equal(current.room.id, nextRoom);
    assert.equal(current.controller, true);
  } finally {
    await db.close();
  }
});

async function rpc(db, name, args) {
  const result = await db.query(
    `select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as value`,
    args,
  );
  return result.rows[0].value;
}

test('private game state expires independently of later room and receipt retention', async () => {
  const db = await setup();
  try {
    await create(db);
    await db.query(
      "update public.lifemate_game_rooms set state=state||$1::jsonb,private_until=now()-interval '1 second',expires_at=now()+interval '1 day' where id=$2",
      [
        JSON.stringify({
          phase: 'finished',
          game: { hand: [0, 1], stock: [2, 3] },
        }),
        room,
      ],
    );
    await rpc(db, 'lifemate_game_claim_due', [crypto.randomUUID()]);
    const { rows } = await db.query(
      'select state,private_until from public.lifemate_game_rooms where id=$1',
      [room],
    );
    assert.equal(rows[0].state.game, null);
    assert.equal(rows[0].private_until, null);
    assert.equal(
      (
        await db.query(
          'select count(*)::integer as n from public.lifemate_game_receipts',
        )
      ).rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});
const create = (db, id = action) =>
  rpc(db, 'lifemate_game_create', [
    uid,
    authTime,
    session,
    id,
    'create-fingerprint',
    room,
    'ABCDEFGH',
    'An',
  ]);

test('deadline worker is durable, batch-expiry cancels and foreground renewal fences stale expiry', async () => {
  const db = await setup();
  try {
    await create(db);
    await db.exec(
      "update public.lifemate_game_seats set lease_until=now()-interval '1 second';update public.lifemate_game_rooms set next_due=now()-interval '1 second'",
    );
    const claimed = await rpc(db, 'lifemate_game_claim_due', [epoch]);
    assert.equal(claimed.rooms.length, 1);
    const record = claimed.rooms[0];
    assert.deepEqual(record.expired, [uid]);
    const candidate = advanceExpiredRoom(record, Number(claimed.now));
    assert.equal(candidate.state.phase, 'closed');
    await rpc(db, 'lifemate_game_read', [uid, authTime, session, true]);
    assert.equal(
      await rpc(db, 'lifemate_game_commit_worker', [
        room,
        epoch,
        record.version,
        candidate.state,
        candidate.removed,
      ]),
      false,
    );
    const loaded = await rpc(db, 'lifemate_game_read', [
      uid,
      authTime,
      session,
      false,
    ]);
    assert.equal(loaded.room.state.phase, 'lobby');
  } finally {
    await db.close();
  }
});

test('closed mode still cancels due rooms and starts private-state retention', async () => {
  const db = await setup();
  try {
    await create(db);
    await db.query(
      "update public.lifemate_game_rooms set state=$1::jsonb,match_id=$2,next_due=now()-interval '1 second' where id=$3",
      [
        JSON.stringify({
          phase: 'playing',
          members: [{ uid, name: 'An', ready: true, wins: 0 }],
          host: uid,
          game: { hand: [0, 1], stock: [2, 3] },
        }),
        crypto.randomUUID(),
        room,
      ],
    );
    await db.exec("update public.lifemate_game_config set mode='closed'");
    const token = crypto.randomUUID();
    const claimed = await rpc(db, 'lifemate_game_claim_due', [token]);
    assert.equal(claimed.rooms.length, 1);
    assert.deepEqual(claimed.rooms[0].expired, [uid]);
    assert.equal(
      await rpc(db, 'lifemate_game_commit_worker', [
        room,
        token,
        claimed.rooms[0].version,
        { phase: 'closed', members: [], host: null, game: null },
        [uid],
      ]),
      true,
    );
    const { rows } = await db.query(
      "select state->>'phase' as phase,private_until,(select count(*)::integer from public.lifemate_game_seats) as seats from public.lifemate_game_rooms where id=$1",
      [room],
    );
    assert.equal(rows[0].phase, 'closed');
    assert.equal(rows[0].seats, 0);
    assert.ok(rows[0].private_until);
  } finally {
    await db.close();
  }
});

test('account erasure closes private rooms and removes seats, receipts and retained results', async () => {
  const db = await setup();
  try {
    await create(db);
    await db.query(
      'insert into public.lifemate_game_results(match_id,participant_uids,result) values($1,$2,$3)',
      [epoch, [uid], {}],
    );
    await rpc(db, 'lifemate_game_erase_account', [uid]);
    for (const table of ['rooms', 'seats', 'receipts', 'results']) {
      const { rows } = await db.query(
        `select count(*)::integer as count from public.lifemate_game_${table}`,
      );
      assert.equal(rows[0].count, 0, table);
    }
    const { rows } = await db.query(
      "select * from public.test_game_hints where payload->>'closed'='true'",
    );
    assert.equal(rows.length, 1);
  } finally {
    await db.close();
  }
});

test('API with SQL handles create/join/ready/start and returns only each viewer hand', async () => {
  const db = await setup();
  try {
    const handler = createGameHandler({
      verifyIdentity: async (token) => ({ uid: token, authTime }),
      rpc: async (name, args) => {
        const fields = Object.keys(args);
        const result = await db.query(
          `select public.${name}(${fields.map((key, i) => key + '=> $' + (i + 1)).join(',')}) as value`,
          Object.values(args),
        );
        return result.rows[0].value;
      },
    });
    const post = async (actor, input) => {
      const response = await handler(
        new Request('https://game.invalid', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${actor}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId: session, ...input }),
        }),
      );
      const value = await response.json();
      assert.equal(response.status, 200, JSON.stringify(value));
      return value;
    };
    let a = await post(uid, {
      type: 'create',
      actionId: crypto.randomUUID(),
      name: 'An',
      game: 'south',
    });
    await post(other, {
      type: 'join',
      actionId: crypto.randomUUID(),
      name: 'Bình',
      code: a.room.code,
    });
    a = await post(uid, { type: 'sync' });
    a = await post(uid, {
      type: 'ready',
      roomId: a.room.id,
      actionId: crypto.randomUUID(),
      expectedVersion: a.room.version,
      matchId: null,
      ready: true,
    });
    let b = await post(other, { type: 'sync' });
    b = await post(other, {
      type: 'ready',
      roomId: b.room.id,
      actionId: crypto.randomUUID(),
      expectedVersion: b.room.version,
      matchId: null,
      ready: true,
    });
    a = await post(uid, { type: 'sync' });
    a = await post(uid, {
      type: 'start',
      roomId: a.room.id,
      actionId: crypto.randomUUID(),
      expectedVersion: a.room.version,
      matchId: null,
    });
    b = await post(other, { type: 'sync' });
    assert.equal(a.room.game.hand.length, 13);
    assert.equal(b.room.game.hand.length, 13);
    assert.ok(!a.room.game.hand.some((c) => b.room.game.hand.includes(c)));
    assert.ok(a.room.game.players.every((p) => !('hand' in p)));
    assert.ok(!JSON.stringify(a).includes('stock'));
    const again = await post(uid, { type: 'sync' });
    assert.deepEqual(again.room.game.hand, a.room.game.hand);
  } finally {
    await db.close();
  }
});

test('migration keeps all private tables and mutating RPCs inaccessible to client roles', async () => {
  const db = await setup();
  try {
    for (const role of ['anon', 'authenticated']) {
      const { rows } = await db.query(
        `select has_table_privilege($1,'public.lifemate_game_rooms','select') as allowed`,
        [role],
      );
      assert.equal(rows[0].allowed, false);
      await db.exec(`set role ${role}`);
      await assert.rejects(
        db.query('select * from public.lifemate_game_seats'),
        /permission/,
      );
      await assert.rejects(create(db), /permission/);
      await db.exec('reset role');
    }
  } finally {
    await db.close();
  }
});

test('create is idempotent, binds payload, enforces one seat and honors closed feature flag', async () => {
  const db = await setup();
  try {
    const first = await create(db);
    assert.equal(first.roomId, room);
    assert.deepEqual(await create(db), first);
    await assert.rejects(
      rpc(db, 'lifemate_game_create', [
        uid,
        authTime,
        session,
        action,
        'different',
        room,
        'ABCDEFGH',
        'An',
      ]),
      /idempotency/,
    );
    await assert.rejects(
      create(db, '55555555-5555-4555-8555-555555555555'),
      /already-in-room/,
    );
    await db.exec("update public.lifemate_game_config set mode='closed'");
    await assert.rejects(
      rpc(db, 'lifemate_game_read', [uid, authTime, session, false]),
      /game-unavailable/,
    );
  } finally {
    await db.close();
  }
});

test('CAS commit rejects stale versions, records one receipt and rotates channel with roster changes', async () => {
  const db = await setup();
  try {
    await create(db);
    const before = await rpc(db, 'lifemate_game_find', [
      other,
      authTime,
      'ABCDEFGH',
    ]);
    const state = before.state;
    state.members.push({ uid: other, name: 'Bình', ready: false, wins: 0 });
    const commitArgs = [
      other,
      authTime,
      session,
      '55555555-5555-4555-8555-555555555555',
      'join-fingerprint',
      room,
      1,
      null,
      'join',
      state,
    ];
    const result = await rpc(db, 'lifemate_game_commit', commitArgs);
    assert.equal(result.version, 2);
    assert.deepEqual(await rpc(db, 'lifemate_game_commit', commitArgs), result);
    const loaded = await rpc(db, 'lifemate_game_read', [
      uid,
      authTime,
      session,
      true,
    ]);
    assert.equal(loaded.room.state.members.length, 2);
    assert.notEqual(loaded.room.epoch, before.epoch);
    await assert.rejects(
      rpc(db, 'lifemate_game_commit', [
        uid,
        authTime,
        session,
        crypto.randomUUID(),
        'stale',
        room,
        1,
        null,
        'ready',
        state,
      ]),
      /version-conflict/,
    );
    const { rows } = await db.query('select * from public.test_game_hints');
    assert.ok(rows.some((r) => r.event === 'invalidate'));
    assert.ok(
      rows.every((r) => !JSON.stringify(r.payload).includes('members')),
    );
  } finally {
    await db.close();
  }
});

test('disabled then reenabled accounts still reject old auth_time at commit and realtime authorization', async () => {
  const db = await setup();
  try {
    await create(db);
    await db.query(
      "update public.lifemate_account_access set status='active',valid_since=$1 where uid=$2",
      [authTime + 1, uid],
    );
    await assert.rejects(
      rpc(db, 'lifemate_game_read', [uid, authTime, session, true]),
      /invalid-session/,
    );
    const { rows } = await db.query(
      'select epoch from public.lifemate_game_rooms where id=$1',
      [room],
    );
    const topic = `card-room:${room}:${rows[0].epoch}`;
    const claims = {
      sub: uid,
      auth_time: authTime,
      iss: 'https://securetoken.google.com/baseapp-dd227',
      aud: 'baseapp-dd227',
    };
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify(claims),
    ]);
    assert.equal(await rpc(db, 'lifemate_game_can_subscribe', [topic]), false);
    claims.auth_time = authTime + 1;
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify(claims),
    ]);
    assert.equal(await rpc(db, 'lifemate_game_can_subscribe', [topic]), true);
    claims.aud = 'other-project';
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify(claims),
    ]);
    assert.equal(await rpc(db, 'lifemate_game_can_subscribe', [topic]), false);
  } finally {
    await db.close();
  }
});

test('takeover fences the previous controller and old match actions cannot change the next game', async () => {
  const db = await setup();
  try {
    await create(db);
    await rpc(db, 'lifemate_game_takeover', [uid, authTime, epoch, room]);
    const loaded = await rpc(db, 'lifemate_game_read', [
      uid,
      authTime,
      session,
      false,
    ]);
    assert.equal(loaded.controller, false);
    await assert.rejects(
      rpc(db, 'lifemate_game_commit', [
        uid,
        authTime,
        session,
        crypto.randomUUID(),
        'ready',
        room,
        1,
        null,
        'ready',
        loaded.room.state,
      ]),
      /session-replaced/,
    );
    await assert.rejects(
      rpc(db, 'lifemate_game_commit', [
        uid,
        authTime,
        epoch,
        crypto.randomUUID(),
        'match',
        room,
        loaded.room.version,
        epoch,
        'play',
        loaded.room.state,
      ]),
      /match-conflict/,
    );
  } finally {
    await db.close();
  }
});
