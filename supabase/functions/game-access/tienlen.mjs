import { rank, validCards } from './cards.mjs';
import { configuredSouth, validateSouthConfig } from './tienlen-scoring.mjs';

export const TURN_MS = 40000;

export function classify(input) {
  if (!validCards(input)) return null;
  const cards = [...input].sort((a, b) => a - b);
  const ranks = [...new Set(cards.map(rank))];
  let kind;
  if (ranks.length === 1 && cards.length <= 4)
    kind = ['single', 'pair', 'triple', 'quad'][cards.length - 1];
  const consecutive =
    ranks.at(-1) < 12 &&
    ranks.every((value, i) => !i || value === ranks[i - 1] + 1);
  if (cards.length >= 3 && ranks.length === cards.length && consecutive)
    kind = 'straight';
  if (
    [6, 8].includes(cards.length) &&
    consecutive &&
    ranks.length === cards.length / 2 &&
    ranks.every((value) => cards.filter((c) => rank(c) === value).length === 2)
  )
    kind = 'pairs';
  return kind ? { kind, size: cards.length, high: cards.at(-1) } : null;
}

export function canBeat(input, previous) {
  const next = classify(input),
    last = classify(previous);
  if (!next || !last) return false;
  if (next.kind === last.kind && next.size === last.size)
    return next.high > last.high;
  const two = rank(last.high) === 12;
  if (next.kind === 'pairs' && next.size === 6)
    return last.kind === 'single' && two;
  if (next.kind === 'quad')
    return (
      (['single', 'pair'].includes(last.kind) && two) ||
      (last.kind === 'pairs' && last.size === 6)
    );
  if (next.kind === 'pairs' && next.size === 8)
    return (
      (['single', 'pair', 'triple'].includes(last.kind) && two) ||
      last.kind === 'quad' ||
      (last.kind === 'pairs' && last.size === 6)
    );
  return false;
}

function instant(hand) {
  const counts = Array.from(
    { length: 13 },
    (_, r) => hand.filter((c) => rank(c) === r).length,
  );
  if (counts.every((n) => n === 1)) return 'dragon';
  if (counts[12] === 4) return 'four-twos';
  if (counts.filter((n) => n >= 2).length >= 6) return 'six-pairs';
  return null;
}

export function newTienLenGame(uids, deck, now, previousWinner = null, config) {
  if (config !== undefined) validateSouthConfig(config);
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
  const openingCard = Math.min(...players.flatMap((p) => p.hand));
  const previous = players.find((p) => p.uid === previousWinner);
  const first = previous ?? players.find((p) => p.hand.includes(openingCard));
  const state = {
    rulesVersion: 'south-v1',
    status: 'playing',
    players,
    turn: first.uid,
    openingCard: previous ? null : openingCard,
    table: null,
    passed: [],
    finishOrder: [],
    forfeited: [],
    cong: [],
    playedCards: [],
    stock: deck.slice(uids.length * 13),
    deadline: now + TURN_MS,
    result: null,
    ...(configuredSouth(config) && {
      rulesVersion: 'south-v2',
      southConfig: { ...config },
      cutTwoFees: [],
    }),
  };
  const priority = ['dragon', 'four-twos', 'six-pairs'];
  const order = [
    ...players.slice(players.indexOf(first)),
    ...players.slice(0, players.indexOf(first)),
  ];
  const winners = order
    .map((p, seat) => ({ uid: p.uid, reason: instant(p.hand), seat }))
    .filter((p) => p.reason)
    .sort(
      (a, b) =>
        priority.indexOf(a.reason) - priority.indexOf(b.reason) ||
        a.seat - b.seat,
    );
  if (winners.length) {
    state.status = 'finished';
    state.turn = null;
    state.deadline = null;
    state.result = {
      reason: winners[0].reason,
      ranking: [
        {
          uid: winners[0].uid,
          rank: 1,
          labels: ['instant-win'],
          remainingCards: 0,
        },
        ...players
          .filter((p) => p.uid !== winners[0].uid)
          .map((p) => ({
            uid: p.uid,
            rank: 2,
            labels: [],
            remainingCards: p.hand.length,
          })),
      ],
    };
  }
  return state;
}

function live(state) {
  return state.players.filter(
    (p) =>
      !state.finishOrder.includes(p.uid) && !state.forfeited.includes(p.uid),
  );
}

function nextSeat(state, after, candidates) {
  const from = state.players.findIndex((p) => p.uid === after);
  for (let offset = 1; offset <= state.players.length; offset++) {
    const p = state.players[(from + offset) % state.players.length];
    if (candidates.some((candidate) => candidate.uid === p.uid)) return p.uid;
  }
  throw Error('no-next-player');
}

function complete(state) {
  const remaining = live(state);
  const early =
    state.southConfig?.finishMode === 'first-winner' &&
    state.finishOrder.length > 0;
  if (remaining.length > 1 && !early) return false;
  const order = [
    ...state.finishOrder,
    ...remaining.map((p) => p.uid),
    ...[...state.forfeited].reverse(),
  ];
  state.status = 'finished';
  state.turn = null;
  state.deadline = null;
  if (!remaining.length && !state.finishOrder.length) {
    state.status = 'cancelled';
    state.result = { reason: 'all-disconnected', ranking: [] };
    return true;
  }
  state.result = {
    reason: early
      ? 'first-winner'
      : state.forfeited.length
        ? 'forfeit'
        : 'played-out',
    ranking: order.map((uid, i) => {
      const player = state.players.find((p) => p.uid === uid);
      const labels = [];
      if (state.forfeited.includes(uid)) labels.push('forfeit');
      if (state.cong?.includes(uid)) labels.push('cong');
      if (
        (early
          ? remaining.some((p) => p.uid === uid)
          : remaining[0]?.uid === uid) &&
        i > 0
      ) {
        if (player.hand.some((c) => rank(c) === 12))
          labels.push('remaining-twos');
        if (
          Array.from({ length: 13 }, (_, r) => r).some(
            (r) => player.hand.filter((c) => rank(c) === r).length === 4,
          )
        )
          labels.push('remaining-quad');
        const counts = Array.from(
          { length: 12 },
          (_, r) => player.hand.filter((c) => rank(c) === r).length >= 2,
        );
        if (
          counts.some(
            (_, r) =>
              counts.slice(r, r + 3).length === 3 &&
              counts.slice(r, r + 3).every(Boolean),
          )
        )
          labels.push('remaining-pairs');
      }
      return {
        uid,
        rank: early && remaining.some((p) => p.uid === uid) ? 2 : i + 1,
        labels,
        remainingCards: player.hand.length,
      };
    }),
  };
  return true;
}

function advance(state, after, now) {
  if (complete(state)) return state;
  const active = live(state);
  const contenders = active.filter(
    (p) => p.uid !== state.table?.uid && !state.passed.includes(p.uid),
  );
  if (state.table && !contenders.length) {
    const owner = state.table.uid;
    state.table = null;
    state.passed = [];
    state.turn = active.some((p) => p.uid === owner)
      ? owner
      : nextSeat(state, owner, active);
  } else
    state.turn = nextSeat(
      state,
      after,
      contenders.length ? contenders : active,
    );
  state.deadline = now + TURN_MS;
  return state;
}

export function playTienLen(input, uid, action, now) {
  if (input.status !== 'playing') throw Error('finished');
  const player = input.players.find((p) => p.uid === uid);
  if (
    !player ||
    input.forfeited.includes(uid) ||
    input.finishOrder.includes(uid)
  )
    throw Error('not-member');
  if (!action || !['play', 'pass'].includes(action.type))
    throw Error('invalid-action');
  const combination = action.type === 'play' ? classify(action.cards) : null;
  if (action.type === 'play' && !combination)
    throw Error('invalid-combination');
  const interrupt =
    combination?.kind === 'pairs' &&
    combination.size === 8 &&
    input.table &&
    input.table.uid !== uid &&
    canBeat(action.cards, input.table.cards);
  if ((input.turn !== uid || input.passed.includes(uid)) && !interrupt)
    throw Error('wrong-turn');
  if (action.type === 'play') {
    if (!action.cards.every((c) => player.hand.includes(c)))
      throw Error('card-ownership');
    if (input.openingCard !== null && !action.cards.includes(input.openingCard))
      throw Error('opening-card');
    if (input.table && !canBeat(action.cards, input.table.cards))
      throw Error('cannot-beat');
  } else if (!input.table) throw Error('cannot-pass');
  const state = structuredClone(input);
  state.cong ??= [];
  if (action.type === 'pass') state.passed.push(uid);
  else {
    const last = state.table && classify(state.table.cards);
    if (
      state.southConfig &&
      state.table?.uid !== uid &&
      last &&
      ['single', 'pair', 'triple'].includes(last.kind) &&
      rank(last.high) === 12 &&
      (combination.kind === 'quad' || combination.kind === 'pairs')
    ) {
      const amount = state.table.cards.length * state.southConfig.cutTwoAmount;
      if (amount)
        (state.cutTwoFees ??= []).push({
          from: state.table.uid,
          to: uid,
          count: state.table.cards.length,
          amount,
        });
    }
    const next = state.players.find((p) => p.uid === uid);
    next.hand = next.hand.filter((c) => !action.cards.includes(c));
    next.played += action.cards.length;
    state.playedCards.push(...action.cards);
    state.table = { uid, cards: [...action.cards].sort((a, b) => a - b) };
    state.openingCard = null;
    if (interrupt) state.passed = [];
    if (!next.hand.length) {
      if (!state.finishOrder.length)
        state.cong = live(state)
          .filter((p) => p.uid !== uid && !p.played)
          .map((p) => p.uid);
      state.finishOrder.push(uid);
    }
  }
  return advance(state, uid, now);
}

export function forfeitTienLen(input, uid, now) {
  return forfeitTienLenPlayers(input, [uid], now);
}

// Apply one expiry sweep as a batch: no transient last survivor may win.
export function forfeitTienLenPlayers(input, uids, now) {
  if (input.status !== 'playing') return structuredClone(input);
  if (uids.some((uid) => !input.players.some((p) => p.uid === uid)))
    throw Error('not-member');
  const state = structuredClone(input);
  const removed = new Set(uids);
  for (const uid of uids) {
    if (!state.forfeited.includes(uid) && !state.finishOrder.includes(uid))
      state.forfeited.push(uid);
  }
  state.passed = state.passed.filter((p) => !removed.has(p));
  if (complete(state)) return state;
  if (
    state.openingCard !== null &&
    !live(state).some((p) => p.hand.includes(state.openingCard))
  ) {
    state.openingCard = Math.min(...live(state).flatMap((p) => p.hand));
    state.turn = live(state).find((p) =>
      p.hand.includes(state.openingCard),
    ).uid;
    state.deadline = now + TURN_MS;
    return state;
  }
  const contenders = live(state).filter(
    (p) => p.uid !== state.table?.uid && !state.passed.includes(p.uid),
  );
  if (removed.has(state.turn) || (state.table && !contenders.length))
    return advance(state, state.turn, now);
  return state;
}

export function timeoutTienLen(input, now) {
  if (input.status !== 'playing' || input.deadline > now) return null;
  const player = input.players.find((p) => p.uid === input.turn);
  return playTienLen(
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

export function viewTienLen(state, uid) {
  const own = state.players.find((p) => p.uid === uid);
  if (!own) throw Error('not-member');
  return {
    rulesVersion: state.rulesVersion,
    status: state.status,
    hand: [...own.hand],
    players: state.players.map((p) => ({
      uid: p.uid,
      count: p.hand.length,
      finished: state.finishOrder.includes(p.uid),
      forfeited: state.forfeited.includes(p.uid),
    })),
    turn: state.turn,
    table: structuredClone(state.table),
    passed: [...state.passed],
    openingCard: uid === state.turn ? state.openingCard : null,
    deadline: state.deadline,
    result: structuredClone(state.result),
    ...(state.southConfig && {
      southConfig: { ...state.southConfig },
      cutTwoFees: structuredClone(state.cutTwoFees ?? []),
    }),
  };
}
