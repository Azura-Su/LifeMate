import type {
  GameResult,
  SamView,
  TanView,
  TienLenNorthView,
} from '../../types/cardGame';

export const DEFAULT_VARIANT_GAME_CONFIG = Object.freeze({ pointsPerCard: 1 });

export const DEFAULT_NEW_VARIANT_GAME_CONFIG = Object.freeze({
  north: Object.freeze({
    rulesVersion: 'north-v2' as const,
    pointsPerCard: 1,
    remainingTwoPoints: 2,
    cutTwoPoints: 3,
  }),
  sam: Object.freeze({
    rulesVersion: 'sam-v2' as const,
    pointsPerCard: 1,
    samCallPoints: 20,
  }),
  tan: DEFAULT_VARIANT_GAME_CONFIG,
});

export type VariantGameKind = 'north' | 'sam' | 'tan';

export function defaultVariantConfigForGame(gameKind: VariantGameKind) {
  return { ...DEFAULT_NEW_VARIANT_GAME_CONFIG[gameKind] };
}

export function isVariantGameConfig(
  value: unknown,
  gameKind: VariantGameKind,
): value is import('../../types/cardGame').VariantGameConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const config = value as Record<string, unknown>;
  const validRate = (rate: unknown, allowZero = false) =>
    Number.isSafeInteger(rate) &&
    (rate as number) >= (allowZero ? 0 : 1) &&
    (rate as number) <= 1_000_000_000;
  if (!validRate(config.pointsPerCard)) return false;

  if (gameKind === 'tan')
    return Object.keys(config).length === 1;
  if (Object.keys(config).length === 1) return true;
  if (gameKind === 'north')
    return (
      Object.keys(config).length === 4 &&
      config.rulesVersion === 'north-v2' &&
      validRate(config.remainingTwoPoints, true) &&
      validRate(config.cutTwoPoints, true)
    );
  return (
    Object.keys(config).length === 3 &&
    config.rulesVersion === 'sam-v2' &&
    validRate(config.samCallPoints, true)
  );
}

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));
const uid = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const count = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
const cards = (value: unknown, max: number): value is number[] =>
  Array.isArray(value) &&
  value.length <= max &&
  new Set(value).size === value.length &&
  value.every((card) => count(card, 51));

function isResult(
  value: unknown,
  playerIds: Set<string>,
  remainingMax: number,
): value is GameResult {
  if (
    !object(value) ||
    !keys(value, ['reason', 'ranking']) ||
    typeof value.reason !== 'string' ||
    !Array.isArray(value.ranking) ||
    value.ranking.length > 4 ||
    !value.ranking.every(
      (result) =>
        object(result) &&
        keys(result, [
          'uid',
          'rank',
          'labels',
          'name',
          'remainingCards',
          'moneyDelta',
          'deadwoodPoints',
          'breakdown',
        ]) &&
        uid(result.uid) &&
        playerIds.has(result.uid) &&
        count(result.rank, 4) &&
        result.rank >= 1 &&
        Array.isArray(result.labels) &&
        result.labels.length <= 8 &&
        result.labels.every((label) => typeof label === 'string' && label.length <= 60) &&
        (result.name === undefined ||
          (typeof result.name === 'string' && result.name.length <= 30)) &&
        (result.remainingCards === undefined ||
          count(result.remainingCards, remainingMax)) &&
        (result.moneyDelta === undefined || Number.isSafeInteger(result.moneyDelta)) &&
        (result.deadwoodPoints === undefined || count(result.deadwoodPoints, 52)) &&
        (result.breakdown === undefined ||
          (Array.isArray(result.breakdown) &&
            result.breakdown.length <= 12 &&
            result.breakdown.every(
              (entry) =>
                object(entry) &&
                keys(entry, ['kind', 'amount', 'otherUid']) &&
                ['remaining-cards', 'remaining-two', 'cut-two', 'sam-report'].includes(
                  entry.kind as string,
                ) &&
                Number.isSafeInteger(entry.amount) &&
                uid(entry.otherUid) &&
                playerIds.has(entry.otherUid),
            ))),
    ) ||
    new Set(value.ranking.map((result) => result.uid)).size !== value.ranking.length
  )
    return false;
  return true;
}

function hasBalancedBreakdowns(value: unknown) {
  if (!object(value) || !Array.isArray(value.ranking)) return false;
  const ranking = value.ranking as Record<string, unknown>[];
  const totalDelta = ranking.reduce(
    (sum, result) => sum + Number(result.moneyDelta),
    0,
  );
  return (
    ranking.every((result) => {
      if (!Number.isSafeInteger(result.moneyDelta) || !Array.isArray(result.breakdown))
        return false;
      const total = (result.breakdown as { amount: number }[]).reduce(
        (sum, item) => sum + item.amount,
        0,
      );
      return Number.isSafeInteger(total) && total === result.moneyDelta;
    }) &&
    Number.isSafeInteger(totalDelta) &&
    totalDelta === 0
  );
}

function isPlayers(value: unknown, maxCards: number, viewer: string) {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    value.length > 4 ||
    !value.every(
      (player) =>
        object(player) &&
        keys(player, ['uid', 'count', 'finished', 'forfeited', 'name', 'balance']) &&
        uid(player.uid) &&
        count(player.count, maxCards) &&
        typeof player.finished === 'boolean' &&
        typeof player.forfeited === 'boolean' &&
        (player.name === undefined ||
          (typeof player.name === 'string' && player.name.length <= 30)) &&
        (player.balance === undefined || Number.isSafeInteger(player.balance)),
    ) ||
    new Set(value.map((player) => player.uid)).size !== value.length ||
    !value.some((player) => player.uid === viewer)
  )
    return null;
  return new Set(value.map((player) => player.uid as string));
}

function isCommonView(
  value: unknown,
  viewer: string,
  rulesVersions: string[],
  handMax: number,
  extras: string[],
) {
  if (
    !object(value) ||
    !keys(value, [
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
      ...extras,
    ]) ||
    !rulesVersions.includes(value.rulesVersion as string) ||
    !['playing', 'finished', 'cancelled'].includes(value.status as string) ||
    !cards(value.hand, handMax) ||
    !Array.isArray(value.passed) ||
    !value.passed.every(uid) ||
    (value.turn !== null && !uid(value.turn)) ||
    (value.openingCard !== null && !count(value.openingCard, 51)) ||
    (value.deadline !== null && !count(value.deadline, Number.MAX_SAFE_INTEGER))
  )
    return null;

  const playerIds = isPlayers(value.players, handMax, viewer);
  if (!playerIds || !value.passed.every((playerUid) => playerIds.has(playerUid)))
    return null;
  const ownPlayer = (value.players as { uid: string; count: number }[]).find(
    (player) => player.uid === viewer,
  );
  if (
    ownPlayer?.count !== (value.hand as number[]).length &&
    !(value.status !== 'playing' && (value.hand as number[]).length === 0)
  )
    return null;
  if (value.turn !== null && !playerIds.has(value.turn)) return null;
  if (value.result !== null && !isResult(value.result, playerIds, handMax)) return null;
  if (
    (value.status === 'playing' &&
      (value.turn === null || value.deadline === null || value.result !== null)) ||
    (value.status !== 'playing' &&
      (value.turn !== null || value.deadline !== null || value.result === null))
  )
    return null;
  return { playerIds, value };
}

export function isTienLenNorthView(
  value: unknown,
  viewer: string,
): value is TienLenNorthView {
  const common = isCommonView(value, viewer, ['north-v1', 'north-v2'], 13, []);
  if (!common) return false;
  const game = common.value;
  const hand = game.hand as number[];
  if (
    game.table !== null &&
    (!object(game.table) ||
      !keys(game.table, ['uid', 'cards']) ||
      !uid(game.table.uid) ||
      !common.playerIds.has(game.table.uid) ||
      !cards(game.table.cards, 13) ||
      game.table.cards.length === 0 ||
      game.table.cards.some((card) => hand.includes(card)))
  )
    return false;
  if (
    game.rulesVersion === 'north-v2' &&
    game.status === 'finished' &&
    !hasBalancedBreakdowns(game.result)
  )
    return false;
  return true;
}

export function isSamView(value: unknown, viewer: string): value is SamView {
  const common = isCommonView(value, viewer, ['sam-v1', 'sam-v2'], 10, [
    'step',
    'reportOrder',
    'reported',
    'reportedSam',
    'callUid',
    'samOutcome',
  ]);
  if (!common) return false;
  const game = common.value;
  const hand = game.hand as number[];
  const reportOrder = game.reportOrder as string[];
  if (
    !['report-sam', 'play'].includes(game.step as string) ||
    !Array.isArray(game.reportOrder) ||
    game.reportOrder.length > 4 ||
    new Set(game.reportOrder).size !== game.reportOrder.length ||
    !game.reportOrder.every(
      (playerUid) => uid(playerUid) && common.playerIds.has(playerUid),
    ) ||
    !Array.isArray(game.reported) ||
    game.reported.length > 4 ||
    new Set(game.reported).size !== game.reported.length ||
    !game.reported.every(
      (playerUid) => uid(playerUid) && common.playerIds.has(playerUid),
    ) ||
    game.reported.some(
      (playerUid) => !reportOrder.includes(playerUid),
    ) ||
    typeof game.reportedSam !== 'boolean' ||
    (game.callUid !== null && (!uid(game.callUid) || !common.playerIds.has(game.callUid))) ||
    ![null, 'pending', 'success', 'failed', 'aborted'].includes(game.samOutcome as string | null)
  )
    return false;
  if (
    (game.step === 'report-sam' &&
      (game.callUid !== null || game.reportedSam || game.samOutcome !== null)) ||
    (game.step === 'play' &&
      (game.reportOrder.length !== 0 ||
        game.reported.length !== 0 ||
        (game.callUid === null
          ? game.reportedSam || game.samOutcome !== null
          : !game.reportedSam || game.samOutcome === null)))
  )
    return false;
  if (
    game.table !== null &&
    (!object(game.table) ||
      !keys(game.table, ['uid', 'cards']) ||
      !uid(game.table.uid) ||
      !common.playerIds.has(game.table.uid) ||
      !cards(game.table.cards, 10) ||
      game.table.cards.length === 0 ||
      game.table.cards.some((card) => hand.includes(card)))
  )
    return false;
  if (
    game.rulesVersion === 'sam-v2' &&
    game.status === 'finished' &&
    !hasBalancedBreakdowns(game.result)
  )
    return false;
  return true;
}

export function isTanView(value: unknown, viewer: string): value is TanView {
  if (
    !object(value) ||
    !keys(value, [
      'rulesVersion',
      'status',
      'step',
      'hand',
      'players',
      'stockCount',
      'trumpCard',
      'trumpSuit',
      'attackerUid',
      'defenderUid',
      'turn',
      'maxAttackCards',
      'table',
      'deadline',
      'result',
    ]) ||
    value.rulesVersion !== 'tan-v1' ||
    !['playing', 'finished', 'cancelled'].includes(value.status as string) ||
    !['attack', 'defend', 'finished'].includes(value.step as string) ||
    !cards(value.hand, 52) ||
    !count(value.stockCount, 36) ||
    (value.trumpCard !== null && !count(value.trumpCard, 51)) ||
    !count(value.trumpSuit, 3) ||
    (value.attackerUid !== null && !uid(value.attackerUid)) ||
    (value.defenderUid !== null && !uid(value.defenderUid)) ||
    (value.turn !== null && !uid(value.turn)) ||
    !count(value.maxAttackCards, 8) ||
    value.maxAttackCards < 1 ||
    !Array.isArray(value.table) ||
    value.table.length > 8 ||
    (value.deadline !== null && !count(value.deadline, Number.MAX_SAFE_INTEGER))
  )
    return false;

  const playerIds = isPlayers(value.players, 52, viewer);
  if (
    !playerIds ||
    ((value.players as { uid: string; count: number }[]).find(
      (player) => player.uid === viewer,
    )?.count !== (value.hand as number[]).length &&
      !(value.status !== 'playing' && (value.hand as number[]).length === 0)) ||
    (value.turn !== null && !playerIds.has(value.turn)) ||
    (value.attackerUid !== null && !playerIds.has(value.attackerUid)) ||
    (value.defenderUid !== null && !playerIds.has(value.defenderUid)) ||
    !value.table.every(
      (entry) =>
        object(entry) &&
        keys(entry, ['attackCard', 'defenseCard', 'attackerUid']) &&
        count(entry.attackCard, 51) &&
        (entry.defenseCard === null || count(entry.defenseCard, 51)) &&
        uid(entry.attackerUid) &&
        playerIds.has(entry.attackerUid),
    )
  )
    return false;
  const tableCards = value.table.flatMap((entry) =>
    entry.defenseCard === null
      ? [entry.attackCard]
      : [entry.attackCard, entry.defenseCard],
  );
  const hand = value.hand as number[];
  if (
    new Set(tableCards).size !== tableCards.length ||
    tableCards.some((card) => hand.includes(card))
  )
    return false;
  if (value.result !== null && !isResult(value.result, playerIds, 52)) return false;
  if (
    (value.status === 'playing' &&
      (value.turn === null || value.deadline === null || value.result !== null)) ||
    (value.status !== 'playing' &&
      (value.turn !== null || value.deadline !== null || value.result === null)) ||
    (value.status === 'playing' &&
      (value.step === 'finished' ||
        value.attackerUid === null ||
        value.defenderUid === null)) ||
    (value.step === 'defend' && value.turn !== value.defenderUid) ||
    (value.step === 'attack' && value.turn === value.defenderUid)
  )
    return false;
  return true;
}
