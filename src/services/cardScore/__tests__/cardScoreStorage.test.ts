import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cardScoreStorageKey,
  createCardScoreMatch,
  deleteCardScoreMatch,
  readCardScoreMatches,
  updateCardScoreMatch,
} from '../cardScoreStorage';
import type { CardScorePlayer } from '../../../types/cardScore';
import {
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
