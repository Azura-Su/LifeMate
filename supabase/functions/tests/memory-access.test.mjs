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

function createWorld() {
  const tables = new Map();
  const rows = (table) => {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table);
  };
  const calls = [];
  async function database(table, method, query = {}, body) {
    calls.push({ table, method, query, body });
    if (table === 'rpc/claim_lifemate_memory_email_invites') return null;
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
      return list
        .filter((row) => matches(row, query))
        .slice(offset, offset + Number(query.limit ?? 1000));
    }
    if (method === 'POST') {
      const row = { created_at: new Date().toISOString(), ...body };
      list.push(row);
      return [row];
    }
    if (method === 'PATCH') {
      const changed = list.filter((row) => matches(row, query));
      for (const row of changed) Object.assign(row, body);
      return changed;
    }
    if (method === 'DELETE') {
      tables.set(
        table,
        list.filter((row) => !matches(row, query)),
      );
      return [];
    }
    throw new Error(`Unsupported ${method}`);
  }
  const storage = async (action, path) => `supabase:${action}:${path}`;
  const r2 = async (action, path) => `r2:${action}:${path}`;
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
    (call) => call.table === 'lifemate_shared_memories',
  );
  const hideIndex = memoryCalls.findIndex(
    (call) => call.method === 'PATCH' && call.body.status === 'pending',
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
