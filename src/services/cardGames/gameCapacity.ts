import type { CardGameRoom } from '../../types/cardGame';

/** Capacities for the existing single-deck rules, not arbitrary room sizes. */
export function gameCapacity(kind: unknown): number {
  return kind === 'sam' ? 5 : kind === 'tan' ? 6 : 4;
}

export function requiresLargeTableClient(
  room: CardGameRoom | null | undefined,
): boolean {
  return (
    (room?.members.length ?? 0) > 4 || (room?.game?.players.length ?? 0) > 4
  );
}
