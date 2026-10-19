import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  deleteDoc,
  setDoc,
  doc,
  getFirestore,
} from '@react-native-firebase/firestore';
import { resetFirestoreMock } from '../../../testing/firestoreMock';
import type { LifeNote } from '../../../types/note';
import { deleteNote, readNotes, saveNote } from '../noteStorage';

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
    getEncryptedItem: (_uid: string, key: string) => storage.getItem(key),
    setEncryptedItem: (_uid: string, key: string, value: string) =>
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

it.each([
  ['save', 'save'],
  ['save', 'delete'],
  ['delete', 'save'],
  ['delete', 'delete'],
] as const)(
  'keeps notes unsynced when a pending %s remains after another successful %s',
  async (pendingOperation, nextOperation) => {
    const pendingNote = { ...dateNote, id: 'pending-note' };
    const otherNote = { ...dateNote, id: 'other-note', updatedAt: 20 };
    await readNotes('u1');
    if (nextOperation === 'delete') await saveNote('u1', otherNote);

    if (pendingOperation === 'save') {
      jest.mocked(setDoc).mockRejectedValueOnce(new Error('offline'));
      expect((await saveNote('u1', pendingNote)).synced).toBe(false);
    } else {
      await saveNote('u1', pendingNote);
      jest.mocked(deleteDoc).mockRejectedValueOnce(new Error('offline'));
      expect((await deleteNote('u1', pendingNote.id)).synced).toBe(false);
    }

    const result =
      nextOperation === 'save'
        ? await saveNote('u1', otherNote)
        : await deleteNote('u1', otherNote.id);

    expect(result.synced).toBe(false);
    expect(result.notes.some((note) => note.id === pendingNote.id)).toBe(
      pendingOperation === 'save',
    );
    expect(result.notes.some((note) => note.id === otherNote.id)).toBe(
      nextOperation === 'save',
    );
    const retried = await readNotes('u1');
    expect(retried.synced).toBe(true);
    expect(retried.notes).toEqual(result.notes);
  },
);

it('keeps notes unsynced until legacy notes have also been migrated', async () => {
  await AsyncStorage.setItem(
    'lifemate:notes:v1:u1',
    JSON.stringify({ notes: [dateNote], deletedIds: [] }),
  );

  const saved = await saveNote('u1', { ...dateNote, id: 'new-note' });

  expect(saved.synced).toBe(false);
  expect((await readNotes('u1')).synced).toBe(true);
});

it('rejects an editor snapshot older than the refreshed cache without losing either version', async () => {
  await saveNote('u1', dateNote);
  const remote = { ...dateNote, body: 'New server text', updatedAt: 20 };
  await setDoc(
    doc(getFirestore(), 'noteAccounts', 'u1', 'notes', dateNote.id),
    remote,
  );
  await readNotes('u1');
  await expect(
    saveNote(
      'u1',
      { ...dateNote, body: 'Old draft edit', updatedAt: 30 },
      dateNote,
    ),
  ).rejects.toThrow('thay đổi');
  expect((await readNotes('u1')).notes).toEqual([remote]);
});
