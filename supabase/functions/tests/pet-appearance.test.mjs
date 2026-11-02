import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { EXP_RULES, LEVEL_THRESHOLDS, levelForExp } from '../pet-access/expConfig.mjs';
import { createPetHandler } from '../pet-access/handler.mjs';

const authTime = Math.floor(Date.now() / 1000);
const adoption = '11111111-1111-4111-8111-111111111111';
const receipt = '22222222-2222-4222-8222-222222222222';
const appearanceSql = await readFile(new URL('../../migrations/20261102010000_pixel_pet_appearance.sql', import.meta.url), 'utf8');
async function setup(migrate = true) {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table public.lifemate_account_access(uid text primary key,status text not null default 'active',valid_since bigint not null default 0);
    create schema realtime; create schema auth;
    create table realtime.messages(topic text,extension text); alter table realtime.messages enable row level security;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as 'select null';
    create function realtime.topic() returns text language sql as 'select null::text';
    create function auth.jwt() returns jsonb language sql as 'select ''{}''::jsonb';`);
  for (const name of ['202610190003_card_game_rooms.sql','20261027181510_pixel_pet.sql','20261027181952_pixel_pet_fix_search_path.sql','20261028052536_pet_admin_management.sql','20261028075042_pet_exclusive_celestial_stag.sql','20261028173007_pixel_pet_nickname.sql']) {
    await db.exec(await readFile(new URL(`../../migrations/${name}`, import.meta.url), 'utf8'));
  }
  await db.exec(`insert into public.lifemate_account_access(uid) values('CQmmT9iJvKPP79UZqYbvmZ3gXZQ2') on conflict do nothing;
    insert into public.lifemate_pet_accounts(uid) values('CQmmT9iJvKPP79UZqYbvmZ3gXZQ2') on conflict do nothing; delete from public.lifemate_pet_adoptions where uid='CQmmT9iJvKPP79UZqYbvmZ3gXZQ2';
    insert into public.lifemate_pet_adoptions(uid,adoption_id,species_id,adopted_at,adopted_day)
      values('CQmmT9iJvKPP79UZqYbvmZ3gXZQ2','${adoption}','celestial_stag',now()-interval '4 days',public.lifemate_pet_today()-4);`);
  if (migrate) await db.exec(appearanceSql);
  return db;
}
const value = async (db, sql, args = []) => (await db.query(sql, args)).rows[0].r;
const read = (db) => value(db, 'select public.lifemate_pet_read($1,$2) r', ['CQmmT9iJvKPP79UZqYbvmZ3gXZQ2',authTime]);
const style = (db, body, scene, id = adoption, uid = 'CQmmT9iJvKPP79UZqYbvmZ3gXZQ2') => value(db,
  'select public.lifemate_pet_set_appearance($1,$2,$3,$4,$5) r', [uid,authTime,id,body,scene]);
const command = (db) => value(db, 'select public.lifemate_pet_command($1,$2,$3,$4,$5,$6,$7) r',
  ['CQmmT9iJvKPP79UZqYbvmZ3gXZQ2',authTime,receipt,'care:{}','care',{},EXP_RULES]);

test('appearance migration, authorization, unlocks, retention and receipt replay', async () => {
  const db = await setup();
  try {
    for (const exp of [...LEVEL_THRESHOLDS,29,149,629,99999]) {
      assert.equal(await value(db,'select public.lifemate_pet_level_for_exp($1) r',[exp]),levelForExp(exp));
    }
    assert.equal((await read(db)).pet.appearanceLevel,null);
    await assert.rejects(style(db,4,2),/appearance-locked/);
    await assert.rejects(style(db,2,null),/appearance-invalid/);
    await assert.rejects(style(db,1,3),/appearance-invalid/);
    await assert.rejects(style(db,1,null,receipt),/stale-snapshot/);
    await assert.rejects(style(db,1,null,adoption,'other'),/no-pet/);
    await db.exec("update public.lifemate_pet_adoptions set total_exp=150 where uid='CQmmT9iJvKPP79UZqYbvmZ3gXZQ2'");
    await command(db); // Receipt predates the appearance change.
    assert.equal((await style(db,1,4)).pet.sleepSceneLevel,4);
    assert.equal((await command(db)).pet.sleepSceneLevel,4,'old receipt returns current appearance');
    assert.equal((await read(db)).pet.totalExp,155,'replay does not award EXP twice');
    await db.exec("update public.lifemate_pet_adoptions set total_exp=0 where uid='CQmmT9iJvKPP79UZqYbvmZ3gXZQ2'");
    const kept = await style(db,4,2);
    assert.equal(kept.pet.maxUnlockedLevel,4);
    assert.equal(kept.pet.totalExp,0,'cosmetics do not restore EXP or skills');
    assert.equal((await style(db,null,null)).pet.appearanceLevel,null);
    for (const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(style(db,1,null),/permission denied/);
      await db.exec('reset role');
    }
    await db.exec("update public.lifemate_account_access set status='disabled' where uid='CQmmT9iJvKPP79UZqYbvmZ3gXZQ2'");
    await assert.rejects(style(db,1,null),/invalid-session/);
    await db.exec("update public.lifemate_account_access set status='active' where uid='CQmmT9iJvKPP79UZqYbvmZ3gXZQ2'; update public.lifemate_pet_adoptions set species_id='phoenix' where uid='CQmmT9iJvKPP79UZqYbvmZ3gXZQ2'");
    await assert.rejects(style(db,3,null),/appearance-invalid/);
    await assert.rejects(style(db,1,2),/appearance-invalid/);
    await style(db,4,null);
    await db.exec("update public.lifemate_pet_adoptions set species_id='celestial_stag',total_exp=4650 where uid='CQmmT9iJvKPP79UZqYbvmZ3gXZQ2'");
    for (const level of [1,3,4,5,7,8,9,11,13,15,17,19]) assert.equal((await style(db,level,20)).pet.appearanceLevel,level);
    for (const level of [2,4,6,8,10,12,14,16,18,20]) assert.equal((await style(db,19,level)).pet.sleepSceneLevel,level);
  } finally { await db.close(); }
});

test('moving finance records cannot unlock from provisional EXP inside reconcile', async () => {
  const db = await setup();
  try {
    await command(db);
    const today = await value(db,'select public.lifemate_pet_today()::text r');
    const day = (offset) => new Date(Date.parse(today+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
    const sync = (days) => value(db,'select public.lifemate_pet_reconcile_current($1,$2,$3,$4,$5::date[],$6,$7,$8) r',
      ['CQmmT9iJvKPP79UZqYbvmZ3gXZQ2',authTime,adoption,Date.now()+1000,days,EXP_RULES,2,4]);
    assert.equal((await sync([day(-1),day(0)])).pet.totalExp,25);
    const moved = await sync([day(-2),day(-1)]);
    assert.equal(moved.pet.totalExp,25);
    assert.equal(moved.pet.maxUnlockedLevel,1,'intermediate 35 EXP is not an unlocked level');
  } finally { await db.close(); }
});

test('backfill uses completed matching-adoption receipts and resets with a new adoption', async () => {
  const db = await setup(false);
  try {
    await db.exec("update public.lifemate_pet_adoptions set total_exp=150 where uid='CQmmT9iJvKPP79UZqYbvmZ3gXZQ2'");
    await command(db);
    await db.exec("update public.lifemate_pet_adoptions set total_exp=0 where uid='CQmmT9iJvKPP79UZqYbvmZ3gXZQ2'");
    await db.exec(appearanceSql);
    assert.equal((await read(db)).pet.maxUnlockedLevel,4);
    await style(db,4,2);
    await db.exec(`delete from public.lifemate_pet_adoptions where uid='CQmmT9iJvKPP79UZqYbvmZ3gXZQ2';
      insert into public.lifemate_pet_adoptions(uid,adoption_id,species_id,adopted_day)
      values('CQmmT9iJvKPP79UZqYbvmZ3gXZQ2','33333333-3333-4333-8333-333333333333','celestial_stag',public.lifemate_pet_today());`);
    const fresh = await read(db);
    assert.equal(fresh.pet.maxUnlockedLevel,1);
    assert.equal(fresh.pet.appearanceLevel,null);
    await assert.rejects(style(db,1,null),/stale-snapshot/);
  } finally { await db.close(); }
});

test('appearance handler rejects malformed/untrusted fields and forwards only verified identity', async () => {
  const calls = [];
  const handler = createPetHandler({verifyIdentity:async()=>({uid:'CQmmT9iJvKPP79UZqYbvmZ3gXZQ2',authTime}),rpc:async(name,args)=>{calls.push([name,args]);return {};},listTransactions:async()=>[]});
  const post = (body) => new Request('https://x/pet-access',{method:'POST',headers:{authorization:'Bearer ok'},body:JSON.stringify(body)});
  const input = {type:'appearance',adoptionId:adoption,appearanceLevel:1,sleepSceneLevel:null};
  for (const body of [{...input,uid:'other'},{...input,appearanceLevel:4.5},{...input,sleepSceneLevel:'2'},{...input,maxUnlockedLevel:20},{...input,adoptionId:'bad'}]) {
    assert.equal((await handler(post(body))).status,400);
  }
  assert.equal(calls.length,0);
  assert.equal((await handler(post(input))).status,200);
  assert.deepEqual(calls,[['lifemate_pet_set_appearance',{p_uid:'CQmmT9iJvKPP79UZqYbvmZ3gXZQ2',p_auth_time:authTime,p_adoption_id:adoption,p_appearance_level:1,p_sleep_scene_level:null}]]);
});

for (const genuinePeak of [false,true]) test(`historical reconcile backfill: ${genuinePeak ? 'keeps completed old-species peaks' : 'ignores provisional peaks'}`, async () => {
  const db = await setup(false);
  const uid = 'CQmmT9iJvKPP79UZqYbvmZ3gXZQ2';
  try {
    await db.exec(`update public.lifemate_pet_adoptions set species_id='phoenix' where uid='${uid}'`);
    await command(db);
    const today = await value(db,'select public.lifemate_pet_today()::text r');
    const day = (offset) => new Date(Date.parse(today+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
    const sync = (days) => value(db,'select public.lifemate_pet_reconcile_current($1,$2,$3,$4,$5::date[],$6,$7,$8) r',
      [uid,authTime,adoption,Date.now()+1000,days,EXP_RULES,2,4]);
    assert.equal((await sync([day(-1),day(0)])).pet.totalExp,25);
    assert.equal((await sync([day(-2),day(-1)])).pet.totalExp,25);
    if (genuinePeak) {
      assert.equal((await sync([day(-2),day(-1),day(0)])).pet.totalExp,50);
      assert.equal((await sync([])).pet.totalExp,5);
    }
    await db.exec(`update public.lifemate_pet_adoptions set species_id='celestial_stag' where uid='${uid}'`);
    await db.exec(appearanceSql);
    assert.equal((await read(db)).pet.maxUnlockedLevel,genuinePeak ? 2 : 1);
  } finally { await db.close(); }
});
