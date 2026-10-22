import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { advanceExpiredRoom } from '../game-access/worker.mjs';
import { createGameHandler } from '../game-access/handler.mjs';
import { shouldStartRematch, updateRoom } from '../game-access/rooms.mjs';
import { newTienLenGame } from '../game-access/tienlen.mjs';

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
const moneyScoreSql = await readFile(
  new URL(
    '../../migrations/202610200001_card_game_money_score.sql',
    import.meta.url,
  ),
  'utf8',
);
const scoreErasureSql = await readFile(
  new URL(
    '../../migrations/20261020092913_card_game_score_erasure.sql',
    import.meta.url,
  ),
  'utf8',
);
const commitSnapshotSql = await readFile(
  new URL(
    '../../migrations/20261020120000_card_game_commit_snapshot.sql',
    import.meta.url,
  ),
  'utf8',
);
const activityTtlSql = await readFile(
  new URL(
    '../../migrations/20261020234500_card_game_room_activity_ttl.sql',
    import.meta.url,
  ),
  'utf8',
);
const ownerOnlyReopenSql = await readFile(
  new URL(
    '../../migrations/20261021100000_card_game_owner_only_reopen.sql',
    import.meta.url,
  ),
  'utf8',
);
const roomReactivationSql = await readFile(
  new URL(
    '../../migrations/20261021130000_card_game_room_reactivation.sql',
    import.meta.url,
  ),
  'utf8',
);
const emptyLobbyTtlSql = await readFile(
  new URL(
    '../../migrations/20261021083000_card_game_empty_lobby_ttl.sql',
    import.meta.url,
  ),
  'utf8',
);
const sharedScoreSql = await readFile(
  new URL(
    '../../migrations/20261021130001_shared_card_scores.sql',
    import.meta.url,
  ),
  'utf8',
);
const permanentScoreDeletionSql = await readFile(
  new URL(
    '../../migrations/20261021184438_permanent_score_deletion.sql',
    import.meta.url,
  ),
  'utf8',
);
const emptyRoomRejoinStatusSql = await readFile(
  new URL(
    '../../migrations/20261022040203_card_game_empty_room_rejoin_status.sql',
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
  await db.exec(moneyScoreSql);
  await db.exec(scoreErasureSql);
  await db.exec(commitSnapshotSql);
  await db.exec(activityTtlSql);
  await db.exec(emptyLobbyTtlSql);
  await db.exec(ownerOnlyReopenSql);
  await db.exec(roomReactivationSql);
  await db.exec(sharedScoreSql);
  await db.exec(permanentScoreDeletionSql);
  await db.exec(emptyRoomRejoinStatusSql);
  await db.exec(
    await readFile(
      new URL(
        '../../migrations/20261022110124_card_room_member_management.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        '../../migrations/20261022185526_shared_score_patch_operations.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
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

test('room creation persists the server-owned per-card rate', async () => {
  const db = await setup();
  try {
    const created = await rpc(db, 'lifemate_game_create', [
      uid,
      authTime,
      session,
      action,
      'create-with-rate',
      room,
      'ABCDEFGH',
      'An',
      2,
    ]);
    assert.equal(created.roomId, room);
    const loaded = await rpc(db, 'lifemate_game_read', [
      uid,
      authTime,
      session,
      false,
    ]);
    assert.equal(loaded.room.state.amountPerCard, 2);
  } finally {
    await db.close();
  }
});

test('legacy room creation initializes lifecycle ownership and score identity', async () => {
  const db = await setup();
  try {
    await create(db);
    const { rows } = await db.query(
      'select state from public.lifemate_game_rooms where id=$1',
      [room],
    );
    assert.equal(rows[0].state.ownerUid, uid);
    assert.equal(rows[0].state.scoreMembers[0].uid, uid);
  } finally {
    await db.close();
  }
});

test('only the creator can find an empty room and its owner survives host changes', async () => {
  const db = await setup();
  try {
    await rpc(db, 'lifemate_game_create', [
      uid,
      authTime,
      session,
      action,
      'create-owner-room',
      room,
      'ABCDEFGH',
      'An',
      2,
    ]);
    await db.query(
      `update public.lifemate_game_rooms set state=state||$1::jsonb where id=$2`,
      [
        JSON.stringify({
          phase: 'lobby',
          host: null,
          members: [],
          scoreMembers: [
            { uid, name: 'An', wins: 0, balance: 0 },
            { uid: other, name: 'Bình', wins: 0, balance: 0 },
          ],
        }),
        room,
      ],
    );

    assert.deepEqual(
      await rpc(db, 'lifemate_game_find', [other, authTime, 'ABCDEFGH']),
      { error: 'room-not-found' },
    );
    const reopened = await rpc(db, 'lifemate_game_find', [
      uid,
      authTime,
      'ABCDEFGH',
    ]);
    assert.equal(reopened.state.ownerUid, uid);
  } finally {
    await db.close();
  }
});

for (const phase of ['lobby', 'finished'])
  test(`empty live ${phase} status waits for the owner before member re-entry`, async () => {
    const db = await setup();
    try {
      await rpc(db, 'lifemate_game_create', [
        uid,
        authTime,
        session,
        action,
        'empty-room-status',
        room,
        'ABCDEFGH',
        'An',
        1,
      ]);
      const change = async (who, intent) => {
        const {
          rows: [record],
        } = await db.query(
          'select * from public.lifemate_game_rooms where id=$1',
          [room],
        );
        const starts = shouldStartRematch(record.state, who, intent);
        const state = updateRoom(
          record.state,
          who,
          intent,
          Date.now(),
          starts ? Array.from({ length: 52 }, (_, i) => i) : undefined,
        );
        return rpc(db, 'lifemate_game_commit', [
          who,
          authTime,
          session,
          crypto.randomUUID(),
          JSON.stringify(intent),
          room,
          record.version,
          record.match_id,
          starts ? 'start' : intent.type,
          state,
        ]);
      };
      await change(other, { type: 'join', name: 'Bình' });
      if (phase === 'finished') {
        await change(uid, { type: 'ready', ready: true });
        await change(other, { type: 'ready', ready: true });
      }
      await change(uid, { type: 'leave' });
      await change(other, { type: 'leave' });
      const status = await rpc(db, 'lifemate_game_status', [
        other,
        authTime,
        session,
        room,
      ]);
      assert.equal(status.phase, phase);
      assert.equal(status.expired, false);
      assert.equal(status.canRejoin, false);
      assert.equal(status.canReopen, false);
      assert.deepEqual(
        await rpc(db, 'lifemate_game_find', [other, authTime, 'ABCDEFGH']),
        { error: 'room-not-found' },
      );
      const ownerStatus = await rpc(db, 'lifemate_game_status', [
        uid,
        authTime,
        session,
        room,
      ]);
      assert.equal(ownerStatus.canRejoin, true);
      assert.equal(ownerStatus.canReopen, false);
      const outsider = await rpc(db, 'lifemate_game_status', [
        'outsider',
        authTime,
        session,
        room,
      ]);
      assert.equal(outsider.exists, false);
      assert.equal(outsider.canRejoin, false);
      await change(uid, { type: 'join', name: 'An' });
      assert.equal(
        (
          await rpc(db, 'lifemate_game_status', [
            other,
            authTime,
            session,
            room,
          ])
        ).canRejoin,
        true,
      );
      await change(other, { type: 'join', name: 'Bình' });
      const { rows } = await db.query(
        'select state from public.lifemate_game_rooms where id=$1',
        [room],
      );
      assert.deepEqual(
        rows[0].state.members.map((member) => member.uid),
        [uid, other],
      );
    } finally {
      await db.close();
    }
  });

test('expiry hides rejoin, preserves the room, and current owner can reopen, transfer, then delete it', async () => {
  const db = await setup();
  const otherSession = '55555555-5555-4555-8555-555555555555';
  try {
    await rpc(db, 'lifemate_game_create', [
      uid,
      authTime,
      session,
      action,
      'create-fingerprint',
      room,
      'ABCDEFGH',
      'An',
      0,
    ]);
    const created = await rpc(db, 'lifemate_game_read', [
      uid,
      authTime,
      session,
      false,
    ]);
    const storedCreated = await db.query(
      'select state from public.lifemate_game_rooms where id=$1',
      [room],
    );
    assert.equal(storedCreated.rows[0].state.scoreMembers[0].uid, uid);
    const joinedState = {
      ...storedCreated.rows[0].state,
      members: [
        ...storedCreated.rows[0].state.members,
        { uid: other, name: 'Bình', ready: false, wins: 0, balance: 0 },
      ],
      scoreMembers: [
        ...(storedCreated.rows[0].state.scoreMembers ??
          storedCreated.rows[0].state.members),
        { uid: other, name: 'Bình', ready: false, wins: 0, balance: 0 },
      ],
    };
    await rpc(db, 'lifemate_game_commit', [
      other,
      authTime,
      otherSession,
      crypto.randomUUID(),
      'join-room',
      room,
      created.room.version,
      null,
      'join',
      joinedState,
    ]);
    await db.exec(
      "update public.lifemate_game_rooms set expires_at=now()-interval '1 second',next_due=now()-interval '1 second' where id='33333333-3333-4333-8333-333333333333'",
    );

    const ownerExpired = await rpc(db, 'lifemate_game_status', [
      uid,
      authTime,
      session,
      room,
    ]);
    const otherExpired = await rpc(db, 'lifemate_game_status', [
      other,
      authTime,
      otherSession,
      room,
    ]);
    assert.equal(ownerExpired.canRejoin, false);
    assert.equal(ownerExpired.canReopen, true);
    assert.equal(otherExpired.canRejoin, false);
    assert.equal(otherExpired.canReopen, false);
    assert.equal(
      (await rpc(db, 'lifemate_game_find', [uid, authTime, 'ABCDEFGH'])).error,
      'room-not-found',
    );

    await rpc(db, 'lifemate_game_reopen', [
      uid,
      authTime,
      session,
      crypto.randomUUID(),
      'reopen-room',
      room,
      ownerExpired.version,
      null,
      'An',
    ]);
    const reopened = await rpc(db, 'lifemate_game_read', [
      uid,
      authTime,
      session,
      false,
    ]);
    assert.equal(reopened.room.id, room);
    assert.equal(reopened.room.code, 'ABCDEFGH');
    assert.equal(reopened.room.state.members.length, 1);
    assert.equal(
      (
        await db.query(
          'select count(*)::integer as n from public.lifemate_game_seats where room_id=$1',
          [room],
        )
      ).rows[0].n,
      1,
    );
    const bCanRejoin = await rpc(db, 'lifemate_game_status', [
      other,
      authTime,
      otherSession,
      room,
    ]);
    assert.equal(bCanRejoin.canRejoin, true);

    const rejoinedState = {
      ...reopened.room.state,
      members: [
        ...reopened.room.state.members,
        { uid: other, name: 'Bình', ready: false, wins: 0, balance: 0 },
      ],
    };
    await rpc(db, 'lifemate_game_commit', [
      other,
      authTime,
      otherSession,
      crypto.randomUUID(),
      'rejoin-room',
      room,
      reopened.room.version,
      null,
      'join',
      rejoinedState,
    ]);
    const afterJoin = await rpc(db, 'lifemate_game_read', [
      uid,
      authTime,
      session,
      false,
    ]);
    const transferredState = {
      ...afterJoin.room.state,
      ownerUid: other,
      host: other,
    };
    await rpc(db, 'lifemate_game_commit', [
      uid,
      authTime,
      session,
      crypto.randomUUID(),
      'transfer-room',
      room,
      afterJoin.room.version,
      null,
      'transfer-owner',
      transferredState,
    ]);
    assert.equal(
      (await rpc(db, 'lifemate_game_status', [uid, authTime, session, room]))
        .owner,
      false,
    );
    assert.equal(
      (
        await rpc(db, 'lifemate_game_status', [
          other,
          authTime,
          otherSession,
          room,
        ])
      ).owner,
      true,
    );

    await db.query(
      "update public.lifemate_game_rooms set state=jsonb_set(state,'{phase}','\"finished\"'),version=version+1 where id=$1",
      [room],
    );
    const finished = await rpc(db, 'lifemate_game_status', [
      other,
      authTime,
      otherSession,
      room,
    ]);
    assert.equal(finished.canDelete, true);
    await rpc(db, 'lifemate_game_delete', [
      other,
      authTime,
      otherSession,
      crypto.randomUUID(),
      'delete-room',
      room,
      finished.version,
      null,
    ]);
    assert.equal(
      (await rpc(db, 'lifemate_game_status', [uid, authTime, session, room]))
        .exists,
      false,
    );
    assert.equal(
      (await rpc(db, 'lifemate_game_find', [other, authTime, 'ABCDEFGH']))
        .error,
      'room-not-found',
    );
    assert.equal(
      (
        await db.query(
          'select count(*)::integer as n from public.lifemate_game_rooms where id=$1',
          [room],
        )
      ).rows[0].n,
      0,
    );
    await rpc(db, 'lifemate_game_erase_account', [other]);
    const tombstone = await db.query(
      'select owner_uid,create_uid,create_action_id from public.lifemate_game_deleted_rooms where room_id=$1',
      [room],
    );
    assert.equal(tombstone.rows[0].owner_uid, '');
    assert.equal(tombstone.rows[0].create_uid, uid);
    assert.equal(tombstone.rows[0].create_action_id, action);
    await assert.rejects(
      rpc(db, 'lifemate_game_create', [
        uid,
        authTime,
        session,
        action,
        'create-fingerprint',
        room,
        'ABCDEFGH',
        'An',
        0,
      ]),
      /room-deleted/,
    );
  } finally {
    await db.close();
  }
});

test('expiry worker removes stale seats once but retains the expired room for its owner', async () => {
  const db = await setup();
  try {
    await create(db);
    await db.query(
      "update public.lifemate_game_rooms set expires_at=now()-interval '1 second',next_due=now()-interval '1 second' where id=$1",
      [room],
    );
    const claimed = await rpc(db, 'lifemate_game_claim_due', [epoch]);
    assert.equal(claimed.rooms.length, 1);
    const record = claimed.rooms[0];
    const next = advanceExpiredRoom(record, Number(claimed.now));
    assert.deepEqual(next.removed, [uid]);
    assert.equal(
      await rpc(db, 'lifemate_game_commit_worker', [
        room,
        epoch,
        record.version,
        next.state,
        next.removed,
      ]),
      true,
    );
    const retained = await db.query(
      "select state,expires_at,next_due='infinity'::timestamptz as scheduled from public.lifemate_game_rooms where id=$1",
      [room],
    );
    assert.equal(retained.rows.length, 1);
    assert.deepEqual(retained.rows[0].state.members, []);
    assert.equal(retained.rows[0].state.phase, 'lobby');
    assert.ok(retained.rows[0].expires_at <= new Date());
    assert.equal(retained.rows[0].scheduled, true);
    assert.equal(
      (await rpc(db, 'lifemate_game_claim_due', [crypto.randomUUID()])).rooms
        .length,
      0,
    );
  } finally {
    await db.close();
  }
});

test('expired empty room is retained and moved off the worker due queue', async () => {
  const db = await setup();
  try {
    await create(db);
    await db.query(
      'update public.lifemate_game_rooms set state=jsonb_set(state,\'{members}\',\'[]\'::jsonb)||\'{"host":null,"ownerUid":"game-a","scoreMembers":[{"uid":"game-a","name":"An","wins":0,"balance":0}]}\'::jsonb,expires_at=now()-interval \'1 second\',next_due=now()-interval \'1 second\' where id=$1',
      [room],
    );
    await db.query('delete from public.lifemate_game_seats where room_id=$1', [
      room,
    ]);
    const claimed = await rpc(db, 'lifemate_game_claim_due', [epoch]);
    assert.equal(claimed.rooms.length, 0);
    const retained = await db.query(
      "select count(*)::integer as n,bool_and(next_due='infinity'::timestamptz) as off_queue from public.lifemate_game_rooms where id=$1",
      [room],
    );
    assert.equal(retained.rows[0].n, 1);
    assert.equal(retained.rows[0].off_queue, true);
    assert.equal(
      (await rpc(db, 'lifemate_game_status', [uid, authTime, session, room]))
        .canReopen,
      true,
    );
  } finally {
    await db.close();
  }
});

test('leaving a room does not automatically delete it or add a 24-hour lease', async () => {
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
      { phase: 'finished', members: [], host: null, game: null },
    ]);
    const { rows } = await db.query(
      'select extract(epoch from expires_at-now())::integer as seconds from public.lifemate_game_rooms where id=$1',
      [room],
    );
    assert.ok(rows[0].seconds > 0 && rows[0].seconds <= 1800);
    assert.equal(
      (
        await db.query(
          'select count(*)::integer as n from public.lifemate_game_rooms where id=$1',
          [room],
        )
      ).rows[0].n,
      1,
    );
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
    assert.equal(candidate.state.phase, 'lobby');
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

test('empty lobby lease cleanup does not extend the inactivity deadline', async () => {
  const db = await setup();
  try {
    await create(db);
    await db.exec(
      "update public.lifemate_game_seats set lease_until=now()-interval '1 second';update public.lifemate_game_rooms set expires_at=now()+interval '15 minutes',next_due=now()-interval '1 second'",
    );
    const before = await db.query(
      'select expires_at from public.lifemate_game_rooms where id=$1',
      [room],
    );
    const claimed = await rpc(db, 'lifemate_game_claim_due', [epoch]);
    const record = claimed.rooms[0];
    const candidate = advanceExpiredRoom(record, Number(claimed.now));

    assert.equal(candidate.state.phase, 'lobby');
    assert.equal(candidate.state.members.length, 0);
    assert.equal(
      await rpc(db, 'lifemate_game_commit_worker', [
        room,
        epoch,
        record.version,
        candidate.state,
        candidate.removed,
      ]),
      true,
    );

    const after = await db.query(
      'select expires_at from public.lifemate_game_rooms where id=$1',
      [room],
    );
    assert.equal(
      Date.parse(after.rows[0].expires_at),
      Date.parse(before.rows[0].expires_at),
    );

    await db.exec(
      `update public.lifemate_game_rooms
       set state=jsonb_set(state,'{phase}','"finished"'),next_due=now()-interval '1 second'
       where id='${room}'`,
    );
    const finishedClaim = await rpc(db, 'lifemate_game_claim_due', [epoch]);
    const finishedRecord = finishedClaim.rooms[0];
    const finishedCandidate = advanceExpiredRoom(
      finishedRecord,
      Number(finishedClaim.now),
    );
    assert.equal(
      await rpc(db, 'lifemate_game_commit_worker', [
        room,
        epoch,
        finishedRecord.version,
        finishedCandidate.state,
        finishedCandidate.removed,
      ]),
      true,
    );
    const afterFinishedCleanup = await db.query(
      'select expires_at from public.lifemate_game_rooms where id=$1',
      [room],
    );
    assert.equal(
      Date.parse(afterFinishedCleanup.rows[0].expires_at),
      Date.parse(before.rows[0].expires_at),
    );
  } finally {
    await db.close();
  }
});

test('read and heartbeat do not renew inactivity; valid room activity does', async () => {
  const db = await setup();
  try {
    await create(db);
    await db.query(
      "update public.lifemate_game_rooms set expires_at=now()+interval '1 minute' where id=$1",
      [room],
    );
    const before = await db.query(
      'select expires_at,private_until from public.lifemate_game_rooms where id=$1',
      [room],
    );
    const response = await rpc(db, 'lifemate_game_read', [
      uid,
      authTime,
      session,
      true,
    ]);
    assert.equal(response.room.state.phase, 'lobby');
    const renewed = await db.query(
      'select expires_at,private_until from public.lifemate_game_rooms where id=$1',
      [room],
    );
    assert.equal(
      renewed.rows[0].expires_at.valueOf(),
      before.rows[0].expires_at.valueOf(),
    );
    assert.equal(
      renewed.rows[0].private_until?.valueOf() ?? null,
      before.rows[0].private_until?.valueOf() ?? null,
    );

    const state = {
      ...response.room.state,
      members: response.room.state.members.map((member) => ({
        ...member,
        ready: true,
      })),
    };
    await rpc(db, 'lifemate_game_commit', [
      uid,
      authTime,
      session,
      crypto.randomUUID(),
      'ready-activity',
      room,
      response.room.version,
      response.room.match_id,
      'ready',
      state,
    ]);
    const afterActivity = await db.query(
      'select expires_at from public.lifemate_game_rooms where id=$1',
      [room],
    );
    assert.ok(
      Date.parse(afterActivity.rows[0].expires_at) >
        Date.parse(before.rows[0].expires_at),
    );

    await db.query(
      "update public.lifemate_game_rooms set expires_at=now()+interval '5 minutes' where id=$1",
      [room],
    );
    const staleBefore = await db.query(
      'select expires_at from public.lifemate_game_rooms where id=$1',
      [room],
    );
    await rpc(db, 'lifemate_game_read', [
      uid,
      authTime,
      '55555555-5555-4555-8555-555555555555',
      true,
    ]);
    const staleAfter = await db.query(
      'select expires_at from public.lifemate_game_rooms where id=$1',
      [room],
    );
    assert.equal(
      staleAfter.rows[0].expires_at.valueOf(),
      staleBefore.rows[0].expires_at.valueOf(),
    );

    await db.query(
      "update public.lifemate_game_rooms set expires_at=now()-interval '1 second' where id=$1",
      [room],
    );
    await rpc(db, 'lifemate_game_read', [uid, authTime, session, true]);
    const expired = await db.query(
      'select expires_at<=now() as expired from public.lifemate_game_rooms where id=$1',
      [room],
    );
    assert.equal(expired.rows[0].expired, true);
    await assert.rejects(
      rpc(db, 'lifemate_game_commit', [
        uid,
        authTime,
        session,
        crypto.randomUUID(),
        'expired-leave',
        room,
        response.room.version + 1,
        response.room.match_id,
        'leave',
        state,
      ]),
      /room-expired/,
    );
  } finally {
    await db.close();
  }
});

test('closed room transitions persist a finished match result exactly once', async () => {
  const db = await setup();
  try {
    await create(db);
    const matchId = '66666666-6666-4666-8666-666666666666';
    await db.query(
      `update public.lifemate_game_rooms
        set match_id=$2,
            state='{"phase":"playing","members":[],"game":{"status":"playing","players":[{"uid":"game-a"}],"result":null}}'::jsonb
        where id=$1`,
      [room, matchId],
    );
    const finishedState = {
      phase: 'closed',
      members: [],
      game: {
        status: 'finished',
        players: [{ uid: uid }],
        result: { ranking: [{ uid, rank: 1, moneyDelta: 0 }] },
      },
    };
    await db.query(
      'update public.lifemate_game_rooms set state=$2 where id=$1',
      [room, finishedState],
    );
    await db.query(
      'update public.lifemate_game_rooms set state=$2 where id=$1',
      [room, finishedState],
    );
    const result = await db.query(
      'select match_id,participant_uids from public.lifemate_game_results where match_id=$1',
      [matchId],
    );
    assert.equal(result.rows.length, 1);
    assert.deepEqual(result.rows[0].participant_uids, [uid]);
  } finally {
    await db.close();
  }
});

test('finished room lookup survives the last seat lease expiring', async () => {
  const db = await setup();
  try {
    await create(db);
    await db.exec(`update public.lifemate_game_rooms set state=jsonb_set(state,'{phase}','"finished"'),next_due=now()-interval '1 second';
      update public.lifemate_game_seats set lease_until=now()-interval '1 second'`);
    const claimed = await rpc(db, 'lifemate_game_claim_due', [epoch]);
    const record = claimed.rooms[0];
    const candidate = advanceExpiredRoom(record, Number(claimed.now));
    assert.equal(
      await rpc(db, 'lifemate_game_commit_worker', [
        room,
        epoch,
        record.version,
        candidate.state,
        candidate.removed,
      ]),
      true,
    );
    const found = await rpc(db, 'lifemate_game_find', [
      uid,
      authTime,
      'ABCDEFGH',
    ]);
    assert.equal(found.id, room);
    assert.equal(found.state.phase, 'finished');
    assert.deepEqual(found.state.members, []);
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

test('account erasure removes historical score identity without closing another match', async () => {
  const db = await setup();
  try {
    await create(db);
    await db.query(
      `update public.lifemate_game_rooms set state=state||$1::jsonb where id=$2`,
      [
        JSON.stringify({
          scoreMembers: [
            { uid, name: 'An', balance: 10 },
            { uid: 'former', name: 'Private name', balance: -10 },
          ],
        }),
        room,
      ],
    );
    await rpc(db, 'lifemate_game_erase_account', ['former']);
    const { rows } = await db.query(
      'select state from public.lifemate_game_rooms where id=$1',
      [room],
    );
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].state.scoreMembers, [
      { uid, name: 'An', balance: 10 },
    ]);
    assert.equal(rows[0].state.members[0].uid, uid);
  } finally {
    await db.close();
  }
});

test('erasing a departed room creator cannot transfer empty-room reopen rights', async () => {
  const db = await setup();
  try {
    await create(db);
    await db.query(
      `update public.lifemate_game_rooms set state=state||$1::jsonb where id=$2`,
      [
        JSON.stringify({
          phase: 'lobby',
          host: other,
          members: [{ uid: other, name: 'Bình', ready: false, wins: 0 }],
          ownerUid: uid,
          scoreMembers: [
            { uid, name: 'An', balance: 0 },
            { uid: other, name: 'Bình', balance: 0 },
          ],
        }),
        room,
      ],
    );
    await db.query('delete from public.lifemate_game_seats where uid=$1', [
      uid,
    ]);

    await rpc(db, 'lifemate_game_erase_account', [uid]);

    const { rows } = await db.query(
      'select state from public.lifemate_game_rooms where id=$1',
      [room],
    );
    assert.equal(rows[0].state.ownerUid, '');
    assert.deepEqual(rows[0].state.scoreMembers, [
      { uid: other, name: 'Bình', balance: 0 },
    ]);
    await db.query(
      `update public.lifemate_game_rooms
       set state=jsonb_set(state,'{members}','[]'::jsonb)||jsonb_build_object('host',null)
       where id=$1`,
      [room],
    );
    assert.deepEqual(
      await rpc(db, 'lifemate_game_find', [other, authTime, 'ABCDEFGH']),
      { error: 'room-not-found' },
    );
  } finally {
    await db.close();
  }
});

test('historical score erasure fences stale member and worker state', async () => {
  const db = await setup();
  try {
    await create(db);
    await db.query(
      `update public.lifemate_game_rooms set state=state||$1::jsonb,
      worker_token=$2,worker_until=now()+interval '15 seconds' where id=$3`,
      [
        JSON.stringify({
          scoreMembers: [{ uid: 'former', name: 'Private name', balance: -10 }],
        }),
        epoch,
        room,
      ],
    );
    const {
      rows: [stale],
    } = await db.query(
      'select state,version from public.lifemate_game_rooms where id=$1',
      [room],
    );
    await rpc(db, 'lifemate_game_erase_account', ['former']);
    await assert.rejects(
      rpc(db, 'lifemate_game_commit', [
        uid,
        authTime,
        session,
        crypto.randomUUID(),
        'stale-ready',
        room,
        stale.version,
        null,
        'ready',
        stale.state,
      ]),
      /version-conflict/,
    );
    assert.equal(
      await rpc(db, 'lifemate_game_commit_worker', [
        room,
        epoch,
        stale.version,
        stale.state,
        [],
      ]),
      false,
    );
  } finally {
    await db.close();
  }
});

for (const race of ['host-ready', 'duplicate-join', 'continuous-updates']) {
  test(`room entry recovers safely from ${race} between join read and commit`, async () => {
    const db = await setup();
    try {
      await create(db);
      let attempts = 0,
        finds = 0;
      let firstJoin;
      const sqlRpc = async (name, args) => {
        const fields = Object.keys(args);
        return (
          await db.query(
            `select public.${name}(${fields.map((key, i) => key + '=> $' + (i + 1)).join(',')}) as value`,
            Object.values(args),
          )
        ).rows[0].value;
      };
      const handler = createGameHandler({
        verifyIdentity: async (token) => ({ uid: token, authTime }),
        rpc: async (name, args) => {
          if (name === 'lifemate_game_find') {
            finds++;
            if (race === 'duplicate-join' && finds === 2) {
              // A second request for the same action commits before this retry's find.
              const record = await sqlRpc(name, args);
              await sqlRpc('lifemate_game_commit', {
                ...firstJoin,
                p_version: record.version,
                p_match_id: record.match_id,
                p_state: updateRoom(
                  record.state,
                  other,
                  { type: 'join', name: 'Bình' },
                  Date.now(),
                ),
              });
            }
          }
          if (name === 'lifemate_game_commit' && args.p_uid === other) {
            firstJoin ??= args;
            attempts++;
            if (attempts === 1 || race === 'continuous-updates') {
              // The host toggles readiness after the joining client read the room.
              const record = (
                await rpc(db, 'lifemate_game_read', [
                  uid,
                  authTime,
                  session,
                  false,
                ])
              ).room;
              await sqlRpc('lifemate_game_commit', {
                p_uid: uid,
                p_auth_time: authTime,
                p_session_id: session,
                p_action_id: crypto.randomUUID(),
                p_fingerprint: `host-ready-${attempts}`,
                p_room_id: record.id,
                p_version: record.version,
                p_match_id: record.match_id,
                p_kind: 'ready',
                p_state: updateRoom(
                  record.state,
                  uid,
                  { type: 'ready', ready: !record.state.members[0].ready },
                  Date.now(),
                ),
              });
            }
          }
          return sqlRpc(name, args);
        },
      });
      const post = (actor, input) =>
        handler(
          new Request('https://game.invalid', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${actor}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionId: session, ...input }),
          }),
        );
      const input = {
        type: 'join',
        name: 'Bình',
        code: 'ABCDEFGH',
        actionId: crypto.randomUUID(),
      };
      const response = await post(other, input);
      const value = await response.json();
      if (race === 'continuous-updates') {
        assert.equal(response.status, 409);
        assert.equal(value.error, 'version-conflict');
        assert.equal(attempts, 3);
        assert.equal(
          (
            await db.query(
              'select count(*) as n from public.lifemate_game_seats where uid=$1',
              [other],
            )
          ).rows[0].n,
          0,
        );
      } else {
        assert.equal(response.status, 200, JSON.stringify(value));
        assert.deepEqual(
          value.room.members.map((member) => member.uid),
          [uid, other],
        );
        assert.deepEqual(
          value.room.members.map((member) => member.ready),
          [true, false],
        );
        assert.equal(
          (
            await db.query(
              'select count(*) as n from public.lifemate_game_seats',
            )
          ).rows[0].n,
          2,
        );
        const repeated = await post(other, input);
        assert.equal(repeated.status, 200);
        assert.deepEqual((await repeated.json()).ack, value.ack);
        assert.equal(
          (
            await db.query(
              'select count(*) as n from public.lifemate_game_receipts where uid=$1 and action_id=$2',
              [other, input.actionId],
            )
          ).rows[0].n,
          1,
        );
        // Commands other than ready/join still require the client's exact version.
        const stale = await post(uid, {
          type: 'leave',
          roomId: room,
          actionId: crypto.randomUUID(),
          expectedVersion: 1,
          matchId: null,
        });
        assert.equal(stale.status, 409);
        assert.equal((await stale.json()).error, 'version-conflict');
      }
      assert.deepEqual(
        (await rpc(db, 'lifemate_game_read', [uid, authTime, session, false]))
          .room.id,
        room,
      );
    } finally {
      await db.close();
    }
  });
}

function readyApi(db, intercept = (name, args, run) => run(name, args), deal) {
  const sqlRpc = async (name, args) => {
    const fields = Object.keys(args);
    return (
      await db.query(
        `select public.${name}(${fields.map((key, i) => key + '=> $' + (i + 1)).join(',')}) as value`,
        Object.values(args),
      )
    ).rows[0].value;
  };
  const handler = createGameHandler({
    verifyIdentity: async (token) => ({ uid: token, authTime }),
    rpc: (name, args) => intercept(name, args, sqlRpc),
    // Four non-winning hands, with each 2 in a different hand.
    deck:
      deal ??
      (() =>
        Array.from({ length: 52 }, (_, i) =>
          i < 48 ? (i % 4) * 12 + Math.floor(i / 4) : i,
        )),
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
    return { status: response.status, value: await response.json() };
  };
  return { post, sqlRpc };
}

for (const continuous of [false, true]) {
  test(`ready retries ${continuous ? 'stop at a bounded limit' : 'survive all three other players committing first'}`, async () => {
    const db = await setup();
    try {
      await create(db);
      const rivals = [other, 'game-c', 'game-d'];
      let attempts = 0;
      const api = readyApi(db, async (name, args, run) => {
        if (name === 'lifemate_game_commit' && args.p_uid === uid) {
          attempts++;
          if (continuous || attempts <= rivals.length) {
            const record = (
              await run('lifemate_game_read', {
                p_uid: uid,
                p_auth_time: authTime,
                p_session_id: session,
                p_renew: false,
              })
            ).room;
            const actor = rivals[(attempts - 1) % rivals.length];
            const member = record.state.members.find((p) => p.uid === actor);
            await run('lifemate_game_commit', {
              p_uid: actor,
              p_auth_time: authTime,
              p_session_id: session,
              p_action_id: crypto.randomUUID(),
              p_fingerprint: `rival-${attempts}`,
              p_room_id: room,
              p_version: record.version,
              p_match_id: record.match_id,
              p_kind: 'ready',
              p_state: updateRoom(
                record.state,
                actor,
                { type: 'ready', ready: !member.ready },
                Date.now(),
              ),
            });
          }
        }
        return run(name, args);
      });
      for (const actor of rivals) {
        const joined = await api.post(actor, {
          type: 'join',
          code: 'ABCDEFGH',
          name: actor,
          actionId: crypto.randomUUID(),
        });
        assert.equal(joined.status, 200);
      }
      const before = (await api.post(uid, { type: 'sync' })).value.room;
      const input = {
        type: 'ready',
        roomId: room,
        ready: true,
        expectedVersion: before.version,
        matchId: null,
        actionId: crypto.randomUUID(),
      };
      const result = await api.post(uid, input);
      assert.equal(attempts, 4);
      if (continuous) {
        assert.equal(result.status, 409);
        assert.equal(result.value.error, 'version-conflict');
        const current = (await api.post(uid, { type: 'sync' })).value.room;
        assert.equal(current.matchId, null);
        assert.equal(current.members.find((p) => p.uid === uid).ready, false);
      } else {
        assert.equal(result.status, 200, JSON.stringify(result.value));
        assert.equal(result.value.room.phase, 'playing');
        assert.ok(result.value.room.matchId);
        assert.equal(result.value.room.game.hand.length, 13);
        const repeated = await api.post(uid, input);
        assert.equal(repeated.status, 200);
        assert.deepEqual(repeated.value.ack, result.value.ack);
        assert.equal(repeated.value.room.matchId, result.value.room.matchId);
        const stale = await api.post(uid, {
          ...input,
          actionId: crypto.randomUUID(),
        });
        assert.equal(stale.status, 409);
        assert.equal(stale.value.error, 'match-conflict');
        const stalePlay = await api.post(uid, {
          type: 'play',
          cards: [result.value.room.game.hand[0]],
          roomId: room,
          expectedVersion: before.version,
          matchId: result.value.room.matchId,
          actionId: crypto.randomUUID(),
        });
        assert.equal(stalePlay.status, 409);
        assert.equal(stalePlay.value.error, 'version-conflict');
      }
    } finally {
      await db.close();
    }
  });
}

for (const instant of [false, true]) {
  test(`duplicate final ready recovers its receipt for ${instant ? 'an instant win' : 'a playing match'}`, async () => {
    const db = await setup();
    try {
      await create(db);
      let input, duplicate;
      let injected = false;
      const api = readyApi(
        db,
        async (name, args, run) => {
          const result = await run(name, args);
          if (
            input &&
            name === 'lifemate_game_receipt' &&
            args.p_uid === uid &&
            !injected &&
            !result
          ) {
            injected = true;
            duplicate = await api.post(uid, input);
          }
          return result;
        },
        instant ? () => Array.from({ length: 52 }, (_, i) => i) : undefined,
      );
      const joined = await api.post(other, {
        type: 'join',
        name: 'Bình',
        code: 'ABCDEFGH',
        actionId: crypto.randomUUID(),
      });
      const waiting = await api.post(other, {
        type: 'ready',
        ready: true,
        roomId: room,
        matchId: null,
        expectedVersion: joined.value.room.version,
        actionId: crypto.randomUUID(),
      });
      assert.equal(waiting.status, 200);
      input = {
        type: 'ready',
        ready: true,
        roomId: room,
        matchId: null,
        expectedVersion: waiting.value.room.version,
        actionId: crypto.randomUUID(),
      };
      const original = await api.post(uid, input);
      assert.equal(duplicate.status, 200);
      assert.equal(original.status, 200, JSON.stringify(original.value));
      assert.deepEqual(original.value.ack, duplicate.value.ack);
      assert.equal(original.value.room.matchId, duplicate.value.room.matchId);
      assert.equal(original.value.room.version, duplicate.value.room.version);
      const receipts = await db.query(
        'select count(*) as n from public.lifemate_game_receipts where uid=$1 and action_id=$2',
        [uid, input.actionId],
      );
      assert.equal(receipts.rows[0].n, 1);
      if (instant) {
        assert.equal(
          original.value.room.members.reduce((sum, p) => sum + p.wins, 0),
          1,
        );
        const firstMatch = original.value.room;
        for (const actor of [uid, other]) {
          const next = await api.post(actor, {
            type: 'ready',
            ready: true,
            roomId: room,
            matchId: firstMatch.matchId,
            expectedVersion: firstMatch.version,
            actionId: crypto.randomUUID(),
          });
          assert.equal(next.status, 200, JSON.stringify(next.value));
          if (actor === other) {
            assert.notEqual(next.value.room.matchId, firstMatch.matchId);
            assert.equal(
              next.value.room.members.reduce((sum, p) => sum + p.wins, 0),
              2,
            );
          }
        }
        assert.equal(
          (
            await db.query(
              'select count(*) as n from public.lifemate_game_results',
            )
          ).rows[0].n,
          2,
        );
      }
    } finally {
      await db.close();
    }
  });
}

test('ready cancellation rebases within the same lobby but future versions and replaced sessions remain fenced', async () => {
  const db = await setup();
  try {
    await create(db);
    let replaceSession = false;
    const api = readyApi(db, async (name, args, run) => {
      if (
        replaceSession &&
        name === 'lifemate_game_commit' &&
        args.p_uid === uid
      ) {
        replaceSession = false;
        await rpc(db, 'lifemate_game_takeover', [uid, authTime, epoch, room]);
      }
      return run(name, args);
    });
    const input = {
      type: 'ready',
      ready: true,
      roomId: room,
      matchId: null,
      expectedVersion: 1,
      actionId: crypto.randomUUID(),
    };
    const waiting = await api.post(uid, input);
    assert.equal(waiting.status, 200);
    const joined = await api.post(other, {
      type: 'join',
      name: 'Bình',
      code: 'ABCDEFGH',
      actionId: crypto.randomUUID(),
    });
    assert.equal(
      joined.value.room.members.find((p) => p.uid === uid).ready,
      true,
    );
    const cancelled = await api.post(uid, {
      ...input,
      ready: false,
      actionId: crypto.randomUUID(),
    });
    assert.equal(cancelled.status, 200);
    assert.equal(
      cancelled.value.room.members.find((p) => p.uid === uid).ready,
      false,
    );
    const future = await api.post(uid, {
      ...input,
      expectedVersion: cancelled.value.room.version + 1,
      actionId: crypto.randomUUID(),
    });
    assert.equal(future.value.error, 'version-conflict');
    replaceSession = true;
    const replaced = await api.post(uid, {
      ...input,
      actionId: crypto.randomUUID(),
    });
    assert.equal(replaced.value.error, 'session-replaced');
    const wrongRoom = await api.post(other, {
      ...input,
      roomId: epoch,
      actionId: crypto.randomUUID(),
    });
    assert.equal(wrongRoom.value.error, 'room-conflict');
    const outsider = await api.post('game-outsider', {
      ...input,
      actionId: crypto.randomUUID(),
    });
    assert.equal(outsider.status, 403);
    assert.equal(outsider.value.error, 'not-member');
  } finally {
    await db.close();
  }
});

test('API with SQL handles create/join/ready and returns only each viewer hand', async () => {
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
    const status = await post(uid, {
      type: 'room-status',
      roomId: a.room.id,
    });
    assert.equal(status.exists, true);
    assert.equal(status.owner, true);
    assert.equal(status.canRejoin, true);
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
      // Both people clicked against the same pre-ready snapshot.
      expectedVersion: a.room.version - 1,
      matchId: null,
      ready: true,
    });
    a = await post(uid, { type: 'sync' });
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

async function sharedBoard(db, who = uid) {
  return (await rpc(db, 'lifemate_game_score_list', [who, authTime, session]))
    .tables[0];
}
async function scoreWrite(
  db,
  board,
  operation = 'save',
  document = null,
  who = uid,
  actionId = crypto.randomUUID(),
  hash = actionId,
) {
  return rpc(db, 'lifemate_game_score_write', [
    who,
    authTime,
    session,
    actionId,
    hash,
    board.match.id,
    board.match.sharedVersion,
    operation,
    document,
  ]);
}
function scoreDocument(match) {
  const { title, players, seatOrder, dealerPlayerId, rounds, status } = match;
  return { title, players, seatOrder, dealerPlayerId, rounds, status };
}
async function addScoreMember(db) {
  await db.query(
    `update public.lifemate_game_rooms set state=jsonb_set(state,'{scoreMembers}', $2::jsonb) where id=$1`,
    [
      room,
      JSON.stringify([
        { uid, name: 'An' },
        { uid: other, name: 'Bình' },
      ]),
    ],
  );
}
test('shared score endpoints authenticate before reads and reject non-owner mutation', async () => {
  const db = await setup();
  try {
    await create(db);
    await addScoreMember(db);
    const owner = await sharedBoard(db),
      member = await sharedBoard(db, other);
    assert.equal(owner.canEdit, true);
    assert.equal(member.canEdit, false);
    assert.equal(owner.match.id, member.match.id);
    await assert.rejects(
      scoreWrite(db, member, 'save', scoreDocument(member.match), other),
      /not-owner/,
    );
    assert.deepEqual(
      (
        await rpc(db, 'lifemate_game_score_list', [
          'outsider',
          authTime,
          session,
        ])
      ).tables,
      [],
    );
    await assert.rejects(
      rpc(db, 'lifemate_game_score_history', [
        'outsider',
        authTime,
        session,
        owner.match.id,
        null,
      ]),
      /not-member/,
    );
    await db.query(
      'update public.lifemate_account_access set valid_since=$2 where uid=$1',
      [uid, authTime + 1],
    );
    await assert.rejects(sharedBoard(db), /invalid-session/);
  } finally {
    await db.close();
  }
});
test('shared score CAS, idempotency and immutable audit retain score changes/deletions', async () => {
  const db = await setup();
  try {
    await create(db);
    await addScoreMember(db);
    const before = await sharedBoard(db);
    const doc = scoreDocument(before.match);
    doc.rounds = [
      { id: 'r1', createdAt: 1, scores: { [uid]: 10, [other]: -10 } },
    ];
    const actionId = crypto.randomUUID();
    const saved = await scoreWrite(db, before, 'save', doc, uid, actionId);
    assert.deepEqual(
      await scoreWrite(db, before, 'save', doc, uid, actionId),
      saved,
    );
    await assert.rejects(
      scoreWrite(db, before, 'save', doc),
      /version-conflict/,
    );
    await assert.rejects(
      scoreWrite(db, saved, 'save', doc, uid, actionId, 'different'),
      /idempotency-conflict/,
    );
    const edited = scoreDocument(saved.match);
    edited.rounds[0].scores = { [uid]: 20, [other]: -20 };
    const afterEdit = await scoreWrite(db, saved, 'save', edited);
    const deletedRound = scoreDocument(afterEdit.match);
    deletedRound.rounds = [];
    const afterDelete = await scoreWrite(db, afterEdit, 'save', deletedRound);
    assert.deepEqual(afterDelete.match.ignoredOnlineRoundIds, ['r1']);
    const deleteAction = crypto.randomUUID();
    const deleted = await scoreWrite(
      db,
      afterDelete,
      'delete',
      null,
      uid,
      deleteAction,
    );
    assert.deepEqual(
      await scoreWrite(db, afterDelete, 'delete', null, uid, deleteAction),
      deleted,
    );
    assert.ok(deleted.match.deletedAt);
    const events = (
      await rpc(db, 'lifemate_game_score_history', [
        other,
        authTime,
        session,
        before.match.id,
        null,
      ])
    ).events;
    assert.equal(events.filter((event) => event.actorUid === uid).length, 4);
    assert.equal(events[0].changes[0].kind, 'table-delete');
    assert.equal(events[1].changes[0].before.scores[uid], 20);
    assert.equal(events[2].changes[0].before.scores[uid], 10);
    assert.equal(events[2].changes[0].after.scores[uid], 20);
    assert.equal(events[2].actorUid, uid);
    assert.equal(events[2].actorName, 'An');
    await assert.rejects(scoreWrite(db, deleted, 'restore'), /invalid-input/);
    await assert.rejects(scoreWrite(db, deleted, 'save', doc), /room-deleted/);
    await assert.rejects(scoreWrite(db, deleted, 'delete'), /room-deleted/);
    // A receipt replay cannot resurrect the board or append another deletion event.
    assert.deepEqual(
      await scoreWrite(db, before, 'save', doc, uid, actionId),
      deleted,
    );
    assert.deepEqual(await sharedBoard(db), deleted);
    assert.deepEqual(
      (
        await rpc(db, 'lifemate_game_score_history', [
          other,
          authTime,
          session,
          before.match.id,
          null,
        ])
      ).events,
      events,
    );
  } finally {
    await db.close();
  }
});
test('shared score trigger ignores heartbeats, preserves corrections and never replays deleted results', async () => {
  const db = await setup();
  try {
    await create(db);
    await addScoreMember(db);
    const before = await sharedBoard(db);
    await db.query(
      'update public.lifemate_game_rooms set updated_at=now(),state=state where id=$1',
      [room],
    );
    assert.equal(
      (await sharedBoard(db)).match.sharedVersion,
      before.match.sharedVersion,
    );
    const matchId = crypto.randomUUID();
    const game = {
      status: 'finished',
      players: [
        { uid, name: 'An' },
        { uid: other, name: 'Bình' },
      ],
      result: {
        ranking: [
          { uid, moneyDelta: 10 },
          { uid: other, moneyDelta: -10 },
        ],
      },
    };
    await db.query(
      "update public.lifemate_game_rooms set match_id=$2,state=jsonb_set(state,'{game}',$3) where id=$1",
      [room, matchId, game],
    );
    let board = await sharedBoard(db);
    assert.equal(board.match.rounds[0].scores[uid], 10);
    const edited = scoreDocument(board.match);
    edited.rounds[0].scores[uid] = 50;
    board = await scoreWrite(db, board, 'save', edited);
    await db.query(
      'update public.lifemate_game_rooms set state=state where id=$1',
      [room],
    );
    assert.equal((await sharedBoard(db)).match.rounds[0].scores[uid], 50);
    const removed = scoreDocument(board.match);
    removed.rounds = [];
    board = await scoreWrite(db, board, 'save', removed);
    await db.query(
      'update public.lifemate_game_rooms set state=state where id=$1',
      [room],
    );
    assert.deepEqual((await sharedBoard(db)).match.rounds, []);
    const tombstone = await scoreWrite(db, board, 'delete');
    await db.query(
      'update public.lifemate_game_rooms set match_id=$2,state=state where id=$1',
      [room, crypto.randomUUID()],
    );
    assert.deepEqual((await sharedBoard(db)).match.rounds, []);
    assert.equal(
      (await sharedBoard(db)).match.deletedAt,
      tombstone.match.deletedAt,
    );
  } finally {
    await db.close();
  }
});
test('owner transfer revokes old score authority and deletion of room retains shared audit', async () => {
  const db = await setup();
  try {
    await create(db);
    await addScoreMember(db);
    const before = await sharedBoard(db);
    await db.query(
      "update public.lifemate_game_rooms set state=jsonb_set(state,'{ownerUid}',$2) where id=$1",
      [room, JSON.stringify(other)],
    );
    await assert.rejects(scoreWrite(db, before, 'delete'), /not-owner/);
    const next = await sharedBoard(db, other);
    assert.equal(next.canEdit, true);
    const updated = await scoreWrite(
      db,
      next,
      'save',
      { ...scoreDocument(next.match), title: 'Bàn chung' },
      other,
    );
    await db.query('delete from public.lifemate_game_rooms where id=$1', [
      room,
    ]);
    const deleted = await scoreWrite(db, updated, 'delete', null, other);
    assert.ok(deleted.match.deletedAt);
    assert.equal(
      (
        await rpc(db, 'lifemate_game_score_history', [
          uid,
          authTime,
          session,
          before.match.id,
          null,
        ])
      ).events.filter((event) => event.actorUid === other).length,
      2,
    );
    const access = await db.query(
      "select has_table_privilege('authenticated','public.lifemate_game_score_events','update') allowed,has_function_privilege('authenticated','public.lifemate_game_score_write(text,bigint,uuid,uuid,text,uuid,bigint,text,jsonb)','execute') callable",
    );
    assert.equal(access.rows[0].allowed, false);
    assert.equal(access.rows[0].callable, false);
  } finally {
    await db.close();
  }
});
test('historical account erasure purges shared audit before roster changes and recreates only sanitized identity', async () => {
  const db = await setup();
  try {
    await create(db);
    await addScoreMember(db);
    const first = await sharedBoard(db);
    await rpc(db, 'lifemate_game_erase_account', [other]);
    assert.equal(
      (
        await db.query(
          'select count(*)::integer n from public.lifemate_game_score_tables',
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query(
          'select count(*)::integer n from public.lifemate_game_score_events',
        )
      ).rows[0].n,
      0,
    );
    await db.query(
      'update public.lifemate_game_rooms set state=state where id=$1',
      [room],
    );
    const fresh = await sharedBoard(db);
    assert.notEqual(fresh.match.id, first.match.id);
    assert.equal(JSON.stringify(fresh).includes(other), false);
  } finally {
    await db.close();
  }
});

test('shared board keeps the authoritative per-card rate set by room creation wrapper', async () => {
  const db = await setup();
  try {
    await rpc(db, 'lifemate_game_create', [
      uid,
      authTime,
      session,
      action,
      'paid-shared-room',
      room,
      'ABCDEFGH',
      'An',
      2,
    ]);
    const board = await sharedBoard(db);
    assert.equal(board.match.amountPerCard, 2);
    assert.equal(board.match.onlineRoomCode, 'ABCDEFGH');
    assert.equal(board.match.players.length, 1);
  } finally {
    await db.close();
  }
});
test('cancelled all-disconnected room result creates no shared score round', async () => {
  const db = await setup();
  try {
    await create(db);
    await addScoreMember(db);
    const game = newTienLenGame(
      [uid, other],
      Array.from({ length: 52 }, (_, index) => (index * 17) % 52),
      Date.now(),
    );
    assert.equal(game.status, 'playing');
    await db.query(
      "update public.lifemate_game_rooms set match_id=$2,state=state||$3::jsonb,expires_at=now()-interval '1 second',next_due=now()-interval '1 second' where id=$1",
      [
        room,
        crypto.randomUUID(),
        JSON.stringify({
          phase: 'playing',
          members: [
            { uid, name: 'An' },
            { uid: other, name: 'Bình' },
          ],
          game,
        }),
      ],
    );
    const claimed = await rpc(db, 'lifemate_game_claim_due', [epoch]);
    const record = claimed.rooms[0];
    const candidate = advanceExpiredRoom(record, Number(claimed.now));
    assert.equal(candidate.state.game.result.reason, 'all-disconnected');
    assert.equal(
      await rpc(db, 'lifemate_game_commit_worker', [
        room,
        epoch,
        record.version,
        candidate.state,
        candidate.removed,
      ]),
      true,
    );
    assert.deepEqual((await sharedBoard(db)).match.rounds, []);
  } finally {
    await db.close();
  }
});

test('shared score HTTP routes work under the real service role and fence member writes', async () => {
  const db = await setup();
  try {
    await create(db);
    await addScoreMember(db);
    await db.exec('set role service_role');
    const handler = createGameHandler({
      verifyIdentity: async (token) => ({ uid: token, authTime }),
      rpc: async (name, args) => {
        const fields = Object.keys(args);
        const result = await db.query(
          `select public.${name}(${fields.map((key, index) => key + '=> $' + (index + 1)).join(',')}) value`,
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
          body: JSON.stringify({
            sessionId: session,
            clientVersion: 2,
            ...input,
          }),
        }),
      );
      return { status: response.status, body: await response.json() };
    };
    const list = await post(uid, { type: 'score-list' });
    assert.equal(list.status, 200);
    const board = list.body.tables[0];
    const document = { ...scoreDocument(board.match), title: 'Bàn của phòng' };
    const input = {
      type: 'score-write',
      tableId: board.match.id,
      actionId: crypto.randomUUID(),
      expectedVersion: board.match.sharedVersion,
      operation: 'save',
      document,
    };
    const denied = await post(other, input);
    assert.equal(denied.status, 403);
    assert.equal(denied.body.error, 'not-owner');
    const saved = await post(uid, input);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.match.title, document.title);
    const member = await post(other, { type: 'score-list' });
    assert.equal(member.body.tables[0].canEdit, false);
    assert.equal(member.body.tables[0].match.title, document.title);
    const history = await post(other, {
      type: 'score-history',
      tableId: board.match.id,
      before: null,
    });
    assert.equal(history.status, 200);
    assert.equal(history.body.events[0].actorUid, uid);
  } finally {
    await db.close();
  }
});
test('shared audit pagination retains deleted-board events without overlap', async () => {
  const db = await setup();
  try {
    await create(db);
    const board = await sharedBoard(db);
    await db.query(
      'insert into public.lifemate_game_score_events(table_id,version,actor_uid,actor_name,at,changes) select $1,n,$2,\'An\',n,\'[{"kind":"table-delete"}]\'::jsonb from generate_series(1,35) n',
      [board.match.id, uid],
    );
    const first = await rpc(db, 'lifemate_game_score_history', [
      uid,
      authTime,
      session,
      board.match.id,
      null,
    ]);
    assert.equal(first.events.length, 30);
    assert.equal(first.nextBefore, 6);
    const second = await rpc(db, 'lifemate_game_score_history', [
      uid,
      authTime,
      session,
      board.match.id,
      first.nextBefore,
    ]);
    assert.equal(second.events.length, 5);
    assert.equal(second.nextBefore, null);
    assert.equal(
      new Set([...first.events, ...second.events].map((event) => event.id))
        .size,
      35,
    );
  } finally {
    await db.close();
  }
});

// Membership recovery must not be confused with admitting a fifth person.
test('four seated players can rejoin with fresh actions without changing roster; fifth is rejected', async () => {
  const db = await setup();
  try {
    await create(db);
    const api = readyApi(db);
    for (const actor of [other, 'game-c', 'game-d']) {
      const joined = await api.post(actor, {
        type: 'join',
        name: actor,
        code: 'ABCDEFGH',
        actionId: crypto.randomUUID(),
      });
      assert.equal(joined.status, 200, JSON.stringify(joined.value));
    }
    const before = (await api.post(uid, { type: 'sync' })).value.room;
    for (const actor of [uid, other, 'game-c', 'game-d']) {
      const again = await api.post(actor, {
        type: 'join',
        name: actor,
        code: 'ABCDEFGH',
        actionId: crypto.randomUUID(),
      });
      assert.equal(again.status, 200, JSON.stringify(again.value));
      assert.equal(again.value.room.members.length, 4);
      assert.equal(again.value.room.version, before.version);
    }
    const fifth = await api.post('game-e', {
      type: 'join',
      name: 'Fifth',
      code: 'ABCDEFGH',
      actionId: crypto.randomUUID(),
    });
    assert.equal(fifth.status, 409);
    assert.equal(fifth.value.error, 'room-full');
    assert.equal(
      (await api.post(uid, { type: 'sync' })).value.room.members.length,
      4,
    );
  } finally {
    await db.close();
  }
});

async function fillManagedRoom(db, api, count = 4) {
  await create(db);
  for (const actor of [other, 'game-c', 'game-d'].slice(0, count - 1)) {
    const joined = await api.post(actor, {
      type: 'join',
      name: actor,
      code: 'ABCDEFGH',
      actionId: crypto.randomUUID(),
    });
    assert.equal(joined.status, 200, JSON.stringify(joined.value));
  }
  return (await api.post(uid, { type: 'sync' })).value.room;
}

test('simultaneous fourth and fifth joins admit only one and preserve all existing seats', async () => {
  const db = await setup();
  try {
    const api = readyApi(db);
    await fillManagedRoom(db, api, 3);
    const results = await Promise.all(
      ['game-d', 'game-e'].map((actor) =>
        api.post(actor, {
          type: 'join',
          name: actor,
          code: 'ABCDEFGH',
          actionId: crypto.randomUUID(),
        }),
      ),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      results.find((r) => r.status === 409).value.error,
      'room-full',
    );
    assert.equal(
      (await api.post(uid, { type: 'sync' })).value.room.members.length,
      4,
    );
    for (const actor of [uid, other, 'game-c'])
      assert.ok((await api.post(actor, { type: 'sync' })).value.room);
  } finally {
    await db.close();
  }
});

test('owner-only kick atomically removes one seat, persists session-bound notice and permits explicit later rejoin', async () => {
  const db = await setup();
  try {
    const api = readyApi(db);
    const before = await fillManagedRoom(db, api);
    const input = {
      type: 'kick',
      targetUid: other,
      roomId: before.id,
      expectedVersion: before.version,
      matchId: before.matchId,
      actionId: crypto.randomUUID(),
    };
    assert.equal((await api.post('game-c', input)).value.error, 'not-owner');
    assert.equal(
      (await api.post(uid, { ...input, targetUid: uid })).status,
      400,
    );
    assert.equal(
      (await api.post(uid, { ...input, targetUid: 'missing' })).status,
      400,
    );
    assert.equal(
      (await api.post(uid, { ...input, expectedVersion: before.version - 1 }))
        .value.error,
      'version-conflict',
    );
    const kicked = await api.post(uid, input);
    assert.equal(kicked.status, 200, JSON.stringify(kicked.value));
    assert.equal(kicked.value.room.members.length, 3);
    assert.notEqual(kicked.value.room.epoch, before.epoch);
    assert.ok(!kicked.value.room.members.some((m) => m.uid === other));
    const first = await api.post(other, { type: 'sync' });
    assert.equal(first.value.room, null);
    assert.equal(first.value.removal.reason, 'kicked');
    assert.equal(first.value.removal.id, input.actionId);
    assert.deepEqual(
      (await api.post(other, { type: 'bootstrap' })).value.removal,
      first.value.removal,
    );
    const otherDevice = await api.sqlRpc('lifemate_game_read', {
      p_uid: other,
      p_auth_time: authTime,
      p_session_id: crypto.randomUUID(),
      p_renew: false,
    });
    assert.equal(otherDevice.removal, undefined);
    const duplicate = await api.post(uid, input);
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.value.room.version, kicked.value.room.version);
    const hints = (
      await db.query(
        "select * from public.test_game_hints where event='invalidate'",
      )
    ).rows;
    assert.ok(hints.some((h) => h.topic.includes(before.epoch)));
    const joined = await api.post(other, {
      type: 'join',
      code: 'ABCDEFGH',
      name: 'Back',
      actionId: crypto.randomUUID(),
    });
    assert.equal(joined.status, 200, JSON.stringify(joined.value));
    await api.post(other, {
      type: 'leave',
      roomId: joined.value.room.id,
      expectedVersion: joined.value.room.version,
      matchId: joined.value.room.matchId,
      actionId: crypto.randomUUID(),
    });
    assert.equal(
      (await api.post(other, { type: 'sync' })).value.removal,
      undefined,
    );
    assert.equal(
      (
        await db.query(
          "select count(*) as n from public.lifemate_game_receipts where uid=$1 and fingerprint='room-kicked'",
          [other],
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});

test('kick during play preserves scoring participants, removes target and fences their stale play', async () => {
  const db = await setup();
  try {
    const api = readyApi(db);
    await fillManagedRoom(db, api);
    for (const actor of [uid, other, 'game-c', 'game-d']) {
      const s = (await api.post(actor, { type: 'sync' })).value.room;
      assert.equal(
        (
          await api.post(actor, {
            type: 'ready',
            ready: true,
            roomId: s.id,
            expectedVersion: s.version,
            matchId: s.matchId,
            actionId: crypto.randomUUID(),
          })
        ).status,
        200,
      );
    }
    const before = (await api.post(uid, { type: 'sync' })).value.room;
    assert.equal(before.phase, 'playing');
    const kicked = await api.post(uid, {
      type: 'kick',
      targetUid: other,
      roomId: before.id,
      expectedVersion: before.version,
      matchId: before.matchId,
      actionId: crypto.randomUUID(),
    });
    assert.equal(kicked.status, 200, JSON.stringify(kicked.value));
    assert.equal(kicked.value.room.members.length, 3);
    assert.equal(
      kicked.value.room.game.players.find((p) => p.uid === other).forfeited,
      true,
    );
    assert.equal(kicked.value.room.game.players.length, 4);
    const stale = await api.post(other, {
      type: 'pass',
      roomId: before.id,
      expectedVersion: before.version,
      matchId: before.matchId,
      actionId: crypto.randomUUID(),
    });
    assert.equal(stale.status, 403);
    assert.equal(
      (await api.post(other, { type: 'sync' })).value.removal.reason,
      'kicked',
    );
  } finally {
    await db.close();
  }
});

test('a lost recovery response retried after kick returns removal and never enrolls again', async () => {
  const db = await setup();
  try {
    const api = readyApi(db);
    await fillManagedRoom(db, api);
    const recovery = {
      type: 'join',
      name: 'Recover',
      code: 'ABCDEFGH',
      actionId: crypto.randomUUID(),
    };
    assert.equal((await api.post(other, recovery)).status, 200);
    const before = (await api.post(uid, { type: 'sync' })).value.room;
    assert.equal(
      (
        await api.post(uid, {
          type: 'kick',
          targetUid: other,
          roomId: before.id,
          expectedVersion: before.version,
          matchId: before.matchId,
          actionId: crypto.randomUUID(),
        })
      ).status,
      200,
    );
    const retried = await api.post(other, recovery);
    assert.equal(retried.status, 200, JSON.stringify(retried.value));
    assert.equal(retried.value.room, null);
    assert.equal(retried.value.removal.reason, 'kicked');
    assert.equal(
      (await api.post(uid, { type: 'sync' })).value.room.members.length,
      3,
    );
  } finally {
    await db.close();
  }
});

test('seated recovery on another session does not take over the controller', async () => {
  const db = await setup();
  try {
    const api = readyApi(db);
    await fillManagedRoom(db, api);
    const before = (await api.post(other, { type: 'sync' })).value.room;
    const recovered = await api.post(other, {
      type: 'join',
      name: 'Recover',
      code: 'ABCDEFGH',
      actionId: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
    });
    assert.equal(recovered.status, 200, JSON.stringify(recovered.value));
    assert.equal(recovered.value.room.controller, false);
    assert.equal(recovered.value.room.version, before.version);
    assert.equal(recovered.value.room.members.length, 4);
    assert.equal(
      (await api.post(other, { type: 'sync' })).value.room.controller,
      true,
    );
  } finally {
    await db.close();
  }
});

test('SQL independently rejects overflow and non-owner kicks', async () => {
  const db = await setup();
  try {
    const api = readyApi(db);
    await fillManagedRoom(db, api);
    const row = (await db.query('select * from public.lifemate_game_rooms'))
      .rows[0];
    const commit = (actor, kind, state) =>
      api.sqlRpc('lifemate_game_commit', {
        p_uid: actor,
        p_auth_time: authTime,
        p_session_id: session,
        p_action_id: crypto.randomUUID(),
        p_fingerprint: crypto.randomUUID(),
        p_room_id: row.id,
        p_version: row.version,
        p_match_id: row.match_id,
        p_kind: kind,
        p_state: state,
      });
    await assert.rejects(commit('game-e', 'join', row.state), /room-full/);
    await assert.rejects(
      commit('game-e', 'join', {
        ...row.state,
        members: [
          ...row.state.members,
          { uid: 'game-e', name: 'Fifth', ready: false, wins: 0 },
        ],
      }),
      /invalid-input/,
    );
    const removed = {
      ...row.state,
      members: row.state.members.filter((m) => m.uid !== 'game-d'),
    };
    await assert.rejects(commit(other, 'kick', removed), /not-owner/);
    await db.query(
      "update public.lifemate_game_rooms set state=jsonb_set(state,'{ownerUid}','null'::jsonb) where id=$1",
      [row.id],
    );
    await assert.rejects(
      commit(uid, 'kick', { ...removed, ownerUid: null }),
      /not-owner/,
    );
    assert.equal(
      (await api.post(uid, { type: 'sync' })).value.room.members.length,
      4,
    );
  } finally {
    await db.close();
  }
});

test('bounded score patches edit, finish and remove players beyond the legacy body/round limits', async () => {
  const db = await setup();
  try {
    await create(db);
    await addScoreMember(db);
    let board = await sharedBoard(db);
    const rounds = Array.from({ length: 3001 }, (_, i) => ({
      id: `round-${crypto.randomUUID()}`,
      createdAt: 1700000000000 + i,
      scores: { [uid]: i, [other]: -i },
    }));
    await db.query(
      "update public.lifemate_game_score_tables set document=jsonb_set(document,'{rounds}',$2::jsonb) where id=$1",
      [board.match.id, JSON.stringify(rounds)],
    );
    board = await sharedBoard(db);
    const full = scoreDocument(board.match);
    assert.ok(Buffer.byteLength(JSON.stringify(full)) > 262144);
    const { rounds: _rounds, ...settings } = full;
    const api = readyApi(db);
    const input = {
      type: 'score-write',
      tableId: board.match.id,
      actionId: crypto.randomUUID(),
      expectedVersion: board.match.sharedVersion,
      operation: 'patch',
      document: {
        settings: { ...settings, title: 'Bàn lớn đã sửa', status: 'finished' },
        upsertRounds: [],
        deleteRoundIds: [],
      },
    };
    assert.equal(
      (await api.post(uid, { ...input, operation: 'save', document: full }))
        .status,
      400,
    );
    assert.equal((await api.post(other, input)).status, 403);
    let result = await api.post(uid, input);
    assert.equal(result.status, 200, JSON.stringify(result.value));
    assert.equal(result.value.match.status, 'finished');
    assert.equal(result.value.match.rounds.length, 3001);
    const revision = result.value.match.sharedVersion;
    assert.equal(
      (await api.post(uid, input)).value.match.sharedVersion,
      revision,
    );
    assert.equal(
      (await api.post(uid, { ...input, actionId: crypto.randomUUID() })).status,
      409,
    );
    const edit = {
      ...input,
      actionId: crypto.randomUUID(),
      expectedVersion: revision,
      document: {
        ...input.document,
        upsertRounds: [{ ...rounds[2500], scores: { [uid]: 7, [other]: -7 } }],
        deleteRoundIds: [rounds[0].id],
      },
    };
    result = await api.post(uid, edit);
    assert.equal(result.status, 200, JSON.stringify(result.value));
    assert.equal(result.value.match.rounds.length, 3000);
    assert.equal(
      result.value.match.rounds.find((r) => r.id === rounds[2500].id).scores[
        uid
      ],
      7,
    );
    assert.ok(result.value.match.ignoredOnlineRoundIds.includes(rounds[0].id));
    const removePlayer = {
      ...input,
      actionId: crypto.randomUUID(),
      expectedVersion: result.value.match.sharedVersion,
      document: {
        settings: {
          ...input.document.settings,
          players: [{ id: uid, name: 'An' }],
          seatOrder: [uid],
          dealerPlayerId: uid,
        },
        upsertRounds: [],
        deleteRoundIds: [],
      },
    };
    result = await api.post(uid, removePlayer);
    assert.equal(result.status, 200, JSON.stringify(result.value));
    assert.equal(result.value.match.rounds.length, 3000);
    assert.ok(result.value.match.rounds.every((r) => !(other in r.scores)));
    assert.ok(result.value.match.ignoredOnlinePlayerIds.includes(other));
    const history = await api.post(uid, {
      type: 'score-history',
      tableId: board.match.id,
      before: null,
    });
    assert.ok(
      history.value.events.some(
        (e) =>
          e.actorUid === uid && e.changes.some((c) => c.kind === 'round-edit'),
      ),
    );
  } finally {
    await db.close();
  }
});
