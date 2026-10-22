import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHandler } from '../memory-access/handler.mjs';

const users = {
  alice: { uid: 'alice', email: 'alice@example.com', emailVerified: true },
  bob: { uid: 'bob', email: 'bob@example.com', emailVerified: true },
  eve: { uid: 'eve', email: 'eve@example.com', emailVerified: true },
};

// Small in-memory stand-in for the PostgREST filters the handler uses.
function matches(row, query) {
  return Object.entries(query).every(([key, value]) => {
    if (['select', 'limit', 'order', 'offset'].includes(key)) return true;
    if (key === 'or')
      return value
        .slice(1, -1)
        .split(',')
        .some((part) => {
          const [field, , expected] = part.split('.');
          return String(row[field]) === expected;
        });
    if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
    if (value.startsWith('gte.')) return String(row[key]) >= value.slice(4);
    if (value.startsWith('in.('))
      return value.slice(4, -1).split(',').includes(String(row[key]));
    throw new Error(`Unsupported filter ${key}=${value}`);
  });
}

function createWorld(options = {}) {
  const tables = new Map();
  const rows = (table) => {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table);
  };
  const calls = [];
  async function database(table, method, query = {}, body) {
    calls.push({ table, method, query, body });
    if (table === 'rpc/invite_lifemate_memory_friend') {
      if (options.inviteLimited) return { limited: true };
      const target = rows('lifemate_memory_profiles').find(
        (row) => row.email === body.p_email,
      );
      if (target)
        rows('lifemate_memory_friend_requests').push({
          requester_uid: body.p_uid,
          target_uid: target.uid,
        });
      else
        rows('lifemate_memory_email_invites').push({
          requester_uid: body.p_uid,
          target_email: body.p_email,
        });
      return { limited: false };
    }
    if (table === 'rpc/claim_lifemate_memory_email_invites') return null;
    if (table === 'rpc/tombstone_lifemate_shared_memory') {
      const markers = rows('lifemate_memory_deletions');
      let marker = markers.find(
        (row) => row.owner_uid === body.p_owner_uid && row.id === body.p_id,
      );
      const memories = rows('lifemate_shared_memories');
      const row = memories.find(
        (row) => row.owner_uid === body.p_owner_uid && row.id === body.p_id,
      );
      if (Date.parse(row?.migration_until) > Date.now()) return { busy: true };
      tables.set(
        'lifemate_shared_memories',
        memories.filter((item) => item !== row),
      );
      if (!marker) {
        marker = {
          owner_uid: body.p_owner_uid,
          id: body.p_id,
          photo_path: row?.photo_path ?? null,
          photo_backend: row?.photo_backend ?? null,
          supabase_cleanup_pending: row?.supabase_cleanup_pending ?? false,
        };
        markers.push(marker);
      }
      return { ...marker };
    }
    if (table === 'rpc/claim_lifemate_memory_migration') {
      const row = rows('lifemate_shared_memories').find(
        (row) => row.owner_uid === body.p_owner_uid && row.id === body.p_id,
      );
      if (
        !row ||
        row.status !== 'active' ||
        row.photo_backend !== 'supabase' ||
        row.reservation_token !== body.p_expected_token
      )
        return { missing: true };
      if (Date.parse(row.migration_until) > Date.now()) return { busy: true };
      Object.assign(row, {
        migration_token: body.p_token,
        migration_until: new Date(Date.now() + 300000).toISOString(),
      });
      return { ...row };
    }
    if (table === 'rpc/claim_lifemate_memory_revocation') {
      const row = rows('lifemate_shared_memories').find(
        (row) => row.owner_uid === body.p_owner_uid && row.id === body.p_id,
      );
      if (!row) return { missing: true };
      if (Date.parse(row.migration_until) > Date.now())
        return { busy: true, migrating: true };
      if (
        row.status === 'revoking' &&
        Date.parse(row.revoke_until) > Date.now()
      )
        return { busy: true };
      Object.assign(row, {
        migration_token: null,
        migration_until: null,
        status: 'revoking',
        revoke_token: body.p_token,
        revoke_until: new Date(Date.now() + 300000).toISOString(),
      });
      options.afterClaim?.(row);
      return { ...row };
    }
    if (table === 'rpc/reserve_lifemate_shared_memory') {
      // Atomic stand-in for the PostgreSQL owner lock + row lock transaction.
      const row = body.p_memory;
      const memories = rows('lifemate_shared_memories');
      if (
        rows('lifemate_memory_deletions').some(
          (item) => item.owner_uid === row.owner_uid && item.id === row.id,
        )
      )
        return 'memory-deleted';
      const existing = memories.find(
        (item) => item.owner_uid === row.owner_uid && item.id === row.id,
      );
      if (existing?.status === 'active') return 'already-shared';
      if (existing?.status === 'revoking') return 'memory-revoking';
      if (existing?.photo_path && !row.photo_path) return 'memory-pending';
      if (
        !existing &&
        memories.filter((item) => item.owner_uid === row.owner_uid).length >=
          100
      )
        return 'memory-limit';
      const reservation = {
        ...row,
        reservation_token: crypto.randomUUID(),
        supabase_cleanup_pending: !!(
          row.supabase_cleanup_pending ||
          existing?.supabase_cleanup_pending ||
          (existing?.photo_backend === 'supabase' && existing.photo_path)
        ),
      };
      if (existing) Object.assign(existing, reservation);
      else
        memories.push({ created_at: new Date().toISOString(), ...reservation });
      return 'saved';
    }
    if (table === 'rpc/accept_lifemate_memory_friend_request') {
      const requests = rows('lifemate_memory_friend_requests');
      const index = requests.findIndex(
        (row) =>
          row.requester_uid === body.p_requester_uid &&
          row.target_uid === body.p_target_uid,
      );
      if (index < 0) return false;
      requests.splice(index, 1);
      const [left_uid, right_uid] = [
        body.p_requester_uid,
        body.p_target_uid,
      ].sort();
      rows('lifemate_memory_friendships').push({ left_uid, right_uid });
      return true;
    }
    const list = rows(table);
    if (method === 'GET') {
      const offset = Number(query.offset ?? 0);
      const result = list
        .filter((row) => matches(row, query))
        .slice(offset, offset + Number(query.limit ?? 1000))
        .map((row) => ({ ...row }));
      if (table === 'lifemate_shared_memories')
        await options.afterMemoryRead?.(query, result);
      return result;
    }
    if (method === 'POST') {
      const row = { created_at: new Date().toISOString(), ...body };
      list.push(row);
      return [row];
    }
    if (method === 'PATCH') {
      await options.beforeMemoryPatch?.(query, body);
      const changed = list.filter((row) => matches(row, query));
      for (const row of changed) Object.assign(row, body);
      return changed;
    }
    if (method === 'DELETE') {
      const deleted = list.filter((row) => matches(row, query));
      tables.set(
        table,
        list.filter((row) => !matches(row, query)),
      );
      return deleted.map((row) => ({ ...row }));
    }
    throw new Error(`Unsupported ${method}`);
  }
  const storage = async (action, path) => `supabase:${action}:${path}`;
  const r2 = options.r2 ?? (async (action, path) => `r2:${action}:${path}`);
  const handler = createHandler({
    verifyIdentity: async (token) => {
      if (!users[token]) throw new Error('bad token');
      return users[token];
    },
    database,
    storage,
    r2,
  });
  const call = async (as, body, headers = {}) => {
    const response = await handler(
      new Request('https://project.supabase.co/functions/v1/memory-access', {
        method: 'POST',
        headers: { authorization: `Bearer ${as}`, ...headers },
        body: JSON.stringify({ displayName: as, ...body }),
      }),
    );
    return { status: response.status, body: await response.json() };
  };
  return { call, rows, calls };
}

async function befriend(world, a, b) {
  await world.call(b, { action: 'state' });
  await world.call(a, { action: 'invite', email: users[b].email });
  assert.equal((await world.call(b, { action: 'accept', uid: a })).status, 200);
}

test('rejects browser origins, bad tokens, unverified email and extra fields', async () => {
  const world = createWorld();
  assert.equal(
    (await world.call('alice', { action: 'state' }, { origin: 'https://x' }))
      .status,
    403,
  );
  assert.equal((await world.call('nobody', { action: 'state' })).status, 401);
  users.mallory = {
    uid: 'mallory',
    email: 'm@example.com',
    emailVerified: false,
  };
  assert.equal((await world.call('mallory', { action: 'state' })).status, 403);
  delete users.mallory;
  assert.equal(
    (await world.call('alice', { action: 'state', admin: true })).status,
    400,
  );
});

test('answers invites the same way for unknown and existing accounts', async () => {
  const world = createWorld();
  await world.call('bob', { action: 'state' });
  const unknown = await world.call('alice', {
    action: 'invite',
    email: 'ghost@example.com',
  });
  const known = await world.call('alice', {
    action: 'invite',
    email: 'BOB@example.com',
  });
  assert.deepEqual(unknown, known);
  assert.deepEqual(unknown, { status: 200, body: { sent: true } });
  assert.equal(
    (await world.call('alice', { action: 'invite', email: users.alice.email }))
      .body.code,
    'self-invite',
  );
});

test('uses the verified sender and maps the atomic invite quota to HTTP 429', async () => {
  const world = createWorld({ inviteLimited: true });
  assert.deepEqual(
    await world.call('alice', { action: 'invite', email: ' BOB@example.com ' }),
    {
      status: 429,
      body: { code: 'invite-limit' },
    },
  );
  assert.deepEqual(
    world.calls.find(
      (call) => call.table === 'rpc/invite_lifemate_memory_friend',
    ),
    {
      table: 'rpc/invite_lifemate_memory_friend',
      method: 'POST',
      query: {},
      body: { p_uid: 'alice', p_email: 'bob@example.com' },
    },
  );
  assert.equal(world.rows('lifemate_memory_friend_requests').length, 0);
  assert.equal(world.rows('lifemate_memory_email_invites').length, 0);
});

test('only friends see shared memories and photos', async () => {
  const world = createWorld();
  await world.call('eve', { action: 'state' });
  await befriend(world, 'alice', 'bob');
  const published = await world.call('alice', {
    action: 'publish',
    id: 'memory-1',
    dateKey: '2026-10-01',
    text: 'Đi biển',
    hasPhoto: true,
    sizeBytes: 1000,
  });
  assert.equal(
    published.body.uploadUrl,
    'r2:upload:shared/alice/memory-1/photo.jpg',
  );

  // Pending photo memories stay hidden until the upload is confirmed.
  assert.deepEqual(
    (await world.call('bob', { action: 'feed' })).body.items,
    [],
  );

  world.rows('lifemate_shared_memories')[0].status = 'active';
  const feed = await world.call('bob', { action: 'feed' });
  assert.equal(feed.body.items.length, 1);
  assert.equal(feed.body.items[0].ownerName, 'alice');
  assert.equal(
    feed.body.items[0].photoUrl,
    'r2:download:shared/alice/memory-1/photo.jpg',
  );

  assert.deepEqual(
    (await world.call('eve', { action: 'feed' })).body.items,
    [],
  );
  assert.equal(
    (
      await world.call('eve', {
        action: 'photo',
        ownerUid: 'alice',
        id: 'memory-1',
      })
    ).status,
    404,
  );

  await world.call('bob', { action: 'remove-friend', uid: 'alice' });
  assert.deepEqual(
    (await world.call('bob', { action: 'feed' })).body.items,
    [],
  );
  assert.equal(
    (
      await world.call('bob', {
        action: 'photo',
        ownerUid: 'alice',
        id: 'memory-1',
      })
    ).status,
    404,
  );
});

test('cannot accept an invite that was never sent', async () => {
  const world = createWorld();
  await world.call('alice', { action: 'state' });
  const result = await world.call('eve', { action: 'accept', uid: 'alice' });
  assert.equal(result.status, 404);
  assert.equal(world.rows('lifemate_memory_friendships').length, 0);
});

test('unsharing a photo hides it before deleting the file', async () => {
  const world = createWorld();
  await world.call('alice', {
    action: 'publish',
    id: 'memory-1',
    dateKey: '2026-10-01',
    text: '',
    hasPhoto: true,
    sizeBytes: 1000,
  });
  world.rows('lifemate_shared_memories')[0].status = 'active';
  world.calls.length = 0;

  const result = await world.call('alice', {
    action: 'unshare',
    id: 'memory-1',
  });
  assert.deepEqual(result.body, { shared: false });
  const memoryCalls = world.calls.filter(
    (call) =>
      call.table === 'lifemate_shared_memories' ||
      call.table === 'rpc/claim_lifemate_memory_revocation',
  );
  const hideIndex = memoryCalls.findIndex(
    (call) => call.table === 'rpc/claim_lifemate_memory_revocation',
  );
  const deleteIndex = memoryCalls.findIndex((call) => call.method === 'DELETE');
  assert.ok(hideIndex >= 0 && hideIndex < deleteIndex);
  assert.equal(world.rows('lifemate_shared_memories').length, 0);
});

test('rejects future dates and oversized photos when publishing', async () => {
  const world = createWorld();
  const base = {
    action: 'publish',
    id: 'memory-1',
    text: 'x',
    hasPhoto: false,
  };
  assert.equal(
    (await world.call('alice', { ...base, dateKey: '2999-01-01' })).status,
    400,
  );
  assert.equal(
    (
      await world.call('alice', {
        ...base,
        dateKey: '2026-10-01',
        hasPhoto: true,
        sizeBytes: 3 * 1024 * 1024,
      })
    ).status,
    400,
  );
});

test('concurrent publishes at 99 consume only one remaining slot', async () => {
  const world = createWorld();
  for (let i = 0; i < 99; i++)
    world
      .rows('lifemate_shared_memories')
      .push({ owner_uid: 'alice', id: `seed-${i}`, status: 'active' });
  const results = await Promise.all(
    ['first', 'second'].map((id) =>
      world.call('alice', {
        action: 'publish',
        id,
        dateKey: '2026-01-01',
        text: 'Memory',
        hasPhoto: false,
      }),
    ),
  );
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 429]);
  assert.equal(
    results.find((result) => result.status === 429).body.code,
    'memory-limit',
  );
  assert.equal(world.rows('lifemate_shared_memories').length, 100);
});

test('pending photo retry at the quota limit reuses its slot', async () => {
  const world = createWorld();
  for (let i = 0; i < 100; i++)
    world.rows('lifemate_shared_memories').push({
      owner_uid: 'alice',
      id: `seed-${i}`,
      status: i ? 'active' : 'pending',
    });
  const result = await world.call('alice', {
    action: 'publish',
    id: 'seed-0',
    dateKey: '2026-01-01',
    text: 'Retry',
    hasPhoto: true,
    sizeBytes: 100,
  });
  assert.equal(result.status, 200);
  assert.equal(world.rows('lifemate_shared_memories').length, 100);
  assert.equal(world.rows('lifemate_shared_memories')[0].body, 'Retry');
});

test('deleted IDs cannot be republished in either ordering; unverified owners can revoke only their own IDs', async () => {
  const world = createWorld();
  const publish = (id) => ({
    action: 'publish',
    id,
    dateKey: '2026-10-15',
    text: 'Memory',
    hasPhoto: false,
  });
  assert.equal((await world.call('alice', publish('first'))).status, 200);
  assert.equal(
    (await world.call('alice', { action: 'delete-own', id: 'first' })).status,
    200,
  );
  assert.equal(world.rows('lifemate_shared_memories').length, 0);
  assert.equal(
    (await world.call('alice', publish('first'))).body.code,
    'memory-deleted',
  );
  await world.call('alice', { action: 'delete-own', id: 'second' });
  assert.equal(
    (await world.call('alice', publish('second'))).body.code,
    'memory-deleted',
  );
  assert.equal((await world.call('bob', publish('second'))).status, 200);
  users.unverified = {
    uid: 'unverified',
    email: 'u@example.com',
    emailVerified: false,
  };
  try {
    const before = world.calls.length;
    assert.equal(
      (await world.call('unverified', { action: 'delete-own', id: 'second' }))
        .status,
      200,
    );
    assert.equal(
      (await world.call('unverified', { action: 'unshare', id: 'second' }))
        .status,
      200,
    );
    assert.equal(
      world.calls
        .slice(before)
        .some(
          (call) =>
            call.table.includes('profiles') ||
            call.table === 'rpc/claim_lifemate_memory_email_invites',
        ),
      false,
    );
    assert.equal(
      world
        .rows('lifemate_shared_memories')
        .some((row) => row.owner_uid === 'bob'),
      true,
    );
    assert.equal(
      (await world.call('unverified', publish('third'))).status,
      403,
    );
    assert.equal(
      (
        await world.call('unverified', {
          action: 'delete-own',
          id: 'second',
          ownerUid: 'bob',
        })
      ).status,
      400,
    );
  } finally {
    delete users.unverified;
  }
});

test('delete-own retains cleanup pointers when photo cleanup fails and retries safely', async () => {
  let offline = true;
  const world = createWorld({
    r2: async () => {
      if (offline) throw new Error('Offline');
    },
  });
  world.rows('lifemate_shared_memories').push({
    owner_uid: 'alice',
    id: 'photo',
    status: 'active',
    photo_path: 'shared/alice/photo/photo.jpg',
    photo_backend: 'r2',
    supabase_cleanup_pending: true,
  });
  assert.equal(
    (await world.call('alice', { action: 'delete-own', id: 'photo' })).status,
    503,
  );
  assert.equal(world.rows('lifemate_shared_memories').length, 0);
  assert.equal(
    world.rows('lifemate_memory_deletions')[0].photo_path,
    'shared/alice/photo/photo.jpg',
  );
  offline = false;
  assert.equal(
    (await world.call('alice', { action: 'delete-own', id: 'photo' })).status,
    200,
  );
  assert.equal(world.rows('lifemate_memory_deletions')[0].photo_path, null);
  assert.equal(world.rows('lifemate_memory_deletions').length, 1);
});

function seedSharedPhoto(world) {
  world.rows('lifemate_shared_memories').push({
    owner_uid: 'alice',
    id: 'race',
    date_key: '2026-10-01',
    body: 'Private text',
    photo_path: 'shared/alice/race/photo.jpg',
    photo_backend: 'r2',
    photo_size_bytes: 100,
    status: 'active',
    updated_at: '2026-10-01T00:00:00Z',
  });
}

test('revokes before deleting photos so concurrent confirmation and publishing cannot restore sharing', async () => {
  let confirmation, publication, duplicate;
  let deleting = false;
  const world = createWorld({
    r2: async (action) => {
      if (action === 'head')
        return { contentType: 'image/jpeg', sizeBytes: 100 };
      if (action === 'delete' && !deleting) {
        deleting = true;
        confirmation = await world.call('alice', {
          action: 'confirm',
          id: 'race',
        });
        publication = await world.call('alice', {
          action: 'publish',
          id: 'race',
          dateKey: '2026-10-01',
          text: 'New',
          hasPhoto: false,
        });
        duplicate = await world.call('alice', {
          action: 'unshare',
          id: 'race',
        });
      }
    },
  });
  seedSharedPhoto(world);
  assert.deepEqual(
    await world.call('alice', { action: 'unshare', id: 'race' }),
    { status: 200, body: { shared: false } },
  );
  assert.equal(confirmation.status, 409);
  assert.equal(publication.body.code, 'memory-revoking');
  assert.equal(duplicate.body.code, 'memory-revoking');
  assert.equal(world.rows('lifemate_shared_memories').length, 0);
});

test('keeps failed cleanup private and retryable after lease expiry', async () => {
  let fail = true;
  const world = createWorld({
    r2: async () => {
      if (fail) throw new Error('Storage unavailable');
    },
  });
  seedSharedPhoto(world);
  assert.equal(
    (await world.call('alice', { action: 'unshare', id: 'race' })).status,
    503,
  );
  const row = world.rows('lifemate_shared_memories')[0];
  assert.equal(row.status, 'revoking');
  assert.equal(row.photo_path, 'shared/alice/race/photo.jpg');
  assert.equal(
    (await world.call('alice', { action: 'unshare', id: 'race' })).status,
    409,
  );
  row.revoke_until = new Date(0).toISOString();
  fail = false;
  assert.equal(
    (await world.call('alice', { action: 'unshare', id: 'race' })).status,
    200,
  );
  assert.equal(world.rows('lifemate_shared_memories').length, 0);
  assert.equal(
    (await world.call('alice', { action: 'unshare', id: 'race' })).status,
    200,
  );
});

test('an expired revocation worker does not delete external objects', async () => {
  let deletes = 0;
  const world = createWorld({
    afterClaim: (row) => {
      row.revoke_until = new Date(0).toISOString();
    },
    r2: async () => {
      deletes++;
    },
  });
  seedSharedPhoto(world);
  assert.equal(
    (await world.call('alice', { action: 'unshare', id: 'race' })).status,
    409,
  );
  assert.equal(deletes, 0);
  assert.equal(world.rows('lifemate_shared_memories')[0].status, 'revoking');
});

test('an old confirmation cannot activate a later reservation after revocation', async () => {
  let world;
  world = createWorld({
    r2: async (action) => {
      if (action === 'head') {
        assert.equal(
          (await world.call('alice', { action: 'unshare', id: 'race' })).status,
          200,
        );
        assert.equal(
          (
            await world.call('alice', {
              action: 'publish',
              id: 'race',
              dateKey: '2026-10-01',
              text: 'New reservation',
              hasPhoto: true,
              sizeBytes: 100,
            })
          ).status,
          200,
        );
        world.rows('lifemate_shared_memories')[0].updated_at =
          '2026-10-01T00:00:00Z';
        return { contentType: 'image/jpeg', sizeBytes: 100 };
      }
      return 'signed';
    },
  });
  seedSharedPhoto(world);
  world.rows('lifemate_shared_memories')[0].status = 'pending';
  assert.equal(
    (await world.call('alice', { action: 'confirm', id: 'race' })).status,
    409,
  );
  assert.equal(world.rows('lifemate_shared_memories')[0].status, 'pending');
});

test('an obsolete cleanup token cannot remove a row reclaimed by another worker', async () => {
  let world;
  world = createWorld({
    r2: async () => {
      world.rows('lifemate_shared_memories')[0].revoke_token =
        'new-worker-token';
    },
  });
  seedSharedPhoto(world);
  assert.equal(
    (await world.call('alice', { action: 'unshare', id: 'race' })).status,
    409,
  );
  assert.equal(
    world.rows('lifemate_shared_memories')[0].revoke_token,
    'new-worker-token',
  );
});

test('a pending publication retry does not delete an object from a later publication', async () => {
  let deletes = 0;
  const world = createWorld({
    r2: async (action) => {
      if (action === 'delete') deletes++;
      return 'signed';
    },
  });
  seedSharedPhoto(world);
  const row = world.rows('lifemate_shared_memories')[0];
  row.status = 'pending';
  const oldToken = row.reservation_token;
  assert.equal(
    (
      await world.call('alice', {
        action: 'publish',
        id: 'race',
        dateKey: '2026-10-01',
        text: 'Retry',
        hasPhoto: true,
        sizeBytes: 100,
      })
    ).status,
    200,
  );
  assert.equal(deletes, 0);
  assert.notEqual(row.reservation_token, oldToken);
});

test('pending legacy publication retries retain the Supabase cleanup pointer', async () => {
  const world = createWorld();
  seedSharedPhoto(world);
  const row = world.rows('lifemate_shared_memories')[0];
  row.status = 'pending';
  row.photo_backend = 'supabase';
  assert.equal(
    (
      await world.call('alice', {
        action: 'publish',
        id: 'race',
        dateKey: '2026-10-01',
        text: 'Retry',
        hasPhoto: true,
        sizeBytes: 100,
      })
    ).status,
    200,
  );
  assert.equal(row.photo_backend, 'r2');
  assert.equal(row.supabase_cleanup_pending, true);
  assert.equal(
    (
      await world.call('alice', {
        action: 'publish',
        id: 'race',
        dateKey: '2026-10-01',
        text: 'Text only',
        hasPhoto: false,
      })
    ).body.code,
    'memory-pending',
  );
});

test('a publish paused after its pending GET cannot delete a later confirmed publication', async () => {
  let entered;
  const paused = new Promise((resolve) => {
    entered = resolve;
  });
  let resume;
  const gate = new Promise((resolve) => {
    resume = resolve;
  });
  let first = true;
  let photoExists = true;
  const world = createWorld({
    afterMemoryRead: async (query) => {
      if (
        first &&
        query.select ===
          'id,status,photo_path,photo_backend,supabase_cleanup_pending'
      ) {
        first = false;
        entered();
        await gate;
      }
    },
    r2: async (action) => {
      if (action === 'delete') photoExists = false;
      if (action === 'head')
        return photoExists
          ? { contentType: 'image/jpeg', sizeBytes: 100 }
          : null;
      return 'signed';
    },
  });
  seedSharedPhoto(world);
  world.rows('lifemate_shared_memories')[0].status = 'pending';
  const publish = {
    action: 'publish',
    id: 'race',
    dateKey: '2026-10-01',
    text: 'Later publication',
    hasPhoto: true,
    sizeBytes: 100,
  };
  const oldRequest = world.call('alice', publish);
  await paused;
  assert.equal(
    (await world.call('alice', { action: 'unshare', id: 'race' })).status,
    200,
  );
  assert.equal((await world.call('alice', publish)).status, 200);
  photoExists = true; // New native upload completes before confirmation.
  assert.equal(
    (await world.call('alice', { action: 'confirm', id: 'race' })).status,
    200,
  );
  resume();
  assert.equal((await oldRequest).body.code, 'already-shared');
  assert.equal(photoExists, true);
  assert.equal(world.rows('lifemate_shared_memories')[0].status, 'active');
});

test('text publication with an earlier empty GET cannot erase a newly reserved photo', async () => {
  let entered, resume;
  const paused = new Promise((resolve) => {
    entered = resolve;
  });
  const gate = new Promise((resolve) => {
    resume = resolve;
  });
  let first = true;
  const world = createWorld({
    afterMemoryRead: async (query) => {
      if (
        first &&
        query.select ===
          'id,status,photo_path,photo_backend,supabase_cleanup_pending'
      ) {
        first = false;
        entered();
        await gate;
      }
    },
  });
  const publish = {
    action: 'publish',
    id: 'race',
    dateKey: '2026-10-01',
    text: 'Fixture',
    hasPhoto: false,
  };
  const text = world.call('alice', publish);
  await paused;
  assert.equal(
    (await world.call('alice', { ...publish, hasPhoto: true, sizeBytes: 100 }))
      .status,
    200,
  );
  resume();
  assert.equal((await text).body.code, 'memory-pending');
  assert.equal(
    world.rows('lifemate_shared_memories')[0].photo_path,
    'shared/alice/race/photo.jpg',
  );
  assert.equal(world.rows('lifemate_shared_memories')[0].status, 'pending');
});

test('a delayed lease-check response cannot start cleanup after expiry', async () => {
  let deletes = 0;
  const world = createWorld({
    afterMemoryRead: (query, result) => {
      if (query.select === 'revoke_until' && result[0])
        result[0].revoke_until = new Date(0).toISOString();
    },
    r2: async () => {
      deletes++;
    },
  });
  seedSharedPhoto(world);
  assert.equal(
    (await world.call('alice', { action: 'unshare', id: 'race' })).status,
    409,
  );
  assert.equal(deletes, 0);
});

function seedLegacyPhoto(world) {
  seedSharedPhoto(world);
  Object.assign(world.rows('lifemate_shared_memories')[0], {
    photo_backend: 'supabase',
    reservation_token: crypto.randomUUID(),
  });
}

test('migration blocks revocation and deletion until its object write has finished', async () => {
  let entered, resume;
  const paused = new Promise((resolve) => {
    entered = resolve;
  });
  const gate = new Promise((resolve) => {
    resume = resolve;
  });
  let photo;
  const world = createWorld({
    r2: async (action, path, source, reservation) => {
      if (action === 'copy') {
        entered();
        await gate;
        photo = {
          sizeBytes: 100,
          contentType: 'image/jpeg',
          migrationReservation: reservation,
        };
        return 100;
      }
      if (action === 'head') return photo;
    },
  });
  seedLegacyPhoto(world);
  const migrating = world.call('alice', { action: 'migrate', id: 'race' });
  await paused;
  for (const action of ['unshare', 'delete-own']) {
    assert.equal(
      (await world.call('alice', { action, id: 'race' })).status,
      409,
    );
    assert.equal(world.rows('lifemate_shared_memories').length, 1);
    assert.equal(world.rows('lifemate_memory_deletions').length, 0);
  }
  resume();
  assert.equal((await migrating).body.migrated, true);
  assert.equal(world.rows('lifemate_shared_memories')[0].photo_backend, 'r2');
  assert.equal(world.rows('lifemate_shared_memories')[0].migration_token, null);
  assert.equal(
    (await world.call('alice', { action: 'unshare', id: 'race' })).status,
    200,
  );
});

test('migration rejects a stale source snapshot before starting an R2 copy', async () => {
  let world,
    first = true,
    copies = 0;
  world = createWorld({
    afterMemoryRead: (query) => {
      if (first && query.select.includes('reservation_token')) {
        first = false;
        world.rows('lifemate_shared_memories')[0].reservation_token =
          crypto.randomUUID();
      }
    },
    r2: async (action) => {
      if (action === 'copy') copies++;
    },
  });
  seedLegacyPhoto(world);
  assert.equal(
    (await world.call('alice', { action: 'migrate', id: 'race' })).body
      .migrated,
    false,
  );
  assert.equal(copies, 0);
});

test('migration recovers its own successful copy after a lost SQL acknowledgment and lease expiry', async () => {
  let photo,
    failPatch = true;
  const reservations = [];
  const world = createWorld({
    beforeMemoryPatch: (_query, body) => {
      if (body.photo_backend === 'r2' && failPatch) {
        failPatch = false;
        throw Error('Lost SQL request');
      }
    },
    r2: async (action, _path, _source, reservation) => {
      if (action === 'copy') {
        reservations.push(reservation);
        if (photo) assert.equal(photo.migrationReservation, reservation);
        else
          photo = {
            sizeBytes: 100,
            contentType: 'image/jpeg',
            migrationReservation: reservation,
          };
        return 100;
      }
      if (action === 'head') return photo;
      if (action === 'delete')
        assert.fail('migration must never delete the R2 destination');
    },
  });
  seedLegacyPhoto(world);
  assert.equal(
    (await world.call('alice', { action: 'migrate', id: 'race' })).status,
    503,
  );
  const row = world.rows('lifemate_shared_memories')[0];
  assert.equal(row.photo_backend, 'supabase');
  assert.equal(
    (await world.call('alice', { action: 'unshare', id: 'race' })).status,
    409,
  );
  row.migration_until = new Date(0).toISOString();
  assert.equal(
    (await world.call('alice', { action: 'migrate', id: 'race' })).body
      .migrated,
    true,
  );
  assert.equal(row.photo_backend, 'r2');
  assert.deepEqual(reservations, [
    row.reservation_token,
    row.reservation_token,
  ]);
});

test('an expired migration cannot overwrite or activate a later R2 publication', async () => {
  let entered, resume, photo;
  const paused = new Promise((resolve) => {
    entered = resolve;
  });
  const gate = new Promise((resolve) => {
    resume = resolve;
  });
  const world = createWorld({
    r2: async (action) => {
      if (action === 'copy') {
        entered();
        await gate;
        // Atomic R2 IfNoneMatch protects writes even after SQL lease expiry.
        if (photo) throw Error('PreconditionFailed');
        photo = { contentType: 'image/jpeg', sizeBytes: 100, bytes: 'old' };
        return 100;
      }
      if (action === 'head') return photo;
      return 'signed';
    },
  });
  seedLegacyPhoto(world);
  const migrating = world.call('alice', { action: 'migrate', id: 'race' });
  await paused;
  world.rows('lifemate_shared_memories')[0].migration_until = new Date(
    0,
  ).toISOString();
  assert.equal(
    (await world.call('alice', { action: 'unshare', id: 'race' })).status,
    200,
  );
  assert.equal(
    (
      await world.call('alice', {
        action: 'publish',
        id: 'race',
        dateKey: '2026-10-01',
        text: 'New image',
        hasPhoto: true,
        sizeBytes: 100,
      })
    ).status,
    200,
  );
  photo = { contentType: 'image/jpeg', sizeBytes: 100, bytes: 'new' };
  assert.equal(
    (await world.call('alice', { action: 'confirm', id: 'race' })).status,
    200,
  );
  const reservation = world.rows('lifemate_shared_memories')[0]
    .reservation_token;
  resume();
  assert.equal((await migrating).status, 503);
  assert.equal(photo.bytes, 'new');
  const current = world.rows('lifemate_shared_memories')[0];
  assert.equal(current.reservation_token, reservation);
  assert.equal(current.status, 'active');
  assert.equal(current.photo_backend, 'r2');
});
