import type { CardGameRoom, TienLenView } from '../../types/cardGame';

// Rotate a presentation copy; the authoritative seat and turn order stays intact.
export function getOpponentsInSeatOrder<T extends { uid: string }>(
  players: readonly T[],
  selfUID: string,
): T[] {
  const self = players.findIndex((player) => player.uid === selfUID);
  if (self < 0) return [...players];
  return [...players.slice(self + 1), ...players.slice(0, self)];
}

// Presentation events only. The room snapshot remains the authority for rules.
export function getConfirmedPasses(
  previous: CardGameRoom | null,
  current: CardGameRoom,
): string[] {
  if (
    !previous?.game ||
    !current.game ||
    previous.id !== current.id ||
    previous.matchId !== current.matchId ||
    current.version <= previous.version ||
    previous.game.status !== 'playing' ||
    current.game.status !== 'playing' ||
    !('passed' in previous.game) ||
    !('passed' in current.game)
  )
    return [];

  const before = previous.game;
  const after = current.game;
  const added = after.passed.filter(
    (uid) =>
      !before.passed.includes(uid) &&
      after.players.some((p) => p.uid === uid && !p.finished && !p.forfeited),
  );
  if (added.length) return added;

  // A final pass clears both table and passed in the same server commit.
  // Infer it only when no intervening move/forfeit/member change was missed.
  const unchangedPlayers =
    before.players.length === after.players.length &&
    before.players.every((p, index) => {
      const next = after.players[index];
      return (
        p.uid === next.uid &&
        p.count === next.count &&
        p.finished === next.finished &&
        p.forfeited === next.forfeited
      );
    });
  const unchangedMembers =
    previous.members.map((p) => p.uid).join(',') ===
    current.members.map((p) => p.uid).join(',');
  if (
    current.version === previous.version + 1 &&
    before.table &&
    !after.table &&
    before.turn &&
    before.turn !== before.table.uid &&
    unchangedPlayers &&
    unchangedMembers &&
    before.players.some(
      (p) => p.uid === before.turn && !p.finished && !p.forfeited,
    )
  )
    return [before.turn];
  return [];
}

export function getHandStackLayout(availableWidth: number, count: number) {
  const width = Math.max(0, availableWidth);
  const compact = count > 1 && width < 56 + (count - 1) * 24;
  const cardWidth = compact ? 44 : 56;
  const overlap =
    count > 1
      ? Math.max(0, Math.ceil((cardWidth * count - width) / (count - 1)))
      : 0;
  return { compact, cardWidth, overlap: Math.min(cardWidth, overlap) };
}

export function getSecondsRemaining(
  deadline: number | null,
  serverTime: number,
  receivedAt: number,
  localNow: number,
) {
  if (deadline === null) return 0;
  const elapsed = Math.max(0, localNow - receivedAt);
  return Math.max(0, Math.ceil((deadline - serverTime - elapsed) / 1000));
}

export function getRoundSeatFeedback(game: TienLenView, uid: string) {
  if (game.status === 'playing') return null;
  if (game.status === 'cancelled') return { label: 'Ván hủy', won: false };
  const entry = game.result?.ranking.find((p) => p.uid === uid);
  if (!entry) return null;
  if (entry.labels.includes('forfeit')) return { label: 'Bỏ cuộc', won: false };
  const won = entry.rank === 1;
  return {
    won,
    label: won
      ? 'Thắng'
      : game.result!.ranking.length === 2
        ? 'Thua'
        : `Hạng ${entry.rank}`,
  };
}

const startedPresentations = new Set<string>();
export function claimCardPresentation(key: string) {
  if (startedPresentations.has(key)) return false;
  startedPresentations.add(key);
  if (startedPresentations.size > 128) {
    const oldest = startedPresentations.values().next().value;
    if (oldest) startedPresentations.delete(oldest);
  }
  return true;
}
