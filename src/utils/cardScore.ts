import type {
  CardScoreMatch,
  CardScorePlayer,
  CardScoreRound,
} from '../types/cardScore';

export const MIN_CARD_SCORE_PLAYERS = 2;
export const MAX_CARD_SCORE_PLAYERS = 8;

export function validatePlayerNames(names: string[]) {
  const trimmed = names.map((name) => name.trim());
  if (trimmed.length < MIN_CARD_SCORE_PLAYERS)
    return 'Cần ít nhất 2 người chơi.';
  if (trimmed.length > MAX_CARD_SCORE_PLAYERS)
    return `Mỗi bàn chơi tối đa ${MAX_CARD_SCORE_PLAYERS} người.`;
  if (trimmed.some((name) => !name)) return 'Nhập tên cho tất cả người chơi.';
  const distinct = new Set(
    trimmed.map((name) => name.toLocaleLowerCase('vi-VN')),
  );
  if (distinct.size !== trimmed.length)
    return 'Tên người chơi không được trùng nhau.';
  return null;
}

export function calculatePlayerTotals(
  players: CardScorePlayer[],
  rounds: CardScoreRound[],
) {
  const totals = Object.fromEntries(players.map(({ id }) => [id, 0]));
  rounds.forEach((round) => {
    players.forEach(({ id }) => {
      const score = round.scores[id] ?? 0;
      if (Number.isInteger(score)) totals[id] += score;
    });
  });
  return totals;
}

export function calculateRoundTotal(
  players: CardScorePlayer[],
  round: CardScoreRound,
) {
  return players.reduce((total, { id }) => total + (round.scores[id] ?? 0), 0);
}

export function validateRoundScores(
  playerIds: string[],
  values: Record<string, string>,
) {
  const scores: Record<string, number> = {};
  for (const playerId of playerIds) {
    const raw = values[playerId]?.trim() ?? '';
    if (!/^[+-]?\d+$/.test(raw))
      return {
        error: 'Nhập điểm nguyên có thể âm hoặc dương cho từng người chơi.',
      } as const;
    const score = Number(raw);
    if (!Number.isSafeInteger(score))
      return {
        error: 'Điểm mỗi ván phải nằm trong phạm vi số nguyên hợp lệ.',
      } as const;
    scores[playerId] = score;
  }
  return { scores } as const;
}

export function drawCardScoreSeats(
  players: CardScorePlayer[],
  random: () => number = Math.random,
) {
  const seatOrder = players.map(({ id }) => id);
  for (let index = seatOrder.length - 1; index > 0; index -= 1) {
    const value = random();
    const swapIndex = Math.min(
      index,
      Math.max(0, Math.floor(value * (index + 1))),
    );
    [seatOrder[index], seatOrder[swapIndex]] = [
      seatOrder[swapIndex],
      seatOrder[index],
    ];
  }
  return { seatOrder, dealerPlayerId: seatOrder[0] ?? '' };
}

export function isCardScoreMatch(value: unknown): value is CardScoreMatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const match = value as Partial<CardScoreMatch>;
  if (
    typeof match.id !== 'string' ||
    !match.id ||
    typeof match.title !== 'string' ||
    !match.title.trim() ||
    match.title.trim().length > 60 ||
    !Array.isArray(match.players) ||
    match.players.length < MIN_CARD_SCORE_PLAYERS ||
    match.players.length > MAX_CARD_SCORE_PLAYERS ||
    !Array.isArray(match.seatOrder) ||
    !Array.isArray(match.rounds) ||
    !['active', 'finished'].includes(match.status ?? '') ||
    !Number.isFinite(match.createdAt) ||
    !Number.isFinite(match.updatedAt)
  )
    return false;

  const playerIds = new Set<string>();
  for (const player of match.players) {
    if (
      !player ||
      typeof player.id !== 'string' ||
      !player.id ||
      typeof player.name !== 'string' ||
      !player.name.trim() ||
      playerIds.has(player.id)
    )
      return false;
    playerIds.add(player.id);
  }
  if (
    match.seatOrder.length !== playerIds.size ||
    new Set(match.seatOrder).size !== playerIds.size ||
    match.seatOrder.some((id) => !playerIds.has(id)) ||
    typeof match.dealerPlayerId !== 'string' ||
    !playerIds.has(match.dealerPlayerId)
  )
    return false;

  return match.rounds.every((round) => {
    if (
      !round ||
      typeof round.id !== 'string' ||
      !round.id ||
      !Number.isFinite(round.createdAt) ||
      !round.scores ||
      typeof round.scores !== 'object' ||
      Array.isArray(round.scores)
    )
      return false;
    return Object.entries(round.scores).every(
      ([id, score]) => playerIds.has(id) && Number.isSafeInteger(score),
    );
  });
}
