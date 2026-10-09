import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  deleteDoc,
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
