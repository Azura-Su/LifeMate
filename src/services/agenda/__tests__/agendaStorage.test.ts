import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  deleteDoc,
  doc,
  getFirestore,
  getDocsFromServer,
  setDoc,
} from '@react-native-firebase/firestore';
import { deleteAgendaItem, readAgenda, saveAgendaItem } from '../agendaStorage';
import { resetFirestoreMock } from '../../../testing/firestoreMock';
import type { AgendaItem } from '../../../types/agenda';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
jest.mock('@react-native-firebase/firestore', () =>
  jest.requireActual('../../../testing/firestoreMock'),
);

beforeEach(async () => {
  await AsyncStorage.clear();
  resetFirestoreMock();
});

afterEach(() => jest.useRealTimers());

function task(): AgendaItem {
  return {
    id: 'task-1',
    ownerId: 'u1',
    title: 'Đóng tiền điện',
    details: '',
    dueAt: Date.now() + 86_400_000,
    completed: false,
    reminderAt: null,
    updatedAt: Date.now(),
  };
}

it('returns cached agenda items when the cloud read stays pending', async () => {
  const item = task();
  await AsyncStorage.setItem(
    'lifemate:agenda:v1:u1',
    JSON.stringify({ items: [item], deletedIds: [] }),
  );
  jest
    .mocked(getDocsFromServer)
    .mockImplementationOnce(() => new Promise(() => undefined));
  jest.useFakeTimers();

  const reading = readAgenda('u1');
  await Promise.resolve();
  await Promise.resolve();
  await jest.advanceTimersByTimeAsync(10_000);

  await expect(reading).resolves.toEqual({ items: [item], synced: false });
});

it('keeps a new task in the local cache when its cloud write stays pending', async () => {
  const item = task();
  jest
    .mocked(setDoc)
    .mockImplementationOnce(() => new Promise(() => undefined));
  jest.useFakeTimers();

  const saving = saveAgendaItem('u1', item);
  await jest.advanceTimersByTimeAsync(10_000);

  await expect(saving).resolves.toEqual({ items: [item], synced: false });
  const saved = await AsyncStorage.getItem('lifemate:agenda:v1:u1');
  expect(saved).toMatch(/^lifemate:aes-gcm:v1:/);
});

it('keeps a deletion pending locally when its cloud write stays pending', async () => {
  const item = task();
  await AsyncStorage.setItem(
    'lifemate:agenda:v1:u1',
    JSON.stringify({ items: [item], deletedIds: [] }),
  );
  jest
    .mocked(deleteDoc)
    .mockImplementationOnce(() => new Promise(() => undefined));
  jest.useFakeTimers();

  const removing = deleteAgendaItem('u1', item.id);
  await jest.advanceTimersByTimeAsync(10_000);

  await expect(removing).resolves.toEqual({ items: [], synced: false });
  const saved = await AsyncStorage.getItem('lifemate:agenda:v1:u1');
  expect(saved).toMatch(/^lifemate:aes-gcm:v1:/);
});

it.each([
  ['save', 'save'],
  ['save', 'delete'],
  ['delete', 'save'],
  ['delete', 'delete'],
] as const)(
  'keeps the agenda unsynced when a pending %s remains after another successful %s',
  async (pendingOperation, nextOperation) => {
    const pendingTask = { ...task(), id: 'pending-task' };
    const otherTask = { ...task(), id: 'other-task' };
    await readAgenda('u1');
    if (nextOperation === 'delete') await saveAgendaItem('u1', otherTask);

    if (pendingOperation === 'save') {
      jest.mocked(setDoc).mockRejectedValueOnce(new Error('offline'));
      expect((await saveAgendaItem('u1', pendingTask)).synced).toBe(false);
    } else {
      await saveAgendaItem('u1', pendingTask);
      jest.mocked(deleteDoc).mockRejectedValueOnce(new Error('offline'));
      expect((await deleteAgendaItem('u1', pendingTask.id)).synced).toBe(false);
    }

    const result =
      nextOperation === 'save'
        ? await saveAgendaItem('u1', otherTask)
        : await deleteAgendaItem('u1', otherTask.id);

    expect(result.synced).toBe(false);
    expect(result.items.some((item) => item.id === pendingTask.id)).toBe(
      pendingOperation === 'save',
    );
    expect(result.items.some((item) => item.id === otherTask.id)).toBe(
      nextOperation === 'save',
    );
    const retried = await readAgenda('u1');
    expect(retried.synced).toBe(true);
    expect(retried.items).toEqual(result.items);
  },
);

it('keeps the agenda unsynced until legacy tasks have also been migrated', async () => {
  await AsyncStorage.setItem(
    'lifemate:agenda:v1:u1',
    JSON.stringify({ items: [task()], deletedIds: [] }),
  );

  const saved = await saveAgendaItem('u1', { ...task(), id: 'new-task' });

  expect(saved.synced).toBe(false);
  expect((await readAgenda('u1')).synced).toBe(true);
});

it('rejects an editor snapshot older than the refreshed task before persistence', async () => {
  const original = task();
  await saveAgendaItem('u1', original);
  const remote = {
    ...original,
    details: 'New server details',
    updatedAt: original.updatedAt + 1,
  };
  await setDoc(
    doc(getFirestore(), 'agendaAccounts', 'u1', 'items', original.id),
    remote,
  );
  await readAgenda('u1');
  await expect(
    saveAgendaItem(
      'u1',
      {
        ...original,
        details: 'Old draft edit',
        updatedAt: original.updatedAt + 2,
      },
      original,
    ),
  ).rejects.toThrow('thay đổi');
  expect((await readAgenda('u1')).items).toEqual([remote]);
});
