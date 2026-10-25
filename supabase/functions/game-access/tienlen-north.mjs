import { rank, validCards } from './cards.mjs';

export const NORTH_TURN_MS = 40000;
const suit = (card) => card % 4;
const color = (card) => (suit(card) < 2 ? 'black' : 'red');

/** Classify only combinations in the proposed LifeMate North profile. */
export function classifyNorth(input) {
  if (!validCards(input)) return null;

  const cards = [...input].sort((a, b) => a - b);
  const ranks = [...new Set(cards.map(rank))];
  let kind = null;

  if (cards.length === 1) kind = 'single';
  if (ranks.length === 1) {
    if (cards.length === 2 && color(cards[0]) === color(cards[1]))
      kind = 'pair';
    if (cards.length === 3) kind = 'triple';
    if (cards.length === 4) kind = 'quad';
  }

  const straight =
    cards.length >= 3 &&
    ranks.length === cards.length &&
    ranks.at(-1) < 12 &&
    ranks.every((value, index) => !index || value === ranks[index - 1] + 1) &&
    cards.every((card) => suit(card) === suit(cards[0]));
  if (straight) kind = 'straight';

  return kind ? { kind, size: cards.length, high: cards.at(-1) } : null;
}

function beatsSingle(next, previous) {
  const nextRank = rank(next);
  const previousRank = rank(previous);
  if (nextRank === 12 && previousRank === 12)
    return suit(next) > suit(previous);
  if (nextRank === 12) return true;
  return nextRank > previousRank && suit(next) === suit(previous);
}

function beatsSameKind(nextCards, next, previousCards, previous) {
  if (next.kind !== previous.kind || next.size !== previous.size) return false;

  if (next.kind === 'single')
    return beatsSingle(next.high, previous.high);
  if (next.kind === 'pair') {
    const sameColor = color(nextCards[0]) === color(previousCards[0]);
    return sameColor && rank(next.high) > rank(previous.high);
  }
  if (next.kind === 'straight') {
    return (
      suit(nextCards[0]) === suit(previousCards[0]) &&
      rank(next.high) > rank(previous.high)
    );
  }
  return rank(next.high) > rank(previous.high);
}

/** Compare two plays under the isolated, proposed north-v1 rules profile. */
export function canBeatNorth(input, previousInput) {
  const next = classifyNorth(input);
  const previous = classifyNorth(previousInput);
  if (!next || !previous) return false;

  const nextCards = [...input].sort((a, b) => a - b);
  const previousCards = [...previousInput].sort((a, b) => a - b);
  if (
    next.kind === 'quad' &&
    previous.kind === 'single' &&
    rank(previous.high) === 12
  )
    return true;

  return beatsSameKind(nextCards, next, previousCards, previous);
}

export function isNorthOpeningPlay(input, openingCard) {
  return (
    classifyNorth(input) !== null &&
    Number.isInteger(openingCard) &&
    input.includes(openingCard)
  );
}

export function newTienLenNorthGame(
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
  for (let i = 0; i < uids.length * 13; i++)
    players[i % uids.length].hand.push(deck[i]);
  for (const player of players) player.hand.sort((a, b) => a - b);

  const seatedPreviousWinner = uids.includes(previousWinner)
    ? previousWinner
    : null;
  const openingCard = seatedPreviousWinner
    ? null
    : players.some((player) => player.hand.includes(0))
      ? 0
      : Math.min(...players.flatMap((player) => player.hand));
  const first =
    players.find((player) => player.uid === seatedPreviousWinner) ??
    players.find((player) => player.hand.includes(openingCard));

  return {
    rulesVersion:
      config?.rulesVersion === 'north-v2' ? 'north-v2' : 'north-v1',
    status: 'playing',
    players,
    turn: first.uid,
    openingCard,
    table: null,
    passed: [],
    finishOrder: [],
    forfeited: [],
    playedCards: [],
    cutTwoEvents: [],
    stock: deck.slice(uids.length * 13),
    deadline: now + NORTH_TURN_MS,
    result: null,
  };
}

function liveNorthPlayers(state) {
  return state.players.filter(
    (player) =>
      !state.finishOrder.includes(player.uid) &&
      !state.forfeited.includes(player.uid),
  );
}

function nextNorthSeat(state, after, candidates) {
  const from = state.players.findIndex((player) => player.uid === after);
  for (let offset = 1; offset <= state.players.length; offset++) {
    const player = state.players[(from + offset) % state.players.length];
    if (candidates.some((candidate) => candidate.uid === player.uid))
      return player.uid;
  }
  throw Error('no-next-player');
}

function completeNorth(state) {
  const remaining = liveNorthPlayers(state);
  if (remaining.length > 1) return false;

  if (!remaining.length && !state.finishOrder.length) {
    state.status = 'cancelled';
    state.turn = null;
    state.deadline = null;
    state.result = { reason: 'all-disconnected', ranking: [] };
    return true;
  }

  const order = [
    ...state.finishOrder,
    ...remaining.map((player) => player.uid),
    ...[...state.forfeited].reverse(),
  ];
  state.status = 'finished';
  state.turn = null;
  state.deadline = null;
  state.result = {
    reason: state.forfeited.length ? 'forfeit' : 'played-out',
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

function advanceNorth(state, after, now) {
  if (completeNorth(state)) return state;
  const active = liveNorthPlayers(state);
  const contenders = active.filter(
    (player) =>
      player.uid !== state.table?.uid &&
      !state.passed.includes(player.uid),
  );

  if (state.table && !contenders.length) {
    const owner = state.table.uid;
    state.table = null;
    state.passed = [];
    state.turn = active.some((player) => player.uid === owner)
      ? owner
      : nextNorthSeat(state, owner, active);
  } else {
    state.turn = nextNorthSeat(
      state,
      after,
      contenders.length ? contenders : active,
    );
  }
  state.deadline = now + NORTH_TURN_MS;
  return state;
}

export function playTienLenNorth(input, uid, action, now) {
  if (input.status !== 'playing') throw Error('finished');
  const player = input.players.find((candidate) => candidate.uid === uid);
  if (
    !player ||
    input.forfeited.includes(uid) ||
    input.finishOrder.includes(uid)
  )
    throw Error('not-member');
  if (!action || !['play', 'pass'].includes(action.type))
    throw Error('invalid-action');

  const combination = action.type === 'play' ? classifyNorth(action.cards) : null;
  if (action.type === 'play' && !combination)
    throw Error('invalid-combination');
  if (input.turn !== uid || input.passed.includes(uid))
    throw Error('wrong-turn');
  if (action.type === 'play') {
    if (!action.cards.every((card) => player.hand.includes(card)))
      throw Error('card-ownership');
    if (
      input.openingCard !== null &&
      !isNorthOpeningPlay(action.cards, input.openingCard)
    )
      throw Error('opening-card');
    if (input.table && !canBeatNorth(action.cards, input.table.cards))
      throw Error('cannot-beat');
  } else if (!input.table) throw Error('cannot-pass');

  const state = structuredClone(input);
  if (action.type === 'pass') {
    state.passed.push(uid);
  } else {
    const next = state.players.find((candidate) => candidate.uid === uid);
    const previous = input.table && classifyNorth(input.table.cards);
    if (
      input.rulesVersion === 'north-v2' &&
      input.table &&
      input.table.uid !== uid &&
      combination.kind === 'quad' &&
      previous?.kind === 'single' &&
      rank(previous.high) === 12
    )
      state.cutTwoEvents.push({ from: input.table.uid, to: uid, count: 1 });
    next.hand = next.hand.filter((card) => !action.cards.includes(card));
    next.played += action.cards.length;
    state.playedCards.push(...action.cards);
    state.table = {
      uid,
      cards: [...action.cards].sort((a, b) => a - b),
    };
    state.openingCard = null;
    if (!next.hand.length) state.finishOrder.push(uid);
  }
  return advanceNorth(state, uid, now);
}

export function forfeitTienLenNorthPlayers(input, uids, now) {
  if (input.status !== 'playing') return structuredClone(input);
  if (uids.some((uid) => !input.players.some((player) => player.uid === uid)))
    throw Error('not-member');

  const state = structuredClone(input);
  const removed = new Set(uids);
  for (const uid of removed)
    if (
      !state.forfeited.includes(uid) &&
      !state.finishOrder.includes(uid)
    )
      state.forfeited.push(uid);
  state.passed = state.passed.filter((uid) => !removed.has(uid));

  if (completeNorth(state)) return state;
  if (
    state.openingCard !== null &&
    !liveNorthPlayers(state).some((player) =>
      player.hand.includes(state.openingCard),
    )
  ) {
    state.openingCard = Math.min(
      ...liveNorthPlayers(state).flatMap((player) => player.hand),
    );
    state.turn = liveNorthPlayers(state).find((player) =>
      player.hand.includes(state.openingCard),
    ).uid;
    state.deadline = now + NORTH_TURN_MS;
    return state;
  }

  const contenders = liveNorthPlayers(state).filter(
    (player) =>
      player.uid !== state.table?.uid &&
      !state.passed.includes(player.uid),
  );
  if (removed.has(state.turn) || (state.table && !contenders.length))
    return advanceNorth(state, state.turn, now);
  return state;
}

export function timeoutTienLenNorth(input, now) {
  if (input.status !== 'playing' || input.deadline > now) return null;
  const player = input.players.find((candidate) => candidate.uid === input.turn);
  return playTienLenNorth(
    input,
    input.turn,
    input.table
      ? { type: 'pass' }
      : {
          type: 'play',
          cards: [input.openingCard ?? Math.min(...player.hand)],
        },
    now,
  );
}

export function viewTienLenNorth(state, uid) {
  const own = state.players.find((player) => player.uid === uid);
  if (!own) throw Error('not-member');
  return {
    rulesVersion: state.rulesVersion,
    status: state.status,
    hand: [...own.hand],
    players: state.players.map((player) => ({
      uid: player.uid,
      count: player.hand.length,
      finished: state.finishOrder.includes(player.uid),
      forfeited: state.forfeited.includes(player.uid),
    })),
    turn: state.turn,
    table: structuredClone(state.table),
    passed: [...state.passed],
    openingCard: uid === state.turn ? state.openingCard : null,
    deadline: state.deadline,
    result: structuredClone(state.result),
  };
}
