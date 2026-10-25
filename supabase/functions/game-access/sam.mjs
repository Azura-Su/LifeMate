import { rank, validCards } from './cards.mjs';

export const SAM_TURN_MS = 40_000;

export function classifySam(input) {
  if (!validCards(input)) return null;
  const cards = [...input].sort((a, b) => a - b);
  const ranks = [...new Set(cards.map(rank))];
  let kind = null;
  if (cards.length === 1) kind = 'single';
  if (ranks.length === 1) {
    if (cards.length === 2) kind = 'pair';
    if (cards.length === 3) kind = 'triple';
    if (cards.length === 4) kind = 'quad';
  }
  if (
    cards.length >= 3 &&
    ranks.length === cards.length &&
    ranks.at(-1) < 12 &&
    ranks.every((value, index) => !index || value === ranks[index - 1] + 1)
  )
    kind = 'straight';
  return kind ? { kind, size: cards.length, high: cards.at(-1) } : null;
}

export function canBeatSam(nextInput, previousInput, rulesVersion = 'sam-v1') {
  const next = classifySam(nextInput);
  const previous = classifySam(previousInput);
  if (
    rulesVersion === 'sam-v2' &&
    next?.kind === 'quad' &&
    previous?.kind === 'single' &&
    rank(previous.high) === 12
  )
    return true;
  return !!next &&
    !!previous &&
    next.kind === previous.kind &&
    next.size === previous.size &&
    rank(next.high) > rank(previous.high);
}

function nextSeat(players, after, candidates) {
  const from = players.findIndex((player) => player.uid === after);
  for (let offset = 1; offset <= players.length; offset++) {
    const player = players[(from + offset) % players.length];
    if (candidates.some((candidate) => candidate.uid === player.uid))
      return player.uid;
  }
  throw Error('no-next-player');
}

function activePlayers(state) {
  return state.players.filter(
    (player) =>
      !state.finishOrder.includes(player.uid) &&
      !state.forfeited.includes(player.uid),
  );
}

function complete(state, reason) {
  if (state.samOutcome === 'success') return completeSamCall(state);
  const remaining = activePlayers(state);
  if (remaining.length > 1) return false;
  if (!remaining.length && !state.finishOrder.length) {
    if (state.rulesVersion === 'sam-v2' && state.samOutcome === 'pending')
      state.samOutcome = 'aborted';
    state.status = 'cancelled';
    state.turn = null;
    state.deadline = null;
    state.result = { reason: 'all-disconnected', ranking: [] };
    return true;
  }
  const rest = remaining
    .slice()
    .sort((a, b) => a.hand.length - b.hand.length)
    .map((player) => player.uid);
  const order = [
    ...state.finishOrder,
    ...rest,
    ...[...state.forfeited].reverse(),
  ];
  state.status = 'finished';
  state.turn = null;
  state.deadline = null;
  if (state.callUid && state.samOutcome === 'pending')
    state.samOutcome =
      state.rulesVersion === 'sam-v2'
        ? 'aborted'
        : state.finishOrder.includes(state.callUid)
          ? 'success'
          : 'failed';
  state.result = {
    reason,
    ranking: order.map((uid, index) => ({
      uid,
      rank: index + 1,
      labels: state.forfeited.includes(uid) ? ['forfeit'] : [],
      remainingCards:
        state.players.find((player) => player.uid === uid)?.hand.length ?? 0,
    })),
  };
  return true;
}

function completeSamCall(state) {
  state.status = 'finished';
  state.turn = null;
  state.deadline = null;
  const ordered = [
    ...state.finishOrder,
    ...activePlayers(state)
      .slice()
      .sort((a, b) => a.hand.length - b.hand.length)
      .map((player) => player.uid),
    ...[...state.forfeited].reverse(),
  ];
  state.result = {
    reason: 'sam-success',
    ranking: ordered.map((uid, index) => ({
      uid,
      rank: index + 1,
      labels: state.forfeited.includes(uid) ? ['forfeit'] : [],
      remainingCards:
        state.players.find((player) => player.uid === uid)?.hand.length ?? 0,
    })),
  };
  return true;
}

function beginPlay(state, uid, now, callUid = null) {
  state.step = 'play';
  state.turn = uid;
  state.callUid = callUid;
  if (callUid) {
    state.openingCard = null;
    state.samCallRecipients = activePlayers(state)
      .filter((player) => player.uid !== callUid)
      .map((player) => player.uid);
  }
  else if (
    state.openingCard !== null &&
    !state.players.find((player) => player.uid === uid)?.hand.includes(state.openingCard)
  )
    state.openingCard = Math.min(
      ...state.players.find((player) => player.uid === uid).hand,
    );
  state.reportedSam = callUid !== null;
  state.samOutcome = callUid ? 'pending' : null;
  state.reportOrder = [];
  state.reported = [];
  state.deadline = now + SAM_TURN_MS;
}

function advance(state, after, now) {
  if (state.samOutcome === 'success') {
    completeSamCall(state);
    return state;
  }
  if (complete(state, 'played-out')) return state;
  const active = activePlayers(state);
  const contenders = active.filter(
    (player) =>
      player.uid !== state.table?.uid &&
      !state.passed.includes(player.uid),
  );
  if (state.table && contenders.length === 0) {
    const owner = state.table.uid;
    state.table = null;
    state.passed = [];
    state.turn = active.some((player) => player.uid === owner)
      ? owner
      : nextSeat(state.players, owner, active);
  } else {
    state.turn = nextSeat(
      state.players,
      after,
      contenders.length ? contenders : active,
    );
  }
  state.deadline = now + SAM_TURN_MS;
  return state;
}

export function newSamGame(
  uids,
  deck,
  now,
  previousWinner = null,
  config = null,
) {
  if (
    uids.length < 2 ||
    uids.length > 4 ||
    new Set(uids).size !== uids.length ||
    !validCards(deck) ||
    deck.length !== 52
  )
    throw Error('invalid-deal');

  const players = uids.map((uid) => ({ uid, hand: [], played: 0 }));
  for (let index = 0; index < uids.length * 10; index++)
    players[index % uids.length].hand.push(deck[index]);
  for (const player of players) player.hand.sort((a, b) => a - b);

  const priorWinner = uids.includes(previousWinner) ? previousWinner : null;
  const openingCard = priorWinner
    ? null
    : players.some((player) => player.hand.includes(0))
      ? 0
      : Math.min(...players.flatMap((player) => player.hand));
  const opener = priorWinner
    ? priorWinner
    : players.find((player) => player.hand.includes(openingCard)).uid;
  const reportOrder = uids.slice(uids.indexOf(opener)).concat(uids.slice(0, uids.indexOf(opener)));
  return {
    rulesVersion:
      config?.rulesVersion === 'sam-v2' ? 'sam-v2' : 'sam-v1',
    status: 'playing',
    step: 'report-sam',
    players,
    stock: deck.slice(uids.length * 10),
    turn: reportOrder[0],
    reportOrder,
    reported: [],
    reportedSam: false,
    callUid: null,
    samCallRecipients: null,
    samOutcome: null,
    openingCard,
    table: null,
    passed: [],
    finishOrder: [],
    forfeited: [],
    playedCards: [],
    deadline: now + SAM_TURN_MS,
    result: null,
  };
}

function applyAction(input, uid, action, now) {
  if (input.status !== 'playing') throw Error('finished');
  if (!action || !['call-sam', 'pass-report', 'play', 'pass'].includes(action.type))
    throw Error('invalid-action');
  const player = input.players.find((candidate) => candidate.uid === uid);
  if (
    !player ||
    input.forfeited.includes(uid) ||
    input.finishOrder.includes(uid)
  )
    throw Error('not-member');
  if (input.turn !== uid) throw Error('wrong-turn');
  const state = structuredClone(input);

  if (state.step === 'report-sam') {
    if (!['call-sam', 'pass-report'].includes(action.type))
      throw Error('invalid-action');
    state.reported.push(uid);
    if (action.type === 'call-sam') {
      beginPlay(state, uid, now, uid);
      return state;
    }
    const next = state.reportOrder.find((candidate) => !state.reported.includes(candidate));
    if (next) {
      state.turn = next;
      state.deadline = now + SAM_TURN_MS;
      return state;
    }
    beginPlay(
      state,
      state.reportOrder.find((candidate) => !state.forfeited.includes(candidate)),
      now,
    );
    return state;
  }

  if (!['play', 'pass'].includes(action.type)) throw Error('invalid-action');
  const combination = action.type === 'play' ? classifySam(action.cards) : null;
  if (action.type === 'play' && !combination) throw Error('invalid-combination');
  if (action.type === 'play') {
    if (!action.cards.every((card) => player.hand.includes(card)))
      throw Error('card-ownership');
    if (
      state.openingCard !== null &&
      !action.cards.includes(state.openingCard)
    )
      throw Error('opening-card');
      if (
        state.table &&
        !canBeatSam(action.cards, state.table.cards, state.rulesVersion)
      )
      throw Error('cannot-beat');
  } else if (!state.table) throw Error('cannot-pass');

  if (action.type === 'pass') {
    state.passed.push(uid);
  } else {
    if (
      state.callUid &&
      state.samOutcome === 'pending' &&
      state.table?.uid === state.callUid &&
      uid !== state.callUid
    )
      state.samOutcome = 'failed';
    const current = state.players.find((candidate) => candidate.uid === uid);
    current.hand = current.hand.filter((card) => !action.cards.includes(card));
    current.played += action.cards.length;
    state.playedCards.push(...action.cards);
    state.table = { uid, cards: [...action.cards].sort((a, b) => a - b) };
    state.openingCard = null;
    if (current.hand.length === 0) state.finishOrder.push(uid);
    if (
      uid === state.callUid &&
      state.samOutcome === 'pending' &&
      current.hand.length === 0
    )
      state.samOutcome = 'success';
  }
  return advance(state, uid, now);
}

export function actSam(input, uid, action, now) {
  if (action?.type !== 'timeout') return applyAction(input, uid, action, now);
  if (input.status !== 'playing' || input.turn !== uid || input.deadline > now)
    throw Error('invalid-action');
  if (input.step === 'report-sam')
    return applyAction(input, uid, { type: 'pass-report' }, now);
  if (input.table) return applyAction(input, uid, { type: 'pass' }, now);
  const player = input.players.find((candidate) => candidate.uid === uid);
  const card = input.openingCard ?? Math.min(...player.hand);
  return applyAction(input, uid, { type: 'play', cards: [card] }, now);
}

export function forfeitSamPlayers(input, uids, now) {
  if (input.status !== 'playing') return structuredClone(input);
  if (uids.some((uid) => !input.players.some((player) => player.uid === uid)))
    throw Error('not-member');
  const state = structuredClone(input);
  const newlyForfeited = [...new Set(uids)].filter(
    (uid) => !state.forfeited.includes(uid) && !state.finishOrder.includes(uid),
  );
  state.forfeited.push(...newlyForfeited);
  if (
    state.rulesVersion === 'sam-v2' &&
    state.samOutcome === 'pending' &&
    newlyForfeited.includes(state.callUid)
  )
    state.samOutcome = 'aborted';
  state.passed = state.passed.filter((uid) => !state.forfeited.includes(uid));
  if (complete(state, 'forfeit')) return state;

  if (state.step === 'report-sam') {
    for (const uid of state.reportOrder)
      if (state.forfeited.includes(uid) && !state.reported.includes(uid))
        state.reported.push(uid);
    const next = state.reportOrder.find((uid) => !state.reported.includes(uid));
    if (next) {
      if (state.turn && state.forfeited.includes(state.turn)) state.turn = next;
      state.deadline = now + SAM_TURN_MS;
      return state;
    }
    const opener = state.reportOrder.find((uid) => !state.forfeited.includes(uid));
    if (opener) {
      beginPlay(state, opener, now);
      return state;
    }
  }
  if (
    state.step === 'play' &&
    state.openingCard !== null &&
    state.forfeited.some((uid) =>
      state.players.find((player) => player.uid === uid)?.hand.includes(state.openingCard),
    )
  ) {
    const live = activePlayers(state);
    if (!live.length) return state;
    state.openingCard = Math.min(...live.flatMap((player) => player.hand));
    state.turn = live.find((player) => player.hand.includes(state.openingCard)).uid;
    state.deadline = now + SAM_TURN_MS;
    return state;
  }
  if (complete(state, 'forfeit')) return state;
  if (state.turn && state.forfeited.includes(state.turn))
    return advance(state, state.turn, now);
  return state;
}

export function timeoutSam(input, now) {
  if (input.status !== 'playing' || input.deadline > now || !input.turn)
    return null;
  return actSam(input, input.turn, { type: 'timeout' }, now);
}

export function viewSam(state, uid) {
  const own = state.players.find((player) => player.uid === uid);
  if (!own) throw Error('not-member');
  return {
    rulesVersion: state.rulesVersion,
    status: state.status,
    step: state.step,
    hand: [...own.hand],
    players: state.players.map((player) => ({
      uid: player.uid,
      count: player.hand.length,
      finished: state.finishOrder.includes(player.uid),
      forfeited: state.forfeited.includes(player.uid),
    })),
    turn: state.turn,
    reportOrder: [...state.reportOrder],
    reported: [...state.reported],
    reportedSam: state.reportedSam,
    callUid: state.callUid,
    samOutcome: state.samOutcome,
    table: structuredClone(state.table),
    passed: [...state.passed],
    openingCard:
      state.step === 'play' && uid === state.turn ? state.openingCard : null,
    deadline: state.deadline,
    result: structuredClone(state.result),
  };
}
