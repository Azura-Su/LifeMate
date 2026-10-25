export const DEFAULT_VARIANT_CONFIG = Object.freeze({ pointsPerCard: 1 });
export const DEFAULT_NEW_VARIANT_CONFIG = Object.freeze({
  north: Object.freeze({
    rulesVersion: 'north-v2',
    pointsPerCard: 1,
    remainingTwoPoints: 2,
    cutTwoPoints: 3,
  }),
  sam: Object.freeze({
    rulesVersion: 'sam-v2',
    pointsPerCard: 1,
    samCallPoints: 20,
  }),
  tan: DEFAULT_VARIANT_CONFIG,
});

const exactKeys = (value, expected) =>
  Object.keys(value).length === expected.length &&
  expected.every((key) => Object.hasOwn(value, key));

const validRate = (value, allowZero = false) =>
  Number.isSafeInteger(value) &&
  value >= (allowZero ? 0 : 1) &&
  value <= 1_000_000_000;

export function validateVariantConfig(value, gameKind) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !validRate(value.pointsPerCard)
  )
    throw Error('invalid-input');

  if (exactKeys(value, ['pointsPerCard'])) return { pointsPerCard: value.pointsPerCard };

  if (
    value.rulesVersion === 'north-v2' &&
    exactKeys(value, [
      'rulesVersion',
      'pointsPerCard',
      'remainingTwoPoints',
      'cutTwoPoints',
    ]) &&
    validRate(value.remainingTwoPoints, true) &&
    validRate(value.cutTwoPoints, true) &&
    (gameKind === undefined || gameKind === 'north')
  )
    return {
      rulesVersion: 'north-v2',
      pointsPerCard: value.pointsPerCard,
      remainingTwoPoints: value.remainingTwoPoints,
      cutTwoPoints: value.cutTwoPoints,
    };

  if (
    value.rulesVersion === 'sam-v2' &&
    exactKeys(value, ['rulesVersion', 'pointsPerCard', 'samCallPoints']) &&
    validRate(value.samCallPoints, true) &&
    (gameKind === undefined || gameKind === 'sam')
  )
    return {
      rulesVersion: 'sam-v2',
      pointsPerCard: value.pointsPerCard,
      samCallPoints: value.samCallPoints,
    };

  throw Error('invalid-input');
}

function beginSettlement(ranking) {
  for (const result of ranking) {
    result.moneyDelta = 0;
    result.breakdown = [];
  }
}

function transfer(ranking, fromUid, toUid, amount, kind) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw Error('invalid-input');
  if (!amount || fromUid === toUid) return;
  const payer = ranking.find((result) => result.uid === fromUid);
  const payee = ranking.find((result) => result.uid === toUid);
  if (!payer || !payee) throw Error('invalid-input');
  payer.moneyDelta -= amount;
  payee.moneyDelta += amount;
  if (!Number.isSafeInteger(payer.moneyDelta) || !Number.isSafeInteger(payee.moneyDelta))
    throw Error('invalid-input');
  payer.breakdown.push({ kind, amount: -amount, otherUid: toUid });
  payee.breakdown.push({ kind, amount, otherUid: fromUid });
}

function assertZeroSum(ranking) {
  const total = ranking.reduce((sum, result) => sum + result.moneyDelta, 0);
  if (!Number.isSafeInteger(total) || total !== 0) throw Error('invalid-input');
}

function normalCardTransfers(ranking, pointsPerCard, winner, skipWinnerTransfer = false) {
  if (!winner || skipWinnerTransfer) return;
  for (const result of ranking) {
    if (result.uid === winner.uid) continue;
    transfer(
      ranking,
      result.uid,
      winner.uid,
      result.remainingCards * pointsPerCard,
      'remaining-cards',
    );
  }
}

export function settleNorthVariant(game, config) {
  const ranking = game.result?.ranking;
  if (!Array.isArray(ranking)) throw Error('invalid-input');
  beginSettlement(ranking);
  const winner = ranking.find(
    (result) => result.rank === 1 && !result.labels.includes('forfeit'),
  );
  normalCardTransfers(ranking, config.pointsPerCard, winner);

  const cardByUid = new Map(game.players.map((player) => [player.uid, player.hand]));
  for (const result of ranking) {
    const hand = cardByUid.get(result.uid) ?? [];
    const remainingTwos = hand.filter((card) => Math.floor(card / 4) === 12).length;
    result.remainingCards = hand.length;
    if (winner && result.uid !== winner.uid)
      transfer(
        ranking,
        result.uid,
        winner.uid,
        remainingTwos * config.remainingTwoPoints,
        'remaining-two',
      );
  }

  for (const event of game.cutTwoEvents ?? []) {
    transfer(
      ranking,
      event.from,
      event.to,
      event.count * config.cutTwoPoints,
      'cut-two',
    );
  }
  assertZeroSum(ranking);
}

export function settleSamVariant(game, config) {
  const ranking = game.result?.ranking;
  if (!Array.isArray(ranking)) throw Error('invalid-input');
  beginSettlement(ranking);
  const winner = ranking.find(
    (result) => result.rank === 1 && !result.labels.includes('forfeit'),
  );
  normalCardTransfers(
    ranking,
    config.pointsPerCard,
    winner,
    game.result.reason === 'sam-success',
  );

  if (['success', 'failed'].includes(game.samOutcome)) {
    const caller = game.callUid;
    const recipients = game.samCallRecipients;
    if (
      typeof caller !== 'string' ||
      !Array.isArray(recipients) ||
      new Set(recipients).size !== recipients.length ||
      recipients.includes(caller)
    )
      throw Error('invalid-input');
    for (const recipient of recipients)
      transfer(
        ranking,
        game.samOutcome === 'success' ? recipient : caller,
        game.samOutcome === 'success' ? caller : recipient,
        config.samCallPoints,
        'sam-report',
      );
  }
  assertZeroSum(ranking);
}
