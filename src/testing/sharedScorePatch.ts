import type {
  CardScoreDocument,
  CardScoreMatch,
  CardScorePatch,
} from '../types/cardScore';

/** Independent in-memory server fixture for UI tests; SQL has separate regressions. */
export function applyTestScoreDocument(
  base: CardScoreMatch,
  document: CardScoreDocument | CardScorePatch | null | undefined,
): CardScoreMatch {
  if (!document) return base;
  if (!('settings' in document)) return { ...base, ...document };
  const changes = new Map(
    document.upsertRounds.map((round) => [round.id, round]),
  );
  const removed = new Set(document.deleteRoundIds);
  const players = new Set(document.settings.players.map((player) => player.id));
  const rounds = base.rounds
    .filter((round) => !removed.has(round.id))
    .map(
      (round) =>
        changes.get(round.id) ?? {
          ...round,
          scores: Object.fromEntries(
            Object.entries(round.scores).filter(([id]) => players.has(id)),
          ),
        },
    );
  const ids = new Set(base.rounds.map((round) => round.id));
  return {
    ...base,
    ...document.settings,
    rounds: [
      ...rounds,
      ...document.upsertRounds.filter((round) => !ids.has(round.id)),
    ],
  };
}
