import type { PhomView } from '../../types/phom';
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) =>
  Object.keys(v).every((k) => allowed.includes(k));
const uid = (v: unknown): v is string =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const count = (v: unknown, max: number): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
const cards = (v: unknown, max: number): v is number[] =>
  Array.isArray(v) &&
  v.length <= max &&
  new Set(v).size === v.length &&
  v.every((c) => count(c, 51));
export function isPhomView(g: unknown, viewer: string): g is PhomView {
  if (
    !object(g) ||
    !keys(g, [
      'rulesVersion',
      'status',
      'hand',
      'players',
      'turn',
      'table',
      'passed',
      'openingCard',
      'deadline',
      'result',
      'step',
      'stockCount',
      'lastDiscard',
      'canEat',
      'canU',
    ]) ||
    g.rulesVersion !== 'phom-v1' ||
    !['playing', 'finished', 'cancelled'].includes(g.status as string) ||
    !cards(g.hand, 10) ||
    !Array.isArray(g.players) ||
    g.players.length < 2 ||
    g.players.length > 4 ||
    !g.players.every(
      (p) =>
        object(p) &&
        keys(p, [
          'uid',
          'count',
          'finished',
          'forfeited',
          'name',
          'balance',
          'eaten',
          'melds',
          'discards',
          'laid',
          'turns',
        ]) &&
        uid(p.uid) &&
        count(p.count, 10) &&
        typeof p.finished === 'boolean' &&
        typeof p.forfeited === 'boolean' &&
        (p.name === undefined ||
          (typeof p.name === 'string' && p.name.length <= 30)) &&
        (p.balance === undefined || Number.isSafeInteger(p.balance)) &&
        cards(p.eaten, 3) &&
        cards(p.discards, 4) &&
        typeof p.laid === 'boolean' &&
        count(p.turns, 4) &&
        Array.isArray(p.melds) &&
        p.melds.length <= 3 &&
        p.melds.every((m) => cards(m, 13) && m.length >= 3) &&
        new Set(p.melds.flat()).size === p.melds.flat().length,
    ) ||
    new Set(g.players.map((p) => p.uid)).size !== g.players.length ||
    !g.players.some((p) => p.uid === viewer) ||
    (g.turn !== null && !g.players.some((p) => p.uid === g.turn)) ||
    g.table !== null ||
    g.openingCard !== null ||
    !Array.isArray(g.passed) ||
    g.passed.length !== 0 ||
    (g.deadline !== null && !count(g.deadline, Number.MAX_SAFE_INTEGER)) ||
    !['draw', 'lay', 'discard'].includes(g.step as string) ||
    !count(g.stockCount, 33) ||
    typeof g.canEat !== 'boolean' ||
    typeof g.canU !== 'boolean'
  )
    return false;
  if (
    g.lastDiscard !== null &&
    (!object(g.lastDiscard) ||
      !keys(g.lastDiscard, ['uid', 'card', 'chot']) ||
      !uid(g.lastDiscard.uid) ||
      !count(g.lastDiscard.card, 51) ||
      typeof g.lastDiscard.chot !== 'boolean' ||
      !g.players.some(
        (p) => p.uid === (g.lastDiscard as Record<string, unknown>).uid,
      ))
  )
    return false;
  if ((g.canEat || g.canU) && (g.turn !== viewer || g.status !== 'playing'))
    return false;
  if (g.canEat && (g.step !== 'draw' || !g.lastDiscard)) return false;
  if (
    g.status === 'playing' &&
    (g.turn === null || g.deadline === null || g.result !== null)
  )
    return false;
  if (g.status !== 'playing' && (g.turn !== null || g.deadline !== null))
    return false;
  if (g.result !== null) {
    const r = g.result,
      ids = new Set(g.players.map((p) => p.uid));
    if (
      !object(r) ||
      !keys(r, ['reason', 'ranking']) ||
      typeof r.reason !== 'string' ||
      !Array.isArray(r.ranking) ||
      r.ranking.length > 4 ||
      !r.ranking.every(
        (p) =>
          object(p) &&
          keys(p, [
            'uid',
            'rank',
            'labels',
            'name',
            'remainingCards',
            'moneyDelta',
            'deadwoodPoints',
            'breakdown',
          ]) &&
          uid(p.uid) &&
          ids.has(p.uid) &&
          count(p.rank, 4) &&
          p.rank >= 1 &&
          Array.isArray(p.labels) &&
          p.labels.length <= 8 &&
          p.labels.every((s) => typeof s === 'string' && s.length <= 60) &&
          (p.name === undefined ||
            (typeof p.name === 'string' && p.name.length <= 30)) &&
          (p.remainingCards === undefined || count(p.remainingCards, 10)) &&
          Number.isSafeInteger(p.moneyDelta) &&
          count(p.deadwoodPoints, 130) &&
          Array.isArray(p.breakdown) &&
          p.breakdown.length <= 32 &&
          p.breakdown.every(
            (b) =>
              object(b) &&
              keys(b, ['kind', 'amount', 'otherUid']) &&
              [
                'eat',
                'chot',
                'mom',
                'forfeit',
                'rank-2',
                'rank-3',
                'rank-4',
                'u',
                'u-tron',
                'den',
              ].includes(b.kind as string) &&
              Number.isSafeInteger(b.amount) &&
              uid(b.otherUid) &&
              ids.has(b.otherUid),
          ),
      ) ||
      new Set(r.ranking.map((p) => p.uid)).size !== r.ranking.length
    )
      return false;
    if (g.status === 'finished' && r.ranking.length !== g.players.length)
      return false;
  } else if (g.status !== 'playing') return false;
  return true;
}
