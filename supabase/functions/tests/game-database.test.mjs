import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { advanceExpiredRoom } from '../game-access/worker.mjs';
import { createGameHandler } from '../game-access/handler.mjs';
import { shouldStartRematch, updateRoom } from '../game-access/rooms.mjs';
import { newTanGame } from '../game-access/tan.mjs';
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
const newOnlineGameVariantsSql = await readFile(
  new URL(
    '../../migrations/20261025163926_lifemate_new_online_game_variants.sql',
    import.meta.url,
  ),
  'utf8',
);
const variantRoomConfigurationSql = await readFile(
  new URL(
    '../../migrations/20261025163933_card_game_variant_room_configuration.sql',
    import.meta.url,
  ),
  'utf8',
);
const variantV2ScoringSql = await readFile(
  new URL(
    '../../migrations/20261025163939_card_game_v2_scoring_profiles.sql',
    import.meta.url,
  ),
  'utf8',
);
const southInstantWinSql = await readFile(
  new URL(
    '../../migrations/20261029191125_south_instant_win_penalty.sql',
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

async function setup(beforePhomRules = false) {
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
  await db.exec(
    await readFile(
      new URL(
        '../../migrations/20261022194436_phom_online_rooms.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        '../../migrations/20261023112114_south_configured_rounds.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        '../../migrations/20261023122005_inroom_south_rules.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        '../../migrations/20261023151401_game_takeover_capability.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  if (beforePhomRules) return db;
  await db.exec(
    await readFile(
      new URL(
        '../../migrations/20261023152105_inroom_phom_rules.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        '../../migrations/20261023154433_phom_options_capability.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        '../../migrations/20261023155152_phom_optional_rules.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        '../../migrations/20261023163323_phom_rules_capability_guard.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await db.exec(newOnlineGameVariantsSql);
  await db.exec(variantRoomConfigurationSql);
  await db.exec(variantV2ScoringSql);
  await db.exec(southInstantWinSql);
  await db.exec(await readFile(new URL('../../migrations/20261029191148_preserve_explicit_ownerless_rooms.sql', import.meta.url), 'utf8'));
  return db;
}

test('configured South RPC pins mode/fine, preserves legacy rooms and rejects malformed or mutable settings', async () => {
  const db = await setup();
  try {
    const config = { finishMode: 'first-winner', cutTwoAmount: 17 };
    const args = [
      uid,
      authTime,
      session,
      action,
      'south-config',
      room,
      'ABCDEFGH',
      'An',
      5,
      config,
    ];
    await rpc(db, 'lifemate_game_create_south', args);
    await rpc(db, 'lifemate_game_create_south', args);
    const stored = (
      await rpc(db, 'lifemate_game_read', [uid, authTime, session, false])
    ).room;
    assert.deepEqual(stored.state.southConfig, config);
    assert.equal(stored.state.amountPerCard, 5);
    assert.equal(
      (await rpc(db, 'lifemate_game_status', [uid, authTime, session, room]))
        .minClientVersion,
      4,
    );
    await assert.rejects(
      db.query(
        "update public.lifemate_game_rooms set state=state-'southConfig' where id=$1",
        [room],
      ),
      /invalid-input/,
    );
    for (const invalid of [
      null,
      [],
      {},
      { ...config, cutTwoAmount: -1 },
      { ...config, cutTwoAmount: 1.1 },
      { ...config, cutTwoAmount: 1000000001 },
      { ...config, instantWinAmount: -1 },
      { ...config, instantWinAmount: 1.5 },
      { ...config, instantWinAmount: 1000000001 },
      { ...config, other: true },
    ]) {
      await assert.rejects(
        rpc(db, 'lifemate_game_assert_south_config', [invalid]),
        /invalid-input/,
      );
    }
    for (const role of ['anon', 'authenticated'])
      assert.equal(
        (
          await db.query(
            "select has_function_privilege($1,'public.lifemate_game_create_south(text,bigint,uuid,uuid,text,uuid,text,text,bigint,jsonb)','execute') ok",
            [role],
          )
        ).rows[0].ok,
        false,
      );
  } finally {
    await db.close();
  }
});

test('capability4 preserves Phỏm and gates configured South before seating, takeover and reopen', async () => {
  const db = await setup();
  try {
    const api = readyApi(db);
    const made = await api.post(uid, {
      type: 'create',
      clientVersion: 4,
      name: 'An',
      game: 'south',
      amountPerCard: 5,
      southConfig: { finishMode: 'first-winner', cutTwoAmount: 17 },
      actionId: crypto.randomUUID(),
    });
    assert.equal(made.status, 200, JSON.stringify(made.value));
    const code = made.value.room.code,
      id = made.value.room.id;
    for (const clientVersion of [undefined, 2, 3]) {
      const old = await api.post(other, {
        type: 'join',
        clientVersion,
        name: 'Bình',
        code,
        actionId: crypto.randomUUID(),
      });
      assert.equal(old.status, 409);
      assert.equal(old.value.error, 'game-update-required');
      assert.equal(
        (
          await db.query(
            'select count(*) n from public.lifemate_game_seats where uid=$1',
            [other],
          )
        ).rows[0].n,
        0,
      );
    }
    const joined = await api.post(other, {
      type: 'join',
      clientVersion: 4,
      name: 'Bình',
      code,
      actionId: crypto.randomUUID(),
    });
    assert.equal(joined.status, 200, JSON.stringify(joined.value));
    for (const clientVersion of [2, 3]) {
      assert.equal(
        (await api.post(other, { type: 'takeover', clientVersion, roomId: id }))
          .value.error,
        'game-update-required',
      );
      assert.equal(
        (
          await api.post(uid, {
            type: 'reopen',
            clientVersion,
            name: 'An',
            roomId: id,
            expectedVersion: joined.value.room.version,
            matchId: null,
            actionId: crypto.randomUUID(),
          })
        ).value.error,
        'game-update-required',
      );
    }
    // Version4 remains a superset of the already deployed Phỏm protocol.
    const db2 = await setup();
    try {
      const phom = await readyApi(db2).post(uid, {
        type: 'create',
        clientVersion: 4,
        name: 'An',
        game: 'phom',
        phomConfig: {
          second: 1,
          third: 2,
          last: 3,
          eat: 1,
          chot: 4,
          mom: 4,
          u: 5,
          uTron: 10,
          den: 5,
          forfeit: 4,
        },
        actionId: crypto.randomUUID(),
      });
      assert.equal(phom.status, 200, JSON.stringify(phom.value));
      assert.equal(phom.value.room.gameKind, 'phom');
    } finally {
      await db2.close();
    }
  } finally {
    await db.close();
  }
});

test('South instant-win fees persist under capability12 and settle from every opponent', async () => {
  const db = await setup();
  try {
    const a = Array.from({ length: 13 }, (_, rank) => rank * 4);
    const allCards = Array.from({ length: 52 }, (_, card) => card);
    const b = allCards.filter((card) => !a.includes(card)).slice(0, 13);
    const deck = a.flatMap((card, i) => [card, b[i]]);
    deck.push(...allCards.filter((card) => !deck.includes(card)));
    const api = readyApi(db, undefined, () => deck);
    const config = {
      finishMode: 'continue',
      cutTwoAmount: 0,
      instantWinAmount: 20,
    };
    const created = await api.post(uid, {
      type: 'create',
      clientVersion: 12,
      actionId: crypto.randomUUID(),
      game: 'south',
      amountPerCard: 5,
      southConfig: config,
      name: 'An',
    });
    assert.equal(created.status, 200, JSON.stringify(created.value));
    assert.deepEqual(created.value.room.southConfig, config);
    assert.equal(
      (await rpc(db, 'lifemate_game_status', [
        uid,
        authTime,
        session,
        created.value.room.id,
      ])).minClientVersion,
      12,
    );
    await assert.rejects(
      rpc(db, 'lifemate_game_takeover', [
        uid,
        authTime,
        crypto.randomUUID(),
        created.value.room.id,
        11,
      ]),
      /game-update-required/,
    );
    const legacyJoin = await api.post(other, {
      type: 'join',
      clientVersion: 11,
      actionId: crypto.randomUUID(),
      code: created.value.room.code,
      name: 'Bình',
    });
    assert.equal(legacyJoin.status, 409);
    assert.equal(legacyJoin.value.error, 'game-update-required');
    assert.equal(
      (await db.query('select count(*) n from public.lifemate_game_seats where uid=$1', [other])).rows[0].n,
      0,
    );
    const joined = await api.post(other, {
      type: 'join',
      clientVersion: 12,
      actionId: crypto.randomUUID(),
      code: created.value.room.code,
      name: 'Bình',
    });
    assert.equal(joined.status, 200, JSON.stringify(joined.value));
    const updatedRules = await api.post(uid, {
      type: 'set-south-rules',
      clientVersion: 12,
      actionId: crypto.randomUUID(),
      roomId: created.value.room.id,
      expectedVersion: joined.value.room.version,
      matchId: null,
      amountPerCard: 5,
      southConfig: { ...config, instantWinAmount: 30 },
    });
    assert.equal(updatedRules.status, 200, JSON.stringify(updatedRules.value));
    assert.equal(updatedRules.value.room.nextSouthRules.southConfig.instantWinAmount, 30);
    let current = updatedRules.value.room;
    for (const actor of [uid, other])
      current = (
        await api.post(actor, {
          type: 'ready',
          clientVersion: 12,
          actionId: crypto.randomUUID(),
          roomId: current.id,
          expectedVersion: current.version,
          matchId: current.matchId,
          ready: true,
        })
      ).value.room;
    assert.equal(current.phase, 'finished');
    assert.deepEqual(
      current.game.result.ranking.map((entry) => entry.moneyDelta),
      [95, -95],
    );
    assert.equal(
      current.game.result.ranking[1].breakdown.some(
        (entry) => entry.kind === 'instant-win' && entry.amount === -30,
      ),
      true,
    );
    assert.equal(
      current.members.reduce((sum, member) => sum + member.balance, 0),
      0,
    );
  } finally {
    await db.close();
  }
});

test('South first-winner completes through HTTP/SQL once and records all remaining-card penalties', async () => {
  const db = await setup();
  try {
    const a = [0, 1, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44];
    const b = Array.from({ length: 52 }, (_, i) => i)
      .filter((c) => !a.includes(c))
      .slice(0, 13);
    const deck = a.flatMap((c, i) => [c, b[i]]);
    deck.push(
      ...Array.from({ length: 52 }, (_, i) => i).filter(
        (c) => !deck.includes(c),
      ),
    );
    const api = readyApi(db, undefined, () => deck);
    let current = (
      await api.post(uid, {
        type: 'create',
        clientVersion: 4,
        name: 'An',
        game: 'south',
        amountPerCard: 5,
        southConfig: { finishMode: 'first-winner', cutTwoAmount: 17 },
        actionId: crypto.randomUUID(),
      })
    ).value.room;
    current = (
      await api.post(other, {
        type: 'join',
        clientVersion: 4,
        name: 'Bình',
        code: current.code,
        actionId: crypto.randomUUID(),
      })
    ).value.room;
    for (const actor of [uid, other])
      current = (
        await api.post(actor, {
          type: 'ready',
          clientVersion: 4,
          roomId: current.id,
          expectedVersion: current.version,
          matchId: current.matchId,
          ready: true,
          actionId: crypto.randomUUID(),
        })
      ).value.room;
    assert.equal(current.game.rulesVersion, 'south-v2');
    for (const [actor, type, cards] of [
      [uid, 'play', [0, 1]],
      [other, 'pass', undefined],
      [uid, 'play', a.filter((c) => c > 1)],
    ]) {
      const input = {
        type,
        clientVersion: 4,
        roomId: current.id,
        expectedVersion: current.version,
        matchId: current.matchId,
        actionId: crypto.randomUUID(),
        ...(cards && { cards }),
      };
      const response = await api.post(actor, input);
      assert.equal(response.status, 200, JSON.stringify(response.value));
      current = response.value.room;
      assert.equal(
        (await api.post(actor, input)).value.room.version,
        current.version,
      );
    }
    assert.equal(current.phase, 'finished');
    assert.deepEqual(
      current.game.result.ranking.map((p) => p.moneyDelta),
      [65, -65],
    );
    assert.equal((await sharedBoard(db)).match.rounds.length, 1);
    assert.equal(current.game.hand.length, 0);
    assert.equal(
      (await api.post(other, { type: 'sync', clientVersion: 4 })).value.room
        .game.hand.length,
      13,
    );
  } finally {
    await db.close();
  }
});

test('Phỏm create persists independent rates, correct title, immutable settings and service-only access', async () => {
  const db = await setup();
  try {
    const config = {
      second: 11,
      third: 22,
      last: 33,
      eat: 44,
      chot: 55,
      mom: 66,
      u: 77,
      uTron: 88,
      den: 99,
      forfeit: 111,
    };
    const args = [
      uid,
      authTime,
      session,
      action,
      'phom-create',
      room,
      'ABCDEFGH',
      'An',
      config,
    ];
    const created = await rpc(db, 'lifemate_game_create_phom', args);
    assert.equal(created.roomId, room);
    const loaded = await rpc(db, 'lifemate_game_read', [
      uid,
      authTime,
      session,
      false,
    ]);
    assert.deepEqual(loaded.room.state.phomConfig, config);
    assert.equal(loaded.room.state.gameKind, 'phom');
    assert.equal((await sharedBoard(db)).match.title, 'Phỏm · ABCDEFGH');
    await rpc(db, 'lifemate_game_create_phom', args);
    await assert.rejects(
      db.query(
        'update public.lifemate_game_rooms set state=state||$1::jsonb where id=$2',
        [JSON.stringify({ phomConfig: { ...config, u: 2 } }), room],
      ),
      /invalid-input/,
    );
    await assert.rejects(
      db.query(
        "update public.lifemate_game_rooms set state=state-'gameKind' where id=$1",
        [room],
      ),
      /invalid-input/,
    );
    for (const role of ['anon', 'authenticated'])
      assert.equal(
        (
          await db.query(
            "select has_function_privilege($1,'public.lifemate_game_create_phom(text,bigint,uuid,uuid,text,uuid,text,text,jsonb)','execute') ok",
            [role],
          )
        ).rows[0].ok,
        false,
      );
  } finally {
    await db.close();
  }
});

test('Phỏm HTTP gates old clients before seating/takeover and plays through SQL CAS to a shared score', async () => {
  const db = await setup();
  try {
    await db.exec('set role service_role');
    const { post } = readyApi(db);
    const config = {
      second: 1,
      third: 2,
      last: 3,
      eat: 1,
      chot: 4,
      mom: 4,
      u: 5,
      uTron: 10,
      den: 5,
      forfeit: 17,
    };
    const made = await post(uid, {
      type: 'create',
      clientVersion: 3,
      actionId: crypto.randomUUID(),
      name: 'An',
      game: 'phom',
      phomConfig: config,
    });
    assert.equal(made.status, 200, JSON.stringify(made.value));
    const code = made.value.room.code;
    const old = await post(other, {
      type: 'join',
      clientVersion: 2,
      actionId: crypto.randomUUID(),
      name: 'Bình',
      code,
    });
    assert.equal(old.status, 409);
    assert.equal(old.value.error, 'game-update-required');
    assert.equal(
      (await db.query('select count(*) n from public.lifemate_game_seats'))
        .rows[0].n,
      1,
    );
    const joined = await post(other, {
      type: 'join',
      clientVersion: 3,
      actionId: crypto.randomUUID(),
      name: 'Bình',
      code,
    });
    assert.equal(joined.status, 200, JSON.stringify(joined.value));
    const denied = await post(other, {
      type: 'takeover',
      clientVersion: 2,
      roomId: joined.value.room.id,
    });
    assert.equal(denied.status, 409);
    let current = joined.value.room;
    for (const actor of [uid, other]) {
      const r = await post(actor, {
        type: 'ready',
        clientVersion: 3,
        roomId: current.id,
        actionId: crypto.randomUUID(),
        expectedVersion: current.version,
        matchId: current.matchId,
        ready: true,
      });
      assert.equal(r.status, 200, JSON.stringify(r.value));
      current = r.value.room;
    }
    assert.equal(current.game.rulesVersion, 'phom-v1');
    const input = {
      type: 'play',
      clientVersion: 3,
      roomId: current.id,
      actionId: crypto.randomUUID(),
      expectedVersion: current.version,
      matchId: current.matchId,
      phomAction: 'discard',
      cards: [current.game.hand[0]],
    };
    const firstActor = current.game.turn;
    const hand = await post(firstActor, { type: 'sync', clientVersion: 3 });
    input.cards = [hand.value.room.game.hand[0]];
    const played = await post(firstActor, input);
    assert.equal(played.status, 200, JSON.stringify(played.value));
    const replay = await post(firstActor, input);
    assert.equal(replay.status, 200);
    assert.equal(replay.value.room.version, played.value.room.version);
    const stale = await post(firstActor, {
      ...input,
      actionId: crypto.randomUUID(),
    });
    assert.equal(stale.status, 409);
    const drawn = await post(played.value.room.game.turn, {
      ...input,
      actionId: crypto.randomUUID(),
      expectedVersion: played.value.room.version,
      phomAction: 'draw',
      cards: [],
    });
    assert.equal(drawn.status, 200, JSON.stringify(drawn.value));
    assert.equal(drawn.value.room.game.hand.length, 10);
    const loaded = await rpc(db, 'lifemate_game_read', [
      uid,
      authTime,
      session,
      false,
    ]);
    const finished = updateRoom(
      loaded.room.state,
      other,
      { type: 'leave' },
      Date.now(),
    );
    await db.query(
      'update public.lifemate_game_rooms set state=$1::jsonb where id=$2',
      [JSON.stringify(finished), current.id],
    );
    const board = (
      await rpc(db, 'lifemate_game_score_list', [uid, authTime, session])
    ).tables[0];
    assert.equal(board.match.rounds.length, 1);
    assert.equal(board.match.rounds[0].scores[uid], 17);
    assert.equal(board.match.rounds[0].scores[other], -17);
  } finally {
    await db.close();
  }
});

test('Phỏm RPC rejects malformed rates and direct kind switching; reopening retains settings', async () => {
  const db = await setup();
  try {
    await create(db);
    const config = {
      second: 0,
      third: 2,
      last: 3,
      eat: 1,
      chot: 4,
      mom: 4,
      u: 5,
      uTron: 10,
      den: 5,
      forfeit: 4,
    };
    await assert.rejects(
      db.query(
        'update public.lifemate_game_rooms set state=state||$1::jsonb where id=$2',
        [JSON.stringify({ gameKind: 'phom', phomConfig: config }), room],
      ),
      /invalid-input/,
    );
    for (const invalid of [
      { ...config, u: -1 },
      { ...config, chot: 1.5 },
      { ...config, extra: 0 },
    ])
      await assert.rejects(
        rpc(db, 'lifemate_game_assert_phom_config', [invalid]),
        /invalid-input/,
      );
  } finally {
    await db.close();
  }
  const db2 = await setup();
  try {
    const { post } = readyApi(db2);
    const config = {
      second: 0,
      third: 2,
      last: 3,
      eat: 1,
      chot: 4,
      mom: 4,
      u: 5,
      uTron: 10,
      den: 5,
      forfeit: 4,
    };
    const made = await post(uid, {
      type: 'create',
      game: 'phom',
      phomConfig: config,
      name: 'An',
      clientVersion: 3,
      actionId: crypto.randomUUID(),
    });
    const record = made.value.room;
    await db2.query(
      "update public.lifemate_game_rooms set expires_at=now()-interval '1 second' where id=$1",
      [record.id],
    );
    const request = {
      type: 'reopen',
      roomId: record.id,
      expectedVersion: record.version,
      matchId: null,
      name: 'An',
      actionId: crypto.randomUUID(),
    };
    const old = await post(uid, { ...request, clientVersion: 2 });
    assert.equal(old.value.error, 'game-update-required');
    const opened = await post(uid, { ...request, clientVersion: 3 });
    assert.equal(opened.status, 200, JSON.stringify(opened.value));
    assert.deepEqual(opened.value.room.phomConfig, config);
  } finally {
    await db2.close();
  }
});

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
for (const owner of [null, '']) {
  test(`ownerless ${JSON.stringify(owner)} survives score sync and worker commits`, async () => {
    const db = await setup();
    try {
      await create(db);
      await addScoreMember(db);
      const before = await sharedBoard(db);
      await db.query("update public.lifemate_game_rooms set state=jsonb_set(state,'{ownerUid}',$2::jsonb),next_due=now()-interval '1 second' where id=$1",
        [room, JSON.stringify(owner)]);
      const board = await sharedBoard(db);
      assert.equal(board.canEdit, false);
      assert.ok(board.match.sharedVersion > before.match.sharedVersion);
      await assert.rejects(scoreWrite(db, board, 'delete'), /not-owner/);
      const claimed = await rpc(db, 'lifemate_game_claim_due', [epoch]);
      const record = claimed.rooms.find(r => r.id === room);
      const candidate = advanceExpiredRoom(record, Number(claimed.now));
      assert.equal(candidate.state.ownerUid, owner);
      assert.throws(() => updateRoom(candidate.state, uid, { type: 'kick', targetUid: other }, Date.now()), /not-owner/);
      await rpc(db, 'lifemate_game_commit_worker', [room, epoch, record.version, candidate.state, candidate.removed]);
      assert.equal((await sharedBoard(db)).canEdit, false);
      await assert.rejects(scoreWrite(db, await sharedBoard(db), 'delete'), /not-owner/);
    } finally { await db.close(); }
  });
}
test('ownerless migration repairs stale score ownership, retaining document and legacy fallback', async () => {
  const db = await setup();
  try {
    await create(db);
    await addScoreMember(db);
    await db.query("update public.lifemate_game_rooms set state=state-'ownerUid' where id=$1", [room]);
    assert.equal((await sharedBoard(db)).canEdit, true);
    await db.query("update public.lifemate_game_rooms set state=jsonb_set(state,'{ownerUid}','null'::jsonb) where id=$1", [room]);
    await db.query('update public.lifemate_game_score_tables set owner_uid=$1 where room_id=$2', [uid, room]);
    const stale = await sharedBoard(db);
    // Even a stale table must not authorize writes against an ownerless room.
    await assert.rejects(scoreWrite(db, stale, 'delete'), /not-owner/);
    await db.exec(await readFile(new URL('../../migrations/20261029191148_preserve_explicit_ownerless_rooms.sql', import.meta.url), 'utf8'));
    const fixed = await sharedBoard(db);
    assert.equal(fixed.canEdit, false);
    assert.ok(fixed.match.sharedVersion > stale.match.sharedVersion);
    assert.deepEqual(scoreDocument(fixed.match), scoreDocument(stale.match));
  } finally { await db.close(); }
});
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

test('owner edits only next-round rules atomically; permissions, replay, stale ready, and promotion are enforced', async () => {
  const db = await setup();
  try {
    const api = readyApi(db);
    await create(db);
    let current = (
      await api.post(other, {
        type: 'join',
        clientVersion: 5,
        name: 'Bình',
        code: 'ABCDEFGH',
        actionId: crypto.randomUUID(),
      })
    ).value.room;
    const before = current;
    const edit = {
      type: 'set-south-rules',
      clientVersion: 5,
      roomId: current.id,
      expectedVersion: current.version,
      matchId: current.matchId,
      amountPerCard: 9,
      southConfig: { finishMode: 'first-winner', cutTwoAmount: 17 },
      actionId: crypto.randomUUID(),
    };
    assert.equal((await api.post(other, edit)).status, 403);
    assert.equal(
      (await api.post(uid, { ...edit, sessionId: crypto.randomUUID() })).value
        .error,
      'session-replaced',
    );
    assert.equal(
      (await api.post(uid, { ...edit, clientVersion: 4 })).value.error,
      'game-update-required',
    );
    const saved = await api.post(uid, edit);
    assert.equal(saved.status, 200, JSON.stringify(saved.value));
    current = saved.value.room;
    assert.equal(current.version, before.version + 1);
    assert.equal(current.amountPerCard, before.amountPerCard);
    assert.equal(current.game, null);
    assert.equal(current.matchId, before.matchId);
    assert.deepEqual(current.nextSouthRules, {
      amountPerCard: 9,
      southConfig: edit.southConfig,
    });
    assert.ok(current.members.every((m) => !m.ready));
    assert.equal(
      (await api.post(uid, edit)).value.room.version,
      current.version,
    );
    assert.equal(
      (await api.post(uid, { ...edit, amountPerCard: 10 })).value.error,
      'idempotency-conflict',
    );
    const stale = await api.post(other, {
      type: 'ready',
      clientVersion: 5,
      roomId: current.id,
      expectedVersion: before.version,
      matchId: null,
      ready: true,
      actionId: crypto.randomUUID(),
    });
    assert.equal(stale.value.error, 'version-conflict');
    assert.equal(
      (
        await api.post(other, {
          type: 'ready',
          clientVersion: 4,
          roomId: current.id,
          expectedVersion: current.version,
          matchId: null,
          ready: true,
          actionId: crypto.randomUUID(),
        })
      ).value.error,
      'game-update-required',
    );
    const old = await api.post(other, { type: 'lease', clientVersion: 4 });
    assert.equal(old.status, 200);
    assert.equal(old.value.room.nextSouthRules, undefined);
    assert.equal(
      (
        await api.post(uid, {
          type: 'room-status',
          clientVersion: 5,
          roomId: current.id,
        })
      ).value.minClientVersion,
      5,
    );
    // An old worker/API start that skips pending promotion is rejected by SQL.
    const row = (
      await db.query('select * from public.lifemate_game_rooms where id=$1', [
        current.id,
      ])
    ).rows[0];
    const oldState = structuredClone(row.state);
    delete oldState.nextSouthRules;
    oldState.members.forEach((m) => {
      m.ready = true;
    });
    const skipped = updateRoom(
      oldState,
      uid,
      { type: 'start' },
      Date.now(),
      Array.from({ length: 52 }, (_, i) => i),
    );
    skipped.nextSouthRules = row.state.nextSouthRules;
    await assert.rejects(
      api.sqlRpc('lifemate_game_commit', {
        p_uid: uid,
        p_auth_time: authTime,
        p_session_id: session,
        p_action_id: crypto.randomUUID(),
        p_fingerprint: 'skipped-promotion',
        p_room_id: row.id,
        p_version: row.version,
        p_match_id: row.match_id,
        p_kind: 'start',
        p_state: skipped,
      }),
      /invalid-input/,
    );
    for (const actor of [other, uid]) {
      const response = await api.post(actor, {
        type: 'ready',
        clientVersion: 5,
        roomId: current.id,
        expectedVersion: current.version,
        matchId: current.matchId,
        ready: true,
        actionId: crypto.randomUUID(),
      });
      assert.equal(response.status, 200, JSON.stringify(response.value));
      current = response.value.room;
    }
    assert.equal(current.phase, 'playing');
    assert.equal(current.amountPerCard, 9);
    assert.deepEqual(current.game.southConfig, edit.southConfig);
    const playingRow = (
      await db.query('select * from public.lifemate_game_rooms where id=$1', [
        current.id,
      ])
    ).rows[0];
    const response = await api.post(uid, {
      ...edit,
      actionId: crypto.randomUUID(),
      expectedVersion: current.version,
      matchId: current.matchId,
      amountPerCard: 3,
      southConfig: { finishMode: 'continue', cutTwoAmount: 0 },
    });
    assert.equal(response.status, 200, JSON.stringify(response.value));
    current = response.value.room;
    const editedRow = (
      await db.query('select * from public.lifemate_game_rooms where id=$1', [
        current.id,
      ])
    ).rows[0];
    assert.deepEqual(editedRow.state.game, playingRow.state.game);
    assert.deepEqual(
      editedRow.state.scoreMembers,
      playingRow.state.scoreMembers,
    );
    assert.equal(current.amountPerCard, 9);
    assert.deepEqual(current.southConfig, edit.southConfig);
    assert.equal(
      (await api.post(other, { type: 'sync', clientVersion: 4 })).status,
      200,
    );
    const turn = current.game.turn;
    assert.equal(
      (
        await api.post(turn, {
          type: 'play',
          clientVersion: 4,
          roomId: current.id,
          expectedVersion: current.version,
          matchId: current.matchId,
          cards: [current.game.openingCard],
          actionId: crypto.randomUUID(),
        })
      ).status,
      200,
    );
    await assert.rejects(
      db.query(
        "update public.lifemate_game_rooms set state=jsonb_set(state,'{amountPerCard}','99'::jsonb) where id=$1",
        [current.id],
      ),
      /invalid-input/,
    );
    await assert.rejects(
      db.query(
        "update public.lifemate_game_rooms set state=state-'nextSouthRules' where id=$1",
        [current.id],
      ),
      /invalid-input/,
    );
    // Finish the old round by leaving, then the pending defaults apply at rematch.
    current = (await api.post(uid, { type: 'sync', clientVersion: 5 })).value
      .room;
    const oldMatch = current.matchId;
    const ended = await api.post(other, {
      type: 'leave',
      clientVersion: 4,
      roomId: current.id,
      expectedVersion: current.version,
      matchId: current.matchId,
      actionId: crypto.randomUUID(),
    });
    assert.equal(ended.status, 200, JSON.stringify(ended.value));
    current = (await api.post(uid, { type: 'sync', clientVersion: 5 })).value
      .room;
    assert.equal(current.phase, 'finished');
    assert.equal(current.amountPerCard, 9);
    assert.ok(
      current.game.result.ranking.every(
        (p) => Math.abs(p.moneyDelta) % 9 === 0,
      ),
    );
    current = (
      await api.post(other, {
        type: 'join',
        clientVersion: 5,
        name: 'Bình',
        code: current.code,
        actionId: crypto.randomUUID(),
      })
    ).value.room;
    for (const actor of [other, uid])
      current = (
        await api.post(actor, {
          type: 'ready',
          clientVersion: 5,
          roomId: current.id,
          expectedVersion: current.version,
          matchId: current.matchId,
          ready: true,
          actionId: crypto.randomUUID(),
        })
      ).value.room;
    assert.notEqual(current.matchId, oldMatch);
    assert.equal(current.amountPerCard, 3);
    assert.equal(current.southConfig, undefined);
    assert.equal(current.game.rulesVersion, 'south-v1');
    const leaving = await api.post(other, {
      type: 'leave',
      clientVersion: 5,
      roomId: current.id,
      expectedVersion: current.version,
      matchId: current.matchId,
      actionId: crypto.randomUUID(),
    });
    assert.equal(leaving.status, 200, JSON.stringify(leaving.value));
    current = (await api.post(uid, { type: 'sync', clientVersion: 5 })).value
      .room;
    const deletion = {
      type: 'delete-room',
      clientVersion: 4,
      roomId: current.id,
      expectedVersion: current.version,
      matchId: current.matchId,
      actionId: crypto.randomUUID(),
    };
    assert.equal(
      (await api.post(uid, deletion)).value.error,
      'game-update-required',
    );
    assert.equal(
      (await api.post(uid, { ...deletion, clientVersion: 5 })).status,
      200,
    );
    assert.equal(
      (
        await db.query(
          "select has_function_privilege('authenticated','public.lifemate_game_set_south_rules(text,bigint,uuid,uuid,text,uuid,bigint,uuid,bigint,jsonb)','execute') allowed",
        )
      ).rows[0].allowed,
      false,
    );
  } finally {
    await db.close();
  }
});

test('an already read ready command cannot rebase across the first rules edit', async () => {
  const db = await setup();
  try {
    await create(db);
    let injected = false;
    const api = readyApi(db, async (name, args, run) => {
      if (
        name === 'lifemate_game_commit' &&
        args.p_kind === 'ready' &&
        !injected
      ) {
        injected = true;
        const row = (await db.query('select * from public.lifemate_game_rooms'))
          .rows[0];
        await run('lifemate_game_set_south_rules', {
          p_uid: uid,
          p_auth_time: authTime,
          p_session_id: session,
          p_action_id: crypto.randomUUID(),
          p_fingerprint: 'racing-edit',
          p_room_id: row.id,
          p_version: row.version,
          p_match_id: row.match_id,
          p_amount_per_card: 5,
          p_config: { finishMode: 'continue', cutTwoAmount: 0 },
        });
      }
      return run(name, args);
    });
    const before = (await api.post(uid, { type: 'sync', clientVersion: 5 }))
      .value.room;
    const result = await api.post(uid, {
      type: 'ready',
      clientVersion: 5,
      roomId: before.id,
      expectedVersion: before.version,
      matchId: null,
      ready: true,
      actionId: crypto.randomUUID(),
    });
    assert.equal(result.value.error, 'version-conflict');
    assert.ok(
      (
        await api.post(uid, { type: 'sync', clientVersion: 5 })
      ).value.room.members.every((m) => !m.ready),
    );
  } finally {
    await db.close();
  }
});

test('Phỏm owner edits future rates with CAS, ready reset, pinned current game and next-match promotion', async () => {
  const db = await setup();
  try {
    const api = readyApi(db);
    const config = {
      second: 1,
      third: 2,
      last: 3,
      eat: 1,
      chot: 4,
      mom: 4,
      u: 5,
      uTron: 10,
      den: 5,
      forfeit: 23,
    };
    let current = (
      await api.post(uid, {
        type: 'create',
        clientVersion: 6,
        game: 'phom',
        phomConfig: config,
        name: 'An',
        actionId: crypto.randomUUID(),
      })
    ).value.room;
    current = (
      await api.post(other, {
        type: 'join',
        clientVersion: 6,
        name: 'Bình',
        code: current.code,
        actionId: crypto.randomUUID(),
      })
    ).value.room;
    current = (
      await api.post(other, {
        type: 'ready',
        clientVersion: 6,
        roomId: current.id,
        expectedVersion: current.version,
        matchId: null,
        ready: true,
        actionId: crypto.randomUUID(),
      })
    ).value.room;
    const before = current;
    const next = { ...config, forfeit: 77, u: 123 };
    const input = {
      type: 'set-phom-rules',
      clientVersion: 6,
      roomId: current.id,
      expectedVersion: current.version,
      matchId: null,
      phomConfig: next,
      actionId: crypto.randomUUID(),
    };
    assert.equal((await api.post(other, input)).value.error, 'not-owner');
    assert.equal(
      (await api.post(uid, { ...input, sessionId: crypto.randomUUID() })).value
        .error,
      'session-replaced',
    );
    assert.equal(
      (await api.post(uid, { ...input, clientVersion: 5 })).value.error,
      'game-update-required',
    );
    const response = await api.post(uid, input);
    assert.equal(response.status, 200, JSON.stringify(response.value));
    current = response.value.room;
    assert.deepEqual(current.phomConfig, config);
    assert.deepEqual(current.nextPhomConfig, next);
    assert.equal(current.game, null);
    assert.ok(current.members.every((p) => !p.ready));
    assert.equal(
      (await api.post(uid, input)).value.room.version,
      current.version,
    );
    assert.equal(
      (await api.post(uid, { ...input, phomConfig: { ...next, u: 999 } })).value
        .error,
      'idempotency-conflict',
    );
    assert.equal(
      (
        await api.post(other, {
          type: 'ready',
          clientVersion: 6,
          roomId: current.id,
          expectedVersion: before.version,
          matchId: null,
          ready: true,
          actionId: crypto.randomUUID(),
        })
      ).value.error,
      'version-conflict',
    );
    assert.equal(
      (
        await api.post(other, {
          type: 'ready',
          clientVersion: 5,
          roomId: current.id,
          expectedVersion: current.version,
          matchId: null,
          ready: true,
          actionId: crypto.randomUUID(),
        })
      ).value.error,
      'game-update-required',
    );
    const old = await api.post(other, { type: 'lease', clientVersion: 5 });
    assert.equal(old.status, 200);
    assert.equal(old.value.room.nextPhomConfig, undefined);
    assert.equal(
      (
        await api.post(uid, {
          type: 'room-status',
          clientVersion: 6,
          roomId: current.id,
        })
      ).value.minClientVersion,
      6,
    );
    const oldRow = (
      await db.query('select * from public.lifemate_game_rooms where id=$1', [
        current.id,
      ])
    ).rows[0];
    const oldState = structuredClone(oldRow.state);
    delete oldState.nextPhomConfig;
    oldState.members.forEach((m) => {
      m.ready = true;
    });
    const skipped = updateRoom(
      oldState,
      uid,
      { type: 'start' },
      Date.now(),
      Array.from({ length: 52 }, (_, i) => i),
    );
    skipped.nextPhomConfig = next;
    await assert.rejects(
      api.sqlRpc('lifemate_game_commit', {
        p_uid: uid,
        p_auth_time: authTime,
        p_session_id: session,
        p_action_id: crypto.randomUUID(),
        p_fingerprint: 'old-phom-start',
        p_room_id: current.id,
        p_version: current.version,
        p_match_id: null,
        p_kind: 'start',
        p_state: skipped,
      }),
      /invalid-input/,
    );
    for (const actor of [other, uid])
      current = (
        await api.post(actor, {
          type: 'ready',
          clientVersion: 6,
          roomId: current.id,
          expectedVersion: current.version,
          matchId: current.matchId,
          ready: true,
          actionId: crypto.randomUUID(),
        })
      ).value.room;
    assert.equal(current.phase, 'playing');
    assert.deepEqual(current.phomConfig, next);
    const row = (
      await db.query('select * from public.lifemate_game_rooms where id=$1', [
        current.id,
      ])
    ).rows[0];
    assert.deepEqual(row.state.game.config, next);
    const later = { ...config, forfeit: 9 };
    const edit = await api.post(uid, {
      ...input,
      actionId: crypto.randomUUID(),
      expectedVersion: current.version,
      matchId: current.matchId,
      phomConfig: later,
    });
    assert.equal(edit.status, 200, JSON.stringify(edit.value));
    current = edit.value.room;
    const edited = (
      await db.query('select * from public.lifemate_game_rooms where id=$1', [
        current.id,
      ])
    ).rows[0];
    assert.deepEqual(edited.state.game, row.state.game);
    assert.deepEqual(edited.state.scoreMembers, row.state.scoreMembers);
    assert.equal(
      (
        await api.post(uid, {
          type: 'play',
          clientVersion: 5,
          roomId: current.id,
          expectedVersion: current.version,
          matchId: current.matchId,
          cards: [current.game.hand[0]],
          phomAction: 'discard',
          actionId: crypto.randomUUID(),
        })
      ).status,
      200,
    );
    current = (await api.post(uid, { type: 'sync', clientVersion: 6 })).value
      .room;
    assert.equal(
      (
        await api.post(other, {
          type: 'leave',
          clientVersion: 5,
          roomId: current.id,
          expectedVersion: current.version,
          matchId: current.matchId,
          actionId: crypto.randomUUID(),
        })
      ).status,
      200,
    );
    current = (await api.post(uid, { type: 'sync', clientVersion: 6 })).value
      .room;
    assert.deepEqual(
      current.game.result.ranking.map((p) => p.moneyDelta),
      [77, -77],
    );
    const oldMatch = current.matchId;
    current = (
      await api.post(other, {
        type: 'join',
        clientVersion: 6,
        name: 'Bình',
        code: current.code,
        actionId: crypto.randomUUID(),
      })
    ).value.room;
    for (const actor of [other, uid])
      current = (
        await api.post(actor, {
          type: 'ready',
          clientVersion: 6,
          roomId: current.id,
          expectedVersion: current.version,
          matchId: current.matchId,
          ready: true,
          actionId: crypto.randomUUID(),
        })
      ).value.room;
    assert.notEqual(current.matchId, oldMatch);
    assert.deepEqual(current.phomConfig, later);
    await assert.rejects(
      db.query(
        "update public.lifemate_game_rooms set state=jsonb_set(state,'{phomConfig,u}','999'::jsonb) where id=$1",
        [current.id],
      ),
      /invalid-input/,
    );
    await assert.rejects(
      db.query(
        "update public.lifemate_game_rooms set state=state-'nextPhomConfig' where id=$1",
        [current.id],
      ),
      /invalid-input/,
    );
    assert.equal(
      (
        await db.query(
          "select has_function_privilege('authenticated','public.lifemate_game_set_phom_rules(text,bigint,uuid,uuid,text,uuid,bigint,uuid,jsonb)','execute') allowed",
        )
      ).rows[0].allowed,
      false,
    );
  } finally {
    await db.close();
  }
});

test('Phỏm ready cannot race the first rules edit; takeover checks capability under the room lock', async () => {
  const db = await setup();
  try {
    const config = {
      second: 1,
      third: 2,
      last: 3,
      eat: 1,
      chot: 4,
      mom: 4,
      u: 5,
      uTron: 10,
      den: 5,
      forfeit: 4,
    };
    let injected = false;
    const api = readyApi(db, async (name, args, run) => {
      if (
        name === 'lifemate_game_commit' &&
        args.p_kind === 'ready' &&
        !injected
      ) {
        injected = true;
        const row = (await db.query('select * from public.lifemate_game_rooms'))
          .rows[0];
        await run('lifemate_game_set_phom_rules', {
          p_uid: uid,
          p_auth_time: authTime,
          p_session_id: session,
          p_action_id: crypto.randomUUID(),
          p_fingerprint: 'racing-phom-edit',
          p_room_id: row.id,
          p_version: row.version,
          p_match_id: row.match_id,
          p_config: config,
        });
      }
      return run(name, args);
    });
    let current = (
      await api.post(uid, {
        type: 'create',
        clientVersion: 6,
        game: 'phom',
        phomConfig: config,
        name: 'An',
        actionId: crypto.randomUUID(),
      })
    ).value.room;
    assert.equal(
      (
        await api.post(uid, {
          type: 'ready',
          clientVersion: 6,
          roomId: current.id,
          expectedVersion: current.version,
          matchId: null,
          ready: true,
          actionId: crypto.randomUUID(),
        })
      ).value.error,
      'version-conflict',
    );
    current = (await api.post(uid, { type: 'sync', clientVersion: 6 })).value
      .room;
    assert.ok(current.members.every((m) => !m.ready));
    const takeover = {
      p_uid: uid,
      p_auth_time: authTime,
      p_session_id: crypto.randomUUID(),
      p_room_id: current.id,
    };
    await assert.rejects(
      api.sqlRpc('lifemate_game_takeover', takeover),
      /game-update-required/,
    );
    await assert.rejects(
      api.sqlRpc('lifemate_game_takeover', {
        ...takeover,
        p_client_version: 5,
      }),
      /game-update-required/,
    );
    assert.equal(
      (await api.post(uid, { type: 'sync', clientVersion: 6 })).value.room
        .controller,
      true,
    );
    await api.sqlRpc('lifemate_game_takeover', {
      ...takeover,
      p_client_version: 6,
    });
    assert.equal(
      (await api.post(uid, { type: 'sync', clientVersion: 6 })).value.room
        .controller,
      false,
    );
  } finally {
    await db.close();
  }
});

test('takeover prerequisite keeps old four-argument Phỏm clients working before the final migration', async () => {
  const db = await setup(true);
  try {
    const api = readyApi(db);
    const config = {
      second: 1,
      third: 2,
      last: 3,
      eat: 1,
      chot: 4,
      mom: 4,
      u: 5,
      uTron: 10,
      den: 5,
      forfeit: 4,
    };
    const created = await api.post(uid, {
      type: 'create',
      clientVersion: 6,
      game: 'phom',
      phomConfig: config,
      name: 'An',
      actionId: crypto.randomUUID(),
    });
    assert.equal(created.status, 200, JSON.stringify(created.value));
    const id = created.value.room.id;
    await api.sqlRpc('lifemate_game_takeover', {
      p_uid: uid,
      p_auth_time: authTime,
      p_session_id: session,
      p_room_id: id,
    });
    const take = await api.post(uid, {
      type: 'takeover',
      clientVersion: 6,
      roomId: id,
    });
    assert.equal(take.status, 200, JSON.stringify(take.value));
    assert.equal(take.value.room.controller, true);
  } finally {
    await db.close();
  }
});

test('optional Phỏm rules validate, persist, project for v7 and fence v6 without changing legacy match', async () => {
  const db = await setup();
  try {
    const api = readyApi(db);
    const config = {
      second: 1,
      third: 2,
      last: 3,
      eat: 1,
      chot: 4,
      mom: 4,
      u: 5,
      uTron: 10,
      den: 5,
      forfeit: 4,
    };
    const next = {
      ...config,
      options: { tai: true, send: false, uDen: false },
    };
    for (const options of [
      null,
      {},
      { tai: true, send: true, uDen: 1 },
      { tai: true, send: true, uDen: true, extra: true },
    ])
      await assert.rejects(
        db.query('select public.lifemate_game_assert_phom_config($1::jsonb)', [
          JSON.stringify({ ...config, options }),
        ]),
        /invalid-input/,
      );
    assert.equal(
      (
        await api.post(uid, {
          type: 'create',
          clientVersion: 6,
          game: 'phom',
          name: 'An',
          phomConfig: next,
          actionId: crypto.randomUUID(),
        })
      ).value.error,
      'game-update-required',
    );
    let current = (
      await api.post(uid, {
        type: 'create',
        clientVersion: 7,
        game: 'phom',
        name: 'An',
        phomConfig: config,
        actionId: crypto.randomUUID(),
      })
    ).value.room;
    current = (
      await api.post(other, {
        type: 'join',
        clientVersion: 7,
        name: 'Bình',
        code: current.code,
        actionId: crypto.randomUUID(),
      })
    ).value.room;
    current = (
      await api.post(other, {
        type: 'ready',
        clientVersion: 7,
        roomId: current.id,
        expectedVersion: current.version,
        matchId: null,
        ready: true,
        actionId: crypto.randomUUID(),
      })
    ).value.room;
    current = (
      await api.post(uid, {
        type: 'start',
        clientVersion: 7,
        roomId: current.id,
        expectedVersion: current.version,
        matchId: null,
        actionId: crypto.randomUUID(),
      })
    ).value.room;
    assert.equal(current.phase, 'playing');
    const gameBefore = (
      await db.query('select state from public.lifemate_game_rooms')
    ).rows[0].state.game;
    const input = {
      type: 'set-phom-rules',
      clientVersion: 7,
      roomId: current.id,
      expectedVersion: current.version,
      matchId: current.matchId,
      phomConfig: next,
      actionId: crypto.randomUUID(),
    };
    assert.equal((await api.post(other, input)).value.error, 'not-owner');
    const saved = await api.post(uid, input);
    assert.equal(saved.status, 200, JSON.stringify(saved.value));
    current = saved.value.room;
    assert.deepEqual(current.phomConfig, config);
    assert.deepEqual(current.nextPhomConfig, next);
    assert.deepEqual(
      (await db.query('select state from public.lifemate_game_rooms')).rows[0]
        .state.game,
      gameBefore,
    );
    assert.equal(
      (await api.post(uid, input)).value.room.version,
      current.version,
    );
    assert.equal(
      (await api.post(uid, { ...input, actionId: crypto.randomUUID() })).value
        .error,
      'version-conflict',
    );
    for (const type of ['sync', 'lease']) {
      const legacy = await api.post(uid, { type, clientVersion: 6 });
      assert.equal(legacy.status, 200, JSON.stringify(legacy.value));
      assert.equal('nextPhomConfig' in legacy.value.room, false);
      assert.deepEqual(legacy.value.room.phomConfig, config);
    }
    const legacy = await api.post(uid, {
      type: 'play',
      clientVersion: 6,
      roomId: current.id,
      expectedVersion: current.version,
      matchId: current.matchId,
      phomAction: 'discard',
      cards: [current.game.hand[0]],
      actionId: crypto.randomUUID(),
    });
    assert.equal(legacy.status, 200, JSON.stringify(legacy.value));
    assert.equal('nextPhomConfig' in legacy.value.room, false);
    assert.equal(
      (
        await api.post(other, {
          type: 'ready',
          clientVersion: 6,
          roomId: current.id,
          expectedVersion: legacy.value.room.version,
          matchId: current.matchId,
          ready: true,
          actionId: crypto.randomUUID(),
        })
      ).value.error,
      'game-update-required',
    );
    const status = await api.post(uid, {
      type: 'room-status',
      clientVersion: 7,
      roomId: current.id,
    });
    assert.equal(status.value.minClientVersion, 7);
    const takeover = {
      p_uid: uid,
      p_auth_time: authTime,
      p_session_id: crypto.randomUUID(),
      p_room_id: current.id,
    };
    await assert.rejects(
      api.sqlRpc('lifemate_game_takeover', {
        ...takeover,
        p_client_version: 6,
      }),
      /game-update-required/,
    );
    assert.equal(
      (await api.post(uid, { type: 'sync', clientVersion: 7 })).value.room
        .controller,
      true,
    );
    for (const role of ['anon', 'authenticated'])
      assert.equal(
        (
          await db.query(
            "select has_function_privilege($1,'public.lifemate_game_assert_phom_config(jsonb)','execute') ok",
            [role],
          )
        ).rows[0].ok,
        false,
      );
  } finally {
    await db.close();
  }
});

for (const location of ['current', 'pending']) {
  test(`Phỏm rules capability guard preserves ${location} options before any write`, async () => {
    const db = await setup();
    try {
      const sentVersions = [];
      const api = readyApi(db, (name, args, run) => {
        if (name === 'lifemate_game_set_phom_rules')
          sentVersions.push(args.p_client_version);
        return run(name, args);
      });
      const config = {
        second: 1,
        third: 2,
        last: 3,
        eat: 1,
        chot: 4,
        mom: 4,
        u: 5,
        uTron: 10,
        den: 5,
        forfeit: 4,
      };
      const optional = {
        ...config,
        options: { tai: true, send: false, uDen: false },
      };
      let current = (
        await api.post(uid, {
          type: 'create',
          clientVersion: 7,
          game: 'phom',
          name: 'An',
          phomConfig: location === 'current' ? optional : config,
          actionId: crypto.randomUUID(),
        })
      ).value.room;
      if (location === 'pending') {
        await assert.rejects(
          api.sqlRpc('lifemate_game_set_phom_rules', {
            p_uid: uid,
            p_auth_time: authTime,
            p_session_id: session,
            p_action_id: crypto.randomUUID(),
            p_fingerprint: 'incoming-options',
            p_room_id: current.id,
            p_version: current.version,
            p_match_id: null,
            p_config: optional,
            p_client_version: 6,
          }),
          /game-update-required/,
        );
        current = (
          await api.post(uid, {
            type: 'set-phom-rules',
            clientVersion: 7,
            roomId: current.id,
            expectedVersion: current.version,
            matchId: null,
            phomConfig: optional,
            actionId: crypto.randomUUID(),
          })
        ).value.room;
      }
      // Include readiness and lease/receipt/broadcast side effects in the denial assertion.
      current = (
        await api.post(uid, {
          type: 'ready',
          clientVersion: 7,
          roomId: current.id,
          expectedVersion: current.version,
          matchId: null,
          ready: true,
          actionId: crypto.randomUUID(),
        })
      ).value.room;
      assert.equal(current.members[0].ready, true);
      const readEffects = async () =>
        (
          await db.query(`select jsonb_build_object(
        'rooms',(select jsonb_agg(to_jsonb(r)) from public.lifemate_game_rooms r),
        'seats',(select jsonb_agg(to_jsonb(s)) from public.lifemate_game_seats s),
        'receipts',(select jsonb_agg(to_jsonb(r) order by action_id) from public.lifemate_game_receipts r),
        'hints',(select jsonb_agg(to_jsonb(h)) from public.test_game_hints h)
      ) as value`)
        ).rows[0].value;
      const before = await readEffects();
      const input = {
        type: 'set-phom-rules',
        clientVersion: 6,
        roomId: current.id,
        expectedVersion: current.version,
        matchId: null,
        phomConfig: { ...config, u: 999 },
        actionId: crypto.randomUUID(),
      };
      const denied = await api.post(uid, input);
      assert.equal(denied.status, 409);
      assert.equal(denied.value.error, 'game-update-required');
      assert.deepEqual(await readEffects(), before);
      const args = {
        p_uid: uid,
        p_auth_time: authTime,
        p_session_id: session,
        p_action_id: crypto.randomUUID(),
        p_fingerprint: 'old-edge-edit',
        p_room_id: current.id,
        p_version: current.version,
        p_match_id: null,
        p_config: config,
      };
      await assert.rejects(
        api.sqlRpc('lifemate_game_set_phom_rules', {
          ...args,
          p_config: optional,
          p_client_version: 6,
        }),
        /game-update-required/,
      );
      assert.deepEqual(await readEffects(), before);
      // The old Edge signature cannot bypass the locked capability guard.
      await assert.rejects(
        api.sqlRpc('lifemate_game_set_phom_rules', args),
        /game-update-required/,
      );
      assert.deepEqual(await readEffects(), before);
      for (const version of [null, 0, 5, 8]) {
        await assert.rejects(
          api.sqlRpc('lifemate_game_set_phom_rules', {
            ...args,
            p_client_version: version,
          }),
          /invalid-input/,
        );
      }
      assert.deepEqual(await readEffects(), before);
      // Old Edge v14 accepts explicit options only from v7: keep rollout compatible.
      const saved = await api.sqlRpc('lifemate_game_set_phom_rules', {
        ...args,
        p_config: { ...optional, u: 11 },
      });
      assert.deepEqual(saved.record.state.nextPhomConfig, {
        ...optional,
        u: 11,
      });
      assert.equal(saved.record.state.members[0].ready, false);
      const retry = await api.sqlRpc('lifemate_game_set_phom_rules', {
        ...args,
        p_config: { ...optional, u: 11 },
        p_client_version: 7,
      });
      assert.deepEqual(retry, saved.ack);
      const updated = await api.post(uid, {
        ...input,
        clientVersion: 7,
        expectedVersion: saved.record.version,
        actionId: crypto.randomUUID(),
        phomConfig: { ...optional, u: 12 },
      });
      assert.equal(updated.status, 200, JSON.stringify(updated.value));
      assert.equal(sentVersions.at(-1), 7);
      assert.deepEqual(updated.value.room.nextPhomConfig, {
        ...optional,
        u: 12,
      });
      assert.deepEqual(updated.value.room.phomConfig, current.phomConfig);
      for (const signature of [
        'text,bigint,uuid,uuid,text,uuid,bigint,uuid,jsonb',
        'text,bigint,uuid,uuid,text,uuid,bigint,uuid,jsonb,integer',
      ]) {
        for (const role of ['anon', 'authenticated', 'service_role']) {
          const privilege = (
            await db.query(
              "select has_function_privilege($1,$2,'execute') ok",
              [role, `public.lifemate_game_set_phom_rules(${signature})`],
            )
          ).rows[0].ok;
          assert.equal(privilege, role === 'service_role');
        }
      }
    } finally {
      await db.close();
    }
  });
}

test('protocol7 creates optional Phỏm rules and pins every choice into the first match', async () => {
  const db = await setup();
  try {
    const api = readyApi(db);
    const config = {
      second: 1,
      third: 2,
      last: 3,
      eat: 1,
      chot: 4,
      mom: 4,
      u: 5,
      uTron: 10,
      den: 5,
      forfeit: 4,
      options: { tai: true, send: false, uDen: false },
    };
    const created = await api.post(uid, {
      type: 'create',
      clientVersion: 7,
      game: 'phom',
      name: 'An',
      phomConfig: config,
      actionId: crypto.randomUUID(),
    });
    assert.equal(created.status, 200, JSON.stringify(created.value));
    let current = created.value.room;
    assert.deepEqual(current.phomConfig, config);
    assert.equal(
      (
        await api.post(other, {
          type: 'join',
          clientVersion: 6,
          name: 'Bình',
          code: current.code,
          actionId: crypto.randomUUID(),
        })
      ).value.error,
      'game-update-required',
    );
    assert.equal(
      (await db.query('select count(*)::int n from public.lifemate_game_seats'))
        .rows[0].n,
      1,
    );
    current = (
      await api.post(other, {
        type: 'join',
        clientVersion: 7,
        name: 'Bình',
        code: current.code,
        actionId: crypto.randomUUID(),
      })
    ).value.room;
    current = (
      await api.post(other, {
        type: 'ready',
        clientVersion: 7,
        roomId: current.id,
        expectedVersion: current.version,
        matchId: null,
        ready: true,
        actionId: crypto.randomUUID(),
      })
    ).value.room;
    const started = await api.post(uid, {
      type: 'start',
      clientVersion: 7,
      roomId: current.id,
      expectedVersion: current.version,
      matchId: null,
      actionId: crypto.randomUUID(),
    });
    assert.equal(started.status, 200, JSON.stringify(started.value));
    assert.equal(started.value.room.phase, 'playing');
    assert.deepEqual(started.value.room.phomConfig, config);
    assert.deepEqual(
      (await db.query('select state from public.lifemate_game_rooms')).rows[0]
        .state.game.config,
      config,
    );
  } finally {
    await db.close();
  }
});

test('new online game variants pin kind, require protocol 9 and commit game actions authoritatively', async () => {
  for (const [game, rulesVersion, title] of [
    ['north', 'north-v1', 'Tiến lên miền Bắc'],
    ['sam', 'sam-v1', 'Sâm'],
    ['tan', 'tan-v1', 'Tấn'],
  ]) {
    const db = await setup();
    const gameRoom = crypto.randomUUID();
    const createAction = crypto.randomUUID();
    const createArgs = [
      uid,
      authTime,
      session,
      createAction,
      `variant-${game}`,
      gameRoom,
      'BCDEFGHJ',
      'An',
      game,
    ];
    try {
      await assert.rejects(
        rpc(db, 'lifemate_game_create_variant', [
          ...createArgs.slice(0, -1),
          null,
        ]),
        /invalid-input/,
      );
      const created = await rpc(db, 'lifemate_game_create_variant', createArgs);
      assert.equal(created.roomId, gameRoom);
      assert.deepEqual(
        await rpc(db, 'lifemate_game_create_variant', createArgs),
        created,
      );
      await assert.rejects(
        rpc(db, 'lifemate_game_create_variant', [
          ...createArgs.slice(0, -1),
          game === 'tan' ? 'sam' : 'tan',
        ]),
        /idempotency-conflict/,
      );

      const record = (
        await db.query('select * from public.lifemate_game_rooms where id=$1', [
          gameRoom,
        ])
      ).rows[0];
      assert.equal(record.state.gameKind, game);
      assert.equal(record.state.game, null);
      const score = (
        await db.query(
          'select document from public.lifemate_game_score_tables where room_id=$1',
          [gameRoom],
        )
      ).rows[0].document;
      assert.equal(score.title, `${title} · BCDEFGHJ`);

      const status = await rpc(db, 'lifemate_game_status', [
        uid,
        authTime,
        session,
        gameRoom,
      ]);
      assert.equal(status.gameKind, game);
      assert.equal(status.minClientVersion, 9);

      const beforeSeat = await db.query(
        'select session_id from public.lifemate_game_seats where room_id=$1 and uid=$2',
        [gameRoom, uid],
      );
      const beforeVersion = record.version;
      await assert.rejects(
        rpc(db, 'lifemate_game_takeover', [
          uid,
          authTime,
          crypto.randomUUID(),
          gameRoom,
          8,
        ]),
        /game-update-required/,
      );
      assert.deepEqual(
        (
          await db.query(
            'select session_id from public.lifemate_game_seats where room_id=$1 and uid=$2',
            [gameRoom, uid],
          )
        ).rows,
        beforeSeat.rows,
      );
      assert.equal(
        (
          await db.query(
            'select version from public.lifemate_game_rooms where id=$1',
            [gameRoom],
          )
        ).rows[0].version,
        beforeVersion,
      );
      await rpc(db, 'lifemate_game_takeover', [
        uid,
        authTime,
        crypto.randomUUID(),
        gameRoom,
        9,
      ]);

      await assert.rejects(
        db.query(
          "update public.lifemate_game_rooms set state=state||jsonb_build_object('gameKind','south') where id=$1",
          [gameRoom],
        ),
        /invalid-input/,
      );
      await assert.rejects(
        db.query(
          "update public.lifemate_game_rooms set state=jsonb_set(state,'{game}', '{\"rulesVersion\":\"wrong\"}'::jsonb) where id=$1",
          [gameRoom],
        ),
        /invalid-input/,
      );

      const startedState = {
        ...record.state,
        phase: 'playing',
        game: { rulesVersion, status: 'playing', deadline: Date.now() + 40_000 },
      };
      const started = await rpc(db, 'lifemate_game_commit', [
        uid,
        authTime,
        (await db.query(
          'select session_id from public.lifemate_game_seats where uid=$1 and room_id=$2',
          [uid, gameRoom],
        )).rows[0].session_id,
        crypto.randomUUID(),
        'start-variant',
        gameRoom,
        beforeVersion + 1,
        null,
        'start',
        startedState,
      ]);
      assert.equal(started.record.state.game.rulesVersion, rulesVersion);
      const activeSeat = (
        await db.query(
          'select session_id from public.lifemate_game_seats where uid=$1 and room_id=$2',
          [uid, gameRoom],
        )
      ).rows[0].session_id;
      const activeRoom = (
        await db.query('select version,match_id,state,expires_at from public.lifemate_game_rooms where id=$1', [gameRoom])
      ).rows[0];
      const nextState = {
        ...activeRoom.state,
        game: { ...activeRoom.state.game, actionCount: 1 },
      };
      const gameActionId = crypto.randomUUID();
      const actionArgs = [
        uid,
        authTime,
        activeSeat,
        gameActionId,
        'variant-game-action',
        gameRoom,
        activeRoom.version,
        activeRoom.match_id,
        game === 'north' ? 'play' : 'game-action',
        nextState,
      ];
      const committed = await rpc(db, 'lifemate_game_commit', actionArgs);
      assert.equal(committed.record.version, activeRoom.version + 1);
      assert.equal(committed.record.state.game.actionCount, 1);
      assert.equal(committed.controller, true);
      const afterAction = (
        await db.query(
          'select version,expires_at,state from public.lifemate_game_rooms where id=$1',
          [gameRoom],
        )
      ).rows[0];
      assert.ok(afterAction.expires_at > activeRoom.expires_at);
      await db.query(
        "update public.lifemate_game_rooms set state=jsonb_set(state,'{game,deadline}','0'::jsonb) where id=$1",
        [gameRoom],
      );
      const expiredActionState = {
        ...afterAction.state,
        game: { ...afterAction.state.game, deadline: 0 },
      };
      await assert.rejects(
        rpc(db, 'lifemate_game_commit', [
          uid,
          authTime,
          activeSeat,
          crypto.randomUUID(),
          'expired-game-action',
          gameRoom,
          afterAction.version,
          activeRoom.match_id,
          game === 'north' ? 'play' : 'game-action',
          expiredActionState,
        ]),
        /turn-expired/,
      );
      assert.equal(
        (
          await db.query('select version from public.lifemate_game_rooms where id=$1', [gameRoom])
        ).rows[0].version,
        afterAction.version,
      );
      assert.deepEqual(
        await rpc(db, 'lifemate_game_commit', actionArgs),
        committed.ack,
      );
      assert.equal(
        (
          await db.query(
            "select has_function_privilege('anon','public.lifemate_game_create_variant(text,bigint,uuid,uuid,text,uuid,text,text,text)','execute') ok",
          )
        ).rows[0].ok,
        false,
      );
      assert.equal(
        (
          await db.query(
            "select has_function_privilege('service_role','public.lifemate_game_commit(text,bigint,uuid,uuid,text,uuid,bigint,uuid,text,jsonb)','execute') ok",
          )
        ).rows[0].ok,
        true,
      );
    } finally {
      await db.close();
    }
  }
});

test('configured variant create and next-round settings are exposed only to protocol 10', async () => {
  const db = await setup();
  let configuredCreateArgs;
  const api = readyApi(db, async (name, args, run) => {
    if (name === 'lifemate_game_create_variant_configured')
      configuredCreateArgs = args;
    return run(name, args);
  });
  try {
    const created = await api.post(uid, {
      type: 'create',
      clientVersion: 10,
      actionId: crypto.randomUUID(),
      game: 'sam',
      variantConfig: { pointsPerCard: 4 },
      name: 'An',
    });
    assert.equal(created.status, 200, JSON.stringify(created.value));
    assert.deepEqual(created.value.room.variantConfig, { pointsPerCard: 4 });

    const oldClient = await api.post(uid, {
      type: 'sync',
      clientVersion: 9,
    });
    assert.equal(oldClient.status, 409);
    assert.equal(oldClient.value.error, 'game-update-required');

    const joined = await api.post(other, {
      type: 'join',
      clientVersion: 10,
      actionId: crypto.randomUUID(),
      code: created.value.room.code,
      name: 'Bình',
    });
    assert.equal(joined.status, 200, JSON.stringify(joined.value));
    assert.deepEqual(joined.value.room.variantConfig, { pointsPerCard: 4 });

    const saved = await api.post(uid, {
      type: 'set-variant-rules',
      clientVersion: 10,
      actionId: crypto.randomUUID(),
      roomId: created.value.room.id,
      expectedVersion: joined.value.room.version,
      matchId: joined.value.room.matchId,
      variantConfig: { pointsPerCard: 6 },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.value));
    assert.deepEqual(saved.value.room.variantConfig, { pointsPerCard: 4 });
    assert.deepEqual(saved.value.room.nextVariantConfig, { pointsPerCard: 6 });

    await assert.rejects(
      db.query(
        "update public.lifemate_game_rooms set state=state||jsonb_build_object('phase','playing'),match_id=$2 where id=$1",
        [saved.value.room.id, crypto.randomUUID()],
      ),
      /invalid-input/,
    );

    const nonOwner = await api.post(other, {
      type: 'set-variant-rules',
      clientVersion: 10,
      actionId: crypto.randomUUID(),
      roomId: saved.value.room.id,
      expectedVersion: saved.value.room.version,
      matchId: saved.value.room.matchId,
      variantConfig: { pointsPerCard: 2 },
    });
    assert.equal(nonOwner.status, 403);
    assert.equal(nonOwner.value.error, 'not-owner');

    await db.query(
      "update public.lifemate_game_rooms set state=state||jsonb_build_object('ownerUid','','host',$2::text,'scoreMembers',jsonb_build_array(jsonb_build_object('uid',$2::text,'name','Bình','balance',0))) where id=$1",
      [saved.value.room.id, other],
    );
    const replacementOwnerAttempt = await api.post(other, {
      type: 'set-variant-rules',
      clientVersion: 10,
      actionId: crypto.randomUUID(),
      roomId: saved.value.room.id,
      expectedVersion: saved.value.room.version,
      matchId: saved.value.room.matchId,
      variantConfig: { pointsPerCard: 2 },
    });
    assert.equal(replacementOwnerAttempt.status, 403);
    assert.equal(replacementOwnerAttempt.value.error, 'not-owner');
    const orphanedOwnerStatus = await api.post(other, {
      type: 'room-status',
      clientVersion: 10,
      roomId: saved.value.room.id,
    });
    assert.equal(orphanedOwnerStatus.status, 200);
    assert.equal(orphanedOwnerStatus.value.owner, false);
    assert.equal(orphanedOwnerStatus.value.canReopen, false);
    const outsiderStatus = await api.post('unknown-player', {
      type: 'room-status',
      clientVersion: 10,
      roomId: saved.value.room.id,
    });
    assert.equal(outsiderStatus.status, 200);
    assert.equal(outsiderStatus.value.exists, false);

    const otherReady = await api.post(other, {
      type: 'ready',
      clientVersion: 10,
      actionId: crypto.randomUUID(),
      roomId: saved.value.room.id,
      expectedVersion: saved.value.room.version,
      matchId: saved.value.room.matchId,
      ready: true,
    });
    assert.equal(otherReady.status, 200, JSON.stringify(otherReady.value));
    const ownerReady = await api.post(uid, {
      type: 'ready',
      clientVersion: 10,
      actionId: crypto.randomUUID(),
      roomId: saved.value.room.id,
      expectedVersion: otherReady.value.room.version,
      matchId: otherReady.value.room.matchId,
      ready: true,
    });
    assert.equal(ownerReady.status, 200, JSON.stringify(ownerReady.value));
    assert.deepEqual(ownerReady.value.room.variantConfig, { pointsPerCard: 6 });

    const createReplay = await rpc(db, 'lifemate_game_create_variant_configured', [
      configuredCreateArgs.p_uid,
      configuredCreateArgs.p_auth_time,
      configuredCreateArgs.p_session_id,
      configuredCreateArgs.p_action_id,
      configuredCreateArgs.p_fingerprint,
      configuredCreateArgs.p_room_id,
      configuredCreateArgs.p_code,
      configuredCreateArgs.p_name,
      configuredCreateArgs.p_game,
      configuredCreateArgs.p_config,
    ]);
    assert.equal(createReplay.roomId, created.value.room.id);
    const afterReplay = await api.post(uid, {
      type: 'sync',
      clientVersion: 10,
    });
    assert.equal(afterReplay.status, 200, JSON.stringify(afterReplay.value));
    assert.deepEqual(afterReplay.value.room.variantConfig, { pointsPerCard: 6 });
    assert.equal(afterReplay.value.room.version, ownerReady.value.room.version);
  } finally {
    await db.close();
  }
});

test('variant room config is owner-written, versioned, and requires protocol 10', async () => {
  const db = await setup();
  const gameRoom = crypto.randomUUID();
  const createAction = crypto.randomUUID();
  const createArgs = [
    uid,
    authTime,
    session,
    createAction,
    'variant-config-create',
    gameRoom,
    'BCDEFGHJ',
    'An',
    'north',
    { pointsPerCard: 4 },
  ];
  try {
    await assert.rejects(
      rpc(db, 'lifemate_game_create_variant_configured', [
        ...createArgs.slice(0, -1),
        { pointsPerCard: 0 },
      ]),
      /invalid-input/,
    );
    const created = await rpc(
      db,
      'lifemate_game_create_variant_configured',
      createArgs,
    );
    assert.equal(created.roomId, gameRoom);
    let record = await rpc(db, 'lifemate_game_read', [uid, authTime, session, false]);
    assert.deepEqual(record.room.state.variantConfig, { pointsPerCard: 4 });
    const status = await rpc(db, 'lifemate_game_status', [uid, authTime, session, gameRoom]);
    assert.equal(status.minClientVersion, 10);
    const version = record.room.version;
    const matchId = record.room.match_id;
    const setArgs = [
      uid,
      authTime,
      session,
      crypto.randomUUID(),
      'variant-config-next',
      gameRoom,
      version,
      matchId,
      { pointsPerCard: 7 },
      10,
    ];
    await assert.rejects(
      rpc(db, 'lifemate_game_set_variant_rules', [
        ...setArgs.slice(0, -1),
        9,
      ]),
      /game-update-required/,
    );
    const saved = await rpc(db, 'lifemate_game_set_variant_rules', setArgs);
    assert.equal(saved.record.version, version + 1);
    record = await rpc(db, 'lifemate_game_read', [uid, authTime, session, false]);
    assert.deepEqual(record.room.state.variantConfig, { pointsPerCard: 4 });
    assert.deepEqual(record.room.state.nextVariantConfig, { pointsPerCard: 7 });
    await assert.rejects(
      rpc(db, 'lifemate_game_set_variant_rules', [
        other,
        authTime,
        session,
        crypto.randomUUID(),
        'variant-config-other-user',
        gameRoom,
        record.room.version,
        record.room.match_id,
        { pointsPerCard: 2 },
        10,
      ]),
      /not-member/,
    );
    assert.equal(
      (
        await db.query(
          "select has_function_privilege('anon','public.lifemate_game_set_variant_rules(text,bigint,uuid,uuid,text,uuid,bigint,uuid,jsonb,integer)','execute') ok",
        )
      ).rows[0].ok,
      false,
    );
  } finally {
    await db.close();
  }
});

test('North v2 config is persisted exactly and every read or takeover requires capability 11', async () => {
  const db = await setup();
  const api = readyApi(db);
  const northV2 = {
    rulesVersion: 'north-v2',
    pointsPerCard: 1,
    remainingTwoPoints: 2,
    cutTwoPoints: 3,
  };
  try {
    for (const incomplete of [
      { rulesVersion: 'north-v2', pointsPerCard: 1 },
      {
        rulesVersion: 'north-v2',
        pointsPerCard: 1,
        remainingTwoPoints: 2,
      },
      { rulesVersion: 'sam-v2', pointsPerCard: 1 },
    ]) {
      await assert.rejects(
        db.query(
          'select public.lifemate_game_assert_variant_config($1::jsonb)',
          [incomplete],
        ),
        /invalid-input/,
      );
    }
    const created = await api.post(uid, {
      type: 'create',
      clientVersion: 11,
      actionId: crypto.randomUUID(),
      game: 'north',
      variantConfig: northV2,
      name: 'An',
    });
    assert.equal(created.status, 200, JSON.stringify(created.value));
    assert.deepEqual(created.value.room.variantConfig, northV2);
    const { rows } = await db.query(
      'select state from public.lifemate_game_rooms where id=$1',
      [created.value.room.id],
    );
    assert.deepEqual(rows[0].state.variantConfig, northV2);
    const status = await rpc(db, 'lifemate_game_status', [
      uid,
      authTime,
      session,
      created.value.room.id,
    ]);
    assert.equal(status.minClientVersion, 11);

    const olderClient = await api.post(uid, {
      type: 'sync',
      clientVersion: 10,
    });
    assert.equal(olderClient.status, 409);
    assert.equal(olderClient.value.error, 'game-update-required');
    await assert.rejects(
      rpc(db, 'lifemate_game_takeover', [
        uid,
        authTime,
        crypto.randomUUID(),
        created.value.room.id,
        10,
      ]),
      /game-update-required/,
    );
    await rpc(db, 'lifemate_game_takeover', [
      uid,
      authTime,
      session,
      created.value.room.id,
      11,
    ]);

    const legacyVersionAttempt = await api.post(uid, {
      type: 'set-variant-rules',
      clientVersion: 10,
      actionId: crypto.randomUUID(),
      roomId: created.value.room.id,
      expectedVersion: created.value.room.version + 1,
      matchId: null,
      variantConfig: northV2,
    });
    assert.equal(legacyVersionAttempt.status, 409);
    assert.equal(legacyVersionAttempt.value.error, 'game-update-required');
    const mismatchedGame = await api.post(uid, {
      type: 'create',
      clientVersion: 11,
      actionId: crypto.randomUUID(),
      game: 'sam',
      variantConfig: northV2,
      name: 'An',
    });
    assert.equal(mismatchedGame.status, 400);
    assert.equal(mismatchedGame.value.error, 'invalid-input');

    const samV2 = {
      rulesVersion: 'sam-v2',
      pointsPerCard: 2,
      samCallPoints: 25,
    };
    const samCreated = await api.post('game-c', {
      type: 'create',
      clientVersion: 11,
      actionId: crypto.randomUUID(),
      game: 'sam',
      variantConfig: samV2,
      name: 'Bình',
    });
    assert.equal(samCreated.status, 200, JSON.stringify(samCreated.value));
    assert.deepEqual(samCreated.value.room.variantConfig, samV2);
    assert.equal(
      (
        await rpc(db, 'lifemate_game_status', [
        'game-c',
          authTime,
          session,
          samCreated.value.room.id,
        ])
      ).minClientVersion,
      11,
    );

    const joinedNorth = await api.post(other, {
      type: 'join',
      clientVersion: 11,
      actionId: crypto.randomUUID(),
      code: created.value.room.code,
      name: 'Bình',
    });
    assert.equal(joinedNorth.status, 200, JSON.stringify(joinedNorth.value));
    const northHostReady = await api.post(uid, {
      type: 'ready',
      clientVersion: 11,
      actionId: crypto.randomUUID(),
      roomId: created.value.room.id,
      expectedVersion: joinedNorth.value.room.version,
      matchId: null,
      ready: true,
    });
    assert.equal(northHostReady.status, 200, JSON.stringify(northHostReady.value));
    const northFinalReady = await api.post(other, {
      type: 'ready',
      clientVersion: 11,
      actionId: crypto.randomUUID(),
      roomId: created.value.room.id,
      expectedVersion: northHostReady.value.room.version,
      matchId: null,
      ready: true,
    });
    assert.equal(northFinalReady.status, 200, JSON.stringify(northFinalReady.value));
    assert.equal(northFinalReady.value.room.game.rulesVersion, 'north-v2');

    const savedLegacyNext = await api.post(uid, {
      type: 'set-variant-rules',
      clientVersion: 11,
      actionId: crypto.randomUUID(),
      roomId: created.value.room.id,
      expectedVersion: northFinalReady.value.room.version,
      matchId: northFinalReady.value.room.matchId,
      variantConfig: { pointsPerCard: 2 },
    });
    assert.equal(savedLegacyNext.status, 200, JSON.stringify(savedLegacyNext.value));
    assert.equal(
      (await rpc(db, 'lifemate_game_status', [
        uid,
        authTime,
        session,
        created.value.room.id,
      ])).minClientVersion,
      11,
    );
    await assert.rejects(
      rpc(db, 'lifemate_game_takeover', [
        uid,
        authTime,
        crypto.randomUUID(),
        created.value.room.id,
        10,
      ]),
      /game-update-required/,
    );
    const legacyWriteFromOldClient = await api.post(uid, {
      type: 'set-variant-rules',
      clientVersion: 10,
      actionId: crypto.randomUUID(),
      roomId: created.value.room.id,
      expectedVersion: savedLegacyNext.value.room.version,
      matchId: savedLegacyNext.value.room.matchId,
      variantConfig: { pointsPerCard: 3 },
    });
    assert.equal(legacyWriteFromOldClient.status, 409);
    assert.equal(legacyWriteFromOldClient.value.error, 'game-update-required');

    const joinedSam = await api.post('game-d', {
      type: 'join',
      clientVersion: 11,
      actionId: crypto.randomUUID(),
      code: samCreated.value.room.code,
      name: 'An',
    });
    assert.equal(joinedSam.status, 200, JSON.stringify(joinedSam.value));
    const samHostReady = await api.post('game-c', {
      type: 'ready',
      clientVersion: 11,
      actionId: crypto.randomUUID(),
      roomId: samCreated.value.room.id,
      expectedVersion: joinedSam.value.room.version,
      matchId: null,
      ready: true,
    });
    assert.equal(samHostReady.status, 200, JSON.stringify(samHostReady.value));
    const samFinalReady = await api.post('game-d', {
      type: 'ready',
      clientVersion: 11,
      actionId: crypto.randomUUID(),
      roomId: samCreated.value.room.id,
      expectedVersion: samHostReady.value.room.version,
      matchId: null,
      ready: true,
    });
    assert.equal(samFinalReady.status, 200, JSON.stringify(samFinalReady.value));
    assert.equal(samFinalReady.value.room.game.rulesVersion, 'sam-v2');

    for (const role of ['anon', 'authenticated'])
      assert.equal(
        (
          await db.query(
            "select has_function_privilege($1,'public.lifemate_game_assert_variant_config(jsonb)','execute') ok",
            [role],
          )
        ).rows[0].ok,
        false,
      );
  } finally {
    await db.close();
  }
});

test('protocol 9 creates Sâm rooms, blocks older clients before join or lease renewal, and commits typed actions', async () => {
  const db = await setup();
  let renewCalls = 0;
  const api = readyApi(db, async (name, args, run) => {
    if (name === 'lifemate_game_read' && args.p_renew) renewCalls++;
    return run(name, args);
  });
  try {
    const created = await api.post(uid, {
      type: 'create',
      clientVersion: 9,
      actionId: crypto.randomUUID(),
      game: 'sam',
      name: 'An',
    });
    assert.equal(created.status, 200, JSON.stringify(created.value));
    assert.equal(created.value.room.gameKind, 'sam');

    const oldJoin = await api.post(other, {
      type: 'join',
      clientVersion: 8,
      actionId: crypto.randomUUID(),
      code: created.value.room.code,
      name: 'Bình',
    });
    assert.equal(oldJoin.status, 409);
    assert.equal(oldJoin.value.error, 'game-update-required');
    assert.equal(
      (
        await db.query('select count(*)::integer n from public.lifemate_game_seats where room_id=$1', [
          created.value.room.id,
        ])
      ).rows[0].n,
      1,
    );

    const joined = await api.post(other, {
      type: 'join',
      clientVersion: 9,
      actionId: crypto.randomUUID(),
      code: created.value.room.code,
      name: 'Bình',
    });
    assert.equal(joined.status, 200, JSON.stringify(joined.value));
    let roomState = joined.value.room;
    const ready = await api.post(other, {
      type: 'ready',
      clientVersion: 9,
      actionId: crypto.randomUUID(),
      roomId: roomState.id,
      expectedVersion: roomState.version,
      matchId: roomState.matchId,
      ready: true,
    });
    assert.equal(ready.status, 200, JSON.stringify(ready.value));
    roomState = ready.value.room;
    const started = await api.post(uid, {
      type: 'start',
      clientVersion: 9,
      actionId: crypto.randomUUID(),
      roomId: roomState.id,
      expectedVersion: roomState.version,
      matchId: roomState.matchId,
    });
    assert.equal(started.status, 200, JSON.stringify(started.value));
    roomState = started.value.room;
    assert.equal(roomState.game.step, 'report-sam');

    const malformed = await api.post(roomState.game.turn, {
      type: 'game-action',
      clientVersion: 9,
      actionId: crypto.randomUUID(),
      roomId: roomState.id,
      expectedVersion: roomState.version,
      matchId: roomState.matchId,
      gameAction: { type: 'pass-report', extra: true },
    });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.value.error, 'invalid-input');

    const acted = await api.post(roomState.game.turn, {
      type: 'game-action',
      clientVersion: 10,
      actionId: crypto.randomUUID(),
      roomId: roomState.id,
      expectedVersion: roomState.version,
      matchId: roomState.matchId,
      gameAction: { type: 'pass-report' },
    });
    assert.equal(acted.status, 200, JSON.stringify(acted.value));
    assert.equal(acted.value.room.game.reported.length, 1);
    assert.equal(acted.value.room.version, roomState.version + 1);
    const secondReport = await api.post(acted.value.room.game.turn, {
      type: 'game-action',
      clientVersion: 10,
      actionId: crypto.randomUUID(),
      roomId: acted.value.room.id,
      expectedVersion: acted.value.room.version,
      matchId: acted.value.room.matchId,
      gameAction: { type: 'pass-report' },
    });
    assert.equal(secondReport.status, 200, JSON.stringify(secondReport.value));
    assert.equal(secondReport.value.room.version, acted.value.room.version + 1);

    const beforeLease = (
      await db.query(
        'select lease_until from public.lifemate_game_seats where uid=$1 and room_id=$2',
        [uid, roomState.id],
      )
    ).rows[0].lease_until;
    const oldLease = await api.post(uid, { type: 'lease', clientVersion: 8 });
    assert.equal(oldLease.status, 409);
    assert.equal(oldLease.value.error, 'game-update-required');
    assert.equal(renewCalls, 0);
    assert.equal(
      (
        await db.query(
          'select lease_until from public.lifemate_game_seats where uid=$1 and room_id=$2',
          [uid, roomState.id],
        )
      ).rows[0].lease_until.getTime(),
      beforeLease.getTime(),
    );
  } finally {
    await db.close();
  }
});

test('protocol 10 commits Tấn attack and defend actions over HTTP', async () => {
  const db = await setup();
  const api = readyApi(db);
  try {
    const created = await api.post(uid, {
      type: 'create',
      clientVersion: 10,
      actionId: crypto.randomUUID(),
      game: 'tan',
      variantConfig: { pointsPerCard: 1 },
      name: 'An',
    });
    assert.equal(created.status, 200, JSON.stringify(created.value));
    const joined = await api.post(other, {
      type: 'join',
      clientVersion: 10,
      actionId: crypto.randomUUID(),
      code: created.value.room.code,
      name: 'Bình',
    });
    assert.equal(joined.status, 200, JSON.stringify(joined.value));
    const otherReady = await api.post(other, {
      type: 'ready',
      clientVersion: 10,
      actionId: crypto.randomUUID(),
      roomId: joined.value.room.id,
      expectedVersion: joined.value.room.version,
      matchId: joined.value.room.matchId,
      ready: true,
    });
    assert.equal(otherReady.status, 200, JSON.stringify(otherReady.value));
    const started = await api.post(uid, {
      type: 'ready',
      clientVersion: 10,
      actionId: crypto.randomUUID(),
      roomId: otherReady.value.room.id,
      expectedVersion: otherReady.value.room.version,
      matchId: otherReady.value.room.matchId,
      ready: true,
    });
    assert.equal(started.status, 200, JSON.stringify(started.value));

    const deck = [
      0,
      4,
      ...Array.from({ length: 52 }, (_, card) => card).filter(
        (card) => card !== 0 && card !== 4,
      ),
    ];
    const tanState = newTanGame([uid, other], deck, Date.now());
    await db.query(
      "update public.lifemate_game_rooms set state=jsonb_set(state,'{game}',$2::jsonb),version=version+1 where id=$1",
      [started.value.room.id, JSON.stringify(tanState)],
    );
    const attackRoom = await api.post(uid, { type: 'sync', clientVersion: 10 });
    assert.equal(attackRoom.status, 200, JSON.stringify(attackRoom.value));
    assert.equal(attackRoom.value.room.game.turn, uid);
    const attacked = await api.post(uid, {
      type: 'game-action',
      clientVersion: 10,
      actionId: crypto.randomUUID(),
      roomId: attackRoom.value.room.id,
      expectedVersion: attackRoom.value.room.version,
      matchId: attackRoom.value.room.matchId,
      gameAction: { type: 'attack', card: 0 },
    });
    assert.equal(attacked.status, 200, JSON.stringify(attacked.value));
    const passed = await api.post(uid, {
      type: 'game-action',
      clientVersion: 10,
      actionId: crypto.randomUUID(),
      roomId: attacked.value.room.id,
      expectedVersion: attacked.value.room.version,
      matchId: attacked.value.room.matchId,
      gameAction: { type: 'pass-attack' },
    });
    assert.equal(passed.status, 200, JSON.stringify(passed.value));
    const defendRoom = await api.post(other, {
      type: 'sync',
      clientVersion: 10,
    });
    assert.equal(defendRoom.status, 200, JSON.stringify(defendRoom.value));
    assert.equal(defendRoom.value.room.game.turn, other);
    const defended = await api.post(other, {
      type: 'game-action',
      clientVersion: 10,
      actionId: crypto.randomUUID(),
      roomId: defendRoom.value.room.id,
      expectedVersion: defendRoom.value.room.version,
      matchId: defendRoom.value.room.matchId,
      gameAction: { type: 'defend', index: 0, card: 4 },
    });
    assert.equal(defended.status, 200, JSON.stringify(defended.value));
    assert.equal(defended.value.room.version, defendRoom.value.room.version + 1);
  } finally {
    await db.close();
  }
});
