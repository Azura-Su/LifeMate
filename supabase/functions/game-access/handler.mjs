import { randomInt, shuffledDeck } from './cards.mjs';
import { shouldStartRematch, updateRoom, roomSnapshot } from './rooms.mjs';
import { validateScoreDocument, validateScorePatch } from './scores.mjs';

const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const json = (status, value) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const commands = [
  'create',
  'join',
  'ready',
  'start',
  'play',
  'pass',
  'leave',
  'transfer-owner',
  'kick',
  'reopen',
  'delete-room',
];
const errors = {
  'invalid-session': 401,
  'game-unavailable': 503,
  'rate-limited': 429,
  'room-not-found': 404,
  'room-deleted': 410,
  'not-member': 403,
  'not-owner': 403,
  'session-replaced': 409,
  'version-conflict': 409,
  'match-conflict': 409,
  'turn-expired': 409,
  'idempotency-conflict': 409,
  'already-in-room': 409,
  'room-conflict': 409,
  'room-full': 409,
  'room-playing': 409,
  'room-expired': 409,
  'room-not-finished': 409,
  'room-not-expired': 409,
  'not-ready': 409,
  finished: 409,
  'invalid-input': 400,
  'wrong-turn': 422,
  'invalid-combination': 422,
  'cannot-beat': 422,
  'opening-card': 422,
  'card-ownership': 422,
  'cannot-pass': 422,
};

function validate(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    !UUID.test(input.sessionId)
  )
    throw Error('invalid-input');
  if (input.clientVersion !== undefined && input.clientVersion !== 2)
    throw Error('invalid-input');
  const fields = {
    bootstrap: [],
    sync: [],
    lease: [],
    takeover: ['roomId'],
    create: ['actionId', 'name', 'game', 'amountPerCard'],
    join: ['actionId', 'name', 'code'],
    ready: ['actionId', 'roomId', 'expectedVersion', 'matchId', 'ready'],
    start: ['actionId', 'roomId', 'expectedVersion', 'matchId'],
    play: ['actionId', 'roomId', 'expectedVersion', 'matchId', 'cards'],
    pass: ['actionId', 'roomId', 'expectedVersion', 'matchId'],
    leave: ['actionId', 'roomId', 'expectedVersion', 'matchId'],
    'transfer-owner': [
      'actionId',
      'roomId',
      'expectedVersion',
      'matchId',
      'targetUid',
    ],
    kick: ['actionId', 'roomId', 'expectedVersion', 'matchId', 'targetUid'],
    reopen: ['actionId', 'roomId', 'name', 'expectedVersion', 'matchId'],
    'delete-room': ['actionId', 'roomId', 'expectedVersion', 'matchId'],
    'room-status': ['roomId'],
    'score-list': [],
    'score-history': ['tableId', 'before'],
    'score-write': [
      'tableId',
      'actionId',
      'expectedVersion',
      'operation',
      'document',
    ],
  }[input.type];
  const optional = input.type === 'create' ? ['amountPerCard'] : [];
  if (
    !fields ||
    Object.keys(input).some(
      (k) => !['type', 'sessionId', 'clientVersion', ...fields].includes(k),
    ) ||
    fields.some((k) => !optional.includes(k) && !(k in input))
  )
    throw Error('invalid-input');
  if (commands.includes(input.type) && !UUID.test(input.actionId))
    throw Error('invalid-input');
  if (
    !input.type.startsWith('score-') &&
    !['create', 'join', 'bootstrap', 'sync', 'lease'].includes(input.type) &&
    !UUID.test(input.roomId)
  )
    throw Error('invalid-input');
  if (
    ['score-write', 'score-history'].includes(input.type) &&
    !UUID.test(input.tableId)
  )
    throw Error('invalid-input');
  if (
    input.type === 'score-history' &&
    input.before !== null &&
    (!Number.isSafeInteger(input.before) || input.before < 1)
  )
    throw Error('invalid-input');
  if (input.type === 'score-write') {
    if (
      !UUID.test(input.actionId) ||
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 1 ||
      !['save', 'patch', 'delete'].includes(input.operation)
    )
      throw Error('invalid-input');
    if (input.operation === 'save') validateScoreDocument(input.document);
    else if (input.operation === 'patch') validateScorePatch(input.document);
    else if (input.document !== null) throw Error('invalid-input');
  }
  if (
    ['create', 'join', 'reopen'].includes(input.type) &&
    (typeof input.name !== 'string' ||
      input.name.trim().length < 1 ||
      input.name.length > 30 ||
      /[\p{Cc}\p{Cf}]/u.test(input.name))
  )
    throw Error('invalid-input');
  if (input.type === 'create' && input.game !== 'south')
    throw Error('invalid-input');
  if (
    input.type === 'create' &&
    input.amountPerCard !== undefined &&
    (!Number.isSafeInteger(input.amountPerCard) ||
      input.amountPerCard < 1 ||
      input.amountPerCard > 1_000_000_000)
  )
    throw Error('invalid-input');
  if (input.type === 'join' && !CODE.test(input.code))
    throw Error('invalid-input');
  if (
    [
      'ready',
      'start',
      'play',
      'pass',
      'leave',
      'transfer-owner',
      'reopen',
      'delete-room',
    ].includes(input.type) &&
    (!Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 1 ||
      (input.matchId !== null && !UUID.test(input.matchId)))
  )
    throw Error('invalid-input');
  if (input.type === 'ready' && typeof input.ready !== 'boolean')
    throw Error('invalid-input');
  if (
    ['transfer-owner', 'kick'].includes(input.type) &&
    (typeof input.targetUid !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(input.targetUid))
  )
    throw Error('invalid-input');
  if (
    ['reopen', 'room-status'].includes(input.type) &&
    input.name !== undefined &&
    (typeof input.name !== 'string' ||
      input.name.trim().length < 1 ||
      input.name.length > 30)
  )
    throw Error('invalid-input');
  if (
    input.type === 'play' &&
    (!Array.isArray(input.cards) ||
      input.cards.length < 1 ||
      input.cards.length > 13 ||
      input.cards.some((c) => !Number.isInteger(c) || c < 0 || c > 51))
  )
    throw Error('invalid-input');
  return input;
}

async function readInput(request) {
  if (
    request.headers.get('content-type')?.split(';')[0] !== 'application/json' ||
    !request.body
  )
    throw Error('invalid-input');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0,
    timer;
  try {
    return await Promise.race([
      (async () => {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 262144) throw Error('invalid-input');
          chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        const value = JSON.parse(new TextDecoder().decode(bytes));
        if (size > 4096 && value?.type !== 'score-write')
          throw Error('invalid-input');
        return value;
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('invalid-input')), 10000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

async function fingerprint(input) {
  const ordered = Object.fromEntries(
    Object.keys(input)
      .sort()
      .map((k) => [k, input[k]]),
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(ordered)),
      ),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}

export function createGameHandler({
  verifyIdentity,
  rpc,
  avatarStorage,
  waitUntil = (promise) => void promise,
  grantRealtime = async () => false,
  tick,
  workerSecret,
  clock = Date.now,
  deck = shuffledDeck,
}) {
  const verify = async (token) => {
    try {
      return await verifyIdentity(token);
    } catch {
      throw Error('invalid-session');
    }
  };
  const avatarCache = new Map();
  const signedAvatar = async (uid) => {
    if (!avatarStorage) return null;
    const now = clock();
    let entry = avatarCache.get(uid);
    if (entry && entry.expiresAt <= now) {
      avatarCache.delete(uid);
      entry = null;
    }
    if (!entry) {
      const signedAt = now;
      entry = {
        url: null,
        expiresAt: signedAt + 30_000,
        promise: null,
      };
      entry.promise = Promise.resolve()
        .then(() => avatarStorage('read', `profiles/${uid}/avatar.jpg`))
        .then((url) => {
          entry.url = typeof url === 'string' ? url : null;
          entry.expiresAt = entry.url
            ? signedAt + 8 * 60_000
            : clock() + 30_000;
          return entry.url;
        })
        .catch(() => {
          entry.expiresAt = clock() + 30_000;
          return null;
        });
      avatarCache.set(uid, entry);
      while (avatarCache.size > 256)
        avatarCache.delete(avatarCache.keys().next().value);
    } else {
      avatarCache.delete(uid);
      avatarCache.set(uid, entry);
    }
    return entry.promise;
  };
  const cachedAvatar = (uid) => {
    const entry = avatarCache.get(uid);
    if (!entry) return null;
    if (entry.expiresAt <= clock()) {
      avatarCache.delete(uid);
      return null;
    }
    avatarCache.delete(uid);
    avatarCache.set(uid, entry);
    return entry.url;
  };
  return async (request) => {
    if (request.method !== 'POST' || request.headers.has('origin'))
      return json(405, { error: 'native-only' });
    const token = request.headers
      .get('authorization')
      ?.match(/^Bearer (.+)$/)?.[1];
    try {
      if (workerSecret && token === workerSecret && workerSecret.length >= 32) {
        const input = await readInput(request);
        if (input?.type !== 'tick' || Object.keys(input).length !== 1 || !tick)
          throw Error('invalid-input');
        await tick();
        return json(200, { ok: true });
      }
      if (!token) throw Error('invalid-session');
      const identity = await verify(token);
      const input = validate(await readInput(request));
      const fresh = await verify(token);
      if (fresh.uid !== identity.uid || fresh.authTime !== identity.authTime)
        throw Error('invalid-session');
      const p_uid = fresh.uid,
        p_auth_time = fresh.authTime,
        p_session_id = input.sessionId;
      const base = { p_uid, p_auth_time, p_session_id };
      if (input.type === 'score-list')
        return json(200, await rpc('lifemate_game_score_list', base));
      if (input.type === 'score-history')
        return json(
          200,
          await rpc('lifemate_game_score_history', {
            ...base,
            p_table_id: input.tableId,
            p_before: input.before,
          }),
        );
      if (input.type === 'score-write')
        return json(
          200,
          await rpc('lifemate_game_score_write', {
            ...base,
            p_table_id: input.tableId,
            p_action_id: input.actionId,
            p_fingerprint: await fingerprint(input),
            p_version: input.expectedVersion,
            p_operation: input.operation,
            p_document: input.document,
          }),
        );
      const current = () =>
        rpc('lifemate_game_read', { ...base, p_renew: false });
      const withAvatars = (snapshot) => {
        if (
          input.clientVersion !== 2 ||
          !snapshot.room ||
          typeof avatarStorage !== 'function'
        )
          return snapshot;
        const members = snapshot.room.members.map((member) => {
          const avatarUrl = cachedAvatar(member.uid);
          if (!avatarUrl) waitUntil(signedAvatar(member.uid));
          return { ...member, avatarUrl };
        });
        return { ...snapshot, room: { ...snapshot.room, members } };
      };
      const snapshotFor = async (record, controller, now) =>
        withAvatars(
          roomSnapshot(
            record,
            p_uid,
            controller,
            Number(now),
            input.clientVersion === 2,
          ),
        );
      const snapshot = async () => {
        const loaded = await current();
        return {
          ...(await snapshotFor(loaded.room, loaded.controller, loaded.now)),
          ...(loaded.removal ? { removal: loaded.removal } : {}),
        };
      };
      if (input.type === 'room-status') {
        const status = await rpc('lifemate_game_status', {
          ...base,
          p_room_id: input.roomId,
        });
        return json(200, status);
      }
      if (input.type === 'bootstrap') {
        const loaded = await current();
        const refresh = await grantRealtime(fresh);
        return json(200, {
          ...(await snapshotFor(loaded.room, loaded.controller, loaded.now)),
          ...(loaded.removal ? { removal: loaded.removal } : {}),
          refreshToken: refresh,
        });
      }
      if (['sync', 'lease'].includes(input.type)) {
        const loaded = await rpc('lifemate_game_read', {
          ...base,
          p_renew: input.type === 'lease',
        });
        return json(200, {
          ...(await snapshotFor(loaded.room, loaded.controller, loaded.now)),
          ...(loaded.removal ? { removal: loaded.removal } : {}),
        });
      }
      if (input.type === 'takeover') {
        await rpc('lifemate_game_takeover', {
          ...base,
          p_room_id: input.roomId,
        });
        return json(200, await snapshot());
      }
      const hash = await fingerprint(input);
      const readReceipt = () =>
        rpc('lifemate_game_receipt', {
          p_uid,
          p_auth_time,
          p_action_id: input.actionId,
          p_fingerprint: hash,
        });
      const receipt = await readReceipt();
      if (receipt) return json(200, { ...(await snapshot()), ack: receipt });
      let ack;
      let committedSnapshot = null;
      if (input.type === 'reopen') {
        ack = await rpc('lifemate_game_reopen', {
          ...base,
          p_action_id: input.actionId,
          p_fingerprint: hash,
          p_room_id: input.roomId,
          p_version: input.expectedVersion,
          p_match_id: input.matchId,
          p_name: input.name.trim(),
        });
        return json(200, { ...(await snapshot()), ack });
      } else if (input.type === 'delete-room') {
        ack = await rpc('lifemate_game_delete', {
          ...base,
          p_action_id: input.actionId,
          p_fingerprint: hash,
          p_room_id: input.roomId,
          p_version: input.expectedVersion,
          p_match_id: input.matchId,
        });
        return json(200, {
          room: null,
          serverTime: clock(),
          deleted: true,
          ack,
        });
      } else if (input.type === 'create') {
        const code = Array.from(
          { length: 8 },
          () => CHARS[randomInt(CHARS.length)],
        ).join('');
        ack = await rpc('lifemate_game_create', {
          ...base,
          p_action_id: input.actionId,
          p_fingerprint: hash,
          p_room_id: crypto.randomUUID(),
          p_code: code,
          p_name: input.name.trim(),
          p_amount_per_card: input.amountPerCard ?? 0,
        });
      } else {
        const canRebase = input.type === 'join' || input.type === 'ready';
        const maxAttempts = input.type === 'ready' ? 4 : 3;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const record =
            input.type === 'join'
              ? await rpc('lifemate_game_find', {
                  p_uid,
                  p_auth_time,
                  p_code: input.code,
                })
              : (await current()).room;
          if (!record) throw Error('not-member');
          if (record.error === 'room-not-found') throw Error('room-not-found');
          const member = record.state?.members.find(
            (player) => player.uid === p_uid,
          );
          const readyMayAlreadyBeCommitted =
            input.type === 'ready' &&
            (record.match_id !== input.matchId ||
              record.state?.phase === 'playing' ||
              member?.ready === input.ready);
          if ((input.type === 'join' && member) || readyMayAlreadyBeCommitted) {
            // An identical request may have joined or started the match since
            // the initial receipt read. Recheck only when the room snapshot
            // shows that the action may already have landed; the normal ready
            // path needs only the atomic receipt check inside the commit RPC.
            const duplicate = await readReceipt();
            if (duplicate) {
              ack = duplicate;
              break;
            }
          }
          if (input.type === 'join' && member) {
            // Restoring an existing seat never admits a fifth player or takes
            // control away from another device. Read the authoritative seat.
            const recovered = await rpc('lifemate_game_rejoin', {
              ...base,
              p_action_id: input.actionId,
              p_fingerprint: hash,
              p_room_id: record.id,
            });
            return json(200, {
              ...(recovered.record
                ? await snapshotFor(
                    recovered.record,
                    recovered.controller === true,
                    recovered.now,
                  )
                : await snapshot()),
              ack: recovered.ack,
            });
          }
          if (input.type !== 'join' && record.id !== input.roomId)
            throw Error('room-conflict');
          if (
            input.type !== 'join' &&
            record.version !== input.expectedVersion &&
            (input.type !== 'ready' || input.expectedVersion > record.version)
          )
            throw Error('version-conflict');
          if (input.type !== 'join' && record.match_id !== input.matchId)
            throw Error('match-conflict');
          const now = clock();
          const startsRematch = shouldStartRematch(record.state, p_uid, input);
          const state = updateRoom(
            record.state,
            p_uid,
            input,
            now,
            input.type === 'start' || startsRematch ? deck() : undefined,
          );
          // Keep the ready action's receipt/fingerprint, but tell the commit RPC
          // this state transition starts a match so it rotates matchId and applies
          // the same new-game gates as an explicit first-match start.
          const commitKind = startsRematch ? 'start' : input.type;
          let committed;
          try {
            committed = await rpc('lifemate_game_commit', {
              ...base,
              p_action_id: input.actionId,
              p_fingerprint: hash,
              p_room_id: record.id,
              p_version: canRebase ? record.version : input.expectedVersion,
              p_match_id:
                input.type === 'join' ? record.match_id : input.matchId,
              p_kind: commitKind,
              p_state: state,
            });
          } catch (cause) {
            // Ready sets one member's flag within the same match. Recompute it
            // after concurrent lobby changes, retaining strict CAS at the RPC.
            if (
              canRebase &&
              (cause?.message === 'version-conflict' ||
                (input.type === 'join' &&
                  cause?.message === 'already-in-room')) &&
              attempt < maxAttempts - 1
            )
              continue;
            throw cause;
          }
          if (committed?.record && committed?.ack) {
            ack = committed.ack;
            committedSnapshot = await snapshotFor(
              committed.record,
              committed.controller === true,
              committed.now,
            );
          } else {
            ack = committed;
          }
          break;
        }
      }
      return json(200, {
        ...(committedSnapshot ?? (await snapshot())),
        ack,
      });
    } catch (cause) {
      const code = errors[cause?.message] ? cause.message : 'game-unavailable';
      return json(errors[code], { error: code });
    }
  };
}
