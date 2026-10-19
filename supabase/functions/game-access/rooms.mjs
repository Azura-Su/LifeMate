import {
  newTienLenGame,
  playTienLen,
  forfeitTienLen,
  viewTienLen,
} from './tienlen.mjs';

export function updateRoom(input, uid, action, now, deck) {
  const state = structuredClone(input);
  const member = state.members.find((p) => p.uid === uid);
  if (action.type === 'join') {
    if (
      member ||
      state.members.length >= 4 ||
      !['lobby', 'finished'].includes(state.phase)
    )
      throw Error('room-full');
    state.members.push({ uid, name: action.name, ready: false, wins: 0 });
    state.members.forEach((p) => {
      p.ready = false;
    });
    return state;
  }
  if (!member) throw Error('not-member');
  if (action.type === 'leave') {
    if (state.phase === 'playing')
      state.game = forfeitTienLen(state.game, uid, now);
    state.members = state.members.filter((p) => p.uid !== uid);
    state.members.forEach((p) => {
      p.ready = false;
    });
    if (state.host === uid) state.host = state.members[0]?.uid ?? null;
    if (!state.members.length) state.phase = 'closed';
  } else if (action.type === 'ready') {
    if (!['lobby', 'finished'].includes(state.phase))
      throw Error('room-playing');
    member.ready = action.ready;
  } else if (action.type === 'start') {
    if (
      !['lobby', 'finished'].includes(state.phase) ||
      state.host !== uid ||
      state.members.length < 2 ||
      !state.members.every((p) => p.ready)
    )
      throw Error('not-ready');
    const winner = state.game?.result?.ranking.find(
      (p) => p.rank === 1 && !p.labels.includes('forfeit'),
    )?.uid;
    state.game = newTienLenGame(
      state.members.map((p) => p.uid),
      deck,
      now,
      winner,
    );
    state.phase = 'playing';
    state.members.forEach((p) => {
      p.ready = false;
    });
  } else if (['play', 'pass'].includes(action.type)) {
    if (state.phase !== 'playing') throw Error('finished');
    state.game = playTienLen(state.game, uid, action, now);
  } else throw Error('invalid-input');
  return finishRoom(input, state, action.type === 'start');
}

export function finishRoom(previous, state, started = false) {
  if (
    state.phase !== 'closed' &&
    ['finished', 'cancelled'].includes(state.game?.status) &&
    (previous.phase === 'playing' || started)
  ) {
    state.phase = 'finished';
    for (const result of state.game.result?.ranking ?? []) {
      const member = state.members.find((p) => p.uid === result.uid);
      if (member && result.rank === 1 && !result.labels.includes('forfeit'))
        member.wins++;
    }
    state.members.forEach((p) => {
      p.ready = false;
    });
  }
  return state;
}

export function roomSnapshot(record, uid, controller, now) {
  if (!record) return { room: null, serverTime: now };
  const state = record.state;
  if (!state.members.some((p) => p.uid === uid)) throw Error('not-member');
  // Explicit projection: never spread database/engine state into an API response.
  return {
    serverTime: now,
    room: {
      id: record.id,
      code: record.code,
      version: record.version,
      epoch: record.epoch,
      matchId: record.match_id,
      phase: state.phase,
      host: state.host,
      controller,
      topic: `card-room:${record.id}:${record.epoch}`,
      members: state.members.map((p) => ({
        uid: p.uid,
        name: p.name,
        ready: p.ready,
        wins: p.wins,
      })),
      game: state.game?.players.some((p) => p.uid === uid)
        ? viewTienLen(state.game, uid)
        : null,
    },
  };
}
