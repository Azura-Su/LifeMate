import type {
  CardScoreMatch,
  CardScorePatch,
  CardScoreRound,
} from '../types/cardScore';

/** Compare the editor's original revision, never a newer cache or live snapshot. */
export function sharedScorePatch(
  base: CardScoreMatch,
  edited: CardScoreMatch,
): CardScorePatch {
  if (
    base.id !== edited.id ||
    !base.sharedVersion ||
    base.sharedVersion !== edited.sharedVersion
  )
    throw new Error(
      'Bảng điểm gốc đã thay đổi. Đóng và mở lại hộp sửa; bản nháp chưa được lưu.',
    );
  const { title, players, seatOrder, dealerPlayerId, status } = edited;
  const original = new Map(base.rounds.map((round) => [round.id, round]));
  const currentIds = new Set(edited.rounds.map((round) => round.id));
  const scores = (round: CardScoreRound) =>
    JSON.stringify(players.map((player) => round.scores[player.id] ?? 0));
  const upsertRounds = edited.rounds.filter((round) => {
    const before = original.get(round.id);
    return (
      !before ||
      before.createdAt !== round.createdAt ||
      scores(before) !== scores(round)
    );
  });
  const deleteRoundIds = base.rounds
    .filter((round) => !currentIds.has(round.id))
    .map((round) => round.id);
  if (upsertRounds.length > 100 || deleteRoundIds.length > 100)
    throw new Error(
      'Chỉ có thể sửa hoặc xóa tối đa 100 ván mỗi lần. Bản nháp chưa được lưu.',
    );
  return {
    settings: { title, players, seatOrder, dealerPlayerId, status },
    upsertRounds,
    deleteRoundIds,
  };
}
