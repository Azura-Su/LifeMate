import { gameEngine } from './game-engines.mjs';
import { finishRoom } from './rooms.mjs';

export function advanceExpiredRoom(record, now) {
  const state = structuredClone(record.state);
  state.ownerUid ??=
    state.scoreMembers?.[0]?.uid ?? state.members[0]?.uid ?? null;
  const expired = new Set(record.expired);
  const roomExpired = record.expires_at && Date.parse(record.expires_at) <= now;
  if (roomExpired) state.members.forEach((p) => expired.add(p.uid));
  if (state.phase === 'playing') {
    const remove = [...expired].filter((uid) =>
      state.game.players.some((p) => p.uid === uid),
    );
    if (remove.length)
      state.game = gameEngine(state).forfeit(state.game, remove, now);
    if (state.game.status === 'playing')
      state.game = gameEngine(state).timeout(state.game, now) ?? state.game;
  }
  state.members = state.members.filter((p) => !expired.has(p.uid));
  if (!state.members.some((p) => p.uid === state.host))
    state.host = state.members[0]?.uid ?? null;
  if (expired.size)
    state.members.forEach((p) => {
      p.ready = false;
    });
  return { state: finishRoom(record.state, state), removed: [...expired] };
}

export function createGameWorker(rpc) {
  return async () => {
    const token = crypto.randomUUID();
    const claimed = await rpc('lifemate_game_claim_due', { p_token: token });
    const settled = await Promise.allSettled(
      claimed.rooms.map(async (record) => {
        const next = advanceExpiredRoom(record, Number(claimed.now));
        return rpc('lifemate_game_commit_worker', {
          p_room_id: record.id,
          p_token: token,
          p_version: record.version,
          p_state: next.state,
          p_remove_uids: next.removed,
        });
      }),
    );
    if (settled.some((result) => result.status === 'rejected'))
      throw Error('game-unavailable');
  };
}
