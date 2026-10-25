import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_VARIANT_CONFIG,
  DEFAULT_NEW_VARIANT_CONFIG,
  settleNorthVariant,
  settleSamVariant,
  validateVariantConfig,
} from '../game-access/variant-scoring.mjs';

test('variant defaults keep persisted v1 rooms separate from new profiles', () => {
  assert.deepEqual(DEFAULT_VARIANT_CONFIG, { pointsPerCard: 1 });
  assert.deepEqual(DEFAULT_NEW_VARIANT_CONFIG.north, {
    rulesVersion: 'north-v2',
    pointsPerCard: 1,
    remainingTwoPoints: 2,
    cutTwoPoints: 3,
  });
  assert.deepEqual(DEFAULT_NEW_VARIANT_CONFIG.sam, {
    rulesVersion: 'sam-v2',
    pointsPerCard: 1,
    samCallPoints: 20,
  });
  assert.deepEqual(DEFAULT_NEW_VARIANT_CONFIG.tan, { pointsPerCard: 1 });
});

test('variant configs validate strictly for their game while accepting legacy v1 configs', () => {
  assert.deepEqual(validateVariantConfig({ pointsPerCard: 4 }, 'north'), {
    pointsPerCard: 4,
  });
  assert.deepEqual(
    validateVariantConfig(
      {
        rulesVersion: 'north-v2',
        pointsPerCard: 5,
        remainingTwoPoints: 2,
        cutTwoPoints: 3,
      },
      'north',
    ),
    {
      rulesVersion: 'north-v2',
      pointsPerCard: 5,
      remainingTwoPoints: 2,
      cutTwoPoints: 3,
    },
  );
  assert.deepEqual(
    validateVariantConfig(
      { rulesVersion: 'sam-v2', pointsPerCard: 1, samCallPoints: 20 },
      'sam',
    ),
    { rulesVersion: 'sam-v2', pointsPerCard: 1, samCallPoints: 20 },
  );
  assert.deepEqual(validateVariantConfig({ pointsPerCard: 2 }, 'tan'), {
    pointsPerCard: 2,
  });

  for (const [kind, config] of [
    ['north', { rulesVersion: 'sam-v2', pointsPerCard: 1, samCallPoints: 20 }],
    ['north', { rulesVersion: 'north-v2', pointsPerCard: 1, remainingTwoPoints: -1, cutTwoPoints: 3 }],
    ['north', { rulesVersion: 'north-v2', pointsPerCard: 1, remainingTwoPoints: 1.5, cutTwoPoints: 3 }],
    ['sam', { rulesVersion: 'sam-v2', pointsPerCard: 1, samCallPoints: 1_000_000_001 }],
    ['tan', { pointsPerCard: 1, samCallPoints: 20 }],
    ['north', { pointsPerCard: 1, cash: true }],
  ])
    assert.throws(() => validateVariantConfig(config, kind), /invalid-input/);
});

test('North v2 adds remaining-2 points and pays a legal 2-cut transfer once', () => {
  const game = {
    rulesVersion: 'north-v2',
    players: [
      { uid: 'a', hand: [] },
      { uid: 'b', hand: [48, 0] },
      { uid: 'c', hand: [51, 4] },
    ],
    cutTwoEvents: [{ from: 'b', to: 'c', count: 1 }],
    result: {
      ranking: [
        { uid: 'a', rank: 1, labels: [], remainingCards: 0 },
        { uid: 'b', rank: 2, labels: [], remainingCards: 2 },
        { uid: 'c', rank: 3, labels: [], remainingCards: 2 },
      ],
    },
  };
  settleNorthVariant(game, {
    rulesVersion: 'north-v2',
    pointsPerCard: 5,
    remainingTwoPoints: 2,
    cutTwoPoints: 3,
  });

  assert.deepEqual(
    game.result.ranking.map((result) => [result.uid, result.moneyDelta]),
    [
      ['a', 24],
      ['b', -15],
      ['c', -9],
    ],
  );
  assert.deepEqual(
    game.result.ranking.map((result) => result.breakdown.reduce((sum, part) => sum + part.amount, 0)),
    [24, -15, -9],
  );
  assert.equal(
    game.result.ranking.reduce((sum, result) => sum + result.moneyDelta, 0),
    0,
  );
});

test('Sâm v2 pays successful báo Sâm only once and charges failed báo plus normal cards', () => {
  const successful = {
    samOutcome: 'success',
    callUid: 'a',
    samCallRecipients: ['b', 'c'],
    result: {
      reason: 'sam-success',
      ranking: [
        { uid: 'a', rank: 1, labels: [], remainingCards: 0 },
        { uid: 'b', rank: 2, labels: [], remainingCards: 5 },
        { uid: 'c', rank: 3, labels: [], remainingCards: 5 },
      ],
    },
  };
  settleSamVariant(successful, { pointsPerCard: 5, samCallPoints: 20 });
  assert.deepEqual(
    successful.result.ranking.map((result) => result.moneyDelta),
    [40, -20, -20],
  );

  const failed = {
    samOutcome: 'failed',
    callUid: 'a',
    samCallRecipients: ['b', 'c'],
    result: {
      reason: 'played-out',
      ranking: [
        { uid: 'b', rank: 1, labels: [], remainingCards: 0 },
        { uid: 'a', rank: 2, labels: [], remainingCards: 2 },
        { uid: 'c', rank: 3, labels: [], remainingCards: 1 },
      ],
    },
  };
  settleSamVariant(failed, { pointsPerCard: 5, samCallPoints: 20 });
  assert.deepEqual(
    failed.result.ranking.map((result) => result.moneyDelta),
    [35, -50, 15],
  );
  assert.equal(
    failed.result.ranking.reduce((sum, result) => sum + result.moneyDelta, 0),
    0,
  );

  const aborted = {
    samOutcome: 'aborted',
    callUid: 'a',
    samCallRecipients: ['b', 'c'],
    result: {
      reason: 'forfeit',
      ranking: [
        { uid: 'b', rank: 1, labels: [], remainingCards: 1 },
        { uid: 'a', rank: 2, labels: ['forfeit'], remainingCards: 5 },
      ],
    },
  };
  settleSamVariant(aborted, { pointsPerCard: 1, samCallPoints: 20 });
  assert.equal(aborted.result.ranking[1].breakdown.some((part) => part.kind === 'sam-report'), false);
});
