import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { EXP_RULES, WEEKLY_RECORD_DAYS } from '../pet-access/expConfig.mjs';

const migration = (name) =>
  readFile(new URL(`../../migrations/${name}`, import.meta.url), 'utf8');
const gameSql = await migration('202610190003_card_game_rooms.sql');
const petSql = await migration('20261027181510_pixel_pet.sql');
const petSearchPathSql = await migration('20261027181952_pixel_pet_fix_search_path.sql');
const petAdminSql = await migration('20261028052536_pet_admin_management.sql');
const petExclusiveSql = await migration('20261028130000_pet_exclusive_celestial_stag.sql');
const authTime = Math.floor(Date.now() / 1000);
let actions = 0;
const action = () =>
  `00000000-0000-4000-8000-${String(++actions).padStart(12, '0')}`;

async function setup({ exclusive = true } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table public.lifemate_account_access(uid text primary key,status text not null default 'active',valid_since bigint not null default 0);
    create schema realtime; create schema auth;
    create table realtime.messages(topic text, extension text);
    alter table realtime.messages enable row level security;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as 'select null';
    create function realtime.topic() returns text language sql as 'select null::text';
    create function auth.jwt() returns jsonb language sql as 'select ''{}''::jsonb';
  `);
  await db.exec(gameSql);
  await db.exec(petSql);
  await db.exec(petSearchPathSql);
  await db.exec(petAdminSql);
  if (exclusive) await db.exec(petExclusiveSql);
  return db;
}
const one = async (db, sql, params) => (await db.query(sql, params)).rows[0];

test('pet tables and RPCs reject client database roles', async () => {
  const db = await setup();
  try {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      try {
        await assert.rejects(
          db.query('select public.lifemate_pet_read($1,$2)', ['u1', authTime]),
          /permission denied/,
        );
        await assert.rejects(
          db.query('select count(*) from public.lifemate_pet_species'),
          /permission denied/,
        );
      } finally {
        await db.exec('reset role');
      }
    }
  } finally {
    await db.close();
  }
});

async function command(db, uid, type, args = {}, id = action()) {
  const row = await one(
    db,
    'select public.lifemate_pet_command($1,$2,$3,$4,$5,$6,$7) as r',
    [uid, authTime, id, `${type}:${JSON.stringify(args)}`, type, args, EXP_RULES],
  );
  return row.r;
}
const fails = (promise, code) =>
  assert.rejects(promise, (error) => error.message.includes(code));
async function adopt(db, uid) {
  const rolled = await command(db, uid, 'roll');
  return command(db, uid, 'confirm', {
    reservationId: rolled.reservation.id,
  });
}
const today = async (db) =>
  (await one(db, 'select public.lifemate_pet_today()::text as d')).d;
const addDays = (day, n) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000)
    .toISOString()
    .slice(0, 10);
let readMs = Date.now() + 1000;
async function sync(db, uid, days) {
  readMs = Math.max(readMs, Date.now() + 1000);
  return (
    await one(
      db,
      'select public.lifemate_pet_reconcile($1,$2,$3,$4::date[],$5,$6,$7) as r',
      [uid, authTime, readMs++, days, EXP_RULES, 2, WEEKLY_RECORD_DAYS],
    )
  ).r;
}
async function ledgerMatches(db, uid) {
  const row = await one(
    db,
    `select a.total_exp,(select coalesce(sum(exp_delta),0)::int from public.lifemate_pet_exp_ledger l where l.adoption_id=a.adoption_id) s,
       (select coalesce(sum(amount),0)::int from public.lifemate_pet_exp_grants g where g.adoption_id=a.adoption_id) g
     from public.lifemate_pet_adoptions a where uid=$1`,
    [uid],
  );
  assert.equal(row.total_exp, row.s);
  assert.equal(row.total_exp, row.g);
  return row.total_exp;
}

const adminUid = 'CQmmT9iJvKPP79UZqYbvmZ3gXZQ2';
const revoke = async (db, uid, pet, id = action(), actor = adminUid) =>
  (
    await one(
      db,
      'select public.lifemate_pet_admin_revoke($1,$2,$3,$4,$5,$6) r',
      [actor, authTime, id, uid, pet.speciesId, pet.adoptionId],
    )
  ).r;

test('admin inventory and revoke RPCs reject clients and non-admin actors', async () => {
  const db = await setup();
  try {
    await fails(
      db.query('select public.lifemate_pet_admin_list($1,$2)', [
        'other',
        authTime,
      ]),
      'admin-required',
    );
    const list = (
      await one(db, 'select public.lifemate_pet_admin_list($1,$2) r', [
        adminUid,
        authTime,
      ])
    ).r;
    assert.equal(list.pets.length, 15);
    assert.ok(
      list.pets.every((p) => p.status === 'available' && p.holderUid === null),
    );
    const owner = await adopt(db, 'inventory-owner');
    const reserved = await command(db, 'inventory-reserved', 'roll');
    const inventory = (await one(db, 'select public.lifemate_pet_admin_list($1,$2) r', [adminUid, authTime])).r;
    const ownedRow = inventory.pets.find(p => p.speciesId === owner.pet.speciesId);
    assert.equal(ownedRow.status, 'owned');
    assert.equal(ownedRow.holderUid, 'inventory-owner');
    assert.equal(ownedRow.adoption.id, owner.pet.adoptionId);
    assert.equal(inventory.pets.find(p => p.speciesId === reserved.reservation.speciesId).status, 'reserved');
    await fails(revoke(db, 'inventory-owner', owner.pet, action(), 'other'), 'admin-required');
    await db.exec('set role service_role');
    assert.equal((await one(db, 'select public.lifemate_pet_admin_list($1,$2) r', [adminUid, authTime])).r.pets.length, 15);
    await fails(db.query('select public.lifemate_pet_command_before_admin($1,$2,$3,$4,$5,$6,$7)',
      ['inventory-owner', authTime, action(), 'care:{}', 'care', {}, EXP_RULES]), 'permission denied');
    await db.exec('reset role');
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await fails(
        db.query('select public.lifemate_pet_admin_list($1,$2)', [
          adminUid,
          authTime,
        ]),
        'permission denied',
      );
      await fails(revoke(db, 'inventory-owner', owner.pet), 'permission denied');
      await fails(
        db.query('select * from public.lifemate_pet_admin_revocations'),
        'permission denied',
      );
      await db.exec('reset role');
    }
    await db.query(
      'update public.lifemate_account_access set valid_since=$2 where uid=$1',
      [adminUid, authTime + 1],
    );
    await fails(
      db.query('select public.lifemate_pet_admin_list($1,$2)', [
        adminUid,
        authTime,
      ]),
      'invalid-session',
    );
  } finally {
    await db.close();
  }
});

test('revoke is CAS/idempotent, preserves rolls, blocks restore and stale receipts', async () => {
  const db = await setup();
  try {
    const rollId = action(),
      confirmId = action(),
      careId = action();
    const rolled = await command(db, 'a', 'roll', {}, rollId);
    const args = { reservationId: rolled.reservation.id };
    const owned = await command(db, 'a', 'confirm', args, confirmId);
    await command(db, 'a', 'care', {}, careId);
    const id = action();
    await fails(
      revoke(db, 'a', { ...owned.pet, adoptionId: action() }),
      'pet-changed',
    );
    assert.deepEqual(await revoke(db, 'a', owned.pet, id), { ok: true });
    assert.deepEqual(await revoke(db, 'a', owned.pet, id), { ok: true });
    for (const [type, input, receipt] of [
      ['roll', {}, rollId],
      ['confirm', args, confirmId],
      ['care', {}, careId],
    ]) {
      const replay = await command(db, 'a', type, input, receipt);
      assert.equal(replay.pet, null);
      assert.equal(replay.rollsLeft, 2);
      assert.equal(replay.restoresLeft, 0);
    }
    await fails(command(db, 'a', 'restore'), 'no-restores');
    const replacement = await adopt(db, 'a');
    assert.notEqual(replacement.pet.adoptionId, owned.pet.adoptionId);
    assert.equal(replacement.pet.totalExp, 0);
    assert.equal(replacement.rollsLeft, 1);
    await revoke(db, 'a', owned.pet, id); // old retry cannot revoke replacement
    await fails(revoke(db, 'a', replacement.pet, id), 'idempotency-conflict');
    assert.equal((await command(db, 'a', 'care', {}, careId)).pet.totalExp, 0);
    assert.equal(
      (
        await one(
          db,
          'select count(*)::int n from public.lifemate_pet_admin_revocations',
        )
      ).n,
      1,
    );
    await db.query(
      "update public.lifemate_account_access set status='deleting' where uid='a'",
    );
    await db.query("select public.lifemate_pet_erase_account('a')");
    assert.equal(
      (
        await one(
          db,
          'select count(*)::int n from public.lifemate_pet_admin_revocations',
        )
      ).n,
      0,
    );
  } finally {
    await db.close();
  }
});

test('disabled owners can be revoked; deleting owners cannot; next owner gets fresh progress', async () => {
  const db = await setup();
  try {
    const owned = await adopt(db, 'a');
    await command(db, 'a', 'care');
    await db.query(
      "update public.lifemate_account_access set status='deleting' where uid='a'",
    );
    await fails(revoke(db, 'a', owned.pet), 'account-busy');
    await db.query(
      "update public.lifemate_account_access set status='disabled' where uid='a'",
    );
    await revoke(db, 'a', owned.pet);
    await db.query(
      "update public.lifemate_pet_species set owner_uid='o'||sort where id<>$1 and exclusive_uid is null",
      [owned.pet.speciesId],
    );
    const next = await adopt(db, 'b');
    assert.equal(next.pet.speciesId, owned.pet.speciesId);
    assert.equal(next.pet.totalExp, 0);
    assert.notEqual(next.pet.adoptionId, owned.pet.adoptionId);
  } finally {
    await db.close();
  }
});

test('old and adoption-aware finance snapshots cannot grant EXP to a replacement', async () => {
  const db = await setup();
  try {
    const owned = await adopt(db, 'a');
    await revoke(db, 'a', owned.pet);
    const next = await adopt(db, 'a');
    const day = await today(db);
    await db.query(
      "update public.lifemate_pet_adoptions set adopted_at=now()+interval '1 second' where uid='a'",
    );
    await fails(
      db.query(
        'select public.lifemate_pet_reconcile($1,$2,$3,$4::date[],$5,$6,$7)',
        ['a', authTime, Date.now(), [day], EXP_RULES, 2, WEEKLY_RECORD_DAYS],
      ),
      'stale-snapshot',
    );
    await fails(
      db.query(
        'select public.lifemate_pet_reconcile_current($1,$2,$3,$4,$5::date[],$6,$7,$8)',
        [
          'a',
          authTime,
          owned.pet.adoptionId,
          Date.now() + 2000,
          [day],
          EXP_RULES,
          2,
          WEEKLY_RECORD_DAYS,
        ],
      ),
      'stale-snapshot',
    );
    assert.equal(
      (
        await one(
          db,
          "select total_exp n from public.lifemate_pet_adoptions where uid='a'",
        )
      ).n,
      0,
    );
    assert.ok(next.pet);
    await db.exec('set role service_role');
    await fails(
      db.query(
        'select public.lifemate_pet_reconcile_before_admin($1,$2,$3,$4::date[],$5,$6,$7)',
        [
          'a',
          authTime,
          Date.now() + 2000,
          [day],
          EXP_RULES,
          2,
          WEEKLY_RECORD_DAYS,
        ],
      ),
      'permission denied',
    );
  } finally {
    await db.close();
  }
});

test('15 accounts adopt 15 distinct pets; the 16th cannot', async () => {
  const db = await setup();
  const species = new Set();
  for (let i = 0; i < 15; i += 1) {
    const state = await adopt(db, `user${i}`);
    assert.equal(state.status, 'owned');
    species.add(state.pet.speciesId);
  }
  assert.equal(species.size, 15);
  await fails(command(db, 'user15', 'roll'), 'all-adopted');
  const state = await one(db, `select public.lifemate_pet_read('user15',$1) r`, [authTime]);
  assert.equal(state.r.rollsLeft, 3);
  await fails(
    db.query(`insert into public.lifemate_pet_species(id,sort) values('sixteenth',16)`),
    'pet-catalog-closed',
  );
});

test('an account owns at most one pet and a pet has one owner', async () => {
  const db = await setup();
  const owned = await adopt(db, 'a');
  await fails(
    db.query(`update public.lifemate_pet_species set owner_uid='a' where id=(select id from public.lifemate_pet_species where owner_uid is null limit 1)`),
    'duplicate key',
  );
  await fails(
    db.query(`update public.lifemate_pet_species set reserved_by='b',reservation_id=gen_random_uuid(),reserved_until=now()+interval '1 minute' where id=$1`, [owned.pet.speciesId]),
    'check constraint',
  );
  const b = await command(db, 'b', 'roll');
  assert.notEqual(b.reservation.speciesId, owned.pet.speciesId);
  const again = await command(db, 'a', 'roll');
  assert.equal(again.status, 'owned', 'an owner calling roll gets its pet back');
  assert.equal(again.rollsLeft, 2);
});

test('one account keeps a single reservation across rerolls and devices', async () => {
  const db = await setup();
  const first = await command(db, 'a', 'roll');
  const second = await command(db, 'a', 'roll');
  assert.notEqual(first.reservation.speciesId, second.reservation.speciesId);
  const held = await one(db, `select count(*)::int n from public.lifemate_pet_species where reserved_by='a'`);
  assert.equal(held.n, 1);
  assert.equal(second.rollsLeft, 1);
  await command(db, 'a', 'roll');
  await fails(command(db, 'a', 'roll'), 'no-rolls');
});

test('retrying an action returns the same result without another roll', async () => {
  const db = await setup();
  const id = action();
  const first = await command(db, 'a', 'roll', {}, id);
  const again = await command(db, 'a', 'roll', {}, id);
  assert.deepEqual(again, first);
  assert.equal(again.rollsLeft, 2);
  await fails(command(db, 'a', 'confirm', { reservationId: 'x' }, id), 'idempotency-conflict');
  const owned = await command(db, 'a', 'confirm', { reservationId: first.reservation.id });
  const repeat = await command(db, 'a', 'confirm', { reservationId: first.reservation.id });
  assert.equal(repeat.pet.speciesId, owned.pet.speciesId);
  assert.equal((await one(db, `select count(*)::int n from public.lifemate_pet_adoptions where uid='a'`)).n, 1);
});

test('expired reservations cannot be confirmed and are released', async () => {
  const db = await setup();
  const rolled = await command(db, 'a', 'roll');
  await db.query(`update public.lifemate_pet_species set reserved_until=now()-interval '1 second' where reserved_by='a'`);
  await fails(command(db, 'a', 'confirm', { reservationId: rolled.reservation.id }), 'reservation-expired');
  const other = await command(db, 'b', 'roll');
  assert.equal((await one(db, `select count(*)::int n from public.lifemate_pet_species where reserved_by='a'`)).n, 0);
  assert.ok(other.reservation);
});

test('no rolls are spent when every free pet is reserved by others', async () => {
  const db = await setup();
  await db.query(`update public.lifemate_pet_species set owner_uid='o'||sort where sort<=13`);
  await command(db, 'b', 'roll');
  await command(db, 'c', 'roll');
  await fails(command(db, 'a', 'roll'), 'all-reserved');
  const state = await one(db, `select public.lifemate_pet_read('a',$1) r`, [authTime]);
  assert.equal(state.r.rollsLeft, 3);
});

test('restore re-reserves the last pet without granting a roll', async () => {
  const db = await setup();
  let last;
  for (let i = 0; i < 3; i += 1) last = await command(db, 'a', 'roll');
  await db.query(`update public.lifemate_pet_species set reserved_until=now()-interval '1 second' where reserved_by='a'`);
  const restored = await command(db, 'a', 'restore');
  assert.equal(restored.reservation.speciesId, last.reservation.speciesId);
  assert.equal(restored.rollsLeft, 0);
  assert.equal(restored.restoresLeft, 2);
});

test('account deletion revokes the pet; the next owner starts at level 1', async () => {
  const db = await setup();
  const owned = await adopt(db, 'a');
  const day = await today(db);
  await sync(db, 'a', [day]);
  await command(db, 'a', 'care');
  assert.equal(await ledgerMatches(db, 'a'), 15);
  await fails(db.query(`select public.lifemate_pet_erase_account('a')`), 'account-active');
  await db.query(`update public.lifemate_account_access set status='deleting' where uid='a'`);
  await fails(command(db, 'a', 'roll'), 'invalid-session');
  await db.query(`select public.lifemate_pet_erase_account('a')`);
  await db.query(`select public.lifemate_pet_erase_account('a')`); // idempotent retry
  assert.equal((await one(db, `select count(*)::int n from public.lifemate_pet_exp_ledger`)).n, 0);
  await db.query(`update public.lifemate_pet_species set owner_uid='o'||sort where id<>$1 and exclusive_uid is null`, [owned.pet.speciesId]);
  const next = await adopt(db, 'b');
  assert.equal(next.pet.speciesId, owned.pet.speciesId);
  assert.equal(next.pet.totalExp, 0);
  assert.notEqual(next.pet.adoptionId, owned.pet.adoptionId);
});

test('EXP: one record per day, care without spending, edits and date moves', async () => {
  const db = await setup();
  await adopt(db, 'a');
  const day = await today(db);
  const yesterday = addDays(day, -1);
  // Adoption is today; backdated days before adoption never count.
  await db.query(`update public.lifemate_pet_adoptions set adopted_day=$1::date - 10 where uid='a'`, [day]);
  let state = await sync(db, 'a', [day, day, day]);
  assert.equal(state.pet.totalExp, EXP_RULES.record_day);
  state = await sync(db, 'a', [day]);
  assert.equal(state.pet.totalExp, 10, 'retry/second device adds nothing');
  state = await command(db, 'a', 'care');
  assert.equal(state.pet.totalExp, 15);
  assert.equal(state.pet.caredToday, true);
  state = await command(db, 'a', 'care');
  assert.equal(state.pet.totalExp, 15, 'care is once per day');
  // Move the only transaction from today to yesterday: today revoked, yesterday granted.
  state = await sync(db, 'a', [yesterday]);
  assert.equal(state.pet.totalExp, 15);
  const grants = (await db.query(`select period_key,amount from public.lifemate_pet_exp_grants where source_type='record_day' order by 1`)).rows;
  assert.deepEqual(grants, [
    { period_key: yesterday, amount: 10 },
    { period_key: day, amount: 0 },
  ]);
  state = await sync(db, 'a', []);
  assert.equal(state.pet.totalExp, 5, 'deleting every transaction keeps care EXP');
  assert.equal(await ledgerMatches(db, 'a'), 5);
});

test('EXP: backdated days outside the grace window are not claimable', async () => {
  const db = await setup();
  await adopt(db, 'a');
  const day = await today(db);
  await db.query(`update public.lifemate_pet_adoptions set adopted_day=$1::date - 30 where uid='a'`, [day]);
  const old = Array.from({ length: 10 }, (_, i) => addDays(day, -20 + i));
  const state = await sync(db, 'a', old);
  assert.equal(state.pet.totalExp, 0);
});

test('EXP: streaks grant once per run and are revoked when the run breaks', async () => {
  const db = await setup();
  await adopt(db, 'a');
  const day = await today(db);
  await db.query(`update public.lifemate_pet_adoptions set adopted_day=$1::date - 30 where uid='a'`, [day]);
  const run = Array.from({ length: 7 }, (_, i) => addDays(day, i - 6));
  // Claim each day while it was recent.
  await db.query(
    `insert into public.lifemate_pet_day_claims select adoption_id,d::date from public.lifemate_pet_adoptions,unnest($1::text[]) d`,
    [run],
  );
  let state = await sync(db, 'a', run);
  const weekly = (await one(db, `select coalesce(sum(amount),0)::int n from public.lifemate_pet_exp_grants where source_type='weekly_record'`)).n;
  assert.equal(state.pet.totalExp, 70 + 15 + 30 + weekly);
  state = await sync(db, 'a', run);
  assert.equal(await ledgerMatches(db, 'a'), state.pet.totalExp);
  // Delete day 4: two runs of 3 → two streak_3 milestones, streak_7 revoked.
  const broken = run.filter((_, i) => i !== 3);
  state = await sync(db, 'a', broken);
  const streaks = (await db.query(`select source_type,count(*) filter(where amount>0)::int n from public.lifemate_pet_exp_grants where source_type like 'streak%' group by 1 order by 1`)).rows;
  assert.deepEqual(streaks, [
    { source_type: 'streak_3', n: 2 },
    { source_type: 'streak_7', n: 0 },
  ]);
  assert.equal(await ledgerMatches(db, 'a'), state.pet.totalExp);
});

test('older Firestore snapshots cannot overwrite newer EXP', async () => {
  const db = await setup();
  await adopt(db, 'a');
  await sync(db, 'a', [await today(db)]);
  await fails(
    db.query('select public.lifemate_pet_reconcile($1,$2,0,$3::date[],$4,2,4)', ['a', authTime, [], EXP_RULES]),
    'stale-snapshot',
  );
});

test('the admin owns the exclusive Celestial Stag outside the 15-pet pool', async () => {
  const db = await setup();
  try {
    const state = (
      await one(db, 'select public.lifemate_pet_read($1,$2) r', [adminUid, authTime])
    ).r;
    assert.equal(state.status, 'owned');
    assert.equal(state.pet.speciesId, 'celestial_stag');
    assert.equal(state.pet.totalExp, 0);
    assert.deepEqual(state.availability, { total: 15, owned: 0, reserved: 0 });
    // The pool still yields exactly the 15 original pets and never the stag.
    const species = new Set();
    for (let i = 0; i < 15; i += 1)
      species.add((await adopt(db, `user${i}`)).pet.speciesId);
    assert.equal(species.size, 15);
    assert.ok(!species.has('celestial_stag'));
    await fails(command(db, 'user15', 'roll'), 'all-adopted');
    // Care still works for the admin's stag.
    const cared = await command(db, adminUid, 'care');
    assert.equal(cared.pet.speciesId, 'celestial_stag');
    assert.ok(cared.pet.caredToday);
  } finally {
    await db.close();
  }
});

test('only the bound account can hold the exclusive pet, and it cannot be revoked or listed', async () => {
  const db = await setup();
  try {
    await db.query(`insert into public.lifemate_pet_accounts(uid) values('other')`);
    await fails(
      db.query(
        `insert into public.lifemate_pet_adoptions(uid,adoption_id,species_id,adopted_day)
         values('other',gen_random_uuid(),'celestial_stag',current_date)`,
      ),
      'exclusive-pet',
    );
    const list = (
      await one(db, 'select public.lifemate_pet_admin_list($1,$2) r', [adminUid, authTime])
    ).r;
    assert.equal(list.pets.length, 15);
    assert.ok(list.pets.every((p) => p.speciesId !== 'celestial_stag'));
    const pet = (
      await one(db, 'select public.lifemate_pet_read($1,$2) r', [adminUid, authTime])
    ).r.pet;
    await fails(revoke(db, adminUid, pet), 'invalid-input');
    await fails(revoke(db, adminUid, pet, action(), 'other'), 'admin-required');
    const kept = await one(
      db,
      'select species_id from public.lifemate_pet_adoptions where uid=$1',
      [adminUid],
    );
    assert.equal(kept.species_id, 'celestial_stag');
  } finally {
    await db.close();
  }
});

test('granting the stag swaps an existing admin pet in place and keeps its EXP', async () => {
  const db = await setup({ exclusive: false });
  try {
    const before = await adopt(db, adminUid);
    const day = await today(db);
    const synced = await sync(db, adminUid, [day]);
    assert.ok(synced.pet.totalExp > 0);
    await command(db, adminUid, 'care');
    const exp = await ledgerMatches(db, adminUid);
    await db.exec(petExclusiveSql);
    const after = (
      await one(db, 'select public.lifemate_pet_read($1,$2) r', [adminUid, authTime])
    ).r;
    assert.equal(after.pet.speciesId, 'celestial_stag');
    assert.equal(after.pet.adoptionId, before.pet.adoptionId);
    assert.equal(after.pet.totalExp, exp);
    assert.equal(await ledgerMatches(db, adminUid), exp);
    // The admin's previous species is free for the next random roll again.
    const freed = await one(
      db,
      'select owner_uid from public.lifemate_pet_species where id=$1',
      [before.pet.speciesId],
    );
    assert.equal(freed.owner_uid, null);
    assert.equal(after.availability.owned, 0);
    // A pre-swap receipt replays the current state rather than the old pet.
    const replay = await command(db, adminUid, 'care', {}, action());
    assert.equal(replay.pet.speciesId, 'celestial_stag');
  } finally {
    await db.close();
  }
});
