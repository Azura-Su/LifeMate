export const phomRank = (card: number) => ((Math.floor(card / 4) + 2) % 13) + 1;
export function canSendPhomCard(group: number[], card: number) {
  const cards = [...group, card];
  if (new Set(cards).size !== cards.length) return false;
  const ranks = cards.map(phomRank).sort((a, b) => a - b);
  return (
    (new Set(ranks).size === 1 && cards.length <= 4) ||
    (cards.every((c) => c % 4 === cards[0] % 4) &&
      ranks.every((rank, i) => !i || rank === ranks[i - 1] + 1))
  );
}

// Presentation only: the server's canEat flag still decides whether eating is allowed.
export function getPhomEatHint(
  hand: readonly number[],
  eaten: readonly number[],
  discard: number,
): number[] {
  if (hand.includes(discard)) return [];
  const groups = groupEatenCards(
    [...hand, discard],
    [discard, ...eaten.filter((card) => hand.includes(card))],
  );
  return groups?.[0].filter((card) => card !== discard) ?? [];
}

function groupEatenCards(
  hand: readonly number[],
  required: readonly number[],
): number[][] | null {
  if (!required.length) return [];
  const target = required[0];
  // Each meld can contain only one eaten card. A three-card subset is enough
  // for a hint, leaving the other cards available for earlier eaten cards.
  const available = hand.filter((card) => !required.includes(card));
  for (let i = 0; i < available.length; i++) {
    for (let j = i + 1; j < available.length; j++) {
      const pair = [available[i], available[j]];
      if (!canSendPhomCard(pair, target)) continue;
      const rest = groupEatenCards(
        hand.filter((card) => card !== target && !pair.includes(card)),
        required.slice(1),
      );
      if (rest) return [[...pair, target], ...rest];
    }
  }
  return null;
}
