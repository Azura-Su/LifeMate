import AsyncStorage from '@react-native-async-storage/async-storage';
import { setDoc } from '@react-native-firebase/firestore';
import { resetFirestoreMock } from '../../../testing/firestoreMock';
import type { LifeNote } from '../../../types/note';
import { readNotes, saveNote } from '../noteStorage';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
jest.mock('../../security/encryptedLocalStorage', () => {
  const storageModule = jest.requireMock(
    '@react-native-async-storage/async-storage',
  ) as { default?: typeof AsyncStorage } & typeof AsyncStorage;
  const storage = storageModule.default ?? storageModule;
  return {
    getEncryptedItem: (uid: string, key: string) => storage.getItem(key),
    setEncryptedItem: (uid: string, key: string, value: string) =>
      storage.setItem(key, value),
  };
});
jest.mock('@react-native-firebase/firestore', () =>
  jest.requireActual('../../../testing/firestoreMock'),
);

const dateNote: LifeNote = {
  id: 'calendar-day-2026-10-09',
  ownerId: 'u1',
  title: 'Ghi chú ngày 2026-10-09',
  body: 'Hẹn khám',
  updatedAt: 10,
};

beforeEach(async () => {
  await AsyncStorage.clear();
  resetFirestoreMock();
  jest.mocked(setDoc).mockClear();
});

it('stores and reloads a calendar note using the existing note schema', async () => {
  const saved = await saveNote('u1', dateNote);
  expect(saved.synced).toBe(true);
  const loaded = await readNotes('u1');
  expect(loaded.synced).toBe(true);
  expect(loaded.notes).toContainEqual(dateNote);
});

it('keeps a calendar note locally while offline and uploads it on retry', async () => {
  jest.mocked(setDoc).mockRejectedValueOnce(new Error('offline'));
  const pending = await saveNote('u1', dateNote);
  expect(pending.synced).toBe(false);
  expect(pending.notes).toContainEqual(dateNote);

  const retried = await readNotes('u1');
  expect(retried.synced).toBe(true);
  expect(retried.notes).toContainEqual(dateNote);
});
