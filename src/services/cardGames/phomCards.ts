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
