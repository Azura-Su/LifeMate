import { validCards } from './cards.mjs';
import { findPhomLayout, isPhom, phomPoint } from './phom-melds.mjs';
import {
  phomOptions,
  settlePhom,
  validatePhomConfig,
} from './phom-scoring.mjs';

const TURN_MS = 40_000;
const required = (p) => p.eaten.filter((c) => p.hand.includes(c));
const layout = (p) => findPhomLayout(p.hand, required(p));
function canWin(state, p) {
  const best = layout(p);
  return (
    !!best &&
    (p.melds.length > 0 || best.melds.length > 0) &&
    best.loose.length <= (state.step === 'draw' ? 0 : 1)
  );
}
function complete(state, reason, winnerUid = null, winKind = null) {
  state.status = 'finished';
  state.turn = null;
  state.deadline = null;
  state.winnerUid = winnerUid;
  state.winKind = winKind;
  state.result = { reason, ranking: settlePhom(state, state.config) };
  return state;
}
function win(state, p) {
  if (!canWin(state, p)) throw Error('invalid-combination');
  const best = layout(p);
  const kind =
    !p.laid && p.hand.length === 10 && best.loose.length === 0 ? 'u-tron' : 'u';
  p.melds.push(...best.melds);
  p.hand = best.loose;
  const feeds = state.eats.filter((e) => e.to === p.uid);
  const liable = state.players.filter((q) => !q.forfeited && q.uid !== p.uid);
  const fedThree = liable.find(
    (q) => feeds.filter((e) => e.from === q.uid).length >= 3,
  );
  const options = phomOptions(state.config);
  state.penaltyUid =
    fedThree?.uid ??
    (options.tai && options.uDen
      ? liable.find((q) => q.uid === p.replayPayerUid)?.uid
      : null) ??
    null;
  return complete(state, kind, p.uid, kind);
}
function nextPlayer(state, after) {
  const start = state.players.findIndex((p) => p.uid === after);
  for (let offset = 1; offset <= state.players.length; offset++) {
    const p = state.players[(start + offset) % state.players.length];
    if (!p.forfeited && p.turns < 4) return p;
  }
  return null;
}
function advance(state, uid, now) {
  const next = nextPlayer(state, uid);
  if (!next)
    return complete(
      state,
      state.players.some((p) => p.forfeited) ? 'forfeit' : 'phom-points',
    );
  state.turn = next.uid;
  state.step = 'draw';
  state.deadline = now + TURN_MS;
  return state;
}
export function newPhomGame(uids, deck, now, config, previousWinner = null) {
  if (
    uids.length < 2 ||
    uids.length > 4 ||
    new Set(uids).size !== uids.length ||
    !validCards(deck) ||
    deck.length !== 52
  )
    throw Error('invalid-deal');
  const first = uids.includes(previousWinner) ? previousWinner : uids[0];
  const players = uids.map((uid) => ({
    uid,
    hand: [],
    eaten: [],
    melds: [],
    discards: [],
    turns: 0,
    laid: false,
    laidOrder: null,
    forfeited: false,
  }));
  for (let i = 0; i < 9 * uids.length; i++)
    players[i % uids.length].hand.push(deck[i]);
  players.find((p) => p.uid === first).hand.push(deck[9 * uids.length]);
  return {
    rulesVersion: 'phom-v1',
    status: 'playing',
    players,
    stock: deck.slice(9 * uids.length + 1),
    turn: first,
    step: 'discard',
    lastDiscard: null,
    deadline: now + TURN_MS,
    result: null,
    config: validatePhomConfig(config),
    fees: [],
    eats: [],
    penaltyUid: null,
    laidCount: 0,
  };
}
function acquire(state, p, action) {
  if (state.step !== 'draw') throw Error('invalid-action');
  if (action === 'draw') {
    if (!state.stock.length) throw Error('invalid-action');
    p.hand.push(state.stock.shift());
  } else {
    const last = state.lastDiscard;
    if (
      !last ||
      last.uid === p.uid ||
      !findPhomLayout([...p.hand, last.card], [...required(p), last.card])
    )
      throw Error('invalid-combination');
    const from = state.players.find((q) => q.uid === last.uid);
    if (!from?.discards.includes(last.card)) throw Error('invalid-combination');
    from.discards = from.discards.filter((c) => c !== last.card);
    // An eaten discard in the lay round reopens its owner's final turn.
    if (phomOptions(state.config).tai && state.laidCount > 0) {
      if (last.chot && from.turns >= 4) from.replayPayerUid = p.uid;
      from.turns--;
    }
    p.hand.push(last.card);
    p.eaten.push(last.card);
    state.eats.push({
      from: last.uid,
      to: p.uid,
      card: last.card,
      chot: last.chot,
    });
    state.fees.push({
      from: last.uid,
      to: p.uid,
      kind: last.chot ? 'chot' : 'eat',
      amount: last.chot ? state.config.chot : state.config.eat,
    });
  }
  state.lastDiscard = null;
  state.step =
    p.turns === 3 && (!p.laid || layout(p)?.melds.length) ? 'lay' : 'discard';
}
function lay(state, p, melds) {
  if (state.step !== 'lay' || (p.laid && !phomOptions(state.config).tai))
    throw Error('invalid-action');
  const best = layout(p);
  if (!best) throw Error('invalid-combination');
  const groups = melds ?? best.melds;
  if (
    !Array.isArray(groups) ||
    groups.length + p.melds.length > 3 ||
    groups.some(
      (g) => !isPhom(g) || g.filter((c) => p.eaten.includes(c)).length > 1,
    )
  )
    throw Error('invalid-combination');
  const flat = groups.flat(),
    rest = p.hand.filter((c) => !flat.includes(c));
  if (
    new Set(flat).size !== flat.length ||
    flat.some((c) => !p.hand.includes(c)) ||
    required(p).some((c) => !flat.includes(c)) ||
    findPhomLayout(rest)?.melds.length
  )
    throw Error('invalid-combination');
  const tron = !p.laid && p.hand.length === 10 && rest.length === 0;
  p.melds.push(...groups.map((g) => [...g]));
  p.hand = rest;
  p.laid = true;
  if (p.laidOrder === null) p.laidOrder = state.laidCount++;
  state.step = 'discard';
  if (!rest.length) {
    // Preserve the pre-lay distinction; later sending can only yield normal ù.
    const won = win(state, p);
    if (tron) {
      state.winKind = 'u-tron';
      state.result.reason = 'u-tron';
      state.result.ranking = settlePhom(state, state.config);
    }
    return won;
  }
  return state;
}
export function playPhom(input, uid, action, now) {
  if (input.status !== 'playing') throw Error('finished');
  const state = structuredClone(input),
    p = state.players.find((q) => q.uid === uid);
  if (!p || p.forfeited) throw Error('not-member');
  if (state.turn !== uid) throw Error('not-turn');
  const kind = action.phomAction;
  if (kind === 'u') return win(state, p);
  if (kind === 'draw' || kind === 'eat') {
    acquire(state, p, kind);
    return state;
  }
  if (kind === 'lay') return lay(state, p, action.melds);
  if (state.step !== 'discard') throw Error('invalid-action');
  if (
    !Array.isArray(action.cards) ||
    action.cards.length !== 1 ||
    !p.hand.includes(action.cards[0])
  )
    throw Error('invalid-combination');
  const card = action.cards[0];
  if (kind === 'send') {
    if (!phomOptions(state.config).send) throw Error('invalid-action');
    const target = state.players.find((q) => q.uid === action.targetUid),
      group = target?.melds[action.meldIndex];
    if (
      !p.laid ||
      !p.melds.length ||
      !target?.laid ||
      target.forfeited ||
      target.uid === uid ||
      (!phomOptions(state.config).tai && target.laidOrder >= p.laidOrder) ||
      !group ||
      !isPhom([...group, card])
    )
      throw Error('invalid-combination');
    group.push(card);
    p.hand = p.hand.filter((c) => c !== card);
    if (!p.hand.length) return win(state, p);
    return state;
  }
  if (kind !== 'discard') throw Error('invalid-action');
  const rest = p.hand.filter((c) => c !== card);
  if (
    p.eaten.includes(card) ||
    !findPhomLayout(
      rest,
      p.eaten.filter((c) => rest.includes(c)),
    )
  )
    throw Error('invalid-combination');
  p.hand = rest;
  p.discards.push(card);
  p.turns++;
  // Eating moves a discard into eats, so their sum preserves the action order.
  p.lastDiscardOrder =
    state.players.reduce((sum, q) => sum + q.discards.length, 0) + state.eats.length;
  state.lastDiscard = { uid, card, chot: p.turns === 4 };
  // A completed 9-card hand or laid/sent hand is automatically a valid ù.
  if (canWin({ ...state, step: 'draw' }, p))
    return win({ ...state, step: 'draw' }, p);
  delete p.replayPayerUid;
  return advance(state, uid, now);
}
export function timeoutPhom(input, now) {
  if (input.status !== 'playing' || input.deadline > now) return null;
  let state = structuredClone(input);
  const uid = state.turn;
  if (state.step === 'draw')
    state = playPhom(state, uid, { phomAction: 'draw' }, now);
  if (state.step === 'lay')
    state = playPhom(state, uid, { phomAction: 'lay' }, now);
  if (state.status !== 'playing') return state;
  const p = state.players.find((q) => q.uid === uid);
  const best = layout(p);
  if (best && !best.loose.length) return win(state, p);
  const candidates = (best?.loose ?? []).filter(
    (c) =>
      !p.eaten.includes(c) &&
      findPhomLayout(
        p.hand.filter((x) => x !== c),
        required(p).filter((x) => x !== c),
      ),
  );
  candidates.sort((a, b) => phomPoint(b) - phomPoint(a) || b - a);
  if (!candidates.length) return win(state, p);
  return playPhom(
    state,
    uid,
    { phomAction: 'discard', cards: [candidates[0]] },
    now,
  );
}
export function forfeitPhomPlayers(input, uids, now) {
  if (input.status !== 'playing') return structuredClone(input);
  if (uids.some((uid) => !input.players.some((p) => p.uid === uid)))
    throw Error('not-member');
  const state = structuredClone(input);
  for (const p of state.players)
    if (uids.includes(p.uid)) {
      p.forfeited = true;
      delete p.replayPayerUid;
    }
  const live = state.players.filter((p) => !p.forfeited);
  if (!live.length) {
    state.status = 'cancelled';
    state.turn = null;
    state.deadline = null;
    state.result = { reason: 'all-disconnected', ranking: [] };
    return state;
  }
  if (live.length === 1) return complete(state, 'forfeit', live[0].uid);
  if (uids.includes(state.lastDiscard?.uid)) state.lastDiscard = null;
  if (uids.includes(state.turn)) {
    state.lastDiscard = null;
    return advance(state, state.turn, now);
  }
  return state;
}
export function viewPhom(state, uid, includeResultCards = false) {
  const p = state.players.find((q) => q.uid === uid);
  if (!p) throw Error('not-member');
  return {
    rulesVersion: 'phom-v1',
    status: state.status,
    hand: [...p.hand],
    players: state.players.map((q) => ({
      uid: q.uid,
      count: q.hand.length,
      finished: q.turns === 4,
      forfeited: q.forfeited,
      eaten: [...q.eaten],
      melds: structuredClone(q.melds),
      discards: [...q.discards],
      laid: q.laid,
      turns: q.turns,
      ...(includeResultCards &&
        state.status === 'finished' && {
          resultCards: {
            discards: [
              ...new Set([
                ...q.discards,
                ...(state.eats ?? [])
                  .filter((eat) => eat.from === q.uid)
                  .map((eat) => eat.card),
              ]),
            ].sort((a, b) => a - b),
            remaining: [...q.hand],
          },
        }),
    })),
    turn: state.turn,
    table: null,
    passed: [],
    openingCard: null,
    deadline: state.deadline,
    result: structuredClone(state.result),
    step: state.step,
    stockCount: state.stock.length,
    lastDiscard: structuredClone(state.lastDiscard),
    canU: state.status === 'playing' && state.turn === uid && canWin(state, p),
    canEat:
      state.status === 'playing' &&
      state.turn === uid &&
      state.step === 'draw' &&
      !!state.lastDiscard &&
      !!findPhomLayout(
        [...p.hand, state.lastDiscard.card],
        [...required(p), state.lastDiscard.card],
      ),
  };
}
