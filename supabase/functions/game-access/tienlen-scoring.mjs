export const DEFAULT_SOUTH_CONFIG = Object.freeze({
  finishMode: 'continue',
  cutTwoAmount: 0,
});

export function validateSouthConfig(config) {
  if (
    !config ||
    typeof config !== 'object' ||
    Array.isArray(config) ||
    Object.keys(config).length !== 2 ||
    !['continue', 'first-winner'].includes(config.finishMode) ||
    !Number.isSafeInteger(config.cutTwoAmount) ||
    config.cutTwoAmount < 0 ||
    config.cutTwoAmount > 1_000_000_000
  )
    throw Error('invalid-input');
}
export function configuredSouth(config) {
  return (
    config !== undefined &&
    (config.finishMode !== 'continue' || config.cutTwoAmount !== 0)
  );
}

// Card penalties go to the first winner; chop transfers retain their actual payer/payee.
export function settleConfiguredSouth(game, amountPerCard) {
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
  for (const fee of game.cutTwoFees ?? [])
    transfer(fee.from, fee.to, fee.amount, 'cut-two');
  if (
    ranking.some((p) => !Number.isSafeInteger(p.moneyDelta)) ||
    ranking.reduce((s, p) => s + p.moneyDelta, 0) !== 0
  )
    throw Error('invalid-input');
}
