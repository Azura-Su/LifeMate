import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cacheSharedCardScoreMatches,
  setCardScoreLocalFinished,
  cardScoreStorageKey,
  createCardScoreMatch,
  deleteCardScoreMatch,
  readCardScoreMatches,
  syncOnlineCardScoreMatch,
  updateCardScoreMatch,
} from '../cardScoreStorage';
import type { CardScoreMatch, CardScorePlayer } from '../../../types/cardScore';
import {
  getEncryptedItem,
  migrateSensitiveCache,
  setEncryptedItem,
} from '../../security/encryptedLocalStorage';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);

const players: CardScorePlayer[] = [
  { id: 'p1', name: 'An' },
  { id: 'p2', name: 'Bình' },
];

beforeEach(async () => {
  await AsyncStorage.clear();
});

const historyResetAt = Date.parse('2026-10-22T05:25:00Z');
function oldHistory(overrides: Partial<CardScoreMatch> = {}): CardScoreMatch {
  return {
    id: 'old-history',
    title: 'Bàn cũ',
    players,
    seatOrder: ['p1', 'p2'],
    dealerPlayerId: 'p1',
    rounds: [
      {
        id: 'old-round',
        createdAt: historyResetAt - 1,
        scores: { p1: 5, p2: -5 },
      },
    ],
    status: 'finished',
    createdAt: historyResetAt - 2,
    updatedAt: historyResetAt - 1,
    audit: [
      {
        id: 'old-audit',
        at: historyResetAt - 1,
        actorUid: 'user-1',
        actorName: 'An',
        changes: [{ kind: 'table-delete' }],
      },
    ],
    ...overrides,
  };
}

it.each(['user-1', 'user-2'])(
  'physically clears old manual, legacy and shared history for %s on read',
  async (uid) => {
    const records = [
      oldHistory(),
      oldHistory({ id: 'legacy', onlineRoomId: 'old-room' }),
      oldHistory({
        id: 'shared',
        onlineRoomId: 'old-shared',
        sharedVersion: 1,
        status: 'active',
        localFinished: true,
      }),
      oldHistory({ id: 'deleted', deletedAt: historyResetAt - 1 }),
    ];
    await setEncryptedItem(
      uid,
      cardScoreStorageKey(uid),
      JSON.stringify(records),
    );
    expect(await readCardScoreMatches(uid, { includeDeleted: true })).toEqual(
      [],
    );
    expect(
      JSON.parse((await getEncryptedItem(uid, cardScoreStorageKey(uid)))!),
    ).toEqual([]);
    expect(await readCardScoreMatches(uid)).toEqual([]);
  },
);

it('keeps active manual tables and new history, including finishing an old manual table after cleanup', async () => {
  const active = oldHistory({ id: 'manual-active', status: 'active' });
  const recent = oldHistory({
    id: 'new-history',
    createdAt: historyResetAt + 1,
    updatedAt: historyResetAt + 1,
  });
  await setEncryptedItem(
    'user-1',
    cardScoreStorageKey('user-1'),
    JSON.stringify([active, recent]),
  );
  expect(await readCardScoreMatches('user-1')).toEqual([active, recent]);
  const finished = await updateCardScoreMatch('user-1', {
    ...active,
    status: 'finished',
    rounds: [
      ...active.rounds,
      { id: 'new-round', createdAt: Date.now(), scores: { p1: 2, p2: -2 } },
    ],
  });
  expect(finished.updatedAt).toBeGreaterThan(historyResetAt);
  expect(await readCardScoreMatches('user-1')).toEqual([finished, recent]);
});

it('keeps an older online table that is still active and is not in the purged rooms', async () => {
  const active = oldHistory({
    id: 'live-online',
    onlineRoomId: 'still-open-room',
    status: 'active',
  });
  await setEncryptedItem(
    'user-1',
    cardScoreStorageKey('user-1'),
    JSON.stringify([active]),
  );
  expect(await readCardScoreMatches('user-1')).toEqual([active]);
});

it('rejects a stale local save after the historical table has been purged', async () => {
  const old = oldHistory();
  await setEncryptedItem(
    'user-1',
    cardScoreStorageKey('user-1'),
    JSON.stringify([old]),
  );
  await expect(
    updateCardScoreMatch(
      'user-1',
      { ...old, status: 'active' },
      { resume: true },
    ),
  ).rejects.toThrow('Không tìm thấy');
  expect(
    await readCardScoreMatches('user-1', { includeDeleted: true }),
  ).toEqual([]);
});

it('never returns or recaches pre-reset shared tables from a late server response', async () => {
  const old = oldHistory({
    onlineRoomId: '17eedd7d-15d3-45f5-8640-f81d757cddf7',
    sharedVersion: 1,
    status: 'active',
  });
  const recent = oldHistory({
    id: 'new-shared',
    onlineRoomId: 'new-room',
    sharedVersion: 1,
    status: 'active',
    createdAt: historyResetAt + 1,
    updatedAt: historyResetAt + 1,
  });
  expect(
    await cacheSharedCardScoreMatches('user-1', [old, recent], true),
  ).toEqual([recent]);
  expect(await readCardScoreMatches('user-1')).toEqual([recent]);
  expect(
    JSON.parse(
      (await getEncryptedItem('user-1', cardScoreStorageKey('user-1')))!,
    ),
  ).toEqual([recent]);
  expect(await cacheSharedCardScoreMatches('user-1', [old], true)).toEqual([]);
});

it('does not replay a known purged room through the legacy sync helper', async () => {
  expect(
    await syncOnlineCardScoreMatch('user-1', {
      ...onlineInput,
      roomId: '17eedd7d-15d3-45f5-8640-f81d757cddf7',
    }),
  ).toBeNull();
  expect(await readCardScoreMatches('user-1')).toEqual([]);
});

it('stores matches encrypted and isolated by account', async () => {
  const match = await createCardScoreMatch('user-1', {
    title: 'Bàn chơi',
    players,
    seatOrder: ['p2', 'p1'],
    dealerPlayerId: 'p2',
  });
  expect(await readCardScoreMatches('user-1')).toEqual([match]);
  expect(await readCardScoreMatches('user-2')).toEqual([]);
  expect(cardScoreStorageKey('user-1')).not.toBe(cardScoreStorageKey('user-2'));
  expect(await AsyncStorage.getItem(cardScoreStorageKey('user-1'))).toMatch(
    /^lifemate:aes-gcm:v1:/,
  );
});

it('serializes score edits and deletes only the selected match', async () => {
  const [first, second] = await Promise.all([
    createCardScoreMatch('user-1', {
      title: 'Phỏm',
      players,
      seatOrder: ['p1', 'p2'],
      dealerPlayerId: 'p1',
    }),
    createCardScoreMatch('user-1', {
      title: 'Tiến lên',
      players,
      seatOrder: ['p2', 'p1'],
      dealerPlayerId: 'p2',
    }),
  ]);
  const updated = await updateCardScoreMatch('user-1', {
    ...first,
    rounds: [{ id: 'r1', createdAt: Date.now(), scores: { p1: 5, p2: -5 } }],
  });
  expect(await readCardScoreMatches('user-1')).toContainEqual(updated);
  await deleteCardScoreMatch('user-1', second.id);
  expect(await readCardScoreMatches('user-1')).toEqual([updated]);
});

it('does not recreate a deleted online table, but permits the next room match', async () => {
  const created = await syncOnlineCardScoreMatch('user-1', onlineInput);
  await deleteCardScoreMatch('user-1', created!.id);

  expect(await syncOnlineCardScoreMatch('user-1', onlineInput)).toBeNull();
  const nextMatch = await syncOnlineCardScoreMatch('user-1', {
    ...onlineInput,
    matchId: 'online-round-2',
    result: null,
  });
  expect(nextMatch?.rounds).toEqual([]);
  expect(await syncOnlineCardScoreMatch('user-1', onlineInput)).toBeNull();
  expect(await readCardScoreMatches('user-1')).toEqual([nextMatch]);

  expect(await syncOnlineCardScoreMatch('user-2', onlineInput)).not.toBeNull();
});

it('uses legacy online round IDs to keep a deleted table from reappearing', async () => {
  const created = await syncOnlineCardScoreMatch('user-1', onlineInput);
  const legacy = { ...created! };
  delete legacy.lastSyncedOnlineMatchId;
  await setEncryptedItem(
    'user-1',
    cardScoreStorageKey('user-1'),
    JSON.stringify([legacy]),
  );

  await deleteCardScoreMatch('user-1', legacy.id);

  expect(await syncOnlineCardScoreMatch('user-1', onlineInput)).toBeNull();
  const nextMatch = await syncOnlineCardScoreMatch('user-1', {
    ...onlineInput,
    matchId: 'online-round-2',
    result: null,
  });
  expect(nextMatch).not.toBeNull();
});

it('rejects invalid player names before saving', async () => {
  await expect(
    createCardScoreMatch('user-1', {
      title: 'Bàn chơi',
      players: [
        { id: '1', name: 'An' },
        { id: '2', name: ' an ' },
      ],
      seatOrder: ['1', '2'],
      dealerPlayerId: '1',
    }),
  ).rejects.toThrow('trùng');
  expect(await readCardScoreMatches('user-1')).toEqual([]);
});

it('migrates saved mode-specific tables into the shared card-game history', async () => {
  const now = Date.now();
  const legacyMatch = {
    id: 'legacy-match',
    mode: 'north',
    players,
    seatOrder: ['p1', 'p2'],
    dealerPlayerId: 'p1',
    rounds: [{ id: 'round-1', createdAt: now, scores: { p1: 8, p2: -8 } }],
    status: 'finished',
    createdAt: now,
    updatedAt: now,
  };
  await setEncryptedItem(
    'user-1',
    cardScoreStorageKey('user-1'),
    JSON.stringify([legacyMatch]),
  );

  const [migrated] = await readCardScoreMatches('user-1');

  expect(migrated.title).toBe('Bàn chơi');
  expect(migrated.rounds).toEqual(legacyMatch.rounds);
  expect(await readCardScoreMatches('user-1')).toEqual([migrated]);
});

it('encrypts a legacy plaintext score cache during sensitive-cache migration', async () => {
  await AsyncStorage.setItem(cardScoreStorageKey('user-1'), '[]');
  await migrateSensitiveCache('user-1');

  expect(await AsyncStorage.getItem(cardScoreStorageKey('user-1'))).toMatch(
    /^lifemate:aes-gcm:v1:/,
  );
  expect(await readCardScoreMatches('user-1')).toEqual([]);
});

const onlineInput = {
  roomId: 'room-1',
  code: 'ABCDEFGH',
  amountPerCard: 1,
  members: players.map((player) => ({ uid: player.id, name: player.name })),
  matchId: 'online-round',
  result: {
    ranking: [
      { uid: 'p1', moneyDelta: 5 },
      { uid: 'p2', moneyDelta: -5 },
    ],
  },
};

it('keeps a finished table in history when the room syncs again', async () => {
  const created = await syncOnlineCardScoreMatch('user-1', onlineInput);
  const finished = await updateCardScoreMatch('user-1', {
    ...created!,
    status: 'finished',
  });
  await syncOnlineCardScoreMatch('user-1', onlineInput);
  expect(await readCardScoreMatches('user-1')).toEqual([finished]);
});

it('explicitly resumes a finished online table without allowing stale saves to do so', async () => {
  const created = await syncOnlineCardScoreMatch('user-1', onlineInput);
  const finished = await updateCardScoreMatch('user-1', {
    ...created!,
    status: 'finished',
  });

  const staleSave = await updateCardScoreMatch('user-1', {
    ...created!,
    status: 'active',
  });
  expect(staleSave.status).toBe('finished');

  const resumed = await updateCardScoreMatch(
    'user-1',
    { ...finished, status: 'active' },
    { resume: true },
  );
  expect(resumed.status).toBe('active');
});

it('keeps rounds synced after the screen loaded when a stale edit is saved', async () => {
  const stale = await syncOnlineCardScoreMatch('user-1', {
    ...onlineInput,
    result: null,
  });
  await syncOnlineCardScoreMatch('user-1', onlineInput);
  const edited = await updateCardScoreMatch('user-1', {
    ...stale!,
    rounds: [
      { id: 'manual-edit', createdAt: Date.now(), scores: { p1: 3, p2: -3 } },
    ],
  });
  expect(edited.rounds.map(({ id }) => id).sort()).toEqual([
    'manual-edit',
    'online-round',
  ]);
});

it('does not restore removed online players or their score columns on sync', async () => {
  const created = await syncOnlineCardScoreMatch('user-1', onlineInput);
  const removed = await updateCardScoreMatch('user-1', {
    ...created!,
    players: [created!.players[0], { id: 'p3', name: 'Chi' }],
    seatOrder: ['p1', 'p3'],
    dealerPlayerId: 'p1',
    ignoredOnlinePlayerIds: ['p2'],
    rounds: created!.rounds.map((round) => ({
      ...round,
      scores: { p1: 5 },
    })),
  });
  const synced = await syncOnlineCardScoreMatch('user-1', onlineInput);
  expect(synced?.players.map(({ id }) => id)).toEqual(['p1', 'p3']);
  expect(synced?.rounds[0].scores).toEqual({ p1: 5 });
  expect(removed.ignoredOnlinePlayerIds).toEqual(['p2']);
});

it('keeps locally managed online player names when later room snapshots arrive', async () => {
  const created = await syncOnlineCardScoreMatch('user-1', onlineInput);
  const renamed = await updateCardScoreMatch('user-1', {
    ...created!,
    players: created!.players.map((player) =>
      player.id === 'p1' ? { ...player, name: 'An mới' } : player,
    ),
  });

  const synced = await syncOnlineCardScoreMatch('user-1', {
    ...onlineInput,
    matchId: 'online-round-2',
    result: null,
  });

  expect(synced?.players.find(({ id }) => id === 'p1')?.name).toBe('An mới');
  expect(renamed.players.find(({ id }) => id === 'p1')?.name).toBe('An mới');
});

it('starts one new active score table for a new match after the prior table is finished', async () => {
  const first = await syncOnlineCardScoreMatch('user-1', onlineInput);
  await updateCardScoreMatch('user-1', { ...first!, status: 'finished' });
  await syncOnlineCardScoreMatch('user-1', onlineInput);
  const next = await syncOnlineCardScoreMatch('user-1', {
    ...onlineInput,
    matchId: 'online-round-2',
    result: null,
  });
  const matches = await readCardScoreMatches('user-1');
  expect(matches).toHaveLength(2);
  expect(matches[0].id).toBe(next?.id);
  expect(matches[0].status).toBe('active');
  expect(matches[1].status).toBe('finished');
});

it('normalizes malformed optional online names and money deltas', async () => {
  const saved = await syncOnlineCardScoreMatch('user-1', {
    ...onlineInput,
    members: [
      { uid: 'p1', name: '' },
      { uid: 'p2', name: 'Bình' },
    ],
    result: {
      ranking: [
        { uid: 'p1', name: '', moneyDelta: 1.5 },
        { uid: 'p2', moneyDelta: -1.5 },
      ],
    },
  });
  expect(saved?.players[0].name).toBe('Người chơi');
  expect(saved?.rounds[0].scores).toEqual({ p1: 0, p2: 0 });
});

it('syncs distinct users with identical names and matching UID suffixes', async () => {
  const members = ['one-1234', 'two-1234', 'three-1234'].map((uid) => ({
    uid,
    name: 'An',
  }));
  const saved = await syncOnlineCardScoreMatch('user-1', {
    ...onlineInput,
    members,
    result: null,
  });
  expect(saved?.players).toHaveLength(3);
  expect(new Set(saved?.players.map((player) => player.name)).size).toBe(3);
});

it('preserves old scores and continues recording after more than eight historical players', async () => {
  for (let index = 2; index <= 9; index++) {
    await syncOnlineCardScoreMatch('user-1', {
      ...onlineInput,
      members: [
        { uid: 'p1', name: 'An' },
        { uid: `p${index}`, name: `Bạn ${index}` },
      ],
      matchId: `round-${index}`,
      result: {
        ranking: [
          { uid: 'p1', moneyDelta: 1 },
          { uid: `p${index}`, moneyDelta: -1 },
        ],
      },
    });
  }
  const saved = await readCardScoreMatches('user-1');
  expect(saved.flatMap((match) => match.rounds)).toHaveLength(8);
  expect(saved[0].rounds.at(-1)?.id).toBe('round-9');
  expect(saved).toHaveLength(1);
  expect(saved[0].players).toHaveLength(9);
  expect(saved[0].status).toBe('active');
  expect(await readCardScoreMatches('user-1')).toEqual(saved);
});

it('still rejects more than eight players in a manual table', async () => {
  const players = Array.from({ length: 9 }, (_, i) => ({
    id: `p${i}`,
    name: `Bạn ${i}`,
  }));
  await expect(
    createCardScoreMatch('user-1', {
      title: 'Bàn chơi',
      players,
      seatOrder: players.map((p) => p.id),
      dealerPlayerId: players[0].id,
    }),
  ).rejects.toThrow('tối đa 8');
});

it('retains before/after scores and deletion audit after a manual table is deleted', async () => {
  let match = await createCardScoreMatch('user-1', {
    title: 'Bàn audit',
    players,
    seatOrder: ['p1', 'p2'],
    dealerPlayerId: 'p1',
  });
  match = await updateCardScoreMatch('user-1', {
    ...match,
    rounds: [{ id: 'round-audit', createdAt: 1, scores: { p1: 5, p2: -5 } }],
  });
  match = await updateCardScoreMatch('user-1', {
    ...match,
    rounds: [{ ...match.rounds[0], scores: { p1: 9, p2: -9 } }],
  });
  await deleteCardScoreMatch('user-1', match.id);
  expect(await readCardScoreMatches('user-1')).toEqual([]);
  const [deleted] = await readCardScoreMatches('user-1', {
    includeDeleted: true,
  });
  expect(deleted.deletedAt).toEqual(expect.any(Number));
  expect(deleted.audit?.[1].changes[0]).toMatchObject({
    kind: 'round-edit',
    before: { scores: { p1: 5 } },
    after: { scores: { p1: 9 } },
  });
  expect(deleted.audit?.at(-1)?.changes).toEqual([{ kind: 'table-delete' }]);
});

it('keeps local finish isolated by account and preserves it across shared refreshes', async () => {
  const initial = await createCardScoreMatch('user-1', {
    title: 'Online',
    players,
    seatOrder: ['p1', 'p2'],
    dealerPlayerId: 'p1',
    onlineRoomId: 'room',
  });
  const shared = { ...initial, sharedVersion: 1 };
  await cacheSharedCardScoreMatches('user-1', [shared]);
  const [closed] = await setCardScoreLocalFinished('user-1', shared.id, true);
  expect(closed).toEqual({
    ...shared,
    localFinished: true,
    localFinishedAt: expect.any(Number),
  });
  const [refreshed] = await cacheSharedCardScoreMatches(
    'user-1',
    [{ ...shared, sharedVersion: 2 }],
    true,
  );
  expect(refreshed.localFinished).toBe(true);
  expect(refreshed.status).toBe('active');
  await cacheSharedCardScoreMatches(
    'user-2',
    [{ ...shared, localFinished: true }],
    true,
  );
  expect(
    (await readCardScoreMatches('user-2'))[0].localFinished,
  ).toBeUndefined();
  const [reopened] = await setCardScoreLocalFinished(
    'user-1',
    shared.id,
    false,
  );
  expect(reopened.localFinished).toBeUndefined();
  expect(reopened.sharedVersion).toBe(2);
  expect(reopened.rounds).toEqual(shared.rounds);
  expect(reopened.audit).toEqual(shared.audit);
});

it('rejects stale saves and explicit resume of permanently deleted local tables', async () => {
  const match = await createCardScoreMatch('user-1', {
    title: 'Bàn đã xóa',
    players,
    seatOrder: ['p1', 'p2'],
    dealerPlayerId: 'p1',
  });
  await deleteCardScoreMatch('user-1', match.id);
  const [deleted] = await readCardScoreMatches('user-1', {
    includeDeleted: true,
  });
  for (const snapshot of [match, { ...deleted, deletedAt: undefined }]) {
    await expect(
      updateCardScoreMatch('user-1', snapshot, { resume: true }),
    ).rejects.toThrow('không thể khôi phục');
  }
  expect(await readCardScoreMatches('user-1')).toEqual([]);
  expect(
    await readCardScoreMatches('user-1', { includeDeleted: true }),
  ).toEqual([deleted]);
});

it('retains server deletion suppression on a fresh cache and subsequent refreshes', async () => {
  const match = await syncOnlineCardScoreMatch('user-1', onlineInput);
  const deleted = { ...match!, sharedVersion: 2, deletedAt: Date.now() };
  await AsyncStorage.clear();
  for (let refresh = 0; refresh < 2; refresh++) {
    await cacheSharedCardScoreMatches('user-1', [deleted], true);
    for (const matchId of [onlineInput.matchId, 'next-game']) {
      await syncOnlineCardScoreMatch('user-1', { ...onlineInput, matchId });
      expect(await readCardScoreMatches('user-1')).toEqual([]);
    }
  }
  expect(
    await readCardScoreMatches('user-1', { includeDeleted: true }),
  ).toEqual([deleted]);
});

it('retains old online boards finished after the purge cutoff and their local archive preference', async () => {
  const active = oldHistory({
    id: 'retained-online',
    onlineRoomId: 'retained-room',
    sharedVersion: 1,
    status: 'active',
  });
  await cacheSharedCardScoreMatches('user-1', [active], true);
  const archived = await setCardScoreLocalFinished('user-1', active.id, true);
  expect(archived[0].updatedAt).toBe(active.updatedAt);
  expect((await readCardScoreMatches('user-1'))[0]).toMatchObject({
    localFinished: true,
  });
  await cacheSharedCardScoreMatches(
    'user-1',
    [{ ...active, sharedVersion: 2 }],
    true,
  );
  expect((await readCardScoreMatches('user-1'))[0]).toMatchObject({
    localFinished: true,
  });
  const finished = {
    ...active,
    status: 'finished' as const,
    sharedVersion: 3,
    updatedAt: Date.now(),
  };
  await cacheSharedCardScoreMatches('user-1', [finished], true);
  expect((await readCardScoreMatches('user-1'))[0]).toMatchObject({
    status: 'finished',
    localFinished: true,
  });
  await setCardScoreLocalFinished('user-1', active.id, false);
  const resumed = (await readCardScoreMatches('user-1'))[0];
  expect(resumed.localFinished).toBeUndefined();
  expect(resumed.localFinishedAt).toBeUndefined();
});

it('discards server-supplied archive metadata and never revives explicitly purged rooms', async () => {
  const fresh = oldHistory({
    id: 'fresh-remote',
    onlineRoomId: 'safe-room',
    status: 'active',
    sharedVersion: 1,
    updatedAt: Date.now(),
    localFinished: true,
    localFinishedAt: Date.now(),
  });
  const purged = {
    ...fresh,
    id: 'purged-room',
    onlineRoomId: '17eedd7d-15d3-45f5-8640-f81d757cddf7',
  };
  const cached = await cacheSharedCardScoreMatches(
    'user-1',
    [fresh, purged],
    true,
  );
  expect(cached).toHaveLength(1);
  expect(cached[0].localFinished).toBeUndefined();
  expect(cached[0].localFinishedAt).toBeUndefined();
});
