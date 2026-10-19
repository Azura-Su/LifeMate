import type { TienLenView } from '../../types/cardGame';

type TienLenCombination = {
  kind: 'single' | 'pair' | 'triple' | 'quad' | 'straight' | 'pairs';
  size: number;
  high: number;
};

const rank = (card: number) => Math.floor(card / 4);
const validCards = (cards: number[]) =>
  cards.length > 0 &&
  cards.length <= 52 &&
  new Set(cards).size === cards.length &&
  cards.every((card) => Number.isInteger(card) && card >= 0 && card < 52);

// Keep this classifier aligned with the pinned south-v1 server rules.
export function classifyTienLen(input: number[]): TienLenCombination | null {
  if (!validCards(input)) return null;
  const cards = [...input].sort((a, b) => a - b);
  const ranks = [...new Set(cards.map(rank))];
  let kind: TienLenCombination['kind'] | undefined;
  if (ranks.length === 1 && cards.length <= 4)
    kind = (['single', 'pair', 'triple', 'quad'] as const)[cards.length - 1];
  const consecutive =
    ranks[ranks.length - 1] < 12 &&
    ranks.every((value, index) =>
      index === 0 ? true : value === ranks[index - 1] + 1,
    );
  if (cards.length >= 3 && ranks.length === cards.length && consecutive)
    kind = 'straight';
  if (
    [6, 8].includes(cards.length) &&
    consecutive &&
    ranks.length === cards.length / 2 &&
    ranks.every(
      (value) => cards.filter((card) => rank(card) === value).length === 2,
    )
  )
    kind = 'pairs';
  return kind
    ? { kind, size: cards.length, high: cards[cards.length - 1] }
    : null;
}

export function canBeatTienLen(input: number[], previous: number[]) {
  const next = classifyTienLen(input);
  const last = classifyTienLen(previous);
  if (!next || !last) return false;
  if (next.kind === last.kind && next.size === last.size)
    return next.high > last.high;
  const two = rank(last.high) === 12;
  if (next.kind === 'pairs' && next.size === 6)
    return last.kind === 'single' && two;
  if (next.kind === 'quad')
    return (
      (['single', 'pair'].includes(last.kind) && two) ||
      (last.kind === 'pairs' && last.size === 6)
    );
  if (next.kind === 'pairs' && next.size === 8)
    return (
      (['single', 'pair', 'triple'].includes(last.kind) && two) ||
      last.kind === 'quad' ||
      (last.kind === 'pairs' && last.size === 6)
    );
  return false;
}

export function canPlayTienLenSelection(
  cards: number[],
  game: TienLenView,
  uid: string,
) {
  if (game.status !== 'playing') return false;
  const player = game.players.find((candidate) => candidate.uid === uid);
  if (!player || player.finished || player.forfeited) return false;
  const combination = classifyTienLen(cards);
  if (!combination || !cards.every((card) => game.hand.includes(card)))
    return false;
  const interrupt =
    combination.kind === 'pairs' &&
    combination.size === 8 &&
    !!game.table &&
    game.table.uid !== uid &&
    canBeatTienLen(cards, game.table.cards);
  if ((game.turn !== uid || game.passed.includes(uid)) && !interrupt)
    return false;
  if (game.openingCard !== null && !cards.includes(game.openingCard))
    return false;
  return !game.table || canBeatTienLen(cards, game.table.cards);
}
