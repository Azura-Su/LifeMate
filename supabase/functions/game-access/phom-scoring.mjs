import { phomPoint } from './phom-melds.mjs';

export const DEFAULT_PHOM_CONFIG = Object.freeze({
  second: 1,
  third: 2,
  last: 3,
  eat: 1,
  chot: 4,
  mom: 4,
  u: 5,
  uTron: 10,
  den: 5,
  forfeit: 4,
});
export const DEFAULT_PHOM_OPTIONS = Object.freeze({
  tai: false,
  send: true,
  uDen: true,
});
export const phomOptions = (config) => config.options ?? DEFAULT_PHOM_OPTIONS;
export function validatePhomConfig(value) {
  const fields = Object.keys(DEFAULT_PHOM_CONFIG);
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !==
      fields.length + ('options' in value ? 1 : 0) ||
    fields.some(
      (k) =>
        !Number.isSafeInteger(value[k]) ||
        value[k] < 0 ||
        value[k] > 1_000_000_000,
    ) ||
    Object.keys(value).some((k) => ![...fields, 'options'].includes(k)) ||
    ('options' in value &&
      (!value.options ||
        typeof value.options !== 'object' ||
        Array.isArray(value.options) ||
        Object.keys(value.options).length !== 3 ||
        Object.keys(DEFAULT_PHOM_OPTIONS).some(
          (k) => typeof value.options[k] !== 'boolean',
        )))
  )
    throw Error('invalid-input');
  return structuredClone(value);
}

export function settlePhom(game, config) {
  const players = game.players;
  const points = (p) => p.hand.reduce((s, c) => s + phomPoint(c), 0);
  const allMom = players.filter((p) => !p.forfeited).every((p) => !p.melds.length);
  const tieOrder = (p) =>
    (!allMom && !p.melds.length ? p.lastDiscardOrder : undefined) ??
    p.laidOrder ??
    99;
  const order = [...players].sort((a, b) => {
    if (game.winnerUid) {
      if (a.uid === game.winnerUid) return -1;
      if (b.uid === game.winnerUid) return 1;
    }
    if (!!a.forfeited !== !!b.forfeited) return a.forfeited ? 1 : -1;
    const momA = !a.melds.length,
      momB = !b.melds.length;
    if (momA !== momB) return momA ? 1 : -1;
    return (
      (!momA && points(a) - points(b)) ||
      tieOrder(a) - tieOrder(b) ||
      players.indexOf(a) - players.indexOf(b)
    );
  });
  const entries = new Map(
    order.map((p, i) => [
      p.uid,
      {
        uid: p.uid,
        rank: i + 1,
        labels: [
          ...(p.forfeited ? ['forfeit'] : []),
          ...(!p.melds.length ? ['mom'] : []),
        ],
        deadwoodPoints: points(p),
        moneyDelta: 0,
        breakdown: [],
      },
    ]),
  );
  const winner = order[0].uid;
  function transfer(from, to, amount, kind) {
    if (!amount || from === to) return;
    const a = entries.get(from),
      b = entries.get(to);
    a.moneyDelta -= amount;
    b.moneyDelta += amount;
    a.breakdown.push({ kind, amount: -amount, otherUid: to });
    b.breakdown.push({ kind, amount, otherUid: from });
  }
  for (const fee of game.fees ?? [])
    transfer(fee.from, fee.to, fee.amount, fee.kind);
  const u = ['u', 'u-tron'].includes(game.winKind);
  const payer =
    u &&
    players.find(
      (p) => p.uid === game.penaltyUid && !p.forfeited && p.uid !== winner,
    );
  let denTotal = 0;
  for (const [i, p] of order.entries()) {
    if (!i) continue;
    if (p.forfeited) transfer(p.uid, winner, config.forfeit, 'forfeit');
    else if (u && payer) denTotal += config.den;
    else if (u)
      transfer(
        p.uid,
        winner,
        game.winKind === 'u-tron' ? config.uTron : config.u,
        game.winKind,
      );
    else
      transfer(
        p.uid,
        winner,
        !p.melds.length
          ? config.mom
          : config[['second', 'third', 'last'][i - 1]],
        !p.melds.length ? 'mom' : `rank-${i + 1}`,
      );
  }
  if (denTotal) transfer(payer.uid, winner, denTotal, 'den');
  if (u) entries.get(winner).labels = [game.winKind];
  if (payer) entries.get(payer.uid).labels.push('den');
  return [...entries.values()];
}
