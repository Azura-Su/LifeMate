const ID = /^[A-Za-z0-9_-]{1,128}$/;
const PRIVATE_ACTIONS = ['private-upload', 'private-head', 'private-download'];
const PHOTO = /^[A-Za-z0-9_-]{1,128}\.(jpg|jpeg|png|webp|heic|heif|gif)$/;
const PHOTO_TYPES = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
  heic: 'heic',
  heif: 'heif',
  gif: 'gif',
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 8192;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PROFILES = 'lifemate_memory_profiles';
const REQUESTS = 'lifemate_memory_friend_requests';
const EMAIL_INVITES = 'lifemate_memory_email_invites';
const FRIENDS = 'lifemate_memory_friendships';
const MEMORIES = 'lifemate_shared_memories';
const json = (status, value) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

async function readInput(request) {
  if (!request.body) throw new Error('Missing body');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error('Body too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const input = JSON.parse(new TextDecoder().decode(bytes));
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid input');
  const allowed = {
    'private-upload': ['action', 'id', 'fileName', 'sizeBytes'],
    'private-head': ['action', 'id', 'fileName'],
    'private-download': ['action', 'id', 'fileName'],
    state: ['action', 'displayName'],
    invite: ['action', 'displayName', 'email'],
    accept: ['action', 'displayName', 'uid'],
    decline: ['action', 'displayName', 'uid'],
    cancel: ['action', 'displayName', 'email'],
    'remove-friend': ['action', 'displayName', 'uid'],
    feed: ['action', 'displayName', 'offset'],
    photo: ['action', 'displayName', 'ownerUid', 'id'],
    publish: [
      'action',
      'displayName',
      'id',
      'dateKey',
      'text',
      'hasPhoto',
      'sizeBytes',
    ],
    confirm: ['action', 'displayName', 'id'],
    unshare: ['action', 'displayName', 'id'],
    'delete-own': ['action', 'displayName', 'id'],
    migrate: ['action', 'displayName', 'id'],
  };
  if (
    typeof input.action !== 'string' ||
    !allowed[input.action] ||
    Object.keys(input).some((key) => !allowed[input.action].includes(key)) ||
    (!PRIVATE_ACTIONS.includes(input.action) &&
      (typeof input.displayName !== 'string' ||
        !input.displayName.trim() ||
        input.displayName.trim().length > 60 ||
        /[\u0000-\u001f\u007f]/.test(input.displayName)))
  )
    throw new Error('Invalid input');
  return PRIVATE_ACTIONS.includes(input.action)
    ? input
    : { ...input, displayName: input.displayName.trim() };
}

function validDateKey(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const date = new Date(`${key}T00:00:00Z`);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === key &&
    key <= tomorrow
  );
}

function friendPair(a, b) {
  return a < b ? { left_uid: a, right_uid: b } : { left_uid: b, right_uid: a };
}

export function createHandler({ verifyIdentity, database, storage, r2 }) {
  const photoStorage = (backend, action, path, sizeBytes) =>
    backend === 'r2' ? r2(action, path, sizeBytes) : storage(action, path);
  async function finishSupabaseCleanup(uid, id, path) {
    await storage('delete', path);
    await database(
      MEMORIES,
      'PATCH',
      {
        owner_uid: `eq.${uid}`,
        id: `eq.${id}`,
        photo_backend: 'eq.r2',
        photo_path: `eq.${path}`,
        supabase_cleanup_pending: 'eq.true',
      },
      { supabase_cleanup_pending: false },
    );
  }
  async function profile(identity, displayName) {
    const found = await database(PROFILES, 'GET', {
      uid: `eq.${identity.uid}`,
      select: 'uid,email,display_name',
      limit: 1,
    });
    if (!found.length) {
      const created = await database(
        PROFILES,
        'POST',
        {},
        {
          uid: identity.uid,
          email: identity.email,
          display_name: displayName,
        },
      );
      return created[0];
    }
    if (
      found[0].email !== identity.email ||
      found[0].display_name !== displayName
    ) {
      const updated = await database(
        PROFILES,
        'PATCH',
        { uid: `eq.${identity.uid}` },
        { email: identity.email, display_name: displayName },
      );
      return updated[0];
    }
    return found[0];
  }

  async function relationships(uid) {
    const [incoming, outgoing, emailInvites, pairs] = await Promise.all([
      database(REQUESTS, 'GET', {
        target_uid: `eq.${uid}`,
        select: 'requester_uid,created_at',
        limit: 21,
      }),
      database(REQUESTS, 'GET', {
        requester_uid: `eq.${uid}`,
        select: 'target_uid,created_at',
        limit: 21,
      }),
      database(EMAIL_INVITES, 'GET', {
        requester_uid: `eq.${uid}`,
        select: 'target_email,created_at',
        limit: 21,
      }),
      database(FRIENDS, 'GET', {
        or: `(left_uid.eq.${uid},right_uid.eq.${uid})`,
        select: 'left_uid,right_uid,created_at',
        limit: 101,
      }),
    ]);
    const friendUids = pairs.map((pair) =>
      pair.left_uid === uid ? pair.right_uid : pair.left_uid,
    );
    const peerUids = [
      ...new Set([
        ...friendUids,
        ...incoming.map((row) => row.requester_uid),
        ...outgoing.map((row) => row.target_uid),
      ]),
    ];
    const peers = peerUids.length
      ? await database(PROFILES, 'GET', {
          uid: `in.(${peerUids.join(',')})`,
          select: 'uid,email,display_name',
          limit: 150,
        })
      : [];
    const byUid = new Map(peers.map((row) => [row.uid, row]));
    const person = (peerUid) => ({
      uid: peerUid,
      email: byUid.get(peerUid)?.email ?? '',
      name: byUid.get(peerUid)?.display_name ?? 'Người dùng',
    });
    return {
      friends: friendUids.map(person),
      incoming: incoming.map((row) => person(row.requester_uid)),
      outgoing: [
        ...new Set([
          ...outgoing
            .map((row) => byUid.get(row.target_uid)?.email)
            .filter(Boolean),
          ...emailInvites.map((row) => row.target_email),
        ]),
      ].map((email) => ({ email })),
    };
  }

  async function handle(identity, input) {
    const uid = identity.uid;
    if (PRIVATE_ACTIONS.includes(input.action)) {
      if (
        !ID.test(uid) ||
        typeof input.id !== 'string' ||
        !ID.test(input.id) ||
        typeof input.fileName !== 'string' ||
        !PHOTO.test(input.fileName) ||
        (input.action === 'private-upload' &&
          (!Number.isSafeInteger(input.sizeBytes) ||
            input.sizeBytes < 1 ||
            input.sizeBytes > 15728640))
      )
        return json(400, { code: 'invalid-private-photo' });
      const path = `private/${uid}/${input.id}/${input.fileName}`;
      const contentType = `image/${PHOTO_TYPES[input.fileName.split('.').at(-1)]}`;
      const photo = await r2('head', path);
      if (
        photo &&
        (!Number.isSafeInteger(photo.sizeBytes) ||
          photo.sizeBytes < 1 ||
          photo.sizeBytes > 15728640 ||
          photo.contentType !== contentType ||
          (input.action === 'private-upload' &&
            photo.sizeBytes !== input.sizeBytes))
      )
        return json(409, { code: 'private-photo-mismatch' });
      if (input.action === 'private-upload' && !photo)
        return json(200, {
          uploadUrl: await r2('upload', path, input.sizeBytes),
        });
      if (input.action === 'private-download' && photo)
        return json(200, {
          photo: { sizeBytes: photo.sizeBytes },
          downloadUrl: await r2('download', path),
        });
      return json(200, {
        photo: photo ? { sizeBytes: photo.sizeBytes } : null,
      });
    }
    if (input.action === 'delete-own' || input.action === 'unshare') {
      if (typeof input.id !== 'string' || !ID.test(input.id))
        return json(400, { code: 'invalid-memory' });
      if (input.action === 'delete-own') {
        const row = await database(
          'rpc/tombstone_lifemate_shared_memory',
          'POST',
          {},
          {
            p_owner_uid: uid,
            p_id: input.id,
          },
        );
        if (row.busy) return json(409, { code: 'memory-migrating' });
        if (row.photo_path)
          await photoStorage(row.photo_backend, 'delete', row.photo_path);
        if (row.supabase_cleanup_pending)
          await storage('delete', row.photo_path);
        await database(
          'lifemate_memory_deletions',
          'PATCH',
          { owner_uid: `eq.${uid}`, id: `eq.${input.id}` },
          {
            photo_path: null,
            photo_backend: null,
            supabase_cleanup_pending: false,
          },
        );
        return json(200, { shared: false });
      }
      const token = crypto.randomUUID();
      const deleting = await database(
        'rpc/claim_lifemate_memory_revocation',
        'POST',
        {},
        {
          p_owner_uid: uid,
          p_id: input.id,
          p_token: token,
        },
      );
      if (deleting.missing) return json(200, { shared: false });
      if (deleting.busy)
        return json(409, {
          code: deleting.migrating ? 'memory-migrating' : 'memory-revoking',
        });
      // A delayed claim response must not start cleanup after its lease expired
      // or another worker took ownership. Leave time for the bounded storage call.
      const ownsLease = async () => {
        const rows = await database(MEMORIES, 'GET', {
          owner_uid: `eq.${uid}`,
          id: `eq.${input.id}`,
          status: 'eq.revoking',
          revoke_token: `eq.${token}`,
          revoke_until: `gte.${new Date(Date.now() + 30000).toISOString()}`,
          select: 'revoke_until',
          limit: 1,
        });
        return (
          rows.length > 0 &&
          Date.parse(rows[0].revoke_until) > Date.now() + 30000
        );
      };
      if (deleting.photo_path) {
        if (!(await ownsLease())) return json(409, { code: 'memory-revoking' });
        await photoStorage(
          deleting.photo_backend,
          'delete',
          deleting.photo_path,
        );
      }
      if (deleting.supabase_cleanup_pending) {
        if (!(await ownsLease())) return json(409, { code: 'memory-revoking' });
        await storage('delete', deleting.photo_path);
      }
      // Failures retain both lease and cleanup pointers. A timeout is ambiguous:
      // do not allow a republish while an earlier storage DELETE could be in flight.
      const removed = await database(MEMORIES, 'DELETE', {
        owner_uid: `eq.${uid}`,
        id: `eq.${input.id}`,
        status: 'eq.revoking',
        revoke_token: `eq.${token}`,
        revoke_until: `gte.${new Date().toISOString()}`,
      });
      if (!removed.length) {
        const current = await database(MEMORIES, 'GET', {
          owner_uid: `eq.${uid}`,
          id: `eq.${input.id}`,
          select: 'id',
          limit: 1,
        });
        if (current.length) return json(409, { code: 'memory-revoking' });
      }
      return json(200, { shared: false });
    }
    // State refresh owns profile/invite maintenance. Photo reads and upload
    // confirmation authorize independently and need no extra profile writes.
    if (!['feed', 'photo', 'confirm'].includes(input.action)) {
      await profile(identity, input.displayName);
      await database(
        'rpc/claim_lifemate_memory_email_invites',
        'POST',
        {},
        {
          p_uid: uid,
          p_email: identity.email,
        },
      );
    }
    if (input.action === 'state') {
      const [people, shares] = await Promise.all([
        relationships(uid),
        database(MEMORIES, 'GET', {
          owner_uid: `eq.${uid}`,
          select: 'id,status,photo_backend,photo_path,supabase_cleanup_pending',
          order: 'id.asc',
          limit: 101,
        }),
      ]);
      return json(200, {
        email: identity.email,
        ...people,
        sharedIds: shares
          .filter((row) => row.status === 'active')
          .map((row) => row.id),
        legacyIds: shares
          .filter(
            (row) =>
              row.photo_path &&
              ((row.status === 'active' && row.photo_backend === 'supabase') ||
                row.supabase_cleanup_pending),
          )
          .map((row) => row.id),
      });
    }
    if (input.action === 'invite') {
      const email =
        typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      if (!EMAIL.test(email) || email.length > 254)
        return json(400, { code: 'invalid-email' });
      if (email === identity.email) return json(400, { code: 'self-invite' });
      const result = await database(
        'rpc/invite_lifemate_memory_friend',
        'POST',
        {},
        {
          p_uid: uid,
          p_email: email,
        },
      );
      return result.limited
        ? json(429, { code: 'invite-limit' })
        : json(200, { sent: true });
    }
    if (input.action === 'cancel') {
      const email =
        typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      if (!EMAIL.test(email) || email.length > 254)
        return json(400, { code: 'invalid-email' });
      await database(EMAIL_INVITES, 'DELETE', {
        requester_uid: `eq.${uid}`,
        target_email: `eq.${email}`,
      });
      const target = await database(PROFILES, 'GET', {
        email: `eq.${email}`,
        select: 'uid',
        limit: 1,
      });
      if (target.length)
        await database(REQUESTS, 'DELETE', {
          requester_uid: `eq.${uid}`,
          target_uid: `eq.${target[0].uid}`,
        });
      return json(200, { done: true });
    }
    if (['accept', 'decline', 'remove-friend'].includes(input.action)) {
      if (
        typeof input.uid !== 'string' ||
        !ID.test(input.uid) ||
        input.uid === uid
      )
        return json(400, { code: 'invalid-friend' });
      if (input.action === 'accept') {
        const result = await database(
          'rpc/accept_lifemate_memory_friend_request',
          'POST',
          {},
          {
            p_target_uid: uid,
            p_requester_uid: input.uid,
          },
        );
        return result === true
          ? json(200, { accepted: true })
          : json(404, { code: 'invite-not-found' });
      }
      if (input.action === 'remove-friend') {
        const pair = friendPair(uid, input.uid);
        await database(
          FRIENDS,
          'DELETE',
          Object.fromEntries(
            Object.entries(pair).map(([k, v]) => [k, `eq.${v}`]),
          ),
        );
      } else
        await database(REQUESTS, 'DELETE', {
          requester_uid: `eq.${input.uid}`,
          target_uid: `eq.${uid}`,
        });
      return json(200, { done: true });
    }
    if (input.action === 'feed') {
      const offset = input.offset === undefined ? 0 : input.offset;
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000)
        return json(400, { code: 'invalid-page' });
      const people = await relationships(uid);
      if (!people.friends.length)
        return json(200, { items: [], nextOffset: null });
      const friendUids = people.friends.map((person) => person.uid);
      const rows = await database(MEMORIES, 'GET', {
        owner_uid: `in.(${friendUids.join(',')})`,
        status: 'eq.active',
        select:
          'id,owner_uid,date_key,body,photo_path,photo_backend,created_at',
        order: 'date_key.desc,created_at.desc,owner_uid.asc,id.asc',
        limit: 31,
        offset,
      });
      const byUid = new Map(
        people.friends.map((person) => [person.uid, person]),
      );
      const items = await Promise.all(
        rows.slice(0, 30).map(async (row) => ({
          id: row.id,
          ownerId: row.owner_uid,
          ownerName: byUid.get(row.owner_uid)?.name ?? 'Người dùng',
          dateKey: row.date_key,
          sharedAt: row.created_at,
          text: row.body,
          photoUrl: row.photo_path
            ? await photoStorage(row.photo_backend, 'download', row.photo_path)
            : null,
        })),
      );
      return json(200, {
        items,
        nextOffset: rows.length > 30 ? offset + 30 : null,
      });
    }
    if (input.action === 'photo') {
      if (
        typeof input.ownerUid !== 'string' ||
        !ID.test(input.ownerUid) ||
        input.ownerUid === uid ||
        typeof input.id !== 'string' ||
        !ID.test(input.id)
      )
        return json(400, { code: 'invalid-memory' });
      const pair = friendPair(uid, input.ownerUid);
      const friendship = await database(FRIENDS, 'GET', {
        left_uid: `eq.${pair.left_uid}`,
        right_uid: `eq.${pair.right_uid}`,
        select: 'left_uid',
        limit: 1,
      });
      if (!friendship.length) return json(404, { code: 'photo-not-found' });
      const memory = await database(MEMORIES, 'GET', {
        owner_uid: `eq.${input.ownerUid}`,
        id: `eq.${input.id}`,
        status: 'eq.active',
        select: 'photo_path,photo_backend',
        limit: 1,
      });
      if (!memory[0]?.photo_path) return json(404, { code: 'photo-not-found' });
      return json(200, {
        photoUrl: await photoStorage(
          memory[0].photo_backend,
          'download',
          memory[0].photo_path,
        ),
      });
    }
    if (input.action === 'publish') {
      if (
        typeof input.id !== 'string' ||
        !ID.test(input.id) ||
        !validDateKey(input.dateKey) ||
        typeof input.text !== 'string' ||
        input.text.length > 2000 ||
        typeof input.hasPhoto !== 'boolean' ||
        (!input.text.trim() && !input.hasPhoto) ||
        (input.hasPhoto &&
          (!Number.isSafeInteger(input.sizeBytes) ||
            input.sizeBytes < 1 ||
            input.sizeBytes > MAX_PHOTO_BYTES)) ||
        (!input.hasPhoto && input.sizeBytes !== undefined)
      )
        return json(400, { code: 'invalid-memory' });
      const existing = await database(MEMORIES, 'GET', {
        owner_uid: `eq.${uid}`,
        id: `eq.${input.id}`,
        select: 'id,status,photo_path,photo_backend,supabase_cleanup_pending',
        limit: 1,
      });
      if (existing[0]?.status === 'revoking')
        return json(409, { code: 'memory-revoking' });
      if (existing[0]?.status === 'active')
        return json(409, { code: 'already-shared' });
      // Retried R2 PUTs replace the same pending object. Deleting here from an
      // earlier GET could outlive revocation and delete a later publication.
      if (
        existing[0]?.status === 'pending' &&
        existing[0].photo_path &&
        !input.hasPhoto
      )
        return json(409, { code: 'memory-pending' });
      const photoPath = input.hasPhoto
        ? `shared/${uid}/${input.id}/photo.jpg`
        : null;
      const row = {
        owner_uid: uid,
        id: input.id,
        date_key: input.dateKey,
        body: input.text.trim(),
        photo_path: photoPath,
        photo_backend: 'r2',
        photo_size_bytes: input.hasPhoto ? input.sizeBytes : null,
        supabase_cleanup_pending: false,
        status: input.hasPhoto ? 'pending' : 'active',
        updated_at: new Date().toISOString(),
      };
      const outcome = await database(
        'rpc/reserve_lifemate_shared_memory',
        'POST',
        {},
        { p_memory: row },
      );
      if (outcome === 'memory-pending')
        return json(409, { code: 'memory-pending' });
      if (outcome === 'memory-deleted')
        return json(409, { code: 'memory-deleted' });
      if (outcome === 'memory-revoking')
        return json(409, { code: 'memory-revoking' });
      if (outcome === 'already-shared')
        return json(409, { code: 'already-shared' });
      if (outcome === 'memory-limit')
        return json(429, { code: 'memory-limit' });
      if (outcome !== 'saved') throw new Error('Unexpected reservation result');
      return json(
        200,
        input.hasPhoto
          ? {
              uploadUrl: await r2('upload', photoPath, input.sizeBytes),
              shared: false,
            }
          : { shared: true },
      );
    }
    if (input.action === 'migrate') {
      if (typeof input.id !== 'string' || !ID.test(input.id))
        return json(400, { code: 'invalid-memory' });
      const rows = await database(MEMORIES, 'GET', {
        owner_uid: `eq.${uid}`,
        id: `eq.${input.id}`,
        select:
          'status,photo_path,photo_backend,supabase_cleanup_pending,reservation_token',
        limit: 1,
      });
      const row = rows[0];
      const path = row?.photo_path;
      if (!path) return json(200, { migrated: false });
      if (row.photo_backend === 'r2') {
        if (!row.supabase_cleanup_pending)
          return json(200, { migrated: false });
        await finishSupabaseCleanup(uid, input.id, path);
        return json(200, { migrated: true });
      }
      if (row.status !== 'active') return json(200, { migrated: false });
      if (row.photo_backend !== 'supabase')
        return json(409, { code: 'invalid-memory' });
      const token = crypto.randomUUID();
      const claim = await database(
        'rpc/claim_lifemate_memory_migration',
        'POST',
        {},
        {
          p_owner_uid: uid,
          p_id: input.id,
          p_expected_token: row.reservation_token,
          p_token: token,
        },
      );
      if (claim.missing) return json(200, { migrated: false });
      if (claim.busy) return json(409, { code: 'memory-migrating' });
      // Check ownership again after the claim response; leave time for the
      // bounded source download, conditional PUT and destination verification.
      const owned = await database(MEMORIES, 'GET', {
        owner_uid: `eq.${uid}`,
        id: `eq.${input.id}`,
        status: 'eq.active',
        photo_backend: 'eq.supabase',
        photo_path: `eq.${path}`,
        reservation_token: `eq.${row.reservation_token}`,
        migration_token: `eq.${token}`,
        migration_until: `gte.${new Date(Date.now() + 120000).toISOString()}`,
        select: 'migration_until',
        limit: 1,
      });
      if (
        !owned.length ||
        Date.parse(owned[0].migration_until) <= Date.now() + 120000
      )
        return json(409, { code: 'memory-migrating' });
      const source = await storage('download', path);
      // IfNoneMatch is also enforced by the adapter, protecting a later upload
      // even if this worker's network request outlives its SQL lease.
      const sizeBytes = await r2('copy', path, source, row.reservation_token);
      const verified = await r2('head', path);
      if (
        !verified ||
        verified.sizeBytes !== sizeBytes ||
        verified.contentType !== 'image/jpeg'
      ) {
        return json(503, { code: 'photo-not-ready' });
      }
      const changed = await database(
        MEMORIES,
        'PATCH',
        {
          owner_uid: `eq.${uid}`,
          id: `eq.${input.id}`,
          status: 'eq.active',
          photo_backend: 'eq.supabase',
          photo_path: `eq.${path}`,
          reservation_token: `eq.${row.reservation_token}`,
          migration_token: `eq.${token}`,
          migration_until: `gte.${new Date().toISOString()}`,
        },
        {
          photo_backend: 'r2',
          photo_size_bytes: sizeBytes,
          supabase_cleanup_pending: true,
          migration_token: null,
          migration_until: null,
        },
      );
      if (!changed.length) {
        return json(200, { migrated: false });
      }
      await finishSupabaseCleanup(uid, input.id, path);
      return json(200, { migrated: true });
    }
    if (input.action === 'confirm') {
      if (typeof input.id !== 'string' || !ID.test(input.id))
        return json(400, { code: 'invalid-memory' });
      const rows = await database(MEMORIES, 'GET', {
        owner_uid: `eq.${uid}`,
        id: `eq.${input.id}`,
        select:
          'photo_path,photo_backend,photo_size_bytes,supabase_cleanup_pending,status,updated_at,reservation_token',
        limit: 1,
      });
      const row = rows[0];
      if (input.action === 'confirm') {
        if (!row || row.status !== 'pending' || !row.photo_path)
          return json(409, { code: 'photo-not-ready' });
        if (row.photo_backend === 'r2') {
          const photo = await r2('head', row.photo_path);
          if (
            !photo ||
            photo.contentType !== 'image/jpeg' ||
            photo.sizeBytes !== row.photo_size_bytes
          ) {
            return json(409, { code: 'photo-not-ready' });
          }
          const changed = await database(
            MEMORIES,
            'PATCH',
            {
              owner_uid: `eq.${uid}`,
              id: `eq.${input.id}`,
              status: 'eq.pending',
              photo_backend: 'eq.r2',
              photo_path: `eq.${row.photo_path}`,
              updated_at: `eq.${row.updated_at}`,
              reservation_token: `eq.${row.reservation_token}`,
            },
            { status: 'active', updated_at: new Date().toISOString() },
          );
          return changed.length
            ? json(200, { shared: true })
            : json(409, { code: 'photo-not-ready' });
        }
        const confirmed = await database(
          'rpc/confirm_lifemate_shared_memory_photo',
          'POST',
          {},
          {
            p_owner_uid: uid,
            p_id: input.id,
            p_expected_token: row.reservation_token,
          },
        );
        return confirmed === true
          ? json(200, { shared: true })
          : json(409, { code: 'photo-not-ready' });
      }
    }
    return json(400, { code: 'invalid-action' });
  }

  return async (request) => {
    if (request.method !== 'POST')
      return json(405, { code: 'method-not-allowed' });
    if (request.headers.has('origin'))
      return json(403, { code: 'origin-not-allowed' });
    const authorization = request.headers.get('authorization') ?? '';
    if (!authorization.startsWith('Bearer ') || authorization.length > 8192)
      return json(401, { code: 'unauthenticated' });
    let identity;
    try {
      identity = await verifyIdentity(authorization.slice(7));
    } catch {
      return json(401, { code: 'unauthenticated' });
    }
    let input;
    try {
      input = await readInput(request);
    } catch {
      return json(400, { code: 'invalid-input' });
    }
    // Recheck the live account gate after input; a slow body can outlive access.
    try {
      const current = await verifyIdentity(authorization.slice(7));
      if (current.uid !== identity.uid) throw new Error('Identity changed');
      identity = current;
    } catch {
      return json(401, { code: 'unauthenticated' });
    }
    if (
      identity.emailVerified !== true &&
      !['unshare', 'delete-own', ...PRIVATE_ACTIONS].includes(input.action)
    )
      return json(403, { code: 'email-not-verified' });
    try {
      return await handle(identity, input);
    } catch {
      return json(503, { code: 'memory-service-unavailable' });
    }
  };
}
