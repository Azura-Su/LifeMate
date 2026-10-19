const KNOWN = new Set([
  'invalid-session',
  'game-unavailable',
  'rate-limited',
  'room-not-found',
  'already-in-room',
  'idempotency-conflict',
  'not-member',
  'session-replaced',
  'version-conflict',
  'match-conflict',
  'turn-expired',
  'room-playing',
  'room-full',
  'invalid-input',
]);

export function createGameBackend(projectUrl, serviceKey, request = fetch) {
  if (
    !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(projectUrl ?? '') ||
    !serviceKey
  )
    throw Error('Missing game backend configuration');
  return async (name, args = {}) => {
    if (!/^lifemate_game_[a-z_]+$/.test(name)) throw Error('invalid-rpc');
    const response = await request(`${projectUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });
    const result = await response.json().catch(() => {
      throw Error('game-unavailable');
    });
    if (!response.ok) {
      if (KNOWN.has(result?.message)) throw Error(result.message);
      if (result?.code === '23505') throw Error('room-conflict');
      throw Error('game-unavailable');
    }
    return result;
  };
}
