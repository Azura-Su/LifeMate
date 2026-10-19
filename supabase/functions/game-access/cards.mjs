// The server owns the deck. Rejection sampling avoids modulo bias.
export function randomInt(
  max,
  entropy = (bytes) => crypto.getRandomValues(bytes),
) {
  const bytes = new Uint32Array(1);
  const limit = 0x100000000 - (0x100000000 % max);
  do {
    entropy(bytes);
  } while (bytes[0] >= limit);
  return bytes[0] % max;
}

export function shuffledDeck(entropy) {
  const cards = Array.from({ length: 52 }, (_, i) => i);
  for (let i = cards.length - 1; i > 0; i--) {
    const other = randomInt(i + 1, entropy);
    [cards[i], cards[other]] = [cards[other], cards[i]];
  }
  return cards;
}

export function validCards(cards) {
  return (
    Array.isArray(cards) &&
    cards.length > 0 &&
    cards.length <= 52 &&
    cards.every((card) => Number.isInteger(card) && card >= 0 && card < 52) &&
    new Set(cards).size === cards.length
  );
}

export const rank = (card) => Math.floor(card / 4);
