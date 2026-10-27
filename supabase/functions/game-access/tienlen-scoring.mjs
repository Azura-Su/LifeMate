export const DEFAULT_SOUTH_CONFIG = Object.freeze({
  finishMode: 'continue',
  cutTwoAmount: 0,
  instantWinAmount: 0,
});

export function validateSouthConfig(config) {
  const legacy = config && Object.keys(config).length === 2;
  if (
    !config ||
    typeof config !== 'object' ||
    Array.isArray(config) ||
    (!legacy && Object.keys(config).length !== 3) ||
    !['continue', 'first-winner'].includes(config.finishMode) ||
    !Number.isSafeInteger(config.cutTwoAmount) ||
    config.cutTwoAmount < 0 ||
    config.cutTwoAmount > 1_000_000_000 ||
    (!legacy &&
      (!Number.isSafeInteger(config.instantWinAmount) ||
        config.instantWinAmount < 0 ||
        config.instantWinAmount > 1_000_000_000))
  )
    throw Error('invalid-input');
}
export function configuredSouth(config) {
  return (
    config !== undefined &&
    (config.finishMode !== 'continue' ||
      config.cutTwoAmount !== 0 ||
      (config.instantWinAmount ?? 0) !== 0)
  );
}

// Card penalties go to the first winner; chop transfers retain their actual payer/payee.
export function settleConfiguredSouth(
  game,
  amountPerCard,
  config = DEFAULT_SOUTH_CONFIG,
) {
  const ranking = game.result.ranking;
  const winner = ranking.find(
    (p) => p.rank === 1 && !p.labels.includes('forfeit'),
  );
  for (const p of ranking) {
    p.moneyDelta = 0;
    p.breakdown = [];
  }
  const transfer = (from, to, amount, kind) => {
    if (!amount || from === to) return;
    const payer = ranking.find((p) => p.uid === from),
      payee = ranking.find((p) => p.uid === to);
    if (!payer || !payee || !Number.isSafeInteger(amount) || amount < 0)
      throw Error('invalid-input');
    payer.moneyDelta -= amount;
    payee.moneyDelta += amount;
    payer.breakdown.push({ kind, amount: -amount, otherUid: to });
    payee.breakdown.push({ kind, amount, otherUid: from });
  };
  if (winner)
    for (const p of ranking) {
      if (p.uid !== winner.uid)
        transfer(
          p.uid,
          winner.uid,
          p.remainingCards * amountPerCard,
          'remaining-cards',
        );
    }
  if (
    winner?.labels.includes('instant-win') &&
    (config.instantWinAmount ?? 0) > 0
  )
    for (const p of ranking)
      if (p.uid !== winner.uid)
        transfer(p.uid, winner.uid, config.instantWinAmount, 'instant-win');
  for (const fee of game.cutTwoFees ?? [])
    transfer(fee.from, fee.to, fee.amount, 'cut-two');
  if (
    ranking.some((p) => !Number.isSafeInteger(p.moneyDelta)) ||
    ranking.reduce((s, p) => s + p.moneyDelta, 0) !== 0
  )
    throw Error('invalid-input');
}
