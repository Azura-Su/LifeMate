import { randomInt, shuffledDeck } from './cards.mjs';
import { updateRoom, roomSnapshot } from './rooms.mjs';

const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const json = (status, value) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const commands = ['create', 'join', 'ready', 'start', 'play', 'pass', 'leave'];
const errors = {
  'invalid-session': 401,
  'game-unavailable': 503,
  'rate-limited': 429,
  'room-not-found': 404,
  'not-member': 403,
  'session-replaced': 409,
  'version-conflict': 409,
  'match-conflict': 409,
  'turn-expired': 409,
  'idempotency-conflict': 409,
  'already-in-room': 409,
  'room-conflict': 409,
  'room-full': 409,
  'room-playing': 409,
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
  const fields = {
    bootstrap: [],
    sync: [],
    lease: [],
    takeover: ['roomId'],
    create: ['actionId', 'name', 'game'],
    join: ['actionId', 'name', 'code'],
    ready: ['actionId', 'roomId', 'expectedVersion', 'matchId', 'ready'],
    start: ['actionId', 'roomId', 'expectedVersion', 'matchId'],
    play: ['actionId', 'roomId', 'expectedVersion', 'matchId', 'cards'],
    pass: ['actionId', 'roomId', 'expectedVersion', 'matchId'],
    leave: ['actionId', 'roomId', 'expectedVersion', 'matchId'],
  }[input.type];
  if (
    !fields ||
    Object.keys(input).some(
      (k) => !['type', 'sessionId', ...fields].includes(k),
    ) ||
    fields.some((k) => !(k in input))
  )
    throw Error('invalid-input');
  if (commands.includes(input.type) && !UUID.test(input.actionId))
    throw Error('invalid-input');
  if (
    !['create', 'join', 'bootstrap', 'sync', 'lease'].includes(input.type) &&
    !UUID.test(input.roomId)
  )
    throw Error('invalid-input');
  if (
    ['create', 'join'].includes(input.type) &&
    (typeof input.name !== 'string' ||
      input.name.trim().length < 1 ||
      input.name.length > 30 ||
      /[\p{Cc}\p{Cf}]/u.test(input.name))
  )
    throw Error('invalid-input');
  if (input.type === 'create' && input.game !== 'south')
    throw Error('invalid-input');
  if (input.type === 'join' && !CODE.test(input.code))
    throw Error('invalid-input');
  if (
    ['ready', 'start', 'play', 'pass', 'leave'].includes(input.type) &&
    (!Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 1 ||
      (input.matchId !== null && !UUID.test(input.matchId)))
  )
    throw Error('invalid-input');
  if (input.type === 'ready' && typeof input.ready !== 'boolean')
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
          if (size > 4096) throw Error('invalid-input');
          chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        return JSON.parse(new TextDecoder().decode(bytes));
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
      const current = () =>
        rpc('lifemate_game_read', { ...base, p_renew: false });
      const snapshot = async () => {
        const loaded = await current();
        return roomSnapshot(
          loaded.room,
          p_uid,
          loaded.controller,
          Number(loaded.now),
        );
      };
      if (input.type === 'bootstrap') {
        const loaded = await current();
        const refresh = await grantRealtime(fresh);
        return json(200, {
          ...roomSnapshot(
            loaded.room,
            p_uid,
            loaded.controller,
            Number(loaded.now),
          ),
          refreshToken: refresh,
        });
      }
      if (['sync', 'lease'].includes(input.type)) {
        const loaded = await rpc('lifemate_game_read', {
          ...base,
          p_renew: input.type === 'lease',
        });
        return json(
          200,
          roomSnapshot(
            loaded.room,
            p_uid,
            loaded.controller,
            Number(loaded.now),
          ),
        );
      }
      if (input.type === 'takeover') {
        await rpc('lifemate_game_takeover', {
          ...base,
          p_room_id: input.roomId,
        });
        return json(200, await snapshot());
      }
      const hash = await fingerprint(input);
      const receipt = await rpc('lifemate_game_receipt', {
        p_uid,
        p_auth_time,
        p_action_id: input.actionId,
        p_fingerprint: hash,
      });
      if (receipt) return json(200, { ...(await snapshot()), ack: receipt });
      let ack;
      if (input.type === 'create') {
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
        });
      } else {
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
        if (input.type !== 'join' && record.id !== input.roomId)
          throw Error('room-conflict');
        if (input.type !== 'join' && record.version !== input.expectedVersion)
          throw Error('version-conflict');
        if (input.type !== 'join' && record.match_id !== input.matchId)
          throw Error('match-conflict');
        const now = clock();
        const state = updateRoom(
          record.state,
          p_uid,
          input,
          now,
          input.type === 'start' ? deck() : undefined,
        );
        ack = await rpc('lifemate_game_commit', {
          ...base,
          p_action_id: input.actionId,
          p_fingerprint: hash,
          p_room_id: record.id,
          p_version:
            input.type === 'join' ? record.version : input.expectedVersion,
          p_match_id: input.type === 'join' ? record.match_id : input.matchId,
          p_kind: input.type,
          p_state: state,
        });
      }
      return json(200, { ...(await snapshot()), ack });
    } catch (cause) {
      const code = errors[cause?.message] ? cause.message : 'game-unavailable';
      return json(errors[code], { error: code });
    }
  };
}
