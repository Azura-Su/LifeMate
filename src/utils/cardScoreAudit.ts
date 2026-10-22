import type {
  CardScoreAuditChange,
  CardScoreAuditEntry,
  CardScoreDocument,
} from '../types/cardScore';

export function scoreDocument(match: CardScoreDocument): CardScoreDocument {
  const { title, players, seatOrder, dealerPlayerId, rounds, status } = match;
  return { title, players, seatOrder, dealerPlayerId, rounds, status };
}

export function scoreChanges(
  before: CardScoreDocument,
  after: CardScoreDocument,
): CardScoreAuditChange[] {
  const changes: CardScoreAuditChange[] = [];
  before.rounds.forEach((round, index) => {
    const next = after.rounds.find(({ id }) => id === round.id);
    if (JSON.stringify(round) !== JSON.stringify(next))
      changes.push({
        kind: next ? 'round-edit' : 'round-delete',
        roundNumber: index + 1,
        players: before.players,
        before: round,
        after: next ?? null,
      });
  });
  after.rounds.forEach((round, index) => {
    if (!before.rounds.some(({ id }) => id === round.id))
      changes.push({
        kind: 'round-add',
        roundNumber: index + 1,
        players: after.players,
        after: round,
      });
  });
  const oldSettings: Partial<CardScoreDocument> = {},
    newSettings: Partial<CardScoreDocument> = {};
  for (const key of [
    'title',
    'players',
    'seatOrder',
    'dealerPlayerId',
    'status',
  ] as const) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      Object.assign(oldSettings, { [key]: before[key] });
      Object.assign(newSettings, { [key]: after[key] });
    }
  }
  if (Object.keys(oldSettings).length)
    changes.push({ kind: 'settings', before: oldSettings, after: newSettings });
  return changes;
}

export function isScoreAuditEntry(
  value: unknown,
): value is CardScoreAuditEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as CardScoreAuditEntry;
  return (
    typeof entry.id === 'string' &&
    Number.isFinite(entry.at) &&
    (entry.actorUid === null || typeof entry.actorUid === 'string') &&
    typeof entry.actorName === 'string' &&
    Array.isArray(entry.changes) &&
    entry.changes.every((change) => {
      if (!change || typeof change !== 'object') return false;
      if (change.kind === 'table-delete' || change.kind === 'table-restore')
        return true;
      if (change.kind === 'settings')
        return validSettings(change.before) && validSettings(change.after);
      if (!['round-add', 'round-edit', 'round-delete'].includes(change.kind))
        return false;
      if (
        !('roundNumber' in change) ||
        !Number.isSafeInteger(change.roundNumber) ||
        change.roundNumber < 1 ||
        !Array.isArray(change.players) ||
        !change.players.every(
          (p) => p && typeof p.id === 'string' && typeof p.name === 'string',
        )
      )
        return false;
      if (
        (change.kind !== 'round-add' && !change.before) ||
        (change.kind !== 'round-delete' && !change.after)
      )
        return false;
      return [change.before, change.after].every(
        (round) =>
          !round ||
          (typeof round.id === 'string' &&
            Number.isFinite(round.createdAt) &&
            !!round.scores &&
            typeof round.scores === 'object' &&
            !Array.isArray(round.scores) &&
            Object.values(round.scores).every(Number.isSafeInteger)),
      );
    })
  );
}

function validSettings(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const settings = value as Partial<CardScoreDocument>;
  return (
    (settings.title === undefined || typeof settings.title === 'string') &&
    (settings.status === undefined ||
      ['active', 'finished'].includes(settings.status)) &&
    (settings.dealerPlayerId === undefined ||
      typeof settings.dealerPlayerId === 'string') &&
    (settings.seatOrder === undefined ||
      (Array.isArray(settings.seatOrder) &&
        settings.seatOrder.every((id) => typeof id === 'string'))) &&
    (settings.players === undefined ||
      (Array.isArray(settings.players) &&
        settings.players.every(
          (player) =>
            player &&
            typeof player.id === 'string' &&
            typeof player.name === 'string',
        )))
  );
}
