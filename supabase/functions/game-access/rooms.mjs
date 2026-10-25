import { gameEngine } from './game-engines.mjs';
import { configuredSouth, settleConfiguredSouth } from './tienlen-scoring.mjs';

export function updateRoom(input, uid, action, now, deck) {
  const state = structuredClone(input);
  state.scoreMembers ??= state.members.map((p) => ({
    ...p,
    balance: p.balance ?? 0,
  }));
  // The creator becomes the first owner. The current owner can be transferred
  // between seated players and remains the only person who can reopen the room.
  if (state.ownerUid === undefined)
    state.ownerUid =
      state.scoreMembers[0]?.uid ?? state.members[0]?.uid ?? null;
  const member = state.members.find((p) => p.uid === uid);
  if (action.type === 'reopen') {
    if (uid !== state.ownerUid) throw Error('not-owner');
    if (state.members.length) throw Error('room-conflict');
    const scoreMember = state.scoreMembers.find((p) => p.uid === uid);
    if (!scoreMember) throw Error('not-owner');
    state.members.push({
      uid,
      name: action.name?.trim() || scoreMember.name,
      ready: false,
      wins: scoreMember.wins ?? 0,
      balance: scoreMember.balance ?? 0,
    });
    state.host = uid;
    if (!state.game) state.phase = 'lobby';
    else if (state.phase === 'closed') state.phase = 'finished';
    return finishRoom(input, state);
  }
  if (action.type === 'join') {
    if (
      !state.members.length &&
      uid === state.ownerUid &&
      state.phase === 'closed'
    )
      state.phase = state.game ? 'finished' : 'lobby';
    if (member) return state;
    if (state.members.length >= 4) throw Error('room-full');
    if (!['lobby', 'finished'].includes(state.phase))
      throw Error('room-playing');
    if (state.members.length === 0 && uid !== state.ownerUid)
      throw Error('room-not-found');
    const scoreMember = state.scoreMembers.find((p) => p.uid === uid);
    state.members.push({
      uid,
      name: action.name,
      ready: false,
      wins: scoreMember?.wins ?? 0,
      balance: scoreMember?.balance ?? 0,
    });
    state.host ??= uid;
    if (!scoreMember)
      state.scoreMembers.push({
        uid,
        name: action.name,
        ready: false,
        wins: 0,
        balance: 0,
      });
    return state;
  }
  if (!member) throw Error('not-member');
  if (action.type === 'transfer-owner') {
    if (state.ownerUid !== uid) throw Error('not-owner');
    if (
      typeof action.targetUid !== 'string' ||
      action.targetUid === uid ||
      !state.members.some((player) => player.uid === action.targetUid)
    )
      throw Error('invalid-input');
    state.ownerUid = action.targetUid;
    state.host = action.targetUid;
  } else if (action.type === 'kick') {
    if (state.ownerUid !== uid) throw Error('not-owner');
    if (
      action.targetUid === uid ||
      !state.members.some((p) => p.uid === action.targetUid)
    )
      throw Error('invalid-input');
    if (state.phase === 'playing')
      state.game = gameEngine(state).forfeit(
        state.game,
        [action.targetUid],
        now,
      );
    state.members = state.members.filter((p) => p.uid !== action.targetUid);
    state.members.forEach((p) => {
      p.ready = false;
    });
    if (state.host === action.targetUid)
      state.host = state.members[0]?.uid ?? null;
  } else if (action.type === 'leave') {
    if (state.phase === 'playing')
      state.game = gameEngine(state).forfeit(state.game, [uid], now);
    state.members = state.members.filter((p) => p.uid !== uid);
    state.members.forEach((p) => {
      p.ready = false;
    });
    if (state.host === uid) state.host = state.members[0]?.uid ?? null;
  } else if (action.type === 'ready') {
    if (!['lobby', 'finished'].includes(state.phase))
      throw Error('room-playing');
    member.ready = action.ready;
    if (shouldStartRematch(state, uid, action)) {
      applyNextRules(state);
      const winner = state.game?.result?.ranking.find(
        (p) => p.rank === 1 && !p.labels.includes('forfeit'),
      )?.uid;
      state.game = gameEngine(state).start(
        state.members.map((p) => p.uid),
        deck,
        now,
        winner,
        state.gameKind === 'phom' ? state.phomConfig : state.southConfig,
      );
      state.phase = 'playing';
      state.members.forEach((p) => {
        p.ready = false;
      });
    }
  } else if (action.type === 'start') {
    if (
      state.phase !== 'lobby' ||
      state.host !== uid ||
      state.members.length < 2 ||
      state.members.some((player) => player.uid !== state.host && !player.ready)
    )
      throw Error('not-ready');
    applyNextRules(state);
    state.game = gameEngine(state).start(
      state.members.map((p) => p.uid),
      deck,
      now,
      null,
      state.gameKind === 'phom' ? state.phomConfig : state.southConfig,
    );
    state.phase = 'playing';
    state.members.forEach((p) => {
      p.ready = false;
    });
  } else if (['play', 'pass'].includes(action.type)) {
    if (state.phase !== 'playing') throw Error('finished');
    if (state.gameKind !== 'phom' && action.phomAction !== undefined)
      throw Error('invalid-input');
    state.game = gameEngine(state).play(state.game, uid, action, now);
  } else throw Error('invalid-input');
  const started =
    action.type === 'start' || shouldStartRematch(input, uid, action);
  return finishRoom(input, state, started);
}

function applyNextRules(state) {
  if (state.gameKind === 'phom') {
    if (state.nextPhomConfig) state.phomConfig = { ...state.nextPhomConfig };
    return;
  }
  if (!state.nextSouthRules) return;
  state.amountPerCard = state.nextSouthRules.amountPerCard;
  if (configuredSouth(state.nextSouthRules.southConfig))
    state.southConfig = { ...state.nextSouthRules.southConfig };
  else delete state.southConfig;
}

export function shouldStartRematch(state, uid, action) {
  return (
    action.type === 'ready' &&
    action.ready === true &&
    ['lobby', 'finished'].includes(state.phase) &&
    state.members.length >= 2 &&
    state.members.every((player) =>
      player.uid === uid ? action.ready : player.ready,
    )
  );
}

export function finishRoom(previous, state, started = false) {
  state.scoreMembers ??= state.members.map((p) => ({
    ...p,
    balance: p.balance ?? 0,
  }));
  if (
    (state.phase !== 'closed' || state.game?.status === 'finished') &&
    ['finished', 'cancelled'].includes(state.game?.status) &&
    (previous.phase === 'playing' || started)
  ) {
    state.phase = 'finished';
    if (
      state.game.status === 'finished' &&
      (previous.phase === 'playing' || started)
    ) {
      const ranking = state.game.result?.ranking ?? [];
      const winner = ranking.find(
        (p) => p.rank === 1 && !p.labels.includes('forfeit'),
      );
      let losersTotal = 0;
      for (const result of ranking) {
        result.name =
          previous.members.find((p) => p.uid === result.uid)?.name ??
          state.members.find((p) => p.uid === result.uid)?.name ??
          state.scoreMembers.find((p) => p.uid === result.uid)?.name ??
          'Người chơi';
        const player = state.game.players.find((p) => p.uid === result.uid);
        result.remainingCards = player?.hand.length ?? 0;
        if (state.gameKind !== 'phom' && !state.game.southConfig)
          result.moneyDelta =
            result.uid === winner?.uid
              ? 0
              : -(result.remainingCards * (state.amountPerCard ?? 0));
        if (result.uid !== winner?.uid && !state.game.southConfig)
          losersTotal -= result.moneyDelta;
      }
      if (state.game.southConfig)
        settleConfiguredSouth(state.game, state.amountPerCard ?? 0);
      else if (winner && state.gameKind !== 'phom')
        winner.moneyDelta = losersTotal;
      for (const result of ranking) {
        const member = state.members.find((p) => p.uid === result.uid);
        const scoreMember = state.scoreMembers.find(
          (p) => p.uid === result.uid,
        );
        if (scoreMember)
          scoreMember.balance =
            (scoreMember.balance ?? 0) + (result.moneyDelta ?? 0);
        if (member)
          member.balance =
            scoreMember?.balance ??
            (member.balance ?? 0) + (result.moneyDelta ?? 0);
      }
    }
    for (const result of state.game.result?.ranking ?? []) {
      const member = state.members.find((p) => p.uid === result.uid);
      const scoreMember = state.scoreMembers.find((p) => p.uid === result.uid);
      if (result.rank === 1 && !result.labels.includes('forfeit')) {
        if (scoreMember) scoreMember.wins++;
        if (member) member.wins++;
      }
    }
    state.members.forEach((p) => {
      p.ready = false;
    });
  }
  return state;
}

export function roomSnapshot(
  record,
  uid,
  controller,
  now,
  lifecycle = false,
  nextRules = false,
) {
  if (!record) return { room: null, serverTime: now };
  const state = record.state;
  if (!state.members.some((p) => p.uid === uid)) throw Error('not-member');
  const game = state.game?.players.some((p) => p.uid === uid)
    ? gameEngine(state).view(state.game, uid, nextRules >= 8)
    : null;
  if (game && lifecycle) {
    const scoreMembers = state.scoreMembers ?? state.members;
    game.players = game.players.map((p) => {
      const scoreMember = scoreMembers.find((member) => member.uid === p.uid);
      return {
        ...p,
        name:
          scoreMember?.name ??
          state.members.find((member) => member.uid === p.uid)?.name ??
          'Người chơi',
        balance: scoreMember?.balance ?? 0,
      };
    });
  }
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
      ...(lifecycle && {
        ownerUid:
          state.ownerUid === ''
            ? null
            : (state.ownerUid ??
              state.scoreMembers?.[0]?.uid ??
              state.members[0]?.uid),
      }),
      controller,
      topic: `card-room:${record.id}:${record.epoch}`,
      ...(lifecycle && { amountPerCard: state.amountPerCard ?? 0 }),
      ...(state.gameKind === 'phom' && {
        gameKind: 'phom',
        phomConfig: { ...state.phomConfig },
      }),
      ...(state.southConfig && { southConfig: { ...state.southConfig } }),
      ...(nextRules >= 6 &&
        (nextRules >= 7 || !state.nextPhomConfig?.options) &&
        state.nextPhomConfig && {
          nextPhomConfig: { ...state.nextPhomConfig },
        }),
      ...(nextRules &&
        state.nextSouthRules && {
          nextSouthRules: structuredClone(state.nextSouthRules),
        }),
      members: state.members.map((p) => ({
        uid: p.uid,
        name: p.name,
        ready: p.ready,
        wins: p.wins,
        ...(lifecycle && { balance: p.balance ?? 0 }),
      })),
      game,
    },
  };
}
