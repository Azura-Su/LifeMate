import { validCards } from './cards.mjs';

// Card IDs stay identical to Tiến lên; only rank order differs (A is low).
export const phomPoint = (card) => ((Math.floor(card / 4) + 2) % 13) + 1;
export function isPhom(cards) {
  if (!validCards(cards) || cards.length < 3) return false;
  const ranks = cards.map(phomPoint).sort((a, b) => a - b);
  if (new Set(ranks).size === 1) return cards.length <= 4;
  return (
    cards.every((c) => c % 4 === cards[0] % 4) &&
    ranks.every((r, i) => !i || r === ranks[i - 1] + 1)
  );
}

/** Exhaustive on at most ten cards, memoized by remaining bit mask. */
export function findPhomLayout(hand, eaten = []) {
  if (
    hand.length > 10 ||
    (hand.length && !validCards(hand)) ||
    eaten.some((c) => !hand.includes(c))
  )
    return null;
  const n = hand.length,
    required = new Set(eaten),
    candidates = [];
  for (let mask = 1; mask < 1 << n; mask++) {
    const group = hand.filter((_, i) => mask & (1 << i));
    if (
      group.length >= 3 &&
      group.filter((c) => required.has(c)).length <= 1 &&
      isPhom(group)
    )
      candidates.push({ mask, cards: group });
  }
  const cache = new Map();
  function best(mask) {
    if (!mask) return { melds: [], loose: [], points: 0 };
    if (cache.has(mask)) return cache.get(mask);
    const first = hand.findIndex((_, i) => mask & (1 << i));
    let result = null;
    if (!required.has(hand[first])) {
      const rest = best(mask & ~(1 << first));
      if (rest)
        result = {
          melds: rest.melds,
          loose: [hand[first], ...rest.loose],
          points: phomPoint(hand[first]) + rest.points,
        };
    }
    for (const group of candidates)
      if (group.mask & (1 << first) && (group.mask & mask) === group.mask) {
        const rest = best(mask ^ group.mask);
        if (
          rest &&
          (!result ||
            rest.points < result.points ||
            (rest.points === result.points &&
              rest.loose.length < result.loose.length))
        )
          result = {
            melds: [group.cards, ...rest.melds],
            loose: rest.loose,
            points: rest.points,
          };
      }
    cache.set(mask, result);
    return result;
  }
  return best((1 << n) - 1);
}
