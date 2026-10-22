import { sharedScorePatch } from '../sharedScorePatch';
import type { CardScoreMatch } from '../../types/cardScore';
const base: CardScoreMatch = {
  id: 'table',
  title: 'Bàn',
  players: [
    { id: 'a', name: 'An' },
    { id: 'b', name: 'Bình' },
  ],
  seatOrder: ['a', 'b'],
  dealerPlayerId: 'a',
  status: 'active',
  sharedVersion: 1,
  createdAt: 1,
  updatedAt: 1,
  onlineRoomId: 'room',
  rounds: Array.from({ length: 2101 }, (_, i) => ({
    id: `round-${i}`,
    createdAt: i,
    scores: { a: i, b: -i },
  })),
};
it('sends only a changed round and settings on a large table', () => {
  const edited = {
    ...base,
    title: 'Đổi tên',
    rounds: base.rounds.map((round, i) =>
      i === 2000 ? { ...round, scores: { a: 9, b: -9 } } : round,
    ),
  };
  const patch = sharedScorePatch(base, edited);
  expect(patch.upsertRounds.map((round) => round.id)).toEqual(['round-2000']);
  expect(patch.deleteRoundIds).toEqual([]);
  expect(JSON.stringify(patch).length).toBeLessThan(1000);
});
it('normalizes removed players without rewriting thousands of rounds', () => {
  const edited = {
    ...base,
    players: [base.players[0]],
    seatOrder: ['a'],
    rounds: base.rounds.map((round) => ({
      ...round,
      scores: { a: round.scores.a },
    })),
  };
  expect(sharedScorePatch(base, edited).upsertRounds).toEqual([]);
});
it('preserves deletes and refuses mismatched original revisions', () => {
  expect(
    sharedScorePatch(base, { ...base, rounds: base.rounds.slice(1) })
      .deleteRoundIds,
  ).toEqual(['round-0']);
  expect(() => sharedScorePatch({ ...base, sharedVersion: 2 }, base)).toThrow(
    'bản nháp',
  );
  expect(() => sharedScorePatch({ ...base, id: 'other' }, base)).toThrow(
    'bản nháp',
  );
});
