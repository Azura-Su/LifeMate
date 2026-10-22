import {
  parseCardScoreHistory,
  parseSharedCardScoreList,
} from '../sharedScoreProtocol';

const entry = () => ({
  id: '1',
  at: 1,
  actorUid: 'owner',
  actorName: 'An',
  changes: [
    {
      kind: 'settings',
      before: { players: [{ id: 'a', name: 'An' }] },
      after: { players: [{ id: 'a', name: 'Anh' }] },
    },
  ],
});
it('validates audit contents before they reach history rendering', () => {
  expect(
    parseCardScoreHistory({ events: [entry()], nextBefore: 1 }).events,
  ).toHaveLength(1);
  for (const changes of [
    [{ kind: 'settings', before: {}, after: { players: 'bad' } }],
    [
      {
        kind: 'round-edit',
        roundNumber: 1,
        players: [],
        before: null,
        after: null,
      },
    ],
  ]) {
    expect(() =>
      parseCardScoreHistory({
        events: [{ ...entry(), changes }],
        nextBefore: null,
      }),
    ).toThrow('không hợp lệ');
  }
  expect(() => parseCardScoreHistory({ events: [], nextBefore: -1 })).toThrow(
    'không hợp lệ',
  );
});
it('accepts a shared owner-alone lobby but rejects duplicate board or round identities', () => {
  const table = {
    canEdit: true,
    match: {
      id: 'board',
      title: 'Phòng',
      onlineRoomId: 'room',
      sharedVersion: 1,
      players: [{ id: 'a', name: 'An' }],
      seatOrder: ['a'],
      dealerPlayerId: 'a',
      rounds: [],
      status: 'active',
      createdAt: 1,
      updatedAt: 1,
    },
  };
  expect(parseSharedCardScoreList({ tables: [table] }).tables).toHaveLength(1);
  expect(() => parseSharedCardScoreList({ tables: [table, table] })).toThrow(
    'không hợp lệ',
  );
  const round = { id: 'r', createdAt: 1, scores: { a: 0 } };
  expect(() =>
    parseSharedCardScoreList({
      tables: [{ ...table, match: { ...table.match, rounds: [round, round] } }],
    }),
  ).toThrow('không hợp lệ');
});
