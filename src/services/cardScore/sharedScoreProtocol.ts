import type {
  CardScoreHistory,
  SharedCardScore,
  SharedCardScoreList,
} from '../../types/cardScore';
import { isCardScoreMatch } from '../../utils/cardScore';
import { isScoreAuditEntry } from '../../utils/cardScoreAudit';

const invalid = () => new Error('Dữ liệu bảng điểm từ máy chủ không hợp lệ.');
export function parseSharedCardScore(value: unknown): SharedCardScore {
  if (
    !value ||
    typeof value !== 'object' ||
    !('match' in value) ||
    !('canEdit' in value) ||
    typeof value.canEdit !== 'boolean' ||
    !isCardScoreMatch(value.match) ||
    !value.match.sharedVersion
  )
    throw invalid();
  if (
    new Set(value.match.rounds.map((round) => round.id)).size !==
    value.match.rounds.length
  )
    throw invalid();
  return { match: value.match, canEdit: value.canEdit };
}
export function parseSharedCardScoreList(value: unknown): SharedCardScoreList {
  if (
    !value ||
    typeof value !== 'object' ||
    !('tables' in value) ||
    !Array.isArray(value.tables)
  )
    throw invalid();
  const tables = value.tables.map(parseSharedCardScore);
  if (new Set(tables.map(({ match }) => match.id)).size !== tables.length)
    throw invalid();
  return { tables };
}
export function parseCardScoreHistory(value: unknown): CardScoreHistory {
  if (
    !value ||
    typeof value !== 'object' ||
    !('events' in value) ||
    !Array.isArray(value.events) ||
    !value.events.every(isScoreAuditEntry) ||
    !('nextBefore' in value) ||
    (value.nextBefore !== null &&
      (typeof value.nextBefore !== 'number' ||
        !Number.isSafeInteger(value.nextBefore) ||
        value.nextBefore < 1))
  )
    throw invalid();
  return {
    events: value.events,
    nextBefore: value.nextBefore as number | null,
  };
}
