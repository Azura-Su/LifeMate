import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdminHandler,
  ADMIN_UID,
  ADMIN_EMAIL,
} from '../user-admin/handler.mjs';
import { createAccounts } from '../user-admin/accounts.mjs';
import { withAccountAccess } from '../_shared/accountAccess.mjs';

const admin = {
  localId: ADMIN_UID,
  email: ADMIN_EMAIL,
  emailVerified: true,
  validSince: '100',
};
function fixture(
  identity = {
    uid: ADMIN_UID,
    email: ADMIN_EMAIL,
    emailVerified: true,
    authTime: 101,
  },
  readAvatar = async () => null,
) {
  const calls = [];
  const google = {
    lookup: async (query) =>
      query.localId?.[0] === ADMIN_UID
        ? admin
        : {
            localId: 'target',
            email: 'target@example.com',
            passwordHash: 'SECRET',
            salt: 'SECRET',
          },
    list: async () => ({
      users: [
        {
          localId: 'target',
          email: 'target@example.com',
          passwordHash: 'SECRET',
        },
      ],
    }),
  };
  const accounts = {
    get: async () => null,
    jobs: async () => [],
    transition: async (...args) => {
      calls.push(args);
      return { status: 'disabled' };
    },
  };
  const handler = createAdminHandler({
    verifyIdentity: async () => identity,
    google,
    accounts,
    sweep: async () => calls.push('sweep'),
    workerSecret: 'server-only',
    readAvatar,
    pets: {
      list: async (actor) => (calls.push(['pet-list', actor]), { pets: [] }),
      revoke: async (actor, input) => (
        calls.push(['pet-revoke', actor, input]),
        { pets: [] }
      ),
    },
  });
  const post = (body, headers = {}) =>
    handler(
      new Request('https://example.com', {
        method: 'POST',
        headers: { Authorization: 'Bearer jwt', ...headers },
        body: JSON.stringify(body),
      }),
    );
  return { post, calls, google, accounts };
}
const petRevoke = {
  action: 'pet-revoke',
  targetUid: 'target',
  speciesId: 'phoenix',
  adoptionId: '11111111-1111-4111-8111-111111111111',
  actionId: '22222222-2222-4222-8222-222222222222',
};
test('pet operations use live admin checks and server-derived actor', async () => {
  const f = fixture();
  assert.equal((await f.post({ action: 'pet-list' })).status, 200);
  assert.equal((await f.post(petRevoke)).status, 200);
  assert.equal(f.calls[1][1].uid, ADMIN_UID);
  for (const change of [
    { uid: 'other' },
    { emailVerified: false },
    { authTime: 99 },
  ]) {
    const denied = fixture({
      uid: ADMIN_UID,
      email: ADMIN_EMAIL,
      emailVerified: true,
      authTime: 101,
      ...change,
    });
    assert.equal((await denied.post(petRevoke)).status, 403);
    assert.deepEqual(denied.calls, []);
  }
  f.google.lookup = async () => ({ ...admin, disabled: true });
  assert.equal((await f.post(petRevoke)).status, 403);
});
test('pet revoke rejects overposting and malformed IDs before mutation', async () => {
  const f = fixture();
  for (const bad of [
    { ...petRevoke, totalExp: 100 },
    { ...petRevoke, actorUid: ADMIN_UID },
    { ...petRevoke, adoptionId: 'bad' },
    { ...petRevoke, targetUid: '../x' },
    { ...petRevoke, speciesId: '../x' },
    { ...petRevoke, actionId: undefined },
  ])
    assert.equal((await f.post(bad)).status, 400);
  assert.deepEqual(f.calls, []);
});
test('admin list returns allowlisted fields only', async () => {
  const { post } = fixture();
  const response = await post({ action: 'list' });
  assert.equal(response.status, 200);
  assert.ok(!(await response.text()).includes('SECRET'));
});
test('list and search hide the protected admin and preserve pagination', async () => {
  const f = fixture();
  f.google.list = async () => ({
    users: [
      admin,
      { localId: 'target', email: 'target@example.com' },
      { localId: 'renamed-admin', email: ADMIN_EMAIL.toUpperCase() },
    ],
    nextPageToken: 'next',
  });
  const list = await (await f.post({ action: 'list' })).json();
  assert.deepEqual(
    list.users.map((u) => u.uid),
    ['target'],
  );
  assert.equal(list.nextPageToken, 'next');
  f.google.lookup = async () => admin;
  for (const query of [ADMIN_UID, ADMIN_EMAIL]) {
    const response = await f.post({ action: 'search', query });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).users, []);
  }
});
for (const [label, change] of Object.entries({
  ordinary: { uid: 'other' },
  unverified: { emailVerified: false },
  renamed: { email: 'other@example.com' },
  revoked: { authTime: 99 },
}))
  test(`${label} identity cannot administer`, async () => {
    const { post, calls } = fixture({
      uid: ADMIN_UID,
      email: ADMIN_EMAIL,
      emailVerified: true,
      authTime: 101,
      ...change,
    });
    assert.equal(
      (await post({ action: 'disable', uid: 'target' })).status,
      403,
    );
    assert.deepEqual(calls, []);
  });
test('live disabled or changed admin rejected', async () => {
  const f = fixture();
  f.google.lookup = async () => ({ ...admin, disabled: true });
  assert.equal((await f.post({ action: 'list' })).status, 403);
});
test('admin cannot be deleted; confirmation matches live email', async () => {
  const f = fixture();
  assert.equal(
    (await f.post({ action: 'delete', uid: ADMIN_UID, email: ADMIN_EMAIL }))
      .status,
    403,
  );
  assert.equal(
    (
      await f.post({
        action: 'delete',
        uid: 'target',
        email: 'wrong@example.com',
      })
    ).status,
    400,
  );
  assert.deepEqual(f.calls, []);
});
test('server worker secret is separate from admin identity', async () => {
  const f = fixture();
  assert.equal((await f.post({ action: 'sweep' })).status, 403);
  assert.equal(
    (await f.post({ action: 'sweep' }, { Authorization: 'Bearer server-only' }))
      .status,
    200,
  );
});
test('public recovery exposes only status, no identity', async () => {
  const f = fixture();
  f.accounts.get = async () => ({
    status: 'deleted',
    email: 'private@example.com',
  });
  assert.deepEqual(
    await (
      await f.post({ action: 'status', uid: 'target' }, { Authorization: '' })
    ).json(),
    { status: 'deleted' },
  );
});
test('malformed and browser requests rejected before work', async () => {
  const f = fixture();
  assert.equal(
    (await f.post({ action: 'delete', uid: '../admin', email: 'x' })).status,
    400,
  );
  assert.equal((await f.post({ action: 'list', extra: true })).status, 400);
  assert.equal(
    (await f.post({ action: 'list' }, { Origin: 'https://evil.example' }))
      .status,
    405,
  );
});
test('access gates reject stale tokens for every blocked state and fail closed', async () => {
  for (const state of ['disabled', 'deleting', 'deleted']) {
    const database = async () => [{ status: state }];
    await assert.rejects(
      withAccountAccess(async () => 'target', database)('jwt'),
    );
    await assert.rejects(
      withAccountAccess(async () => ({ uid: 'target' }), database, true)('jwt'),
    );
  }
  await assert.rejects(
    withAccountAccess(
      async () => 'target',
      async () => {
        throw Error('offline');
      },
    )('jwt'),
  );
});

test('unlock rejects sessions before cutoff, accepts boundary for memory and audio', async () => {
  const database = async () => [{ status: 'active', valid_since: 100 }];
  for (const returnUid of [false, true]) {
    await assert.rejects(
      withAccountAccess(
        async () => ({ uid: 'target', authTime: 99 }),
        database,
        true,
        returnUid,
      )('jwt'),
    );
    const result = await withAccountAccess(
      async () => ({ uid: 'target', authTime: 100 }),
      database,
      true,
      returnUid,
    )('jwt');
    assert.deepEqual(
      result,
      returnUid ? 'target' : { uid: 'target', authTime: 100 },
    );
  }
});

function jobsFixture() {
  let row = {
    uid: 'target',
    status: 'active',
    phase: 'ready',
    next_run: new Date(0).toISOString(),
  };
  let clock = 1000000000;
  const events = [];
  let fail = false;
  let cleanupFail = false;
  let gameCleanupFail = false;
  let authFail = false;
  let authPresent = true;
  let failAuthAck = false;
  const queries = [];
  const database = async (table, method = 'GET', query = {}, body) => {
    if (table === 'rpc/claim_lifemate_account') {
      if (row.lease_id) return [];
      row = { ...row, lease_id: body.p_lease };
      return [{ ...row }];
    }
    if (table !== 'lifemate_account_access') {
      queries.push({ table, method, query, body });
      events.push(table);
      return [];
    }
    if (method === 'GET') return [{ ...row }];
    if (query.lease_id !== `eq.${row.lease_id}`) return [];
    if (body.auth_deleted_at && failAuthAck)
      throw Error('Lost acknowledgement');
    row = { ...row, ...body };
    return [{ ...row }];
  };
  const google = {
    mirror: async () => {
      events.push('mirror');
      if (fail) throw Error('offline');
    },
    setDisabled: async (uid, disabled) =>
      events.push(disabled ? 'disable' : 'enable'),
    lookup: async () => (authPresent ? { email: 'target@example.com' } : null),
    clearStorage: async () => {
      events.push('storage');
      return true;
    },
    clearFirestore: async () => {
      events.push('firestore');
      return true;
    },
    deleteAuth: async () => {
      events.push('deleteAuth');
      if (authFail) throw Error('Auth offline');
      authPresent = false;
    },
  };
  const accounts = createAccounts({
    database,
    google,
    clearObjects: async () => {
      events.push('objects');
      if (cleanupFail) throw Error('Storage offline');
      return true;
    },
    clearGames: async () => {
      events.push('games');
      if (gameCleanupFail) throw Error('Game cleanup offline');
    },
    clearPets: async () => {
      events.push('pets');
    },
    now: () => clock,
    uuid: () => 'lease',
  });
  return {
    accounts,
    events,
    queries,
    setFailAuthAck: (value) => {
      failAuthAck = value;
    },
    get row() {
      return row;
    },
    setFail: (v) => {
      fail = v;
    },
    setCleanupFail: (value) => {
      cleanupFail = value;
    },
    setGameCleanupFail: (value) => {
      gameCleanupFail = value;
    },
    setAuthFail: (value) => {
      authFail = value;
    },
    advance: () => {
      clock += 86400000;
    },
  };
}
test('game cleanup failure keeps deletion retryable and must finish before other private data cleanup', async () => {
  const f = jobsFixture();
  f.setGameCleanupFail(true);
  await f.accounts.transition('target', 'delete', 'target@example.com');
  assert.equal(f.row.status, 'deleting');
  assert.equal(f.row.phase, 'sweeping');
  assert.ok(!f.events.includes('firestore'));
  f.setGameCleanupFail(false);
  f.advance();
  await f.accounts.sweep();
  assert.equal(f.row.status, 'deleted');
  assert.equal(f.row.phase, 'complete');
  assert.ok(f.events.indexOf('games') < f.events.indexOf('firestore'));
  // Pet revocation runs with metadata cleanup, before the Firestore sweep.
  assert.ok(f.events.indexOf('pets') > f.events.indexOf('games'));
  assert.ok(f.events.indexOf('pets') < f.events.indexOf('firestore'));
});
test('durable block survives provider failure; sweep deletes Auth and data without grace wait', async () => {
  const f = jobsFixture();
  f.setFail(true);
  await assert.rejects(
    f.accounts.transition('target', 'delete', 'target@example.com'),
  );
  assert.equal(f.row.status, 'deleting');
  assert.equal(f.row.phase, 'blocking');
  assert.equal(f.row.lease_id, null);
  f.setFail(false);
  await f.accounts.sweep();
  assert.equal(f.row.phase, 'complete');
  assert.ok(f.events.includes('deleteAuth'));
  await assert.rejects(
    f.accounts.transition('target', 'enable'),
    /cannot be cancelled/,
  );
  f.advance();
  await f.accounts.sweep();
  assert.equal(f.row.status, 'deleted');
  assert.equal(f.row.email, null);
  assert.ok(f.events.indexOf('firestore') < f.events.indexOf('objects'));
  assert.ok(f.events.indexOf('deleteAuth') < f.events.indexOf('objects'));
  assert.equal(f.row.final_after, null);
});
test('concurrent transitions serialize; protected UID never claimed', async () => {
  const f = jobsFixture();
  const result = await Promise.allSettled([
    f.accounts.transition('target', 'delete', 'target@example.com'),
    f.accounts.transition('target', 'enable'),
  ]);
  assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(f.row.status, 'deleted');
  await assert.rejects(
    f.accounts.transition(ADMIN_UID, 'delete', ADMIN_EMAIL),
    /Protected/,
  );
});

test('incomplete cleanup batches yield to later accounts and leased accounts are excluded', async () => {
  const clock = 1000000000;
  const rows = ['first', 'second', 'third', 'busy'].map((uid, index) => ({
    uid,
    status: 'deleting',
    phase: 'sweeping',
    next_run: new Date(clock - 10000 + index).toISOString(),
    final_after: null,
    deletion_requested_at: new Date(clock - 10000).toISOString(),
    lease_id: uid === 'busy' ? 'other-lease' : null,
    lease_until: uid === 'busy' ? new Date(clock + 60000).toISOString() : null,
  }));
  const processed = [];
  const touched = [];
  const database = async (table, method = 'GET', query = {}, body) => {
    if (table === 'rpc/claim_lifemate_account') {
      const row = rows.find((r) => r.uid === body.p_uid);
      if (row.lease_id) return [];
      row.lease_id = body.p_lease;
      return [{ ...row }];
    }
    if (table !== 'lifemate_account_access') return [];
    if (method === 'GET') {
      assert.match(query.and, /lease_until\.is\.null/);
      return rows
        .filter((r) => !r.lease_id && Date.parse(r.next_run) <= clock)
        .sort((a, b) => a.next_run.localeCompare(b.next_run))
        .slice(0, 2)
        .map((r) => ({ ...r }));
    }
    const row = rows.find(
      (r) =>
        `eq.${r.uid}` === query.uid && `eq.${r.lease_id}` === query.lease_id,
    );
    if (!row) return [];
    touched.push(row.uid);
    Object.assign(row, body);
    return [{ ...row }];
  };
  const accounts = createAccounts({
    database,
    now: () => clock,
    uuid: () => 'worker-lease',
    google: {
      lookup: async () => ({ email: 'user@example.com' }),
      deleteAuth: async () => undefined,
      clearFirestore: async () => true,
    },
    clearObjects: async (uid) => {
      processed.push(uid);
      return false;
    },
  });
  await accounts.sweep();
  assert.deepEqual(processed, ['first', 'second']);
  await accounts.sweep();
  assert.deepEqual(processed, ['first', 'second', 'third']);
  assert.ok(!touched.includes('busy'));
  assert.equal(rows[3].lease_id, 'other-lease');
});

test('only a live admin receives signed avatars for server-returned user IDs', async () => {
  const signed = [];
  const signer = async (path) => {
    signed.push(path);
    return 'signed-avatar';
  };
  const f = fixture(undefined, signer);
  const result = await (await f.post({ action: 'list' })).json();
  assert.equal(result.users[0].avatarUrl, 'signed-avatar');
  assert.deepEqual(signed, ['profiles/target/avatar.jpg']);
  signed.length = 0;
  const ordinary = fixture(
    { uid: 'target', email: 'target@example.com', emailVerified: true },
    signer,
  );
  assert.equal((await ordinary.post({ action: 'list' })).status, 403);
  assert.deepEqual(signed, []);
  f.google.lookup = async () => ({ ...admin, disabled: true });
  assert.equal((await f.post({ action: 'list' })).status, 403);
  assert.deepEqual(signed, []);
});
test('avatar signing failure uses fallback without failing user list', async () => {
  const f = fixture(undefined, async () => {
    throw Error('Storage offline');
  });
  const response = await f.post({ action: 'list' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).users[0].avatarUrl, null);
});

test('delete removes login immediately and finishes cleanup in the same request', async () => {
  const f = jobsFixture();
  const result = await f.accounts.transition(
    'target',
    'delete',
    'target@example.com',
  );
  assert.equal(result.status, 'deleted');
  assert.equal(result.phase, 'complete');
  assert.equal(result.final_after, null);
  assert.ok(f.events.indexOf('disable') < f.events.indexOf('deleteAuth'));
  assert.ok(f.events.indexOf('deleteAuth') < f.events.indexOf('objects'));
  assert.ok(f.events.includes('firestore'));
});
test('failed cleanup preserves retry intent after Auth deletion; worker finishes without waiting', async () => {
  const f = jobsFixture();
  f.setCleanupFail(true);
  const pending = await f.accounts.transition(
    'target',
    'delete',
    'target@example.com',
  );
  assert.equal(pending.status, 'deleting');
  assert.ok(f.events.includes('deleteAuth'));
  assert.equal(f.row.email, 'target@example.com');
  assert.equal(f.row.lease_id, null);
  f.setCleanupFail(false);
  await f.accounts.sweep();
  assert.equal(f.row.status, 'deleted');
  assert.equal(f.row.email, null);
});
test('Auth deletion failure is not acknowledged as success', async () => {
  const f = jobsFixture();
  f.setAuthFail(true);
  await assert.rejects(
    f.accounts.transition('target', 'delete', 'target@example.com'),
  );
  assert.equal(f.row.status, 'deleting');
  assert.ok(!f.events.includes('objects'));
  f.setAuthFail(false);
  await f.accounts.sweep();
  assert.equal(f.row.status, 'deleted');
});

test('retry after Auth deletion acknowledgement loss tolerates absent Auth and keeps cutoff', async () => {
  const f = jobsFixture();
  f.setFailAuthAck(true);
  await assert.rejects(
    f.accounts.transition('target', 'delete', 'target@example.com'),
  );
  const cutoff = f.row.deletion_requested_at;
  assert.ok(f.events.includes('deleteAuth'));
  assert.equal(f.row.auth_deleted_at, null);
  f.row.phase = 'blocking'; // Recovery must not attempt disabling an absent Auth user.
  f.setFailAuthAck(false);
  await f.accounts.sweep();
  assert.equal(f.row.status, 'deleted');
  assert.ok(f.row.auth_deleted_at);
  assert.equal(f.row.deletion_requested_at, cutoff);
  const invites = f.queries.filter(
    (q) => q.table === 'lifemate_memory_email_invites',
  );
  assert.ok(invites.length >= 2);
  assert.ok(invites.every((q) => q.query.created_at === `lte.${cutoff}`));
  assert.ok(
    f.events.indexOf('lifemate_memory_profiles') <
      f.events.indexOf('deleteAuth'),
  );
  assert.equal(f.events.filter((event) => event === 'disable').length, 1);
});
