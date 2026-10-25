import { rank, validCards } from './cards.mjs';

export const TAN_TURN_MS = 40_000;
const suit = (card) => card % 4;
// Card ids encode 3..2 in ascending order; Tấn orders 2 low and Ace high.
const tanRank = (card) => (rank(card) + 1) % 13;

export function canDefendTan(defenseCard, attackCard, trumpSuit) {
  if (
    !Number.isInteger(defenseCard) ||
    defenseCard < 0 ||
    defenseCard > 51 ||
    !Number.isInteger(attackCard) ||
    attackCard < 0 ||
    attackCard > 51 ||
    !Number.isInteger(trumpSuit) ||
    trumpSuit < 0 ||
    trumpSuit > 3
  )
    return false;
  if (suit(defenseCard) === suit(attackCard))
    return tanRank(defenseCard) > tanRank(attackCard);
  return suit(defenseCard) === trumpSuit && suit(attackCard) !== trumpSuit;
}

function nextSeat(state, after, candidates) {
  const from = state.players.findIndex((player) => player.uid === after);
  for (let offset = 1; offset <= state.players.length; offset++) {
    const player = state.players[(from + offset) % state.players.length];
    if (candidates.some((candidate) => candidate.uid === player.uid))
      return player.uid;
  }
  return null;
}

function activePlayers(state) {
  return state.players.filter(
    (player) =>
      !state.forfeited.includes(player.uid) &&
      !state.finishOrder.includes(player.uid),
  );
}

function noteEmptyHand(state, uid) {
  const player = state.players.find((candidate) => candidate.uid === uid);
  if (!player || state.finishOrder.includes(uid) || state.forfeited.includes(uid))
    return;
  const index = state.boutEmptyOrder.indexOf(uid);
  if (player.hand.length === 0 && index < 0) state.boutEmptyOrder.push(uid);
  else if (player.hand.length > 0 && index >= 0)
    state.boutEmptyOrder.splice(index, 1);
}

function complete(state, reason) {
  const active = activePlayers(state);
  if (active.length > 1) return false;
  const allOut = active.length === 0;
  if (allOut && !state.finishOrder.length) {
    state.status = 'cancelled';
    state.step = 'finished';
    state.turn = null;
    state.deadline = null;
    state.result = { reason: 'all-disconnected', ranking: [] };
    return true;
  }
  const order = [
    ...state.finishOrder,
    ...active.map((player) => player.uid),
    ...[...state.forfeited].reverse(),
  ];
  state.status = 'finished';
  state.step = 'finished';
  state.turn = null;
  state.deadline = null;
  state.result = {
    reason: allOut && state.forfeited.length === 0 ? 'all-out' : reason,
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

function nextLive(state, after, excluding = []) {
  const candidates = activePlayers(state).filter(
    (player) => !excluding.includes(player.uid),
  );
  return nextSeat(state, after, candidates);
}

function drawOne(state) {
  if (state.stock.length) return state.stock.shift();
  if (state.trumpCard !== null) {
    const card = state.trumpCard;
    state.trumpCard = null;
    return card;
  }
  return null;
}

function refill(state) {
  const order = [];
  const attackerIndex = state.players.findIndex(
    (player) => player.uid === state.attackerUid,
  );
  for (let offset = 0; offset < state.players.length; offset++) {
    const player = state.players[(attackerIndex + offset) % state.players.length];
    if (
      player.uid !== state.defenderUid &&
      !state.forfeited.includes(player.uid) &&
      !state.finishOrder.includes(player.uid)
    )
      order.push(player);
  }
  const defender = state.players.find(
    (player) => player.uid === state.defenderUid,
  );
  if (
    defender &&
    !state.forfeited.includes(defender.uid) &&
    !state.finishOrder.includes(defender.uid)
  )
    order.push(defender);

  for (const player of order) {
    while (player.hand.length < 8) {
      const card = drawOne(state);
      if (card === null) break;
      player.hand.push(card);
      noteEmptyHand(state, player.uid);
    }
  }

  if (!state.stock.length && state.trumpCard === null) {
    const emptyInOrder = [
      ...state.boutEmptyOrder,
      ...state.players.map((player) => player.uid),
    ];
    for (const uid of emptyInOrder) {
      const player = state.players.find((candidate) => candidate.uid === uid);
      if (
        player?.hand.length === 0 &&
        !state.finishOrder.includes(uid) &&
        !state.forfeited.includes(uid)
      )
        state.finishOrder.push(uid);
    }
  }
}

function liveAfterOrFirst(state, after) {
  return nextLive(state, after) ?? activePlayers(state)[0]?.uid ?? null;
}

function beginBout(state, attackerUid, now) {
  const active = activePlayers(state);
  if (active.length < 2) {
    complete(state, 'last-standing');
    return state;
  }
  const attacker = active.find((player) => player.uid === attackerUid)
    ? attackerUid
    : liveAfterOrFirst(state, attackerUid);
  const defender = nextLive(state, attacker, [attacker]);
  if (!attacker || !defender) {
    complete(state, 'last-standing');
    return state;
  }
  state.step = 'attack';
  state.attackerUid = attacker;
  state.defenderUid = defender;
  state.turn = attacker;
  state.maxAttackCards = Math.min(
    8,
    state.players.find((player) => player.uid === defender).hand.length,
  );
  state.table = [];
  state.attackPassed = [];
  state.boutEmptyOrder = [];
  state.deadline = now + TAN_TURN_MS;
  return state;
}

function eligibleAttackers(state) {
  return activePlayers(state).filter(
    (player) =>
      player.uid !== state.defenderUid &&
      player.hand.length > 0,
  );
}

function beginDefense(state, now) {
  if (!state.table.length) throw Error('invalid-tan-state');
  state.step = 'defend';
  state.turn = state.defenderUid;
  state.deadline = now + TAN_TURN_MS;
  return state;
}

function beginAttackRound(state, now) {
  const eligible = eligibleAttackers(state);
  if (!eligible.length) {
    if (state.table.every((entry) => entry.defenseCard !== null))
      return resolveBout(state, now, 'defended');
    return beginDefense(state, now);
  }
  state.step = 'attack';
  state.attackPassed = [];
  state.turn = eligible.some((player) => player.uid === state.attackerUid)
    ? state.attackerUid
    : nextSeat(state, state.attackerUid, eligible);
  state.deadline = now + TAN_TURN_MS;
  return state;
}

function settleAfterAttackPasses(state, now) {
  if (state.table.every((entry) => entry.defenseCard !== null))
    return resolveBout(state, now, 'defended');
  return beginDefense(state, now);
}

function advanceAttack(state, after, now) {
  const eligible = eligibleAttackers(state);
  if (
    !eligible.length ||
    eligible.every((player) => state.attackPassed.includes(player.uid))
  )
    return settleAfterAttackPasses(state, now);
  state.turn = nextSeat(
    state,
    after,
    eligible.filter((player) => !state.attackPassed.includes(player.uid)),
  );
  if (!state.turn) return beginDefense(state, now);
  state.deadline = now + TAN_TURN_MS;
  return state;
}

function resolveBout(state, now, outcome) {
  const cards = state.table.flatMap((entry) =>
    entry.defenseCard === null
      ? [entry.attackCard]
      : [entry.attackCard, entry.defenseCard],
  );
  if (outcome === 'taken') {
    const defender = state.players.find(
      (player) => player.uid === state.defenderUid,
    );
    defender.hand.push(...cards);
    noteEmptyHand(state, defender.uid);
  } else state.discardPile.push(...cards);
  state.table = [];
  state.attackPassed = [];
  refill(state);
  if (complete(state, 'last-standing')) return state;

  const previousDefender = state.defenderUid;
  const nextAttacker =
    outcome === 'defended'
      ? activePlayers(state).some((player) => player.uid === previousDefender)
        ? previousDefender
        : liveAfterOrFirst(state, previousDefender)
      : liveAfterOrFirst(state, previousDefender);
  return beginBout(state, nextAttacker, now);
}

export function newTanGame(uids, deck, now, previousWinner = null) {
  if (
    uids.length < 2 ||
    uids.length > 4 ||
    new Set(uids).size !== uids.length ||
    !validCards(deck) ||
    deck.length !== 52
  )
    throw Error('invalid-deal');
  const players = uids.map((uid) => ({ uid, hand: [] }));
  for (let index = 0; index < uids.length * 8; index++)
    players[index % uids.length].hand.push(deck[index]);
  const trumpCard = deck[uids.length * 8];
  const stock = deck.slice(uids.length * 8 + 1);
  const attacker = uids.includes(previousWinner) ? previousWinner : uids[0];
  const state = {
    rulesVersion: 'tan-v1',
    status: 'playing',
    step: 'attack',
    players,
    stock,
    trumpCard,
    trumpSuit: suit(trumpCard),
    attackerUid: attacker,
    defenderUid: null,
    turn: attacker,
    maxAttackCards: 0,
    table: [],
    attackPassed: [],
    boutEmptyOrder: [],
    finishOrder: [],
    forfeited: [],
    discardPile: [],
    deadline: now + TAN_TURN_MS,
    result: null,
  };
  const defender = nextLive(state, attacker, [attacker]);
  state.defenderUid = defender;
  state.maxAttackCards = Math.min(
    8,
    players.find((player) => player.uid === defender).hand.length,
  );
  return state;
}

function act(input, uid, action, now) {
  if (input.status !== 'playing') throw Error('finished');
  const player = input.players.find((candidate) => candidate.uid === uid);
  if (
    !player ||
    input.forfeited.includes(uid) ||
    input.finishOrder.includes(uid)
  )
    throw Error('not-member');
  if (input.turn !== uid) throw Error('wrong-turn');
  if (!action || !['attack', 'pass-attack', 'defend', 'take'].includes(action.type))
    throw Error('invalid-action');
  const state = structuredClone(input);

  if (state.step === 'attack') {
    if (action.type === 'attack') {
      if (!Number.isInteger(action.card) || !player.hand.includes(action.card))
        throw Error('card-ownership');
      if (state.table.length >= state.maxAttackCards)
        throw Error('attack-limit');
      const tableRanks = new Set(
        state.table.flatMap((entry) => [
          tanRank(entry.attackCard),
          ...(entry.defenseCard === null ? [] : [tanRank(entry.defenseCard)]),
        ]),
      );
      if (state.table.length && !tableRanks.has(tanRank(action.card)))
        throw Error('attack-rank');
      const current = state.players.find((candidate) => candidate.uid === uid);
      current.hand = current.hand.filter((card) => card !== action.card);
      noteEmptyHand(state, uid);
      state.table.push({ attackCard: action.card, defenseCard: null, attackerUid: uid });
      state.attackPassed = [];
      return advanceAttack(state, uid, now);
    }
    if (action.type !== 'pass-attack') throw Error('invalid-action');
    if (!state.table.length) throw Error('invalid-action');
    if (!eligibleAttackers(state).some((candidate) => candidate.uid === uid))
      throw Error('invalid-action');
    if (!state.attackPassed.includes(uid)) state.attackPassed.push(uid);
    return advanceAttack(state, uid, now);
  }

  if (state.step !== 'defend' || uid !== state.defenderUid)
    throw Error('invalid-action');
  if (action.type === 'take') return resolveBout(state, now, 'taken');
  if (action.type !== 'defend') throw Error('invalid-action');
  if (
    !Number.isInteger(action.index) ||
    action.index < 0 ||
    action.index >= state.table.length ||
    state.table[action.index].defenseCard !== null
  )
    throw Error('invalid-action');
  const current = state.players.find((candidate) => candidate.uid === uid);
  if (!Number.isInteger(action.card) || !current.hand.includes(action.card))
    throw Error('card-ownership');
  if (
    !canDefendTan(
      action.card,
      state.table[action.index].attackCard,
      state.trumpSuit,
    )
  )
    throw Error('cannot-defend');
  current.hand = current.hand.filter((card) => card !== action.card);
  noteEmptyHand(state, uid);
  state.table[action.index].defenseCard = action.card;
  return beginAttackRound(state, now);
}

export function actTan(input, uid, action, now) {
  if (action?.type !== 'timeout') return act(input, uid, action, now);
  if (input.status !== 'playing' || input.turn !== uid || input.deadline > now)
    throw Error('invalid-action');
  if (input.step === 'attack') {
    if (!input.table.length) {
      const player = input.players.find((candidate) => candidate.uid === uid);
      if (!player?.hand.length) return null;
      return act(input, uid, {
        type: 'attack',
        card: Math.min(...player.hand),
      }, now);
    }
    return act(input, uid, { type: 'pass-attack' }, now);
  }
  const player = input.players.find((candidate) => candidate.uid === uid);
  const defense = input.table.findIndex(
    (entry) =>
      entry.defenseCard === null &&
      player.hand.some((card) =>
        canDefendTan(card, entry.attackCard, input.trumpSuit),
      ),
  );
  if (defense < 0) return act(input, uid, { type: 'take' }, now);
  const attackCard = input.table[defense].attackCard;
  const card = player.hand.find((candidate) =>
    canDefendTan(candidate, attackCard, input.trumpSuit),
  );
  return act(input, uid, { type: 'defend', index: defense, card }, now);
}

export function forfeitTanPlayers(input, uids, now) {
  if (input.status !== 'playing') return structuredClone(input);
  if (uids.some((uid) => !input.players.some((player) => player.uid === uid)))
    throw Error('not-member');
  const state = structuredClone(input);
  const newlyForfeited = [...new Set(uids)].filter(
    (uid) =>
      !state.forfeited.includes(uid) &&
      !state.finishOrder.includes(uid),
  );
  state.forfeited.push(...newlyForfeited);
  if (complete(state, 'forfeit')) return state;
  if (newlyForfeited.includes(state.defenderUid))
    return resolveBout(state, now, 'taken');
  if (state.step === 'attack' && newlyForfeited.includes(state.turn)) {
    state.attackPassed = state.attackPassed.filter(
      (uid) => !state.forfeited.includes(uid),
    );
    return advanceAttack(state, state.turn, now);
  }
  return state;
}

export function timeoutTan(input, now) {
  if (input.status !== 'playing' || input.deadline > now || !input.turn)
    return null;
  return actTan(input, input.turn, { type: 'timeout' }, now);
}

export function viewTan(state, uid) {
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
    stockCount: state.stock.length + (state.trumpCard === null ? 0 : 1),
    trumpCard: state.trumpCard,
    trumpSuit: state.trumpSuit,
    attackerUid: state.attackerUid,
    defenderUid: state.defenderUid,
    turn: state.turn,
    maxAttackCards: state.maxAttackCards,
    table: structuredClone(state.table),
    deadline: state.deadline,
    result: structuredClone(state.result),
  };
}
