import type { CardGameRoom, GameSnapshot } from '../../../types/cardGame';
import { phomRoom } from '../../../testing/phomFixture';
import {
  clearCachedRoomSnapshot,
  getCachedRoomSnapshot,
  loadCachedRoomSnapshot,
  saveRoomSnapshot,
} from '../roomSnapshotCache';
import {
  getEncryptedItem,
  removeEncryptedItem,
  setEncryptedItem,
} from '../../security/encryptedLocalStorage';

jest.mock('../../security/encryptedLocalStorage', () => ({
  getEncryptedItem: jest.fn(),
  removeEncryptedItem: jest.fn(),
  setEncryptedItem: jest.fn(),
}));

const uid = 'a';
const finishedRoom: CardGameRoom = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  code: 'ABCDEFGH',
  version: 4,
  epoch: '123e4567-e89b-42d3-a456-426614174001',
  matchId: '123e4567-e89b-42d3-a456-426614174002',
  phase: 'finished',
  host: uid,
  controller: true,
  topic:
    'card-room:123e4567-e89b-42d3-a456-426614174000:123e4567-e89b-42d3-a456-426614174001',
  members: [
    { uid, name: 'An', ready: false, wins: 1 },
    { uid: 'b', name: 'Bình', ready: false, wins: 0 },
  ],
  game: {
    rulesVersion: 'south-v1',
    status: 'finished',
    hand: [1, 2, 3],
    players: [
      { uid, count: 0, finished: true, forfeited: false },
      { uid: 'b', count: 13, finished: false, forfeited: false },
    ],
    turn: null,
    table: null,
    passed: [],
    openingCard: null,
    deadline: null,
    result: { reason: 'completed', ranking: [] },
  },
};
const snapshot: GameSnapshot = { room: finishedRoom, serverTime: 100 };

beforeEach(() => {
  jest.clearAllMocks();
  void clearCachedRoomSnapshot(uid);
});

it('strips every revealed Phỏm result hand from memory and persisted snapshots without changing the live result', async () => {
  const room = phomRoom();
  room.phase = 'finished';
  room.game.status = 'finished';
  room.game.players = room.game.players.map((p) => ({
    ...p,
    resultCards: { discards: [44], remaining: [...room.game.hand] },
  }));
  await saveRoomSnapshot(uid, { room, serverTime: 1 });
  const cached = getCachedRoomSnapshot(uid, room.code)!;
  expect(cached.room?.game?.hand).toEqual([]);
  expect(cached.room?.game?.players.every((p) => !('resultCards' in p))).toBe(
    true,
  );
  expect(jest.mocked(setEncryptedItem).mock.calls.at(-1)![2]).not.toContain(
    'resultCards',
  );
  expect(room.game.players[0].resultCards?.remaining).toEqual(room.game.hand);
});

it('caches only a redacted finished snapshot in memory and encrypted storage', async () => {
  await saveRoomSnapshot(uid, snapshot);

  const cached = getCachedRoomSnapshot(uid, 'abcdefgh');
  expect(cached?.room?.id).toBe(finishedRoom.id);
  expect(cached?.room?.game?.hand).toEqual([]);
  expect(setEncryptedItem).toHaveBeenCalledWith(
    uid,
    expect.stringContaining(uid),
    expect.stringContaining('"hand":[]'),
  );

  await saveRoomSnapshot(uid, {
    ...snapshot,
    room: { ...finishedRoom, phase: 'playing' },
  });
  expect(getCachedRoomSnapshot(uid, finishedRoom.code)).toBeNull();
  expect(removeEncryptedItem).toHaveBeenCalled();
});

it('loads and validates an encrypted finished snapshot for the same account and room', async () => {
  jest.mocked(getEncryptedItem).mockResolvedValue(JSON.stringify(snapshot));

  const cached = await loadCachedRoomSnapshot(uid, finishedRoom.code);

  expect(cached?.room?.id).toBe(finishedRoom.id);
  expect(cached?.room?.game?.hand).toEqual([]);
  expect(
    await loadCachedRoomSnapshot('other-user', finishedRoom.code),
  ).toBeNull();
  expect(await loadCachedRoomSnapshot(uid, 'ZZZZZZZZ')).toBeNull();
});

it.each(['north', 'sam', 'tan'] as const)(
  'reloads a redacted losing-player %s snapshot after memory is cleared',
  async (gameKind) => {
    const commonResult = { reason: 'completed', ranking: [] };
    const baseRoom: CardGameRoom = {
      ...finishedRoom,
      gameKind,
      game:
        gameKind === 'north'
          ? {
              rulesVersion: 'north-v1',
              status: 'finished',
              hand: [1, 2, 3],
              players: [
                { uid, count: 3, finished: false, forfeited: false },
                { uid: 'b', count: 10, finished: false, forfeited: false },
              ],
              turn: null,
              table: null,
              passed: [],
              openingCard: null,
              deadline: null,
              result: commonResult,
            }
          : gameKind === 'sam'
            ? {
                rulesVersion: 'sam-v1',
                status: 'finished',
                step: 'play',
                hand: [1, 2, 3],
                players: [
                  { uid, count: 3, finished: false, forfeited: false },
                  { uid: 'b', count: 7, finished: false, forfeited: false },
                ],
                turn: null,
                table: null,
                passed: [],
                openingCard: null,
                deadline: null,
                result: commonResult,
                reportOrder: [],
                reported: [],
                reportedSam: false,
                callUid: null,
                samOutcome: null,
              }
            : {
                rulesVersion: 'tan-v1',
                status: 'finished',
                step: 'finished',
                hand: [1, 2, 3],
                players: [
                  { uid, count: 3, finished: false, forfeited: false },
                  { uid: 'b', count: 0, finished: true, forfeited: false },
                ],
                stockCount: 0,
                trumpCard: null,
                trumpSuit: 0,
                attackerUid: null,
                defenderUid: null,
                turn: null,
                maxAttackCards: 3,
                table: [],
                deadline: null,
                result: commonResult,
              },
    };
    const variantSnapshot: GameSnapshot = {
      room: baseRoom,
      serverTime: 100,
    };

    await saveRoomSnapshot(uid, variantSnapshot);
    const encrypted = jest.mocked(setEncryptedItem).mock.calls.at(-1)![2];
    expect(JSON.parse(encrypted).room.game.hand).toEqual([]);
    await clearCachedRoomSnapshot(uid);
    jest.mocked(getEncryptedItem).mockResolvedValue(encrypted);

    const loaded = await loadCachedRoomSnapshot(uid, baseRoom.code);

    expect(loaded?.room?.game?.hand).toEqual([]);
    expect(
      loaded?.room?.game?.players.find((player) => player.uid === uid)?.count,
    ).toBe(3);
  },
);
