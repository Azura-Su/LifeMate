const ID = /^[A-Za-z0-9_-]{1,128}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 8192;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PROFILES = 'lifemate_memory_profiles';
const REQUESTS = 'lifemate_memory_friend_requests';
const EMAIL_INVITES = 'lifemate_memory_email_invites';
const ATTEMPTS = 'lifemate_memory_invite_attempts';
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
    state: ['action', 'displayName'],
    invite: ['action', 'displayName', 'email'],
    accept: ['action', 'displayName', 'uid'],
    decline: ['action', 'displayName', 'uid'],
    cancel: ['action', 'displayName', 'email'],
    'remove-friend': ['action', 'displayName', 'uid'],
    feed: ['action', 'displayName'],
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
  };
  if (
    typeof input.action !== 'string' ||
    !allowed[input.action] ||
    Object.keys(input).some((key) => !allowed[input.action].includes(key)) ||
    typeof input.displayName !== 'string' ||
    !input.displayName.trim() ||
    input.displayName.trim().length > 60 ||
    /[\u0000-\u001f\u007f]/.test(input.displayName)
  )
    throw new Error('Invalid input');
  return { ...input, displayName: input.displayName.trim() };
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

export function createHandler({ verifyIdentity, database, storage }) {
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
    if (input.action === 'state') {
      const [people, shares] = await Promise.all([
        relationships(uid),
        database(MEMORIES, 'GET', {
          owner_uid: `eq.${uid}`,
          status: 'eq.active',
          select: 'id',
          limit: 101,
        }),
      ]);
      return json(200, {
        email: identity.email,
        ...people,
        sharedIds: shares.map((row) => row.id),
      });
    }
    if (input.action === 'invite') {
      const email =
        typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      if (!EMAIL.test(email) || email.length > 254)
        return json(400, { code: 'invalid-email' });
      if (email === identity.email) return json(400, { code: 'self-invite' });
      const since = new Date(Date.now() - 86400000).toISOString();
      const attempts = await database(ATTEMPTS, 'GET', {
        uid: `eq.${uid}`,
        created_at: `gte.${since}`,
        select: 'id',
        limit: 21,
      });
      if (attempts.length >= 20) return json(429, { code: 'invite-limit' });
      await database(ATTEMPTS, 'POST', {}, { id: crypto.randomUUID(), uid });
      const target = await database(PROFILES, 'GET', {
        email: `eq.${email}`,
        select: 'uid',
        limit: 1,
      });
      // Keep the response identical for unknown and already connected accounts.
      if (!target.length) {
        const [outgoingPending, targetPending, outgoingKnown] =
          await Promise.all([
            database(EMAIL_INVITES, 'GET', {
              requester_uid: `eq.${uid}`,
              select: 'target_email',
              limit: 21,
            }),
            database(EMAIL_INVITES, 'GET', {
              target_email: `eq.${email}`,
              select: 'requester_uid',
              limit: 21,
            }),
            database(REQUESTS, 'GET', {
              requester_uid: `eq.${uid}`,
              select: 'target_uid',
              limit: 21,
            }),
          ]);
        if (
          outgoingPending.length + outgoingKnown.length < 20 &&
          targetPending.length < 20 &&
          !outgoingPending.some((row) => row.target_email === email)
        )
          await database(
            EMAIL_INVITES,
            'POST',
            {},
            {
              requester_uid: uid,
              target_email: email,
            },
          );
        return json(200, { sent: true });
      }
      const targetUid = target[0].uid;
      const pair = friendPair(uid, targetUid);
      const [existing, outgoing, outgoingPending, incoming] = await Promise.all(
        [
          database(FRIENDS, 'GET', {
            ...Object.fromEntries(
              Object.entries(pair).map(([k, v]) => [k, `eq.${v}`]),
            ),
            select: 'left_uid',
            limit: 1,
          }),
          database(REQUESTS, 'GET', {
            requester_uid: `eq.${uid}`,
            select: 'target_uid',
            limit: 21,
          }),
          database(EMAIL_INVITES, 'GET', {
            requester_uid: `eq.${uid}`,
            select: 'target_email',
            limit: 21,
          }),
          database(REQUESTS, 'GET', {
            target_uid: `eq.${targetUid}`,
            select: 'requester_uid',
            limit: 21,
          }),
        ],
      );
      if (
        existing.length ||
        outgoing.some((row) => row.target_uid === targetUid)
      )
        return json(200, { sent: true });
      if (outgoing.length + outgoingPending.length >= 20)
        return json(200, { sent: true });
      if (incoming.length >= 20) return json(200, { sent: true });
      await database(
        REQUESTS,
        'POST',
        {},
        { requester_uid: uid, target_uid: targetUid },
      );
      return json(200, { sent: true });
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
      const people = await relationships(uid);
      if (!people.friends.length) return json(200, { items: [] });
      const friendUids = people.friends.map((person) => person.uid);
      const rows = await database(MEMORIES, 'GET', {
        owner_uid: `in.(${friendUids.join(',')})`,
        status: 'eq.active',
        select: 'id,owner_uid,date_key,body,photo_path,created_at',
        order: 'date_key.desc,created_at.desc',
        limit: 30,
      });
      const byUid = new Map(
        people.friends.map((person) => [person.uid, person]),
      );
      const items = await Promise.all(
        rows.map(async (row) => ({
          id: row.id,
          ownerId: row.owner_uid,
          ownerName: byUid.get(row.owner_uid)?.name ?? 'Người dùng',
          dateKey: row.date_key,
          text: row.body,
          photoUrl: row.photo_path
            ? await storage('download', row.photo_path)
            : null,
        })),
      );
      return json(200, { items });
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
        select: 'id,status',
        limit: 1,
      });
      if (existing[0]?.status === 'active')
        return json(409, { code: 'already-shared' });
      if (!existing.length) {
        const total = await database(MEMORIES, 'GET', {
          owner_uid: `eq.${uid}`,
          select: 'id',
          limit: 101,
        });
        if (total.length >= 100) return json(429, { code: 'memory-limit' });
      }
      const photoPath = input.hasPhoto
        ? `shared/${uid}/${input.id}/photo.jpg`
        : null;
      const row = {
        owner_uid: uid,
        id: input.id,
        date_key: input.dateKey,
        body: input.text.trim(),
        photo_path: photoPath,
        status: input.hasPhoto ? 'pending' : 'active',
        updated_at: new Date().toISOString(),
      };
      if (existing.length)
        await database(
          MEMORIES,
          'PATCH',
          { owner_uid: `eq.${uid}`, id: `eq.${input.id}` },
          row,
        );
      else await database(MEMORIES, 'POST', {}, row);
      return json(
        200,
        input.hasPhoto
          ? { uploadUrl: await storage('upload', photoPath), shared: false }
          : { shared: true },
      );
    }
    if (input.action === 'confirm' || input.action === 'unshare') {
      if (typeof input.id !== 'string' || !ID.test(input.id))
        return json(400, { code: 'invalid-memory' });
      if (input.action === 'confirm') {
        const confirmed = await database(
          'rpc/confirm_lifemate_shared_memory_photo',
          'POST',
          {},
          {
            p_owner_uid: uid,
            p_id: input.id,
          },
        );
        return confirmed === true
          ? json(200, { shared: true })
          : json(409, { code: 'photo-not-ready' });
      }
      await database(MEMORIES, 'DELETE', {
        owner_uid: `eq.${uid}`,
        id: `eq.${input.id}`,
      });
      await storage('delete', `shared/${uid}/${input.id}/photo.jpg`);
      return json(200, { shared: false });
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
    try {
      return await handle(identity, input);
    } catch {
      return json(503, { code: 'memory-service-unavailable' });
    }
  };
}
